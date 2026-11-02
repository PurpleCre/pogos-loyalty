import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPushInstallationManager, notificationDestination, transactionPayloadSchema } from '../lib/push-installation.ts';
import { runTransactionalPushBatch } from '../supabase/functions/_shared/transactional-push-worker.ts';
const alice='a5780000-0000-4000-8000-000000000001',bob='b5780000-0000-4000-8000-000000000001';
function managerFixture(){const values=new Map();const storage={async getItem(k){return values.get(k)??null;},async setItem(k,v){values.set(k,v);}};
  return{values,storage,manager:createPushInstallationManager(storage,'fixture')};}
test('installation proof persists before registration and lost replies reuse the same secret instead of creating another device',async()=>{
  const {manager,storage}=managerFixture();let first;
  await assert.rejects(manager.enable(alice,()=>true,async value=>{first=value;throw Error('Response lost');}));
  assert.equal((await manager.read()).confirmed,false);
  const restarted=createPushInstallationManager(storage,'fixture');
  await restarted.enable(alice,()=>true,async value=>{assert.equal(value.id,first.id);assert.equal(value.secret,first.secret);});
  assert.equal((await restarted.read()).confirmed,true);
});
test('storage failure or corruption never dispatches installation registration',async()=>{
  const {values,storage}=managerFixture();let calls=0;
  values.set('fixture','{broken');await assert.rejects(createPushInstallationManager(storage,'fixture').enable(alice,()=>true,async()=>{calls++;}));
  values.clear();storage.setItem=async()=>{throw Error('Secure store unavailable');};
  await assert.rejects(createPushInstallationManager(storage,'fixture').enable(alice,()=>true,async()=>{calls++;}));assert.equal(calls,0);
});
test('logout withdrawal is durable before networking and a failed revoke can be explicitly retried',async()=>{
  const {manager,values}=managerFixture();await manager.enable(alice,()=>true,async()=>{});let proof;
  await assert.rejects(manager.disable(alice,async value=>{proof=value;assert.equal(JSON.parse(values.get('fixture')).enabledOwner,null);throw Error('Offline');}));
  const disabled=await manager.read();assert.equal(disabled.enabledOwner,null);assert.equal(disabled.confirmed,false);assert.equal(disabled.pendingRevocationOwner,alice);
  await manager.disable(alice,async value=>{assert.equal(value.id,proof.id);});assert.equal((await manager.read()).pendingRevocationOwner,null);
});
test('account switches cannot auto-enable another identity and late old-account cleanup cannot disable a newer binding',async()=>{
  const {manager}=managerFixture();let current=false;let sent=0;
  await assert.rejects(manager.enable(alice,()=>current,async()=>{sent++;}));assert.equal(sent,0);
  current=true;await manager.enable(alice,()=>current,async()=>{});await manager.enable(bob,()=>true,async()=>{});
  await manager.disable(alice,async()=>{throw Error('Should not revoke Bob');});assert.equal((await manager.read()).enabledOwner,bob);
});
test('concurrent registration and logout preserve operation order without resurrecting enabled preferences',async()=>{
  const {manager}=managerFixture();let started,release;const ready=new Promise(r=>{started=r;});
  const enable=manager.enable(alice,()=>true,async()=>{started();await new Promise(r=>{release=r;});});await ready;
  let revoked=false;const disable=manager.disable(alice,async()=>{revoked=true;});release();await Promise.all([enable,disable]);
  assert.equal(revoked,true);assert.equal((await manager.read()).enabledOwner,null);
});
test('notification payloads reject URLs and extra data; destinations use only a closed route and validated IDs',()=>{
  assert.equal(transactionPayloadSchema.safeParse({kind:'pogos-transaction',event_id:alice,recipient_id:bob,url:'https://evil.test'}).success,false);
  assert.throws(()=>notificationDestination({kind:'https://evil.test',store_id:alice,order_id:bob,reservation_id:null}));
  assert.throws(()=>notificationDestination({kind:'order',store_id:alice,order_id:null,reservation_id:null}));
  assert.deepEqual(notificationDestination({kind:'order',store_id:alice,order_id:bob,reservation_id:null}),{pathname:'/(app)/order-tracking',params:{orderId:bob}});
});
const job={id:alice,claim_id:bob,stage:'send'};
function workerFixture(response){const outcomes=[];const requests=[];const ports={accessToken:'fixture-server-token',
  claim:async()=>[job],prepare:async()=>({stage:'send',to:'ExpoPushToken[fixture_token]',title:'Pogo’s update',body:'Open app',data:{kind:'pogos-transaction',event_id:alice,recipient_id:bob}}),
  record:async(j,outcome,reference)=>{outcomes.push({outcome,reference});},
  fetch:async(url,init)=>{requests.push({url,init});return typeof response==='function'?response():new Response(JSON.stringify(response),{status:200});}};
  return{ports,outcomes,requests};}
