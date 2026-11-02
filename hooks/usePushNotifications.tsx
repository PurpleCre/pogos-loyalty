import { createContext, useContext, useState, useRef, useEffect, type ReactNode } from 'react';
import * as Notifications from 'expo-notifications';
import { AppState, Platform } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from './useAuth';
import { setPushRecipient } from '@/lib/notification-handler';
import { pushSupported, devicePushEnabled, enableDevicePush, disableDevicePush, refreshDevicePush } from '@/lib/device-push';
import { transactionPayloadSchema, notificationDestination } from '@/lib/push-installation';
import { accessTokenFor } from '@/lib/cash-orders';
import { supabase } from '@/lib/supabase';
interface PushState { supported: boolean; enabled: boolean; busy: boolean; message: string; enable(): Promise<void>; disable(): Promise<void> }
const PushContext = createContext<PushState | null>(null);
export function usePushNotifications() { const value = useContext(PushContext); if (!value) throw Error('Push provider missing'); return value; }
export function PushNotificationsProvider({ children }: { children: ReactNode }) {
  const { user, loading, requiresMfa, recoveryRequired } = useAuth();
  const owner = user?.id ?? null;
  const permitted = !!owner && !loading && !requiresMfa && !recoveryRequired;
  const current = useRef({ owner, permitted }); current.current = { owner, permitted };
  setPushRecipient(permitted ? owner : null);
  const [state, setState] = useState({ owner, enabled: false, busy: false, message: '' });
  const visible = state.owner === owner ? state : { owner, enabled: false, busy: false, message: '' };
  const pendingResponse = useRef<Notifications.NotificationResponse | null>(null);
  const seen = useRef(new Set<string>());
  const mounted = useRef(true);
  const notice = (forOwner: string, message: string) => { if (mounted.current && current.current.owner === forOwner) setState(previous => ({ ...(previous.owner===forOwner?previous:{enabled:false,busy:false}), owner: forOwner, message })); };
  const handleTap = async (response: Notifications.NotificationResponse) => {
    const identity = current.current;
    if (!identity.owner || !identity.permitted) { pendingResponse.current = response; return; }
    pendingResponse.current = null;
    if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const parsed = transactionPayloadSchema.safeParse(response.notification.request.content.data);
    if (!parsed.success || parsed.data.recipient_id !== identity.owner || seen.current.has(parsed.data.event_id)) {
      await Notifications.clearLastNotificationResponseAsync(); return;
    }
    seen.current.add(parsed.data.event_id);
    if (seen.current.size > 200) seen.current.delete(seen.current.values().next().value!);
    try {
      const token = await accessTokenFor(identity.owner);
      const { data, error } = await supabase.rpc('resolve_transaction_notification', { p_id: parsed.data.event_id }).setHeader('Authorization', `Bearer ${token}`);
      if (error) throw error;
      if (current.current.owner === identity.owner && current.current.permitted) router.push(notificationDestination(data));
    } catch { notice(identity.owner, 'This update could not be opened. Check the updates inbox.'); }
    finally { await Notifications.clearLastNotificationResponseAsync(); }
  };
  const tapHandler = useRef(handleTap); tapHandler.current = handleTap;
  useEffect(() => {
    mounted.current = true;
    if (Platform.OS === 'web') return () => { mounted.current = false; };
    const listener = Notifications.addNotificationResponseReceivedListener(response => { void tapHandler.current(response).catch(() => {}); });
    void Notifications.getLastNotificationResponseAsync().then(response => { if (mounted.current && response) void tapHandler.current(response).catch(() => {}); }).catch(() => {});
    return () => { mounted.current = false; listener.remove(); setPushRecipient(null); };
  }, []);
  useEffect(() => {
    if (!owner || !permitted || !pushSupported) return;
    let cancelled = false;
    const isCurrent = () => !cancelled && current.current.owner === owner && current.current.permitted;
    const refresh = async () => {
      try {
        await refreshDevicePush(owner, isCurrent);
        const enabled = await devicePushEnabled(owner);
        if (isCurrent()) setState(previous => ({ ...(previous.owner===owner?previous:{message:'',busy:false}), owner, enabled }));
      } catch { if (isCurrent()) notice(owner, 'Push needs checking. Open the updates inbox to retry device setup.'); }
    };
    void refresh();
    if (pendingResponse.current) void tapHandler.current(pendingResponse.current).catch(() => {});
    const foreground = AppState.addEventListener('change', next => { if (next === 'active') void refresh(); });
    const rotation = Notifications.addPushTokenListener(() => { void refresh(); });
    const timer = setInterval(() => { if (AppState.currentState === 'active') void refresh(); }, 30 * 60000);
    return () => { cancelled = true; foreground.remove(); rotation.remove(); clearInterval(timer); };
  }, [owner, permitted]);
  const change = async (enable: boolean) => {
    if (!owner || !permitted || visible.busy) return;
    setState({ owner, enabled: visible.enabled, busy: true, message: '' });
    try {
      if (enable) await enableDevicePush(owner, () => current.current.owner === owner && current.current.permitted);
      else await disableDevicePush(owner);
      if (current.current.owner === owner) setState({ owner, enabled: enable, busy: false, message: enable ? 'Device setup saved. Check the inbox if a notification does not arrive.' : 'Push disabled for this device.' });
    } catch {
      if (current.current.owner === owner) {
        const enabled = await devicePushEnabled(owner).catch(() => false);
        setState({ owner, enabled, busy: false, message: 'Device notifications could not be confirmed. Check your connection and notification permissions, then retry. Contact support if this continues.' });
      }
    }
  };
  return <PushContext.Provider value={{ supported: pushSupported, enabled: visible.enabled, busy: visible.busy,
    message: visible.message, enable: () => change(true), disable: () => change(false) }}>{children}</PushContext.Provider>;
}
