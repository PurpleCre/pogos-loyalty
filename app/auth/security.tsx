import { Screen, PageHeading } from '@/components/ui/screen';
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { AppState, ScrollView, Text, View } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import Svg, { Path, Rect } from 'react-native-svg';
import qrcode from 'qrcode-generator';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { z } from 'zod';
import { emptyMfaSetup, mfaSetupReducer, startTotpSetup, mfaFailureMessage, type MfaAction } from '@/lib/mfa-enrollment';
import { logPrivateError } from '@/lib/privacy-logging';
const invitationsSchema = z.array(z.object({ id: z.uuid(), store_id: z.uuid(), store_name: z.string(), expires_at: z.string() }));
function SecretQr({ uri }: { uri: string }) {
  const qr = useMemo(() => {
    const code = qrcode(0, 'M'); code.addData(uri); code.make(); let path = '';
    const size = code.getModuleCount();
    for (let row = 0; row < size; row++) for (let col = 0; col < size; col++) if (code.isDark(row, col)) path += `M${col + 4},${row + 4}h1v1h-1z `;
    return { size: size + 8, path };
  }, [uri]);
  return <Svg accessibilityLabel="Private authenticator setup QR" width={240} height={240} viewBox={`0 0 ${qr.size} ${qr.size}`}><Rect width={qr.size} height={qr.size} fill="white" /><Path d={qr.path} fill="black" /></Svg>;
}
function SecurityContent({ owner, destination }: { owner: string; destination: '/privacy' | '/notifications' | '/(app)/dashboard' }) {
  const { refetchRole, signOut, developerAccessAvailable, developerAccess, developerAccessExpiresAt, startDeveloperAccess, stopDeveloperAccess } = useAuth();
  const [factor, setFactor] = useState<string | null>(null);
  const [factors, setFactors] = useState<{ id: string; friendly_name?: string }[]>([]);
  const [setupState, updateSetup] = useReducer(mfaSetupReducer, emptyMfaSetup);
  const { setup, pendingId } = setupState;
  const [code, setCode] = useState(''); const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [invitations, setInvitations] = useState<z.infer<typeof invitationsSchema>>([]);
  const active = useRef(true); const version = useRef(0); const inFlight = useRef(false);
  const ensureCurrent = async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (!active.current || AppState.currentState !== 'active' || data.session?.user.id !== owner) throw Object.assign(new Error('Account changed.'), { code: 'session_changed' });
  };
  const load = async () => {
    const revision = ++version.current;
    setLoaded(false);
    await ensureCurrent();
    const [{ data, error }, assurance] = await Promise.all([supabase.auth.mfa.listFactors(), supabase.auth.mfa.getAuthenticatorAssuranceLevel()]);
    if (error || assurance.error) throw error ?? assurance.error;
    await ensureCurrent();
    if (!active.current || revision !== version.current) return;
    setFactors(data.totp); setFactor(current => data.totp.some(item => item.id === current) ? current : data.totp[0]?.id ?? null); setReady(assurance.data.currentLevel === 'aal2');
    updateSetup({ type: 'reconcile', factors: data.all }); setLoaded(true);
    if (assurance.data.currentLevel === 'aal2') {
      const result = await supabase.rpc('my_staff_invitations');
      if (result.error) throw new Error('Unable to load invitations.');
      if (active.current && revision === version.current) setInvitations(invitationsSchema.parse(result.data));
    }
  };
  useEffect(() => {
    active.current = true;
    void load().catch(error => { if (active.current && AppState.currentState === 'active') setMessage(mfaFailureMessage(error, 'load')); });
    const listener = AppState.addEventListener('change', state => {
      if (state !== 'active') { ++version.current; updateSetup({ type: 'hide' }); setCode(''); setInvitations([]); setReady(false); setLoaded(false); }
      else void load().catch(error => { if (active.current && AppState.currentState === 'active') setMessage(mfaFailureMessage(error, 'load')); });
    });
    return () => { active.current = false; ++version.current; listener.remove(); };
  }, [owner]);
  const run = async (action: () => Promise<void>, kind: MfaAction) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true); setMessage('');
    try { await action(); }
    catch (error) {
      logPrivateError(`MFA ${kind} failed`, error);
      if (active.current && AppState.currentState === 'active') setMessage(mfaFailureMessage(error, kind));
    }
    finally { inFlight.current = false; if (active.current) setBusy(false); }
  };
  const enrol = async () => {
    const revision = ++version.current;
    const current = async () => {
      await ensureCurrent();
      if (version.current !== revision) throw Object.assign(new Error('Setup changed.'), { code: 'session_changed' });
    };
    const result = await startTotpSetup(supabase.auth.mfa, current);
    if (!active.current || version.current !== revision) return;
    setCode('');
    if (result.kind === 'existing') {
      setFactors([result.factor]); setFactor(result.factor.id); updateSetup({ type: 'reset' });
      setMessage('An authenticator is already linked. Enter its current six-digit code below.');
    } else {
      updateSetup({ type: 'started', setup: result.setup });
    }
  };
  const verify = async () => {
    await ensureCurrent();
    const factorId = setup?.id ?? pendingId ?? factor;
    if (!factorId || !/^\d{6}$/.test(code)) throw Object.assign(new Error('Enter six digits.'), { code: 'invalid_totp_code' });
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    if (error) throw error;
    if (!active.current) return;
    setCode(''); updateSetup({ type: 'reset' }); await refetchRole(); await load();
  };
  const accept = async (id: string) => {
    await ensureCurrent();
    const { data } = await supabase.auth.getSession();
    if (data.session?.user.id !== owner) throw new Error('Account changed.');
    const { error } = await supabase.rpc('accept_staff_invitation', { p_id: id }).setHeader('Authorization', `Bearer ${data.session.access_token}`);
    if (error) throw error;
    await refetchRole(); await load();
    if (active.current) setMessage('Branch invitation accepted.');
  };
  return <Screen title="Account security" contentStyle={{ gap: 16 }}><PageHeading eyebrow="PEACE OF MIND" title="Account security" subtitle="Protect your account and manage branch invitations." />
    <Text>Staff and administrators must verify an authenticator code before opening branch or administration tools. Keep setup codes private.</Text>
    {ready ? <Text className="text-green-800 font-bold">Authenticator verified for this session.</Text> : setup ? <View className="gap-3">
      <Text>Scan with your authenticator, or enter this setup key there. Then enter the six-digit code below.</Text>
      <SecretQr uri={setup.uri} /><Text selectable>{setup.secret}</Text>
    </View> : pendingId ? <Text>Your setup key is hidden after leaving the app. If you added Pogo’s to your authenticator, enter its current six-digit code below. You can finish this setup without creating a new key.</Text> : factor ? <Text>Enter the current six-digit code from your authenticator.</Text> : <Button disabled={busy || !loaded} onPress={() => { void run(enrol, 'enroll'); }}>Set up authenticator</Button>}
    {!ready && (setup || pendingId || factor) ? <><Input accessibilityLabel="Authenticator code" value={code} onChangeText={value => setCode(value.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" maxLength={6} autoComplete="one-time-code" />
      {!setup && !pendingId && factors.length > 1 ? factors.map((item, index) => <Button key={item.id} disabled={busy} variant={factor === item.id ? 'default' : 'outline'} onPress={() => setFactor(item.id)}>{item.friendly_name || `Authenticator ${index + 1}`}</Button>) : null}
      <Button isLoading={busy} disabled={!loaded} onPress={() => { void run(verify, 'verify'); }}>Verify code</Button></> : null}
    {!ready && pendingId && !setup ? <View className="gap-2"><Text className="text-subtle">If you did not add the key to your authenticator, start again. This replaces the unfinished key; use only the new key afterwards.</Text><Button variant="outline" disabled={busy || !loaded} onPress={() => { void run(enrol, 'enroll'); }}>Start setup again</Button></View> : null}
    {message ? <Text accessibilityRole="alert">{message}</Text> : null}
    {developerAccessAvailable && !ready ? <View className="bg-amber-50 border border-amber-200 rounded-2xl p-4 gap-3">
      <Text className="font-bold text-amber-900">Temporary developer access</Text>
      <Text className="text-amber-900">For the named development accounts and their existing roles. This does not verify an authenticator. Sessions last up to eight hours and all exceptions end on 11 November.</Text>
      {developerAccessExpiresAt ? <Text className="text-amber-900">Expires: {new Date(developerAccessExpiresAt).toLocaleString()}</Text> : null}
      <Button variant="outline" disabled={busy} onPress={() => { void run(async () => {
        if (developerAccess) await stopDeveloperAccess();
        else { await startDeveloperAccess(); router.replace('/(app)/dashboard'); }
      }, 'invite'); }}>{developerAccess ? 'End developer access' : 'Use developer bypass'}</Button>
    </View> : null}
    {ready ? <>
      <Text className="text-lg font-bold">Branch invitations</Text>
      <Text>Only invitations for your verified account email appear here. Ask your branch manager if you expected one.</Text>
      {invitations.map(invitation => <View key={invitation.id} className="p-4 border border-line rounded-xl gap-3">
        <Text className="font-bold">{invitation.store_name}</Text><Text>Expires {new Date(invitation.expires_at).toLocaleString()}</Text>
        <Button disabled={busy} onPress={() => { void run(() => accept(invitation.id), 'invite'); }}>Accept branch invitation</Button>
      </View>)}
      <Button disabled={busy} onPress={() => router.replace(destination)}>Continue to Pogo’s</Button>
    </> : null}
    <Button variant="ghost" disabled={busy} onPress={() => { void run(load, 'load'); }}>Refresh security settings</Button>
    <Text>If you lose your authenticator, contact the branch manager. Password recovery does not bypass staff MFA.</Text>
    <Button variant="ghost" disabled={busy} onPress={() => { void run(async () => { const result = await signOut(); if (result.error) throw result.error; router.replace('/(auth)/login'); }, 'signout'); }}>Sign out</Button>
  </Screen>;
}
export default function Security() {
  const { returnTo }=useLocalSearchParams<{returnTo?:string}>();
  const { user, loading, recoveryRequired } = useAuth();
  if (loading) return <View />;
  if (!user) return <Redirect href="/(auth)/login" />;
  if (recoveryRequired) return <Redirect href="/auth/reset-password" />;
  return <SecurityContent key={user.id} owner={user.id} destination={returnTo==='/privacy'?'/privacy':returnTo==='/notifications'?'/notifications':'/(app)/dashboard'} />;
}
