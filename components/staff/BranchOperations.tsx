import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Input as TextInput } from '@/components/ui/input';
import { TouchTarget as TouchableOpacity } from '@/components/ui/touch-target';
import { supabase } from '@/lib/supabase';
import { accessTokenFor } from '@/lib/cash-orders';
import { branchRecovery, submitBranchCommand } from '@/lib/branch-api';
import { branchMenuPageSchema, type BranchMenuItem, type BranchSnapshot, type BranchCommand, type PendingBranchCommand } from '@/lib/branch-operations';
import { staffError } from '@/lib/staff-orders';
import { z } from 'zod';
const historySchema = z.array(z.object({ id: z.uuid(), action: z.enum(['intake', 'availability']), value: z.boolean(),
  menu_item_id: z.uuid().nullable(), created_at: z.string(), reason: z.string(), was_actor: z.boolean() }));

interface Props {
  owner: string; branchId: string; snapshot: BranchSnapshot | null; fresh: boolean; blocked: boolean;
  showMenu: boolean; active: boolean; onRefresh(): Promise<void>;
}
export function BranchOperations({ owner, branchId, snapshot, fresh, blocked, showMenu, active, onRefresh }: Props) {
  const [items, setItems] = useState<BranchMenuItem[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingBranchCommand | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [menuError, setMenuError] = useState('');
  const [reason, setReason] = useState('');
  const [target, setTarget] = useState<BranchCommand | null>(null);
  const [search, setSearch] = useState('');
  const [history, setHistory] = useState<{ id: string; text: string }[]>([]);
  const [historyCursor, setHistoryCursor] = useState<{ time: string; id: string } | null>(null);
  const mounted = useRef(true);
  const revision = useRef(0);
  const activeRef = useRef(active); activeRef.current = active;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; revision.current++; }; }, []);
  const loadPending = useCallback(async () => {
    try {
      const value = await branchRecovery.load(owner);
      if (mounted.current) { setPending(value); setReady(true); }
    } catch { if (mounted.current) { setReady(false); setError('Saved branch action could not be read. Contact support before changing branch settings.'); } }
  }, [owner]);
  useEffect(() => { void loadPending(); }, [loadPending]);
  const loadMenu = useCallback(async (after: string | null = null) => {
    if (!activeRef.current) return;
    const request = ++revision.current;
    setLoading(true);
    try {
      const token = await accessTokenFor(owner);
      const { data, error: failure } = await supabase.rpc('list_branch_menu', { p_store_id: branchId, p_after: after ?? undefined, p_limit: 100 })
        .setHeader('Authorization', `Bearer ${token}`);
      if (failure) throw failure;
      const page = branchMenuPageSchema.parse(data);
      if (page.store_id !== branchId) throw new Error('Branch response could not be confirmed.');
      if (!mounted.current || !activeRef.current || request !== revision.current) return;
      setItems(previous => after ? [...previous.filter(item => !page.items.some(row => row.id === item.id)), ...page.items] : page.items);
      setNext(page.next_after); setMenuError('');
    } catch (failure) { if (mounted.current && request === revision.current) setMenuError(staffError(failure)); }
    finally { if (mounted.current && request === revision.current) setLoading(false); }
  }, [owner, branchId]);
  useEffect(() => {
    if (!showMenu || !active) { revision.current++; return; }
    void loadMenu();
    // Manual refresh replaces the full loaded list; pagination remains explicit.
  }, [showMenu, active, loadMenu]);
  const run = async (recover = false) => {
    if (!recover && (!fresh || !target || blocked || !ready)) return;
    setBusy(true); setError('');
    try {
      if (recover) await branchRecovery.recover(owner, value => submitBranchCommand(owner, value));
      else if (target) await branchRecovery.execute(owner, { ...target, reason }, value => submitBranchCommand(owner, value));
      if (mounted.current) { setTarget(null); setReason(''); setError('Branch action confirmed.'); }
    } catch (failure) { if (mounted.current) setError(staffError(failure)); }
    finally {
      await loadPending();
      if (mounted.current) { setBusy(false); await onRefresh(); if (showMenu) await loadMenu(); }
    }
  };
  const readHistory = async (older = false) => {
    setBusy(true);
    try {
      const token = await accessTokenFor(owner);
      const { data, error: failure } = await supabase.rpc('branch_operations_history', {
        p_store_id: branchId, p_before: older ? historyCursor?.time : undefined, p_before_id: older ? historyCursor?.id : undefined,
      }).setHeader('Authorization', `Bearer ${token}`);
      if (failure) throw failure;
      // Only fixed server fields are displayed; no customer information is loaded.
      const rows = historySchema.parse(data);
      if (mounted.current) {
        const entries = rows.map(row => ({ id: row.id, text: `${row.action === 'intake' ? (row.value ? 'Intake paused' : 'Intake resumed') : (row.value ? 'Item restored' : 'Item unavailable')} ${row.menu_item_id ?? ''} · ${row.created_at} · ${row.was_actor ? 'You' : 'Branch operator'} · ${row.reason}` }));
        setHistory(previous => older ? [...previous, ...entries] : entries);
        const last = rows.at(-1); setHistoryCursor(rows.length === 50 && last ? { time: last.created_at, id: last.id } : null);
        if (!rows.length && !older) setError('No branch changes recorded.');
      }
    } catch (failure) { if (mounted.current) setError(staffError(failure)); }
    finally { if (mounted.current) setBusy(false); }
  };
  const disabled = !fresh || blocked || busy || !ready || !!pending;
  const choose = (command: BranchCommand) => { setTarget(command); setReason(''); setError(''); };
  return <View className="bg-white border border-line rounded-xl p-4 mb-4">
    <Text className="font-bold text-lg">Branch intake</Text>
    <Text>{!snapshot?.configured ? 'Awaiting approved branch configuration' : snapshot.paused ? 'App intake paused' : 'App intake is not paused'}</Text>
    {snapshot && (!snapshot.enabled || !snapshot.pricing_approved || !snapshot.fulfilment_enabled || !snapshot.branch_open) ?
      <Text className="text-amber-800 mt-2">Launch, pricing, fulfilment and opening checks still apply. Resuming intake does not activate an unapproved branch.</Text> : null}
    <Text className="text-subtle mt-2">A pause stops new cash quotes and submissions. Continue resolving orders already received. Reward intake is managed separately.</Text>
    <TouchableOpacity accessibilityRole="button" disabled={disabled || !snapshot?.configured} className="bg-slate-100 rounded-lg p-3 my-2"
      onPress={() => snapshot && choose({ storeId: branchId, expectedVersion: snapshot.version, action: 'intake', value: !snapshot.paused, reason: '', itemId: null })}>
      <Text>{snapshot?.paused ? 'Resume cash intake…' : 'Pause cash intake…'}</Text>
    </TouchableOpacity>
    {pending ? <View className="bg-amber-50 p-3 my-2"><Text>Previous branch action needs checking · {pending.command.storeId === branchId ? 'this branch' : 'another assigned branch'}</Text>
      <Text>The change may already have succeeded.</Text><TouchableOpacity accessibilityRole="button" disabled={busy || !active} onPress={() => { void run(true); }} className="py-3"><Text>Check saved branch action</Text></TouchableOpacity></View> : null}
    {target ? <View className="bg-canvas p-3 my-2"><Text className="font-bold">Confirm {target.action === 'intake' ? (target.value ? 'pause intake' : 'resume intake') : 'item availability change'}</Text>
      <TextInput accessibilityLabel="Reason for branch change" placeholder="Reason (required)" value={reason} maxLength={300} onChangeText={setReason} className="border border-slate-300 rounded-lg p-3 my-2" />
      <TouchableOpacity accessibilityRole="button" disabled={disabled || reason.trim().length < 3} onPress={() => { void run(); }} className="bg-brand-800 p-3 rounded-lg"><Text className="text-white">Confirm change</Text></TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => setTarget(null)} className="py-3"><Text>Cancel</Text></TouchableOpacity></View> : null}
    {error ? <Text accessibilityRole="alert" className="text-amber-900 my-2">{error}</Text> : null}
    {showMenu ? <View className="mt-4">
      <Text className="font-bold text-lg">Item availability · this branch</Text>
      <Text>Shared menu items can be paused here without changing another branch. Catalogue-level restrictions still apply.</Text>
      <TextInput accessibilityLabel="Search loaded menu items" placeholder="Search loaded items" value={search} onChangeText={setSearch} className="border border-slate-300 p-3 rounded-lg my-3" />
      <TouchableOpacity accessibilityRole="button" disabled={loading || !active} onPress={() => { void loadMenu(); }} className="py-3"><Text>Refresh menu availability</Text></TouchableOpacity>
      {menuError ? <Text accessibilityRole="alert">Availability could not be refreshed: {menuError}</Text> : null}
      {items.filter(item => `${item.name} ${item.category}`.toLowerCase().includes(search.toLowerCase())).map(item => <View key={item.id} className="border-t border-line py-3">
        <Text className="font-bold">{item.name} · {item.category}</Text>
        <Text>{snapshot?.currency ?? 'Currency unconfirmed'} {item.price} · {!item.base_available ? 'Unavailable in approved catalogue' : item.branch_available ? 'Available here' : 'Unavailable here'}</Text>
        <TouchableOpacity accessibilityRole="button" disabled={disabled || !!menuError || loading} className="bg-slate-100 p-3 rounded-lg mt-2" onPress={() => choose({
          storeId: branchId, expectedVersion: item.version, action: 'availability', value: !item.branch_available, itemId: item.id, reason: '',
        })}><Text>{item.branch_available ? 'Mark unavailable here…' : 'Restore branch availability…'}</Text></TouchableOpacity>
      </View>)}
      {loading ? <ActivityIndicator /> : !items.length && !menuError ? <Text>No menu items configured.</Text> : null}
      {next ? <TouchableOpacity accessibilityRole="button" disabled={loading || !active} onPress={() => { void loadMenu(next); }} className="py-3"><Text>Load more items</Text></TouchableOpacity> : null}
    </View> : null}
    <TouchableOpacity accessibilityRole="button" disabled={busy || !active} onPress={() => { void readHistory(); }} className="py-3"><Text>View recent branch changes</Text></TouchableOpacity>
    {history.map(row => <Text key={row.id} className="text-subtle text-sm my-1">{row.text}</Text>)}
    {historyCursor ? <TouchableOpacity accessibilityRole="button" disabled={busy || !active} onPress={() => { void readHistory(true); }} className="py-3"><Text>Older branch changes</Text></TouchableOpacity> : null}
  </View>;
}
