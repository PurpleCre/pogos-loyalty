import { useEffect, useRef, useState } from 'react';
import { View, Text } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import type { Store } from '@/hooks/useStores';
import { supabase } from '@/lib/supabase';
import { accessTokenFor } from '@/lib/cash-orders';
import { normaliseEmail } from '@/lib/identity';
import { newSubmissionKey } from '@/lib/cash-checkout';
import type { Tables } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
export function StaffInvitations({ stores }: { stores: Store[] }) {
  const { user, userRole } = useAuth();
  const owner = user?.id;
  const [email, setEmail] = useState(''); const [branch, setBranch] = useState('');
  const [reason, setReason] = useState(''); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  const [invitations, setInvitations] = useState<Tables<'staff_invitations'>[]>([]);
  const currentOwner = useRef(owner); currentOwner.current = owner;
  const request = useRef<{ body: string; id: string } | null>(null);
  const load = async () => {
    if (!owner || userRole !== 'admin') return;
    const token = await accessTokenFor(owner);
    const { data, error } = await supabase.from('staff_invitations').select('*').is('accepted_at', null).is('revoked_at', null)
      .gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(100).setHeader('Authorization', `Bearer ${token}`);
    if (error) throw error;
    if (currentOwner.current === owner) setInvitations(data);
  };
  useEffect(() => { currentOwner.current = owner; void load().catch(() => { if (currentOwner.current === owner) setMessage('Unable to load invitations.'); }); return () => { currentOwner.current = undefined; }; }, [owner, userRole]);
  const perform = async (action: () => Promise<void>) => {
    setBusy(true); setMessage('');
    try { await action(); }
    catch { if (currentOwner.current === owner) setMessage('Unable to save. Check the email, branch, reason and connection, then retry.'); }
    finally { if (currentOwner.current === owner) setBusy(false); }
  };
  const invite = async () => {
    if (!owner) return;
    const recipient = normaliseEmail(email);
    if (!branch || reason.trim().length < 3) throw new Error('Missing invitation details.');
    const body = JSON.stringify({ owner, recipient, branch, reason: reason.trim() });
    if (request.current?.body !== body) request.current = { body, id: newSubmissionKey() };
    const token = await accessTokenFor(owner);
    const { error } = await supabase.rpc('invite_branch_staff', { p_id: request.current.id, p_email: recipient, p_store_id: branch, p_reason: reason.trim() })
      .setHeader('Authorization', `Bearer ${token}`);
    if (error) throw error;
    if (currentOwner.current !== owner) return;
    request.current = null; setEmail(''); setMessage('Invitation saved. Ask the recipient to sign in with this email, verify it, and open Profile → Account security to accept. No email was sent.');
    await load();
  };
  const revoke = async (id: string) => {
    if (!owner || reason.trim().length < 3) throw new Error('Provide a revocation reason.');
    const token = await accessTokenFor(owner);
    const { error } = await supabase.rpc('revoke_staff_invitation', { p_id: id, p_reason: reason.trim() }).setHeader('Authorization', `Bearer ${token}`);
    if (error) throw error;
    await load();
  };
  return <View className="p-4 bg-white rounded-xl border border-line gap-3 mb-4">
    <Text className="text-lg font-bold">Invite branch staff</Text>
    <Text>The recipient creates and verifies their own account. An invitation grants access only after they accept with MFA.</Text>
    <Input accessibilityLabel="Staff invitation email" placeholder="Staff email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" editable={!busy} />
    {stores.map(store => <Button key={store.id} disabled={busy} variant={branch === store.id ? 'default' : 'outline'} onPress={() => setBranch(store.id)}>{store.name}</Button>)}
    <Input accessibilityLabel="Staff access reason" placeholder="Reason for invitation or revocation" value={reason} onChangeText={setReason} editable={!busy} maxLength={500} />
    <Button isLoading={busy} onPress={() => { void perform(invite); }}>Create branch invitation</Button>
    {message ? <Text accessibilityRole="alert">{message}</Text> : null}
    <Text className="font-bold">Pending invitations</Text>
    {invitations.map(invitation => <View key={invitation.id} className="border-t border-line pt-3 gap-2">
      <Text>{invitation.email} · {stores.find(store => store.id === invitation.store_id)?.name ?? 'Branch'}</Text>
      <Button variant="outline" disabled={busy} onPress={() => { void perform(() => revoke(invitation.id)); }}>Revoke invitation using reason above</Button>
    </View>)}
    <Button variant="ghost" disabled={busy} onPress={() => { void perform(load); }}>Refresh invitations</Button>
  </View>;
}
