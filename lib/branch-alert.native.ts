import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import './notification-handler';
const presented = new Set<string>();
export async function prepareBranchSound() {
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('branch-queue', {
    name: 'Attended branch order queue', importance: Notifications.AndroidImportance.HIGH, sound: 'default',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
  });
  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) permission = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } });
  if (!permission.granted || permission.ios?.allowsSound === false) throw new Error('Allow notification sound in device settings, then test again.');
  if (Platform.OS === 'android') {
    const channel = await Notifications.getNotificationChannelAsync('branch-queue');
    if (!channel || channel.importance < Notifications.AndroidImportance.DEFAULT || !channel.sound) throw new Error('Enable sound for the branch queue channel in device settings.');
  }
}
export async function playBranchSound(isCurrent: () => boolean) {
  const permission = await Notifications.getPermissionsAsync();
  if (!isCurrent()) return;
  if (!permission.granted || permission.ios?.allowsSound === false) throw new Error('Notification sound permission changed.');
  const id = await Notifications.scheduleNotificationAsync({ content: {
    title: 'Pogo’s branch queue', body: 'Check the attended order queue.', sound: 'default',
    data: { kind: 'branch-queue' },
  }, trigger: Platform.OS === 'android' ? { channelId: 'branch-queue' } : null });
  if (!isCurrent()) { await Notifications.dismissNotificationAsync(id); return; }
  presented.add(id);
  // The in-app badge owns ongoing attention. Avoid building a notification tray.
  if (presented.size > 3) { const oldest = presented.values().next().value; if (oldest) { presented.delete(oldest); await Notifications.dismissNotificationAsync(oldest); } }
}
export async function clearBranchSounds() {
  const ids = [...presented]; presented.clear();
  await Promise.all(ids.map(id => Notifications.dismissNotificationAsync(id)));
}
