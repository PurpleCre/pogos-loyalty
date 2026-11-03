import {test} from 'node:test';
import assert from 'node:assert/strict';
import {edgeRuntimeArguments,edgeRuntimeEnvironment,workerEnvironment} from '../scripts/edge-runtime-plan.mjs';
test('Deno runtime plan grants loopback only and refuses caller-selected targets or permissions',()=>{
  const args=edgeRuntimeArguments('test');
  assert.ok(args.includes('--allow-net=127.0.0.1'));assert.ok(args.includes('--no-prompt'));assert.ok(args.includes('--no-remote'));assert.ok(args.includes('--cached-only'));
  assert.ok(!args.includes('-A'));assert.ok(!args.includes('--allow-all'));assert.ok(!args.some(x=>x.startsWith('--allow-run')||x.startsWith('--allow-write')||x==='--allow-env'));
  for(const mode of ['',undefined,'https://remote.test','--allow-all'])assert.throws(()=>edgeRuntimeArguments(mode));
});
test('Deno child environment excludes inherited credentials and injected startup flags',()=>{
  const env=edgeRuntimeEnvironment({PATH:'/bin',TMPDIR:'/tmp',SUPABASE_SERVICE_ROLE_KEY:'private',EXPO_PUSH_ACCESS_TOKEN:'private',NODE_OPTIONS:'--require=untrusted',DENO_AUTH_TOKENS:'private',GAAP_WEBHOOK_ENABLED:'true'},'/restricted/cache');
  assert.deepEqual(env,{DENO_DIR:'/restricted/cache',DENO_NO_PROMPT:'1',DENO_NO_UPDATE_CHECK:'1',NO_COLOR:'1',PATH:'/bin',TMPDIR:'/tmp'});
});
test('type checking covers every deployment entrypoint and uses no runtime network grant',()=>{
  const args=edgeRuntimeArguments('check');
  for(const endpoint of ['dispatch-transactional-push','expire-cash-orders','expire-reward-reservations','gaap-webhook','send-special-offer','customer-support-chat','send-push-notification'])assert.ok(args.includes(`supabase/functions/${endpoint}/index.ts`));
  assert.ok(!args.some(x=>x.startsWith('--allow-net')));
  assert.ok(workerEnvironment.includes('CASH_ORDER_EXPIRY_WORKER_SECRET'));assert.ok(workerEnvironment.includes('REWARD_EXPIRY_WORKER_SECRET'));
});
