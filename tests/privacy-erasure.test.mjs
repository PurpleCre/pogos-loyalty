import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { createTestDatabase, asRole } from '../scripts/test-database.mjs';
import { installPrivacyPolicy } from './helpers/privacy-policy-fixture.mjs';
import { privacyPolicyDraft, writePrivacyPolicyDraft } from '../scripts/privacy-policy-draft.mjs';
import { mkdtemp, readFile, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let db, defaults;
const reviewer=randomUUID(),branch=randomUUID(),policy='fixture-core-v1';
const claims=()=>({aal:'aal2',amr:[{method:'password',timestamp:Math.floor(Date.now()/1000)}]});
const call=(name,args,role='service_role',user=null)=>asRole(db,role,user,async()=>(await db.query(`SELECT public.${name}(${args.map((_,i)=>`$${i+1}`).join(',')}) AS result`,args)).rows[0].result,claims());
before(async()=>{
  db=await createTestDatabase();
  defaults=(await db.query(`SELECT application_erasure_enabled,application_policy_version,(SELECT count(*)::int FROM public.privacy_application_policies) AS policies FROM public.privacy_settings`)).rows[0];
  await db.query(`INSERT INTO auth.users(id,email) VALUES($1,'reviewer@fixture.test')`,[reviewer]);
  await db.query(`INSERT INTO public.user_roles(user_id,role) VALUES($1,'admin')`,[reviewer]);
  await db.query(`INSERT INTO public.privacy_reviewers(user_id) VALUES($1)`,[reviewer]);
  await db.query(`INSERT INTO public.stores(id,name,address,distance_miles) VALUES($1,'Erasure fixture','Fixture',0)`,[branch]);
  await db.exec(`INSERT INTO public.privacy_notices(version,controller_name,body,support_email,approval_reference,approved_by,approved_at) VALUES('fixture-v1','Fixture controller','Disposable fixture notice; no legal approval.','privacy@fixture.test','synthetic-fixture','Fixture reviewer',now());
    INSERT INTO public.privacy_retention_approvals(version,policy_reference,approved_by,approved_at) VALUES('fixture-retention','synthetic-retention-only','Fixture reviewer',now());
    UPDATE public.privacy_settings SET active_notice_version='fixture-v1',retention_policy_version='fixture-retention',deletion_processing_enabled=true`);
  await installPrivacyPolicy(db,policy);
  await db.query(`UPDATE public.privacy_settings SET application_policy_version=$1,application_erasure_enabled=true`,[policy]);
});
after(async()=>{await db?.close();});
async function account(){
  const id=randomUUID();await db.query(`INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,'{"full_name":"Private fixture"}')`,[id,`${id}@fixture.test`]);return id;
}
async function processing({deleted=true}={}){
  const user=await account();
  let request=await call('submit_privacy_request',[randomUUID(),'deletion'],'authenticated',user);
  request=await call('review_privacy_deletion',[request.id,request.version,'start','Synthetic case review'],'authenticated',reviewer);
  assert.equal(request.status,'processing');
  // Auth-admin behaviour is an external boundary, simulated only in this fixture.
  if(deleted)await db.query(`UPDATE auth.users SET deleted_at=now() WHERE id=$1`,[user]);
  return {user,request,run:randomUUID()};
}
const minimize=(c,overrides={})=>call('minimize_privacy_application',[c.request.id,c.request.version,policy,c.run,'Fixture operator',10000].map((value,i)=>Object.hasOwn(overrides,i)?overrides[i]:value));
async function push(user,{recipient=user,state='provider_accepted'}={}){
  const device=randomUUID(),event=randomUUID(),delivery=randomUUID(),result=randomUUID();
  await db.query(`INSERT INTO public.push_devices(id,secret_hash,user_id,project_id,platform,active,aal2,expires_at) VALUES($1,'private-proof',$2,$3,'android',false,false,now())`,[device,user,randomUUID()]);
  await db.query(`INSERT INTO public.notification_events(id,source_id,kind,recipient_id,store_id) VALUES($1,$2,'branch',$3,$4)`,[event,randomUUID(),recipient,branch]);
  await db.query(`INSERT INTO public.push_deliveries(id,event_id,device_id,device_version,state) VALUES($1,$2,$3,1,$4)`,[delivery,event,device,state]);
  await db.query(`INSERT INTO public.push_delivery_results(id,delivery_id,stage,outcome,reason) VALUES($1,$2,'operator','fixture','Private provider fixture')`,[result,delivery]);
  return {device,event,delivery,result};
}
test('migration never seeds approval or enables physical minimisation',()=>{
  assert.deepEqual(defaults,{application_erasure_enabled:false,application_policy_version:null,policies:0});
});
test('application operations and private helpers are inaccessible to customer/admin API callers',async()=>{
  const c=await processing();
  for(const role of ['anon','authenticated'])for(const user of [c.user,reviewer]){
    await assert.rejects(call('minimize_privacy_application',[c.request.id,c.request.version,policy,c.run,'Fixture operator',10000],role,user),{code:'42501'});
    await assert.rejects(call('attest_privacy_application_review',[c.request.id,c.request.version,policy,c.run,'fixture-review','Fixture operator'],role,user),{code:'42501'});
  }
  for(const [name,args] of [['privacy_application_schema',[]],['privacy_core_fields',[]],['validate_privacy_application_policy',[policy]],['privacy_financial_fingerprint',[c.user]],['privacy_core_request',[c.request.id,c.request.version,policy]],['privacy_push_purge_allowed',[randomUUID()]],['privacy_core_clean',[c.user]]]){
    await assert.rejects(call(name,args),{code:'42501'});
  }
});
test('API service role cannot forge policies, transaction capabilities or erasure receipts',async()=>{
  for(const table of ['privacy_application_context','privacy_application_policies','privacy_application_runs']){
    await asRole(db,'service_role',null,()=>assert.rejects(db.query(`SELECT * FROM public.${table}`),{code:'42501'}));
    await asRole(db,'service_role',null,()=>assert.rejects(db.query(`DELETE FROM public.${table}`),{code:'42501'}));
  }
  await asRole(db,'service_role',null,()=>assert.rejects(db.exec(`INSERT INTO public.privacy_application_context VALUES(txid_current(),pg_backend_pid(),gen_random_uuid())`),{code:'42501'}));
});
test('enabled settings and provider deletion are mandatory before any mutation',async()=>{
  const c=await processing({deleted:false});
  await db.exec(`UPDATE public.privacy_settings SET application_erasure_enabled=false`);
  await assert.rejects(minimize(c),{code:'42501'});
  await db.exec(`UPDATE public.privacy_settings SET application_erasure_enabled=true`);
  await assert.rejects(minimize(c),{code:'22023'});
  assert.ok((await db.query(`SELECT email FROM public.profiles WHERE id=$1`,[c.user])).rows[0].email);
  assert.equal((await db.query(`SELECT count(*)::int AS n FROM public.privacy_application_runs WHERE request_id=$1`,[c.request.id])).rows[0].n,0);
});
test('null/oversized budgets and stale request versions cannot perform minimisation',async()=>{
  const c=await processing();
  for(const overrides of [{3:null},{4:null},{4:' '},{5:null},{5:0},{5:50001}])await assert.rejects(minimize(c,overrides),{code:'22023'});
  await assert.rejects(minimize(c,{1:c.request.version+1}),{code:'40001'});
  assert.ok((await db.query(`SELECT email FROM public.profiles WHERE id=$1`,[c.user])).rows[0].email);
});
test('switching the active application approval invalidates earlier policy receipts',async()=>{
  const c=await processing();await minimize(c);
  const next=`policy-switch-${randomUUID()}`;await installPrivacyPolicy(db,next);
  await db.query(`UPDATE public.privacy_settings SET application_policy_version=$1`,[next]);
  try{
    await assert.rejects(minimize(c),{code:'42501'});
    await assert.rejects(call('attest_privacy_application_review',[c.request.id,c.request.version,policy,c.run,'fixture-review','Fixture operator']),{code:'42501'});
  }finally{await db.query(`UPDATE public.privacy_settings SET application_policy_version=$1`,[policy]);}
});
test('complete exact field coverage rejects missing, malformed and unsupported decisions',async()=>{
  const edits=[
    p=>{delete p.decisions['profiles.email'];},
    p=>{delete p.decisions['profiles.email'].action;p.decisions['profiles.email'].extra='core';},
    p=>{delete p.decisions['profiles.email'].reason_reference;p.decisions['profiles.email'].extra='review';},
    p=>{p.decisions['profiles.email'].action='retain';},
    p=>{p.decisions['profiles.id'].action='not_subject';p.decisions['profiles.id'].retain_until=null;},
    p=>{p.decisions['profiles.id'].retain_until=null;},
    p=>{p.decisions['profiles.email'].retain_until='2099-01-01';},
  ];
  for(const edit of edits){const v=`malformed-${randomUUID()}`;await installPrivacyPolicy(db,v,p=>{edit(p);return p;});await assert.rejects(db.query(`SELECT public.validate_privacy_application_policy($1)`,[v]),{code:'22023'});}
});
test('expired retention deadlines and schema drift invalidate reviewed policy',async()=>{
  const overdue=`overdue-${randomUUID()}`;
  await installPrivacyPolicy(db,overdue,p=>{p.decisions['profiles.id'].retain_until='2000-01-01';return p;});
  await assert.rejects(db.query(`SELECT public.validate_privacy_application_policy($1)`,[overdue]),{code:'42501'});
  await db.exec(`ALTER TABLE public.profiles ADD COLUMN synthetic_unreviewed TEXT`);
  try{await assert.rejects(db.query(`SELECT public.validate_privacy_application_policy($1)`,[policy]),{code:'42501'});}finally{await db.exec(`ALTER TABLE public.profiles DROP COLUMN synthetic_unreviewed`);}
});
test('future or expired approval cannot authorise minimisation',async()=>{
  for(const [start,end] of [['2098-01-01','2099-01-01'],['1999-01-01','2000-01-01']]){
    const v=`bad-time-${randomUUID()}`;
    await db.query(`INSERT INTO public.privacy_application_policies SELECT $1,retention_version,schema_fingerprint,operation_version,field_decisions,approval_reference,approved_by,$2,$3 FROM public.privacy_application_policies WHERE version=$4`,[v,start,end,policy]);
    await assert.rejects(db.query(`SELECT public.validate_privacy_application_policy($1)`,[v]),{code:'42501'});
  }
});
test('minimisation is account scoped, clears core PII and leaves financial state unchanged',async()=>{
  const c=await processing(),other=await account(),order=randomUUID(),quote=randomUUID();
  for(const user of [c.user,other]){
    await db.query(`INSERT INTO public.user_locations(user_id,address,latitude,longitude) VALUES($1,'Private address',0,0)`,[user]);
    await db.query(`INSERT INTO public.push_subscriptions(user_id,endpoint,p256dh,auth) VALUES($1,$2,'private-key','private-auth')`,[user,`https://fixture.test/${user}`]);
    await db.query(`INSERT INTO public.notifications(sent_to,title,body) VALUES($1,'Private title','Private content')`,[user]);
  }
  const ownPush=await push(c.user),otherPush=await push(other);
  await db.query(`INSERT INTO public.cash_order_quotes(id,user_id,store_id,request,snapshot) VALUES($1,$2,$3,'{"contact":"private"}','{"contact":{"phone":"private"},"address":"private","total_minor":"1000","items":[]}')`,[quote,c.user,branch]);
  // Seed a completed historical cash record without invoking live branch intake.
  await db.query(`INSERT INTO public.orders(id,user_id,store_id,status,total_amount,payment_status,cash_custody_status) VALUES($1,$2,$3,'completed',10,'paid','settled')`,[order,c.user,branch]);
  await db.query(`UPDATE public.orders SET quote_id=$1,submission_key=$2,currency='USD',subtotal_minor=1000,delivery_fee_minor=0,total_minor=1000,payment_method='cash',fulfilment_mode='collection',contact_snapshot='{"phone":"private"}',delivery_snapshot='{"address":"private"}' WHERE id=$3`,[quote,randomUUID(),order]);
  await db.query(`INSERT INTO public.cash_receipts(order_id,store_id,sale_reference,currency,amount_minor,tendered_minor,change_minor,received_by,current_holder_id,settled_at) VALUES($1,$2,$3,'USD',1000,1000,0,$4,$4,now())`,[order,branch,`FIXTURE-${order}`,reviewer]);
  await db.query(`INSERT INTO public.gaap_sync_log(gaap_transaction_id,user_id,store_id,raw_payload,line_items,error_message) VALUES($1,$2,$3,'{"customer":"private"}','[{"name":"private"}]','private error')`,[randomUUID(),c.user,branch]);
  const gift=randomUUID();await db.query(`INSERT INTO public.point_gifts(id,sender_id,recipient_id,points,message) VALUES($1,$2,$3,1,'Private gift message')`,[gift,c.user,other]);
  const before=(await db.query(`SELECT public.privacy_financial_fingerprint($1) AS fingerprint`,[c.user])).rows[0].fingerprint;
  const result=await minimize(c);
  assert.equal(result.application_task_completed,false);assert.equal(result.financial_fingerprint,before);
  assert.deepEqual((await db.query(`SELECT email,full_name,gaap_customer_id FROM public.profiles WHERE id=$1`,[c.user])).rows[0],{email:null,full_name:null,gaap_customer_id:null});
  assert.ok((await db.query(`SELECT email FROM public.profiles WHERE id=$1`,[other])).rows[0].email);
  for(const table of ['user_locations','push_subscriptions','push_devices'])assert.deepEqual((await db.query(`SELECT user_id FROM public.${table} WHERE user_id IN ($1,$2)`,[c.user,other])).rows,[{user_id:other}]);
  assert.equal((await db.query(`SELECT id FROM public.push_delivery_results WHERE id IN($1,$2)`,[ownPush.result,otherPush.result])).rows[0].id,otherPush.result);
  assert.deepEqual((await db.query(`SELECT request,snapshot FROM public.cash_order_quotes WHERE id=$1`,[quote])).rows[0],{request:{},snapshot:{total_minor:'1000',items:[]}});
  assert.deepEqual((await db.query(`SELECT contact_snapshot,delivery_snapshot FROM public.orders WHERE id=$1`,[order])).rows[0],{contact_snapshot:{},delivery_snapshot:null});
  assert.deepEqual((await db.query(`SELECT raw_payload,line_items,error_message FROM public.gaap_sync_log WHERE user_id=$1`,[c.user])).rows[0],{raw_payload:{},line_items:[],error_message:null});
  assert.deepEqual((await db.query(`SELECT points,message FROM public.point_gifts WHERE id=$1`,[gift])).rows[0],{points:1,message:null});
  assert.equal((await db.query(`SELECT count(*)::int AS n FROM public.privacy_application_context`)).rows[0].n,0);
  assert.equal((await db.query(`SELECT status FROM public.privacy_request_tasks WHERE request_id=$1 AND system='application'`,[c.request.id])).rows[0].status,'pending');
});
test('unresolved dispatch states preserve all device/provider evidence and block scrubbing',async()=>{
  for(const state of ['queued','sending','retry','ticket','checking','unknown']){
    const c=await processing(),p=await push(c.user,{state});
    await assert.rejects(minimize(c),{code:'22023'});
    assert.equal((await db.query(`SELECT id FROM public.push_delivery_results WHERE id=$1`,[p.result])).rows.length,1);
    assert.ok((await db.query(`SELECT email FROM public.profiles WHERE id=$1`,[c.user])).rows[0].email);
  }
});
test('terminal jobs bound to a deleting device can be purged without deleting another recipient event',async()=>{
  const c=await processing(),other=await account(),p=await push(c.user,{recipient:other,state:'cancelled'});
  await minimize(c);
  assert.equal((await db.query(`SELECT id FROM public.push_deliveries WHERE id=$1`,[p.delivery])).rows.length,0);
  assert.equal((await db.query(`SELECT recipient_id FROM public.notification_events WHERE id=$1`,[p.event])).rows[0].recipient_id,other);
});
test('historical invitation contact uses the retained profile match after provider contact is removed',async()=>{
  const c=await processing(),other=await account(),own=randomUUID(),unrelated=randomUUID();
  for(const [id,user]of[[own,c.user],[unrelated,other]])await db.query(`INSERT INTO public.staff_invitations(id,email,store_id,invited_by,reason,expires_at,revoked_at) SELECT $1,email,$2,$3,'Private fixture reason',now(),now() FROM public.profiles WHERE id=$4`,[id,branch,reviewer,user]);
  await db.query(`UPDATE auth.users SET email=NULL WHERE id=$1`,[c.user]);
  await minimize(c);
  assert.deepEqual((await db.query(`SELECT email,reason FROM public.staff_invitations WHERE id=$1`,[own])).rows[0],{email:`deleted-${c.user}@invalid.test`,reason:'[Deleted]'});
  assert.deepEqual((await db.query(`SELECT email,reason FROM public.staff_invitations WHERE id=$1`,[unrelated])).rows[0],{email:`${other}@fixture.test`,reason:'Private fixture reason'});
});
test('row limit rolls back contacts, device audits and receipts as one transaction',async()=>{
  const c=await processing(),p=await push(c.user);
  await db.query(`INSERT INTO public.user_locations(user_id,address,latitude,longitude) VALUES($1,'Private address',0,0)`,[c.user]);
  await assert.rejects(minimize(c,{5:1}),{code:'54000'});
  assert.ok((await db.query(`SELECT email FROM public.profiles WHERE id=$1`,[c.user])).rows[0].email);
  assert.equal((await db.query(`SELECT id FROM public.push_delivery_results WHERE id=$1`,[p.result])).rows.length,1);
  assert.equal((await db.query(`SELECT id FROM public.privacy_application_runs WHERE id=$1`,[c.run])).rows.length,0);
  assert.equal((await db.query(`SELECT count(*)::int AS n FROM public.privacy_application_context`)).rows[0].n,0);
});
test('lost responses recover the same immutable run and reject changed identities',async()=>{
  const c=await processing(),result=await minimize(c);
  assert.deepEqual(await minimize(c),result);
  for(const overrides of [{3:randomUUID()},{4:'Different operator'},{5:9999}])await assert.rejects(minimize(c,overrides),{code:'22023'});
  await assert.rejects(db.query(`UPDATE public.privacy_application_runs SET result='{}' WHERE id=$1`,[c.run]),{code:'42501'});
  await assert.rejects(db.query(`DELETE FROM public.privacy_application_runs WHERE id=$1`,[c.run]),{code:'42501'});
});
test('application completion needs current manual review evidence matching the physical run',async()=>{
  const c=await processing();await minimize(c);
  const task=(evidence='fixture-review',operator='Fixture operator')=>call('record_privacy_task',[c.request.id,'application','completed',evidence,operator]);
  await assert.rejects(task(),{code:'22023'});
  const args=[c.request.id,c.request.version,policy,c.run,'fixture-review','Fixture operator'];
  await call('attest_privacy_application_review',args);await call('attest_privacy_application_review',args);
  await assert.rejects(call('attest_privacy_application_review',[...args.slice(0,4),'different-review','Fixture operator']),{code:'22023'});
  await assert.rejects(task('guessed-review'),{code:'22023'});await assert.rejects(task('fixture-review','Other operator'),{code:'22023'});
  await task();
  assert.equal((await db.query(`SELECT status FROM public.privacy_requests WHERE id=$1`,[c.request.id])).rows[0].status,'processing');
  await assert.rejects(call('complete_privacy_deletion',[c.request.id,c.request.version,'premature-fixture-completion']),{code:'22023'});
});
test('paused/resumed cases invalidate old run versions and block stale manual attestations',async()=>{
  const c=await processing();await minimize(c);
  let paused=await call('review_privacy_deletion',[c.request.id,c.request.version,'pause','Review synthetic case again'],'authenticated',reviewer);
  await assert.rejects(minimize(c),{code:'40001'});
  paused=await call('review_privacy_deletion',[c.request.id,paused.version,'resume','Resume synthetic review'],'authenticated',reviewer);
  await assert.rejects(call('attest_privacy_application_review',[c.request.id,paused.version,policy,c.run,'fixture-review','Fixture operator']),{code:'40001'});
  c.request=paused;c.run=randomUUID();await minimize(c);
});
test('financial changes after minimisation reject replay and review instead of masking drift',async()=>{
  const c=await processing();await minimize(c);
  await db.query(`UPDATE public.user_points SET current_points=current_points+1 WHERE user_id=$1`,[c.user]);
  await assert.rejects(minimize(c),{code:'40001'});
  await assert.rejects(call('attest_privacy_application_review',[c.request.id,c.request.version,policy,c.run,'fixture-review','Fixture operator']),{code:'40001'});
});
test('recreated core contact invalidates a prior receipt, attestation and application completion',async()=>{
  const c=await processing(),order=randomUUID();
  await db.query(`INSERT INTO public.orders(id,user_id,store_id,status,total_amount) VALUES($1,$2,$3,'cancelled',10)`,[order,c.user,branch]);
  await minimize(c);
  const args=[c.request.id,c.request.version,policy,c.run,'fixture-review','Fixture operator'];
  await call('attest_privacy_application_review',args);
  await db.query(`UPDATE public.orders SET contact_snapshot='{"phone":"recreated-private-contact"}' WHERE id=$1`,[order]);
  await assert.rejects(minimize(c),{code:'40001'});
  await assert.rejects(call('attest_privacy_application_review',args),{code:'40001'});
  await assert.rejects(call('record_privacy_task',[c.request.id,'application','completed','fixture-review','Fixture operator']),{code:'22023'});
});
test('active trading and newly restored staff privileges fail closed',async()=>{
  const c=await processing();
  await db.query(`INSERT INTO public.orders(user_id,store_id,total_amount) VALUES($1,$2,10)`,[c.user,branch]);
  await assert.rejects(minimize(c),{code:'22023'});
  await db.query(`UPDATE public.orders SET status='cancelled' WHERE user_id=$1`,[c.user]);
  await db.query(`INSERT INTO public.user_roles(user_id,role) VALUES($1,'admin')`,[c.user]);
  await assert.rejects(minimize(c),{code:'22023'});
});
test('forged flags cannot bypass immutable push evidence or identity/financial audit guards',async()=>{
  const c=await processing(),p=await push(c.user);
  await db.exec(`SELECT set_config('privacy.application_erasure','true',false)`);
  await assert.rejects(db.query(`DELETE FROM public.push_delivery_results WHERE id=$1`,[p.result]),{code:'42501'});
  await assert.rejects(db.query(`UPDATE public.push_delivery_results SET reason='forged' WHERE id=$1`,[p.result]),{code:'42501'});
  await assert.rejects(db.query(`UPDATE public.privacy_application_policies SET approval_reference='forged' WHERE version=$1`,[policy]),{code:'42501'});
  await assert.rejects(db.query(`DELETE FROM public.privacy_request_events WHERE request_id=$1`,[c.request.id]),{code:'42501'});
  // A valid run removes only its own terminal provider evidence.
  await minimize(c);
});
test('financial mutation from a database trigger aborts the entire minimisation transaction',async()=>{
  const c=await processing();
  await db.exec(`CREATE FUNCTION public.synthetic_financial_mutation() RETURNS TRIGGER LANGUAGE plpgsql AS $$BEGIN UPDATE public.user_points SET current_points=current_points+1 WHERE user_id=NEW.id;RETURN NEW;END;$$;
    CREATE TRIGGER synthetic_financial_mutation AFTER UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.synthetic_financial_mutation()`);
  try{
    await assert.rejects(minimize(c),{code:'23514'});
    assert.equal((await db.query(`SELECT current_points FROM public.user_points WHERE user_id=$1`,[c.user])).rows[0].current_points,0);
    assert.ok((await db.query(`SELECT email FROM public.profiles WHERE id=$1`,[c.user])).rows[0].email);
    assert.equal((await db.query(`SELECT id FROM public.privacy_application_runs WHERE id=$1`,[c.run])).rows.length,0);
  }finally{await db.exec(`DROP TRIGGER synthetic_financial_mutation ON public.profiles;DROP FUNCTION public.synthetic_financial_mutation()`);}
});
test('draft generation covers exact local fields and supplies no claimed approval or retention decisions',async()=>{
  const draft=await privacyPolicyDraft(db),core=(await db.query(`SELECT public.privacy_core_fields() AS value`)).rows[0].value;
  const columns=(await db.query(`SELECT table_name||'.'||column_name AS field FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position`)).rows.map(row=>row.field);
  assert.deepEqual(Object.keys(draft.field_decisions),columns);
  for(const key of ['version','retention_version','approval_reference','approved_by','approved_at','expires_at'])assert.equal(draft[key],null);
  for(const [field,decision] of Object.entries(draft.field_decisions)){
    const [table,column]=field.split('.');
    assert.deepEqual(decision,{action:core[table]?.includes(column)?'core':null,reason_reference:null,retain_until:null});
  }
  assert.equal((await db.query(`SELECT public.privacy_application_schema() AS value`)).rows[0].value,draft.schema_fingerprint);
});
test('private draft writer preserves an existing review and restricts file permissions',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'pogos-policy-fixture-')),path=join(dir,'private','draft.json');
  try{
    await writePrivacyPolicyDraft(db,path);
    const first=await readFile(path,'utf8');assert.equal(JSON.parse(first).approval_reference,null);
    assert.equal((await stat(path)).mode&0o777,0o600);
    await assert.rejects(writePrivacyPolicyDraft(db,path),{code:'EEXIST'});
    assert.equal(await readFile(path,'utf8'),first);
  }finally{await rm(dir,{recursive:true,force:true});}
});
