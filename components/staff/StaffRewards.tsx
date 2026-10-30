import { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, ActivityIndicator, AppState } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useAuth } from '@/hooks/useAuth';
import { useRewardReservations, type RewardReservation } from '@/hooks/useRewardReservations';
import { lookupRewardClaim, rewardError } from '@/lib/reward-orders';
import { parseRewardClaim, type RewardLookup, type RewardRequest } from '@/lib/reward-redemption';
import { snapshotText } from '@/lib/cash-checkout';
import { RewardRecovery } from '@/components/rewards/RewardRecovery';
function Action({ label, disabled, onPress }: { label: string; disabled?: boolean; onPress(): void }) {
  return <TouchableOpacity disabled={disabled} onPress={onPress} className={`p-3 my-1 rounded-lg ${disabled ? 'bg-slate-300' : 'bg-red-600'}`}><Text className="text-white text-center font-bold">{label}</Text></TouchableOpacity>;
}
function ReservationCard({ row, actor, admin, blocked, execute }: { row: RewardReservation; actor: string; admin: boolean; blocked: boolean; execute(request: RewardRequest): Promise<unknown> }) {
  const [panel, setPanel] = useState<'fulfil' | 'release' | 'void' | null>(null);
  const [reason, setReason] = useState('');
  const [reference, setReference] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [history, setHistory] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const responsible = row.claimed_by === actor;
  const canResolveClaim = row.status === 'claiming' && (responsible || admin);
  const submit = async () => {
    if (!panel) return;
    setBusy(true); setError('');
    const details: Record<string, string | boolean> = {};
    if (reason.trim()) details.reason = reason.trim();
    if (panel === 'fulfil') Object.assign(details, { handover_confirmed: confirmed, gaap_reference: reference });
    if (panel === 'release' && row.status === 'claiming') details.benefit_not_provided = confirmed;
    if (panel === 'void') Object.assign(details, { benefit_not_provided: confirmed, credit_note_reference: reference });
    try { await execute({ kind: 'operate', reservationId: row.id, expectedVersion: row.version, action: panel, details }); setPanel(null); }
    catch (err) { setError(rewardError(err)); }
    finally { setBusy(false); }
  };
  const open = (value: typeof panel) => { setPanel(value); setReason(''); setReference(''); setConfirmed(false); setError(''); };
  const requiresReason = panel === 'release' || panel === 'void' || (panel === 'fulfil' && !responsible);
  const requiresConfirm = panel === 'fulfil' || panel === 'void' || (panel === 'release' && row.status === 'claiming');
  return <View className="bg-white border border-slate-200 p-4 rounded-xl mb-4">
    <Text className="font-bold text-lg">{snapshotText(row.snapshot, 'name')} · {row.status}</Text>
    <Text>{row.customer_name} · {row.points_cost} points</Text>
    <Text className="text-slate-500 mt-2">{snapshotText(row.snapshot, 'terms')}</Text>
    <Text className="mt-2">GAAP item: {snapshotText(row.snapshot, 'gaap_product_reference')}</Text>
    <Text className="text-xs text-slate-500 mt-2" selectable>{row.id}</Text>
    <Text className="text-slate-500 mt-2">Reservation expiry: {new Date(row.expires_at).toLocaleString()}</Text>
    {row.status === 'reserved' ? <>
      <Text className="text-slate-600 my-2">Scan the customer’s ticket above and start handover before giving out the item.</Text>
      <Action label="Release unused reservation…" disabled={blocked || busy} onPress={() => open('release')} />
    </> : null}
    {row.status === 'claiming' ? <View className="bg-amber-50 p-3 rounded-lg my-3">
      <Text className="font-bold">Handover {responsible ? 'assigned to you' : 'assigned to another operator'}</Text>
      <Text className="mt-2">This hold will not expire automatically. Check the item and GAAP entry, then confirm actual handover. Release only if the customer received no benefit.</Text>
      {canResolveClaim ? <>
        <Action label={responsible ? 'Confirm reward handed over…' : 'Record supervisor handover override…'} disabled={blocked || busy} onPress={() => open('fulfil')} />
        <Action label="No item provided: release points…" disabled={blocked || busy} onPress={() => open('release')} />
      </> : null}
    </View> : null}
    {row.fulfilments.map(entry => <Text selectable key={entry.reservation_id} className="text-slate-600 mt-2">GAAP sale: {entry.gaap_reference}</Text>)}
    {row.voids.map(entry => <Text selectable key={entry.reservation_id} className="text-slate-600 mt-2">GAAP credit note: {entry.credit_note_reference}</Text>)}
    {admin && row.status === 'fulfilled' ? <Action label="Correct mistaken fulfilment…" disabled={blocked || busy} onPress={() => open('void')} /> : null}
    {panel ? <View className="bg-slate-50 p-3 rounded-lg my-3">
      <Text className="font-bold mb-3">{panel === 'void' ? 'Correction: no benefit was provided' : panel === 'fulfil' ? 'Confirm actual handover' : 'Release points and reserved item'}</Text>
      {panel === 'fulfil' || panel === 'void' ? <>
        <Text>{panel === 'fulfil' ? 'Full GAAP sale reference (date / till / sale)' : 'GAAP credit note reference (date / till / note)'}</Text>
        <TextInput accessibilityLabel="GAAP reward reference" value={reference} onChangeText={setReference} maxLength={160} autoCapitalize="none" className="border border-slate-300 p-3 rounded-lg my-2" />
      </> : null}
      <Text>Reason / evidence {requiresReason ? '(required)' : '(optional)'}</Text>
      <TextInput accessibilityLabel="Reward action reason" value={reason} onChangeText={setReason} maxLength={500} multiline className="border border-slate-300 p-3 rounded-lg my-2" />
      {requiresConfirm ? <TouchableOpacity accessibilityRole="checkbox" accessibilityState={{ checked: confirmed }} onPress={() => setConfirmed(value => !value)} className="py-3 flex-row">
        <Text className="mr-2">{confirmed ? '☑' : '☐'}</Text><Text className="flex-1">{panel === 'fulfil' ? 'I handed this reward to the customer and recorded its GAAP sale.' : 'The customer received no item or other benefit. I checked the evidence before releasing these points.'}</Text>
      </TouchableOpacity> : null}
      <Action label={busy ? 'Checking…' : 'Confirm action'} disabled={blocked || busy || (requiresReason && reason.trim().length < 3) || (requiresConfirm && !confirmed)} onPress={() => { void submit(); }} />
      <TouchableOpacity disabled={busy} onPress={() => setPanel(null)} className="p-3"><Text className="text-center">Close form</Text></TouchableOpacity>
    </View> : null}
    <TouchableOpacity onPress={() => setHistory(value => !value)} className="py-3"><Text className="text-slate-600 font-bold">{history ? 'Hide' : 'Show'} reward audit history</Text></TouchableOpacity>
    {history ? [...row.events].sort((a, b) => a.version - b.version).map(event => <View key={event.id} className="py-2 border-t border-slate-100">
      <Text>{event.event_type} · {new Date(event.created_at).toLocaleString()}</Text>
      <Text className="text-slate-500">{event.actor_id === row.user_id ? 'Customer' : event.actor_id === actor ? 'You' : event.actor_id ? 'Branch operator / administrator' : 'Expiry worker'}</Text>
      {snapshotText(event.details, 'reason') ? <Text>{snapshotText(event.details, 'reason')}</Text> : null}
    </View>) : null}
    {error ? <Text accessibilityRole="alert" className="text-red-700 mt-3">{error}</Text> : null}
  </View>;
}
export function StaffRewards({ branchId, enabled, externalBlocked = false }: { branchId: string | null; enabled: boolean; externalBlocked?: boolean }) {
  const { user, userRole } = useAuth();
  const { reservations, execute, recover, refresh, findReservation, loadMore, more, error, loading, pending, pendingError, busy } = useRewardReservations(branchId, true, enabled);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [claim, setClaim] = useState('');
  const [lookup, setLookup] = useState<{ value: RewardLookup; claim: string } | null>(null);
  const [locateId, setLocateId] = useState('');
  const [message, setMessage] = useState('');
  const [looking, setLooking] = useState(false);
  const alive = useRef(true); const lookupRevision = useRef(0);
  useEffect(() => {
    alive.current = true;
    const listener = AppState.addEventListener('change', state => {
      if (state !== 'active') { setScanning(false); setClaim(''); setLookup(null); setLooking(false); lookupRevision.current++; }
    });
    return () => { alive.current = false; lookupRevision.current++; listener.remove(); };
  }, []);
  const blocked = externalBlocked || busy || !!pending || !!pendingError;
  const check = async (input = claim) => {
    if (!user || !branchId) return;
    const version = ++lookupRevision.current;
    setLooking(true); setMessage(''); setLookup(null);
    try {
      const code = parseRewardClaim(input);
      const value = await lookupRewardClaim(user.id, branchId, code);
      if (alive.current && version === lookupRevision.current) setLookup({ value, claim: code });
    } catch (err) { if (alive.current && version === lookupRevision.current) setMessage(rewardError(err)); }
    finally { if (alive.current && version === lookupRevision.current) setLooking(false); }
  };
  const startHandover = async () => {
    if (!lookup) return;
    setMessage('');
    try {
      await execute({ kind: 'operate', reservationId: lookup.value.reservation_id, expectedVersion: lookup.value.version,
        action: 'begin', details: { claim_code: lookup.claim } });
      if (alive.current) { setLookup(null); setClaim(''); setMessage('Handover assigned to you. Confirm the item and GAAP entry, then complete the handover below.'); }
    } catch (err) { if (alive.current) setMessage(rewardError(err)); }
  };
  const openCamera = async () => {
    try {
      const result = permission?.granted ? permission : await requestPermission();
      if (alive.current && AppState.currentState === 'active') {
        if (result.granted) setScanning(true);
        else setMessage('Camera access is unavailable. Enter the customer’s complete claim code instead.');
      }
    } catch { if (alive.current) setMessage('Unable to open the camera. Enter the claim code instead.'); }
  };
  const recoverPrevious = async () => {
    setMessage('');
    try { await recover(); if (alive.current) setMessage('Previous reward action checked. Review its current state below.'); }
    catch (err) { if (alive.current) setMessage(rewardError(err)); }
  };
  if (!user || !['admin', 'staff'].includes(userRole)) return null;
  return <View>
    <Text className="font-bold text-xl mb-4">Reward collection</Text>
    <RewardRecovery pending={pending} error={pendingError} busy={busy} onRecover={() => { void recoverPrevious(); }} />
    {message || error ? <Text accessibilityRole="alert" className="text-red-700 mb-4">{message || error}</Text> : null}
    <View className="bg-white border border-slate-200 p-4 rounded-xl mb-4">
      <Text className="font-bold mb-2">Check the customer’s ticket</Text>
      <Text>Start handover here before giving out an item. Only the assigned operator can finish it, unless an administrator records an override.</Text>
      <Action label="Scan reward QR" disabled={blocked || looking || !branchId} onPress={() => { void openCamera(); }} />
      <TextInput accessibilityLabel="Customer reward claim code" secureTextEntry value={claim} onChangeText={value => { setClaim(value); setLookup(null); lookupRevision.current++; setLooking(false); }} maxLength={60}
        autoCapitalize="none" autoCorrect={false} placeholder="Or enter the complete claim code" className="border border-slate-300 p-3 rounded-lg mt-2" />
      <Action label={looking ? 'Checking…' : 'Check ticket'} disabled={blocked || looking || !claim.trim()} onPress={() => { void check(); }} />
      {lookup ? <View className="bg-slate-50 p-3 rounded-lg mt-3">
        <Text className="font-bold">{lookup.value.snapshot.name}</Text><Text>{lookup.value.customer_name} · {lookup.value.points_cost} points</Text>
        <Text className="my-2">{lookup.value.snapshot.terms}</Text>
        <Text>GAAP item: {lookup.value.snapshot.gaap_product_reference}</Text>
        <Action label="Start handover and assign to me" disabled={blocked} onPress={() => { void startHandover(); }} />
      </View> : null}
    </View>
    <TextInput accessibilityLabel="Reward reservation ID" value={locateId} onChangeText={setLocateId} autoCapitalize="none" placeholder="Find an older reservation by full ID" className="bg-white border border-slate-300 rounded-lg p-3" />
    <TouchableOpacity disabled={busy || !locateId.trim()} onPress={() => { void findReservation(locateId).catch(err => { if (alive.current) setMessage(rewardError(err)); }); }} className="p-3 mb-3"><Text className="text-red-600 font-bold">Find reservation</Text></TouchableOpacity>
    <TouchableOpacity onPress={() => { void refresh(); }} className="p-3"><Text className="text-red-600">Refresh worklist</Text></TouchableOpacity>
    {loading && !reservations.length ? <ActivityIndicator color="#dc2626" /> : null}
    {!loading && !reservations.length ? <Text className="text-slate-500 py-5">No outstanding reward reservations at this branch.</Text> : null}
    {reservations.map(row => <ReservationCard key={`${user.id}:${row.id}:${row.version}`} row={row} actor={user.id} admin={userRole === 'admin'} blocked={blocked} execute={execute} />)}
    {more ? <TouchableOpacity onPress={loadMore} className="p-3"><Text className="text-red-600">Load more reservations</Text></TouchableOpacity> : null}
    <Modal visible={scanning && enabled} onRequestClose={() => setScanning(false)} animationType="slide">
      <View className="flex-1 bg-black">
        <Text className="text-white font-bold text-xl px-5 pt-14 pb-5">Scan customer reward ticket</Text>
        {scanning && permission?.granted ? <CameraView style={{ flex: 1 }} barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={({ data }) => { setScanning(false); void check(data); }} /> : null}
        <TouchableOpacity onPress={() => setScanning(false)} className="p-6"><Text className="text-white text-center font-bold">Close scanner</Text></TouchableOpacity>
      </View>
    </Modal>
  </View>;
}
