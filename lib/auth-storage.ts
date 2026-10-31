import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { createSessionStorage, createBrowserSessionStorage, type KeyValueStorage } from './session-storage';
import { runtimeEnvironment } from './environment';

export const authStorageKey = `sb-${runtimeEnvironment.supabaseProjectRef}-auth-token`;
// Browser sessions are memory-only: refresh requires login. No bearer tokens
// are written to localStorage/AsyncStorage on web.
const webStorage = createBrowserSessionStorage(AsyncStorage, {
  async getItem(key) { return typeof window === 'undefined' ? null : window.sessionStorage.getItem(key); },
  async setItem(key, value) { if (typeof window === 'undefined') throw new Error('Browser storage is unavailable.'); window.sessionStorage.setItem(key, value); },
  async removeItem(key) { if (typeof window !== 'undefined') window.sessionStorage.removeItem(key); },
});
export const authStorage: KeyValueStorage = Platform.OS === 'web' ? webStorage : createSessionStorage({
  getItem: key => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }),
  removeItem: key => SecureStore.deleteItemAsync(key),
}, AsyncStorage);
export const recoveryStorageKey = `${authStorageKey}-recovery`;
export const logoutStorageKey = `${authStorageKey}-logout`;
