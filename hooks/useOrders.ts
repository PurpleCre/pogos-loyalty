import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { Tables } from '@/lib/types';

export type OrderItem = Tables<'order_items'> & { menu_item?: { name: string } | null };
export type Order = Tables<'orders'> & { order_items?: OrderItem[] };
export const activeOrderStatuses = ['pending', 'accepted', 'preparing', 'ready', 'out_for_delivery'];
export function useOrders(isAdminView = false) {
  const { user, userRole } = useAuth();
  const owner = user?.id;
  const scope = `${owner}:${isAdminView}:${userRole}`;
  const current = useRef(scope); current.current = scope;
  const [state, setState] = useState<{ scope: string; orders: Order[] }>({ scope, orders: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const orders = state.scope === scope ? state.orders : [];
  const fetchOrders = useCallback(async () => {
    if (!owner || (isAdminView && userRole !== 'admin')) { setLoading(false); return; }
    try {
      let query = supabase.from('orders').select('*, order_items(*, menu_item:menu_items(name))');
      query = isAdminView ? query.in('status', activeOrderStatuses).order('created_at') :
        query.eq('user_id', owner).order('created_at', { ascending: false });
      const { data, error: failure } = await query;
      if (failure) throw failure;
      if (current.current === scope) { setState({ scope, orders: (data ?? []) as Order[] }); setError(''); }
    } catch {
      if (current.current === scope) setError('Unable to refresh orders. Please try again.');
    } finally { if (current.current === scope) setLoading(false); }
  }, [owner, isAdminView, userRole, scope]);
  useEffect(() => {
    setLoading(!!owner);
    void fetchOrders();
    if (!owner) return;
    const timer = setInterval(() => { void fetchOrders(); }, 15000);
    const channel = supabase.channel(`orders:${scope}`).on('postgres_changes', {
      event: '*', schema: 'public', table: 'orders', filter: isAdminView ? undefined : `user_id=eq.${owner}`,
    }, () => { void fetchOrders(); }).subscribe();
    return () => { clearInterval(timer); void supabase.removeChannel(channel); };
  }, [owner, scope, isAdminView, fetchOrders]);
  return { orders, activeOrders: orders.filter(row => activeOrderStatuses.includes(row.status)),
    pastOrders: orders.filter(row => ['completed', 'cancelled'].includes(row.status)), isLoading: loading, error, refetch: fetchOrders };
}
