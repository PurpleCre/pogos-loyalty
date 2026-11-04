import { Screen, PageHeading, EmptyState, Card } from '@/components/ui/screen';
import { Button } from '@/components/ui/button';
import { ShoppingBag } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { View, Text, ActivityIndicator, AppState, ScrollView, TextInput as NativeInput, Keyboard } from 'react-native';
import { Input as TextInput } from '@/components/ui/input';
import { TouchTarget as TouchableOpacity } from '@/components/ui/touch-target';
import { router } from 'expo-router';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/hooks/useAuth';
import { useOrder } from '@/contexts/OrderContext';
import { useCheckoutDraft } from '@/contexts/CheckoutDraftContext';
import { checkoutFieldErrors } from '@/lib/checkout-guidance';
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
  const { items, storeId, cartTotal, updateQuantity, removeFromCart, retireSubmittedSelections, hydrated, saving, storageError } = useCart();
  const { user } = useAuth();
  const { selectedStore, setSelectedStore, deliveryLocation } = useOrder();
  const { stores } = useStores();
  const branch = selectedStore?.id === storeId ? selectedStore : stores.find(store => store.id === storeId);
  const { details, setDetails, clearDetails } = useCheckoutDraft();
  const { mode, name, phone, address, instructions } = details;
  const setMode = (value: 'collection' | 'delivery') => setDetails(previous => ({ ...previous, mode: value }));
  const setName = (value: string) => setDetails(previous => ({ ...previous, name: value }));
  const setPhone = (value: string) => setDetails(previous => ({ ...previous, phone: value }));
  const setAddress = (value: string) => setDetails(previous => ({ ...previous, address: value }));
  const setInstructions = (value: string) => setDetails(previous => ({ ...previous, instructions: value }));
  const [attempted, setAttempted] = useState(false);
  const nameRef = useRef<ComponentRef<typeof NativeInput>>(null), phoneRef = useRef<ComponentRef<typeof NativeInput>>(null), addressRef = useRef<ComponentRef<typeof NativeInput>>(null);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
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

  useEffect(() => {
    const locationKey = deliveryLocation ? JSON.stringify([deliveryLocation.id, deliveryLocation.address]) : '';
    setDetails(previous => previous.locationKey === locationKey ? previous : { ...previous, locationKey, address: deliveryLocation?.address ?? '' });
  }, [deliveryLocation?.id, deliveryLocation?.address, setDetails]);
  useEffect(() => {
    setReview(null); setPending(null); setError('');
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
  const validation = checkoutFieldErrors(request);
  const fieldErrors = attempted ? validation : {};
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
    clearDetails();
    router.replace(`/(app)/order-success?orderId=${orderId}`);
  };
  const getTotal = () => {
    if (user) {
      setAttempted(true);
      if (Object.keys(validation).length) {
        setError('Check the highlighted details before getting your total.');
        if (validation.name) nameRef.current?.focus();
        else if (validation.phone) phoneRef.current?.focus();
        else if (validation.address && !validation.location) addressRef.current?.focus();
        return;
      }
    }
    return run(async owner => {
    if (!cartReady) throw new Error('Save or restore your selections before requesting a total.');
    if (!storeId) throw new Error('Select the branch for this cart before checkout.');
    if (mode === 'delivery' && !deliveryLocation) throw new Error('Choose your delivery location and enter its written address.');
    Keyboard.dismiss();
    const version = lifecycle.current;
    const response = await quoteCashOrder(request, owner);
    if (mounted.current && account.current === owner && currentDraft.current === draft && lifecycle.current === version && AppState.currentState === 'active') setReview({ draft, quote: response, receivedAt: Date.now(), monotonicAt: performance.now(), expiresAt: response.expires_at });
    });
  };
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
    <Screen title="Your cash order" scrollRef={scrollRef}>
        <PageHeading eyebrow="CHECKOUT" title="Make it a Pogo’s order." subtitle="Review your meals and contact details. You’ll confirm a fresh cash total before placing the order." />
        <CartStorageStatus />
        <Text className="text-subtle mb-4">Selections are saved on this device. A fresh online total is required to order. After an interrupted submission, check the same saved order reference.</Text>
        {loadingRecovery ? <ActivityIndicator color="#174d45" accessibilityLabel="Checking saved order reference" /> : pending ? (
          <View className="bg-amber-50 border border-amber-200 p-5 rounded-xl mb-5">
            <Text className="font-bold text-lg text-ink">Check your previous order</Text>
            <Text className="text-slate-700 mt-2">Its confirmation was interrupted. Check it before placing another order.</Text>
            <TouchableOpacity disabled={busy} onPress={retryPending} className="bg-brand-800 p-4 rounded-xl mt-4 items-center">
              <Text className="text-white font-bold">{busy ? 'Checking…' : 'Check order'}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {error ? <Text accessibilityRole="alert" className="text-red-700 bg-red-50 p-4 rounded-xl mb-4">{error}</Text> : null}
        {recoveryBlocked && !loadingRecovery ? <View className="mb-4">
          <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => { setError(''); void recoveryReader.read(); }} className="p-4 bg-amber-100 rounded-xl"><Text className="font-bold">Retry reading saved order reference</Text></TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" onPress={() => router.push('/support')} className="p-4"><Text className="text-brand-800 font-bold">Get help with this order reference</Text></TouchableOpacity>
        </View> : null}
        {!loadingRecovery && !pending && !recoveryBlocked && items.length === 0 ? (
          <EmptyState icon={ShoppingBag} title="Something good belongs here." description="Your cart is empty. Choose a branch and find your favourites to get started." action="Explore branch menus" onAction={() => router.push('/store-picker')} />
        ) : null}
        {items.length > 0 && !pending && !loadingRecovery && !recoveryBlocked ? (
          <>
            <Text className="text-xs text-brand-700 font-bold tracking-widest mb-2">1 · YOUR MEALS</Text><Text className="text-xl font-bold text-ink mb-5">{branch?.name ?? 'Your selected branch'}</Text>
            <Button variant="outline" disabled={busy} className="mb-4" onPress={() => { if (branch) { setSelectedStore(branch); router.push('/(app)/menu'); } else router.push('/store-picker'); }}>Add more meals</Button>
            {items.map(item => (
              <View key={item.id} className="bg-white rounded-xl border border-line p-4 mb-3">
                <Text className="font-bold text-ink">{item.name}</Text>
                {item.choice_labels.length > 0 ? <Text className="text-subtle mt-1">{item.choice_labels.join(', ')}</Text> : null}
                <Text className="text-subtle mt-2">{formatMoney(Math.round(item.subtotal * 100), 'USD')} · menu estimate</Text>
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
            <Text className="font-semibold text-ink mt-2 mb-1">Meals estimate: {formatMoney(Math.round(cartTotal * 100), 'USD')}</Text>
            <Text className="text-subtle text-sm mb-4">Delivery fees and the final cash amount are confirmed in your online total.</Text>
            {!user ? <Card><Text className="font-bold text-lg text-ink mb-2">Sign in before entering your details</Text><Text className="text-subtle leading-6 mb-4">Sign in to choose collection or delivery and add contact details. Your account’s saved cart is restored if it has one; otherwise these meal selections carry over.</Text><Button onPress={() => router.push('/(auth)/login?redirect=/(app)/cart')}>Sign in to continue</Button></Card> : <>
            <View className="flex-row gap-3 my-4">
              {(['delivery', 'collection'] as const).map(value => <TouchableOpacity key={value} accessibilityRole="radio" accessibilityState={{ checked: mode === value }} disabled={busy} onPress={() => setMode(value)} className={`flex-1 p-4 rounded-xl border ${mode === value ? 'bg-brand-50 border-brand-600' : 'bg-white border-line'}`}><Text className="text-center font-bold">{value === 'delivery' ? 'Cash on delivery' : 'Cash on collection'}</Text></TouchableOpacity>)}
            </View>
            <View className="bg-white border border-line rounded-3xl p-5 my-3"><Text className="text-lg font-bold text-ink mb-5">2 · Contact details</Text><Text className="font-semibold mb-2">Contact name</Text>
            <TextInput ref={nameRef} accessibilityLabel="Contact name" accessibilityHint={fieldErrors.name} aria-invalid={!!fieldErrors.name} editable={!busy} value={name} onChangeText={setName} autoComplete="name" autoCapitalize="words" returnKeyType="next" onSubmitEditing={() => phoneRef.current?.focus()} maxLength={120} className={`bg-white border rounded-xl p-4 mb-2 ${fieldErrors.name ? 'border-red-600' : 'border-line'}`} />
            {fieldErrors.name ? <Text accessibilityRole="alert" className="text-red-700 text-sm mb-3">{fieldErrors.name}</Text> : <View className="h-2" />}
            <Text className="font-semibold mb-2">Phone number</Text>
            <TextInput ref={phoneRef} accessibilityLabel="Contact phone number" accessibilityHint={fieldErrors.phone} aria-invalid={!!fieldErrors.phone} editable={!busy} value={phone} onChangeText={setPhone} autoComplete="tel" keyboardType="phone-pad" placeholder="077 123 4567" maxLength={30} className={`bg-white border rounded-xl p-4 mb-2 ${fieldErrors.phone ? 'border-red-600' : 'border-line'}`} />
            <Text accessibilityRole={fieldErrors.phone ? 'alert' : undefined} className={`text-sm mb-2 ${fieldErrors.phone ? 'text-red-700' : 'text-subtle'}`}>{fieldErrors.phone || 'We’ll use this number to contact you about this order.'}</Text>
            </View>
            {mode === 'delivery' ? <View className="bg-white border border-line rounded-3xl p-5 my-3"><Text className="text-lg font-bold text-ink mb-5">3 · Delivery address</Text>
              <TouchableOpacity disabled={busy} onPress={() => setShowLocation(true)} className="p-4 bg-white border border-line rounded-xl mb-4"><Text className="text-brand-800 font-bold">{deliveryLocation ? 'Change map pin' : 'Choose delivery map pin'}</Text></TouchableOpacity>
              {fieldErrors.location ? <Text accessibilityRole="alert" className="text-red-700 text-sm mb-3">{fieldErrors.location}</Text> : null}
              <Text className="font-semibold mb-2">Written delivery address</Text>
              <TextInput ref={addressRef} accessibilityLabel="Written delivery address" accessibilityHint={fieldErrors.address} aria-invalid={!!fieldErrors.address} editable={!busy} value={address} onChangeText={setAddress} maxLength={500} multiline className={`bg-white border rounded-xl p-4 mb-2 ${fieldErrors.address ? 'border-red-600' : 'border-line'}`} />
              {fieldErrors.address ? <Text accessibilityRole="alert" className="text-red-700 text-sm mb-3">{fieldErrors.address}</Text> : <View className="h-2" />}
              <Text className="font-semibold mb-2">Landmarks or delivery instructions (optional)</Text>
              <TextInput accessibilityLabel="Delivery instructions" editable={!busy} value={instructions} onChangeText={setInstructions} maxLength={500} multiline className="bg-white border border-line rounded-xl p-4 mb-4" />
            </View> : <Text className="text-subtle mb-4">Collect and pay cash at the selected branch.</Text>}
            {quote ? <View onLayout={() => scrollRef.current?.scrollToEnd({ animated: true })} className="p-5 bg-white border border-line rounded-xl mt-2">
              <Text accessibilityLiveRegion="polite" className="font-bold text-lg mb-3">Review your order</Text>
              <Text className="font-semibold text-ink mb-2">{quote.branch_name} · {quote.fulfilment_mode === 'delivery' ? 'Delivery' : 'Collection'}</Text>
              <Text className="text-subtle mb-2">{quote.contact.name} · {quote.contact.phone}</Text>
              {quote.address ? <Text className="text-subtle mb-3">{quote.address.address}{quote.address.instructions ? ` · ${quote.address.instructions}` : ''}</Text> : <Text className="text-subtle mb-3">{branch?.address || 'Confirm the collection address with your branch.'}</Text>}
              {quote.lines.map((line, index) => <View key={`${line.menu_item_id}-${index}`} className="mb-3"><Text>{line.quantity} × {line.name}: {formatMoney(line.line_total_minor, quote.currency)}</Text><Text className="text-subtle text-sm">{line.modifiers.map(option => option.name).join(', ')}</Text></View>)}
              <Text>Meals: {formatMoney(quote.subtotal_minor, quote.currency)}</Text>
              {quote.fulfilment_mode === 'delivery' ? <Text>Delivery: {formatMoney(quote.delivery_fee_minor, quote.currency)}</Text> : null}
              <Text className="font-bold text-xl mt-2">Cash due: {formatMoney(quote.total_minor, quote.currency)}</Text>
              <Text className="text-subtle mt-2">{quote.loyalty_earn_configured ? `Estimated earning: ${quote.estimated_points} points after payment and handover. Existing balances may need review.` : 'Points earning is not configured for this order.'}</Text>
              <Text className="text-subtle mt-3">Total expires at {new Date(quote.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. The branch still needs to confirm your order.</Text>
              <TouchableOpacity disabled={busy || !cartReady} onPress={placeOrder} className="p-4 bg-brand-800 rounded-xl items-center mt-4"><Text className="text-white font-bold">{busy ? 'Submitting…' : 'Place cash order'}</Text></TouchableOpacity>
            </View> : <>
              {review ? <Text accessibilityRole="alert" className="text-amber-900 bg-amber-50 p-4 rounded-xl mb-3">{review.draft !== draft ? 'Your order details changed. Get a fresh total to review the updated order.' : 'Your total has expired or needs checking again. Get a fresh total before placing the order.'}</Text> : null}
              <Text className="text-subtle mb-3">Get your branch’s total, including delivery, before placing the order.</Text>
              <TouchableOpacity disabled={busy || !cartReady} onPress={getTotal} className="p-4 bg-brand-800 rounded-xl items-center"><Text className="text-white font-bold">{busy ? 'Checking…' : 'Get my cash total'}</Text></TouchableOpacity>
            </>}
            </>}
          </>
        ) : null}
      <LocationPickerModal visible={showLocation} initialAddress={address} onClose={() => setShowLocation(false)} />
    </Screen>
  );
}
