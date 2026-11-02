import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { Tables } from '@/lib/types';
import { accessTokenFor } from '@/lib/cash-orders';
import { branchSummarySchema, rosterSchema, staffRecovery, submitStaffCommand, staffError, type BranchStaff, type BranchSummary } from '@/lib/staff-orders';
import type { PendingStaffCommand, StaffCommand } from '@/lib/staff-commands';
import { z } from 'zod';
import { AppState } from 'react-native';
import { branchSnapshotSchema, queueIsFresh, type BranchSnapshot } from '@/lib/branch-operations';

export type StaffOrder = Tables<'orders'> & {
  order_items: Tables<'order_items'>[];
  receipt: Tables<'cash_receipts'> | null;
  events: Tables<'order_status_events'>[];
};
export type StaffMenuItem = Tables<'menu_items'> & { category?: { name: string } };
const selection = '*, order_items(*), receipt:cash_receipts(*), events:order_status_events(*)';
function normaliseOrder(row: unknown): StaffOrder {
  const value = row as StaffOrder;
  return { ...value, receipt: Array.isArray(value.receipt) ? value.receipt[0] ?? null : value.receipt };
}
export function useStaff(branchId: string | null, enabled = true) {
  const { user, userRole } = useAuth();
  const [foreground, setForeground] = useState(AppState.currentState === 'active' || AppState.currentState === null);
  const [now, setNow] = useState(Date.now());
  const active = enabled && foreground;
  const activeRef = useRef(active); activeRef.current = active;
  const owner = user?.id ?? null;
  const scope = `${owner}:${branchId}`;
  const current = useRef(scope); current.current = scope;
  const currentOwner = useRef(owner); currentOwner.current = owner;
  const request = useRef(0);
  const located = useRef<{ scope: string; ids: string[] }>({ scope, ids: [] });
  if (located.current.scope !== scope) located.current = { scope, ids: [] };
  const empty = { orders: [] as StaffOrder[], roster: [] as BranchStaff[], summary: null as BranchSummary | null,
    operations: null as BranchSnapshot | null, lastSuccess: null as number | null, error: '', hasMore: false };
  const [state, setState] = useState<{ scope: string } & typeof empty>({ scope, ...empty });
  const [limit, setLimit] = useState(100);
  const [loadingScope, setLoadingScope] = useState<string | null>(null);
  const [pendingState, setPending] = useState<{ owner: string; value: PendingStaffCommand | null; error: string } | null>(null);
  const [busyOwner, setBusy] = useState<string | null>(null);
  const visible = state.scope === scope ? state : empty;
  const inFlight = useRef<{ key: string; promise: Promise<void>; revision: number } | null>(null);
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
  useEffect(() => {
    const subscription = AppState.addEventListener('change', next => {
      if (next !== 'active') { activeRef.current = false; request.current++; }
      setForeground(next === 'active'); setNow(Date.now());
    });
    return () => subscription.remove();
  }, []);
  const fetchStoreOrders = useCallback((): Promise<void> => {
    if (!owner || !branchId || !active || !activeRef.current || !['admin', 'staff', 'manager'].includes(userRole ?? '')) return Promise.resolve();
    const key = `${scope}:${limit}`;
    if (inFlight.current?.key === key) return inFlight.current.promise;
    const revision = ++request.current;
    const promise: Promise<void> = (async () => {
    setLoadingScope(scope);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const token = await accessTokenFor(owner);
      const headers = `Bearer ${token}`;
      const [orders, roster, summary, operations] = await Promise.all([
        supabase.from('orders').select(selection).eq('store_id', branchId)
          .or(`status.in.(pending,accepted,preparing,ready,out_for_delivery),cash_custody_status.in.(held,handover_pending),loyalty_status.eq.awaiting_review${located.current.ids.length ? `,id.in.(${located.current.ids.join(',')})` : ''}`)
          .order('created_at', { ascending: true }).order('id').limit(limit + 1).setHeader('Authorization', headers).abortSignal(controller.signal),
        supabase.rpc('list_cash_branch_staff', { p_store_id: branchId }).setHeader('Authorization', headers).abortSignal(controller.signal),
        supabase.rpc('cash_branch_summary', { p_store_id: branchId }).setHeader('Authorization', headers).abortSignal(controller.signal),
        supabase.rpc('get_branch_operations', { p_store_id: branchId }).setHeader('Authorization', headers).abortSignal(controller.signal),
      ]);
      if (orders.error) throw orders.error;
      if (roster.error) throw roster.error;
      if (summary.error) throw summary.error;
      if (operations.error) throw operations.error;
      const snapshot = branchSnapshotSchema.parse(operations.data);
      if (snapshot.store_id !== branchId) throw new Error('Branch response could not be confirmed.');
      if (current.current !== scope || request.current !== revision || !activeRef.current) return;
      const time = Date.now(); setNow(time);
      setState({ scope, orders: (orders.data ?? []).slice(0, limit).map(normaliseOrder), roster: rosterSchema.parse(roster.data),
        summary: branchSummarySchema.parse(summary.data), operations: snapshot, lastSuccess: time, error: '', hasMore: (orders.data?.length ?? 0) > limit });
    } catch (error) {
      const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
      const accessDenied = code === '42501' || /^PGRST30[123]$/.test(code);
      if (current.current === scope && request.current === revision) setState(previous => ({
        ...(!accessDenied && previous.scope === scope ? previous : { scope, ...empty }), error: staffError(error),
      }));
    } finally {
      clearTimeout(timeout);
      if (inFlight.current?.revision === revision) inFlight.current = null;
      if (current.current === scope && request.current === revision) setLoadingScope(null);
    }
    })();
    inFlight.current = { key, promise, revision };
    return promise;
  }, [owner, branchId, active, userRole, scope, limit]);
  useEffect(() => { void refreshPending(); }, [refreshPending]);
  useEffect(() => {
    if (!active || !branchId || !owner || !['admin', 'staff', 'manager'].includes(userRole ?? '')) return;
    void fetchStoreOrders();
    const timer = setInterval(() => { void fetchStoreOrders(); }, 15000);
    const clock = setInterval(() => setNow(Date.now()), 5000);
    const channel = supabase.channel(`staff:${scope}`).on('postgres_changes', {
      event: '*', schema: 'public', table: 'orders', filter: `store_id=eq.${branchId}`,
    }, () => { void fetchStoreOrders(); }).subscribe(status => {
      if (status === 'SUBSCRIBED') void fetchStoreOrders();
    });
    return () => {
      clearInterval(timer); clearInterval(clock); void supabase.removeChannel(channel); request.current++;
      inFlight.current = null;
      setState(previous => ({ ...previous, lastSuccess: null }));
    };
  }, [active, branchId, owner, userRole, scope, fetchStoreOrders]);
  const fresh = queueIsFresh(visible.lastSuccess, now, active, visible.error);
  const operate = async (command: StaffCommand) => {
    if (!owner) throw new Error('Sign in with your staff account.');
    if (!fresh) throw new Error('Refresh the branch queue before making a change.');
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
        ...(previous.scope === scope ? previous : { scope, ...empty }),
        orders: [normaliseOrder(data), ...(previous.scope === scope ? previous.orders.filter(row => row.id !== orderId) : [])],
      }));
    }
  };
  return { orders: visible.orders, roster: visible.roster, summary: visible.summary, operations: visible.operations,
    fresh, foreground, lastSuccess: visible.lastSuccess, error: visible.error,
    isLoading: !!branchId && (state.scope !== scope || loadingScope === scope), hasMore: visible.hasMore,
    loadMore: () => setLimit(value => value + 100), fetchStoreOrders, operate, recover, findOrder,
    pending, pendingError, pendingReady: pendingState?.owner === owner, busy: busyOwner === owner && owner !== null };
}
