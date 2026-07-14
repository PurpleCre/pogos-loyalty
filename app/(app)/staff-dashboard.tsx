import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native';
import { useStaff } from '@/hooks/useStaff';
import { useAuth } from '@/hooks/useAuth';
import { StaffOrders } from '@/components/staff/StaffOrders';
import { StaffMenuAvailability } from '@/components/staff/StaffMenuAvailability';
import { useState, useEffect } from 'react';
import { ClipboardList, UtensilsCrossed, Clock, CheckCircle2, AlertCircle, Store } from 'lucide-react-native';
import { useIsFocused } from '@react-navigation/native';
import { useStores } from '@/hooks/useStores';

export default function StaffDashboard() {
  const isFocused = useIsFocused();
  const { userRole, staffStoreId } = useAuth();
  const { 
    activeOrders, menuItems, stats, isLoading, menuLoading, 
    fetchStoreOrders, fetchStoreMenuItems, updateOrderStatus, toggleMenuItemAvailability 
  } = useStaff();
  const { stores } = useStores();
  const [activeTab, setActiveTab] = useState<'orders' | 'menu'>('orders');
  const [refreshing, setRefreshing] = useState(false);

  const storeName = stores.find(s => s.id === staffStoreId)?.name || 'Your Store';

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchStoreOrders(), fetchStoreMenuItems()]);
    setRefreshing(false);
  };

  if (!isFocused) return <View />;

  if (userRole !== 'staff' && userRole !== 'admin') {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 px-6">
        <Store size={48} color="#d1d5db" />
        <Text className="text-xl font-bold text-gray-900 mt-4 mb-2">Staff Access Required</Text>
        <Text className="text-gray-500 text-center">You need staff permissions to access this dashboard.</Text>
      </View>
    );
  }

  if (isLoading && activeOrders.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#dc2626" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-[#18181b] pt-14 pb-4 px-5">
        <View className="flex-row items-center gap-3 mb-3">
          <View className="w-10 h-10 bg-red-600 rounded-xl items-center justify-center">
            <Store size={20} color="white" />
          </View>
          <View className="flex-1">
            <Text className="text-white text-lg font-bold">{storeName}</Text>
            <Text className="text-gray-400 text-sm">Staff Dashboard</Text>
          </View>
        </View>

        {/* Stats Bar */}
        <View className="flex-row gap-2 mt-1">
          <View className="flex-1 bg-[#27272a] rounded-xl p-3 items-center border border-[#3f3f46]">
            <View className="flex-row items-center gap-1 mb-1">
              <ClipboardList size={12} color="#a1a1aa" />
              <Text className="text-gray-400 text-[10px] uppercase font-semibold">Today</Text>
            </View>
            <Text className="text-white text-xl font-bold">{stats.todayTotal}</Text>
          </View>
          <View className="flex-1 bg-[#27272a] rounded-xl p-3 items-center border border-[#3f3f46]">
            <View className="flex-row items-center gap-1 mb-1">
              <Clock size={12} color="#f59e0b" />
              <Text className="text-gray-400 text-[10px] uppercase font-semibold">Pending</Text>
            </View>
            <Text className="text-amber-400 text-xl font-bold">{stats.pendingCount}</Text>
          </View>
          <View className="flex-1 bg-[#27272a] rounded-xl p-3 items-center border border-[#3f3f46]">
            <View className="flex-row items-center gap-1 mb-1">
              <AlertCircle size={12} color="#3b82f6" />
              <Text className="text-gray-400 text-[10px] uppercase font-semibold">Active</Text>
            </View>
            <Text className="text-blue-400 text-xl font-bold">{stats.preparingCount}</Text>
          </View>
          <View className="flex-1 bg-[#27272a] rounded-xl p-3 items-center border border-[#3f3f46]">
            <View className="flex-row items-center gap-1 mb-1">
              <CheckCircle2 size={12} color="#22c55e" />
              <Text className="text-gray-400 text-[10px] uppercase font-semibold">Done</Text>
            </View>
            <Text className="text-green-400 text-xl font-bold">{stats.completedToday}</Text>
          </View>
        </View>
      </View>

      {/* Tab Bar */}
      <View className="px-4 pt-4 pb-2">
        <View className="flex-row bg-gray-200 p-1 rounded-xl">
          <TouchableOpacity
            onPress={() => setActiveTab('orders')}
            className={`flex-1 py-2.5 rounded-lg items-center flex-row justify-center gap-2 ${activeTab === 'orders' ? 'bg-white shadow-sm' : ''}`}
          >
            <ClipboardList size={16} color={activeTab === 'orders' ? '#dc2626' : '#6b7280'} />
            <Text className={`font-semibold ${activeTab === 'orders' ? 'text-gray-900' : 'text-gray-500'}`}>
              Live Orders {activeOrders.length > 0 ? `(${activeOrders.length})` : ''}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab('menu')}
            className={`flex-1 py-2.5 rounded-lg items-center flex-row justify-center gap-2 ${activeTab === 'menu' ? 'bg-white shadow-sm' : ''}`}
          >
            <UtensilsCrossed size={16} color={activeTab === 'menu' ? '#dc2626' : '#6b7280'} />
            <Text className={`font-semibold ${activeTab === 'menu' ? 'text-gray-900' : 'text-gray-500'}`}>
              Menu
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      <ScrollView 
        className="flex-1" 
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#dc2626" />
        }
      >
        {activeTab === 'orders' && (
          <StaffOrders 
            orders={activeOrders} 
            isLoading={isLoading} 
            onUpdateStatus={updateOrderStatus} 
          />
        )}
        {activeTab === 'menu' && (
          <StaffMenuAvailability 
            items={menuItems} 
            isLoading={menuLoading} 
            onToggleAvailability={toggleMenuItemAvailability} 
          />
        )}
      </ScrollView>
    </View>
  );
}
