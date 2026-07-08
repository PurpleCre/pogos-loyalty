import { useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { useMenu } from '@/hooks/useMenu';
import { useCart } from '@/contexts/CartContext';
import { ShoppingBag, Plus, Minus } from 'lucide-react-native';
import { router, useFocusEffect } from 'expo-router';

export default function MenuScreen() {
  const { categories, items, isLoading, refetch } = useMenu();
  const { items: cartItems, addToCart, removeFromCart, updateQuantity, itemCount, cartTotal } = useCart();

  useFocusEffect(
    useCallback(() => {
      refetch();
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
      <View className="px-4 pt-12 pb-4 bg-white border-b border-gray-100">
        <Text className="text-3xl font-bold text-gray-900">Pogos Menu</Text>
        <Text className="text-gray-500 mt-1">Tap the plus icon to add to your order</Text>
      </View>

      <ScrollView className="flex-1 px-4 pt-4">
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
