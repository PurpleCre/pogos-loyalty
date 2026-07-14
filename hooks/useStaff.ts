import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

export interface StaffOrder {
  id: string;
  user_id: string;
  status: 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled';
  total_amount: number;
  points_earned: number;
  store_id: string;
  created_at: string;
  order_items?: {
    id: string;
    quantity: number;
    unit_price: number;
    menu_item?: { name: string };
  }[];
  user?: {
    full_name: string;
    email: string;
  };
}

export interface StaffMenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
  category_id: string;
  store_id: string | null;
  category?: { name: string };
}

export function useStaff() {
  const { session, staffStoreId } = useAuth();
  const [orders, setOrders] = useState<StaffOrder[]>([]);
  const [menuItems, setMenuItems] = useState<StaffMenuItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [menuLoading, setMenuLoading] = useState(true);
  const [stats, setStats] = useState({
    todayTotal: 0,
    pendingCount: 0,
    preparingCount: 0,
    completedToday: 0,
  });

  const fetchStoreOrders = async () => {
    if (!session?.user || !staffStoreId) return;
    setIsLoading(true);

    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            id, quantity, unit_price,
            menu_item:menu_items (name)
          ),
          user:profiles (full_name, email)
        `)
        .eq('store_id', staffStoreId)
        .in('status', ['pending', 'preparing', 'ready'])
        .order('created_at', { ascending: true });

      if (error) throw error;
      setOrders((data as any) || []);

      // Calculate stats
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data: todayOrders } = await supabase
        .from('orders')
        .select('id, status, total_amount')
        .eq('store_id', staffStoreId)
        .gte('created_at', today.toISOString());

      if (todayOrders) {
        setStats({
          todayTotal: todayOrders.length,
          pendingCount: todayOrders.filter(o => o.status === 'pending').length,
          preparingCount: todayOrders.filter(o => o.status === 'preparing').length,
          completedToday: todayOrders.filter(o => o.status === 'completed').length,
        });
      }
    } catch (error) {
      console.error('Error fetching store orders:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStoreMenuItems = async () => {
    if (!session?.user) return;
    setMenuLoading(true);

    try {
      // Fetch items that belong to this store OR are global (store_id IS NULL)
      let query = supabase
        .from('menu_items')
        .select(`
          *,
          category:menu_categories (name)
        `)
        .order('name', { ascending: true });

      if (staffStoreId) {
        query = query.or(`store_id.eq.${staffStoreId},store_id.is.null`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setMenuItems((data as any) || []);
    } catch (error) {
      console.error('Error fetching menu items:', error);
    } finally {
      setMenuLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, status: StaffOrder['status']) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', orderId);

      if (error) throw error;
      
      // Update local state immediately
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
      
      // Refresh stats
      await fetchStoreOrders();
    } catch (error) {
      console.error('Error updating order status:', error);
      throw error;
    }
  };

  const toggleMenuItemAvailability = async (itemId: string, isAvailable: boolean) => {
    try {
      const { error } = await supabase
        .from('menu_items')
        .update({ is_available: isAvailable, updated_at: new Date().toISOString() })
        .eq('id', itemId);

      if (error) throw error;
      
      setMenuItems(prev => 
        prev.map(item => item.id === itemId ? { ...item, is_available: isAvailable } : item)
      );
    } catch (error) {
      console.error('Error toggling menu item:', error);
      throw error;
    }
  };

  useEffect(() => {
    if (staffStoreId) {
      fetchStoreOrders();
      fetchStoreMenuItems();

      // Real-time subscription for orders at this store
      const subscription = supabase
        .channel('staff_orders_channel')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `store_id=eq.${staffStoreId}`
        }, () => {
          fetchStoreOrders();
        })
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [session?.user?.id, staffStoreId]);

  return {
    orders,
    activeOrders: orders.filter(o => ['pending', 'preparing', 'ready'].includes(o.status)),
    menuItems,
    stats,
    isLoading,
    menuLoading,
    fetchStoreOrders,
    fetchStoreMenuItems,
    updateOrderStatus,
    toggleMenuItemAvailability,
  };
}
