import { useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { useMenu } from '@/hooks/useMenu';
import { useCart } from '@/contexts/CartContext';
import { ShoppingBag, Plus, Minus } from 'lucide-react-native';
import { router, useFocusEffect, useNavigation } from 'expo-router';
import { DrawerActions } from '@react-navigation/native';
import { useAuth } from '@/hooks/useAuth';
import { useRewards } from '@/hooks/useRewards';
import { useOrders } from '@/hooks/useOrders';
import { Star, CheckCircle2, Clock, Menu } from 'lucide-react-native';

export default function MenuScreen() {
  const { categories, items, isLoading, refetch } = useMenu();
  const { items: cartItems, addToCart, removeFromCart, updateQuantity, itemCount, cartTotal } = useCart();
  const { user } = useAuth();
  const { userPoints } = useRewards();
  const { activeOrders, refetch: refetchOrders } = useOrders();
  const navigation = useNavigation();

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || 'there';
  const currentPoints = userPoints?.current_points ?? 0;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  useFocusEffect(
    useCallback(() => {
      refetch();
      refetchOrders();
    }, [])
  );

  if (isLoading && categories.length === 0 && items.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  // Get quantity of a specific item in the cart
  const getQuantity = (menuItemId: string) => {
    return cartItems.find(i => i.menu_item_id === menuItemId)?.quantity || 0;
  };

  const handleIncrement = (item: any) => {
    const qty = getQuantity(item.id);
    if (qty > 0) {
      updateQuantity(item.id, qty + 1);
    } else {
      addToCart({
        id: item.id,
        menu_item_id: item.id,
        name: item.name,
        price: item.price,
        quantity: 1
      });
    }
  };

  const handleDecrement = (item: any) => {
    const qty = getQuantity(item.id);
    if (qty > 1) {
      updateQuantity(item.id, qty - 1);
    } else if (qty === 1) {
      removeFromCart(item.id);
    }
  };

  return (
    <View className="flex-1 bg-gray-50">
      <View className="px-4 pt-14 pb-4 bg-white border-b border-gray-100 flex-row justify-between items-center">
        <View className="flex-row items-center">
          <TouchableOpacity 
            onPress={() => navigation.dispatch(DrawerActions.toggleDrawer())}
            className="mr-3 bg-gray-100 p-2 rounded-full"
          >
            <Menu size={20} color="#1f2937" />
          </TouchableOpacity>
          <View>
            <Text className="text-gray-500 text-sm mb-0.5">{getGreeting()},</Text>
            <Text className="text-xl font-bold text-gray-900">{firstName} 👋</Text>
          </View>
        </View>
        <TouchableOpacity 
          onPress={() => router.push('/(app)/dashboard')}
          className="bg-indigo-50 flex-row items-center px-3 py-1.5 rounded-full"
        >
          <Star size={14} color="#6366f1" className="mr-1.5" />
          <Text className="text-indigo-600 font-bold">{currentPoints} pts</Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 px-4 pt-4">
        {/* Active Orders */}
        {activeOrders.length > 0 && (
          <View className="mb-6">
            <Text className="text-xl font-bold text-gray-900 mb-4">Active Order</Text>
            {activeOrders.map(order => (
              <View key={order.id} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm mb-3">
                <View className="flex-row justify-between items-center mb-3">
                  <View className="flex-row items-center">
                    <View className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${
                      order.status === 'ready' ? 'bg-green-100' : 
                      order.status === 'preparing' ? 'bg-amber-100' : 'bg-indigo-100'
                    }`}>
                      {order.status === 'ready' ? <CheckCircle2 size={20} color="#16a34a" /> :
                       order.status === 'preparing' ? <Clock size={20} color="#d97706" /> :
                       <ShoppingBag size={20} color="#4f46e5" />}
                    </View>
                    <View>
                      <Text className="font-bold text-gray-900 capitalize">Order {order.status}</Text>
                      <Text className="text-xs text-gray-500">Order #{order.id.slice(0, 6)}</Text>
                    </View>
                  </View>
                  <Text className="font-bold text-indigo-600">${order.total_amount.toFixed(2)}</Text>
                </View>
                
                <View className="bg-gray-50 p-3 rounded-xl">
                  <Text className="text-sm font-semibold text-gray-700 mb-1">Items:</Text>
                  {order.order_items?.map((item: any) => (
                    <Text key={item.id} className="text-xs text-gray-600">
                      {item.quantity}x {item.menu_item?.name}
                    </Text>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}

        {categories.map(category => {
          const categoryItems = items.filter(i => i.category_id === category.id);
          if (categoryItems.length === 0) return null;

          return (
            <View key={category.id} className="mb-8">
              <Text className="text-xl font-bold text-gray-900 mb-4">{category.name}</Text>
              
              <View className="gap-4">
                {categoryItems.map(item => {
                  const qty = getQuantity(item.id);
                  
                  return (
                    <View key={item.id} className="bg-white p-4 rounded-2xl border border-gray-100 flex-row">
                      <View className="flex-1 mr-4 justify-between">
                        <View>
                          <Text className="text-lg font-bold text-gray-900">{item.name}</Text>
                          {item.description ? (
                            <Text className="text-sm text-gray-500 mt-1" numberOfLines={2}>
                              {item.description}
                            </Text>
                          ) : null}
                        </View>
                        <Text className="text-lg font-bold text-indigo-600 mt-2">${item.price.toFixed(2)}</Text>
                      </View>
                      
                      <View className="items-end justify-between">
                        {item.image_url ? (
                          <Image 
                            source={{ uri: item.image_url }} 
                            className="w-20 h-20 rounded-xl bg-gray-100"
                            resizeMode="cover"
                          />
                        ) : (
                          <View className="w-20 h-20 rounded-xl bg-indigo-50 items-center justify-center">
                            <ShoppingBag color="#818cf8" size={32} />
                          </View>
                        )}
                        
                        <View className="mt-3">
                          {qty === 0 ? (
                            <TouchableOpacity 
                              onPress={() => handleIncrement(item)}
                              className="bg-indigo-600 px-4 py-2 rounded-full"
                            >
                              <Text className="text-white font-bold text-sm">Add</Text>
                            </TouchableOpacity>
                          ) : (
                            <View className="flex-row items-center bg-gray-100 rounded-full">
                              <TouchableOpacity 
                                onPress={() => handleDecrement(item)}
                                className="w-8 h-8 items-center justify-center rounded-full"
                              >
                                <Minus size={16} color="#4f46e5" />
                              </TouchableOpacity>
                              <Text className="font-bold text-gray-900 w-6 text-center">{qty}</Text>
                              <TouchableOpacity 
                                onPress={() => handleIncrement(item)}
                                className="w-8 h-8 items-center justify-center rounded-full bg-indigo-600"
                              >
                                <Plus size={16} color="#fff" />
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })}
        <View className="h-24" />
      </ScrollView>

      {itemCount > 0 ? (
        <View className="absolute bottom-4 left-4 right-4">
          <TouchableOpacity 
            onPress={() => router.push('/(app)/cart')}
            className="bg-indigo-600 flex-row items-center justify-between p-4 rounded-2xl shadow-lg"
          >
            <View className="flex-row items-center">
              <View className="bg-indigo-800 w-8 h-8 rounded-full items-center justify-center mr-3">
                <Text className="text-white font-bold">{itemCount}</Text>
              </View>
              <Text className="text-white font-semibold text-lg">View Cart</Text>
            </View>
            <Text className="text-white font-bold text-lg">${cartTotal.toFixed(2)}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}
