import { useEffect, useCallback } from 'react';
import { useReadResource } from './useReadResource';
import { accessTokenFor } from '@/lib/cash-orders';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { Tables } from '@/lib/types';

export type OrderItem = Tables<'order_items'> & { menu_item?: { name: string } | null };
export type Order = Tables<'orders'> & { order_items?: OrderItem[] };
export const activeOrderStatuses = ['pending', 'accepted', 'preparing', 'ready', 'out_for_delivery'];
export function useOrders(isAdminView = false) {
  const { user, userRole, staffStoreIds } = useAuth();
  const owner = user?.id;
  const scope = `${owner}:${isAdminView}:${userRole}:${staffStoreIds.join(',')}`;
  const load = useCallback(async (signal: AbortSignal) => {
    if (!owner) return [];
    const token = await accessTokenFor(owner);
    let query = supabase.from('orders').select('*, order_items(*, menu_item:menu_items(name))').abortSignal(signal).setHeader('Authorization', `Bearer ${token}`);
    query = isAdminView ? query.in('status', activeOrderStatuses).order('created_at') : query.eq('user_id', owner).order('created_at', { ascending: false });
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as Order[];
  }, [owner, isAdminView]);
  const resource = useReadResource(scope, load, { enabled: !!owner && (!isAdminView || userRole === 'admin') });
  useEffect(() => {
    if (!owner) return;
    const channel = supabase.channel(`orders:${scope}`).on('postgres_changes', {
      event: '*', schema: 'public', table: 'orders', filter: isAdminView ? undefined : `user_id=eq.${owner}`,
    }, () => { void resource.refetch(); }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [owner, scope, isAdminView, resource.refetch]);
  const orders = resource.data ?? [];
  return { orders, activeOrders: orders.filter(row => activeOrderStatuses.includes(row.status)),
    pastOrders: orders.filter(row => ['completed', 'cancelled'].includes(row.status)), isLoading: resource.loading,
    error: resource.error ? 'Unable to refresh orders. The last displayed status may have changed.' : '', fresh: resource.fresh, refreshedAt: resource.refreshedAt, refetch: resource.refetch };
}
