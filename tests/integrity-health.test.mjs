import assert from 'node:assert/strict';
import {before,after,beforeEach,afterEach,test} from 'node:test';
import {randomUUID} from 'node:crypto';
import {createTestDatabase,asRole} from '../scripts/test-database.mjs';
import {seedIntegrityFixture} from './helpers/integrity-fixture.mjs';
let db;before(async()=>{db=await createTestDatabase();});after(async()=>{await db?.close();});
beforeEach(async()=>{await db.exec('BEGIN');});afterEach(async()=>{await db.exec('ROLLBACK');});
const snapshot=()=>asRole(db,'service_role',null,async()=>(await db.query('SELECT public.operational_integrity_snapshot() AS value')).rows[0].value);
async function savepoint(work){await db.exec('SAVEPOINT probe');try{return await work();}finally{await db.exec('ROLLBACK TO SAVEPOINT probe; RELEASE SAVEPOINT probe');}}
test('integrity snapshot is stable, read-only and denied to all customer/staff/admin callers',async()=>{
  for(const role of ['user','staff','manager','finance','admin']){
    const actor=randomUUID();await db.query('INSERT INTO auth.users(id,email) VALUES($1,$2)',[actor,`${role}@integrity.invalid`]);
    if(role!=='user')await db.query('INSERT INTO public.user_roles(user_id,role) VALUES($1,$2)',[actor,role]);
    await savepoint(()=>assert.rejects(asRole(db,'authenticated',actor,()=>db.query('SELECT public.operational_integrity_snapshot()'),{role:'service_role',aal:'aal2'}),{code:'42501'}));
  }
  await savepoint(()=>assert.rejects(asRole(db,'anon',null,()=>db.query('SELECT public.operational_integrity_snapshot()')),{code:'42501'}));
  const p=(await db.query(`SELECT provolatile,prosecdef,proconfig FROM pg_proc WHERE oid='public.operational_integrity_snapshot()'::regprocedure`)).rows[0];assert.equal(p.provolatile,'s');assert.equal(p.prosecdef,true);assert.ok(p.proconfig.includes('search_path=""'));
});
test('clean ledger returns no mismatches and disabled push is explicit',async()=>{
  const value=await snapshot();assert.equal(value.metrics.loyalty_mismatches.count,0);assert.equal(value.push_enabled,false);assert.equal(value.metrics.push_materialisation_due.count,0);
});
test('valid large point projections and active reward holds reconcile exactly without emitting values',async()=>{
  const f=await seedIntegrityFixture(db);await f.fund('9007199254740993');
  const reservation=await f.reservation();await db.query(`INSERT INTO public.loyalty_ledger(user_id,event_key,kind,points_delta,reserved_delta,reservation_id) VALUES($1,$2,'reward_hold',-10,10,$3)`,[f.user,`hold:${randomUUID()}`,reservation]);
  const value=await snapshot();assert.equal(value.metrics.loyalty_mismatches.count,0);assert.ok(!JSON.stringify(value).includes('9007199254740993'));
});
test('account/display/opening/gross mismatches count an account once and never repair it',async()=>{
  const f=await seedIntegrityFixture(db);
  for(const statement of ['UPDATE public.loyalty_accounts SET balance=balance+1 WHERE user_id=$1','UPDATE public.user_points SET current_points=current_points+1 WHERE user_id=$1','UPDATE public.loyalty_accounts SET opening_balance=opening_balance+1 WHERE user_id=$1','UPDATE public.loyalty_accounts SET earned_gross=earned_gross+1 WHERE user_id=$1','UPDATE public.user_points SET total_redeemed=total_redeemed+1 WHERE user_id=$1'])await savepoint(async()=>{
    await db.query(statement,[f.user]);const before=(await db.query('SELECT to_jsonb(a) AS value FROM public.loyalty_accounts a WHERE user_id=$1',[f.user])).rows[0].value;
    assert.equal((await snapshot()).metrics.loyalty_mismatches.count,1);assert.deepEqual((await db.query('SELECT to_jsonb(a) AS value FROM public.loyalty_accounts a WHERE user_id=$1',[f.user])).rows[0].value,before);
  });
});
test('active holds without a corresponding ledger hold are detected',async()=>{
  const f=await seedIntegrityFixture(db);await f.reservation();assert.equal((await snapshot()).metrics.loyalty_mismatches.count,1);
});
test('missing projection rows and hold-only subjects cannot disappear from the reconciliation population',async()=>{
  const f=await seedIntegrityFixture(db);
  for(const table of ['loyalty_accounts','user_points'])await savepoint(async()=>{await db.query(`DELETE FROM public.${table} WHERE user_id=$1`,[f.user]);assert.equal((await snapshot()).metrics.loyalty_mismatches.count,1);});
  await f.reservation();await db.exec('ALTER TABLE public.loyalty_ledger DISABLE TRIGGER immutable_loyalty_ledger');
  for(const table of ['loyalty_accounts','user_points','loyalty_ledger'])await db.query(`DELETE FROM public.${table} WHERE user_id=$1`,[f.user]);
  assert.equal((await snapshot()).metrics.loyalty_mismatches.count,1);
});
test('a missing zero opening is detected even when other zero-value ledger rows remain',async()=>{
  const f=await seedIntegrityFixture(db);await db.query(`INSERT INTO public.loyalty_ledger(user_id,event_key,kind,points_delta) VALUES($1,$2,'opening_review',0)`,[f.user,`review:${randomUUID()}`]);
  await db.exec('ALTER TABLE public.loyalty_ledger DISABLE TRIGGER immutable_loyalty_ledger');await db.query("DELETE FROM public.loyalty_ledger WHERE user_id=$1 AND kind='opening'",[f.user]);
  assert.equal((await snapshot()).metrics.loyalty_mismatches.count,1);
});
test('missing materialisation counts eligible event/device pairs and excludes any existing pair state',async()=>{
  const f=await seedIntegrityFixture(db);assert.equal((await snapshot()).metrics.push_materialisation_due.count,1);
  await db.query(`INSERT INTO public.push_devices(id,secret_hash,user_id,expo_token,project_id,platform,aal2,bound_at,expires_at) VALUES($1,'private',$2,'ExpoPushToken[second_private]',$3,'ios',true,now()-interval '1 hour',now()+interval '1 day')`,[randomUUID(),f.user,f.project]);
  assert.equal((await snapshot()).metrics.push_materialisation_due.count,2);
  await f.delivery({state:'failed'});assert.equal((await snapshot()).metrics.push_materialisation_due.count,1);
});
test('withdrawn, expired, wrong-project, late-bound and otherwise ineligible notifications are excluded',async()=>{
  const f=await seedIntegrityFixture(db);
  const mutations=[['UPDATE public.push_settings SET enabled=false',[]],['UPDATE public.push_devices SET active=false WHERE id=$1',[f.device]],['UPDATE public.push_devices SET expo_token=NULL WHERE id=$1',[f.device]],['UPDATE public.push_devices SET project_id=$1 WHERE id=$2',[randomUUID(),f.device]],["UPDATE public.push_devices SET expires_at=now()-interval '1 second' WHERE id=$1",[f.device]],["UPDATE public.push_devices SET bound_at=now() WHERE id=$1",[f.device]],["UPDATE public.notification_events SET expires_at=now()-interval '1 second' WHERE id=$1",[f.event]],['UPDATE public.push_settings SET enabled_since=now()',[]],["UPDATE public.notification_events SET kind='branch',order_id=NULL WHERE id=$1",[f.event]],['UPDATE auth.users SET deleted_at=now() WHERE id=$1',[f.user]],["INSERT INTO public.privacy_requests(id,user_id,kind,status) VALUES($1,$2,'deletion','processing')",[randomUUID(),f.user]]];
  for(const [sql,args]of mutations)await savepoint(async()=>{await db.query(sql,args);assert.equal((await snapshot()).metrics.push_materialisation_due.count,0,sql);});
});
test('privileged recipient MFA expiry and wrong ownership do not create eligible backlog',async()=>{
  const f=await seedIntegrityFixture(db);
  for(const role of ['staff','manager','finance','admin'])await savepoint(async()=>{
    await db.query('INSERT INTO public.user_roles(user_id,role) VALUES($1,$2)',[f.user,role]);
    await db.query("UPDATE public.push_devices SET verified_at=now()-interval '25 hours' WHERE id=$1",[f.device]);assert.equal((await snapshot()).metrics.push_materialisation_due.count,0);
    await db.query('UPDATE public.push_devices SET verified_at=now(),aal2=true WHERE id=$1',[f.device]);assert.equal((await snapshot()).metrics.push_materialisation_due.count,1);
    await db.query('UPDATE public.push_devices SET aal2=false WHERE id=$1',[f.device]);assert.equal((await snapshot()).metrics.push_materialisation_due.count,0);
  });
  const other=randomUUID();await db.query('INSERT INTO auth.users(id,email) VALUES($1,$2)',[other,'other@integrity.invalid']);await db.query('UPDATE public.orders SET user_id=$1 WHERE id=$2',[other,f.orderId]);assert.equal((await snapshot()).metrics.push_materialisation_due.count,0);
});
async function assertRecipientParity(expectedCount){
  const expected=(await db.query(`SELECT count(*)::int AS n FROM public.notification_events e
    JOIN public.push_devices d ON d.user_id=e.recipient_id JOIN public.push_settings s ON s.singleton
    WHERE s.enabled AND d.project_id=s.expo_project_id AND d.active AND d.expo_token IS NOT NULL
      AND d.expires_at>statement_timestamp() AND d.bound_at<=e.created_at
      AND e.created_at>=s.enabled_since AND e.expires_at>statement_timestamp()
      AND public.push_event_allowed(e.id,d.user_id)
      AND (NOT EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=d.user_id AND r.role IN ('staff','manager','finance','admin'))
        OR (d.aal2 AND d.verified_at>statement_timestamp()-interval '24 hours'))
      AND NOT EXISTS(SELECT 1 FROM public.push_deliveries j WHERE j.event_id=e.id AND j.device_id=d.id)`)).rows[0].n;
  assert.equal(expected,expectedCount);assert.equal((await snapshot()).metrics.push_materialisation_due.count,expected);
}
test('scaled recipient predicates match the authoritative helper for branch role and membership changes',async()=>{
  const f=await seedIntegrityFixture(db);await db.query("UPDATE public.notification_events SET kind='branch',order_id=NULL WHERE id=$1",[f.event]);
  await assertRecipientParity(0);
  for(const role of ['staff','manager','finance','admin'])await savepoint(async()=>{
    await db.query('INSERT INTO public.user_roles(user_id,role) VALUES($1,$2)',[f.user,role]);
    await assertRecipientParity(role==='admin'?1:0);
    await db.query('INSERT INTO public.staff_memberships(user_id,store_id,active) VALUES($1,$2,true)',[f.user,f.branch]);
    await assertRecipientParity(role==='finance'?0:1);
    await db.query('UPDATE public.staff_memberships SET active=false WHERE user_id=$1',[f.user]);await assertRecipientParity(role==='admin'?1:0);
    await db.query("UPDATE public.push_devices SET verified_at=now()-interval '25 hours' WHERE id=$1",[f.device]);await assertRecipientParity(0);
  });
});
test('scaled recipient predicates match reward ownership, deletion states and current account availability',async()=>{
  const f=await seedIntegrityFixture(db),reservation=await f.reservation();
  await db.query("UPDATE public.notification_events SET kind='reward',order_id=NULL,reservation_id=$1 WHERE id=$2",[reservation,f.event]);await assertRecipientParity(1);
  await savepoint(async()=>{await db.query('UPDATE public.notification_events SET reservation_id=NULL WHERE id=$1',[f.event]);await assertRecipientParity(0);});
  const other=randomUUID();await db.query('INSERT INTO auth.users(id,email) VALUES($1,$2)',[other,'other-reward@integrity.invalid']);
  await savepoint(async()=>{await db.query('UPDATE public.reward_reservations SET user_id=$1 WHERE id=$2',[other,reservation]);await assertRecipientParity(0);});
  for(const [status,count]of [['submitted',1],['processing',0],['completed',0]])await savepoint(async()=>{
    await db.query("INSERT INTO public.privacy_requests(id,user_id,kind,status) VALUES($1,$2,'deletion',$3)",[randomUUID(),f.user,status]);await assertRecipientParity(count);
  });
  await db.query('UPDATE auth.users SET deleted_at=now() WHERE id=$1',[f.user]);await assertRecipientParity(0);
});
test('service claim materialises a pair while the observation itself never creates, leases or sends it',async()=>{
  const f=await seedIntegrityFixture(db);const first=await snapshot();assert.equal(first.metrics.push_materialisation_due.count,1);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM public.push_deliveries')).rows[0].n,0);
  await asRole(db,'service_role',null,()=>db.query('SELECT public.claim_push_deliveries(10)'));assert.equal((await snapshot()).metrics.push_materialisation_due.count,0);
  assert.equal((await db.query('SELECT dispatch_started_at FROM public.push_deliveries WHERE event_id=$1',[f.event])).rows[0].dispatch_started_at,null);
});
test('whole-ledger mismatch counts clip explicitly at 1000',async()=>{
  await db.query(`INSERT INTO auth.users(id,email) SELECT gen_random_uuid(),'cap-'||n||'@integrity.invalid' FROM generate_series(1,1002) n`);
  await db.query(`UPDATE public.loyalty_accounts SET balance=balance+1`);
  const metric=(await snapshot()).metrics.loyalty_mismatches;assert.equal(metric.count,1000);assert.equal(metric.clipped,true);
});
test('materialisation counts clip at 1000 while preserving oldest eligible event age',async()=>{
  const f=await seedIntegrityFixture(db);
  await db.query(`INSERT INTO public.notification_events(id,source_id,kind,recipient_id,store_id,order_id,created_at,expires_at)
    SELECT gen_random_uuid(),gen_random_uuid(),'order',$1,$2,$3,now()-make_interval(secs=>600+n),now()+interval '20 minutes' FROM generate_series(1,1002) n`,[f.user,f.branch,f.orderId]);
  const metric=(await snapshot()).metrics.push_materialisation_due;assert.equal(metric.count,1000);assert.equal(metric.clipped,true);assert.ok(metric.oldest_age_seconds>=1602);
});
test('integrity output excludes identities, tokens, source values and fiscal references',async()=>{
  const f=await seedIntegrityFixture(db);const text=JSON.stringify(await snapshot());
  for(const forbidden of [f.user,f.device,f.project,f.event,f.branch,f.orderId,'Private','private','ExpoPushToken','PRIVATE-PRODUCT','amount_minor','ledger_balance'])assert.ok(!text.includes(forbidden),forbidden);
});
test('integrity observation executes in a read-only transaction without advisory locks',async()=>{
  await db.exec('SET TRANSACTION READ ONLY');
  const locks=async()=>(await db.query("SELECT count(*)::int AS n FROM pg_locks WHERE locktype='advisory' AND pid=pg_backend_pid()")).rows[0].n;
  const before=await locks();await snapshot();assert.equal(await locks(),before);
});
