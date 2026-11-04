import { createContext, useContext, useEffect, useState, useRef, ReactNode, useCallback } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import * as Linking from 'expo-linking';
import { AppState, Platform } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearAccountLocalData } from '@/lib/account-cleanup';
import { cartRepository } from '@/lib/cart-persistence';
async function clearLocalAccount(owner: string, deleted = false) {
  const results = await Promise.allSettled([clearAccountLocalData(AsyncStorage, owner, deleted), cartRepository.clearAccount(owner)]);
  if (results.some(result => result.status === 'rejected')) throw new Error('Account cache cleanup could not be confirmed.');
}
import { authStorage, authStorageKey, recoveryStorageKey, logoutStorageKey } from '@/lib/auth-storage';
import { normaliseEmail, validatePassword, roleSnapshot } from '@/lib/identity';
import bindings from '@/config/environments.json';
import { createAuthCallback } from '@/lib/auth-callback';
import { runtimeEnvironment } from '@/lib/environment';
import { disablePushForLogout } from '@/lib/device-push';
import { setPushRecipient } from '@/lib/notification-handler';
import { developerAccessStatus, developerAccessActive, developerAccessEnvironment } from '@/lib/developer-access';

export type AppRole = 'user' | 'staff' | 'manager' | 'finance' | 'admin';
interface AuthContextType {
  user: User | null; session: Session | null; loading: boolean;
  userRole: AppRole; staffStoreId: string | null; staffStoreIds: string[];
  requiresMfa: boolean; recoveryRequired: boolean;
  developerAccess: boolean; developerAccessAvailable: boolean; developerAccessExpiresAt: string | null;
  startDeveloperAccess(): Promise<void>; stopDeveloperAccess(): Promise<void>;
  signUp(email: string, password: string, fullName?: string): Promise<{ error: Error | null; session?: Session | null }>;
  signIn(email: string, password: string): Promise<{ error: Error | null }>;
  signOut(): Promise<{ error: Error | null }>;
  requestPasswordReset(email: string): Promise<void>;
  resendConfirmation(email: string): Promise<void>;
  reauthenticate(password: string): Promise<void>;
  completeCallback(params: Record<string, unknown>): Promise<'recovery' | 'signed-in'>;
  updatePassword(password: string): Promise<{ otherSessionsRevoked: boolean }>;
  refetchRole(): Promise<void>;
}
const AuthContext = createContext<AuthContextType | undefined>(undefined);
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within an AuthProvider');
  return value;
}
const emptyAccess = { userRole: 'user' as AppRole, staffStoreIds: [] as string[], requiresMfa: false };
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const revision = useRef(0);
  const currentSession = useRef<Session | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [access, setAccess] = useState(emptyAccess);
  const [recoveryRequired, setRecoveryRequired] = useState(false);
  const [developerState, setDeveloperState] = useState<ReturnType<typeof developerAccessStatus> | null>(null);
  const [developerClock, setDeveloperClock] = useState(Date.now());
  const callback = useRef<ReturnType<typeof createAuthCallback> | null>(null);
  const callbackRecoveryOwner = useRef<string | null>(null);
  const signingOut = useRef(false);
  const accessBoundary = useRef('');
  const logoutInFlight = useRef<Promise<{ error: Error | null }> | null>(null);
  const scheme = bindings[runtimeEnvironment.name].scheme;
  const redirectTo = Platform.OS === 'web' ? Linking.createURL('/auth/callback') : scheme ? `${scheme}://auth/callback` : Linking.createURL('/auth/callback');
  const fetchAccess = useCallback(async (userId: string, version: number) => {
    try {
      const [roles, memberships, assurance, privacy, developer] = await Promise.all([
        supabase.from('user_roles').select('role, staff_store_id').eq('user_id', userId),
        supabase.from('staff_memberships').select('store_id').eq('user_id', userId).eq('active', true),
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
        supabase.rpc('account_privacy_state'),
        supabase.rpc('development_mfa_status'),
      ]);
      if (version !== revision.current || currentSession.current?.user.id !== userId) return;
      if (roles.error || memberships.error || assurance.error || privacy.error) throw new Error('Unable to verify account access.');
      if (privacy.data && typeof privacy.data==='object' && !Array.isArray(privacy.data) && privacy.data.deleted === true) {
        const previousToken=currentSession.current?.access_token;setPushRecipient(null);
        signingOut.current=true; ++revision.current; currentSession.current=null; setSession(null); setAccess(emptyAccess); setLoading(false); queryClient.clear();
        await authStorage.setItem(logoutStorageKey,'1');
        if(previousToken)await disablePushForLogout(userId,previousToken).catch(()=>undefined);
        await clearLocalAccount(userId,true).catch(()=>undefined);
        await supabase.auth.signOut({scope:'local'}); await authStorage.removeItem(authStorageKey); return;
      }
      const stores = memberships.data.map(row => row.store_id).sort();
      const development = developer.error ? null : developerAccessStatus(developer.data, userId);
      setDeveloperState(development);
      const developerActive = developerAccessEnvironment(runtimeEnvironment) && developerAccessActive(development, userId, Date.now(), performance.now());
      const snapshot = roleSnapshot(roles.data, stores, assurance.data.currentLevel, developerActive);
      const boundary = JSON.stringify([userId, snapshot.role, stores, developerActive]);
      if (accessBoundary.current && accessBoundary.current !== boundary) queryClient.clear();
      accessBoundary.current = boundary;
      setAccess({ userRole: snapshot.role as AppRole, staffStoreIds: stores,
        requiresMfa: snapshot.requiresMfa || (!developerActive && assurance.data.nextLevel === 'aal2' && assurance.data.currentLevel !== 'aal2') });
    } catch {
      if (version === revision.current) { setAccess(emptyAccess); setDeveloperState(null); queryClient.clear(); }
    } finally { if (version === revision.current) setLoading(false); }
  }, [queryClient]);
  const refetchRole = useCallback(async () => {
    const owner = currentSession.current?.user.id;
    if (owner) await fetchAccess(owner, ++revision.current);
  }, [fetchAccess]);
  useEffect(() => {
    let active = true; let receivedEvent = false;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const applySession = (next: Session | null, recovery = false) => {
      if (!active) return;
      if (next && signingOut.current) return;
      const version = ++revision.current;
      const previous = currentSession.current?.user.id;
      const previousToken = currentSession.current?.access_token;
      const owner = next?.user.id;
      if (previous !== owner) {
        setDeveloperState(null);
        queryClient.clear(); setAccess(emptyAccess); setRecoveryRequired(false);
        if (previous) {
          void clearLocalAccount(previous).catch(() => undefined);
          if(previousToken)void disablePushForLogout(previous,previousToken).catch(()=>undefined);
        }
      }
      currentSession.current = next; setSession(next); setLoading(!!next);
      if (recovery) setRecoveryRequired(true);
      // Never await another Supabase call inside the auth event lock.
      const timer = setTimeout(() => {
        timers.delete(timer);
        if (!active || version !== revision.current) return;
        void (async () => {
          if (!owner) return;
          if (await authStorage.getItem(logoutStorageKey)) {
            signingOut.current = true; ++revision.current;
            currentSession.current = null; setSession(null); setAccess(emptyAccess); setLoading(false); queryClient.clear();
            await authStorage.removeItem(authStorageKey);
            await supabase.auth.signOut({ scope: 'local' });
            return;
          }
          if (recovery) await authStorage.setItem(recoveryStorageKey, owner);
          const stored = await authStorage.getItem(recoveryStorageKey);
          if (!active || version !== revision.current) return;
          setRecoveryRequired(stored === 'pending' || stored === owner);
          await fetchAccess(owner, version);
        })().catch(() => { if (active && version === revision.current) { setAccess(emptyAccess); setRecoveryRequired(true); setLoading(false); } });
      }, 0);
      timers.add(timer);
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === 'PASSWORD_RECOVERY') callbackRecoveryOwner.current = next?.user.id ?? null;
      receivedEvent = true; applySession(next, event === 'PASSWORD_RECOVERY');
    });
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!receivedEvent) applySession(error ? null : data.session);
    }).catch(() => { if (!receivedEvent) applySession(null); });
    const foreground = AppState.addEventListener('change', state => { if (state === 'active') void refetchRole(); else { ++revision.current; setAccess(emptyAccess); setDeveloperState(null); } });
    const interval = setInterval(() => { if (AppState.currentState === 'active') void refetchRole(); }, 30000);
    return () => { active = false; ++revision.current; timers.forEach(clearTimeout); clearInterval(interval); foreground.remove(); subscription.unsubscribe(); };
  }, [queryClient, fetchAccess, refetchRole]);
  useEffect(() => {
    const tick = () => setDeveloperClock(Date.now());
    const listener = AppState.addEventListener('change', tick);
    const timer = developerState?.active ? setInterval(tick, 1000) : null;
    return () => { listener.remove(); if (timer) clearInterval(timer); };
  }, [developerState?.active]);
  const signOut = (): Promise<{ error: Error | null }> => {
    if (logoutInFlight.current) return logoutInFlight.current;
    // Hide private state immediately. Local sign-out works without network and
    // deletes stored refresh credentials; server-side role revocation is separate.
    signingOut.current = true;
    setDeveloperState(null);
    const previousSession=currentSession.current;
    const hadDeveloperAccess=!!developerState?.active;
    const previousOwner=previousSession?.user.id;
    setPushRecipient(null);
    ++revision.current; currentSession.current = null; setSession(null); setAccess(emptyAccess); setRecoveryRequired(false); setLoading(false); queryClient.clear();
    const operation = (async () => {
      try {
        // Persist intent before any network request: a kill/offline logout may
        // not restore this session on restart, even if refresh revocation fails.
        await authStorage.setItem(logoutStorageKey, '1');
        if(hadDeveloperAccess&&previousSession)await supabase.rpc('end_development_mfa_session').setHeader('Authorization',`Bearer ${previousSession.access_token}`).then(()=>undefined,()=>undefined);
        const pushError=previousSession?await disablePushForLogout(previousSession.user.id,previousSession.access_token).then(()=>null).catch(()=>new Error('Push removal needs checking. Retry on this account when online.')):null;
        const cleanupError=previousOwner?await clearLocalAccount(previousOwner).then(()=>null).catch(()=>new Error('Account cache cleanup could not be confirmed.')):null;
        const { error } = await supabase.auth.signOut({ scope: 'local' });
        await authStorage.removeItem(authStorageKey); await authStorage.removeItem(recoveryStorageKey);
        return { error: error??cleanupError??pushError };
      } catch { return { error: new Error('Unable to clear this device session. Try signing out again.') }; }
    })().finally(() => { logoutInFlight.current = null; });
    logoutInFlight.current = operation; return operation;
  };
  const signUp = async (email: string, password: string, fullName = '') => {
    try {
      validatePassword(password);
      if (logoutInFlight.current) await logoutInFlight.current;
      await authStorage.removeItem(logoutStorageKey);
      signingOut.current = false;
      const { data, error } = await supabase.auth.signUp({ email: normaliseEmail(email), password,
        options: { emailRedirectTo: redirectTo, data: { full_name: fullName.trim().slice(0, 120) } } });
      return { error, session: data.session };
    } catch (error) { return { error: error instanceof Error ? error : new Error('Unable to create account.') }; }
  };
  const signIn = async (email: string, password: string) => {
    try {
      if (logoutInFlight.current) await logoutInFlight.current;
      await authStorage.removeItem(logoutStorageKey);
      signingOut.current = false; const { error } = await supabase.auth.signInWithPassword({ email: normaliseEmail(email), password }); return { error };
    }
    catch { return { error: new Error('Unable to sign in. Check your connection and try again.') }; }
  };
  const requestPasswordReset = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(normaliseEmail(email), { redirectTo });
    if (error) throw new Error('Unable to send recovery email. Wait a moment and try again.');
  };
  const reauthenticate = async (password:string) => {
    const expected=currentSession.current?.user;
    if(!expected?.email)throw new Error('Sign in first.');
    const result=await signIn(expected.email,password);
    if(result.error)throw result.error;
    if(currentSession.current?.user.id!==expected.id){await signOut();throw new Error('Account changed. Sign in again.');}
  };
  const resendConfirmation = async (email: string) => {
    const { error } = await supabase.auth.resend({ type: 'signup', email: normaliseEmail(email), options: { emailRedirectTo: redirectTo } });
    if (error) throw new Error('Unable to resend confirmation. Wait a moment and try again.');
  };
  if (!callback.current) callback.current = createAuthCallback({
    storage: authStorage, markerKey: recoveryStorageKey,
    owner: () => currentSession.current?.user.id,
    recoveryOwner: () => callbackRecoveryOwner.current,
    beforeExchange: () => { callbackRecoveryOwner.current = null; signingOut.current = false; },
    exchange: async (code, flowId) => {
      if (logoutInFlight.current) await logoutInFlight.current;
      await authStorage.removeItem(logoutStorageKey);
      return supabase.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined);
    },
    signOut, setRecovery: setRecoveryRequired,
  });
  const completeCallback = callback.current;
  const updatePassword = async (password: string) => {
    if (!recoveryRequired || !currentSession.current) throw new Error('Open a fresh recovery email first.');
    validatePassword(password);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw new Error('Unable to update password. Try again or request a fresh recovery email.');
    // Revoke refresh sessions elsewhere, then require a fresh login here too.
    const revoked = await supabase.auth.signOut({ scope: 'global' });
    const local = await signOut();
    if (local.error) throw local.error;
    return { otherSessionsRevoked: !revoked.error };
  };
  const developerAllowed = developerAccessEnvironment(runtimeEnvironment) && !recoveryRequired;
  const developerActive = developerAllowed && developerAccessActive(developerState, session?.user.id, Math.max(developerClock, Date.now()), performance.now());
  const effectiveAccess = developerState?.active && !developerActive ? { ...emptyAccess, requiresMfa: true } : access;
  const startDeveloperAccess = async () => {
    const owner = currentSession.current?.user.id;
    if (!owner || !developerAllowed || loading) throw new Error('Development access is unavailable.');
    const token = currentSession.current!.access_token;
    const result = await supabase.rpc('begin_development_mfa_session').setHeader('Authorization', `Bearer ${token}`);
    if (result.error) throw new Error('Development access was not granted. Check the allowlist, account role and expiry.');
    if (currentSession.current?.user.id !== owner) return;
    queryClient.clear(); await refetchRole();
  };
  const stopDeveloperAccess = async () => {
    const token = currentSession.current?.access_token;
    setDeveloperState(null); setAccess(emptyAccess); queryClient.clear();
    if (!token) return;
    const result = await supabase.rpc('end_development_mfa_session').setHeader('Authorization', `Bearer ${token}`);
    if (result.error) { await signOut(); throw new Error('Development session cleanup could not be confirmed. Sign in again.'); }
    await refetchRole();
  };
  return <AuthContext.Provider value={{ user: session?.user ?? null, session, loading,
    ...effectiveAccess, staffStoreId: effectiveAccess.staffStoreIds[0] ?? null, recoveryRequired,
    developerAccess: developerActive, developerAccessAvailable: developerAllowed && developerState?.owner === session?.user.id && !!developerState?.available,
    developerAccessExpiresAt: developerState?.expiresAt ?? null, startDeveloperAccess, stopDeveloperAccess,
    signUp, signIn, signOut, requestPasswordReset, resendConfirmation, reauthenticate, completeCallback, updatePassword, refetchRole }}>{children}</AuthContext.Provider>;
};
