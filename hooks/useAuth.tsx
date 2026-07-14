import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import * as Linking from 'expo-linking';

export type AppRole = 'user' | 'staff' | 'admin';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  userRole: AppRole;
  staffStoreId: string | null;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<{ error: any }>;
  refetchRole: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<AppRole>('user');
  const [staffStoreId, setStaffStoreId] = useState<string | null>(null);

  const fetchUserRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role, staff_store_id')
        .eq('user_id', userId);

      if (error || !data || data.length === 0) {
        setUserRole('user');
        setStaffStoreId(null);
        return;
      }

      // Priority: admin > staff > user
      const adminRole = data.find(r => r.role === 'admin');
      if (adminRole) {
        setUserRole('admin');
        setStaffStoreId(null);
        return;
      }

      const staffRole = data.find(r => r.role === 'staff');
      if (staffRole) {
        setUserRole('staff');
        setStaffStoreId(staffRole.staff_store_id || null);
        return;
      }

      setUserRole('user');
      setStaffStoreId(null);
    } catch (err) {
      console.error('Error fetching user role:', err);
      setUserRole('user');
      setStaffStoreId(null);
    }
  };

  const refetchRole = async () => {
    if (user?.id) {
      await fetchUserRole(user.id);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchUserRole(session.user.id);
        } else {
          setUserRole('user');
          setStaffStoreId(null);
        }
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchUserRole(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, fullName?: string) => {
    const redirectUrl = Linking.createURL('/');
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        }
      }
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    setUserRole('user');
    setStaffStoreId(null);
    return { error };
  };

  const value = {
    user,
    session,
    loading,
    userRole,
    staffStoreId,
    signUp,
    signIn,
    signOut,
    refetchRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
