import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { createTestDatabase, asRole } from '../scripts/test-database.mjs';
let db;
const project='a6770000-0000-4000-8000-000000000001';
before(async()=>{db=await createTestDatabase();}); after(async()=>{await db?.close();});
const rpc=async(actor,name,args=[],role='authenticated',aal='aal2')=>asRole(db,role,actor,async()=>
  (await db.query(`SELECT public.${name}(${args.map((_,i)=>`$${i+1}`).join(',')}) AS value`,args)).rows[0].value,
  {aal,amr:[{method:'password',timestamp:Math.floor(Date.now()/1000)}]});
const worker=(name,args=[])=>rpc(null,name,args,'service_role');
async function fixture(){
  await db.exec('TRUNCATE public.push_delivery_results,public.push_deliveries,public.notification_events,public.push_devices');
  await db.query(`UPDATE public.push_settings SET enabled=false,expo_project_id=$1,enabled_since=now()-interval '1 hour'`,[project]);
  const f=Object.fromEntries(['user','other','staff','branch','second','device'].map(key=>[key,randomUUID()])); f.secret='a'.repeat(64); f.token=`ExpoPushToken[${randomUUID()}]`;
  for(const id of [f.user,f.other,f.staff])await db.query('INSERT INTO auth.users(id,email) VALUES($1,$2)',[id,`${id}@fixture.test`]);
  for(const branch of [f.branch,f.second])await db.query(`INSERT INTO public.stores(id,name,address,distance_miles) VALUES($1,'Push fixture','Test only',0)`,[branch]);
  await db.query(`INSERT INTO public.user_roles(user_id,role,staff_store_id) VALUES($1,'staff',$2)`,[f.staff,f.branch]);
  await db.query('INSERT INTO public.staff_memberships(user_id,store_id) VALUES($1,$2)',[f.staff,f.branch]);
  await db.query('INSERT INTO public.cash_branch_cashiers(store_id,user_id,active) VALUES($1,$2,true)',[f.branch,f.staff]);
  await db.query(`INSERT INTO public.cash_order_settings(store_id,currency,enabled,pricing_approved,fulfilment_enabled,acceptance_minutes) VALUES($1,'USD',true,true,true,10)`,[f.branch]);
  const category=(await db.query(`INSERT INTO public.menu_categories(name) VALUES('Push fixture') RETURNING id`)).rows[0].id;
  f.item=(await db.query(`INSERT INTO public.menu_items(category_id,store_id,name,price) VALUES($1,$2,'Fixture pizza',10) RETURNING id`,[category,f.branch])).rows[0].id;
  return f;
}
const register=(f,actor=f.user,id=f.device,secret=f.secret,token=f.token)=>rpc(actor,'register_push_device',[id,secret,token,project,'android']);
const activate=()=>db.exec('UPDATE public.push_settings SET enabled=true');
async function order(f){
  const q=await rpc(f.user,'quote_cash_order',[JSON.stringify({store_id:f.branch,fulfilment_mode:'collection',contact:{name:'Private Customer',phone:'+263771234567'},address:null,lines:[{menu_item_id:f.item,quantity:1,choice_ids:[]}]})]);
  const key=randomUUID();const result=await rpc(f.user,'place_cash_order',[q.quote_id,key]);return{...result,quote:q.quote_id,key};
}
const prepare=job=>worker('prepare_push_dispatch',[job.id,job.claim_id]);
const record=(job,outcome,reference=null)=>worker('record_push_result',[job.id,job.claim_id,outcome,reference]);

