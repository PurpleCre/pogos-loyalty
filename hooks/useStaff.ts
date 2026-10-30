import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { Tables } from '@/lib/types';
import { accessTokenFor } from '@/lib/cash-orders';
import { branchSummarySchema, rosterSchema, staffRecovery, submitStaffCommand, staffError, type BranchStaff, type BranchSummary } from '@/lib/staff-orders';
import type { PendingStaffCommand, StaffCommand } from '@/lib/staff-commands';
import { z } from 'zod';

export type StaffOrder = Tables<'orders'> & {
  order_items: Tables<'order_items'>[];
  receipt: Tables<'cash_receipts'> | null;
  events: Tables<'order_status_events'>[];
};
// Retained for the catalogue component; branch availability is a later milestone.
export type StaffMenuItem = Tables<'menu_items'> & { category?: { name: string } };
const selection = '*, order_items(*), receipt:cash_receipts(*), events:order_status_events(*)';
function normaliseOrder(row: unknown): StaffOrder {
  const value = row as StaffOrder;
  return { ...value, receipt: Array.isArray(value.receipt) ? value.receipt[0] ?? null : value.receipt };
}
export function useStaff(branchId: string | null, enabled = true) {
  const { user, userRole } = useAuth();
  const owner = user?.id ?? null;
  const scope = `${owner}:${branchId}`;
  const current = useRef(scope); current.current = scope;
  const currentOwner = useRef(owner); currentOwner.current = owner;
  const request = useRef(0);
  const located = useRef<{ scope: string; ids: string[] }>({ scope, ids: [] });
  if (located.current.scope !== scope) located.current = { scope, ids: [] };
  const [state, setState] = useState<{ scope: string; orders: StaffOrder[]; roster: BranchStaff[]; summary: BranchSummary | null; error: string; hasMore: boolean }>({ scope, orders: [], roster: [], summary: null, error: '', hasMore: false });
  const [limit, setLimit] = useState(100);
  const [loadingScope, setLoadingScope] = useState<string | null>(null);
  const [pendingState, setPending] = useState<{ owner: string; value: PendingStaffCommand | null; error: string } | null>(null);
  const [busyOwner, setBusy] = useState<string | null>(null);
  const visible = state.scope === scope ? state : { orders: [], roster: [], summary: null, error: '', hasMore: false };
  const pending = pendingState?.owner === owner ? pendingState.value : null;
  const pendingError = pendingState?.owner === owner ? pendingState.error : '';
  const refreshPending = useCallback(async () => {
    if (!owner) return;
    try {
      const value = await staffRecovery.load(owner);
      if (currentOwner.current === owner) setPending({ owner, value, error: '' });
    } catch (error) {
      if (currentOwner.current === owner) setPending({ owner, value: null, error: staffError(error) });
    }
  }, [owner]);
  const fetchStoreOrders = useCallback(async () => {
    if (!owner || !branchId || !enabled || !['admin', 'staff'].includes(userRole ?? '')) return;
    const revision = ++request.current;
    setLoadingScope(scope);
    try {
      const token = await accessTokenFor(owner);
      const headers = `Bearer ${token}`;
      const [orders, roster, summary] = await Promise.all([
        supabase.from('orders').select(selection).eq('store_id', branchId)
          .or(`status.in.(pending,accepted,preparing,ready,out_for_delivery),cash_custody_status.in.(held,handover_pending),loyalty_status.eq.awaiting_review${located.current.ids.length ? `,id.in.(${located.current.ids.join(',')})` : ''}`)
          .order('created_at', { ascending: true }).limit(limit + 1).setHeader('Authorization', headers),
        supabase.rpc('list_cash_branch_staff', { p_store_id: branchId }).setHeader('Authorization', headers),
        supabase.rpc('cash_branch_summary', { p_store_id: branchId }).setHeader('Authorization', headers),
      ]);
      if (orders.error) throw orders.error;
      if (roster.error) throw roster.error;
      if (summary.error) throw summary.error;
      if (current.current !== scope || request.current !== revision) return;
      setState({ scope, orders: (orders.data ?? []).slice(0, limit).map(normaliseOrder), roster: rosterSchema.parse(roster.data),
        summary: branchSummarySchema.parse(summary.data), error: '', hasMore: (orders.data?.length ?? 0) > limit });
    } catch (error) {
      if (current.current === scope && request.current === revision) setState(previous => ({
        ...(previous.scope === scope ? previous : { scope, orders: [], roster: [], summary: null, hasMore: false }), error: staffError(error),
      }));
    } finally { if (current.current === scope && request.current === revision) setLoadingScope(null); }
  }, [owner, branchId, enabled, userRole, scope, limit]);
  useEffect(() => { void refreshPending(); }, [refreshPending]);
  useEffect(() => {
    if (!enabled || !branchId || !owner || !['admin', 'staff'].includes(userRole ?? '')) return;
    void fetchStoreOrders();
    const timer = setInterval(() => { void fetchStoreOrders(); }, 15000);
    const channel = supabase.channel(`staff:${scope}`).on('postgres_changes', {
      event: '*', schema: 'public', table: 'orders', filter: `store_id=eq.${branchId}`,
    }, () => { void fetchStoreOrders(); }).subscribe();
    return () => { clearInterval(timer); void supabase.removeChannel(channel); request.current++; };
  }, [enabled, branchId, owner, userRole, scope, fetchStoreOrders]);
  const operate = async (command: StaffCommand) => {
    if (!owner) throw new Error('Sign in with your staff account.');
    setBusy(owner);
    try { return await staffRecovery.execute(owner, command, value => submitStaffCommand(owner, value)); }
    finally { if (currentOwner.current === owner) setBusy(null); await refreshPending(); await fetchStoreOrders(); }
  };
  const recover = async () => {
    if (!owner) return;
    setBusy(owner);
    try { await staffRecovery.recover(owner, value => submitStaffCommand(owner, value)); }
    finally { if (currentOwner.current === owner) setBusy(null); await refreshPending(); await fetchStoreOrders(); }
  };
  const findOrder = async (orderId: string) => {
    if (!owner || !branchId) return;
    orderId = z.uuid().parse(orderId.trim());
    const token = await accessTokenFor(owner);
    const { data, error } = await supabase.from('orders').select(selection).eq('store_id', branchId).eq('id', orderId.trim())
      .setHeader('Authorization', `Bearer ${token}`).single();
    if (error) throw error;
    if (current.current === scope) {
      if (!located.current.ids.includes(orderId)) located.current.ids.push(orderId);
      setState(previous => ({
        ...(previous.scope === scope ? previous : { scope, roster: [], summary: null, error: '', hasMore: false }),
        orders: [normaliseOrder(data), ...(previous.scope === scope ? previous.orders.filter(row => row.id !== orderId) : [])],
      }));
    }
  };
  return { orders: visible.orders, roster: visible.roster, summary: visible.summary, error: visible.error,
    isLoading: !!branchId && (state.scope !== scope || loadingScope === scope), hasMore: visible.hasMore,
    loadMore: () => setLimit(value => value + 100), fetchStoreOrders, operate, recover, findOrder,
    pending, pendingError, busy: busyOwner === owner && owner !== null };
}
