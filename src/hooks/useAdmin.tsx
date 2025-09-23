import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
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
  description: string;
  points_cost: number;
  category: string;
  available: boolean;
  image_url?: string;
  created_at: string;
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

  // Fetch all users with their points data
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
      const formattedUsers = data.map(user => ({
        id: user.id,
        email: user.email || '',
        full_name: user.full_name || '',
        current_points: user.user_points?.[0]?.current_points || 0,
        total_earned: user.user_points?.[0]?.total_earned || 0,
        total_redeemed: user.user_points?.[0]?.total_redeemed || 0,
        created_at: user.created_at || '',
        role: (user.user_roles?.[0] as any)?.role || 'user'
      }));
      setUsers(formattedUsers);
    }
  };

  // Fetch all rewards
  const fetchRewards = async () => {
    const { data, error } = await supabase
      .from('rewards')
      .select('*')
      .order('points_cost', { ascending: true });

    if (!error && data) {
      setRewards(data);
    }
  };

  // Fetch all transactions with user info
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
        user_email: transaction.profiles?.email || '',
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

  // Create a new reward
  const createReward = async (reward: Omit<AdminReward, 'id' | 'created_at'>) => {
    const { error } = await supabase
      .from('rewards')
      .insert([reward]);

    if (!error) {
      await fetchRewards();
    }
    return { error };
  };

  // Update a reward
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

  // Delete a reward
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

  // Assign admin role to user
  const makeUserAdmin = async (userId: string) => {
    const { error } = await supabase
      .from('user_roles')
      .insert([{ user_id: userId, role: 'admin' }]);

    if (!error) {
      await fetchUsers();
    }
    return { error };
  };

  // Remove admin role from user
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

  // Adjust user points
  const adjustUserPoints = async (userId: string, pointsChange: number, reason: string) => {
    // Get current points
    const { data: currentData } = await supabase
      .from('user_points')
      .select('current_points, total_earned, total_redeemed')
      .eq('user_id', userId)
      .single();

    if (!currentData) return { error: 'User not found' };

    const newCurrentPoints = Math.max(0, currentData.current_points + pointsChange);
    const newTotalEarned = pointsChange > 0 ? currentData.total_earned + pointsChange : currentData.total_earned;
    const newTotalRedeemed = pointsChange < 0 ? currentData.total_redeemed + Math.abs(pointsChange) : currentData.total_redeemed;

    // Update points
    const { error: pointsError } = await supabase
      .from('user_points')
      .update({
        current_points: newCurrentPoints,
        total_earned: newTotalEarned,
        total_redeemed: newTotalRedeemed
      })
      .eq('user_id', userId);

    if (pointsError) return { error: pointsError };

    // Create transaction record
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