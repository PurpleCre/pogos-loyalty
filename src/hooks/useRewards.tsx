import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useOffline } from './useOffline';
import { toast } from 'sonner';

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
  total_earned: number;
  total_redeemed: number;
}

export interface Transaction {
  id: string;
  amount: number;
  points_earned: number;
  points_redeemed: number;
  items: string[];
  transaction_type: 'purchase' | 'redemption';
  created_at: string;
}

export const useRewards = () => {
  const { user } = useAuth();
  const { isOnline, saveOfflineData, getOfflineData, addPendingAction } = useOffline();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [userPoints, setUserPoints] = useState<UserPoints | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchRewards();
      fetchUserPoints();
      fetchTransactions();
    }
  }, [user]);

  const fetchRewards = async () => {
    try {
      if (!isOnline) {
        const cached = getOfflineData('rewards');
        if (cached) {
          setRewards(cached);
          return;
        }
      }

      const { data, error } = await supabase
        .from('rewards')
        .select('*')
        .eq('available', true)
        .order('points_cost');

      if (error) throw error;
      setRewards((data as Reward[]) || []);
      saveOfflineData('rewards', data || []);
    } catch (error) {
      console.error('Error fetching rewards:', error);
      const cached = getOfflineData('rewards');
      if (cached) {
        setRewards(cached);
        toast.info('Showing cached rewards (offline)');
      }
    }
  };

  const fetchUserPoints = async () => {
    if (!user) return;

    try {
      if (!isOnline) {
        const cached = getOfflineData('userPoints');
        if (cached) {
          setUserPoints(cached);
          setLoading(false);
          return;
        }
      }

      const { data, error } = await supabase
        .from('user_points')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      setUserPoints(data);
      saveOfflineData('userPoints', data);
    } catch (error) {
      console.error('Error fetching user points:', error);
      const cached = getOfflineData('userPoints');
      if (cached) {
        setUserPoints(cached);
        toast.info('Showing cached points (offline)');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async () => {
    if (!user) return;

    try {
      if (!isOnline) {
        const cached = getOfflineData('transactions');
        if (cached) {
          setTransactions(cached);
          return;
        }
      }

      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setTransactions((data as Transaction[]) || []);
      saveOfflineData('transactions', data || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      const cached = getOfflineData('transactions');
      if (cached) {
        setTransactions(cached);
        toast.info('Showing cached transactions (offline)');
      }
    }
  };

  const redeemReward = async (rewardId: string, pointsCost: number) => {
    if (!user || !userPoints || userPoints.current_points < pointsCost) {
      return { error: 'Insufficient points' };
    }

    if (!isOnline) {
      addPendingAction({ type: 'redeem', rewardId, pointsCost, userId: user.id });
      toast.info('Reward will be redeemed when back online');
      return { error: null };
    }

    try {
      // Get reward details
      const { data: reward, error: rewardError } = await supabase
        .from('rewards')
        .select('*')
        .eq('id', rewardId)
        .single();

      if (rewardError) throw rewardError;

      // Create transaction
      const { error: transactionError } = await supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          amount: 0,
          points_redeemed: pointsCost,
          items: [reward.name],
          transaction_type: 'redemption'
        });

      if (transactionError) throw transactionError;

      // Update user points
      const { error: pointsError } = await supabase
        .from('user_points')
        .update({
          current_points: userPoints.current_points - pointsCost,
          total_redeemed: userPoints.total_redeemed + pointsCost
        })
        .eq('user_id', user.id);

      if (pointsError) throw pointsError;

      // Refresh data
      fetchUserPoints();
      fetchTransactions();

      return { error: null };
    } catch (error) {
      console.error('Error redeeming reward:', error);
      return { error: 'Failed to redeem reward' };
    }
  };

  const addPoints = async (points: number, amount: number, items: string[]) => {
    if (!user) return { error: 'User not authenticated' };

    if (!isOnline) {
      addPendingAction({ type: 'addPoints', points, amount, items, userId: user.id });
      toast.info('Points will be added when back online');
      return { error: null };
    }

    try {
      // Create transaction
      const { error: transactionError } = await supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          amount,
          points_earned: points,
          items,
          transaction_type: 'purchase'
        });

      if (transactionError) throw transactionError;

      // Update or insert user points
      const currentPoints = userPoints?.current_points || 0;
      const totalEarned = userPoints?.total_earned || 0;

      const { error: pointsError } = await supabase
        .from('user_points')
        .upsert({
          user_id: user.id,
          current_points: currentPoints + points,
          total_earned: totalEarned + points,
          total_redeemed: userPoints?.total_redeemed || 0
        });

      if (pointsError) throw pointsError;

      // Refresh data
      fetchUserPoints();
      fetchTransactions();

      return { error: null };
    } catch (error) {
      console.error('Error adding points:', error);
      return { error: 'Failed to add points' };
    }
  };

  return {
    rewards,
    userPoints,
    transactions,
    loading,
    redeemReward,
    addPoints,
    refetch: () => {
      fetchRewards();
      fetchUserPoints();
      fetchTransactions();
    }
  };
};