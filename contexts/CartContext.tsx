import React, { createContext, useContext, useState, useMemo, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { useAuth } from '@/hooks/useAuth';

import { cartForAccount, mergeCartItem, type CartItem, type CartState } from '@/lib/cart';
export type { CartItem } from '@/lib/cart';

interface CartContextType {
  items: CartItem[];
  storeId: string | null;
  addToCart: (item: Omit<CartItem, 'id' | 'subtotal'>, newStoreId: string) => void;
  removeFromCart: (lineId: string) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  clearCart: () => void;
  cartTotal: number;
  itemCount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const owner = user?.id ?? null;
  const currentOwner = useRef(owner);
  currentOwner.current = owner;
  const [state, setState] = useState<CartState>({ owner, items: [], storeId: null });
  const { items, storeId } = cartForAccount(state, owner);
  const setItems = (update: CartItem[] | ((previous: CartItem[]) => CartItem[])) => {
    if (currentOwner.current !== owner) return;
    setState(previous => {
      const current = cartForAccount(previous, owner);
      const next = typeof update === 'function' ? update(current.items) : update;
      return { ...current, items: next, storeId: next.length === 0 ? null : current.storeId };
    });
  };
  const setStoreId = (value: string | null) => {
    if (currentOwner.current === owner) setState(previous => ({ ...cartForAccount(previous, owner), storeId: value }));
  };

  useEffect(() => {
    setState(previous => cartForAccount(previous, owner));
  }, [owner]);

  const addToCart = (newItem: Omit<CartItem, 'id' | 'subtotal'>, newStoreId: string) => {
    if (!newStoreId || !Number.isInteger(newItem.quantity) || newItem.quantity < 1 || newItem.quantity > 99) return;
    if (storeId && storeId !== newStoreId && items.length > 0) {
      Alert.alert(
        'Start new order?',
        'Your cart contains items from another store. Do you want to clear it and start a new order?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Start New Order', 
            style: 'destructive',
            onPress: () => {
              if (currentOwner.current !== owner) return;
              setStoreId(newStoreId);
              setItems(mergeCartItem([], newItem));
            }
          }
        ]
      );
      return;
    }

    if (!storeId || items.length === 0) {
      setStoreId(newStoreId);
    }

    setItems(prev => {
      const current = prev.find(item => item.menu_item_id === newItem.menu_item_id &&
        [...item.choice_ids].sort().join(',') === [...newItem.choice_ids].sort().join(','));
      if ((current?.quantity ?? 0) + newItem.quantity > 99) return prev;
      return mergeCartItem(prev, newItem);
    });
  };

  const removeFromCart = (lineId: string) => {
    setItems(prev => prev.filter(item => item.id !== lineId));
  };

  const updateQuantity = (lineId: string, quantity: number) => {
    if (quantity <= 0) { removeFromCart(lineId); return; }
    if (!Number.isInteger(quantity) || quantity > 99) return;
    setItems(prev => prev.map(item => item.id === lineId
      ? { ...item, quantity, subtotal: quantity * item.price } : item));
  };

  const clearCart = () => {
    setItems([]);
    setStoreId(null);
  };

  const cartTotal = useMemo(() => items.reduce((sum, item) => sum + item.subtotal, 0), [items]);
  const itemCount = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);

  return (
    <CartContext.Provider value={{
      items,
      storeId,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      cartTotal,
      itemCount
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
