import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Image, Modal, Pressable } from 'react-native';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, MapPin, Store, CreditCard, Banknote, ChevronDown, Check, Menu } from 'lucide-react-native';
import { router, useNavigation } from 'expo-router';
import { DrawerActions } from '@react-navigation/native';
import { useState } from 'react';
import { useOrder } from '@/contexts/OrderContext';
import { useMenu } from '@/hooks/useMenu';

export default function CartScreen() {
  const { items, cartTotal, clearCart } = useCart();
  const { session } = useAuth();
  const { selectedStore } = useOrder();
  const { items: allMenu } = useMenu(false, selectedStore?.id);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigation = useNavigation();

  // Dropdown states
  const [isCurrencyModalVisible, setIsCurrencyModalVisible] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState('$ (USD)');

  const currencyRates: Record<string, number> = {
    '$ (USD)': 1.0,
    '€ (EUR)': 0.92,
    '£ (GBP)': 0.79,
    '$ (CAD)': 1.35,
    'ZiG (ZWG)': 26.0884,
  };
  const conversionRate = currencyRates[selectedCurrency] || 1.0;
  const displaySymbol = selectedCurrency.split(' ')[0];

  const [isChangeModalVisible, setIsChangeModalVisible] = useState(false);
  const [selectedChange, setSelectedChange] = useState('No change needed');

  const currencyOptions = ['$ (USD)', '€ (EUR)', '£ (GBP)', '$ (CAD)', 'ZiG (ZWG)'];
  
  const currencyNotes: Record<string, number[]> = {
    '$ (USD)': [5, 10, 20, 50, 100],
    '€ (EUR)': [5, 10, 20, 50, 100, 200, 500],
    '£ (GBP)': [5, 10, 20, 50],
    '$ (CAD)': [5, 10, 20, 50, 100],
    'ZiG (ZWG)': [10, 20, 50, 100, 200],
  };

  const localTotal = cartTotal * conversionRate;
  const availableNotes = currencyNotes[selectedCurrency] || [5, 10, 20, 50, 100];
  
  const changeOptions = ['No change needed'];
  availableNotes.forEach(note => {
    if (note > localTotal) {
      changeOptions.push(`Yes, from ${displaySymbol}${note.toFixed(2)}`);
    }
  });

  const handlePlaceOrder = async () => {
    if (items.length === 0) return;
    if (!session?.user?.id) {
      Alert.alert(
        'Sign in required', 
        'You must be logged in to place an order.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Log In', onPress: () => router.push('/(auth)/login') }
        ]
      );
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Create the order
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: session.user.id,
          total_amount: cartTotal,
          status: 'pending',
          points_earned: Math.floor(cartTotal * 10), // 10 points per dollar
          currency: selectedCurrency,
          change_needed: selectedChange,
          store_id: selectedStore?.id || null,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // 2. Create the order items
      const orderItems = items.map(item => ({
        order_id: orderData.id,
        menu_item_id: item.menu_item_id,
        quantity: item.quantity,
        unit_price: item.price,
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      // 3. Clear cart and redirect
      clearCart();
      router.push(`/(app)/order-success?orderId=${orderData.id}`);
    } catch (error: any) {
      console.error('Checkout error:', error);
      Alert.alert('Order Failed', error.message || 'There was a problem placing your order.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center px-4">
        <View className="w-20 h-20 bg-red-50 rounded-full items-center justify-center mb-4">
          <Store size={32} color="#dc2626" />
        </View>
        <Text className="text-xl font-bold text-gray-900 mb-2">Your cart is empty</Text>
        <Text className="text-gray-500 text-center mb-8">Looks like you haven't added any items to your order yet.</Text>
        <TouchableOpacity 
          onPress={() => router.back()}
          className="bg-red-600 px-6 py-3 rounded-xl"
        >
          <Text className="text-white font-bold">Browse Menu</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      {/* Red Header matching Pogo's identity */}
      <View className="bg-red-600 pt-14 pb-4 px-4 rounded-b-3xl">
        <View className="flex-row items-center justify-between mb-2">
          <TouchableOpacity onPress={() => navigation.dispatch(DrawerActions.toggleDrawer())} className="w-10 h-10 items-center justify-center -ml-2">
            <Menu size={28} color="#fff" />
          </TouchableOpacity>
          <Text className="text-white text-xl font-bold">Checkout</Text>
          <View className="w-10" />
        </View>
        <Text className="text-white text-base font-medium">Checkout - Confirm Order</Text>
      </View>

      <ScrollView className="flex-1 px-4 pt-4" showsVerticalScrollIndicator={false}>
        
        {/* Order Summary Card */}
        <View className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
          <Text className="text-lg font-bold text-gray-900 mb-4">Order Summary</Text>
          
          {items.map((item, index) => {
            const menuItem = allMenu.find(m => m.id === item.menu_item_id);
            const isLast = index === items.length - 1;
            
            return (
              <View key={item.id} className={`flex-row items-center py-3 ${!isLast ? 'border-b border-gray-50' : ''}`}>
                {menuItem?.image_url ? (
                  <Image 
                    source={{ uri: menuItem.image_url }} 
                    className="w-12 h-12 rounded-lg bg-gray-100 mr-3"
                    resizeMode="cover"
                  />
                ) : (
                  <View className="w-12 h-12 rounded-lg bg-gray-100 mr-3 items-center justify-center">
                    <Store size={20} color="#9ca3af" />
                  </View>
                )}
                
                <View className="flex-1">
                  <Text className="font-semibold text-gray-900 leading-tight">
                    {item.quantity}x {item.name}
                  </Text>
                  {/* Mock customized text if price > base price, could expand logically in future */}
                  {menuItem && item.price > menuItem.price && (
                    <Text className="text-xs text-gray-500">(Custom)</Text>
                  )}
                </View>
                
                <Text className="font-bold text-gray-900">{displaySymbol}{(item.price * item.quantity * conversionRate).toFixed(2)}</Text>
              </View>
            );
          })}
        </View>

        {/* Delivery Details Card */}
        <View className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
          <Text className="text-lg font-bold text-gray-900 mb-4">Delivery Details</Text>
          
          <View className="flex-row items-center mb-4">
            <Store size={20} color="#6b7280" className="mr-3" />
            <Text className="text-base text-gray-800 font-medium">{selectedStore?.name || "Main St. QuickBite"}</Text>
          </View>
          
          <View className="flex-row items-center">
            <MapPin size={20} color="#6b7280" className="mr-3" />
            <Text className="text-base text-gray-800 font-medium">Main Street, City Center</Text>
          </View>
        </View>

        {/* Payment Method Card (Cash on Delivery format from mockup) */}
        <View className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-8">
          <View className="flex-row items-center mb-2">
            <Banknote size={24} color="#15803d" className="mr-2" />
            <Text className="text-lg font-bold text-gray-900">Payment on Delivery</Text>
          </View>
          <Text className="text-sm text-gray-500 mb-4">Cash payment collected by the driver.</Text>
          
          <View className="flex-row justify-between border-t border-gray-100 pt-3">
            <TouchableOpacity onPress={() => setIsCurrencyModalVisible(true)}>
              <Text className="text-xs text-gray-400 mb-1">Currency</Text>
              <View className="flex-row items-center">
                <Text className="font-semibold text-gray-900 mr-1">{selectedCurrency}</Text>
                <ChevronDown size={16} color="#6b7280" />
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setIsChangeModalVisible(true)}>
              <Text className="text-xs text-gray-400 mb-1">Need Change?</Text>
              <View className="flex-row items-center">
                <Text className="font-semibold text-gray-900 mr-1">{selectedChange}</Text>
                <ChevronDown size={16} color="#6b7280" />
              </View>
            </TouchableOpacity>
          </View>
        </View>
        
        <View className="h-24" />
      </ScrollView>

      {/* Sticky Footer */}
      <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 pt-4 pb-8 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-gray-600 font-medium">Est. Delivery: 20-30 min</Text>
          <Text className="text-2xl font-black text-gray-900">{displaySymbol}{(cartTotal * conversionRate).toFixed(2)}</Text>
        </View>
        
        <TouchableOpacity 
          onPress={handlePlaceOrder}
          disabled={isSubmitting}
          className={`py-4 rounded-xl items-center shadow-sm ${isSubmitting ? 'bg-red-400' : 'bg-red-600'}`}
        >
          {isSubmitting ? (
            <ActivityIndicator color="white" />
          ) : (
            <View className="items-center">
              <Text className="text-white font-black text-lg">PLACE ORDER</Text>
              <Text className="text-red-100 text-xs mt-1">(Cash Payment on Delivery)</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Currency Modal */}
      <Modal visible={isCurrencyModalVisible} transparent animationType="fade" onRequestClose={() => setIsCurrencyModalVisible(false)}>
        <View className="flex-1 justify-end bg-black/40">
          <Pressable className="flex-1" onPress={() => setIsCurrencyModalVisible(false)} />
          <View className="bg-white rounded-t-3xl p-6">
            <Text className="text-xl font-bold text-gray-900 mb-4">Select Currency</Text>
            {currencyOptions.map(option => (
              <TouchableOpacity 
                key={option} 
                onPress={() => {
                  setSelectedCurrency(option);
                  setIsCurrencyModalVisible(false);
                }}
                className="flex-row items-center justify-between py-4 border-b border-gray-100"
              >
                <Text className={`text-lg ${selectedCurrency === option ? 'font-bold text-red-600' : 'text-gray-700'}`}>
                  {option}
                </Text>
                {selectedCurrency === option && <Check size={20} color="#dc2626" />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setIsCurrencyModalVisible(false)} className="mt-6 bg-gray-100 py-3 rounded-xl items-center">
              <Text className="font-bold text-gray-700">Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Change Modal */}
      <Modal visible={isChangeModalVisible} transparent animationType="fade" onRequestClose={() => setIsChangeModalVisible(false)}>
        <View className="flex-1 justify-end bg-black/40">
          <Pressable className="flex-1" onPress={() => setIsChangeModalVisible(false)} />
          <View className="bg-white rounded-t-3xl p-6">
            <Text className="text-xl font-bold text-gray-900 mb-4">Need Change For?</Text>
            {changeOptions.map(option => (
              <TouchableOpacity 
                key={option} 
                onPress={() => {
                  setSelectedChange(option);
                  setIsChangeModalVisible(false);
                }}
                className="flex-row items-center justify-between py-4 border-b border-gray-100"
              >
                <Text className={`text-lg ${selectedChange === option ? 'font-bold text-red-600' : 'text-gray-700'}`}>
                  {option}
                </Text>
                {selectedChange === option && <Check size={20} color="#dc2626" />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setIsChangeModalVisible(false)} className="mt-6 bg-gray-100 py-3 rounded-xl items-center">
              <Text className="font-bold text-gray-700">Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
