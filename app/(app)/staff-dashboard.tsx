import { View, Text, ScrollView, TouchableOpacity, RefreshControl, TextInput } from 'react-native';
import { useStaff } from '@/hooks/useStaff';
import { useAuth } from '@/hooks/useAuth';
import { StaffOrders } from '@/components/staff/StaffOrders';
import { StaffRewards } from '@/components/staff/StaffRewards';
import { useState, useEffect, useRef } from 'react';
import { useIsFocused } from 'expo-router/react-navigation';
import { useLocalSearchParams } from 'expo-router';
import { useStores } from '@/hooks/useStores';
import { formatMoney } from '@/lib/cash-orders';
import { staffError } from '@/lib/staff-orders';

export default function StaffDashboard() {
  const isFocused = useIsFocused();
  const { user, userRole, staffStoreIds } = useAuth();
  const { stores } = useStores();
  const { storeId } = useLocalSearchParams<{ storeId?: string }>();
  const [tab, setTab] = useState<'orders' | 'rewards'>('orders');
  const [selectedBranch, setSelectedBranch] = useState<string | null>(storeId ?? null);
  const [lookupState, setLookup] = useState<{ scope: string; value: string }>({ scope: '', value: '' });
  const [messageState, setMessage] = useState<{ scope: string; value: string }>({ scope: '', value: '' });
  const isAdmin = userRole === 'admin';
  const branches = isAdmin ? stores : stores.filter(store => staffStoreIds.includes(store.id));
  const branchId = branches.some(store => store.id === selectedBranch) ? selectedBranch : branches[0]?.id ?? null;
  const scope = `${user?.id}:${branchId}`;
  const current = useRef(scope); current.current = scope;
  const message = messageState.scope === scope ? messageState.value : '';
  const lookup = lookupState.scope === scope ? lookupState.value : '';
  const showMessage = (value: string) => { if (current.current === scope) setMessage({ scope, value }); };
  useEffect(() => { if (storeId) setSelectedBranch(storeId); }, [storeId]);
  const { orders, roster, summary, error, isLoading, hasMore, loadMore, fetchStoreOrders, operate, recover,
    pending, pendingError, busy, findOrder } = useStaff(branchId, isFocused && tab === 'orders');
  const permitted = isAdmin || userRole === 'staff';
  const checkPrevious = async () => {
    showMessage('');
    try { await recover(); showMessage('Previous action checked. Refresh the branch to see its current state.'); }
    catch (err) { showMessage(staffError(err)); }
  };
  const locate = async () => {
    showMessage('');
    try { await findOrder(lookup); } catch (err) { showMessage(staffError(err)); }
  };
  if (!isFocused) return <View />;
  if (!permitted || !user) return <View className="flex-1 justify-center p-6"><Text>Staff access required.</Text></View>;
  return <View className="flex-1 bg-slate-50">
    <View className="bg-zinc-900 pt-14 pb-5 px-5">
      <Text className="text-white text-xl font-bold">{stores.find(store => store.id === branchId)?.name ?? 'Select a branch'}</Text>
      <Text className="text-slate-300">Orders and cash handover</Text>
      {branches.length > 1 ? <ScrollView horizontal className="mt-3">{branches.map(store => <TouchableOpacity key={store.id}
        onPress={() => setSelectedBranch(store.id)} className={`px-4 py-3 rounded-lg mr-2 ${branchId === store.id ? 'bg-red-600' : 'bg-zinc-700'}`}>
        <Text className="text-white">{store.name}</Text>
      </TouchableOpacity>)}</ScrollView> : null}
    </View>
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} refreshControl={<RefreshControl refreshing={isLoading && orders.length > 0} onRefresh={() => { void fetchStoreOrders(); }} />}>
      <View className="flex-row mb-4">
        {(['orders', 'rewards'] as const).map(value => <TouchableOpacity key={value} onPress={() => setTab(value)} className={`flex-1 p-3 rounded-lg mr-2 ${tab === value ? 'bg-red-600' : 'bg-slate-200'}`}><Text className={`text-center font-bold ${tab === value ? 'text-white' : 'text-slate-700'}`}>{value === 'orders' ? 'Cash orders' : 'Reward collection'}</Text></TouchableOpacity>)}
      </View>
      {!branchId ? <Text className="text-amber-800 mb-4">Ask an administrator to assign your branch.</Text> : null}
      {pending || pendingError ? <View className="bg-amber-50 border border-amber-300 p-4 rounded-xl mb-4">
        <Text className="font-bold">Previous staff action needs checking</Text>
        <Text>{pending ? `${pending.action.replaceAll('_', ' ')} · order ${pending.orderId}` : pendingError}</Text>
        <Text className="mt-2">The action may already have succeeded. Check it before making another change.</Text>
        <TouchableOpacity disabled={busy} onPress={() => { void checkPrevious(); }} className="p-3 bg-amber-200 rounded-lg mt-3"><Text>Check previous action</Text></TouchableOpacity>
      </View> : null}
      {message || error ? <Text accessibilityRole="alert" className="text-red-700 mb-4">{message || error}</Text> : null}
      {tab === 'orders' ? <>
      {summary ? <View className="bg-white border border-slate-200 p-4 rounded-xl mb-4">
        <Text className="font-bold">Cash movements today · Harare time</Text>
        {summary.currencies.map(row => <View key={row.currency} className="mt-3">
          <Text>Received: {formatMoney(row.received_minor, row.currency)}</Text>
          <Text>Refunded: {formatMoney(row.refunded_minor, row.currency)}</Text>
          <Text>Net: {formatMoney(row.net_minor, row.currency)} · Into till: {formatMoney(row.settled_minor, row.currency)}</Text>
          <Text className="font-bold">Outstanding cash, all dates: {formatMoney(row.held_minor, row.currency)}</Text>
        </View>)}
        {!summary.currencies.length ? <Text className="mt-2 text-slate-500">No recorded cash movements.</Text> : null}
      </View> : null}
      <View className="mb-4"><Text className="text-slate-600 mb-2">Find an older order in this branch by its full order ID</Text>
        <TextInput accessibilityLabel="Full order ID" value={lookup} onChangeText={value => setLookup({ scope, value })} autoCapitalize="none" className="border border-slate-300 bg-white rounded-xl p-3" />
        <TouchableOpacity disabled={busy || !lookup.trim()} onPress={() => { void locate(); }} className="p-3"><Text className="text-red-600 font-bold">Find order</Text></TouchableOpacity>
      </View>
      <StaffOrders orders={orders} roster={roster} actor={user.id} isAdmin={isAdmin} isLoading={isLoading}
        blocked={busy || !!pending || !!pendingError} onCommand={operate} />
      {hasMore ? <TouchableOpacity onPress={loadMore} className="p-4"><Text className="text-red-600 text-center font-bold">Load more outstanding orders</Text></TouchableOpacity> : null}
      </> : <StaffRewards key={`${user.id}:${branchId}`} branchId={branchId} enabled={isFocused} externalBlocked={busy || !!pending || !!pendingError} />}
    </ScrollView>
  </View>;
}
