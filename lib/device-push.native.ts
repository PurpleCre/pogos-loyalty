import 'react-native-get-random-values';
import * as SecureStore from 'expo-secure-store';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import { createPushInstallationManager, type PushInstallation } from './push-installation';
import { runtimeEnvironment } from './environment';
import { supabase } from './supabase';
import { accessTokenFor } from './cash-orders';
export const pushSupported = Device.isDevice && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
const manager = createPushInstallationManager({
  getItem: key => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }),
}, `pogos.push.${runtimeEnvironment.supabaseProjectRef}`);
async function timed<T>(milliseconds: number, operation: (signal: AbortSignal) => PromiseLike<T>): Promise<T> {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), milliseconds);
  try { return await operation(controller.signal); } finally { clearTimeout(timer); }
}
async function unregister(record: PushInstallation, token: string) {
  const { error } = await timed(5000, signal => supabase.rpc('unregister_push_device', { p_id: record.id, p_secret: record.secret })
    .setHeader('Authorization', `Bearer ${token}`).abortSignal(signal));
  if (error) throw Error('Device push removal could not be confirmed.');
}
export async function devicePushEnabled(owner: string) { const value = await manager.read(); return value?.enabledOwner === owner && value.confirmed; }
async function register(owner: string, isCurrent: () => boolean, prompt: boolean) {
  if (!pushSupported) throw Error('Use a physical device with a development or release app build.');
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('transactions', {
    name: 'Order and loyalty updates', importance: Notifications.AndroidImportance.HIGH, sound: 'default',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
  });
  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted && prompt) permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) { await disableDevicePush(owner); throw Error('Allow notifications in device settings to enable push.'); }
  const project = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (typeof project !== 'string') throw Error('This app has no approved push project.');
  const expoToken = (await Notifications.getExpoPushTokenAsync({ projectId: project })).data;
  await manager.enable(owner, isCurrent, async record => {
    const token = await accessTokenFor(owner);
    if (!isCurrent()) throw Error('Account changed.');
    const { data, error } = await timed(8000, signal => supabase.rpc('register_push_device', { p_id: record.id, p_secret: record.secret,
      p_token: expoToken, p_project: project, p_platform: Platform.OS }).setHeader('Authorization', `Bearer ${token}`).abortSignal(signal));
    if (error || !data || typeof data !== 'object' || Array.isArray(data) || data.id !== record.id || data.active !== true) throw Error('Device push registration could not be confirmed.');
  });
}
export async function enableDevicePush(owner: string, isCurrent: () => boolean) { await register(owner, isCurrent, true); }
export async function refreshDevicePush(owner: string, isCurrent: () => boolean) {
  if ((await manager.read())?.pendingRevocationOwner === owner) await disableDevicePush(owner);
  if ((await manager.read())?.enabledOwner === owner) await register(owner, isCurrent, false);
}
export async function disableDevicePush(owner: string) {
  await manager.disable(owner, async record => unregister(record, await accessTokenFor(owner)));
  await Notifications.dismissAllNotificationsAsync();
}
export async function disablePushForLogout(owner: string, token: string) {
  await manager.disable(owner, record => unregister(record, token));
  await Notifications.dismissAllNotificationsAsync();
}
