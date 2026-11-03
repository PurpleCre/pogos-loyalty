export const workerEnvironment = [
  'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'EXPO_PUSH_ACCESS_TOKEN',
  'PUSH_WORKER_SECRET', 'TRANSACTIONAL_PUSH_ENABLED',
  'CASH_ORDER_EXPIRY_WORKER_SECRET', 'CASH_ORDER_EXPIRY_ENABLED',
  'REWARD_EXPIRY_WORKER_SECRET', 'REWARD_RESERVATION_EXPIRY_ENABLED',
  'GAAP_WEBHOOK_ENABLED', 'MARKETING_EMAIL_ENABLED', 'CUSTOMER_SUPPORT_AI_ENABLED', 'LEGACY_PUSH_ENABLED',
];
export const edgeEntrypoints = [
  'dispatch-transactional-push', 'expire-cash-orders', 'expire-reward-reservations',
  'gaap-webhook', 'send-special-offer', 'customer-support-chat', 'send-push-notification',
].map(name => `supabase/functions/${name}/index.ts`);
export function edgeRuntimeArguments(mode) {
  if (!['check', 'test'].includes(mode)) throw Error('Use edge:check or test:edge; no target or permission arguments are accepted.');
  const common = ['--config', 'deno.edge.json', '--cached-only', '--no-remote'];
  return mode === 'check' ? ['check', ...common, ...edgeEntrypoints, 'tests/edge/handlers.test.ts'] :
    ['test', ...common, '--no-prompt', '--allow-net=127.0.0.1', `--allow-env=${workerEnvironment.join(',')}`, '--junit-path=dist/edge-runtime/junit.xml', 'tests/edge/handlers.test.ts'];
}
export function edgeRuntimeEnvironment(parent, cache) {
  const env = { DENO_DIR: cache, DENO_NO_PROMPT: '1', DENO_NO_UPDATE_CHECK: '1', NO_COLOR: '1' };
  // Never pass inherited app/provider credentials, NODE_OPTIONS or DENO_AUTH_TOKENS.
  for (const name of ['PATH', 'TMPDIR', 'TMP', 'TEMP', 'SystemRoot', 'SYSTEMROOT']) if (parent[name]) env[name] = parent[name];
  return env;
}
