// Disposable local-only build inputs. No .env loading or hosted project keys.
const payload = Buffer.from(JSON.stringify({ role: 'anon', ref: 'local' })).toString('base64url');
export const verificationEnvironment = {
  EXPO_NO_DOTENV: '1', EXPO_NO_TELEMETRY: '1', CI: '1', POGOS_BUILD_CHECK: '1',
  EXPO_PUBLIC_APP_ENV: 'development', EXPO_PUBLIC_SUPABASE_PROJECT_REF: 'local',
  EXPO_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321', EXPO_PUBLIC_SUPABASE_ANON_KEY: `eyJhbGciOiJIUzI1NiJ9.${payload}.offlineVerificationOnly`,
  EXPO_PUBLIC_GOOGLE_MAPS_API_KEY: '', ANDROID_MAPS_API_KEY: 'offline-android-map-key', IOS_MAPS_API_KEY: 'offline-ios-map-key', EXPO_PUBLIC_SENTRY_DSN: '',
  SENTRY_DISABLE_AUTO_UPLOAD: 'true',
  EXPO_PUBLIC_ERROR_REPORTING_ENABLED: 'false',
};
