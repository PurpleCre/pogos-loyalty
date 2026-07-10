import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated, Easing } from 'react-native';
import { useLocalSearchParams, router, useNavigation } from 'expo-router';
import { DrawerActions } from '@react-navigation/native';
import { Check, Store, MapPin, Sparkles, Menu } from 'lucide-react-native';
import { useOrder } from '@/contexts/OrderContext';

export default function OrderSuccessScreen() {
  const { orderId } = useLocalSearchParams();
  const { selectedStore } = useOrder();
  const navigation = useNavigation();
  
  // Simple animation for the checkmark
  const scaleValue = new Animated.Value(0);

  useEffect(() => {
    Animated.spring(scaleValue, {
      toValue: 1,
      friction: 4,
      tension: 40,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <View className="flex-1 bg-gray-50">
      {/* Red Header matching Pogo's identity */}
      <View className="bg-red-600 pt-14 pb-4 px-4 rounded-b-3xl flex-row items-center justify-between">
        <TouchableOpacity onPress={() => navigation.dispatch(DrawerActions.toggleDrawer())} className="p-2 -ml-2">
          <Menu size={24} color="#fff" />
        </TouchableOpacity>
        <Text className="text-white text-xl font-bold">Pogo's</Text>
        <View className="w-10" />
      </View>

      <View className="flex-1 px-4 pt-10">
        <View className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 items-center mb-8 relative overflow-hidden">
          
          {/* Mock Confetti Background Elements */}
          <View className="absolute top-10 left-10 opacity-30">
            <Sparkles size={24} color="#f59e0b" />
          </View>
          <View className="absolute top-20 right-12 opacity-30">
            <Sparkles size={20} color="#10b981" />
          </View>
          <View className="absolute bottom-12 left-16 opacity-30">
            <Sparkles size={18} color="#ef4444" />
          </View>
          <View className="absolute top-6 right-20 opacity-30">
            <Sparkles size={16} color="#3b82f6" />
          </View>

          {/* Animated Checkmark */}
          <Animated.View 
            style={{ transform: [{ scale: scaleValue }] }}
            className="w-32 h-32 bg-green-100 rounded-full items-center justify-center mb-6"
          >
            <Check size={80} color="#10b981" strokeWidth={3} />
          </Animated.View>

          <Text className="text-2xl font-black text-gray-900 mb-2 tracking-tight">ORDER CONFIRMED!</Text>
          <Text className="text-base text-gray-500 mb-1">Order #{(orderId as string)?.slice(0, 8).toUpperCase() || 'POGO987654'}</Text>
          <Text className="text-base font-semibold text-gray-700 mb-8">Est. Arrival: 20-30 min</Text>
          
          {/* Delivery Context Card */}
          <View className="w-full bg-gray-50 rounded-xl p-4 border border-gray-100">
            <Text className="text-xs text-gray-500 font-bold mb-3 uppercase tracking-wider">Delivering from</Text>
            
            <View className="flex-row items-center mb-4">
              <Store size={20} color="#6b7280" className="mr-3" />
              <Text className="text-base text-gray-800 font-medium">{selectedStore?.name || "Main St. Store"}</Text>
            </View>
            
            <View className="flex-row items-center ml-2 mb-2">
              <View className="w-[1px] h-4 bg-gray-300" />
            </View>
            <View className="flex-row items-center ml-2 mb-4">
              <View className="w-1 h-1 rounded-full bg-gray-400" />
              <Text className="text-gray-400 text-xs ml-2">to</Text>
            </View>
            
            <View className="flex-row items-center">
              <MapPin size={20} color="#6b7280" className="mr-3" />
              <Text className="text-base text-gray-800 font-medium">Main St. City Center</Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <TouchableOpacity 
          onPress={() => router.push('/(app)/dashboard')}
          className="bg-red-600 py-4 rounded-xl items-center shadow-sm mb-4"
        >
          <Text className="text-white font-black text-lg">TRACK YOUR ORDER</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => router.push('/(app)/menu')}
          className="py-4 items-center"
        >
          <Text className="text-red-600 font-bold text-base">Back to Home</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
