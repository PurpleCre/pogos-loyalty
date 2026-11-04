import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, AppState, ActivityIndicator } from 'react-native';
import { TouchTarget as TouchableOpacity } from '@/components/ui/touch-target';
import Svg, { Path, Rect } from 'react-native-svg';
import qrcode from 'qrcode-generator';
import * as Clipboard from 'expo-clipboard';
import { getRewardTicket, rewardError } from '@/lib/reward-orders';
import { remainingTicketMs, type RewardTicket as Ticket } from '@/lib/reward-redemption';
function TicketCode({ code }: { code: string }) {
  const qr = useMemo(() => {
    const value = qrcode(0, 'M'); value.addData(`pogos:reward:${code}`); value.make();
    const count = value.getModuleCount(); let path = '';
    for (let row = 0; row < count; row++) for (let col = 0; col < count; col++) if (value.isDark(row, col)) path += `M${col + 4},${row + 4}h1v1h-1z `;
    return { size: count + 8, path };
  }, [code]);
  return <View accessibilityLabel="Single-use reward claim QR code" className="items-center my-4">
    <Svg width={240} height={240} viewBox={`0 0 ${qr.size} ${qr.size}`}><Rect width={qr.size} height={qr.size} fill="white" /><Path d={qr.path} fill="black" /></Svg>
    <Text selectable className="text-xs text-center mt-3 text-subtle">{code}</Text>
  </View>;
}
export function RewardTicket({ owner, reservationId }: { owner: string; reservationId: string }) {
  const [value, setValue] = useState<{ ticket: Ticket; receivedAt: number } | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);
  const revision = useRef(0);
  useEffect(() => {
    mounted.current = true;
    const listener = AppState.addEventListener('change', state => { if (state !== 'active') { setValue(null); setBusy(false); revision.current++; } });
    return () => { mounted.current = false; listener.remove(); };
  }, []);
  useEffect(() => {
    if (!value) return;
    const tick = () => setRemaining(remainingTicketMs(value.ticket, value.receivedAt, performance.now()));
    tick(); const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [value]);
  const show = async () => {
    const version = ++revision.current;
    setBusy(true); setError('');
    try {
      const ticket = await getRewardTicket(owner, reservationId);
      if (!mounted.current || revision.current !== version) return;
      const receivedAt = performance.now();
      setRemaining(remainingTicketMs(ticket, receivedAt, receivedAt)); setValue({ ticket, receivedAt });
    } catch (err) { if (mounted.current && revision.current === version) setError(rewardError(err)); }
    finally { if (mounted.current && revision.current === version) setBusy(false); }
  };
  const copy = async () => {
    if (value?.ticket.claim_code && remaining > 0) await Clipboard.setStringAsync(value.ticket.claim_code);
  };
  return <View className="my-3">
    <Text className="text-subtle">Show this single-use ticket only to staff at your collection branch. Keep it private.</Text>
    {value?.ticket.claim_code && remaining > 0 ? <>
      <TicketCode code={value.ticket.claim_code} />
      <Text className="text-center text-subtle">Code expires in {Math.ceil(remaining / 60000)} minutes</Text>
      <TouchableOpacity onPress={() => { void copy().catch(() => setError('Unable to copy the code. Show the QR to staff.')); }} className="p-3"><Text className="text-brand-800 text-center font-bold">Copy code</Text></TouchableOpacity>
    </> : value ? <Text className="text-amber-800 my-3">This ticket is no longer available. Refresh your reservation; an expired untouched hold can be released below.</Text> : null}
    <TouchableOpacity disabled={busy} onPress={() => { void show(); }} className="p-3 bg-slate-100 rounded-lg"><Text className="font-bold text-center">{busy ? 'Loading…' : value ? 'Refresh ticket' : 'Show collection ticket'}</Text></TouchableOpacity>
    {busy ? <ActivityIndicator color="#dc2626" /> : null}
    {error ? <Text className="text-red-700 mt-2">{error}</Text> : null}
  </View>;
}