test('push dispatch defaults off and event insertion is atomic with the originating order and replay-safe',async()=>{
  const f=await fixture();await register(f);
  await db.exec('BEGIN');const first=await order(f);
  assert.ok((await db.query('SELECT id FROM public.notification_events WHERE order_id=$1',[first.order_id])).rows.length>=2);
  await db.exec('ROLLBACK');assert.equal((await db.query('SELECT count(*)::int AS n FROM public.notification_events')).rows[0].n,0);
  const created=await order(f);await rpc(f.user,'place_cash_order',[created.quote,created.key]);
  assert.equal((await db.query(`SELECT count(*)::int AS n FROM public.notification_events WHERE order_id=$1 AND recipient_id=$2`,[created.order_id,f.user])).rows[0].n,1);
  assert.deepEqual(await worker('claim_push_deliveries'),[]);
});
test('only service workers can claim or report deliveries, and API users cannot manufacture subscriptions or delivery proof',async()=>{
  const f=await fixture();
  for(const role of ['anon','authenticated'])await asRole(db,role,role==='authenticated'?f.user:null,async()=>{
    await assert.rejects(db.query('SELECT public.claim_push_deliveries()'),{code:'42501'});
    await assert.rejects(db.query('SELECT public.prepare_push_dispatch($1,$2)',[randomUUID(),randomUUID()]),{code:'42501'});
    await assert.rejects(db.query(`INSERT INTO public.notifications(title,body,sent_to,delivery_status) VALUES('Forged','Fake',$1,'delivered')`,[f.user]),{code:'42501'});
    await assert.rejects(db.query(`INSERT INTO public.push_subscriptions(user_id,endpoint,p256dh,auth) VALUES($1,'fake','fake','fake')`,[f.user]),{code:'42501'});
    await assert.rejects(db.query('SELECT expo_token,secret_hash FROM public.push_devices'),{code:'42501'});
  });
  await assert.rejects(rpc(f.user,'push_operations_summary'),{code:'42501'});
});
test('installation proof, project binding, token uniqueness and staff MFA protect registration and transfer',async()=>{
  const f=await fixture();await register(f);
  await assert.rejects(register(f,f.other,f.device,'b'.repeat(64)),{code:'42501'});
  await assert.rejects(register(f,f.other,randomUUID()),{code:'23505'});
  await assert.rejects(rpc(f.user,'register_push_device',[randomUUID(),f.secret,f.token,randomUUID(),'android']),{code:'22023'});
  await assert.rejects(rpc(f.staff,'register_push_device',[randomUUID(),f.secret,`ExpoPushToken[${randomUUID()}]`,project,'android'],'authenticated','aal1'),{code:'42501'});
  const before=(await db.query('SELECT version FROM public.push_devices WHERE id=$1',[f.device])).rows[0].version;
  await register(f);assert.equal((await db.query('SELECT version FROM public.push_devices WHERE id=$1',[f.device])).rows[0].version,before);
  await register(f,f.other);assert.equal((await db.query('SELECT user_id FROM public.push_devices WHERE id=$1',[f.device])).rows[0].user_id,f.other);
});
test('a claimed delivery has one dispatch fence and generic private payloads, never customer contacts or receipt claims',async()=>{
  const f=await fixture();await register(f);await order(f);await activate();
  const jobs=await worker('claim_push_deliveries');assert.equal(jobs.length,1);assert.deepEqual(await worker('claim_push_deliveries'),[]);
  const payload=await prepare(jobs[0]);assert.equal(payload.to,f.token);assert.equal(payload.data.recipient_id,f.user);
  assert.ok(!JSON.stringify(payload).includes('Private Customer'));assert.ok(!JSON.stringify(payload).includes('+263'));
  assert.equal(await prepare(jobs[0]),null);
  await record(jobs[0],'ticket','fixture-ticket');await record(jobs[0],'ticket','fixture-ticket');
  await assert.rejects(record(jobs[0],'unknown'),{code:'22023'});
  assert.equal((await db.query('SELECT count(*)::int AS n FROM public.push_delivery_results')).rows[0].n,1);
  assert.equal((await db.query('SELECT state FROM public.push_deliveries')).rows[0].state,'ticket');
});
test('provider receipt acceptance remains distinct from device delivery; missing receipts never trigger another send',async()=>{
  const f=await fixture();await register(f);await order(f);await activate();
  const [job]=await worker('claim_push_deliveries');await prepare(job);await record(job,'ticket','fixture-ticket');
  assert.deepEqual(await worker('claim_push_deliveries'),[]);
  await db.exec(`UPDATE public.push_deliveries SET available_at=now()-interval '1 minute'`);
  const [receipt]=await worker('claim_push_deliveries');assert.equal(receipt.stage,'receipt');assert.equal((await prepare(receipt)).ticket_id,'fixture-ticket');
  await record(receipt,'receipt_pending');assert.equal((await db.query('SELECT attempts,state FROM public.push_deliveries')).rows[0].attempts,1);
  await db.exec(`UPDATE public.push_deliveries SET available_at=now()-interval '1 minute'`);
  const [second]=await worker('claim_push_deliveries');await prepare(second);await record(second,'provider_accepted');
  assert.equal((await db.query('SELECT state FROM public.push_deliveries')).rows[0].state,'provider_accepted');
});
test('an abandoned send after dispatch becomes unknown; a lease abandoned before dispatch can retry with a new claim',async()=>{
  const f=await fixture();await register(f);await order(f);await activate();
  const [first]=await worker('claim_push_deliveries');
  await db.exec(`UPDATE public.push_deliveries SET lease_until=now()-interval '1 minute'`);
  const [next]=await worker('claim_push_deliveries');assert.notEqual(next.claim_id,first.claim_id);assert.equal(await prepare(first),null);
  await prepare(next);await db.exec(`UPDATE public.push_deliveries SET lease_until=now()-interval '1 minute'`);
  assert.deepEqual(await worker('claim_push_deliveries'),[]);assert.equal((await db.query('SELECT state FROM public.push_deliveries')).rows[0].state,'unknown');
});
test('retryable rejection backs off and stops after five attempts; stale report identities cannot mutate a new claim',async()=>{
  const f=await fixture();await register(f);await order(f);await activate();let first;
  for(let i=0;i<5;i++){
    const [job]=await worker('claim_push_deliveries');assert.ok(job);first??=job;await prepare(job);await record(job,'rate_limited');
    assert.deepEqual(await worker('claim_push_deliveries'),[]);await db.exec(`UPDATE public.push_deliveries SET available_at=now()-interval '1 minute'`);
  }
  assert.equal((await db.query('SELECT state FROM public.push_deliveries')).rows[0].state,'failed');
  await assert.rejects(worker('record_push_result',[first.id,randomUUID(),'unknown',null]),{code:'40001'});
});
test('logout and account rebind cancel queued messages and old invalid-token results cannot revoke the new binding',async()=>{
  const f=await fixture();await register(f);await order(f);await activate();const [job]=await worker('claim_push_deliveries');await prepare(job);
  await register(f,f.other);await record(job,'device_unregistered');
  assert.equal((await db.query('SELECT active,user_id FROM public.push_devices WHERE id=$1',[f.device])).rows[0].active,true);
  await rpc(f.other,'unregister_push_device',[f.device,f.secret]);
  const device=(await db.query('SELECT active,expo_token FROM public.push_devices WHERE id=$1',[f.device])).rows[0];assert.equal(device.active,false);assert.equal(device.expo_token,null);
});
test('current revocation, privacy processing, device expiry and project gates are rechecked before dispatch',async()=>{
  for(const mode of ['revoke','privacy','expiry','project']){
    const f=await fixture();await register(f,f.staff);await order(f);await activate();const [job]=await worker('claim_push_deliveries');assert.ok(job);
    if(mode==='revoke')await db.query('UPDATE public.staff_memberships SET active=false WHERE user_id=$1',[f.staff]);
    if(mode==='privacy')await db.query(`INSERT INTO public.privacy_requests(id,user_id,kind,status) VALUES($1,$2,'deletion','processing')`,[randomUUID(),f.staff]);
    if(mode==='expiry')await db.exec(`UPDATE public.push_devices SET expires_at=now()-interval '1 minute'`);
    if(mode==='project')await db.query('UPDATE public.push_settings SET expo_project_id=$1',[randomUUID()]);
    assert.equal(await prepare(job),null);
  }
});
test('inbox and routes require current recipient ownership and branch permissions; arbitrary recipients and URLs cannot be supplied',async()=>{
  const f=await fixture();const created=await order(f);
  const customer=(await rpc(f.user,'my_notification_inbox'))[0];assert.equal(customer.kind,'order');
  await assert.rejects(rpc(f.other,'resolve_transaction_notification',[customer.id]),{code:'42501'});
  const route=await rpc(f.user,'resolve_transaction_notification',[customer.id]);assert.equal(route.order_id,created.order_id);assert.equal(route.kind,'order');
  const staff=(await rpc(f.staff,'my_notification_inbox'))[0];assert.equal(staff.kind,'branch');
  await db.query('UPDATE public.staff_memberships SET active=false WHERE user_id=$1',[f.staff]);
  assert.deepEqual(await rpc(f.staff,'my_notification_inbox'),[]);await assert.rejects(rpc(f.staff,'resolve_transaction_notification',[staff.id]),{code:'42501'});
});
test('push secrets are omitted from own exports',async()=>{
  const f=await fixture();await register(f);await order(f);
  const request=await rpc(f.user,'submit_privacy_request',[randomUUID(),'export']);
  const page=await rpc(f.user,'export_privacy_section',[request.id,'push_devices',null,100]);assert.equal(page.rows.length,1);
  const serialised=JSON.stringify(page);assert.ok(!serialised.includes(f.secret));assert.ok(!serialised.includes(f.token));assert.ok(!serialised.includes('secret_hash'));
  await rpc(f.user,'unregister_push_device',[f.device,f.secret]);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM public.push_devices WHERE user_id=$1',[f.user])).rows[0].n,1);
});

