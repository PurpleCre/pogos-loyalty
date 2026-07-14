import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { StaffOrder } from '@/hooks/useStaff';
import { Clock, ChefHat, CheckCircle2, ChevronRight, Package, AlertCircle } from 'lucide-react-native';

interface StaffOrdersProps {
  orders: StaffOrder[];
  isLoading: boolean;
  onUpdateStatus: (orderId: string, status: StaffOrder['status']) => Promise<void>;
}

export function StaffOrders({ orders, isLoading, onUpdateStatus }: StaffOrdersProps) {
  if (isLoading) {
    return (
      <View className="py-8 items-center">
        <ActivityIndicator size="large" color="#dc2626" />
      </View>
    );
  }

  if (orders.length === 0) {
    return (
      <View className="py-12 items-center">
        <View className="w-16 h-16 bg-gray-100 rounded-full items-center justify-center mb-4">
          <Package size={32} color="#9ca3af" />
        </View>
        <Text className="text-xl font-bold text-gray-900 mb-2">No active orders</Text>
        <Text className="text-gray-500 text-center">New orders will appear here in real-time.</Text>
      </View>
    );
  }

  const handleNextStatus = async (order: StaffOrder) => {
    let nextStatus: StaffOrder['status'] = 'pending';
    if (order.status === 'pending') nextStatus = 'preparing';
    else if (order.status === 'preparing') nextStatus = 'ready';
    else if (order.status === 'ready') nextStatus = 'completed';

    if (nextStatus !== order.status) {
      await onUpdateStatus(order.id, nextStatus);
    }
  };

  const handleCancel = async (order: StaffOrder) => {
    await onUpdateStatus(order.id, 'cancelled');
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'pending':
        return { bg: 'bg-amber-50', badge: 'bg-amber-100', text: 'text-amber-700', icon: Clock, btnBg: 'bg-amber-500', btnText: 'Start Preparing' };
      case 'preparing':
        return { bg: 'bg-blue-50', badge: 'bg-blue-100', text: 'text-blue-700', icon: ChefHat, btnBg: 'bg-blue-600', btnText: 'Mark as Ready' };
      case 'ready':
        return { bg: 'bg-green-50', badge: 'bg-green-100', text: 'text-green-700', icon: CheckCircle2, btnBg: 'bg-green-600', btnText: 'Complete Order' };
      default:
        return { bg: 'bg-gray-50', badge: 'bg-gray-100', text: 'text-gray-700', icon: AlertCircle, btnBg: 'bg-gray-500', btnText: 'Update' };
    }
  };

  const getTimeSince = (dateString: string) => {
    const diff = Date.now() - new Date(dateString).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
  };

  return (
    <View className="gap-3">
      {orders.map(order => {
        const config = getStatusConfig(order.status);
        const StatusIcon = config.icon;
        
        return (
          <View key={order.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            {/* Header */}
            <View className={`px-4 py-3 border-b border-gray-100 flex-row justify-between items-center ${config.bg}`}>
              <View className="flex-row items-center gap-2">
                <StatusIcon size={16} color="#374151" />
                <Text className="font-bold text-gray-900">#{order.id.slice(0, 6)}</Text>
                <View className={`px-2 py-0.5 rounded-full ${config.badge}`}>
                  <Text className={`uppercase text-[10px] font-bold ${config.text}`}>{order.status}</Text>
                </View>
              </View>
              <View className="flex-row items-center gap-2">
                <Text className="text-xs text-gray-500">{getTimeSince(order.created_at)}</Text>
                <Text className="font-bold text-gray-900">${order.total_amount.toFixed(2)}</Text>
              </View>
            </View>

            {/* Body */}
            <View className="p-4">
              <View className="flex-row items-center mb-3">
                <Text className="text-sm font-semibold text-gray-500 w-20">Customer:</Text>
                <Text className="text-sm font-medium text-gray-900 flex-1">{order.user?.full_name || order.user?.email || 'Guest'}</Text>
              </View>

              <View className="bg-gray-50 rounded-xl p-3 mb-4">
                <Text className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Order Items</Text>
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
                  className={`flex-[2] py-3 rounded-xl items-center justify-center flex-row ${config.btnBg}`}
                >
                  <Text className="text-white font-bold text-sm mr-2">{config.btnText}</Text>
                  <ChevronRight size={16} color="white" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}
