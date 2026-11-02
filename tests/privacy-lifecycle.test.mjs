import assert from 'node:assert/strict';
import { before,after,test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { createTestDatabase,asRole } from '../scripts/test-database.mjs';
import { privacySections } from '../lib/privacy.ts';
const alice=randomUUID(),bob=randomUUID(),admin=randomUUID(),reviewer=randomUUID(),staff=randomUUID(),branch=randomUUID();
const retainedOrder=randomUUID(),claimCode=randomUUID();
let db;let exportRequest;let deletionRequest;
const claims=(aal='aal1',age=0)=>({aal,amr:[{method:'password',timestamp:Math.floor(Date.now()/1000)-age}]});
async function rpc(actor,name,args=[],auth=claims(),role='authenticated') {
  return asRole(db,role,actor,async()=>(await db.query(`SELECT public.${name}(${args.map((_,i)=>`$${i+1}`).join(',')}) AS result`,args)).rows[0].result,auth);
}
async function notice() {
  await db.exec(`INSERT INTO public.privacy_notices(version,controller_name,body,support_email,approval_reference,approved_by,approved_at) VALUES('fixture-v1','Fixture controller','This fixture notice is approved only inside a disposable test database.','privacy@fixture.test','test-approval','Fixture reviewer',now()) ON CONFLICT DO NOTHING`);
  await db.exec(`INSERT INTO public.privacy_retention_approvals(version,policy_reference,approved_by,approved_at) VALUES('fixture-retention','fixture-record-only-retention','Fixture counsel',now()) ON CONFLICT DO NOTHING`);
  await db.exec(`UPDATE public.privacy_settings SET active_notice_version='fixture-v1',retention_policy_version='fixture-retention',deletion_processing_enabled=true`);
}
before(async()=>{
  db=await createTestDatabase();
  for(const[id,email]of[[alice,'alice@privacy.test'],[bob,'bob@privacy.test'],[admin,'admin@privacy.test'],[reviewer,'reviewer@privacy.test'],[staff,'staff@privacy.test']])await db.query(`INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,'{"full_name":"Fixture person","server_secret":"metadata-not-allowed"}')`,[id,email]);
  await db.query(`INSERT INTO public.stores(id,name,address,distance_miles) VALUES($1,'Privacy fixture','Fixture',0)`,[branch]);
  await db.query(`INSERT INTO public.user_roles(user_id,role,staff_store_id) VALUES($1,'admin',NULL),($2,'admin',NULL),($3,'staff',$4)`,[admin,reviewer,staff,branch]);
  await db.query(`INSERT INTO public.staff_memberships(user_id,store_id) VALUES($1,$2)`,[staff,branch]);
  await db.query('INSERT INTO public.privacy_reviewers(user_id) VALUES($1)',[reviewer]);
  for(let i=0;i<5;i++)await db.query(`INSERT INTO public.user_locations(user_id,address,latitude,longitude) VALUES($1,$2,0,0)`,[alice,`Alice address ${i}`]);
  await db.query(`INSERT INTO public.user_locations(user_id,address,latitude,longitude) VALUES($1,'Bob private address',0,0)`,[bob]);
  await db.query(`INSERT INTO public.push_subscriptions(user_id,endpoint,p256dh,auth) VALUES($1,'https://push.fixture/secret-endpoint','push-private-key','push-secret')`,[alice]);
  await db.query(`INSERT INTO public.notifications(sent_to,title,body,data) VALUES($1,'Own notice','Own message','{"private_token":"do-not-export"}')`,[alice]);
  await db.query(`UPDATE public.user_points SET current_points=9007199254740993 WHERE user_id=$1`,[alice]);
  await db.query(`INSERT INTO public.orders(id,user_id,store_id,status,total_amount,payment_status,cash_custody_status) VALUES($1,$2,$3,'completed',10,'paid','settled')`,[retainedOrder,alice,branch]);
  await db.query(`INSERT INTO public.cash_receipts(order_id,store_id,sale_reference,currency,amount_minor,tendered_minor,change_minor,received_by,current_holder_id,settled_at) VALUES($1,$2,'PRIVACY-FIXTURE-SALE','USD',1000,1000,0,$3,$3,now())`,[retainedOrder,branch,staff]);
  const offer=(await db.query(`INSERT INTO public.reward_branch_offers(store_id,reward_id,name,terms,gaap_product_reference,points_cost,reservation_minutes) SELECT $1,id,'Privacy fixture reward','Fixture terms only','FIXTURE',10,30 FROM public.rewards LIMIT 1 RETURNING id`,[branch])).rows[0].id;
  const reservation=(await db.query(`INSERT INTO public.reward_reservations(user_id,store_id,offer_id,points_cost,snapshot,customer_name,status,expires_at) VALUES($1,$2,$3,10,'{}','Fixture customer','cancelled',now()) RETURNING id`,[alice,branch,offer])).rows[0].id;
  await db.query('INSERT INTO public.reward_claim_secrets(reservation_id,claim_code) VALUES($1,$2)',[reservation,claimCode]);
  await db.query(`INSERT INTO public.gaap_sync_log(gaap_transaction_id,user_id,store_id,raw_payload,error_message) VALUES('PRIVACY-POS-FIXTURE',$1,$2,'{"vendor_secret":"never-export-vendor-secret"}','never-export-internal-error')`,[alice,branch]);
});
after(async()=>{await db?.close();});
test('public privacy contact is usable while notice/retention remain unapproved',async()=>{
  const data=await asRole(db,'anon',null,()=>db.query('SELECT support_email,active_notice_version FROM public.privacy_settings'));
  assert.deepEqual(data.rows,[{support_email:'pgonese6@gmail.com',active_notice_version:null}]);
  assert.equal((await asRole(db,'anon',null,()=>db.query('SELECT version FROM public.privacy_notices'))).rows.length,0);
  await asRole(db,'anon',null,()=>assert.rejects(db.query('SELECT approval_reference,approved_by FROM public.privacy_notices'),{code:'42501'}));
  await assert.rejects(rpc(alice,'set_privacy_marketing',[randomUUID(),true,null]),{code:'22023'});
});
test('recent identity uses password AMR, not issue/refresh time or customer metadata',async()=>{
  for(const auth of [claims('aal1',3600),{aal:'aal1',iat:Math.floor(Date.now()/1000)},{aal:'aal1',amr:[{method:'recovery',timestamp:Math.floor(Date.now()/1000)}]},claims('aal1',-3600),{aal:'aal1',amr:'malformed'}])await assert.rejects(rpc(alice,'submit_privacy_request',[randomUUID(),'export'],auth),{code:'42501'});
  await assert.rejects(rpc(null,'submit_privacy_request',[randomUUID(),'export'],claims(),'anon'),{code:'42501'});
});
test('staff and any enrolled customer need MFA as well as a recent password',async()=>{
  await assert.rejects(rpc(staff,'submit_privacy_request',[randomUUID(),'export']),{code:'42501'});
  await db.query(`INSERT INTO auth.mfa_factors(user_id,status) VALUES($1,'verified')`,[bob]);
  await assert.rejects(rpc(bob,'submit_privacy_request',[randomUUID(),'export']),{code:'42501'});
  const result=await rpc(bob,'submit_privacy_request',[randomUUID(),'export'],claims('aal2'));assert.equal(result.kind,'export');
});
test('privacy submissions are account-bound and find an existing active request after a lost response',async()=>{
  exportRequest=await rpc(alice,'submit_privacy_request',[randomUUID(),'export']);
  assert.equal((await rpc(alice,'submit_privacy_request',[randomUUID(),'export'])).id,exportRequest.id);
  assert.equal((await rpc(alice,'submit_privacy_request',[exportRequest.id,'export'])).id,exportRequest.id);
  await assert.rejects(rpc(bob,'submit_privacy_request',[exportRequest.id,'export'],claims('aal2')),{code:'42501'});
  deletionRequest=await rpc(alice,'submit_privacy_request',[randomUUID(),'deletion']);assert.equal(deletionRequest.status,'blocked');assert.equal(deletionRequest.blocker,'policy_approval');
  assert.equal((await db.query('SELECT email FROM public.profiles WHERE id=$1',[alice])).rows[0].email,'alice@privacy.test');
});
test('request rows, task notes and privacy approvals cannot be written by app accounts',async()=>{
  for(const actor of [alice,admin,reviewer])await asRole(db,'authenticated',actor,async()=>{
    await assert.rejects(db.query(`UPDATE public.privacy_requests SET status='completed'`),{code:'42501'});
    await assert.rejects(db.query(`UPDATE public.privacy_settings SET deletion_processing_enabled=true`),{code:'42501'});
    await assert.rejects(db.query('SELECT * FROM public.privacy_request_tasks'),{code:'42501'});
    await assert.rejects(db.query('SELECT reviewed_by FROM public.privacy_requests'),{code:'42501'});
  });
});
test('bounded export cursors cannot skip pages or access another account',async()=>{
  const first=await rpc(alice,'export_privacy_section',[exportRequest.id,'addresses',null,2]);assert.equal(first.rows.length,2);assert.ok(first.next_cursor);
  assert.ok(first.rows.every(row=>row.address.startsWith('Alice address')));
  await assert.rejects(rpc(alice,'export_privacy_section',[exportRequest.id,'addresses',randomUUID(),2]),{code:'22023'});
  await assert.rejects(rpc(bob,'export_privacy_section',[exportRequest.id,'addresses',null,2],claims('aal2')),{code:'42501'});
  await assert.rejects(rpc(alice,'export_privacy_section',[exportRequest.id,'gaap_config',null,2]),{code:'22023'});
  await assert.rejects(rpc(alice,'privacy_export_rows',[bob,'addresses',null,new Date().toISOString(),2]),{code:'42501'});
  const second=await rpc(alice,'export_privacy_section',[exportRequest.id,'addresses',first.next_cursor,2]);assert.equal(second.rows.length,2);
  const last=await rpc(alice,'export_privacy_section',[exportRequest.id,'addresses',second.next_cursor,2]);assert.equal(last.rows.length,1);assert.equal(last.next_cursor,null);
});
test('an export cannot be declared prepared after only one finished section',async()=>{
  await assert.rejects(rpc(alice,'finish_privacy_export',[exportRequest.id]),{code:'22023'});
});
test('restart recovers incomplete exports and all sections preserve precision without secrets',async()=>{
  await rpc(alice,'restart_privacy_export',[exportRequest.id]);
  const server=await rpc(alice,'privacy_export_sections');assert.deepEqual(server,[...privacySections]);
  const all={};
  for(const section of privacySections){all[section]=[];let cursor=null;do{const page=await rpc(alice,'export_privacy_section',[exportRequest.id,section,cursor,2]);all[section].push(...page.rows);cursor=page.next_cursor;}while(cursor);}
  assert.equal(all.account[0].points.current,'9007199254740993');assert.equal(all.addresses.length,5);
  const text=JSON.stringify(all);for(const secret of ['push-secret','push-private-key','secret-endpoint','metadata-not-allowed','do-not-export','Bob private address','bob@privacy.test',claimCode,'never-export-vendor-secret','never-export-internal-error'])assert.ok(!text.includes(secret),secret);
  await rpc(alice,'finish_privacy_export',[exportRequest.id]);await rpc(alice,'finish_privacy_export',[exportRequest.id]);
  assert.equal((await db.query('SELECT status FROM public.privacy_requests WHERE id=$1',[exportRequest.id])).rows[0].status,'completed');
});
test('marketing defaults off, needs an approved notice, and old retries cannot restore withdrawn consent',async()=>{
  await notice();const key=randomUUID();await rpc(alice,'set_privacy_marketing',[key,true,'fixture-v1']);
  const recipients=await rpc(null,'privacy_marketing_recipients',[],{},'service_role');assert.equal(recipients.length,1);assert.equal(recipients[0].user_id,alice);
  await rpc(alice,'set_privacy_marketing',[randomUUID(),false,null]);await rpc(alice,'set_privacy_marketing',[key,true,'fixture-v1']);
  assert.deepEqual(await rpc(null,'privacy_marketing_recipients',[],{},'service_role'),[]);
  await assert.rejects(rpc(alice,'privacy_marketing_recipients'),{code:'42501'});
  await assert.rejects(rpc(alice,'set_privacy_marketing',[randomUUID(),true,'unapproved-version']),{code:'22023'});
});
test('only assigned MFA reviewers can see the queue and start processing',async()=>{
  await assert.rejects(rpc(admin,'privacy_review_queue',[],claims('aal2')),{code:'42501'});
  await assert.rejects(rpc(reviewer,'privacy_review_queue',[],claims()),{code:'42501'});
  const queue=await rpc(reviewer,'privacy_review_queue',[],claims('aal2'));assert.ok(queue.some(row=>row.id===deletionRequest.id));
  const started=await rpc(reviewer,'review_privacy_deletion',[deletionRequest.id,0,'start','Reviewed fixture approval'],claims('aal2'));assert.equal(started.status,'processing');deletionRequest=started;
  await assert.rejects(rpc(alice,'quote_cash_order',['{}']),{code:'42501'});
  await assert.rejects(rpc(alice,'reserve_reward',[randomUUID(),randomUUID()]),{code:'42501'});
  await assert.rejects(rpc(alice,'cancel_privacy_request',[deletionRequest.id,deletionRequest.version]),{code:'22023'});
  await asRole(db,'authenticated',alice,async()=>{
    assert.equal((await db.query(`UPDATE public.profiles SET full_name='Cannot recreate contact' WHERE id=$1 RETURNING id`,[alice])).rows.length,0);
    await assert.rejects(db.query(`INSERT INTO public.user_locations(user_id,address,latitude,longitude) VALUES($1,'Cannot recreate address',0,0)`,[alice]),{code:'42501'});
  },claims());
  await assert.rejects(rpc(admin,'set_identity_access',[alice,'staff',[branch],'Cannot restore processing account'],claims('aal2')),{code:'42501'});
});
test('customer status events cannot expose internal review or task evidence',async()=>{
  const events=await rpc(alice,'my_privacy_request_events',[deletionRequest.id]);assert.ok(events.length>0);
  assert.ok(!JSON.stringify(events).includes('Reviewed fixture approval'));assert.ok(events.every(row=>!('details'in row)));
  await assert.rejects(rpc(bob,'my_privacy_request_events',[deletionRequest.id],claims('aal2')),{code:'42501'});
});
test('completion is server-only and needs every task, approvals and actual erasure checks',async()=>{
  await assert.rejects(rpc(reviewer,'complete_privacy_deletion',[deletionRequest.id,deletionRequest.version,'Not allowed'],claims('aal2')),{code:'42501'});
  await assert.rejects(rpc(null,'complete_privacy_deletion',[deletionRequest.id,deletionRequest.version,'Fixture completion'],{},'service_role'),{code:'22023'});
  await assert.rejects(rpc(null,'record_privacy_task',[deletionRequest.id,'application','not_applicable','fixture-evidence','Fixture operator'],{},'service_role'),{code:'22023'});
  for(const system of ['application','authentication','gaap','email','monitoring','backups'])await rpc(null,'record_privacy_task',[deletionRequest.id,system,system==='application'||system==='authentication'?'completed':'not_applicable',`fixture-${system}-receipt`,'Fixture operator'],{},'service_role');
  await assert.rejects(rpc(null,'complete_privacy_deletion',[deletionRequest.id,deletionRequest.version,'Fixture completion'],{},'service_role'),{code:'22023'});
});
test('simulated approved erasure completes without cascading financial records and stale JWTs lose access',async()=>{
  // Test-only manual simulation, not the production erasure implementation.
  await db.query('DELETE FROM public.user_locations WHERE user_id=$1',[alice]);await db.query('DELETE FROM public.push_subscriptions WHERE user_id=$1',[alice]);
  await db.query('UPDATE public.profiles SET email=NULL,full_name=NULL,gaap_customer_id=NULL WHERE id=$1',[alice]);await db.query(`UPDATE auth.users SET email=NULL,email_confirmed_at=NULL,raw_user_meta_data='{}',deleted_at=now() WHERE id=$1`,[alice]);
  await db.query(`UPDATE public.reward_reservations SET customer_name='[Deleted]' WHERE user_id=$1`,[alice]);
  const original=(await db.query('SELECT current_points FROM public.user_points WHERE user_id=$1',[alice])).rows[0].current_points;
  // Even an inactive/no-token binding must be handled by actual erasure.
  await db.query(`INSERT INTO public.push_devices(id,secret_hash,user_id,project_id,platform,active,aal2,expires_at)
    VALUES($1,'retained-fixture-hash',$2,$3,'android',false,false,now())`,[randomUUID(),alice,randomUUID()]);
  await assert.rejects(rpc(null,'complete_privacy_deletion',[deletionRequest.id,deletionRequest.version,'Fixture completion approval'],{},'service_role'),{code:'22023'});
  await db.query('DELETE FROM public.push_devices WHERE user_id=$1',[alice]);
  await rpc(null,'complete_privacy_deletion',[deletionRequest.id,deletionRequest.version,'Fixture completion approval'],{},'service_role');
  assert.equal((await rpc(alice,'account_privacy_state')).deleted,true);
  assert.equal((await asRole(db,'authenticated',alice,()=>db.query('SELECT id FROM public.profiles'),claims())).rows.length,0);
  await assert.rejects(rpc(alice,'submit_privacy_request',[randomUUID(),'export']),{code:'42501'});
  await assert.rejects(rpc(alice,'quote_cash_order',['{}']),{code:'42501'});
  assert.equal((await db.query('SELECT current_points FROM public.user_points WHERE user_id=$1',[alice])).rows[0].current_points,original);
  assert.equal((await db.query('SELECT total_amount FROM public.orders WHERE id=$1',[retainedOrder])).rows[0].total_amount,'10.00');
  assert.equal((await db.query('SELECT amount_minor FROM public.cash_receipts WHERE order_id=$1',[retainedOrder])).rows[0].amount_minor,1000);
  assert.equal((await db.query('SELECT reference FROM public.branch_fiscal_references WHERE cash_order_id=$1',[retainedOrder])).rows[0].reference,'PRIVACY-FIXTURE-SALE');
});
test('consent and request audit histories cannot be altered even by privileged API roles',async()=>{
  for(const role of ['authenticated','service_role'])await asRole(db,role,role==='authenticated'?reviewer:null,()=>assert.rejects(db.query('DELETE FROM public.privacy_request_events'),{code:'42501'}),claims('aal2'));
  await assert.rejects(db.query(`UPDATE public.privacy_consent_events SET marketing_email=true`),{code:'42501'});
});

test('the data map classifies every local public table and its current fields',async()=>{
  const {readFile}=await import('node:fs/promises');const inventory=JSON.parse(await readFile(new URL('../config/privacy-data-map.json',import.meta.url),'utf8'));
  const result=await db.query(`SELECT table_name,array_agg(column_name ORDER BY ordinal_position) AS fields FROM information_schema.columns WHERE table_schema='public' GROUP BY table_name ORDER BY table_name`);
  assert.deepEqual(inventory.datasets.map(row=>({table_name:row.table,fields:row.fields})),result.rows);
  assert.ok(inventory.datasets.every(row=>row.classification&&row.legalBasisApproval));assert.equal(inventory.controllerLegalIdentity,null);
});
test('active orders and staff obligations block processing without losing the deletion request',async()=>{
  await db.query(`INSERT INTO public.orders(user_id,store_id,total_amount) VALUES($1,$2,10)`,[bob,branch]);
  const request=await rpc(bob,'submit_privacy_request',[randomUUID(),'deletion'],claims('aal2'));assert.equal(request.blocker,'active_orders');
  const attempt=await rpc(reviewer,'review_privacy_deletion',[request.id,0,'start','Settle the active order first'],claims('aal2'));assert.equal(attempt.status,'blocked');
  await db.query(`UPDATE public.orders SET status='cancelled' WHERE user_id=$1`,[bob]);
  await assert.rejects(rpc(bob,'cancel_privacy_request',[request.id,null],claims('aal2')),{code:'40001'});
  await rpc(bob,'cancel_privacy_request',[request.id,attempt.version],claims('aal2'));
  const employee=await rpc(staff,'submit_privacy_request',[randomUUID(),'deletion'],claims('aal2'));assert.equal(employee.blocker,'staff_access');
});
test('paused deletion can resume, while changed approvals invalidate older task evidence',async()=>{
  let request=await rpc(bob,'submit_privacy_request',[randomUUID(),'deletion'],claims('aal2'));
  request=await rpc(reviewer,'review_privacy_deletion',[request.id,request.version,'start','Approved fixture review'],claims('aal2'));
  await rpc(null,'record_privacy_task',[request.id,'application','completed','fixture-before-policy-change','Fixture operator'],{},'service_role');
  request=await rpc(reviewer,'review_privacy_deletion',[request.id,request.version,'pause','Recheck operator evidence'],claims('aal2'));assert.equal(request.blocker,'operator_review');
  await assert.rejects(rpc(null,'record_privacy_task',[request.id,'email','not_applicable','fixture-no-email','Fixture operator'],{},'service_role'),{code:'22023'});
  await db.exec(`INSERT INTO public.privacy_retention_approvals(version,policy_reference,approved_by,approved_at) VALUES('fixture-retention-v2','fixture-policy-revision','Fixture counsel',now());UPDATE public.privacy_settings SET retention_policy_version='fixture-retention-v2'`);
  request=await rpc(reviewer,'review_privacy_deletion',[request.id,request.version,'resume','Review revised retention scope'],claims('aal2'));assert.equal(request.blocker,null);
  const evidence=(await db.query(`SELECT status,evidence_reference FROM public.privacy_request_tasks WHERE request_id=$1 AND system='application'`,[request.id])).rows[0];assert.deepEqual(evidence,{status:'pending',evidence_reference:null});
});
test('review queue pagination preserves cases that have equal timestamps',async()=>{
  const requests=[];
  for(let i=0;i<6;i++){const owner=randomUUID(),id=randomUUID();requests.push(id);await db.query('INSERT INTO auth.users(id,email) VALUES($1,$2)',[owner,`queue-${i}@fixture.test`]);await db.query(`INSERT INTO public.privacy_requests(id,user_id,kind,created_at) VALUES($1,$2,'deletion','2000-01-01T00:00:00Z')`,[id,owner]);}
  let before='2000-01-02T00:00:00Z',beforeId=null;const seen=[];
  for(let i=0;i<5;i++){const page=await rpc(reviewer,'privacy_review_queue',[before,2,beforeId],claims('aal2'));if(!page.length)break;seen.push(...page.map(row=>row.id));before=page.at(-1).created_at;beforeId=page.at(-1).id;}
  assert.deepEqual(seen,[...requests].sort());assert.equal(new Set(seen).size,6);
});
test('null or guessed operational evidence cannot complete a request',async()=>{
  const request=(await db.query(`SELECT id FROM public.privacy_requests WHERE user_id=$1 AND kind='deletion' AND status='processing'`,[bob])).rows[0];
  await assert.rejects(rpc(null,'record_privacy_task',[request.id,'email','completed',null,'Fixture operator'],{},'service_role'),{code:'22023'});
  await assert.rejects(rpc(null,'record_privacy_task',[request.id,'unknown-system','completed','fixture-evidence','Fixture operator'],{},'service_role'),{code:'22023'});
  await db.exec('UPDATE public.privacy_settings SET deletion_processing_enabled=false');
  await assert.rejects(rpc(null,'record_privacy_task',[request.id,'email','completed','fixture-evidence','Fixture operator'],{},'service_role'),{code:'42501'});
});
test('privacy reviewers cannot approve their own deletion request',async()=>{
  const own=await rpc(reviewer,'submit_privacy_request',[randomUUID(),'deletion'],claims('aal2'));
  await assert.rejects(rpc(reviewer,'review_privacy_deletion',[own.id,own.version,'start','Self approval is forbidden'],claims('aal2')),{code:'42501'});
});