test('ambiguous send review requires fresh administrator MFA, version checks and explicit duplicate-risk acceptance',async()=>{
  const f=await fixture();await register(f);await order(f);await activate();const[job]=await worker('claim_push_deliveries');await prepare(job);await record(job,'unknown');
  const row=(await db.query('SELECT version FROM public.push_deliveries WHERE id=$1',[job.id])).rows[0];
  await assert.rejects(rpc(f.user,'review_unknown_push',[job.id,row.version,true,'Reviewed exception',true]),{code:'42501'});
  await db.query(`UPDATE public.user_roles SET role='admin',staff_store_id=NULL WHERE user_id=$1 AND role='staff'`,[f.staff]);
  await assert.rejects(rpc(f.staff,'review_unknown_push',[job.id,row.version,true,'Reviewed exception',true],'authenticated','aal1'),{code:'42501'});
  await assert.rejects(rpc(f.staff,'review_unknown_push',[job.id,row.version,true,'Reviewed exception',false]),{code:'22023'});
  const reviewed=await rpc(f.staff,'review_unknown_push',[job.id,row.version,true,'Accept possible duplicate',true]);assert.equal(reviewed.state,'retry');
  await assert.rejects(rpc(f.staff,'review_unknown_push',[job.id,row.version,true,'Accept possible duplicate',true]),{code:'40001'});
  const audit=(await db.query(`SELECT actor_id,reason,outcome FROM public.push_delivery_results WHERE stage='operator'`)).rows[0];
  assert.equal(audit.actor_id,f.staff);assert.equal(audit.outcome,'operator_retry');
  await assert.rejects(db.exec(`DELETE FROM public.push_delivery_results`),{code:'42501'});
  await db.query(`INSERT INTO public.privacy_requests(id,user_id,kind,status) VALUES($1,$2,'deletion','processing')`,[randomUUID(),f.staff]);
  await assert.rejects(rpc(f.staff,'review_unknown_push',[job.id,reviewed.version,false,'Cannot operate during erasure',false]),{code:'42501'});
});

