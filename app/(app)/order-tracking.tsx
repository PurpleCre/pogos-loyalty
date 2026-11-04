import { Screen, PageHeading, EmptyState } from '@/components/ui/screen';
import { ShoppingBag } from 'lucide-react-native';
import { View, Text, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { TouchTarget as TouchableOpacity } from '@/components/ui/touch-target';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useOrders } from '@/hooks/useOrders';
import { ReadStatus } from '@/components/ReadStatus';
import { formatMoney } from '@/lib/cash-orders';
import { snapshotText } from '@/lib/cash-checkout';

export default function OrderTrackingScreen() {
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();
  const { activeOrders, pastOrders, isLoading, error, fresh, refreshedAt, refetch } = useOrders();
  const { user, loading: authLoading } = useAuth();
  if (!user && !authLoading) return <Redirect href="/(auth)/login?redirect=/(app)/order-tracking" />;
  const recent = pastOrders.slice(0, 5);
  const requested = pastOrders.find(row => row.id === orderId);
  const history = requested && !recent.some(row => row.id === requested.id) ? [requested, ...recent] : recent;
  return <Screen title="Your orders" refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => { void refetch(); }} />}><PageHeading eyebrow="FROM YOUR BRANCH" title="From kitchen to your hands." subtitle="Track your active orders and revisit recent order details." />
      {isLoading && !activeOrders.length && !history.length ? <ActivityIndicator color="#dc2626" /> : null}
      <ReadStatus label="Orders" fresh={fresh} at={refreshedAt} error={error} loading={isLoading} onRefresh={() => { void refetch(); }} />
      {error ? <Text className="text-red-700 mb-4">{error}</Text> : null}
      <Text className="font-bold text-xl mb-4">Active orders ({activeOrders.length})</Text>
      {!activeOrders.length && fresh ? <EmptyState icon={ShoppingBag} title="No orders on the go" description="Your next Pogo’s order will appear here once submitted. Browse a branch menu when you’re ready." /> : null}
      {activeOrders.map(order => {
        const steps = order.fulfilment_mode === 'delivery'
          ? ['pending', 'accepted', 'preparing', 'ready', 'out_for_delivery', 'completed']
          : ['pending', 'accepted', 'preparing', 'ready', 'completed'];
        const index = steps.indexOf(order.status);
        return <View key={order.id} className="bg-white rounded-xl p-5 border border-line mb-4">
          <Text className="font-bold text-lg">Order #{order.id.slice(0, 8).toUpperCase()}</Text>
          <Text className="text-subtle my-2">{snapshotText(order.branch_snapshot, 'name')} · {order.fulfilment_mode}</Text>
          {steps.map((status, step) => <View key={status} className="flex-row gap-3 min-h-[44px] items-center">
            <View className={`w-7 h-7 rounded-full border items-center justify-center ${step <= index ? 'bg-brand-800 border-brand-800' : 'bg-white border-line'}`}><Text className={`text-xs font-bold ${step <= index ? 'text-white' : 'text-subtle'}`}>{step < index ? '✓' : step + 1}</Text></View>
            <Text className={`flex-1 capitalize ${step === index ? 'font-bold text-brand-800' : 'text-subtle'}`}>{status === 'pending' ? 'Awaiting branch confirmation' : status.replaceAll('_', ' ')}</Text>
            {step === index ? <Text className="text-brand-800 text-xs font-semibold">Current</Text> : null}
          </View>)}
          {order.status === 'pending' && order.acceptance_deadline ? <Text className="text-subtle mt-2">Confirmation due by {new Date(order.acceptance_deadline).toLocaleTimeString()}. Contact the branch if it is delayed.</Text> : null}
          <View className="my-3">{order.order_items?.map(item => <View key={item.id} className="mb-2">
            <Text>{item.quantity} × {item.item_name ?? item.menu_item?.name ?? 'Meal'}</Text>
            <Text className="text-subtle">{Array.isArray(item.modifiers_snapshot) ? item.modifiers_snapshot.map(choice => snapshotText(choice, 'name')).join(', ') : ''}</Text>
          </View>)}</View>
          <Text className="font-bold">Cash due: {formatMoney(order.total_minor ?? Math.round(order.total_amount * 100), order.currency ?? 'Currency unconfirmed')}</Text>
          <Text className="text-subtle mt-2">Payment: {order.payment_status ?? 'Unconfirmed'}</Text>
        </View>;
      })}
      {history.length ? <Text className="font-bold text-xl my-4">Recent completed or cancelled orders</Text> : null}
      {history.map(order => <TouchableOpacity key={order.id}
        onPress={() => router.push({ pathname: '/(app)/order-success', params: { orderId: order.id } })} className="bg-white rounded-xl border border-line p-4 mb-3">
        <Text className="font-bold">#{order.id.slice(0, 8).toUpperCase()} · {order.status}</Text>
        <Text>{order.payment_status} · {new Date(order.created_at).toLocaleString()}</Text>
        <Text className="text-brand-800 mt-2">View receipt and points →</Text>
      </TouchableOpacity>)}
      <TouchableOpacity onPress={() => router.push('/store-picker')} className="p-4 bg-brand-800 rounded-xl mt-5"><Text className="text-center text-white font-bold">Order from a branch</Text></TouchableOpacity>
  </Screen>;
}
