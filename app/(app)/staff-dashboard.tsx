import { Screen, PageHeading, EmptyState } from '@/components/ui/screen';
import { ShieldCheck } from 'lucide-react-native';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { Input as TextInput } from '@/components/ui/input';
import { TouchTarget as TouchableOpacity } from '@/components/ui/touch-target';
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
import { BranchOperations } from '@/components/staff/BranchOperations';
import { QueueAttention } from '@/components/staff/QueueAttention';

export default function StaffDashboard() {
  const isFocused = useIsFocused();
  const { user, userRole, staffStoreIds } = useAuth();
  const { stores } = useStores();
  const { storeId } = useLocalSearchParams<{ storeId?: string }>();
  const [tab, setTab] = useState<'orders' | 'rewards' | 'availability'>('orders');
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
    pending, pendingError, pendingReady, busy, findOrder, operations, fresh, foreground, lastSuccess } = useStaff(branchId, isFocused);
  const permitted = isAdmin || userRole === 'staff' || userRole === 'manager';
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
  if (!permitted || !user) return <Screen title="Branch workspace" centered><EmptyState icon={ShieldCheck} title="A workspace for your branch" description="Sign in with assigned staff access and complete account verification to continue." /></Screen>;
  return <Screen title="Branch workspace" wide refreshControl={<RefreshControl refreshing={isLoading && orders.length > 0} onRefresh={() => { void fetchStoreOrders(); }} />}>
    <PageHeading eyebrow="POGO’S OPERATIONS" title={stores.find(store => store.id === branchId)?.name ?? 'Select a branch'} subtitle="A clear view of orders, rewards and cash handover." />
    {branches.length > 1 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-5" contentContainerStyle={{ gap: 8 }}>{branches.map(store => <TouchableOpacity key={store.id} accessibilityState={{ selected: branchId === store.id }} onPress={() => setSelectedBranch(store.id)} className={`px-4 py-3 rounded-2xl border ${branchId === store.id ? 'bg-brand-800 border-brand-800' : 'bg-white border-line'}`}><Text className={branchId === store.id ? 'text-white font-semibold' : 'text-ink font-semibold'}>{store.name}</Text></TouchableOpacity>)}</ScrollView> : null}
      <View testID="staff-sections" className="flex-row mb-4">
        {(['orders', 'rewards', 'availability'] as const).map(value => <TouchableOpacity key={value} accessibilityRole="button" onPress={() => setTab(value)} className={`flex-1 p-3 rounded-lg mr-2 ${tab === value ? 'bg-brand-800' : 'bg-slate-200'}`}><Text className={`text-center font-bold ${tab === value ? 'text-white' : 'text-slate-700'}`}>{value === 'orders' ? 'Cash orders' : value === 'rewards' ? 'Rewards' : 'Availability'}</Text></TouchableOpacity>)}
      </View>
      {!branchId ? <Text className="text-amber-800 mb-4">Ask an administrator to assign your branch.</Text> : null}
      {branchId ? <>
        <View className={`p-4 mb-4 rounded-xl ${fresh ? 'bg-green-50' : 'bg-amber-100'}`}>
          <Text accessibilityRole="alert" className="font-bold">{fresh ? 'Branch queue current · refreshes every 15 seconds' : 'Branch queue needs verification'}</Text>
          <Text>{lastSuccess ? `Last confirmed ${new Date(lastSuccess).toLocaleTimeString()}` : 'Waiting for a successful branch refresh.'}</Text>
          {!fresh ? <Text>Cached details may be out of date. New changes are blocked until refresh succeeds. Saved actions can still be checked.</Text> : null}
          <TouchableOpacity accessibilityRole="button" onPress={() => { void fetchStoreOrders(); }} className="py-3"><Text>Refresh branch now</Text></TouchableOpacity>
        </View>
        <QueueAttention key={`attention:${scope}`} snapshot={operations} fresh={fresh} active={isFocused && foreground} />
        <BranchOperations key={`operations:${scope}`} owner={user.id} branchId={branchId} snapshot={operations} fresh={fresh}
          blocked={busy || !pendingReady || !!pending || !!pendingError} showMenu={tab === 'availability'} active={isFocused && foreground} onRefresh={fetchStoreOrders} />
      </> : null}
      {pending || pendingError ? <View className="bg-amber-50 border border-amber-300 p-4 rounded-xl mb-4">
        <Text className="font-bold">Previous staff action needs checking</Text>
        <Text>{pending ? `${pending.action.replaceAll('_', ' ')} · order ${pending.orderId}` : pendingError}</Text>
        <Text className="mt-2">The action may already have succeeded. Check it before making another change.</Text>
        <TouchableOpacity disabled={busy} onPress={() => { void checkPrevious(); }} className="p-3 bg-amber-200 rounded-lg mt-3"><Text>Check previous action</Text></TouchableOpacity>
      </View> : null}
      {message || error ? <Text accessibilityRole="alert" className="text-red-700 mb-4">{message || error}</Text> : null}
      {tab === 'orders' ? <>
      {summary ? <View className="bg-white border border-line p-4 rounded-xl mb-4">
        <Text className="font-bold">Cash movements today · Harare time</Text>
        {summary.currencies.map(row => <View key={row.currency} className="mt-3">
          <Text>Received: {formatMoney(row.received_minor, row.currency)}</Text>
          <Text>Refunded: {formatMoney(row.refunded_minor, row.currency)}</Text>
          <Text>Net: {formatMoney(row.net_minor, row.currency)} · Into till: {formatMoney(row.settled_minor, row.currency)}</Text>
          <Text className="font-bold">Outstanding cash, all dates: {formatMoney(row.held_minor, row.currency)}</Text>
        </View>)}
        {!summary.currencies.length ? <Text className="mt-2 text-subtle">No recorded cash movements.</Text> : null}
      </View> : null}
      <View className="mb-4"><Text className="text-subtle mb-2">Find an older order in this branch by its full order ID</Text>
        <TextInput accessibilityLabel="Full order ID" value={lookup} onChangeText={value => setLookup({ scope, value })} autoCapitalize="none" className="border border-slate-300 bg-white rounded-xl p-3" />
        <TouchableOpacity disabled={busy || !lookup.trim()} onPress={() => { void locate(); }} className="p-3"><Text className="text-brand-800 font-bold">Find order</Text></TouchableOpacity>
      </View>
      <StaffOrders orders={orders} roster={roster} actor={user.id} isAdmin={isAdmin} isLoading={isLoading}
        blocked={!fresh || !pendingReady || busy || !!pending || !!pendingError} onCommand={operate} />
      {hasMore ? <TouchableOpacity onPress={loadMore} className="p-4"><Text className="text-brand-800 text-center font-bold">Load more outstanding orders</Text></TouchableOpacity> : null}
      </> : tab === 'rewards' ? <StaffRewards key={`${user.id}:${branchId}`} branchId={branchId} enabled={isFocused && foreground} externalBlocked={!fresh || !pendingReady || busy || !!pending || !!pendingError} /> : null}
  </Screen>;
}
