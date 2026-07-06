import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Database } from './types';

const SUPABASE_URL = "https://akxukhkkddfqodqmdtwx.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFreHVraGtrZGRmcW9kcW1kdHd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgyOTg4NzQsImV4cCI6MjA3Mzg3NDg3NH0.wWyRyAIU7XeffjIw8WHyVNeRhZl9sJF56QJFKcuSU3s";

// Better formatting + Native adapter
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});
