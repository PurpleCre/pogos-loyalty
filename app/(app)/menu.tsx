import React, { useCallback, useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, ActivityIndicator, Modal, Pressable } from 'react-native';
import { useMenu, MenuItemOption, MenuItemOptionChoice } from '@/hooks/useMenu';
import { useCart } from '@/contexts/CartContext';
import { ShoppingCart, Plus, Minus, ChevronLeft, Utensils, CupSoda, Flame, Gift, Pizza, CheckCircle2, Clock, ShoppingBag, X, Circle, CheckCircle, CheckSquare, Square, Menu as MenuIcon } from 'lucide-react-native';
import { router, useFocusEffect, useNavigation } from 'expo-router';
import { DrawerActions } from '@react-navigation/native';
import { useAuth } from '@/hooks/useAuth';
import { useOrders } from '@/hooks/useOrders';
import { useOrder } from '@/contexts/OrderContext';

export default function MenuScreen() {
  const { selectedStore } = useOrder();
  const { categories, items, isLoading, refetch } = useMenu(false, selectedStore?.id);
  const { items: cartItems, addToCart, removeFromCart, updateQuantity, itemCount, cartTotal } = useCart();
  const { user } = useAuth();
  const { activeOrders, refetch: refetchOrders } = useOrders();
  const navigation = useNavigation();

  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  
  // Customization Modal State
  const [customizationItem, setCustomizationItem] = useState<any | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string[]>>({});

  useFocusEffect(
    useCallback(() => {
      refetch();
      refetchOrders();
    }, [])
  );

  useEffect(() => {
    if (categories.length > 0 && !activeCategory) {
      setActiveCategory(categories[0].id);
    }
  }, [categories]);

  if (isLoading && categories.length === 0 && items.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#dc2626" />
      </View>
    );
  }

  const getQuantity = (menuItemId: string) => {
    return cartItems.find(i => i.menu_item_id === menuItemId)?.quantity || 0;
  };

  const handleIncrement = (item: any) => {
    const qty = getQuantity(item.id);
    if (qty > 0) {
      updateQuantity(item.id, qty + 1);
    } else {
      openCustomization(item);
    }
  };

  const openCustomization = (item: any) => {
    setCustomizationItem(item);
    
    // Initialize default selections based on database
    const initialSelections: Record<string, string[]> = {};
    if (item.menu_item_options) {
      item.menu_item_options.forEach((option: MenuItemOption) => {
        const defaultChoices = option.menu_item_option_choices
          ?.filter(c => c.is_default)
          .map(c => c.id) || [];
        initialSelections[option.id] = defaultChoices;
      });
    }
    setSelectedOptions(initialSelections);
  };

  const closeCustomization = () => {
    setCustomizationItem(null);
  };

  const toggleOptionChoice = (optionId: string, choiceId: string, maxChoices: number) => {
    setSelectedOptions(prev => {
      const currentSelected = prev[optionId] || [];
      
      // If it's a radio button behavior (max_choices === 1)
      if (maxChoices === 1) {
        return { ...prev, [optionId]: [choiceId] };
      }
      
      // Checkbox behavior
      if (currentSelected.includes(choiceId)) {
        return { ...prev, [optionId]: currentSelected.filter(id => id !== choiceId) };
      } else {
        if (currentSelected.length < maxChoices) {
          return { ...prev, [optionId]: [...currentSelected, choiceId] };
        }
        return prev;
      }
    });
  };

  const getCustomizedPrice = () => {
    if (!customizationItem) return 0;
    let base = customizationItem.price;
    
    if (customizationItem.menu_item_options) {
      customizationItem.menu_item_options.forEach((option: MenuItemOption) => {
        const selectedForOption = selectedOptions[option.id] || [];
        option.menu_item_option_choices?.forEach(choice => {
          if (selectedForOption.includes(choice.id)) {
            base += choice.price_adjustment;
          }
        });
      });
    }
    return base;
  };

  const handleAddToOrder = () => {
    if (!customizationItem) return;
    addToCart({
      id: customizationItem.id, // In a real app, generate a unique ID for customized items
      menu_item_id: customizationItem.id,
      name: customizationItem.name,
      price: getCustomizedPrice(),
      quantity: 1
    });
    closeCustomization();
  };

  const handleDecrement = (item: any) => {
    const qty = getQuantity(item.id);
    if (qty > 1) {
      updateQuantity(item.id, qty - 1);
    } else if (qty === 1) {
      removeFromCart(item.id);
    }
  };

  const getCategoryIcon = (name: string, isActive: boolean) => {
    const color = isActive ? '#fff' : '#6b7280';
    const lower = name.toLowerCase();
    if (lower.includes('burger')) return <Utensils size={24} color={color} />;
    if (lower.includes('drink')) return <CupSoda size={24} color={color} />;
    if (lower.includes('side')) return <Pizza size={24} color={color} />;
    if (lower.includes('combo')) return <Gift size={24} color={color} />;
    if (lower.includes('special')) return <Flame size={24} color={color} />;
    return <Utensils size={24} color={color} />;
  };

  const displayItems = activeCategory 
    ? items.filter(i => i.category_id === activeCategory)
    : items;

  return (
    <View className="flex-1 bg-gray-50">
      {/* Red Header matching screenshot style */}
      <View className="bg-red-600 pt-14 pb-4 px-4 rounded-b-3xl">
        <View className="flex-row justify-between items-center mb-4">
          <TouchableOpacity onPress={() => navigation.dispatch(DrawerActions.toggleDrawer())} className="w-10 h-10 items-center justify-center -ml-2">
            <MenuIcon size={28} color="#fff" />
          </TouchableOpacity>
          <Text className="text-white text-xl font-bold">Pogo's</Text>
          <TouchableOpacity onPress={() => router.push('/(app)/cart')} className="w-10 h-10 items-center justify-center">
            <ShoppingCart size={24} color="#fff" />
            {itemCount > 0 && (
              <View className="absolute top-1 right-0 bg-yellow-400 w-4 h-4 rounded-full items-center justify-center border border-red-600">
                <Text className="text-red-900 text-[10px] font-bold">{itemCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
        <Text className="text-white text-lg font-medium mb-1">
          Menu - {selectedStore?.name.replace("Pogo's ", "") || 'All'} Store
        </Text>
      </View>

      {/* Category Scrollbar */}
      <View className="bg-white py-3 border-b border-gray-100 shadow-sm z-10">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-4">
          {categories.map(category => {
            const isActive = category.id === activeCategory;
            return (
              <TouchableOpacity 
                key={category.id} 
                onPress={() => setActiveCategory(category.id)}
                className="items-center mr-6"
              >
                <View className={`w-14 h-14 rounded-full items-center justify-center mb-1 shadow-sm border ${
                  isActive ? 'bg-red-600 border-red-600' : 'bg-white border-gray-200'
                }`}>
                  {getCategoryIcon(category.name, isActive)}
                </View>
                <Text className={`text-xs font-semibold ${isActive ? 'text-red-600' : 'text-gray-500'}`}>
                  {category.name}
                </Text>
              </TouchableOpacity>
            )
          })}
        </ScrollView>
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
                      order.status === 'preparing' ? 'bg-amber-100' : 'bg-red-100'
                    }`}>
                      {order.status === 'ready' ? <CheckCircle2 size={20} color="#16a34a" /> :
                       order.status === 'preparing' ? <Clock size={20} color="#d97706" /> :
                       <ShoppingBag size={20} color="#dc2626" />}
                    </View>
                    <View>
                      <Text className="font-bold text-gray-900 capitalize">Order {order.status}</Text>
                      <Text className="text-xs text-gray-500">Order #{order.id.slice(0, 6)}</Text>
                    </View>
                  </View>
                  <Text className="font-bold text-red-600">${order.total_amount.toFixed(2)}</Text>
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

        {/* Product Grid */}
        <View className="flex-row flex-wrap justify-between">
          {displayItems.length === 0 ? (
            <View className="w-full py-10 items-center justify-center">
              <Text className="text-gray-400 font-medium">No items in this category.</Text>
            </View>
          ) : (
            displayItems.map(item => {
              const qty = getQuantity(item.id);
              
              return (
                <View key={item.id} className="w-[48%] bg-white rounded-2xl mb-4 border border-gray-100 shadow-sm overflow-hidden flex-col">
                  {item.image_url ? (
                    <Image 
                      source={{ uri: item.image_url }} 
                      className="w-full h-32 bg-gray-200"
                      resizeMode="cover"
                    />
                  ) : (
                    <View className="w-full h-32 bg-red-50 items-center justify-center">
                      <ShoppingBag color="#fca5a5" size={40} />
                    </View>
                  )}
                  
                  <View className="p-3 flex-1 flex-col">
                    <Text className="font-bold text-gray-900 text-sm mb-1 leading-tight">{item.name}</Text>
                    <Text className="text-xs text-gray-500 mb-3 h-8 leading-tight" numberOfLines={2}>
                      {item.description || "A delicious classic you'll love."}
                    </Text>
                    
                    <View className="flex-row justify-between items-center mt-auto">
                      <Text className="font-extrabold text-gray-900">${item.price.toFixed(2)}</Text>
                      
                      {qty === 0 ? (
                        <TouchableOpacity 
                          onPress={() => handleIncrement(item)}
                          className="bg-red-600 w-8 h-8 rounded-lg items-center justify-center shadow-sm"
                        >
                          <Plus size={18} color="#fff" />
                        </TouchableOpacity>
                      ) : (
                        <View className="flex-row items-center bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                          <TouchableOpacity 
                            onPress={() => handleDecrement(item)}
                            className="w-7 h-8 items-center justify-center bg-white"
                          >
                            <Minus size={14} color="#dc2626" />
                          </TouchableOpacity>
                          <Text className="font-bold text-gray-900 w-5 text-center text-xs">{qty}</Text>
                          <TouchableOpacity 
                            onPress={() => handleIncrement(item)}
                            className="w-7 h-8 items-center justify-center bg-red-600"
                          >
                            <Plus size={14} color="#fff" />
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>
        <View className="h-28" />
      </ScrollView>

      {/* Modern FAB (Floating Action Button) for Cart */}
      {itemCount > 0 && (
        <View className="absolute bottom-6 right-4 shadow-lg shadow-red-600/30">
          <TouchableOpacity 
            onPress={() => router.push('/(app)/cart')}
            className="bg-red-600 flex-row items-center justify-between px-4 py-3 rounded-full"
          >
            <View className="relative mr-3">
              <ShoppingCart size={24} color="#fff" />
              <View className="absolute -top-2 -right-2 bg-yellow-400 w-5 h-5 rounded-full items-center justify-center border border-red-600">
                <Text className="text-red-900 text-[10px] font-black">{itemCount}</Text>
              </View>
            </View>
            <Text className="text-white font-extrabold text-lg tracking-tight">${cartTotal.toFixed(2)}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Database-Driven Customization Bottom Sheet Modal */}
      <Modal
        visible={!!customizationItem}
        transparent={true}
        animationType="slide"
        onRequestClose={closeCustomization}
      >
        <View className="flex-1 justify-end bg-black/40">
          <Pressable className="flex-1" onPress={closeCustomization} />
          
          <View className="bg-white rounded-t-3xl overflow-hidden pb-8 max-h-[85%] shadow-xl">
            {/* Handle for dragging (visual only) */}
            <View className="w-full items-center py-3">
              <View className="w-12 h-1.5 bg-gray-300 rounded-full" />
            </View>
            
            <View className="px-5 pb-4">
              <View className="flex-row justify-between items-start mb-6">
                <View className="flex-1 pr-4">
                  <Text className="text-gray-500 text-sm font-semibold mb-1">Customize Your</Text>
                  <Text className="text-2xl font-black text-gray-900 leading-tight">
                    {customizationItem?.name}
                  </Text>
                </View>
                <TouchableOpacity onPress={closeCustomization} className="bg-gray-100 p-2 rounded-full">
                  <X size={20} color="#6b7280" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} className="mb-4">
                {customizationItem?.menu_item_options?.length > 0 ? (
                  customizationItem.menu_item_options
                    .sort((a: MenuItemOption, b: MenuItemOption) => a.sort_order - b.sort_order)
                    .map((option: MenuItemOption) => (
                    <View key={option.id} className="mb-6">
                      <Text className="text-lg font-bold text-gray-900 mb-3">{option.name}</Text>
                      <View className="flex-row flex-wrap">
                        {option.menu_item_option_choices
                          ?.sort((a: MenuItemOptionChoice, b: MenuItemOptionChoice) => a.sort_order - b.sort_order)
                          .map((choice: MenuItemOptionChoice) => {
                          const isSelected = (selectedOptions[option.id] || []).includes(choice.id);
                          const isRadio = option.max_choices === 1;
                          
                          return (
                            <TouchableOpacity 
                              key={choice.id}
                              onPress={() => toggleOptionChoice(option.id, choice.id, option.max_choices)}
                              className={`flex-row items-center mb-4 ${isRadio ? 'mr-6' : 'w-1/2'}`}
                            >
                              {isRadio ? (
                                isSelected ? (
                                  <CheckCircle size={20} color="#dc2626" className="mr-2" />
                                ) : (
                                  <Circle size={20} color="#d1d5db" className="mr-2" />
                                )
                              ) : (
                                isSelected ? (
                                  <CheckSquare size={20} color="#dc2626" className="mr-2" />
                                ) : (
                                  <Square size={20} color="#d1d5db" className="mr-2" />
                                )
                              )}
                              <View>
                                <Text className={`text-base ${isSelected ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
                                  {choice.name}
                                </Text>
                                {choice.price_adjustment > 0 && (
                                  <Text className="text-xs text-gray-400">+${choice.price_adjustment.toFixed(2)}</Text>
                                )}
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  ))
                ) : (
                  <View className="py-6 items-center">
                    <Text className="text-gray-500 font-medium">No customization options available.</Text>
                  </View>
                )}
                
                <View className="h-4" />
              </ScrollView>
              
              {/* Order Summary & Button */}
              <View className="border-t border-gray-100 pt-4">
                <View className="flex-row justify-between items-center mb-4">
                  <Text className="font-bold text-gray-900">Current Total:</Text>
                  <Text className="font-semibold text-gray-500">Total: 1 item (${getCustomizedPrice().toFixed(2)})</Text>
                </View>
                
                <TouchableOpacity 
                  onPress={handleAddToOrder}
                  className="bg-red-600 py-4 rounded-xl items-center shadow-sm"
                >
                  <Text className="text-white font-bold text-lg">ADD TO ORDER</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
