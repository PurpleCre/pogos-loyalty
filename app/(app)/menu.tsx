import React, { useCallback, useState, useEffect } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Modal, Pressable, Alert, useWindowDimensions } from 'react-native';
import { Input as TextInput } from '@/components/ui/input';
import { TouchTarget as TouchableOpacity } from '@/components/ui/touch-target';
import { useMenu, MenuItemOption, MenuItemOptionChoice } from '@/hooks/useMenu';
import { useCart } from '@/contexts/CartContext';
import { ShoppingCart, Plus, Minus, ChevronLeft, Utensils, CupSoda, Flame, Gift, Pizza, CheckCircle2, Clock, ShoppingBag, X, Circle, CheckCircle, CheckSquare, Square, Menu as MenuIcon, ChevronDown, Search, MapPin, ChevronRight } from 'lucide-react-native';
import { router, useFocusEffect, useNavigation } from 'expo-router';
import { DrawerActions } from 'expo-router/react-navigation';
import { useAuth } from '@/hooks/useAuth';
import { useOrders } from '@/hooks/useOrders';
import { ReadStatus } from '@/components/ReadStatus';
import { CartStorageStatus } from '@/components/CartStorageStatus';
import { useStores } from '@/hooks/useStores';
import { formatMoney } from '@/lib/cash-orders';
import { useOrder } from '@/contexts/OrderContext';
import { Screen, Card, EmptyState, SectionHeading } from '@/components/ui/screen';
import { Button } from '@/components/ui/button';
import { colors } from '@/lib/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CatalogueImage } from '@/components/CatalogueImage';

