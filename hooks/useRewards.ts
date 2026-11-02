import { logPrivateError } from '@/lib/privacy-logging';
import { useCallback, useEffect } from 'react';
import { useReadResource } from './useReadResource';
import { accessTokenFor } from '@/lib/cash-orders';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';

export interface Reward {
    id: string;
    name: string;
    description: string;
    points_cost: number;
    image_url?: string;
    category: 'food' | 'drink' | 'special';
    available: boolean;
}

export interface UserPoints {
    current_points: number;
    reserved_points: number;
    total_earned: number;
    total_redeemed: number;
}

export interface Transaction {
    id: string;
    amount: number;
    points_earned: number;
    points_redeemed: number;
    items: string[];
    transaction_type: 'purchase' | 'redemption' | 'refund' | 'reward_restore';
    currency?: string | null;
    amount_minor?: number | null;
    source?: 'app' | 'qr_scan' | 'gaap_pos' | 'admin' | 'referral' | 'gift';
    created_at: string;
}

export const useRewards = () => {
  const { user } = useAuth(); const owner = user?.id;
  const load = useCallback(async (signal: AbortSignal) => {
    if (!owner) return { userPoints: null, transactions: [] as Transaction[] };
    const token = await accessTokenFor(owner); const bearer = `Bearer ${token}`;
    const [points, history] = await Promise.all([
      supabase.from('user_points').select('*').eq('user_id', owner).abortSignal(signal).maybeSingle().setHeader('Authorization', bearer),
      supabase.from('transactions').select('*').eq('user_id', owner).order('created_at', { ascending: false }).limit(10).abortSignal(signal).setHeader('Authorization', bearer),
    ]);
    if (points.error) throw points.error; if (history.error) throw history.error;
    return { userPoints: points.data ? { current_points: points.data.current_points ?? 0, reserved_points: points.data.reserved_points,
      total_earned: points.data.total_earned ?? 0, total_redeemed: points.data.total_redeemed ?? 0 } : null, transactions: (history.data ?? []) as Transaction[] };
  }, [owner]);
  const resource = useReadResource(owner ?? 'guest', load, { enabled: !!owner });
  useEffect(() => {
    if (!owner) return;
    const refresh = () => { void resource.refetch(); };
    const channel = supabase.channel(`loyalty:${owner}`).on('postgres_changes', { event: '*', schema: 'public', table: 'user_points', filter: `user_id=eq.${owner}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: `user_id=eq.${owner}` }, refresh).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [owner, resource.refetch]);
  return { rewards: [] as Reward[], userPoints: resource.data?.userPoints ?? null, transactions: resource.data?.transactions ?? [],
    loading: resource.loading, fresh: resource.fresh, refreshedAt: resource.refreshedAt, error: resource.error,
    sharePoints: async (_email: string, _points: number) => ({ error: 'Points sharing is not available yet.' }), refetch: resource.refetch };
};
