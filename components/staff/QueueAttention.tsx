import { useState, useEffect, useRef } from 'react';
import { View, Text, AccessibilityInfo } from 'react-native';
import { TouchTarget as TouchableOpacity } from '@/components/ui/touch-target';
import { createQueueAttention, type BranchSnapshot } from '@/lib/branch-operations';
import { prepareBranchSound, playBranchSound, clearBranchSounds } from '@/lib/branch-alert';

export function QueueAttention({ snapshot, fresh, active }: { snapshot: BranchSnapshot | null; fresh: boolean; active: boolean }) {
  const attention = useRef(createQueueAttention());
  const [sound, setSound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [silenced, setSilenced] = useState(false);
  const current = useRef({ active, fresh, sound }); current.current = { active, fresh, sound };
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; void clearBranchSounds().catch(() => {}); }; }, []);
  useEffect(() => {
    if (!active) { void clearBranchSounds().catch(() => {}); return; }
    const tick = () => {
      if (!current.current.fresh || !snapshot) return;
      const state = attention.current.observe(snapshot.pending.signal, snapshot.pending.count, Date.now());
      setSilenced(!state.needsAttention);
      if (state.alert) {
        AccessibilityInfo.announceForAccessibility(`${snapshot.pending.count} cash orders awaiting branch acceptance.`);
        if (current.current.sound) void playBranchSound(() => mounted.current && current.current.active && current.current.fresh && current.current.sound).catch(() => {
          if (mounted.current) { setSound(false); setMessage('Sound could not be confirmed. Check device settings and test again.'); }
        });
      }
    };
    tick(); const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [active, snapshot]);
  const testSound = async () => {
    setBusy(true); setMessage('');
    try {
      await prepareBranchSound();
      if (!mounted.current || !current.current.active) return;
      await playBranchSound(() => mounted.current && current.current.active);
      if (mounted.current && current.current.active) { setSound(true); setMessage('Sound enabled. Confirm you heard the test; device volume and silent settings still apply.'); }
    } catch { if (mounted.current) { setSound(false); setMessage('Sound is unavailable or blocked. Use the visible queue and check device settings.'); } }
    finally { if (mounted.current) setBusy(false); }
  };
  return <View className={`p-4 rounded-xl mb-4 border ${snapshot?.pending.count ? 'bg-amber-50 border-amber-400' : 'bg-white border-line'}`}>
    <Text accessibilityRole="header" className="font-bold text-lg">{snapshot ? `${snapshot.pending.count} cash orders awaiting acceptance` : 'Checking branch attention'}</Text>
    {snapshot?.pending.overdue_count ? <Text>{snapshot.pending.overdue_count} past the acceptance deadline. Close expired requests or contact support.</Text> : null}
    <Text className="mt-2">Foreground alerts work while this screen is open and current. Keep a staff device attended; background push delivery is not enabled by this control.</Text>
    <TouchableOpacity accessibilityRole="button" disabled={busy || !active} onPress={() => { if (sound) { setSound(false); void clearBranchSounds().catch(() => {}); } else void testSound(); }} className="py-3">
      <Text>{sound ? 'Turn sound off' : 'Enable and test sound'}</Text>
    </TouchableOpacity>
    {snapshot && snapshot.pending.count > 0 ? <TouchableOpacity accessibilityRole="button" disabled={silenced || !fresh} onPress={() => { attention.current.acknowledge(); setSilenced(true); }} className="py-3">
      <Text>{silenced ? 'Reminders silenced for this batch' : 'Silence reminders for this batch'}</Text>
    </TouchableOpacity> : null}
    <Text className="text-subtle">Silencing reminders does not accept an order. Use “Accept order” in its card.</Text>
    {message ? <Text accessibilityRole="alert" className="mt-2">{message}</Text> : null}
  </View>;
}