test('expired events and a newly rebound device never receive historical pushes',async()=>{
  const f=await fixture();await register(f);await order(f);await activate();
  const[job]=await worker('claim_push_deliveries');assert.ok(job);
  await db.exec(`UPDATE public.notification_events SET expires_at=now()-interval '1 minute'`);
  assert.equal(await prepare(job),null);
  await rpc(f.user,'unregister_push_device',[f.device,f.secret]);await register(f);
  assert.deepEqual(await worker('claim_push_deliveries'),[]);
  await order({...f,user:f.other}); // Created before the new account binds.
  await register(f,f.other);
  assert.deepEqual(await worker('claim_push_deliveries'),[]);
});

test('equal-time inbox pages preserve every event and a send claim cannot be labelled provider-accepted without a receipt',async()=>{
  const f=await fixture();await register(f);const created=await order(f);
  await db.query(`INSERT INTO public.notification_events(source_id,kind,recipient_id,store_id,order_id)
    SELECT gen_random_uuid(),'order',$1,$2,$3 FROM generate_series(1,51)`,[f.user,f.branch,created.order_id]);
  const first=await rpc(f.user,'my_notification_inbox');assert.equal(first.length,50);const cursor=first.at(-1);
  const second=await rpc(f.user,'my_notification_inbox',[cursor.created_at,cursor.id]);assert.equal(second.length,2);
  assert.equal(new Set([...first,...second].map(row=>row.id)).size,52);
  await assert.rejects(rpc(f.user,'my_notification_inbox',[cursor.created_at,null]),{code:'22023'});
  await activate();const[job]=await worker('claim_push_deliveries',[1]);await prepare(job);
  await assert.rejects(record(job,'provider_accepted'),{code:'22023'});
  assert.equal((await db.query('SELECT state FROM public.push_deliveries WHERE id=$1',[job.id])).rows[0].state,'sending');
});