export default function MenuScreen() {
  const { width, height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [optionMessage, setOptionMessage] = useState('');
  const { selectedStore } = useOrder();
  const { items: cartItems, storeId: cartStoreId, addToCart, updateQuantity, itemCount, hydrated, notice, dismissNotice } = useCart();
  const { stores } = useStores();
  const branch = selectedStore ?? stores.find(row => row.id === cartStoreId);
  const { categories, items, isLoading, refetch, error: menuError, fresh, refreshedAt } = useMenu(false, branch?.id);
  const { user } = useAuth();
  const { activeOrders, refetch: refetchOrders, fresh: ordersFresh } = useOrders();
  const navigation = useNavigation();

  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  
  // Customization Modal State
  const [customizationItem, setCustomizationItem] = useState<any | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string[]>>({});

  useFocusEffect(
    useCallback(() => {
      refetch();
      refetchOrders();
    }, [refetch, refetchOrders])
  );

  useEffect(() => {
    if (!categories.some(category => category.id === activeCategory)) setActiveCategory(categories[0]?.id ?? null);
  }, [categories, activeCategory]);

  useEffect(() => { setCustomizationItem(null); setSelectedOptions({}); }, [branch?.id]);

  if (isLoading && categories.length === 0 && items.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-canvas">
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const getQuantity = (menuItemId: string) => {
    if (cartStoreId !== branch?.id) return 0;
    return cartItems.filter(i => i.menu_item_id === menuItemId).reduce((sum, item) => sum + item.quantity, 0);
  };

  const handleIncrement = (item: any) => {
    if (item.menu_item_options?.length) { openCustomization(item); return; }
    if (!branch) { router.push('/store-picker'); return; }
    addToCart({ menu_item_id: item.id, name: item.name, price: item.price, quantity: 1, choice_ids: [], choice_labels: [] }, branch.id);
  };

  const openCustomization = (item: any) => {
    setOptionMessage('');
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

  const toggleOptionChoice = (optionId: string, choiceId: string, maxChoices: number, required: boolean) => {
    setOptionMessage('');
    setSelectedOptions(prev => {
      const currentSelected = prev[optionId] || [];
      
      // If it's a radio button behavior (max_choices === 1)
      if (maxChoices === 1) {
        return { ...prev, [optionId]: !required && currentSelected.includes(choiceId) ? [] : [choiceId] };
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
    if (!customizationItem || !hydrated) return;
    if (!branch) {
      closeCustomization();
      router.push('/store-picker');
      return;
    }
    const options: MenuItemOption[] = customizationItem.menu_item_options ?? [];
    if (options.some(option => {
      const count = (selectedOptions[option.id] ?? []).length;
      return (option.is_required && count === 0) || count > option.max_choices;
    })) {
      setOptionMessage('Choose the required options before adding this meal.');
      Alert.alert('Check your meal', 'Choose the required options before adding this meal.');
      return;
    }
    const selectedChoices = options.flatMap(option => (option.menu_item_option_choices ?? [])
      .filter(choice => (selectedOptions[option.id] ?? []).includes(choice.id)));
    const added = addToCart({
      menu_item_id: customizationItem.id,
      name: customizationItem.name,
      price: getCustomizedPrice(),
      quantity: 1,
      choice_ids: selectedChoices.map(choice => choice.id),
      choice_labels: selectedChoices.map(choice => choice.name),
    }, branch.id);
    if (added) closeCustomization();
    else setOptionMessage('This meal could not be added. Check the cart quantity and try again.');
  };

  const handleDecrement = (item: any) => {
    const line = cartItems.find(entry => entry.menu_item_id === item.id);
    if (line) updateQuantity(line.id, line.quantity - 1);
  };

  const query = search.trim().toLowerCase();
  const displayItems = items.filter(item => query
    ? `${item.name} ${item.description}`.toLowerCase().includes(query)
    : !activeCategory || item.category_id === activeCategory);
  const contentWidth = Math.min(width, 1120) - 40;
  const columns = fontScale > 1.4 || width < 350 ? 1 : width > 800 ? 3 : 2;
  const cardWidth = (contentWidth - (columns - 1) * 16) / columns;
  return <Screen title="Pogo’s menu" wide menu onBack={() => navigation.dispatch(DrawerActions.toggleDrawer())}
    action={<TouchableOpacity accessibilityRole="button" accessibilityLabel={`Open cart, ${itemCount} items`} onPress={() => router.push('/(app)/cart')} className="min-w-[44px] min-h-[44px] items-center justify-center rounded-2xl bg-brand-50 relative">
      <ShoppingCart size={22} color={colors.primary} />{itemCount > 0 ? <View className="absolute -top-1 -right-1 bg-brand-800 rounded-full min-w-[20px] px-1 py-0.5"><Text className="text-white text-[10px] font-bold text-center">{itemCount}</Text></View> : null}
    </TouchableOpacity>}
    footer={itemCount > 0 ? <Button onPress={() => router.push('/(app)/cart')}>{`Review cart · ${itemCount} ${itemCount === 1 ? 'item' : 'items'}`}</Button> : undefined}>
    <View className="mb-6"><Text className="text-brand-700 text-xs font-extrabold tracking-widest mb-2">FRESH FROM POGO’S</Text>
      <Text accessibilityRole="header" className="text-3xl font-extrabold text-ink tracking-tight">What are you craving?</Text>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Choose or change branch" onPress={() => router.push('/store-picker')} className="flex-row items-center gap-2 self-start py-3">
        <MapPin size={17} color={colors.primary} /><Text className="font-semibold text-brand-800 flex-shrink">{branch?.name ?? 'Choose your branch'}</Text><ChevronDown size={17} color={colors.primary} />
      </TouchableOpacity>
      <View className="flex-row items-center bg-white rounded-2xl border border-line px-4 gap-3"><Search size={20} color={colors.muted} />
        <TextInput accessibilityLabel="Search the menu" placeholder="Pizza, chicken, your favourite…" placeholderTextColor={colors.muted} value={search} onChangeText={setSearch} className="flex-1 min-w-0 min-h-[52px] border-0 rounded-none bg-transparent px-0 text-base text-ink py-3" />
        {search ? <TouchableOpacity accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setSearch('')} className="w-11 h-11 items-center justify-center"><X size={18} color={colors.muted} /></TouchableOpacity> : null}
      </View>
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 8 }}>
      {categories.map(category => <TouchableOpacity accessibilityRole="button" accessibilityState={{ selected: category.id === activeCategory && !query }} key={category.id} onPress={() => { setActiveCategory(category.id); setSearch(''); }}
        className={`px-5 py-3 min-h-[46px] rounded-2xl border ${category.id === activeCategory && !query ? 'bg-brand-800 border-brand-800' : 'bg-white border-line'}`}>
        <Text className={`font-semibold text-sm ${category.id === activeCategory && !query ? 'text-white' : 'text-subtle'}`}>{category.name.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}</Text>
      </TouchableOpacity>)}
    </ScrollView>
    <CartStorageStatus />
    {notice ? <View className={`rounded-2xl p-4 my-3 border ${notice.error ? 'bg-red-50 border-red-200' : 'bg-brand-50 border-brand-200'}`}>
      <Text accessibilityLiveRegion="polite" accessibilityRole={notice.error ? 'alert' : undefined} className={notice.error ? 'text-red-700' : 'text-brand-900'}>{notice.text}</Text>
      <View className="flex-row flex-wrap gap-2 mt-2"><Button size="sm" variant="ghost" onPress={() => router.push('/(app)/cart')}>Review cart</Button><Button size="sm" variant="ghost" onPress={dismissNotice}>Dismiss</Button></View>
    </View> : null}
    {itemCount > 0 && branch && cartStoreId !== branch.id ? <Card><Text className="font-semibold text-ink mb-2">Your cart is from another branch</Text><Text className="text-subtle leading-6 mb-3">You’re browsing {branch.name}. Your existing cart stays intact unless you choose to replace it when adding a meal here.</Text><Button variant="outline" onPress={() => router.push('/(app)/cart')}>Return to my cart</Button></Card> : null}
    <ReadStatus label="Menu" fresh={fresh} at={refreshedAt} error={menuError} loading={isLoading} onRefresh={() => { void refetch(); }} />
    <Text className="text-subtle text-xs leading-5 mb-5">Menu prices are estimates. A fresh online quote confirms currency, availability, delivery fees and the amount to pay.</Text>
    {activeOrders.length > 0 ? <Card><Text className="font-bold text-ink mb-3">Your active orders{ordersFresh ? '' : ' · last known status'}</Text>
      {activeOrders.map(order => <TouchableOpacity key={order.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/(app)/order-tracking', params: { orderId: order.id } })} className="flex-row justify-between items-center py-3 gap-3">
        <View className="flex-1"><Text className="font-semibold text-ink capitalize">{order.status.replaceAll('_', ' ')}</Text><Text className="text-subtle text-xs mt-1">Order #{order.id.slice(0, 8).toUpperCase()}</Text></View><ChevronRight size={20} color={colors.primary} />
      </TouchableOpacity>)}
    </Card> : null}
    <SectionHeading title={query ? 'Search results' : categories.find(c => c.id === activeCategory)?.name.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) ?? 'The menu'} detail={`${displayItems.length} ${displayItems.length === 1 ? 'item' : 'items'}${query ? ` matching “${search.trim()}”` : ''}`} />
    {!displayItems.length ? <EmptyState icon={Search} title={query ? 'No matches this time' : 'Nothing here just yet'} description={query ? 'Try another meal name or browse a category.' : 'Items may be unavailable at this branch. Try another category or refresh the menu.'} action={query ? 'Clear search' : 'Refresh menu'} onAction={() => query ? setSearch('') : void refetch()} /> : null}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
      {displayItems.map(item => {
        const quantity = getQuantity(item.id);
        return <View key={item.id} style={{ width: cardWidth }} className="bg-white rounded-3xl border border-line overflow-hidden">
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={`View ${item.name} and options`} onPress={() => openCustomization(item)}><CatalogueImage uri={item.image_url} label={item.name} className="w-full h-40" /></TouchableOpacity>
          <View className="p-4 flex-1"><Text className="font-bold text-ink text-base leading-6 mb-2" numberOfLines={2}>{item.name}</Text>
            <Text className="text-subtle text-xs leading-5 mb-4" numberOfLines={2}>{item.description || 'Ask your branch for meal details.'}</Text>
            <View className="mt-auto"><Text className="font-extrabold text-ink text-lg">{formatMoney(Math.round(item.price * 100), 'USD')}</Text><Text className="text-subtle text-[11px] mt-1 mb-3">Menu estimate</Text>
              {quantity === 0 ? <Button size="sm" accessibilityLabel={`Add ${item.name}`} disabled={!hydrated} onPress={() => handleIncrement(item)}>Add to cart</Button>
                : <View className="flex-row items-center justify-between bg-brand-50 rounded-2xl border border-brand-100">
                  {item.menu_item_options?.length || cartItems.some(line => line.menu_item_id === item.id && line.choice_ids.length > 0) ? <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Edit ${item.name} choices in cart`} onPress={() => router.push('/(app)/cart')} className="min-w-[44px] h-11 px-2 items-center justify-center"><Text className="text-brand-800 font-bold text-xs">Edit</Text></TouchableOpacity> : <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Reduce ${item.name} quantity`} disabled={!hydrated} onPress={() => handleDecrement(item)} className="w-11 h-11 items-center justify-center"><Minus size={18} color={colors.primary} /></TouchableOpacity>}
                  <Text className="font-bold text-brand-900">{quantity}</Text>
                  <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Add ${item.name}`} disabled={!hydrated} onPress={() => handleIncrement(item)} className="w-11 h-11 items-center justify-center"><Plus size={18} color={colors.primary} /></TouchableOpacity>
                </View>}
            </View>
          </View>
        </View>;
      })}
    </View>
    <Modal visible={!!customizationItem} transparent animationType="slide" onRequestClose={closeCustomization}>
      <View className="flex-1 justify-end bg-black/50"><Pressable accessibilityLabel="Close meal options" style={{ position: 'absolute', inset: 0 }} onPress={closeCustomization} />
        <View accessibilityViewIsModal style={{ maxHeight: height - 80, paddingBottom: Math.max(insets.bottom, 16), width: '100%', maxWidth: 620, alignSelf: 'center' }} className="bg-white rounded-t-3xl overflow-hidden">
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-line"><Text className="font-semibold text-subtle">Make it yours</Text><TouchableOpacity accessibilityRole="button" accessibilityLabel="Close meal options" onPress={closeCustomization} className="w-11 h-11 items-center justify-center rounded-2xl bg-canvas"><X size={21} color={colors.ink} /></TouchableOpacity></View>
          <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ padding: 24 }}>
            {customizationItem?.image_url ? <CatalogueImage uri={customizationItem.image_url} label={customizationItem.name} className="w-full h-40 mb-5" /> : null}
            <Text className="text-2xl font-extrabold tracking-tight text-ink mb-3">{customizationItem?.name}</Text><Text className="text-subtle leading-6 mb-6">{customizationItem?.description}</Text>
            {customizationItem?.menu_item_options?.length > 0 ? customizationItem.menu_item_options.toSorted((a: MenuItemOption, b: MenuItemOption) => a.sort_order - b.sort_order).map((option: MenuItemOption) => <View key={option.id} className="mb-6">
              <Text className="text-lg font-bold text-ink">{option.name}</Text><Text className="text-subtle text-xs mt-1 mb-3">{option.is_required ? 'Required' : 'Optional'} · Choose up to {option.max_choices}</Text>
              {option.menu_item_option_choices?.toSorted((a: MenuItemOptionChoice, b: MenuItemOptionChoice) => a.sort_order - b.sort_order).map(choice => {
                const selected = (selectedOptions[option.id] ?? []).includes(choice.id);
                return <TouchableOpacity key={choice.id} accessibilityRole={option.max_choices === 1 && option.is_required ? 'radio' : 'checkbox'} accessibilityState={{ checked: selected }} onPress={() => toggleOptionChoice(option.id, choice.id, option.max_choices, option.is_required)} className={`min-h-[56px] flex-row items-center justify-between gap-3 border rounded-2xl p-4 mb-2 ${selected ? 'border-brand-600 bg-brand-50' : 'border-line bg-white'}`}>
                  <View className="flex-1"><Text className="font-semibold text-ink">{choice.name}</Text>{choice.price_adjustment > 0 ? <Text className="text-subtle text-xs mt-1">+{formatMoney(Math.round(choice.price_adjustment * 100), 'USD')} · estimate</Text> : null}</View>
                  {selected ? <CheckCircle size={22} color={colors.primary} /> : <Circle size={22} color={colors.border} />}
                </TouchableOpacity>;
              })}
            </View>) : <Text className="text-subtle mb-4">No customisation choices for this meal.</Text>}
          </ScrollView>
          <View className="px-6 pt-4 border-t border-line"><View className="flex-row justify-between mb-4"><Text className="text-subtle">1 item · estimate</Text><Text className="text-ink font-bold text-lg">{formatMoney(Math.round(getCustomizedPrice() * 100), 'USD')}</Text></View>
            <>{optionMessage ? <Text accessibilityRole="alert" className="text-red-700 text-sm mb-3">{optionMessage}</Text> : null}<Button disabled={!hydrated} accessibilityLabel="Add selections to cart" onPress={handleAddToOrder}>Add to cart</Button></>
          </View>
        </View>
      </View>
    </Modal>
  </Screen>;
}