test('Expo ticket acceptance records a ticket, never a delivered state, and uses a fixed authenticated HTTPS endpoint',async()=>{
  const {ports,outcomes,requests}=workerFixture({data:{status:'ok',id:'fixture-ticket'}});
  const result=await runTransactionalPushBatch(ports);assert.equal(result.recorded,1);assert.deepEqual(outcomes,[{outcome:'ticket',reference:'fixture-ticket'}]);
  assert.equal(requests[0].url,'https://exp.host/--/api/v2/push/send');assert.equal(requests[0].init.redirect,'error');
  assert.equal(requests[0].init.headers.Authorization,'Bearer fixture-server-token');
  assert.ok(!JSON.stringify(result).includes('fixture-server-token'));
});
test('lost result acknowledgements retry the same database record rather than dispatching to the provider again',async()=>{
  const {ports,requests}=workerFixture({data:[{status:'ok',id:'fixture-ticket'}]});let records=0;
  ports.record=async()=>{if(++records===1)throw Error('Lost DB acknowledgement');};
  const result=await runTransactionalPushBatch(ports);assert.equal(records,2);assert.equal(requests.length,1);assert.equal(result.recorded,1);
});
test('missing receipt is polled again without treating ticket acceptance as device delivery',async()=>{
  const {ports,outcomes,requests}=workerFixture({data:{}});ports.claim=async()=>[{...job,stage:'receipt'}];ports.prepare=async()=>({stage:'receipt',ticket_id:'fixture-ticket'});
  await runTransactionalPushBatch(ports);assert.deepEqual(outcomes,[{outcome:'receipt_pending',reference:null}]);
  assert.equal(requests[0].url,'https://exp.host/--/api/v2/push/getReceipts');assert.deepEqual(JSON.parse(requests[0].init.body),{ids:['fixture-ticket']});
});
test('invalid tokens, rate limiting and provider failures remain distinct actionable results',async()=>{
  for(const [body,status,expected] of [[{data:{status:'error',details:{error:'DeviceNotRegistered'}}},200,'device_unregistered'],[{},429,'rate_limited'],[{},503,'provider_error'],[{},401,'permanent_error']]){
    const {ports,outcomes}=workerFixture(()=>new Response(JSON.stringify(body),{status}));await runTransactionalPushBatch(ports);assert.equal(outcomes[0].outcome,expected);
  }
});
test('network loss, malformed success and oversized responses remain unknown instead of a false success',async()=>{
  for(const response of [()=>{throw Error('Connection lost after send');},()=>new Response('not-json'),()=>new Response('x'.repeat(70000))]){
    const {ports,outcomes}=workerFixture(response);const result=await runTransactionalPushBatch(ports);assert.equal(outcomes[0].outcome,'unknown');assert.equal(result.unresolved,1);
  }
});
test('a failed final eligibility fence causes no provider call; missing credentials cause no claim',async()=>{
  const {ports,requests}=workerFixture({});ports.prepare=async()=>null;
  assert.equal((await runTransactionalPushBatch(ports)).skipped,1);assert.equal(requests.length,0);
  ports.accessToken='';let claims=0;ports.claim=async()=>{claims++;return[job];};await assert.rejects(runTransactionalPushBatch(ports));assert.equal(claims,0);
});
