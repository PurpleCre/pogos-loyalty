import { useCallback, useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';
import { accessTokenFor } from '@/lib/cash-orders';
import { rewardRecovery, submitRewardCommand, rewardError } from '@/lib/reward-orders';
import { offerSchema, type RewardOffer, type RewardRequest, type PendingRewardCommand } from '@/lib/reward-redemption';
import type { Tables } from '@/lib/types';

export type RewardReservation = Tables<'reward_reservations'> & {
  fulfilments: Tables<'reward_fulfilments'>[]; voids: Tables<'reward_voids'>[]; events: Tables<'reward_events'>[];
};
const staffSelect = '*, fulfilments:reward_fulfilments(*), voids:reward_voids(*), events:reward_events(*)';
const normalise = (value: unknown): RewardReservation => {
  const row = value as RewardReservation;
  const list = <T,>(input: T | T[] | null | undefined): T[] => input ? Array.isArray(input) ? input : [input] : [];
  return { ...row, fulfilments: list(row.fulfilments), voids: list(row.voids), events: list(row.events) };
};
interface State {
  scope: string; reservations: RewardReservation[]; offers: RewardOffer[]; balance: Tables<'user_points'> | null;
  reviewed: boolean; error: string; more: boolean;
}
const empty = (scope: string): State => ({ scope, reservations: [], offers: [], balance: null, reviewed: false, error: '', more: false });
export function useRewardReservations(branchId: string | null, staffView = false, enabled = true) {
  const { user, userRole } = useAuth();
  const owner = user?.id ?? null;
  const scope = `${owner}:${userRole}:${staffView}:${branchId}`;
  const current = useRef(scope); current.current = scope;
  const currentOwner = useRef(owner); currentOwner.current = owner;
  const revision = useRef(0);
  const located = useRef<{ scope: string; ids: string[] }>({ scope, ids: [] });
  if (located.current.scope !== scope) located.current = { scope, ids: [] };
  const [limit, setLimit] = useState(50);
  const [state, setState] = useState<State>(() => empty(scope));
  const [loading, setLoading] = useState(false);
  const [pendingState, setPending] = useState<{ owner: string; command: PendingRewardCommand | null; error: string } | null>(null);
  const [busyOwner, setBusy] = useState<string | null>(null);
  const refreshPending = useCallback(async () => {
    if (!owner) return;
    try {
      const command = await rewardRecovery.load(owner);
      if (currentOwner.current === owner) setPending({ owner, command, error: '' });
    } catch (error) { if (currentOwner.current === owner) setPending({ owner, command: null, error: rewardError(error) }); }
  }, [owner]);
  const refresh = useCallback(async () => {
    if (!enabled || !owner || current.current !== scope || (staffView && (!branchId || !['admin', 'staff'].includes(userRole)))) return;
    const version = ++revision.current;
    setLoading(true);
    try {
      const token = await accessTokenFor(owner); const bearer = `Bearer ${token}`;
      let active = supabase.from('reward_reservations').select(staffView ? staffSelect : '*').in('status', ['reserved', 'claiming']).order('created_at');
      active = staffView ? active.eq('store_id', branchId!) : active.eq('user_id', owner);
      const [activeResult, extra, offers, points, account] = await Promise.all([
        active.limit(staffView ? limit + 1 : 1000).setHeader('Authorization', bearer),
        staffView ? located.current.ids.length ? supabase.from('reward_reservations').select(staffSelect).eq('store_id', branchId!).in('id', located.current.ids).setHeader('Authorization', bearer) : Promise.resolve({ data: [], error: null }) :
          supabase.from('reward_reservations').select('*').eq('user_id', owner).not('status', 'in', '(reserved,claiming)').order('created_at', { ascending: false }).limit(limit + 1).setHeader('Authorization', bearer),
        !staffView && branchId ? supabase.rpc('list_reward_offers', { p_store_id: branchId }).setHeader('Authorization', bearer) : Promise.resolve({ data: [], error: null }),
        supabase.from('user_points').select('*').eq('user_id', owner).maybeSingle().setHeader('Authorization', bearer),
        supabase.from('loyalty_accounts').select('opening_reviewed').eq('user_id', owner).maybeSingle().setHeader('Authorization', bearer),
      ]);
      for (const result of [activeResult, extra, offers, points, account]) if (result.error) throw result.error;
      if (current.current !== scope || version !== revision.current) return;
      const activeRows = (activeResult.data ?? []).slice(0, staffView ? limit : 1000).map(normalise);
      const otherRows = (extra.data ?? []).slice(0, staffView ? 1000 : limit).map(normalise);
      const combined = new Map([...activeRows, ...otherRows].map(row => [row.id, row]));
      setState({ scope, reservations: [...combined.values()], offers: z.array(offerSchema).parse(offers.data), balance: points.data,
        reviewed: account.data?.opening_reviewed ?? false, error: '', more: staffView ? (activeResult.data?.length ?? 0) > limit : (extra.data?.length ?? 0) > limit });
    } catch (error) {
      if (current.current === scope && version === revision.current) setState(previous => ({ ...(previous.scope === scope ? previous : empty(scope)), error: rewardError(error) }));
    } finally { if (current.current === scope && version === revision.current) setLoading(false); }
  }, [branchId, owner, scope, enabled, staffView, userRole, limit]);
  useEffect(() => { void refreshPending(); }, [refreshPending]);
  useEffect(() => {
    if (!enabled || !owner) return;
    void refresh();
    const timer = setInterval(() => { void refresh(); }, 15000);
    const channel = supabase.channel(`reward:${scope}`).on('postgres_changes', {
      event: '*', schema: 'public', table: 'reward_reservations', filter: staffView ? `store_id=eq.${branchId}` : `user_id=eq.${owner}`,
    }, () => { void refresh(); }).subscribe();
    return () => { clearInterval(timer); void supabase.removeChannel(channel); revision.current++; };
  }, [enabled, owner, scope, branchId, staffView, refresh]);
  const execute = async (request: RewardRequest) => {
    if (!owner) throw new Error('Sign in to use rewards.');
    setBusy(owner);
    try { return await rewardRecovery.execute(owner, request, command => submitRewardCommand(owner, command)); }
    finally { if (currentOwner.current === owner) setBusy(null); await refreshPending(); await refresh(); }
  };
  const recover = async () => {
    if (!owner) return;
    setBusy(owner);
    try { return await rewardRecovery.recover(owner, command => submitRewardCommand(owner, command)); }
    finally { if (currentOwner.current === owner) setBusy(null); await refreshPending(); await refresh(); }
  };
  const findReservation = async (id: string) => {
    if (!owner || !branchId || !staffView) return;
    id = z.uuid().parse(id.trim());
    const token = await accessTokenFor(owner);
    const { data, error } = await supabase.from('reward_reservations').select(staffSelect).eq('store_id', branchId).eq('id', id).single().setHeader('Authorization', `Bearer ${token}`);
    if (error) throw error;
    if (current.current === scope) {
      located.current.ids = [id, ...located.current.ids.filter(value => value !== id)].slice(0, 20);
      setState(previous => ({ ...(previous.scope === scope ? previous : empty(scope)),
        reservations: [normalise(data), ...(previous.scope === scope ? previous.reservations.filter(row => row.id !== id) : [])] }));
    }
  };
  const visible = state.scope === scope ? state : empty(scope);
  return { ...visible, loading, execute, recover, refresh, findReservation, loadMore: () => setLimit(value => value + 50),
    pending: pendingState?.owner === owner ? pendingState.command : null,
    pendingError: pendingState?.owner === owner ? pendingState.error : '', busy: !!owner && busyOwner === owner };
}
