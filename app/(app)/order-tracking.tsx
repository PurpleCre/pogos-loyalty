import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { useLocalSearchParams, router, useNavigation } from 'expo-router';
import { DrawerActions } from '@react-navigation/native';
import { Menu, ClipboardList, Timer, Truck, Package, MessageSquare, HelpCircle, User, Star, ShoppingCart, ChevronDown } from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { useMenu } from '@/hooks/useMenu';

type OrderStatus = 'pending' | 'preparing' | 'on_the_way' | 'delivered' | 'cancelled';

export default function OrderTrackingScreen() {
  const { orderId: paramOrderId } = useLocalSearchParams();
  const { session } = useAuth();
  const navigation = useNavigation();
  const { items: allMenu } = useMenu();

  const [order, setOrder] = useState<any>(null);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch the active order
  useEffect(() => {
    async function fetchOrder() {
      if (!session?.user) return;
      
      try {
        setLoading(true);
        let currentOrder = null;

        if (paramOrderId) {
          // Fetch specific order
          const { data } = await supabase
            .from('orders')
            .select('*')
            .eq('id', paramOrderId)
            .single();
          currentOrder = data;
        } else {
          // Fetch most recent active order
          const { data } = await supabase
            .from('orders')
            .select('*')
            .eq('user_id', session.user.id)
            .neq('status', 'cancelled')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          currentOrder = data;
        }

        if (currentOrder) {
          setOrder(currentOrder);
          
          // Fetch items for the order summary
          const { data: itemsData } = await supabase
            .from('order_items')
            .select('*')
            .eq('order_id', currentOrder.id);
            
          if (itemsData) {
            setOrderItems(itemsData);
          }
        }
      } catch (error) {
        console.log('Error fetching order for tracking', error);
      } finally {
        setLoading(false);
      }
    }

    fetchOrder();
    
    // Optional: Set up realtime subscription to listen to status changes
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
          // If the updated order matches our current order (or if we didn't have one and just got one)
          setOrder((prev: any) => {
            if (!prev || prev.id === payload.new.id) {
              return payload.new;
            }
            return prev;
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

  if (!order) {
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

  // Determine current step
  const status: OrderStatus = order.status || 'pending';
  
  // Mapping status to progress step (0 to 3)
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

  // Derive status text based on step
  let statusText = "Order received and confirmed.";
  if (currentStep === 1) statusText = "Preparing your food...";
  if (currentStep === 2) statusText = "Driver picked up your order.";
  if (currentStep === 3) statusText = "Order has been delivered!";

  // Format order summary
  const summaryText = orderItems.map(item => {
    const menuItem = allMenu.find(m => m.id === item.menu_item_id);
    return `${item.quantity}x ${menuItem?.name || 'Item'}`;
  }).join(', ');

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
            {orderItems.length > 0 && (
              <View className="absolute top-1 right-1 bg-yellow-400 w-4 h-4 rounded-full items-center justify-center">
                <Text className="text-[10px] font-bold text-gray-900">{orderItems.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View className="bg-white px-4 py-3 border-b border-gray-100 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <Menu size={16} color="#9ca3af" className="mr-2" />
          <Text className="text-gray-500 font-medium text-base">Order Tracking</Text>
        </View>
        <ChevronDown size={20} color="#9ca3af" />
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
        
        {/* 4-Step Progress Timeline */}
        <View className="flex-row items-start justify-between mb-8 mt-2 px-2">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isCompleted = index < currentStep;
            const isActive = index === currentStep;
            
            return (
              <View key={index} className="items-center flex-1 z-10 relative">
                {/* Connecting Line */}
                {index < steps.length - 1 && (
                  <View 
                    className="absolute top-6 left-[50%] right-[-50%] h-1 z-[-1]"
                    style={{ backgroundColor: index < currentStep ? '#ea580c' : '#e5e7eb' }}
                  />
                )}
                
                {/* Step Circle */}
                <View 
                  className={`w-12 h-12 rounded-full items-center justify-center mb-2 
                    ${isActive ? 'bg-orange-600 shadow-md ring-4 ring-orange-100' : isCompleted ? 'bg-orange-600' : 'bg-slate-500'}`}
                >
                  <Icon size={20} color="#fff" />
                </View>
                
                {/* Step Title */}
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
          <Text className="text-gray-600 text-sm">ETA: 11:45 AM - 12:00 PM</Text>
        </View>

        {/* Meet Your Driver Module */}
        <View className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
          <Text className="text-base text-gray-900 font-bold mb-4">Meet Your Driver</Text>
          
          <View className="flex-row items-center">
            <View className="w-12 h-12 bg-gray-200 rounded-full items-center justify-center mr-4 overflow-hidden">
              {/* Mock Driver Image using a simple icon for now, or user can provide an image link */}
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
        <View className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-8">
          <Text className="text-base text-gray-900 font-bold mb-2">Order Summary</Text>
          <Text className="text-gray-600 text-sm leading-relaxed">{summaryText || "Fetching items..."}</Text>
        </View>

        {/* Action Buttons */}
        <TouchableOpacity className="bg-red-600 py-4 rounded-xl items-center shadow-sm mb-3 flex-row justify-center">
          <MessageSquare size={20} color="#fff" className="mr-2" />
          <Text className="text-white font-bold text-lg">Contact Driver</Text>
        </TouchableOpacity>

        <TouchableOpacity className="bg-red-600 py-4 rounded-xl items-center shadow-sm mb-8 flex-row justify-center">
          <HelpCircle size={20} color="#fff" className="mr-2" />
          <Text className="text-white font-bold text-lg">Need Help?</Text>
        </TouchableOpacity>
        
      </ScrollView>
    </View>
  );
}
