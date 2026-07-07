import React, { createContext, useContext, useState, useMemo } from 'react';

export interface CartItem {
  id: string; // unique id for cart entry, usually menu_item_id
  menu_item_id: string;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (item: Omit<CartItem, 'subtotal'>) => void;
  removeFromCart: (menuItemId: string) => void;
  updateQuantity: (menuItemId: string, quantity: number) => void;
  clearCart: () => void;
  cartTotal: number;
  itemCount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const addToCart = (newItem: Omit<CartItem, 'subtotal'>) => {
    setItems(prev => {
      const existing = prev.find(i => i.menu_item_id === newItem.menu_item_id);
      if (existing) {
        return prev.map(i => 
          i.menu_item_id === newItem.menu_item_id 
            ? { ...i, quantity: i.quantity + newItem.quantity, subtotal: (i.quantity + newItem.quantity) * i.price } 
            : i
        );
      }
      return [...prev, { ...newItem, subtotal: newItem.quantity * newItem.price }];
    });
  };

  const removeFromCart = (menuItemId: string) => {
    setItems(prev => prev.filter(i => i.menu_item_id !== menuItemId));
  };

  const updateQuantity = (menuItemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(menuItemId);
      return;
    }
    setItems(prev => prev.map(i => 
      i.menu_item_id === menuItemId 
        ? { ...i, quantity, subtotal: quantity * i.price } 
        : i
    ));
  };

  const clearCart = () => setItems([]);

  const cartTotal = useMemo(() => items.reduce((sum, item) => sum + item.subtotal, 0), [items]);
  const itemCount = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);

  return (
    <CartContext.Provider value={{
      items,
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
