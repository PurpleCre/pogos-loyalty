import { useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useStores } from '@/hooks/useStores';
import { useAuth } from '@/hooks/useAuth';
import { useRewardReservations } from '@/hooks/useRewardReservations';
import { RewardCard } from '@/components/rewards/RewardCard';
import { RewardRecovery } from '@/components/rewards/RewardRecovery';
import { RewardTicket } from '@/components/rewards/RewardTicket';
import { rewardError } from '@/lib/reward-orders';
import { snapshotText } from '@/lib/cash-checkout';
import type { RewardOffer, RewardRequest } from '@/lib/reward-redemption';

export default function Rewards() {
  const { user } = useAuth();
  const focused = useIsFocused();
  const { stores } = useStores();
  const [selectedBranch, setBranch] = useState<string | null>(null);
  const branchId = selectedBranch ?? stores[0]?.id ?? null;
  const scope = `${user?.id}:${branchId}`;
  const current = useRef(scope); current.current = scope;
  const [selection, setSelection] = useState<{ scope: string; offer: RewardOffer } | null>(null);
  const [messageState, setMessage] = useState<{ scope: string; text: string } | null>(null);
  const { reservations, offers, balance, reviewed, error, more, loading, execute, recover, refresh, loadMore, pending, pendingError, busy } = useRewardReservations(branchId, false, focused);
  const message = messageState?.scope === scope ? messageState.text : '';
  const selected = selection?.scope === scope ? selection.offer : null;
  const blocked = busy || !!pending || !!pendingError;
  const showMessage = (text: string) => { if (current.current === scope) setMessage({ scope, text }); };
  const act = async (request: RewardRequest) => {
    showMessage('');
    try {
      const result = await execute(request);
      if (current.current !== scope) return;
      setSelection(null);
      showMessage(request.kind === 'reserve' ? `Reservation recorded: ${result.reservation_id}. Check its current collection status below.` : 'Reservation updated. Check its current status below.');
    } catch (err) { showMessage(rewardError(err)); }
  };
  const checkPrevious = async () => {
    showMessage('');
    try { await recover(); showMessage('Previous action checked. The list shows its current state.'); }
    catch (err) { showMessage(rewardError(err)); }
  };
  if (!focused) return <View />;
  if (!user) return <View className="flex-1 p-6"><Text>Sign in to use rewards.</Text></View>;
  return <View className="flex-1 bg-slate-50">
    <View className="pt-14 pb-5 px-5 bg-white border-b border-slate-200">
      <Text className="text-2xl font-bold">Pogo’s rewards</Text>
      <Text className="mt-2 font-bold">Available: {balance?.current_points ?? '…'} pts · Held: {balance?.reserved_points ?? '…'} pts</Text>
      <Text className="text-slate-500 mt-2">Reserve an item, then collect it at your chosen branch.</Text>
    </View>
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { void refresh(); }} />}>
      <RewardRecovery pending={pending} error={pendingError} busy={busy} onRecover={() => { void checkPrevious(); }} />
      {message || error ? <Text accessibilityRole="alert" className="text-red-700 mb-4">{message || error}</Text> : null}
      {balance && !reviewed ? <Text className="text-amber-800 mb-4">Your historical opening balance needs administrator review before you can reserve rewards.</Text> : null}
      {balance && (balance.current_points ?? 0) < 0 ? <Text className="text-amber-800 mb-4">A refund has reduced your points balance. Release unused holds or contact the branch before another redemption.</Text> : null}
      <Text className="font-bold mb-2">Collection branch</Text>
      <ScrollView horizontal className="mb-5">{stores.map(store => <TouchableOpacity key={store.id} onPress={() => setBranch(store.id)}
        className={`p-3 rounded-lg mr-2 ${branchId === store.id ? 'bg-red-600' : 'bg-slate-200'}`}><Text className={branchId === store.id ? 'text-white' : 'text-slate-700'}>{store.name}</Text></TouchableOpacity>)}</ScrollView>
      {loading && !offers.length && !reservations.length ? <ActivityIndicator color="#dc2626" /> : null}
      {!offers.length && !loading ? <Text className="text-slate-500 mb-4">No approved rewards are available to reserve at this branch.</Text> : null}
      {offers.map(offer => <RewardCard key={offer.id} reward={offer} userPoints={balance?.current_points ?? 0}
        disabled={blocked || !reviewed} onReserve={value => { setSelection({ scope, offer: value }); }} />)}
      {selected ? <View className="bg-white border border-red-200 p-4 rounded-xl mb-5">
        <Text className="font-bold text-lg">Reserve {selected.name}?</Text>
        <Text className="my-2">{stores.find(store => store.id === selected.store_id)?.name} · {selected.points_cost} points</Text>
        <Text>{selected.terms}</Text>
        <Text className="text-slate-600 my-3">This holds your points and one item for {selected.reservation_minutes} minutes. Untouched cancellations and expiry release the hold. Staff record redemption after handover.</Text>
        <TouchableOpacity disabled={blocked} onPress={() => { void act({ kind: 'reserve', offerId: selected.id }); }} className="bg-red-600 p-3 rounded-lg"><Text className="text-white font-bold text-center">Confirm reservation</Text></TouchableOpacity>
        <TouchableOpacity disabled={busy} onPress={() => setSelection(null)} className="p-3"><Text className="text-center">Close</Text></TouchableOpacity>
      </View> : null}
      <Text className="font-bold text-xl my-4">Reservations and history</Text>
      {!reservations.length && !loading ? <Text className="text-slate-500">Your reward reservations will appear here.</Text> : null}
      {reservations.map(reservation => <View key={`${user.id}:${reservation.id}:${reservation.version}`} className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
        <Text className="font-bold text-lg">{snapshotText(reservation.snapshot, 'name')}</Text>
        <Text>{snapshotText(reservation.snapshot, 'branch_name')} · {reservation.status}</Text>
        <Text className="mt-2">{reservation.points_cost} points {['reserved', 'claiming'].includes(reservation.status) ? 'held' : reservation.status === 'fulfilled' ? 'redeemed' : reservation.status === 'voided' ? 'restored' : 'released'}</Text>
        <Text className="text-slate-500 mt-2">{snapshotText(reservation.snapshot, 'terms')}</Text>
        <Text className="text-xs text-slate-500 mt-2" selectable>Reservation: {reservation.id}</Text>
        {reservation.status === 'reserved' ? <>
          <Text className="text-slate-500 mt-2">Collect before {new Date(reservation.expires_at).toLocaleString()}</Text>
          <RewardTicket owner={user.id} reservationId={reservation.id} />
          <TouchableOpacity disabled={blocked} onPress={() => { void act({ kind: 'operate', reservationId: reservation.id, expectedVersion: reservation.version, action: 'cancel', details: {} }); }} className="p-3 border border-slate-300 rounded-lg"><Text className="text-center">Cancel / release unused hold</Text></TouchableOpacity>
        </> : reservation.status === 'claiming' ? <Text className="text-amber-800 mt-3">Staff have started your handover. Ask your collection branch to complete it or release the points if no item was provided.</Text> : null}
      </View>)}
      {more ? <TouchableOpacity onPress={loadMore} className="p-4"><Text className="text-red-600 text-center">Load more history</Text></TouchableOpacity> : null}
    </ScrollView>
  </View>;
}
