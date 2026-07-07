import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;
  quantity: number;
  unit_price: number;
  menu_item?: {
    name: string;
  };
}

export interface Order {
  id: string;
  user_id: string;
  status: 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled';
  total_amount: number;
  points_earned: number;
  created_at: string;
  order_items?: OrderItem[];
  user?: {
    full_name: string;
    email: string;
  };
}

export function useOrders(isAdminView = false) {
  const { session } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchOrders = async () => {
    if (!session?.user) return;
    setIsLoading(true);

    try {
      let query = supabase
        .from('orders')
        .select(`
          *,
          order_items (
            id, quantity, unit_price,
            menu_item:menu_items (name)
          )
        `)
        .order('created_at', { ascending: false });

      if (isAdminView) {
        // Admin gets all active/recent orders, join with user data
        query = supabase
          .from('orders')
          .select(`
            *,
            order_items (
              id, quantity, unit_price,
              menu_item:menu_items (name)
            ),
            user:profiles (full_name, email)
          `)
          .in('status', ['pending', 'preparing', 'ready'])
          .order('created_at', { ascending: true }); // Oldest first for fulfillment
      } else {
        // Normal user gets only their orders
        query = query.eq('user_id', session.user.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      setOrders(data as any);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, status: Order['status']) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', orderId);

      if (error) throw error;

      // If completed, we should ideally award points. For now, doing it naively here or via a Supabase trigger.
      // A trigger is much safer!

      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
    } catch (error) {
      console.error('Error updating order status:', error);
      throw error;
    }
  };

  useEffect(() => {
    fetchOrders();

    // Set up realtime subscription
    const subscription = supabase
      .channel('orders_channel')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'orders',
        filter: isAdminView ? undefined : `user_id=eq.${session?.user?.id}`
      }, () => {
        fetchOrders();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [session?.user?.id, isAdminView]);

  return {
    orders,
    activeOrders: orders.filter(o => ['pending', 'preparing', 'ready'].includes(o.status)),
    pastOrders: orders.filter(o => ['completed', 'cancelled'].includes(o.status)),
    isLoading,
    refetch: fetchOrders,
    updateOrderStatus
  };
}
