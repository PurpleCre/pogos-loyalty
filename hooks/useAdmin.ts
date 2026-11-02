import { logPrivateError } from '@/lib/privacy-logging';
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { Store } from '@/hooks/useStores';
import { accessTokenFor } from '@/lib/cash-orders';
import type { AppRole } from '@/hooks/useAuth';
import { branchScopedRole } from '@/lib/identity';

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
  staff_store_ids: string[];
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

type AdminStore = Store;

interface DashboardStats {
  totalUsers: number;
  totalOrdersToday: number;
  activeStaff: number;
  totalStores: number;
  pendingOrders: number;
}

export const useAdmin = () => {
  const { user, userRole, loading } = useAuth();
  const isAdmin = userRole === 'admin';
  const scope = `${user?.id}:${isAdmin}`;
  const currentScope = useRef(scope); currentScope.current = scope;
  const [userState, setUserState] = useState<{ scope: string; rows: AdminUser[] }>({ scope, rows: [] });
  const users = userState.scope === scope ? userState.rows : [];
  const setUsers = (rows: AdminUser[]) => setUserState({ scope, rows });
  const [rewards, setRewards] = useState<AdminReward[]>([]);
  const [achievements, setAchievements] = useState<any[]>([]);
  const [transactionState, setTransactionState] = useState<{ scope: string; rows: AdminTransaction[] }>({ scope, rows: [] });
  const transactions = transactionState.scope === scope ? transactionState.rows : [];
  const setTransactions = (rows: AdminTransaction[]) => setTransactionState({ scope, rows });
  const [stores, setStores] = useState<AdminStore[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({
    totalUsers: 0, totalOrdersToday: 0, activeStaff: 0, totalStores: 0, pendingOrders: 0
  });
  useEffect(() => {
    setUsers([]); setTransactions([]); setRewards([]); setAchievements([]); setStores([]);
  }, [scope]);

  const fetchUsers = async () => {
    const requestScope = scope;
    if (!isAdmin || !user) return;
    const token = await accessTokenFor(user.id);
    const authorization = `Bearer ${token}`;
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
      .order('created_at', { ascending: false }).setHeader('Authorization', authorization);

    if (profilesError || !profilesData) {
      logPrivateError('Error fetching profiles:', profilesError);
      return;
    }

    // 2. Fetch roles
    const { data: rolesData, error: rolesError } = await supabase
      .from('user_roles')
      .select('user_id, role, staff_store_id').setHeader('Authorization', authorization);

    if (rolesError) {
      logPrivateError('Error fetching roles:', rolesError);
      return;
    }

    const memberships = await supabase.from('staff_memberships').select('user_id, store_id').eq('active', true).setHeader('Authorization', authorization);
    if (memberships.error || currentScope.current !== requestScope) return;
    // 3. Map roles by user_id
    const rolesMap = new Map();
    rolesData.forEach(r => {
      const priority = { admin: 5, finance: 4, manager: 3, staff: 2, user: 1 };
      if (priority[r.role] > (priority[rolesMap.get(r.user_id)?.role as AppRole] ?? 0)) rolesMap.set(r.user_id, r);
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
        staff_store_id: roleData?.staff_store_id || null,
        staff_store_ids: memberships.data.filter(m => m.user_id === u.id).map(m => m.store_id)
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
    const requestScope = scope;
    if (!isAdmin || !user) return;
    const token = await accessTokenFor(user.id);
    const { data, error } = await supabase
      .from('transactions')
      .select(`
        *,
        profiles (
          email
        )
      `)
      .order('created_at', { ascending: false })
      .limit(100).setHeader('Authorization', `Bearer ${token}`);

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
      if (currentScope.current === requestScope) setTransactions(formattedTransactions);
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
      .in('role', ['staff','manager']);

    // Total stores
    const { count: totalStores } = await supabase
      .from('stores')
      .select('id', { count: 'exact', head: true });

    setDashboardStats({
      totalUsers: totalUsers || 0,
      totalOrdersToday: todayOrders?.length || 0,
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

  const setUserRole = async (userId: string, role: AppRole, storeIds: string[], reason: string) => {
    if (!user || !isAdmin) return { error: new Error('Administrator access required.') };
    const token = await accessTokenFor(user.id);
    const { error } = await supabase.rpc('set_identity_access', { p_user_id: userId, p_role: role, p_store_ids: branchScopedRole(role) ? storeIds : [], p_reason: reason })
      .setHeader('Authorization', `Bearer ${token}`);
    if (!error && currentScope.current === scope) await fetchUsers();
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

  const adjustUserPoints = async (_userId: string, _pointsChange: number, _reason: string) => {
    return { error: 'Points adjustments require the audited loyalty service, which is not available yet.' };
  };

  return {
    isAdmin,
    loading,
    users: isAdmin ? users : [],
    rewards,
    achievements,
    transactions: isAdmin ? transactions : [],
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
    setUserRole,
    createStore,
    updateStore,
    deleteStore,
    adjustUserPoints
  };
};
