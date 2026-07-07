import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useOrders, Order } from '@/hooks/useOrders';
import { Clock, CheckCircle2, ChevronRight, Package, AlertCircle } from 'lucide-react-native';

export function AdminOrders() {
  const { orders, activeOrders, isLoading, updateOrderStatus } = useOrders(true);

  if (isLoading) {
    return (
      <View className="py-8 items-center">
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  if (activeOrders.length === 0) {
    return (
      <View className="py-12 items-center">
        <View className="w-16 h-16 bg-gray-100 rounded-full items-center justify-center mb-4">
          <Package size={32} color="#9ca3af" />
        </View>
        <Text className="text-xl font-bold text-gray-900 mb-2">No active orders</Text>
        <Text className="text-gray-500 text-center">New orders will appear here automatically.</Text>
      </View>
    );
  }

  const handleNextStatus = async (order: Order) => {
    let nextStatus: Order['status'] = 'pending';
    if (order.status === 'pending') nextStatus = 'preparing';
    else if (order.status === 'preparing') nextStatus = 'ready';
    else if (order.status === 'ready') nextStatus = 'completed';
    
    if (nextStatus !== order.status) {
      await updateOrderStatus(order.id, nextStatus);
    }
  };

  const handleCancel = async (order: Order) => {
    await updateOrderStatus(order.id, 'cancelled');
  };

  return (
    <View className="gap-3">
      {activeOrders.map(order => (
        <View key={order.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <View className={`px-4 py-3 border-b border-gray-100 flex-row justify-between items-center ${
            order.status === 'pending' ? 'bg-indigo-50' :
            order.status === 'preparing' ? 'bg-amber-50' : 'bg-green-50'
          }`}>
            <View className="flex-row items-center">
              <Text className="font-bold text-gray-900 mr-2">#{order.id.slice(0, 6)}</Text>
              <View className={`px-2 py-1 rounded text-xs font-bold ${
                order.status === 'pending' ? 'bg-indigo-100 text-indigo-700' :
                order.status === 'preparing' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
              }`}>
                <Text className="uppercase text-[10px] font-bold">{order.status}</Text>
              </View>
            </View>
            <Text className="font-bold text-gray-900">${order.total_amount.toFixed(2)}</Text>
          </View>

          <View className="p-4">
            <View className="flex-row items-center mb-3">
              <Text className="text-sm font-semibold text-gray-700 w-16">Customer:</Text>
              <Text className="text-sm text-gray-900 flex-1">{order.user?.full_name || order.user?.email}</Text>
            </View>

            <View className="bg-gray-50 rounded-xl p-3 mb-4">
              <Text className="text-xs font-bold text-gray-500 mb-2 uppercase">Order Items</Text>
              {order.order_items?.map(item => (
                <View key={item.id} className="flex-row justify-between mb-1">
                  <Text className="text-sm text-gray-900 flex-1">
                    <Text className="font-bold">{item.quantity}x</Text> {item.menu_item?.name}
                  </Text>
                  <Text className="text-sm text-gray-500">${(item.unit_price * item.quantity).toFixed(2)}</Text>
                </View>
              ))}
            </View>

            <View className="flex-row gap-2">
              <TouchableOpacity 
                onPress={() => handleCancel(order)}
                className="flex-1 py-3 rounded-xl border border-red-200 items-center justify-center bg-red-50"
              >
                <Text className="text-red-600 font-bold text-sm">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => handleNextStatus(order)}
                className={`flex-[2] py-3 rounded-xl items-center justify-center flex-row ${
                  order.status === 'pending' ? 'bg-indigo-600' :
                  order.status === 'preparing' ? 'bg-amber-500' : 'bg-green-600'
                }`}
              >
                <Text className="text-white font-bold text-sm mr-2">
                  {order.status === 'pending' ? 'Start Preparing' :
                   order.status === 'preparing' ? 'Mark as Ready' : 'Complete Order'}
                </Text>
                <ChevronRight size={16} color="white" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}
