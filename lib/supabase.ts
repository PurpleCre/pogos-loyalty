import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import type { Database } from './types';

import { runtimeEnvironment } from './environment';
import { authStorage, authStorageKey } from './auth-storage';

// Better formatting + Native adapter
export const supabase = createClient<Database>(runtimeEnvironment.supabaseUrl, runtimeEnvironment.supabaseKey, {
    auth: {
        storage: authStorage,
        storageKey: authStorageKey,
        flowType: 'pkce',
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});

// Tells Supabase Auth to continuously refresh the session automatically if
// the app is in the foreground. This resolves JWT expired errors when the app 
// stays open in the background for longer than the token lifespan.
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
if (AppState.currentState !== 'active') supabase.auth.stopAutoRefresh();
