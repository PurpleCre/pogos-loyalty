import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { useLocalSearchParams, router, useNavigation } from 'expo-router';
import { DrawerActions } from '@react-navigation/native';
import { Menu, ClipboardList, Timer, Truck, Package, MessageSquare, HelpCircle, User, Star, ShoppingCart, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { useMenu } from '@/hooks/useMenu';
import { useCart } from '@/contexts/CartContext';

type OrderStatus = 'pending' | 'preparing' | 'on_the_way' | 'delivered' | 'cancelled';

export default function OrderTrackingScreen() {
  const { orderId: paramOrderId } = useLocalSearchParams();
  const { session } = useAuth();
  const navigation = useNavigation();
  const { items: allMenu } = useMenu();
  const { itemCount } = useCart();

  const [orders, setOrders] = useState<any[]>([]);
  const [orderItemsMap, setOrderItemsMap] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  
  // Track which order is currently expanded in the accordion
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  // Fetch the active orders
  useEffect(() => {
    async function fetchOrders() {
      if (!session?.user) return;
      
      try {
        setLoading(true);
        let currentOrders = [];

        // Fetch all active orders
        const { data } = await supabase
          .from('orders')
          .select('*')
          .eq('user_id', session.user.id)
          .neq('status', 'cancelled')
          .neq('status', 'delivered')
          .order('created_at', { ascending: false });
        if (data) currentOrders = data;

        if (currentOrders.length > 0) {
          setOrders(currentOrders);
          
          // Set the initially expanded order
          if (paramOrderId) {
            setExpandedOrderId(paramOrderId as string);
          } else {
            setExpandedOrderId(currentOrders[0].id);
          }
          
          // Fetch items for all these orders
          const orderIds = currentOrders.map(o => o.id);
          const { data: itemsData } = await supabase
            .from('order_items')
            .select('*')
            .in('order_id', orderIds);
            
          if (itemsData) {
            const itemsMap: Record<string, any[]> = {};
            itemsData.forEach(item => {
              if (!itemsMap[item.order_id]) itemsMap[item.order_id] = [];
              itemsMap[item.order_id].push(item);
            });
            setOrderItemsMap(itemsMap);
          }
        }
      } catch (error) {
        console.log('Error fetching orders for tracking', error);
      } finally {
        setLoading(false);
      }
    }

    fetchOrders();
    
    // Set up realtime subscription to listen to status changes
    let subscription: any;
    if (session?.user) {
      subscription = supabase
        .channel('public:orders')
        .on('postgres_changes', { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'orders',
          filter: `user_id=eq.${session.user.id}`
        }, (payload) => {
          setOrders((prevOrders) => {
            const exists = prevOrders.find(o => o.id === payload.new.id);
            if (exists) {
              return prevOrders.map(o => o.id === payload.new.id ? payload.new : o);
            }
            return prevOrders;
          });
        })
        .subscribe();
    }

    return () => {
      if (subscription) {
        supabase.removeChannel(subscription);
      }
    };
  }, [paramOrderId, session]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#e11d48" />
      </View>
    );
  }

  if (orders.length === 0) {
    return (
      <View className="flex-1 bg-gray-50">
        <View className="bg-red-600 pt-14 pb-4 px-4 rounded-b-3xl">
          <View className="flex-row items-center justify-between mb-2">
            <TouchableOpacity onPress={() => navigation.dispatch(DrawerActions.toggleDrawer())} className="p-2 -ml-2">
              <Menu size={24} color="#fff" />
            </TouchableOpacity>
            <Text className="text-white text-xl font-bold">QuickBite</Text>
            <View className="w-10" />
          </View>
        </View>
        <View className="flex-1 items-center justify-center px-6">
          <Truck size={48} color="#9ca3af" className="mb-4" />
          <Text className="text-xl font-bold text-gray-900 mb-2">No Active Orders</Text>
          <Text className="text-gray-500 text-center mb-8">You don't have any orders currently being tracked.</Text>
          <TouchableOpacity 
            onPress={() => router.push('/(app)/menu')}
            className="bg-red-600 px-6 py-3 rounded-xl w-full items-center"
          >
            <Text className="text-white font-bold">Order Now</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-red-600 pt-14 pb-4 px-4">
        <View className="flex-row items-center justify-between mb-2">
          <TouchableOpacity onPress={() => navigation.dispatch(DrawerActions.toggleDrawer())} className="p-2 -ml-2">
            <Menu size={24} color="#fff" />
          </TouchableOpacity>
          <Text className="text-white text-xl font-bold">QuickBite</Text>
          <TouchableOpacity onPress={() => router.push('/(app)/cart')} className="p-2 -mr-2 relative">
            <ShoppingCart size={24} color="#fff" />
            {itemCount > 0 && (
              <View className="absolute top-1 right-1 bg-yellow-400 w-4 h-4 rounded-full items-center justify-center">
                <Text className="text-[10px] font-bold text-gray-900">{itemCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View className="bg-white px-4 py-3 border-b border-gray-100 flex-row items-center">
        <Menu size={16} color="#9ca3af" className="mr-2" />
        <Text className="text-gray-500 font-medium text-base">Active Orders ({orders.length})</Text>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
        {orders.map((order, orderIndex) => {
          const isExpanded = expandedOrderId === order.id;
          
          const status: OrderStatus = order.status || 'pending';
          let currentStep = 0;
          if (status === 'preparing') currentStep = 1;
          else if (status === 'on_the_way') currentStep = 2;
          else if (status === 'delivered') currentStep = 3;

          const steps = [
            { title: 'Order\nPlaced', icon: ClipboardList },
            { title: 'Preparing', icon: Timer },
            { title: 'On the\nWay', icon: Truck },
            { title: 'Delivered', icon: Package }
          ];

          let statusText = "Order received and confirmed.";
          if (currentStep === 1) statusText = "Preparing your food...";
          if (currentStep === 2) statusText = "Driver picked up your order.";
          if (currentStep === 3) statusText = "Order has been delivered!";

          const orderItems = orderItemsMap[order.id] || [];
          const summaryText = orderItems.map(item => {
            const menuItem = allMenu.find(m => m.id === item.menu_item_id);
            return `${item.quantity}x ${menuItem?.name || 'Item'}`;
          }).join(', ');
          
          const orderDate = order.created_at ? new Date(order.created_at) : new Date();
          const etaStart = new Date(orderDate.getTime() + 20 * 60000);
          const etaEnd = new Date(orderDate.getTime() + 30 * 60000);
          const formatTime = (date: Date) => date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
          const etaString = `${formatTime(etaStart)} - ${formatTime(etaEnd)}`;

          return (
            <View key={order.id} className="mb-4 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <TouchableOpacity 
                activeOpacity={0.7}
                onPress={() => setExpandedOrderId(isExpanded ? null : order.id)}
                className="flex-row justify-between items-center p-5 bg-white"
              >
                <View>
                  <Text className="font-black text-lg text-gray-900">Order #{order.id.slice(0, 8).toUpperCase()}</Text>
                  {!isExpanded && <Text className="text-gray-500 text-sm mt-1">{statusText}</Text>}
                </View>
                <View className="flex-row items-center">
                  <Text className="text-red-600 font-bold mr-3">${order.total_amount?.toFixed(2)}</Text>
                  {isExpanded ? <ChevronUp size={20} color="#6b7280" /> : <ChevronDown size={20} color="#6b7280" />}
                </View>
              </TouchableOpacity>

              {isExpanded && (
                <View className="px-5 pb-5 bg-gray-50 border-t border-gray-100 pt-5">
                  {/* 4-Step Progress Timeline */}
                  <View className="flex-row items-start justify-between mb-8 mt-2 px-2">
                    {steps.map((step, index) => {
                      const Icon = step.icon;
                      const isCompleted = index < currentStep;
                      const isActive = index === currentStep;
                      
                      return (
                        <View key={index} className="items-center flex-1 z-10 relative">
                          {index < steps.length - 1 && (
                            <View 
                              className="absolute top-6 left-[50%] right-[-50%] h-1 z-[-1]"
                              style={{ backgroundColor: index < currentStep ? '#ea580c' : '#e5e7eb' }}
                            />
                          )}
                          <View 
                            className={`w-12 h-12 rounded-full items-center justify-center mb-2 
                              ${isActive ? 'bg-orange-600 shadow-md ring-4 ring-orange-100' : isCompleted ? 'bg-orange-600' : 'bg-slate-500'}`}
                          >
                            <Icon size={20} color="#fff" />
                          </View>
                          <Text 
                            className={`text-xs text-center font-bold ${isActive ? 'text-gray-900' : isCompleted ? 'text-gray-700' : 'text-gray-400'}`}
                          >
                            {step.title}
                          </Text>
                        </View>
                      );
                    })}
                  </View>

                  {/* Status Module */}
                  <View className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
                    <Text className="text-base text-gray-900 font-bold mb-1">Status</Text>
                    <Text className="text-gray-600 text-sm mb-1">{statusText}</Text>
                    <Text className="text-gray-600 text-sm">ETA: {etaString}</Text>
                  </View>

                  {/* Meet Your Driver Module */}
                  <View className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
                    <Text className="text-base text-gray-900 font-bold mb-4">Meet Your Driver</Text>
                    
                    <View className="flex-row items-center">
                      <View className="w-12 h-12 bg-gray-200 rounded-full items-center justify-center mr-4 overflow-hidden">
                        <User size={24} color="#6b7280" />
                      </View>
                      <View>
                        <View className="flex-row items-center mb-1">
                          <Text className="font-bold text-gray-900 mr-2">David L.</Text>
                          <Star size={12} color="#f59e0b" fill="#f59e0b" />
                          <Text className="text-sm font-medium text-gray-600 ml-1">4.9</Text>
                        </View>
                        <Text className="text-gray-500 text-sm">White Scooter</Text>
                      </View>
                    </View>
                  </View>

                  {/* Order Summary Module */}
                  <View className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
                    <Text className="text-base text-gray-900 font-bold mb-2">Order Summary</Text>
                    <Text className="text-gray-600 text-sm leading-relaxed">{summaryText || "Fetching items..."}</Text>
                  </View>

                  {/* Action Buttons */}
                  <View className="flex-row justify-between">
                    <TouchableOpacity className="bg-red-600 py-4 rounded-xl items-center shadow-sm flex-row justify-center flex-1 mr-2">
                      <MessageSquare size={18} color="#fff" className="mr-2" />
                      <Text className="text-white font-bold text-base">Contact Driver</Text>
                    </TouchableOpacity>

                    <TouchableOpacity className="bg-gray-800 py-4 rounded-xl items-center shadow-sm flex-row justify-center flex-1 ml-2">
                      <HelpCircle size={18} color="#fff" className="mr-2" />
                      <Text className="text-white font-bold text-base">Need Help?</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          );
        })}
        <View className="h-10" />
      </ScrollView>
    </View>
  );
}
