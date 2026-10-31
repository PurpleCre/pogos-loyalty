import { validatePublicEnvironment } from '../config/environment.cjs';
import bindings from '../config/environments.json';
// Literal property access is required for Expo's public environment inlining.
export const runtimeEnvironment = validatePublicEnvironment({
  EXPO_PUBLIC_APP_ENV: process.env.EXPO_PUBLIC_APP_ENV,
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  EXPO_PUBLIC_SUPABASE_PROJECT_REF: process.env.EXPO_PUBLIC_SUPABASE_PROJECT_REF,
}, bindings);
