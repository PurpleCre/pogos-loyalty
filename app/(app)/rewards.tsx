import { Screen, PageHeading, EmptyState } from '@/components/ui/screen';
import { Gift } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { TouchTarget as TouchableOpacity } from '@/components/ui/touch-target';
import { router } from 'expo-router';
import { useIsFocused } from 'expo-router/react-navigation';
import { useStores } from '@/hooks/useStores';
import { useAuth } from '@/hooks/useAuth';
import { useRewardReservations } from '@/hooks/useRewardReservations';
import { ReadStatus } from '@/components/ReadStatus';
import { RewardCard } from '@/components/rewards/RewardCard';
import { RewardRecovery } from '@/components/rewards/RewardRecovery';
import { RewardTicket } from '@/components/rewards/RewardTicket';
import { rewardError } from '@/lib/reward-orders';
import { snapshotText } from '@/lib/cash-checkout';
import type { RewardOffer, RewardRequest } from '@/lib/reward-redemption';
import { Confirmation } from '@/components/ui/confirmation';
import { useOrder } from '@/contexts/OrderContext';

export default function Rewards() {
  const { user } = useAuth();
  const focused = useIsFocused();
  const { stores } = useStores();
  const { selectedStore } = useOrder();
  const [selectedBranch, setBranch] = useState<string | null>(null);
  const branchId = selectedBranch ?? (stores.some(store => store.id === selectedStore?.id) ? selectedStore!.id : stores[0]?.id) ?? null;
  const scope = `${user?.id}:${branchId}`;
  const current = useRef(scope); current.current = scope;
  const [selection, setSelection] = useState<{ scope: string; offer: RewardOffer } | null>(null);
  const [messageState, setMessage] = useState<{ scope: string; text: string; failed: boolean } | null>(null);
  const { reservations, offers, balance, reviewed, error, more, loading, execute, recover, refresh, loadMore, pending, pendingError, busy, fresh, refreshedAt } = useRewardReservations(branchId, false, focused);
  const message = messageState?.scope === scope ? messageState.text : '';
  const selected = selection?.scope === scope ? selection.offer : null;
  const blocked = busy || !!pending || !!pendingError || !fresh;
  const showMessage = (text: string, failed = false) => { if (current.current === scope) setMessage({ scope, text, failed }); };
  const act = async (request: RewardRequest) => {
    showMessage('');
    try {
      const result = await execute(request);
      if (current.current !== scope) return;
      setSelection(null);
      showMessage(request.kind === 'reserve' ? `Reservation recorded: ${result.reservation_id}. Check its current collection status below.` : 'Reservation updated. Check its current status below.');
    } catch (err) { showMessage(rewardError(err), true); }
  };
  const checkPrevious = async () => {
    showMessage('');
    try { await recover(); showMessage('Previous action checked. The list shows its current state.'); }
    catch (err) { showMessage(rewardError(err), true); }
  };
  if (!focused) return <View />;
  if (!user) return <Screen title="Your rewards" centered><EmptyState icon={Gift} title="Something to look forward to" description="Sign in to check your points and explore available rewards at your branch." action="Sign in for rewards" onAction={() => router.push('/(auth)/login?redirect=/(app)/rewards')} /></Screen>;
  return <Screen title="Your rewards" refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { void refresh(); }} />}>
    <PageHeading eyebrow="A LITTLE SOMETHING BACK" title="Good things to look forward to." subtitle="Reserve an available reward, then collect it at your chosen branch." />
    <View className="bg-brand-950 rounded-3xl p-6 mb-3"><Text className="text-brand-100 text-sm">Your points</Text><Text className="text-white text-3xl font-extrabold mt-2">{balance?.current_points ?? '…'} <Text className="text-base font-normal">available</Text></Text><Text className="text-brand-100 text-sm mt-2">{balance?.reserved_points ?? '…'} points held for rewards</Text></View>
      <ReadStatus label="Rewards and points" fresh={fresh} at={refreshedAt} error={error} loading={loading} onRefresh={() => { void refresh(); }} />
      <RewardRecovery pending={pending} error={pendingError} busy={busy} onRecover={() => { void checkPrevious(); }} />
      {message ? <Text accessibilityLiveRegion="polite" accessibilityRole={messageState?.failed ? 'alert' : undefined} className={`rounded-xl p-4 mb-4 ${messageState?.failed ? 'text-red-700 bg-red-50' : 'text-brand-900 bg-brand-50'}`}>{message}</Text> : null}
      {error ? <Text accessibilityRole="alert" className="text-red-700 mb-4">{error}</Text> : null}
      {balance && !reviewed ? <Text className="text-amber-800 mb-4">Your historical opening balance needs administrator review before you can reserve rewards.</Text> : null}
      {balance && (balance.current_points ?? 0) < 0 ? <Text className="text-amber-800 mb-4">A refund has reduced your points balance. Release unused holds or contact the branch before another redemption.</Text> : null}
      <Text className="font-bold mb-2">Collection branch</Text>
      <ScrollView horizontal className="mb-5">{stores.map(store => <TouchableOpacity key={store.id} accessibilityRole="radio" accessibilityState={{ checked: branchId === store.id }} onPress={() => setBranch(store.id)}
        className={`p-3 rounded-lg mr-2 ${branchId === store.id ? 'bg-brand-800' : 'bg-white border border-line'}`}><Text className={branchId === store.id ? 'text-white' : 'text-slate-700'}>{store.name}</Text></TouchableOpacity>)}</ScrollView>
      {loading && !offers.length && !reservations.length ? <ActivityIndicator color="#dc2626" /> : null}
      {!offers.length && fresh ? <EmptyState icon={Gift} title="More good things ahead" description="No approved rewards are available to reserve at this branch right now. Check another branch or come back later." /> : null}
      {offers.map(offer => <RewardCard key={offer.id} reward={offer} userPoints={balance?.current_points ?? 0}
        disabled={blocked || !reviewed} onReserve={value => { setSelection({ scope, offer: value }); }} />)}
      <Confirmation visible={!!selected} title={selected ? `Reserve ${selected.name}?` : 'Review reservation'} confirmLabel="Confirm reservation" cancelLabel="Keep browsing rewards" busy={busy} disabled={blocked} onClose={() => setSelection(null)} onConfirm={() => { if (selected && !blocked) void act({ kind: 'reserve', offerId: selected.id }); }}>
        {selected ? <>
        <Text className="my-2">{stores.find(store => store.id === selected.store_id)?.name} · {selected.points_cost} points</Text>
        <Text>{selected.terms}</Text>
        <Text className="text-subtle my-3">This holds your points and one item for {selected.reservation_minutes} minutes. Untouched cancellations and expiry release the hold. Staff record redemption after handover.</Text>
        {messageState?.scope === scope && messageState.failed && message ? <Text accessibilityRole="alert" className="text-red-700 mt-3">{message}</Text> : null}
        </> : null}
      </Confirmation>
      <Text className="font-bold text-xl my-4">Reservations and history</Text>
      {!reservations.length && fresh ? <Text className="text-subtle">Your reward reservations will appear here.</Text> : null}
      {reservations.map(reservation => <View key={`${user.id}:${reservation.id}:${reservation.version}`} className="bg-white rounded-xl border border-line p-4 mb-4">
        <Text className="font-bold text-lg">{snapshotText(reservation.snapshot, 'name')}</Text>
        <Text>{snapshotText(reservation.snapshot, 'branch_name')} · {reservation.status}</Text>
        <Text className="mt-2">{reservation.points_cost} points {['reserved', 'claiming'].includes(reservation.status) ? 'held' : reservation.status === 'fulfilled' ? 'redeemed' : reservation.status === 'voided' ? 'restored' : 'released'}</Text>
        <Text className="text-subtle mt-2">{snapshotText(reservation.snapshot, 'terms')}</Text>
        <Text className="text-xs text-subtle mt-2" selectable>Reservation: {reservation.id}</Text>
        {reservation.status === 'reserved' ? <>
          <Text className="text-subtle mt-2">Collect before {new Date(reservation.expires_at).toLocaleString()}</Text>
          <RewardTicket owner={user.id} reservationId={reservation.id} />
          <TouchableOpacity disabled={blocked} onPress={() => { void act({ kind: 'operate', reservationId: reservation.id, expectedVersion: reservation.version, action: 'cancel', details: {} }); }} className="p-3 border border-slate-300 rounded-lg"><Text className="text-center">Cancel / release unused hold</Text></TouchableOpacity>
        </> : reservation.status === 'claiming' ? <Text className="text-amber-800 mt-3">Staff have started your handover. Ask your collection branch to complete it or release the points if no item was provided.</Text> : null}
      </View>)}
      {more ? <TouchableOpacity onPress={loadMore} className="p-4"><Text className="text-brand-800 text-center">Load more history</Text></TouchableOpacity> : null}
  </Screen>;
}
