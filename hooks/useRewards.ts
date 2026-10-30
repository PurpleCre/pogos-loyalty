import { useState, useEffect, useRef } from 'react';
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
    const { user } = useAuth();
    const [rewards, setRewards] = useState<Reward[]>([]);
    const accountId = user?.id ?? null;
    const currentAccount = useRef(accountId);
    currentAccount.current = accountId;
    const [pointsState, setPointsState] = useState<{ owner: string | null; value: UserPoints | null }>({ owner: accountId, value: null });
    const [historyState, setHistoryState] = useState<{ owner: string | null; value: Transaction[] }>({ owner: accountId, value: [] });
    const userPoints = pointsState.owner === accountId ? pointsState.value : null;
    const transactions = historyState.owner === accountId ? historyState.value : [];
    const setUserPoints = (value: UserPoints) => setPointsState({ owner: accountId, value });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(!!user);
        if (user) {
            fetchRewards();
            fetchUserPoints();
            fetchTransactions();
            const refresh = () => { void fetchUserPoints(); void fetchTransactions(); };
            const timer = setInterval(refresh, 15000);
            const channel = supabase.channel(`loyalty:${user.id}`)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'user_points', filter: `user_id=eq.${user.id}` }, refresh)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: `user_id=eq.${user.id}` }, refresh).subscribe();
            return () => { clearInterval(timer); void supabase.removeChannel(channel); };
        }
    }, [user]);

    const fetchRewards = async () => {
        try {
            const { data, error } = await supabase
                .from('rewards')
                .select('*')
                .eq('available', true)
                .order('points_cost');

            if (error) throw error;
            setRewards((data as Reward[]) || []);
        } catch (error) {
            console.error('Error fetching rewards:', error);
        }
    };

    const fetchUserPoints = async () => {
        if (!user) return;

        try {
            const { data, error } = await supabase
                .from('user_points')
                .select('*')
                .eq('user_id', user.id)
                .single();

            if (currentAccount.current !== accountId) return;
            if (error && error.code !== 'PGRST116') {
                console.error('Supabase error fetching points:', error);
            }

            if (data) {
                setUserPoints({
                    current_points: data.current_points ?? 0,
                    reserved_points: data.reserved_points,
                    total_earned: data.total_earned ?? 0,
                    total_redeemed: data.total_redeemed ?? 0
                });
            } else {
                setUserPoints({
                    current_points: 0,
                    reserved_points: 0,
                    total_earned: 0,
                    total_redeemed: 0
                });
            }
        } catch (err: any) {
            console.error('Exception fetching user points:', err?.message || err);
        } finally {
            if (currentAccount.current === accountId) setLoading(false);
        }
    };

    const fetchTransactions = async () => {
        if (!user) return;
        try {
            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(10);

            if (error) throw error;
            if (currentAccount.current === accountId) {
                setHistoryState({ owner: accountId, value: (data as Transaction[]) || [] });
            }
        } catch (error) {
            console.error('Error fetching transactions:', error);
        }
    };

    const sharePoints = async (_receiverEmail: string, _points: number) => ({
        error: 'Points sharing is not available yet.'
    });

    return {
        rewards,
        userPoints,
        transactions,
        loading,
        sharePoints,
        refetch: () => {
            fetchRewards();
            fetchUserPoints();
            fetchTransactions();
        }
    };
};
