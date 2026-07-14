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
  staff_store_id?: string | null;
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

interface AdminStore {
  id: string;
  name: string;
  address: string;
  distance_miles: number;
  is_open: boolean;
  latitude: number;
  longitude: number;
  image_url?: string;
}

interface DashboardStats {
  totalUsers: number;
  totalOrdersToday: number;
  revenueToday: number;
  activeStaff: number;
  totalStores: number;
  pendingOrders: number;
}

export const useAdmin = () => {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [rewards, setRewards] = useState<AdminReward[]>([]);
  const [achievements, setAchievements] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<AdminTransaction[]>([]);
  const [stores, setStores] = useState<AdminStore[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({
    totalUsers: 0, totalOrdersToday: 0, revenueToday: 0, activeStaff: 0, totalStores: 0, pendingOrders: 0
  });
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
    // 1. Fetch profiles and points
    const { data: profilesData, error: profilesError } = await supabase
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
        )
      `)
      .order('created_at', { ascending: false });

    if (profilesError || !profilesData) {
      console.error('Error fetching profiles:', profilesError);
      return;
    }

    // 2. Fetch roles
    const { data: rolesData, error: rolesError } = await supabase
      .from('user_roles')
      .select('user_id, role, staff_store_id');

    if (rolesError) {
      console.error('Error fetching roles:', rolesError);
      return;
    }

    // 3. Map roles by user_id
    const rolesMap = new Map();
    rolesData.forEach(r => {
      rolesMap.set(r.user_id, r);
    });

    // 4. Merge
    const formattedUsers = profilesData.map(u => {
      const roleData = rolesMap.get(u.id);
      return {
        id: u.id,
        email: u.email || '',
        full_name: u.full_name || '',
        current_points: (u.user_points as any)?.[0]?.current_points || (u.user_points as any)?.current_points || 0,
        total_earned: (u.user_points as any)?.[0]?.total_earned || (u.user_points as any)?.total_earned || 0,
        total_redeemed: (u.user_points as any)?.[0]?.total_redeemed || (u.user_points as any)?.total_redeemed || 0,
        created_at: u.created_at || '',
        role: roleData?.role || 'user',
        staff_store_id: roleData?.staff_store_id || null
      };
    });
    
    setUsers(formattedUsers as any);
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

  const fetchStores = async () => {
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .order('name');

    if (!error && data) {
      setStores(data);
    }
  };

  const createStore = async (storeData: { name: string; address: string; latitude?: number; longitude?: number; image_url?: string }) => {
    const { error } = await supabase
      .from('stores')
      .insert([{ distance_miles: 0, is_open: true, ...storeData }]);
    if (!error) {
      await fetchStores();
    }
    return { error };
  };

  const fetchAchievements = async () => {
    const { data, error } = await supabase
      .from('achievements')
      .select('*')
      .order('criteria_value', { ascending: true });

    if (!error && data) {
      setAchievements(data);
    }
  };

  const createAchievement = async (achievementData: any) => {
    const { error } = await supabase
      .from('achievements')
      .insert([achievementData]);
    
    if (!error) {
      await fetchAchievements();
    }
    return { error };
  };

  const updateAchievement = async (id: string, updates: any) => {
    const { error } = await supabase
      .from('achievements')
      .update(updates)
      .eq('id', id);
    
    if (!error) {
      await fetchAchievements();
    }
    return { error };
  };

  const deleteAchievement = async (id: string) => {
    const { error } = await supabase
      .from('achievements')
      .delete()
      .eq('id', id);
    
    if (!error) {
      await fetchAchievements();
    }
    return { error };
  };

  const fetchDashboardStats = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Total users
    const { count: totalUsers } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true });

    // Today's orders
    const { data: todayOrders } = await supabase
      .from('orders')
      .select('id, total_amount, status')
      .gte('created_at', today.toISOString());

    // Active staff count
    const { count: activeStaff } = await supabase
      .from('user_roles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'staff');

    // Total stores
    const { count: totalStores } = await supabase
      .from('stores')
      .select('id', { count: 'exact', head: true });

    setDashboardStats({
      totalUsers: totalUsers || 0,
      totalOrdersToday: todayOrders?.length || 0,
      revenueToday: todayOrders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0,
      activeStaff: activeStaff || 0,
      totalStores: totalStores || 0,
      pendingOrders: todayOrders?.filter(o => o.status === 'pending').length || 0,
    });
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
    // Remove existing roles first, then insert admin
    await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId);

    const { error } = await supabase
      .from('user_roles')
      .insert([{ user_id: userId, role: 'admin' }]);

    if (!error) {
      await fetchUsers();
    }
    return { error };
  };

  const removeUserAdmin = async (userId: string) => {
    await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId)
      .eq('role', 'admin');

    // Re-add as user
    await supabase
      .from('user_roles')
      .insert([{ user_id: userId, role: 'user' }]);

    await fetchUsers();
    return { error: null };
  };

  const makeUserStaff = async (userId: string, storeId: string) => {
    // Remove existing roles first
    await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId);

    const { error } = await supabase
      .from('user_roles')
      .insert([{ user_id: userId, role: 'staff', staff_store_id: storeId }]);

    if (!error) {
      await fetchUsers();
    }
    return { error };
  };

  const removeUserStaff = async (userId: string) => {
    await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId)
      .eq('role', 'staff');

    // Re-add as user
    await supabase
      .from('user_roles')
      .insert([{ user_id: userId, role: 'user' }]);

    await fetchUsers();
    return { error: null };
  };

  const setUserRole = async (userId: string, role: string, storeId?: string) => {
    // Delete existing roles
    await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId);

    const roleData: any = { user_id: userId, role };
    if (role === 'staff' && storeId) {
      roleData.staff_store_id = storeId;
    }

    const { error } = await supabase
      .from('user_roles')
      .insert([roleData]);

    if (!error) {
      await fetchUsers();
    }
    return { error };
  };

  const updateStore = async (id: string, updates: Partial<AdminStore>) => {
    const { error } = await supabase
      .from('stores')
      .update(updates)
      .eq('id', id);

    if (!error) {
      await fetchStores();
    }
    return { error };
  };

  const deleteStore = async (id: string) => {
    const { error } = await supabase
      .from('stores')
      .delete()
      .eq('id', id);

    if (!error) {
      await fetchStores();
    }
    return { error };
  };

  const createUser = async (email: string, password: string, fullName: string, role: string, storeId?: string) => {
    // Sign up the user via Supabase auth
    const { data, error: signUpError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName }
    });

    if (signUpError) {
      // Fallback: use regular signUp (admin API might not be available with anon key)
      // Instead, we'll just use the standard signup and let the handle_new_user trigger handle profile creation
      const { data: signUpData, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName }
        }
      });

      if (error) return { error };

      // Note: the user will need to confirm their email before being usable
      // The role assignment will be done after they confirm
      return { error: null, note: 'User created. They need to confirm their email. Role will be set after confirmation.' };
    }

    // If admin API worked, set the role
    if (data?.user) {
      await setUserRole(data.user.id, role, storeId);
    }

    await fetchUsers();
    return { error: null };
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
    achievements,
    transactions,
    stores,
    dashboardStats,
    fetchUsers,
    fetchRewards,
    fetchAchievements,
    fetchTransactions,
    fetchStores,
    fetchDashboardStats,
    createReward,
    updateReward,
    deleteReward,
    createAchievement,
    updateAchievement,
    deleteAchievement,
    makeUserAdmin,
    removeUserAdmin,
    makeUserStaff,
    removeUserStaff,
    setUserRole,
    createStore,
    updateStore,
    deleteStore,
    createUser,
    adjustUserPoints
  };
};
