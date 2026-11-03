import assert from 'node:assert/strict';
import { createInternalWorker, type WorkerKind } from '../../supabase/functions/_shared/internal-workers.ts';
import { closedEndpoint } from '../../supabase/functions/_shared/closed-endpoints.ts';

const secrets = { push: 'p'.repeat(48), 'cash-expiry': 'c'.repeat(48), 'reward-expiry': 'r'.repeat(48) };
const names = {
  push: ['PUSH_WORKER_SECRET', 'TRANSACTIONAL_PUSH_ENABLED'],
  'cash-expiry': ['CASH_ORDER_EXPIRY_WORKER_SECRET', 'CASH_ORDER_EXPIRY_ENABLED'],
  'reward-expiry': ['REWARD_EXPIRY_WORKER_SECRET', 'REWARD_RESERVATION_EXPIRY_ENABLED'],
};
const job = { id: 'a5780000-0000-4000-8000-000000000001', claim_id: 'b5780000-0000-4000-8000-000000000001', stage: 'send' };
type Call = { path: string; body: Record<string, unknown>; authorization: string | null; apikey: string | null };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { Connection: 'close' } });
function serve(handler: (request: Request) => Response | Promise<Response>) {
  const server = Deno.serve({ hostname: '127.0.0.1', port: 0, onListen() {} }, handler);
  return { url: `http://127.0.0.1:${server.addr.port}`, close: () => server.shutdown() };
}
const closingFetch: typeof fetch = (input, init) => {
  const headers = new Headers(init?.headers); headers.set('Connection', 'close');
  return fetch(input, { ...init, headers });
};
interface FixtureOptions {
  backend?: (call: Call) => Response | Promise<Response>;
  observation?: (call: Call) => Response | Promise<Response>;
  provider?: (url: string, init?: RequestInit) => Promise<Response>;
}
async function fixture(kind: WorkerKind, options: FixtureOptions, work: (f: {
  calls: Call[]; observations: Call[]; env: Record<string, string>; request: (options?: RequestInit) => Promise<{ status: number; body: Record<string, unknown>; headers: Headers }>;
}) => Promise<void>) {
  const calls: Call[] = [];
  const observations: Call[] = [];
  const backend = serve(async request => {
    const call = { path: new URL(request.url).pathname, body: await request.json(), authorization: request.headers.get('Authorization'), apikey: request.headers.get('apikey') };
    if (call.path.endsWith('record_worker_observation')) { observations.push(call); return options.observation ? options.observation(call) : json(true); }
    calls.push(call);
    return options.backend ? options.backend(call) : json(0);
  });
  const env: Record<string, string> = { SUPABASE_URL: backend.url, SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service-key', EXPO_PUSH_ACCESS_TOKEN: 'synthetic-expo-key' };
  for (const worker of Object.keys(names) as WorkerKind[]) { env[names[worker][0]] = secrets[worker]; env[names[worker][1]] = 'true'; }
  const handler = createInternalWorker(kind, {
    env: name => env[name], databaseFetch: closingFetch,
    providerFetch: async (input, init) => {
      if (!options.provider) throw Error('Unexpected provider request');
      return options.provider(String(input), init);
    },
  });
  const server = serve(handler);
  try {
    await work({ calls, observations, env, request: async (options = {}) => {
      const headers = new Headers({ 'X-Worker-Key': secrets[kind], Connection: 'close' });
      new Headers(options.headers).forEach((value, key) => headers.set(key, value));
      const response = await fetch(server.url, { ...options, method: options.method ?? 'POST', headers });
      return { status: response.status, body: await response.json(), headers: response.headers };
    } });
  } finally { await server.close(); await backend.close(); }
}

Deno.test('runtime network permission excludes actual external providers and hosted projects', async () => {
  assert.notEqual((await Deno.permissions.query({ name: 'net', host: 'exp.host:443' })).state, 'granted');
  assert.notEqual((await Deno.permissions.query({ name: 'net', host: 'example.supabase.co:443' })).state, 'granted');
});
Deno.test('workers reject non-POST methods without touching the database', async () => {
  for (const kind of Object.keys(names) as WorkerKind[]) await fixture(kind, {}, async f => {
    for (const method of ['GET', 'PUT', 'OPTIONS']) {
      const response = await f.request({ method }); assert.equal(response.status, 405); assert.equal(response.headers.get('allow'), 'POST');
    }
    assert.equal(f.calls.length, 0);
  });
});
Deno.test('missing, wrong, oversized and customer bearer credentials cannot authorise internal work', async () => {
  for (const kind of Object.keys(names) as WorkerKind[]) await fixture(kind, {}, async f => {
    for (const key of ['', 'wrong', 'x'.repeat(257), secrets[kind === 'push' ? 'cash-expiry' : 'push']]) {
      assert.equal((await f.request({ headers: { 'X-Worker-Key': key, Authorization: 'Bearer synthetic-customer-jwt' } })).status, 401);
    }
    assert.equal(f.calls.length, 0);
  });
});
Deno.test('short or unconfigured server secrets fail closed', async () => {
  await fixture('cash-expiry', {}, async f => {
    for (const key of ['', 'short', 'x'.repeat(257), ' '.repeat(48)]) { f.env.CASH_ORDER_EXPIRY_WORKER_SECRET = key; assert.equal((await f.request()).status, 401); }
    assert.equal(f.calls.length, 0);
  });
});
Deno.test('disabled worker switches prevent claims even with a valid worker key', async () => {
  for (const kind of Object.keys(names) as WorkerKind[]) await fixture(kind, {}, async f => {
    for (const flag of ['', 'false', 'TRUE']) { f.env[names[kind][1]] = flag; assert.equal((await f.request()).status, 503); }
    assert.equal(f.calls.length, 0);
  });
});
Deno.test('missing or malformed server configuration never creates a database call', async () => {
  await fixture('push', {}, async f => {
    for (const field of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'EXPO_PUSH_ACCESS_TOKEN']) {
      const original = f.env[field]; delete f.env[field]; assert.equal((await f.request()).status, 503); f.env[field] = original;
    }
    for (const url of ['invalid', 'file:///tmp/local', 'https://user:password@example.test', 'https://example.test/path', 'https://example.test/?key=secret']) {
      f.env.SUPABASE_URL = url; assert.equal((await f.request()).status, 503);
    }
    assert.equal(f.calls.length, 0);
  });
});
Deno.test('request bodies cannot override a job, batch, recipient, branch or target', async () => {
  await fixture('cash-expiry', {}, async f => {
    for (const body of [{ p_limit: 500 }, { rpc: 'arbitrary' }, { userIds: [job.id] }, { store_id: job.id }, { url: 'https://example.test' }, [], null]) {
      assert.equal((await f.request({ body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } })).status, 400);
    }
    assert.equal(f.calls.length, 0);
  });
});
Deno.test('malformed, unsupported and oversized bodies are rejected before any mutation', async () => {
  await fixture('cash-expiry', {}, async f => {
    assert.equal((await f.request({ body: '{broken', headers: { 'Content-Type': 'application/json' } })).status, 400);
    assert.equal((await f.request({ body: '{}', headers: { 'Content-Type': 'text/plain' } })).status, 415);
    assert.equal((await f.request({ body: 'x'.repeat(1025), headers: { 'Content-Type': 'application/json' } })).status, 413);
    const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(1025)); controller.close(); } });
    assert.equal((await f.request({ body: stream, headers: { 'Content-Type': 'application/json' } })).status, 413);
    assert.equal(f.calls.length, 0);
  });
});
Deno.test('an unfinished authenticated body times out and is cancelled before a claim', async () => {
  await fixture('cash-expiry', {}, async f => {
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new TextEncoder().encode('{')); }, cancel() { cancelled = true; } });
    const handler = createInternalWorker('cash-expiry', { env: name => f.env[name], databaseFetch: closingFetch });
    const response = await handler(new Request('http://127.0.0.1/', { method: 'POST', headers: { 'X-Worker-Key': secrets['cash-expiry'], 'Content-Type': 'application/json' }, body }));
    assert.equal(response.status, 408); await response.text(); assert.equal(cancelled, true); assert.equal(f.calls.length, 0);
  });
});
Deno.test('the production environment adapter uses the fixed server credentials and default SDK fetch', async () => {
  const calls: Call[] = [];
  const backend = serve(async request => {
    if (new URL(request.url).pathname.endsWith('record_worker_observation')) { await request.text(); return json(true); }
    calls.push({ path: new URL(request.url).pathname, body: await request.json(), authorization: request.headers.get('Authorization'), apikey: request.headers.get('apikey') });
    return json(2);
  });
  const environment = { SUPABASE_URL: backend.url, SUPABASE_SERVICE_ROLE_KEY: 'synthetic-default-service', CASH_ORDER_EXPIRY_WORKER_SECRET: secrets['cash-expiry'], CASH_ORDER_EXPIRY_ENABLED: 'true' };
  for (const [name, value] of Object.entries(environment)) Deno.env.set(name, value);
  const server = serve(createInternalWorker('cash-expiry'));
  try {
    const response = await fetch(server.url, { method: 'POST', headers: { 'X-Worker-Key': secrets['cash-expiry'], Authorization: 'Bearer synthetic-customer-jwt', Connection: 'close' } });
    assert.equal(response.status, 200); assert.equal((await response.json()).processed, 2);
    assert.equal(calls.length, 1); assert.equal(calls[0].authorization, 'Bearer synthetic-default-service');
  } finally { await server.close(); await backend.close(); for (const name of Object.keys(environment)) Deno.env.delete(name); }
});
for (const [kind, name] of [['cash-expiry', 'expire_pending_cash_orders'], ['reward-expiry', 'expire_reward_reservations']] as const) {
  Deno.test(`${kind} sends a fixed bounded service RPC over real HTTP`, async () => {
    await fixture(kind, { backend: () => json(7) }, async f => {
      const response = await f.request({ body: '{}', headers: { 'Content-Type': 'application/json; charset=utf-8' } });
      assert.equal(response.status, 200); assert.deepEqual(response.body, { worker: kind, processed: 7, limit: 100 });
      assert.deepEqual(f.calls, [{ path: `/rest/v1/rpc/${name}`, body: { p_limit: 100 }, authorization: 'Bearer synthetic-service-key', apikey: 'synthetic-service-key' }]);
    });
  });
}
Deno.test('expiry rejects invalid success counts rather than reporting false completion', async () => {
  for (const value of [-1, 101, 1.5, '7', null, {}]) await fixture('cash-expiry', { backend: () => json(value) }, async f => {
    assert.equal((await f.request()).status, 503); assert.equal(f.calls.length, 1);
  });
});
Deno.test('database errors do not leak details or trigger an implicit mutation retry', async () => {
  await fixture('cash-expiry', { backend: () => json({ code: 'XX000', message: 'synthetic-private-contact-and-secret', details: 'private upstream payload' }, 500) }, async f => {
    const result = await f.request(); assert.equal(result.status, 503); assert.equal(f.calls.length, 1);
    assert.ok(!JSON.stringify(result).includes('synthetic-private')); assert.equal(result.headers.get('cache-control'), 'no-store');
  });
});
Deno.test('database redirects cannot forward service credentials to another endpoint', async () => {
  let leakedRequests = 0;
  const trap = serve(() => { leakedRequests++; return json(99); });
  try {
    await fixture('cash-expiry', { backend: () => new Response(null, { status: 307, headers: { Location: trap.url, Connection: 'close' } }) }, async f => {
      assert.equal((await f.request()).status, 503); assert.equal(f.calls.length, 1); assert.equal(leakedRequests, 0);
    });
  } finally { await trap.close(); }
});
Deno.test('an empty push queue makes no provider request', async () => {
  await fixture('push', { backend: () => json([]) }, async f => {
    const result = await f.request(); assert.equal(result.status, 200); assert.deepEqual(result.body, { claimed: 0, recorded: 0, skipped: 0, unresolved: 0 });
    assert.deepEqual(f.calls.map(c => c.path), ['/rest/v1/rpc/claim_push_deliveries']); assert.deepEqual(f.calls[0].body, { p_limit: 10 });
  });
});
Deno.test('push claims, eligibility fence, Expo ticket and acknowledgement are separate operations', async () => {
  let providerCalls = 0;
  await fixture('push', {
    backend: call => call.path.endsWith('claim_push_deliveries') ? json([job]) : call.path.endsWith('prepare_push_dispatch') ? json({ stage: 'send', to: 'ExpoPushToken[synthetic_only]', title: 'Pogo’s update', body: 'Open the app', data: { kind: 'pogos-transaction', event_id: job.id, recipient_id: job.claim_id } }) : json(null),
    provider: async (url, init) => { providerCalls++; assert.equal(url, 'https://exp.host/--/api/v2/push/send'); assert.equal(init?.redirect, 'error'); assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer synthetic-expo-key'); return json({ data: { status: 'ok', id: 'synthetic-ticket' } }); },
  }, async f => {
    const result = await f.request(); assert.equal(result.status, 200); assert.equal(providerCalls, 1);
    assert.deepEqual(f.calls.map(c => c.path.split('/').at(-1)), ['claim_push_deliveries', 'prepare_push_dispatch', 'record_push_result']);
    assert.deepEqual(f.calls[2].body, { p_id: job.id, p_claim: job.claim_id, p_outcome: 'ticket', p_reference: 'synthetic-ticket' });
    assert.ok(!JSON.stringify(result.body).includes('synthetic-expo-key')); assert.ok(!JSON.stringify(result.body).includes('delivered'));
  });
});
Deno.test('a failed final eligibility fence prevents any provider send', async () => {
  await fixture('push', { backend: call => json(call.path.endsWith('claim_push_deliveries') ? [job] : null) }, async f => {
    const result = await f.request(); assert.equal(result.status, 200); assert.equal(result.body.skipped, 1); assert.equal(f.calls.length, 2);
  });
});
Deno.test('ambiguous provider transport is recorded as unknown and returns an actionable failure', async () => {
  await fixture('push', {
    backend: call => call.path.endsWith('claim_push_deliveries') ? json([job]) : call.path.endsWith('prepare_push_dispatch') ? json({ stage: 'send', to: 'ExpoPushToken[synthetic_only]' }) : json(null),
    provider: async () => { throw Error('Synthetic connection loss after send'); },
  }, async f => {
    const result = await f.request(); assert.equal(result.status, 503); assert.equal(result.body.unresolved, 1);
    assert.equal(f.calls.at(-1)?.body.p_outcome, 'unknown');
    assert.equal(f.observations.at(-1)?.body.p_outcome,'unresolved');
  });
});
Deno.test('lost acknowledgement retries only the result record rather than dispatching twice', async () => {
  let sends = 0, records = 0;
  await fixture('push', {
    backend: call => {
      if (call.path.endsWith('claim_push_deliveries')) return json([job]);
      if (call.path.endsWith('prepare_push_dispatch')) return json({ stage: 'send', to: 'ExpoPushToken[synthetic_only]' });
      return ++records === 1 ? json({ message: 'Synthetic lost acknowledgement' }, 503) : json(null);
    }, provider: async () => { sends++; return json({ data: { status: 'ok', id: 'synthetic-ticket' } }); },
  }, async f => { assert.equal((await f.request()).status, 200); assert.equal(sends, 1); assert.equal(records, 2); });
});
Deno.test('an invalid or oversized push claim does not invoke a provider', async () => {
  for (const value of [null, {}, Array.from({ length: 21 }, () => job)]) await fixture('push', { backend: () => json(value) }, async f => {
    assert.equal((await f.request()).status, 503); assert.equal(f.calls.length, 1);
  });
});
Deno.test('unapproved endpoints remain closed and harmless even if old enable flags are set', async () => {
  for (const [kind, flag, status] of [['gaap', 'GAAP_WEBHOOK_ENABLED', 503], ['marketing', 'MARKETING_EMAIL_ENABLED', 503], ['support', 'CUSTOMER_SUPPORT_AI_ENABLED', 503], ['legacy-push', 'LEGACY_PUSH_ENABLED', 410]] as const) {
    Deno.env.set(flag, 'true');
    const server = serve(closedEndpoint(kind));
    try {
      for (const body of ['{broken', JSON.stringify({ userIds: [job.id], points: 999999, message: 'unapproved' })]) {
        const response = await fetch(server.url, { method: 'POST', headers: { Connection: 'close' }, body });
        assert.equal(response.status, status); const text = await response.text(); assert.ok(!text.includes('999999')); assert.equal(response.headers.get('cache-control'), 'no-store');
      }
      const preflight = await fetch(server.url, { method: 'OPTIONS', headers: { Connection: 'close' } }); assert.equal(preflight.status, 204); await preflight.text();
      const wrongMethod = await fetch(server.url, { headers: { Connection: 'close' } }); assert.equal(wrongMethod.status, 405); await wrongMethod.text();
    } finally { await server.close(); Deno.env.delete(flag); }
  }
});

Deno.test('successful internal work records a matched start and completion without accepting caller metadata', async () => {
  await fixture('cash-expiry', {backend:()=>json(0)}, async f => {
    assert.equal((await f.request()).status,200);
    assert.deepEqual(f.observations.map(x=>x.body.p_outcome),['running','success']);
    assert.equal(f.observations[0].body.p_run,f.observations[1].body.p_run);
    assert.equal(f.observations[0].body.p_worker,'cash-expiry');
    assert.match(String(f.observations[0].body.p_run),/^[0-9a-f-]{36}$/);
  });
});
Deno.test('unrecorded start prevents database work and provider dispatch', async () => {
  await fixture('cash-expiry', {observation:()=>json({message:'private'},503)}, async f => {
    assert.equal((await f.request()).status,503);assert.equal(f.calls.length,0);assert.equal(f.observations.length,1);
  });
});
Deno.test('failed database work records failure without treating it as a rollback receipt', async () => {
  await fixture('cash-expiry', {backend:()=>json({message:'private'},500)}, async f => {
    assert.equal((await f.request()).status,503);assert.deepEqual(f.observations.map(x=>x.body.p_outcome),['running','failed']);
  });
});
Deno.test('completion acknowledgement retries never execute the business operation again', async () => {
  let terminals=0;
  await fixture('reward-expiry', {backend:()=>json(1),observation:call=>call.body.p_outcome==='running'||++terminals===2?json(true):json({message:'lost reply'},503)},async f=>{
    assert.equal((await f.request()).status,200);assert.equal(f.calls.length,1);assert.equal(f.observations.length,3);
    assert.equal(f.observations[1].body.p_run,f.observations[2].body.p_run);
  });
});
Deno.test('unacknowledged or superseded completion is actionable without a duplicate job', async () => {
  await fixture('cash-expiry',{backend:()=>json(1),observation:call=>json(call.body.p_outcome==='running')},async f=>{
    assert.equal((await f.request()).status,503);assert.equal(f.calls.length,1);assert.equal(f.observations.length,3);
  });
});
Deno.test('disabled or unauthorised worker calls cannot create misleading heartbeat evidence',async()=>{
  await fixture('cash-expiry',{},async f=>{
    assert.equal((await f.request({headers:{'X-Worker-Key':'wrong'}})).status,401);
    f.env.CASH_ORDER_EXPIRY_ENABLED='false';assert.equal((await f.request()).status,503);assert.equal(f.observations.length,0);
  });
});
