// Pure validation shared by Expo config, runtime and offline tests. Never include
// credentials in an error; public-key shape checks do not verify JWT signatures.
function required(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Missing ${name}. Configure this environment explicitly.`);
  return value.trim();
}
function appEnvironment(values) {
  const name = values.EXPO_PUBLIC_APP_ENV || 'development';
  if (!['development', 'staging', 'production'].includes(name)) throw new Error('Invalid EXPO_PUBLIC_APP_ENV.');
  const updateTarget = values.POGOS_UPDATE_TARGET;
  if (updateTarget && (!['development', 'staging'].includes(updateTarget) || updateTarget !== name)) throw new Error('OTA target and app environment do not match.');
  const profile = values.EAS_BUILD_PROFILE;
  const expected = { development: 'development', 'development-apk': 'development', preview: 'staging', production: 'production' }[profile];
  if (profile && expected !== name) throw new Error('Build profile and app environment do not match.');
  return name;
}
function decodePayload(key) {
  const parts = key.split('.');
  if (parts.length !== 3 || !parts.every(part => /^[A-Za-z0-9_-]+$/.test(part))) throw new Error('Invalid public Supabase key format.');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let bits = 0; let buffer = 0; let decoded = '';
  for (const char of parts[1].replace(/-/g, '+').replace(/_/g, '/')) {
    const value = alphabet.indexOf(char);
    if (value < 0) throw new Error('Invalid public Supabase key format.');
    buffer = (buffer << 6) | value; bits += 6;
    if (bits >= 8) { bits -= 8; decoded += String.fromCharCode((buffer >> bits) & 255); }
  }
  try { return JSON.parse(decoded); } catch { throw new Error('Invalid public Supabase key payload.'); }
}
function validatePublicEnvironment(values, bindings) {
  const name = appEnvironment(values);
  const urlText = required(values.EXPO_PUBLIC_SUPABASE_URL, 'EXPO_PUBLIC_SUPABASE_URL');
  const key = required(values.EXPO_PUBLIC_SUPABASE_ANON_KEY, 'EXPO_PUBLIC_SUPABASE_ANON_KEY');
  let url;
  try { url = new URL(urlText); } catch { throw new Error('Invalid Supabase URL.'); }
  if (url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname)) throw new Error('Supabase URL must be a project origin.');
  const local = name === 'development' && values.EXPO_PUBLIC_SUPABASE_PROJECT_REF === 'local' &&
    ['127.0.0.1', 'localhost'].includes(url.hostname) && url.protocol === 'http:' && url.port === '54321';
  const binding = bindings[name];
  if (!binding) throw new Error('Environment binding is missing.');
  const reference = local ? 'local' : required(binding.supabaseProjectRef, `${name} Supabase project approval`);
  if (!local && (url.protocol !== 'https:' || url.port || url.hostname !== `${reference}.supabase.co`)) throw new Error('Supabase URL does not match the approved environment project.');
  if (values.EXPO_PUBLIC_SUPABASE_PROJECT_REF && values.EXPO_PUBLIC_SUPABASE_PROJECT_REF !== reference) throw new Error('Supabase project reference does not match this environment.');
  if (!local) for (const other of Object.keys(bindings).filter(other => other !== name)) {
    if (reference === bindings[other]?.supabaseProjectRef) throw new Error(`Environment cannot use the ${other} Supabase project.`);
  }
  if (key.startsWith('sb_secret_')) throw new Error('Server-only Supabase keys must never enter an app build.');
  if (!/^sb_publishable_[A-Za-z0-9_-]{16,}$/.test(key)) {
    const payload = decodePayload(key);
    if (payload.role !== 'anon') throw new Error('Only an anon or publishable Supabase key may enter the app.');
    if ((!local || payload.ref) && payload.ref !== reference) throw new Error('Supabase key belongs to a different project.');
  }
  return { name, supabaseUrl: url.origin, supabaseKey: key, supabaseProjectRef: reference };
}
function validateBuildBinding(values, bindings) {
  const publicConfig = validatePublicEnvironment(values, bindings);
  const binding = bindings[publicConfig.name];
  const verification = values.POGOS_BUILD_CHECK === '1';
  if (verification && (values.EAS_BUILD || values.EAS_BUILD_PROFILE || values.POGOS_PUBLISH === '1' || publicConfig.supabaseProjectRef !== 'local')) throw new Error('Offline build checks cannot target a hosted build or project.');
  if (!verification && (values.EAS_BUILD || values.POGOS_PUBLISH === '1') && publicConfig.supabaseProjectRef === 'local') throw new Error('Hosted builds and updates cannot use loopback development inputs.');
  if (verification) return { ...publicConfig, verification: true };
  const fields = ['expoOwner', 'expoProjectId', 'androidApplicationId', 'iosBundleIdentifier', 'scheme'];
  for (const field of fields) required(binding[field], `${publicConfig.name} ${field} approval`);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(binding.expoProjectId)) throw new Error('Invalid Expo project ID.');
  if (publicConfig.name !== 'development') {
    for (const other of Object.keys(bindings).filter(name => name !== publicConfig.name)) {
      for (const field of ['expoProjectId', 'androidApplicationId', 'iosBundleIdentifier', 'scheme']) {
        if (binding[field] === bindings[other]?.[field]) throw new Error(`${field} must be isolated between environments.`);
      }
    }
    required(values.ANDROID_MAPS_API_KEY, 'ANDROID_MAPS_API_KEY');
    required(values.IOS_MAPS_API_KEY, 'IOS_MAPS_API_KEY');
  }
  return { ...publicConfig, ...binding, verification: false };
}
module.exports = { appEnvironment, validatePublicEnvironment, validateBuildBinding };
