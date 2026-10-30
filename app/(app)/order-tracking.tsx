import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useOrders } from '@/hooks/useOrders';
import { formatMoney } from '@/lib/cash-orders';
import { snapshotText } from '@/lib/cash-checkout';

export default function OrderTrackingScreen() {
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();
  const { activeOrders, pastOrders, isLoading, error, refetch } = useOrders();
  const recent = pastOrders.slice(0, 5);
  const requested = pastOrders.find(row => row.id === orderId);
  const history = requested && !recent.some(row => row.id === requested.id) ? [requested, ...recent] : recent;
  return <View className="flex-1 bg-slate-50">
    <View className="bg-red-600 pt-14 pb-5 px-5"><Text className="text-white text-xl font-bold">Pogo’s orders</Text></View>
    <ScrollView contentContainerStyle={{ padding: 20 }} refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => { void refetch(); }} />}>
      {isLoading && !activeOrders.length && !history.length ? <ActivityIndicator color="#dc2626" /> : null}
      {error ? <Text className="text-red-700 mb-4">{error}</Text> : null}
      <Text className="font-bold text-xl mb-4">Active orders ({activeOrders.length})</Text>
      {!activeOrders.length && !isLoading ? <Text className="text-slate-500 mb-5">No active orders.</Text> : null}
      {activeOrders.map(order => {
        const steps = order.fulfilment_mode === 'delivery'
          ? ['pending', 'accepted', 'preparing', 'ready', 'out_for_delivery', 'completed']
          : ['pending', 'accepted', 'preparing', 'ready', 'completed'];
        const index = steps.indexOf(order.status);
        return <View key={order.id} className="bg-white rounded-xl p-5 border border-slate-200 mb-4">
          <Text className="font-bold text-lg">Order #{order.id.slice(0, 8).toUpperCase()}</Text>
          <Text className="text-slate-600 my-2">{snapshotText(order.branch_snapshot, 'name')} · {order.fulfilment_mode}</Text>
          {steps.map((status, step) => <Text key={status} className={`my-1 ${step === index ? 'font-bold text-red-600' : 'text-slate-500'}`}>
            {step < index ? '✓' : step === index ? '●' : '○'} {status === 'pending' ? 'Awaiting branch confirmation' : status.replaceAll('_', ' ')}
          </Text>)}
          {order.status === 'pending' && order.acceptance_deadline ? <Text className="text-slate-500 mt-2">Confirmation due by {new Date(order.acceptance_deadline).toLocaleTimeString()}. Contact the branch if it is delayed.</Text> : null}
          <View className="my-3">{order.order_items?.map(item => <View key={item.id} className="mb-2">
            <Text>{item.quantity} × {item.item_name ?? item.menu_item?.name ?? 'Meal'}</Text>
            <Text className="text-slate-500">{Array.isArray(item.modifiers_snapshot) ? item.modifiers_snapshot.map(choice => snapshotText(choice, 'name')).join(', ') : ''}</Text>
          </View>)}</View>
          <Text className="font-bold">Cash due: {formatMoney(order.total_minor ?? Math.round(order.total_amount * 100), order.currency ?? 'Currency unconfirmed')}</Text>
          <Text className="text-slate-500 mt-2">Payment: {order.payment_status ?? 'Unconfirmed'}</Text>
        </View>;
      })}
      {history.length ? <Text className="font-bold text-xl my-4">Recent completed or cancelled orders</Text> : null}
      {history.map(order => <TouchableOpacity key={order.id}
        onPress={() => router.push({ pathname: '/(app)/order-success', params: { orderId: order.id } })} className="bg-white rounded-xl border border-slate-200 p-4 mb-3">
        <Text className="font-bold">#{order.id.slice(0, 8).toUpperCase()} · {order.status}</Text>
        <Text>{order.payment_status} · {new Date(order.created_at).toLocaleString()}</Text>
        <Text className="text-red-600 mt-2">View receipt and points →</Text>
      </TouchableOpacity>)}
      <TouchableOpacity onPress={() => router.push('/store-picker')} className="p-4 bg-red-600 rounded-xl mt-5"><Text className="text-center text-white font-bold">Order from a branch</Text></TouchableOpacity>
    </ScrollView>
  </View>;
}
