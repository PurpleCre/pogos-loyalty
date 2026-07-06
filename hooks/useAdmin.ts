import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  current_points: number;
  total_earned: number;
  total_redeemed: number;
  created_at: string;
  role: string;
}

interface AdminReward {
  id: string;
  name: string;
  description: string | null;
  points_cost: number;
  category: string;
  available: boolean | null;
  image_url?: string | null;
  created_at: string | null;
}

interface AdminTransaction {
  id: string;
  user_id: string;
  user_email: string;
  transaction_type: string;
  amount: number;
  points_earned: number;
  points_redeemed: number;
  items: string[];
  created_at: string;
}

export const useAdmin = () => {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [rewards, setRewards] = useState<AdminReward[]>([]);
  const [transactions, setTransactions] = useState<AdminTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Check if current user is admin
  useEffect(() => {
    const checkAdminRole = async () => {
      if (!user) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .single();

      setIsAdmin(!error && data?.role === 'admin');
      setLoading(false);
    };

    checkAdminRole();
  }, [user]);

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        id,
        email,
        full_name,
        created_at,
        user_points (
          current_points,
          total_earned,
          total_redeemed
        ),
        user_roles (
          role
        )
      `)
      .order('created_at', { ascending: false });

    if (!error && data) {
      const formattedUsers = data.map(u => ({
        id: u.id,
        email: u.email || '',
        full_name: u.full_name || '',
        current_points: (u.user_points as any)?.[0]?.current_points || (u.user_points as any)?.current_points || 0,
        total_earned: (u.user_points as any)?.[0]?.total_earned || (u.user_points as any)?.total_earned || 0,
        total_redeemed: (u.user_points as any)?.[0]?.total_redeemed || (u.user_points as any)?.total_redeemed || 0,
        created_at: u.created_at || '',
        role: (u.user_roles?.[0] as any)?.role || 'user'
      }));
      setUsers(formattedUsers as any);
    }
  };

  const fetchRewards = async () => {
    const { data, error } = await supabase
      .from('rewards')
      .select('*')
      .order('points_cost', { ascending: true });

    if (!error && data) {
      setRewards(data);
    }
  };

  const fetchTransactions = async () => {
    const { data, error } = await supabase
      .from('transactions')
      .select(`
        *,
        profiles (
          email
        )
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (!error && data) {
      const formattedTransactions = data.map(transaction => ({
        id: transaction.id,
        user_id: transaction.user_id || '',
        user_email: (transaction.profiles as any)?.email || '',
        transaction_type: transaction.transaction_type,
        amount: transaction.amount || 0,
        points_earned: transaction.points_earned || 0,
        points_redeemed: transaction.points_redeemed || 0,
        items: transaction.items || [],
        created_at: transaction.created_at || ''
      }));
      setTransactions(formattedTransactions);
    }
  };

  const createReward = async (reward: Omit<AdminReward, 'id' | 'created_at'>) => {
    const { error } = await supabase
      .from('rewards')
      .insert([reward]);

    if (!error) {
      await fetchRewards();
    }
    return { error };
  };

  const updateReward = async (id: string, updates: Partial<AdminReward>) => {
    const { error } = await supabase
      .from('rewards')
      .update(updates)
      .eq('id', id);

    if (!error) {
      await fetchRewards();
    }
    return { error };
  };

  const deleteReward = async (id: string) => {
    const { error } = await supabase
      .from('rewards')
      .delete()
      .eq('id', id);

    if (!error) {
      await fetchRewards();
    }
    return { error };
  };

  const makeUserAdmin = async (userId: string) => {
    const { error } = await supabase
      .from('user_roles')
      .insert([{ user_id: userId, role: 'admin' }]);

    if (!error) {
      await fetchUsers();
    }
    return { error };
  };

  const removeUserAdmin = async (userId: string) => {
    const { error } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId)
      .eq('role', 'admin');

    if (!error) {
      await fetchUsers();
    }
    return { error };
  };

  const adjustUserPoints = async (userId: string, pointsChange: number, reason: string) => {
    const { data: currentData } = await supabase
      .from('user_points')
      .select('current_points, total_earned, total_redeemed')
      .eq('user_id', userId)
      .single();

    if (!currentData) return { error: 'User not found' };

    const current_points = currentData.current_points || 0;
    const total_earned = currentData.total_earned || 0;
    const total_redeemed = currentData.total_redeemed || 0;

    const newCurrentPoints = Math.max(0, current_points + pointsChange);
    const newTotalEarned = pointsChange > 0 ? total_earned + pointsChange : total_earned;
    const newTotalRedeemed = pointsChange < 0 ? total_redeemed + Math.abs(pointsChange) : total_redeemed;

    const { error: pointsError } = await supabase
      .from('user_points')
      .update({
        current_points: newCurrentPoints,
        total_earned: newTotalEarned,
        total_redeemed: newTotalRedeemed
      })
      .eq('user_id', userId);

    if (pointsError) return { error: pointsError };

    const { error: transactionError } = await supabase
      .from('transactions')
      .insert([{
        user_id: userId,
        transaction_type: pointsChange > 0 ? 'admin_credit' : 'admin_debit',
        points_earned: pointsChange > 0 ? pointsChange : 0,
        points_redeemed: pointsChange < 0 ? Math.abs(pointsChange) : 0,
        amount: 0,
        items: [reason]
      }]);

    if (!transactionError) {
      await fetchUsers();
      await fetchTransactions();
    }

    return { error: transactionError };
  };

  return {
    isAdmin,
    loading,
    users,
    rewards,
    transactions,
    fetchUsers,
    fetchRewards,
    fetchTransactions,
    createReward,
    updateReward,
    deleteReward,
    makeUserAdmin,
    removeUserAdmin,
    adjustUserPoints
  };
};
