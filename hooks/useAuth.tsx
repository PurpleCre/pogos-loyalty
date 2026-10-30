import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import * as Linking from 'expo-linking';
import { useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createLocationCache } from '@/lib/location-cache';

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
  const queryClient = useQueryClient();
  const roleRevision = useRef(0);
  const previousUserId = useRef<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<AppRole>('user');
  const [staffStoreId, setStaffStoreId] = useState<string | null>(null);

  const fetchUserRole = async (userId: string, revision = roleRevision.current) => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role, staff_store_id')
        .eq('user_id', userId);

      if (revision !== roleRevision.current) return;
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
      if (revision !== roleRevision.current) return;
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
    let active = true;
    let receivedAuthEvent = false;
    const timers = new Set<ReturnType<typeof setTimeout>>();

    const applySession = (nextSession: Session | null) => {
      if (!active) return;
      const revision = ++roleRevision.current;
      const nextUserId = nextSession?.user.id ?? null;
      const previousId = previousUserId.current;
      if (previousId !== nextUserId) {
        queryClient.clear();
        if (previousId) {
          void createLocationCache(AsyncStorage).clear(previousId).catch(() => {
            console.error('Unable to clear departing account location cache');
          });
        }
        setUserRole('user');
        setStaffStoreId(null);
      }
      previousUserId.current = nextUserId;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(!!nextSession);
      if (!nextUserId) return;

      // Supabase auth callbacks run under the auth lock. Fetching via the same
      // client inside an awaited callback can deadlock; defer until it returns.
      const timer = setTimeout(() => {
        timers.delete(timer);
        if (!active || revision !== roleRevision.current) return;
        void fetchUserRole(nextUserId, revision).finally(() => {
          if (active && revision === roleRevision.current) setLoading(false);
        });
      }, 0);
      timers.add(timer);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      receivedAuthEvent = true;
      applySession(nextSession);
    });
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!receivedAuthEvent) applySession(error ? null : data.session);
    }).catch(() => {
      if (!receivedAuthEvent) applySession(null);
    });

    return () => {
      active = false;
      ++roleRevision.current;
      timers.forEach(clearTimeout);
      subscription.unsubscribe();
    };
  }, [queryClient]);

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
