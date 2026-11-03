import { createClient } from '@supabase/supabase-js';
import { runTransactionalPushBatch } from './transactional-push-worker.ts';

export type WorkerKind = 'push' | 'cash-expiry' | 'reward-expiry';
export interface WorkerDependencies {
  env?: (name: string) => string | undefined;
  databaseFetch?: typeof fetch;
  providerFetch?: typeof fetch;
}
const settings = {
  push: { secret: 'PUSH_WORKER_SECRET', enabled: 'TRANSACTIONAL_PUSH_ENABLED' },
  'cash-expiry': { secret: 'CASH_ORDER_EXPIRY_WORKER_SECRET', enabled: 'CASH_ORDER_EXPIRY_ENABLED' },
  'reward-expiry': { secret: 'REWARD_EXPIRY_WORKER_SECRET', enabled: 'REWARD_RESERVATION_EXPIRY_ENABLED' },
} as const;
const reply = (status: number, value: unknown) => new Response(JSON.stringify(value), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff', ...(status === 405 ? { Allow: 'POST' } : {}) },
});
class InputError extends Error { constructor(readonly status: number) { super('Invalid worker request'); } }

async function emptyRequest(request: Request) {
  const stated = request.headers.get('content-length');
  if (stated && Number(stated) > 1024) throw new InputError(413);
  const reader = request.body?.getReader();
  if (!reader) return;
  const chunks: Uint8Array[] = []; let size = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new InputError(408)), 3000); });
  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), timeout]);
      if (done) break;
      size += value.length;
      if (size > 1024) throw new InputError(413);
      chunks.push(value);
    }
    if (!size) return;
    if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new InputError(415);
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    let body: unknown;
    try { body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { throw new InputError(400); }
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length) throw new InputError(400);
  } finally {
    clearTimeout(timer);
    void reader.cancel().catch(() => {});
  }
}

async function authorised(expected: string, supplied: string) {
  if (!/^[\x21-\x7E]{32,256}$/.test(expected) || supplied.length > 256) return false;
  const digest = async (value: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  const [left, right] = await Promise.all([digest(expected), digest(supplied)]);
  let difference = 0;
  for (let i = 0; i < left.length; i++) difference |= left[i] ^ right[i];
  return difference === 0;
}

/** Fixed server jobs only. No caller-provided RPC, batch, branch, recipients or URL. */
export function createInternalWorker(kind: WorkerKind, dependencies: WorkerDependencies = {}) {
  const env = dependencies.env ?? ((name: string) => Deno.env.get(name));
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') return reply(405, { error: 'Method not allowed' });
    try {
      const config = settings[kind];
      if (!await authorised(env(config.secret) ?? '', request.headers.get('X-Worker-Key') ?? '')) return reply(401, { error: 'Unauthorized' });
      if (env(config.enabled) !== 'true') return reply(503, { error: 'Worker disabled' });
      const url = env('SUPABASE_URL'), key = env('SUPABASE_SERVICE_ROLE_KEY');
      if (!url || !key || (kind === 'push' && !env('EXPO_PUSH_ACCESS_TOKEN'))) return reply(503, { error: 'Worker configuration incomplete' });
      const parsed = new URL(url);
      if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') return reply(503, { error: 'Worker configuration incomplete' });
      await emptyRequest(request);
      const databaseFetch = dependencies.databaseFetch ?? fetch;
      const limitedFetch: typeof fetch = (input, init) => databaseFetch(input, {
        ...init, redirect: 'error', signal: AbortSignal.any([AbortSignal.timeout(8000), ...(init?.signal ? [init.signal] : [])]),
      });
      const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: limitedFetch } });
      const rpc = async (name: string, args: Record<string, unknown>) => {
        // No invisible SDK retry of a lease or batch mutation. The push engine
        // separately retries only an idempotent result acknowledgement.
        const { data, error } = await client.rpc(name, args).retry(false);
        if (error) throw Error('Worker database operation failed');
        return data;
      };
      if (kind !== 'push') {
        const processed: unknown = await rpc(kind === 'cash-expiry' ? 'expire_pending_cash_orders' : 'expire_reward_reservations', { p_limit: 100 });
        if (typeof processed !== 'number' || !Number.isInteger(processed) || processed < 0 || processed > 100) throw Error('Invalid expiry result');
        return reply(200, { worker: kind, processed, limit: 100 });
      }
      const summary = await runTransactionalPushBatch({
        accessToken: env('EXPO_PUSH_ACCESS_TOKEN')!, fetch: dependencies.providerFetch ?? fetch,
        claim: () => rpc('claim_push_deliveries', { p_limit: 10 }),
        prepare: job => rpc('prepare_push_dispatch', { p_id: job.id, p_claim: job.claim_id }),
        record: async (job, outcome, reference) => { await rpc('record_push_result', { p_id: job.id, p_claim: job.claim_id, p_outcome: outcome, p_reference: reference }); },
      });
      return reply(summary.unresolved ? 503 : 200, summary);
    } catch (error) {
      return error instanceof InputError ? reply(error.status, { error: 'Invalid worker request' }) : reply(503, { error: 'Worker unavailable' });
    }
  };
}
