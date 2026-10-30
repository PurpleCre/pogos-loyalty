import { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { accessTokenFor } from '@/lib/cash-orders';
import { staffError } from '@/lib/staff-orders';
import type { Tables, Json } from '@/lib/types';

function OpeningReview({ account, name, owner, onReviewed }: { account: Tables<'loyalty_accounts'>; name: string; owner: string; onReviewed(): Promise<void> }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const approve = async () => {
    setBusy(true); setError('');
    try {
      const token = await accessTokenFor(owner);
      const { error: failure } = await supabase.rpc('approve_loyalty_opening', {
        p_user_id: account.user_id, p_expected_balance: account.opening_balance, p_reason: reason.trim(),
      }).setHeader('Authorization', `Bearer ${token}`);
      if (failure) throw failure;
      await onReviewed();
    } catch (err) { setError(staffError(err)); }
    finally { setBusy(false); }
  };
  return <View className="bg-white p-4 rounded-xl border border-slate-200 my-2">
    <Text className="font-bold">{name}</Text><Text selectable className="text-xs text-slate-500">{account.user_id}</Text>
    <Text className="mt-2">Opening balance: {account.opening_balance} points</Text>
    <Text>Historical earned: {account.opening_earned} · Redeemed: {account.opening_redeemed}</Text>
    <Text className="mt-2 text-slate-600">Compare these historical totals with the approved customer records. This review preserves the opening balance. Resolve discrepancies through the support process before approving.</Text>
    <Text className="mt-3 mb-1">Review evidence / reference</Text>
    <TextInput accessibilityLabel="Opening balance review evidence" maxLength={500} multiline value={reason} onChangeText={setReason}
      className="border border-slate-300 rounded-lg p-3" />
    <TouchableOpacity disabled={busy || reason.trim().length < 3} onPress={() => { void approve(); }}
      className={`p-3 rounded-lg mt-3 ${busy || reason.trim().length < 3 ? 'bg-slate-300' : 'bg-red-600'}`}>
      <Text className="text-white text-center font-bold">{busy ? 'Checking…' : 'Confirm opening balance reviewed'}</Text>
    </TouchableOpacity>
    {error ? <Text className="text-red-700 mt-2">{error}</Text> : null}
  </View>;
}
export function AdminLoyalty({ users }: { users: { id: string; full_name: string | null }[] }) {
  const { user, userRole } = useAuth();
  const owner = user?.id ?? null;
  const current = useRef(owner); current.current = owner;
  const [limit, setLimit] = useState(50);
  const [state, setState] = useState<{ owner: string; accounts: Tables<'loyalty_accounts'>[]; reconciliation: Json; more: boolean } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const refresh = async () => {
    if (!owner || userRole !== 'admin') return;
    setBusy(true); setError('');
    try {
      const token = await accessTokenFor(owner);
      const [accounts, check] = await Promise.all([
        supabase.from('loyalty_accounts').select('*').eq('opening_reviewed', false).order('user_id').limit(limit + 1).setHeader('Authorization', `Bearer ${token}`),
        supabase.rpc('loyalty_reconciliation').setHeader('Authorization', `Bearer ${token}`),
      ]);
      if (accounts.error) throw accounts.error;
      if (check.error) throw check.error;
      if (current.current === owner) setState({ owner, accounts: accounts.data.slice(0, limit), reconciliation: check.data, more: accounts.data.length > limit });
    } catch (err) { if (current.current === owner) setError(staffError(err)); }
    finally { if (current.current === owner) setBusy(false); }
  };
  useEffect(() => { void refresh(); }, [owner, userRole, limit]);
  const visible = state?.owner === owner ? state : null;
  if (!owner || userRole !== 'admin') return null;
  return <View>
    <Text className="text-xl font-bold mb-3">Loyalty opening review</Text>
    <Text className="text-slate-600">New paid orders on an unreviewed account wait for this check. After approval, open the branch order and retry earning. Refunds reverse the original earning once.</Text>
    <TouchableOpacity onPress={() => { void refresh(); }} disabled={busy} className="p-4"><Text className="text-red-600 font-bold">Refresh accounts and reconciliation</Text></TouchableOpacity>
    {busy ? <ActivityIndicator color="#dc2626" /> : null}
    {error ? <Text className="text-red-700 my-3">{error}</Text> : null}
    {visible ? <View className="p-4 bg-slate-100 rounded-xl mb-3">
      <Text className="font-bold">Ledger / balance projection check</Text>
      <Text>{Array.isArray(visible.reconciliation) && visible.reconciliation.length === 0 ? 'No balance differences in this check.' : JSON.stringify(visible.reconciliation)}</Text>
      <Text className="text-slate-500 mt-2">This compares the app’s ledger and balances. It does not confirm GAAP sales or physical cash.</Text>
    </View> : null}
    {visible?.accounts.map(account => <OpeningReview key={`${owner}:${account.user_id}`} account={account} owner={owner}
      name={users.find(row => row.id === account.user_id)?.full_name ?? 'Customer'} onReviewed={refresh} />)}
    {visible && !visible.accounts.length ? <Text className="text-slate-500 py-4">No unreviewed openings.</Text> : null}
    {visible?.more ? <TouchableOpacity onPress={() => setLimit(value => value + 50)} className="p-4"><Text className="text-red-600">Load more accounts</Text></TouchableOpacity> : null}
  </View>;
}
