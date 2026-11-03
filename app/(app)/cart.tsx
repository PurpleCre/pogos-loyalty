import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, AppState } from 'react-native';
import { router } from 'expo-router';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/hooks/useAuth';
import { useOrder } from '@/contexts/OrderContext';
import { useStores } from '@/hooks/useStores';
import { LocationPickerModal } from '@/components/LocationPickerModal';
import { CartStorageStatus } from '@/components/CartStorageStatus';
import { quoteReviewIsCurrent, createRecoveryReader } from '@/lib/checkout-lifecycle';
import { cartSelectionFingerprint, checkoutLines } from '@/lib/cart';
import { normaliseContactPhone, type CashQuote, type CheckoutRequest, type PendingCheckout } from '@/lib/cash-checkout';
import { checkoutRecovery, quoteCashOrder, submitCashOrder, formatMoney } from '@/lib/cash-orders';

export default function CartScreen() {
  const { user } = useAuth();
  return <CashCart key={user?.id ?? 'guest'} />;
}

function CashCart() {
  const { items, storeId, updateQuantity, removeFromCart, retireSubmittedSelections, hydrated, saving, storageError } = useCart();
  const { user } = useAuth();
  const { selectedStore, deliveryLocation } = useOrder();
  const { stores } = useStores();
  const branch = selectedStore?.id === storeId ? selectedStore : stores.find(store => store.id === storeId);
  const [mode, setMode] = useState<'collection' | 'delivery'>('delivery');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [instructions, setInstructions] = useState('');
  const [showLocation, setShowLocation] = useState(false);
  const [review, setReview] = useState<{ draft: string; quote: CashQuote; receivedAt: number; monotonicAt: number; expiresAt: string } | null>(null);
  const [pending, setPending] = useState<PendingCheckout | null>(null);
  const [loadingRecovery, setLoadingRecovery] = useState(true);
  const [recoveryBlocked, setRecoveryBlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  const lifecycle = useRef(0);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [clock, setClock] = useState(Date.now());
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const account = useRef(user?.id);
  account.current = user?.id;
  const fingerprint = cartSelectionFingerprint({ items, storeId });
  const recoveryReader = useMemo(() => createRecoveryReader(
    () => user ? checkoutRecovery.load(user.id) : Promise.resolve(null),
    state => {
      setPending(state.pending); setLoadingRecovery(state.loading); setRecoveryBlocked(state.blocked);
      if (state.blocked) setError('Your previous order reference could not be read. Retry checking it or contact your branch before ordering again.');
    },
  ), [user?.id]);

  useEffect(() => { setAddress(deliveryLocation?.address ?? ''); }, [deliveryLocation?.id, deliveryLocation?.address]);
  useEffect(() => {
    setReview(null); setPending(null); setError(''); setName(''); setPhone('');
    recoveryReader.activate(); void recoveryReader.read();
    return () => recoveryReader.stop();
  }, [recoveryReader]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', next => {
      ++lifecycle.current; setActive(next === 'active'); setReview(null);
      if (next === 'active' && user && !inFlight.current) {
        void recoveryReader.read();
      }
    });
    const timer = setInterval(() => { if (AppState.currentState === 'active') setClock(Date.now()); }, 1000);
    return () => { subscription.remove(); clearInterval(timer); recoveryReader.invalidate(); };
  }, [user?.id, recoveryReader]);

  const request: CheckoutRequest = useMemo(() => ({
    store_id: storeId ?? '', fulfilment_mode: mode,
    contact: { name: name.trim(), phone: normaliseContactPhone(phone) },
    address: mode === 'delivery' && deliveryLocation ? {
      address: address.trim(), latitude: deliveryLocation.latitude, longitude: deliveryLocation.longitude, instructions: instructions.trim(),
    } : null,
    lines: checkoutLines(items),
  }), [storeId, mode, name, phone, address, deliveryLocation, instructions, items]);
  const draft = JSON.stringify(request);
  const currentDraft = useRef(draft);
  currentDraft.current = draft;
  const quote = quoteReviewIsCurrent(review, draft, Math.max(clock, Date.now()), performance.now(), active) ? review!.quote : null;
  const cartReady = hydrated && !saving && !storageError;

  const message = (cause: unknown) => typeof cause === 'object' && cause !== null && 'message' in cause && typeof cause.message === 'string'
    ? cause.message : 'Unable to confirm your order. Please retry using the same order reference.';
  const run = async (operation: (owner: string) => Promise<void>) => {
    if (!user) { router.push('/(auth)/login?redirect=/(app)/cart'); return; }
    if (inFlight.current || AppState.currentState !== 'active') return;
    recoveryReader.invalidate();
    const owner = user.id;
    inFlight.current = true; setBusy(true); setError('');
    try { await operation(owner); }
    catch (cause) {
      if (mounted.current && account.current === owner) {
        setError(message(cause));
        if (typeof cause === 'object' && cause !== null && 'code' in cause && cause.code === '22023') setReview(null);
        try {
          const checkpoint = await checkoutRecovery.load(owner);
          if (mounted.current && account.current === owner) setPending(checkpoint);
        }
        catch { if (mounted.current && account.current === owner) setRecoveryBlocked(true); }
      }
    } finally {
      inFlight.current = false;
      if (mounted.current && account.current === owner) setBusy(false);
    }
  };
  const finish = (owner: string, orderId: string, submittedCart: string) => {
    if (!mounted.current || account.current !== owner) return;
    setPending(null); setReview(null);
    retireSubmittedSelections(submittedCart);
    router.replace(`/(app)/order-success?orderId=${orderId}`);
  };
  const getTotal = () => run(async owner => {
    if (!cartReady) throw new Error('Save or restore your selections before requesting a total.');
    if (!storeId) throw new Error('Select the branch for this cart before checkout.');
    if (mode === 'delivery' && !deliveryLocation) throw new Error('Choose your delivery location and enter its written address.');
    const version = lifecycle.current;
    const response = await quoteCashOrder(request, owner);
    if (mounted.current && account.current === owner && currentDraft.current === draft && lifecycle.current === version && AppState.currentState === 'active') setReview({ draft, quote: response, receivedAt: Date.now(), monotonicAt: performance.now(), expiresAt: response.expires_at });
  });
  const placeOrder = () => run(async owner => {
    if (!cartReady) throw new Error('Save or restore your selections before ordering.');
    if (!quote || !quoteReviewIsCurrent(review, draft, Date.now(), performance.now(), AppState.currentState === 'active')) throw new Error('Get and review your total before placing the order.');
    const result = await checkoutRecovery.place(owner, quote.quote_id, fingerprint, (q, key) => submitCashOrder(owner, q, key));
    finish(owner, result.order_id, fingerprint);
  });
  const retryPending = () => run(async owner => {
    if (!pending) return;
    const result = await checkoutRecovery.recover(owner, pending, (q, key) => submitCashOrder(owner, q, key));
    finish(owner, result.order_id, pending.cartFingerprint);
  });

  return (
    <View className="flex-1 bg-slate-50">
      <View className="bg-red-600 pt-14 pb-5 px-5 flex-row items-center justify-between">
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Go back"><Text className="text-white font-bold">Back</Text></TouchableOpacity>
        <Text className="text-white text-xl font-bold">Your cash order</Text>
        <View className="w-8" />
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <CartStorageStatus />
        <Text className="text-slate-600 mb-4">Selections are saved on this device. A fresh online total is required to order. After an interrupted submission, check the same saved order reference.</Text>
        {loadingRecovery ? <ActivityIndicator color="#dc2626" /> : pending ? (
          <View className="bg-amber-50 border border-amber-200 p-5 rounded-xl mb-5">
            <Text className="font-bold text-lg text-slate-900">Check your previous order</Text>
            <Text className="text-slate-700 mt-2">Its confirmation was interrupted. Check it before placing another order.</Text>
            <TouchableOpacity disabled={busy} onPress={retryPending} className="bg-red-600 p-4 rounded-xl mt-4 items-center">
              <Text className="text-white font-bold">{busy ? 'Checking…' : 'Check order'}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {error ? <Text accessibilityRole="alert" className="text-red-700 bg-red-50 p-4 rounded-xl mb-4">{error}</Text> : null}
        {recoveryBlocked && !loadingRecovery ? <View className="mb-4">
          <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => { setError(''); void recoveryReader.read(); }} className="p-4 bg-amber-100 rounded-xl"><Text className="font-bold">Retry reading saved order reference</Text></TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" onPress={() => router.push('/support')} className="p-4"><Text className="text-red-700 font-bold">Get help with this order reference</Text></TouchableOpacity>
        </View> : null}
        {!loadingRecovery && !pending && !recoveryBlocked && items.length === 0 ? (
          <View className="items-center py-12"><Text className="text-xl font-bold">Your cart is empty</Text>
            <TouchableOpacity onPress={() => router.push('/store-picker')} className="mt-5 p-4 bg-red-600 rounded-xl"><Text className="text-white font-bold">Choose a branch</Text></TouchableOpacity>
          </View>
        ) : null}
        {items.length > 0 && !pending && !loadingRecovery && !recoveryBlocked ? (
          <>
            <Text className="text-xl font-bold text-slate-900 mb-4">{branch?.name ?? 'Your selected branch'}</Text>
            {items.map(item => (
              <View key={item.id} className="bg-white rounded-xl border border-slate-200 p-4 mb-3">
                <Text className="font-bold text-slate-900">{item.name}</Text>
                {item.choice_labels.length > 0 ? <Text className="text-slate-500 mt-1">{item.choice_labels.join(', ')}</Text> : null}
                <View className="flex-row items-center justify-between mt-3">
                  <View className="flex-row items-center gap-4">
                    <TouchableOpacity disabled={busy} accessibilityLabel={`Reduce ${item.name} quantity`} onPress={() => updateQuantity(item.id, item.quantity - 1)} className="p-3 bg-slate-100 rounded-lg"><Text>−</Text></TouchableOpacity>
                    <Text>{item.quantity}</Text>
                    <TouchableOpacity disabled={busy || item.quantity >= 99} accessibilityLabel={`Increase ${item.name} quantity`} onPress={() => updateQuantity(item.id, item.quantity + 1)} className="p-3 bg-slate-100 rounded-lg"><Text>+</Text></TouchableOpacity>
                  </View>
                  <TouchableOpacity disabled={busy} onPress={() => removeFromCart(item.id)}><Text className="text-red-600">Remove</Text></TouchableOpacity>
                </View>
              </View>
            ))}
            <View className="flex-row gap-3 my-4">
              {(['delivery', 'collection'] as const).map(value => <TouchableOpacity key={value} disabled={busy} onPress={() => setMode(value)} className={`flex-1 p-4 rounded-xl border ${mode === value ? 'bg-red-50 border-red-500' : 'bg-white border-slate-200'}`}><Text className="text-center font-bold">{value === 'delivery' ? 'Cash on delivery' : 'Cash on collection'}</Text></TouchableOpacity>)}
            </View>
            <Text className="font-semibold mb-2">Contact name</Text>
            <TextInput accessibilityLabel="Contact name" editable={!busy} value={name} onChangeText={setName} maxLength={120} className="bg-white border border-slate-200 rounded-xl p-4 mb-4" />
            <Text className="font-semibold mb-2">Phone number</Text>
            <TextInput accessibilityLabel="Contact phone number" editable={!busy} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="077 123 4567" maxLength={30} className="bg-white border border-slate-200 rounded-xl p-4 mb-4" />
            {mode === 'delivery' ? <>
              <TouchableOpacity disabled={busy} onPress={() => setShowLocation(true)} className="p-4 bg-white border border-slate-200 rounded-xl mb-4"><Text className="text-red-600 font-bold">{deliveryLocation ? 'Change map pin' : 'Choose delivery map pin'}</Text></TouchableOpacity>
              <Text className="font-semibold mb-2">Written delivery address</Text>
              <TextInput accessibilityLabel="Written delivery address" editable={!busy} value={address} onChangeText={setAddress} maxLength={500} multiline className="bg-white border border-slate-200 rounded-xl p-4 mb-4" />
              <Text className="font-semibold mb-2">Landmarks or delivery instructions</Text>
              <TextInput accessibilityLabel="Delivery instructions" editable={!busy} value={instructions} onChangeText={setInstructions} maxLength={500} multiline className="bg-white border border-slate-200 rounded-xl p-4 mb-4" />
            </> : <Text className="text-slate-600 mb-4">Collect and pay cash at the selected branch.</Text>}
            {quote ? <View className="p-5 bg-white border border-slate-200 rounded-xl mt-2">
              <Text className="font-bold text-lg mb-3">Review your order</Text>
              {quote.lines.map((line, index) => <View key={`${line.menu_item_id}-${index}`} className="mb-3"><Text>{line.quantity} × {line.name}: {formatMoney(line.line_total_minor, quote.currency)}</Text><Text className="text-slate-500 text-sm">{line.modifiers.map(option => option.name).join(', ')}</Text></View>)}
              <Text>Meals: {formatMoney(quote.subtotal_minor, quote.currency)}</Text>
              {quote.fulfilment_mode === 'delivery' ? <Text>Delivery: {formatMoney(quote.delivery_fee_minor, quote.currency)}</Text> : null}
              <Text className="font-bold text-xl mt-2">Cash due: {formatMoney(quote.total_minor, quote.currency)}</Text>
              <Text className="text-slate-600 mt-2">{quote.loyalty_earn_configured ? `Estimated earning: ${quote.estimated_points} points after payment and handover. Existing balances may need review.` : 'Points earning is not configured for this order.'}</Text>
              <Text className="text-slate-500 mt-3">This total is valid for five minutes. The branch still needs to confirm your order.</Text>
              <TouchableOpacity disabled={busy || !cartReady} onPress={placeOrder} className="p-4 bg-red-600 rounded-xl items-center mt-4"><Text className="text-white font-bold">{busy ? 'Submitting…' : 'Place cash order'}</Text></TouchableOpacity>
            </View> : <>
              <Text className="text-slate-500 mb-3">Get your branch’s total, including delivery, before placing the order.</Text>
              <TouchableOpacity disabled={busy || !cartReady} onPress={getTotal} className="p-4 bg-red-600 rounded-xl items-center"><Text className="text-white font-bold">{busy ? 'Checking…' : 'Get total'}</Text></TouchableOpacity>
            </>}
          </>
        ) : null}
      </ScrollView>
      <LocationPickerModal visible={showLocation} onClose={() => setShowLocation(false)} />
    </View>
  );
}
