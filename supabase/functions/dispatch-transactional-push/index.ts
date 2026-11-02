import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0';
import { runTransactionalPushBatch } from '../_shared/transactional-push-worker.ts';
serve(async (request: Request) => {
  const reply = (status: number, value: unknown) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  if (request.method !== 'POST') return reply(405, { error: 'Method not allowed' });
  const expected = Deno.env.get('PUSH_WORKER_SECRET') ?? ''; const supplied = request.headers.get('X-Worker-Key') ?? '';
  if (expected.length < 32 || supplied.length > 256) return reply(401, { error: 'Unauthorized' });
  const digest = async (value: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  const [left, right] = await Promise.all([digest(expected), digest(supplied)]);
  let difference = 0; for (let i = 0; i < left.length; i++) difference |= left[i] ^ right[i];
  if (difference) return reply(401, { error: 'Unauthorized' });
  if (Deno.env.get('TRANSACTIONAL_PUSH_ENABLED') !== 'true') return reply(503, { error: 'Push worker disabled' });
  const accessToken = Deno.env.get('EXPO_PUSH_ACCESS_TOKEN') ?? '';
  const url = Deno.env.get('SUPABASE_URL'); const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!accessToken || !url || !key) return reply(503, { error: 'Worker configuration incomplete' });
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const rpc = async (name: string, args = {}) => {
    const { data, error } = await client.rpc(name, args); if (error) throw Error('Worker database operation failed'); return data;
  };
  try {
    const summary = await runTransactionalPushBatch({ accessToken, fetch,
      claim: () => rpc('claim_push_deliveries', { p_limit: 10 }),
      prepare: job => rpc('prepare_push_dispatch', { p_id: job.id, p_claim: job.claim_id }),
      record: async (job, outcome, reference) => { await rpc('record_push_result', { p_id: job.id, p_claim: job.claim_id, p_outcome: outcome, p_reference: reference }); },
    });
    return reply(summary.unresolved ? 503 : 200, summary);
  } catch { return reply(503, { error: 'Worker unavailable' }); }
});
