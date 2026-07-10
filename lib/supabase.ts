import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import type { Database } from './types';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || "https://hsyibcyvujwwqygigepe.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhzeWliY3l2dWp3d3F5Z2lnZXBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzMzYyNTgsImV4cCI6MjA5ODkxMjI1OH0.WoLIFgWEOGCAr5JUmnRle0YSpXkgCfHfrYW8bnU3emI";

// Better formatting + Native adapter
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
        storage: AsyncStorage,
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
