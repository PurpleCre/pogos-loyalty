import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, ScrollView, Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import Svg, { Path, Rect } from 'react-native-svg';
import qrcode from 'qrcode-generator';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { z } from 'zod';
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
function SecurityContent({ owner }: { owner: string }) {
  const { refetchRole, signOut } = useAuth();
  const [factor, setFactor] = useState<string | null>(null);
  const [factors, setFactors] = useState<{ id: string; friendly_name?: string }[]>([]);
  const [setup, setSetup] = useState<{ id: string; secret: string; uri: string } | null>(null);
  const [code, setCode] = useState(''); const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  const [invitations, setInvitations] = useState<z.infer<typeof invitationsSchema>>([]);
  const active = useRef(true); const version = useRef(0);
  const ensureCurrent = async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error || !active.current || AppState.currentState !== 'active' || data.session?.user.id !== owner) throw new Error('Account changed.');
  };
  const load = async () => {
    const revision = ++version.current;
    const [{ data, error }, assurance] = await Promise.all([supabase.auth.mfa.listFactors(), supabase.auth.mfa.getAuthenticatorAssuranceLevel()]);
    if (error || assurance.error) throw new Error('Unable to load security settings.');
    if (!active.current || revision !== version.current) return;
    setFactors(data.totp); setFactor(current => data.totp.some(item => item.id === current) ? current : data.totp[0]?.id ?? null); setReady(assurance.data.currentLevel === 'aal2');
    if (assurance.data.currentLevel === 'aal2') {
      const result = await supabase.rpc('my_staff_invitations');
      if (result.error) throw new Error('Unable to load invitations.');
      if (active.current && revision === version.current) setInvitations(invitationsSchema.parse(result.data));
    }
  };
  useEffect(() => {
    active.current = true;
    void load().catch(() => { if (active.current) setMessage('Unable to load security settings. Try again.'); });
    const listener = AppState.addEventListener('change', state => {
      if (state !== 'active') { ++version.current; setSetup(null); setCode(''); setInvitations([]); setReady(false); }
      else void load().catch(() => { if (active.current) setMessage('Refresh your security settings before continuing.'); });
    });
    return () => { active.current = false; ++version.current; listener.remove(); };
  }, [owner]);
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setMessage('');
    try { await action(); }
    catch { if (active.current) setMessage('Unable to complete this security action. Check your code and connection, then try again.'); }
    finally { if (active.current) setBusy(false); }
  };
  const enrol = async () => {
    await ensureCurrent();
    const revision = ++version.current;
    const listed = await supabase.auth.mfa.listFactors();
    if (listed.error) throw listed.error;
    for (const item of listed.data.all.filter(item => item.factor_type === 'totp' && item.status === 'unverified')) {
      await ensureCurrent();
      const removed = await supabase.auth.mfa.unenroll({ factorId: item.id }); if (removed.error) throw removed.error;
    }
    await ensureCurrent();
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Pogo’s authenticator' });
    if (error) throw error;
    if (active.current && version.current === revision) setSetup({ id: data.id, secret: data.totp.secret, uri: data.totp.uri });
  };
  const verify = async () => {
    await ensureCurrent();
    const factorId = setup?.id ?? factor;
    if (!factorId || !/^\d{6}$/.test(code)) throw new Error('Enter six digits.');
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    if (error) throw error;
    if (!active.current) return;
    setCode(''); setSetup(null); await refetchRole(); await load();
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
  return <ScrollView className="flex-1 bg-white" contentContainerStyle={{ padding: 24, paddingTop: 64, gap: 16 }} keyboardShouldPersistTaps="handled">
    <Text className="text-2xl font-bold">Account security</Text>
    <Text>Staff and administrators must verify an authenticator code before opening branch or administration tools. Keep setup codes private.</Text>
    {ready ? <Text className="text-green-800 font-bold">Authenticator verified for this session.</Text> : setup ? <View className="gap-3">
      <Text>Scan with your authenticator, or enter this setup key there. Then enter the six-digit code below.</Text>
      <SecretQr uri={setup.uri} /><Text selectable>{setup.secret}</Text>
    </View> : factor ? <Text>Enter the current six-digit code from your authenticator.</Text> : <Button disabled={busy} onPress={() => { void run(enrol); }}>Set up authenticator</Button>}
    {!ready && (setup || factor) ? <><Input accessibilityLabel="Authenticator code" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} autoComplete="one-time-code" />
      {!setup && factors.length > 1 ? factors.map((item, index) => <Button key={item.id} disabled={busy} variant={factor === item.id ? 'default' : 'outline'} onPress={() => setFactor(item.id)}>{item.friendly_name || `Authenticator ${index + 1}`}</Button>) : null}
      <Button isLoading={busy} onPress={() => { void run(verify); }}>Verify code</Button></> : null}
    {message ? <Text accessibilityRole="alert">{message}</Text> : null}
    {ready ? <>
      <Text className="text-lg font-bold">Branch invitations</Text>
      <Text>Only invitations for your verified account email appear here. Ask your branch manager if you expected one.</Text>
      {invitations.map(invitation => <View key={invitation.id} className="p-4 border border-slate-200 rounded-xl gap-3">
        <Text className="font-bold">{invitation.store_name}</Text><Text>Expires {new Date(invitation.expires_at).toLocaleString()}</Text>
        <Button disabled={busy} onPress={() => { void run(() => accept(invitation.id)); }}>Accept branch invitation</Button>
      </View>)}
      <Button disabled={busy} onPress={() => router.replace('/(app)/dashboard')}>Continue to Pogo’s</Button>
    </> : null}
    <Button variant="ghost" disabled={busy} onPress={() => { void run(load); }}>Refresh security settings</Button>
    <Text>If you lose your authenticator, contact the branch manager. Password recovery does not bypass staff MFA.</Text>
    <Button variant="ghost" disabled={busy} onPress={() => { void run(async () => { const result = await signOut(); if (result.error) throw result.error; router.replace('/(auth)/login'); }); }}>Sign out</Button>
  </ScrollView>;
}
export default function Security() {
  const { user, loading, recoveryRequired } = useAuth();
  if (loading) return <View />;
  if (!user) return <Redirect href="/(auth)/login" />;
  if (recoveryRequired) return <Redirect href="/auth/reset-password" />;
  return <SecurityContent key={user.id} owner={user.id} />;
}
