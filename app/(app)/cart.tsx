import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Minus, Plus, Trash2, ShoppingBag } from 'lucide-react-native';
import { router } from 'expo-router';
import { useState } from 'react';

export default function CartScreen() {
  const { items, updateQuantity, removeFromCart, cartTotal, clearCart } = useCart();
  const { session } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePlaceOrder = async () => {
    if (items.length === 0) return;
    if (!session?.user?.id) {
      Alert.alert('Error', 'You must be logged in to place an order');
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
      Alert.alert('Success', 'Your order has been placed!', [
        { text: 'OK', onPress: () => router.push('/(app)/dashboard') }
      ]);
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
        <View className="w-20 h-20 bg-indigo-50 rounded-full items-center justify-center mb-4">
          <ShoppingBag size={32} color="#4f46e5" />
        </View>
        <Text className="text-xl font-bold text-gray-900 mb-2">Your cart is empty</Text>
        <Text className="text-gray-500 text-center mb-8">Looks like you haven't added any items to your order yet.</Text>
        <TouchableOpacity 
          onPress={() => router.back()}
          className="bg-indigo-600 px-6 py-3 rounded-xl"
        >
          <Text className="text-white font-bold">Browse Menu</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      <View className="flex-row items-center justify-between px-4 pt-12 pb-4 bg-white border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
          <ArrowLeft size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-gray-900">Your Order</Text>
        <TouchableOpacity onPress={clearCart} className="p-2 -mr-2">
          <Trash2 size={20} color="#ef4444" />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 px-4 pt-4">
        {items.map(item => (
          <View key={item.id} className="bg-white p-4 rounded-2xl border border-gray-100 flex-row items-center mb-3">
            <View className="flex-1 mr-4">
              <Text className="font-bold text-gray-900 text-lg">{item.name}</Text>
              <Text className="text-indigo-600 font-semibold mt-1">${(item.price * item.quantity).toFixed(2)}</Text>
            </View>

            <View className="flex-row items-center bg-gray-100 rounded-full">
              <TouchableOpacity 
                onPress={() => updateQuantity(item.id, item.quantity - 1)}
                className="w-10 h-10 items-center justify-center rounded-full"
              >
                <Minus size={18} color="#4f46e5" />
              </TouchableOpacity>
              <Text className="font-bold text-gray-900 w-8 text-center">{item.quantity}</Text>
              <TouchableOpacity 
                onPress={() => updateQuantity(item.id, item.quantity + 1)}
                className="w-10 h-10 items-center justify-center rounded-full bg-indigo-600"
              >
                <Plus size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>

      <View className="bg-white p-6 border-t border-gray-100 rounded-t-3xl shadow-lg">
        <View className="flex-row justify-between mb-2">
          <Text className="text-gray-500">Subtotal</Text>
          <Text className="font-semibold text-gray-900">${cartTotal.toFixed(2)}</Text>
        </View>
        <View className="flex-row justify-between mb-4">
          <Text className="text-gray-500">Taxes (8%)</Text>
          <Text className="font-semibold text-gray-900">${(cartTotal * 0.08).toFixed(2)}</Text>
        </View>
        <View className="flex-row justify-between mb-6 pt-4 border-t border-gray-100">
          <Text className="text-xl font-bold text-gray-900">Total</Text>
          <Text className="text-xl font-bold text-indigo-600">${(cartTotal * 1.08).toFixed(2)}</Text>
        </View>

        <TouchableOpacity 
          onPress={handlePlaceOrder}
          disabled={isSubmitting}
          className={`py-4 rounded-xl items-center ${isSubmitting ? 'bg-indigo-400' : 'bg-indigo-600'}`}
        >
          {isSubmitting ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-bold text-lg">Place Order</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
