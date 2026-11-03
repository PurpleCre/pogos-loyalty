import assert from 'node:assert/strict';
import {before,after,beforeEach,afterEach,test} from 'node:test';
import {randomUUID} from 'node:crypto';
import {createTestDatabase,asRole} from '../scripts/test-database.mjs';
import {seedHealthFixture,syntheticHealthPolicy} from './helpers/health-fixture.mjs';
import {healthSignals,evaluateOperationalHealth} from '../scripts/operational-health.mjs';
let db;
before(async()=>{db=await createTestDatabase();});after(async()=>{await db?.close();});
beforeEach(async()=>{await db.exec('BEGIN');});afterEach(async()=>{await db.exec('ROLLBACK');});
const snapshot=()=>asRole(db,'service_role',null,async()=>(await db.query('SELECT public.operational_health_snapshot() AS value')).rows[0].value);
test('only the service role can read health aggregates, including with a forged role claim',async()=>{
  for(const role of ['user','staff','manager','finance','admin']){
    const actor=randomUUID();await db.query('INSERT INTO auth.users(id,email) VALUES($1,$2)',[actor,`${role}@health.test`]);
    if(role!=='user')await db.query('INSERT INTO public.user_roles(user_id,role) VALUES($1,$2)',[actor,role]);
    await db.exec('SAVEPOINT denied');
    try{await assert.rejects(asRole(db,'authenticated',actor,()=>db.query('SELECT public.operational_health_snapshot()'),{role:'service_role',aal:'aal2'}),{code:'42501'});}
    finally{await db.exec('ROLLBACK TO SAVEPOINT denied; RELEASE SAVEPOINT denied');}
  }
  await db.exec('SAVEPOINT denied');
  try{await assert.rejects(asRole(db,'anon',null,()=>db.query('SELECT public.operational_health_snapshot()')),{code:'42501'});}
  finally{await db.exec('ROLLBACK TO SAVEPOINT denied; RELEASE SAVEPOINT denied');}
  assert.equal((await snapshot()).scope,'all-branches');
});
test('function metadata is stable, definer-scoped and has no public/customer execution grant',async()=>{
  const row=(await db.query(`SELECT p.provolatile,p.prosecdef,p.proconfig,
    has_function_privilege('anon',p.oid,'EXECUTE') AS anon,
    has_function_privilege('authenticated',p.oid,'EXECUTE') AS customer,
    has_function_privilege('service_role',p.oid,'EXECUTE') AS service
    FROM pg_proc p WHERE p.oid='public.operational_health_snapshot()'::regprocedure`)).rows[0];
  assert.equal(row.provolatile,'s');assert.equal(row.prosecdef,true);assert.ok(row.proconfig.includes('search_path=""'));
  assert.equal(row.anon,false);assert.equal(row.customer,false);assert.equal(row.service,true);
});
test('empty queues return all eight explicit zero gauges and a UTC observation without scheduler claims',async()=>{
  const value=await snapshot();assert.equal(value.schema_version,1);assert.equal(value.scope,'all-branches');assert.equal(value.coverage,'queue-state-only');
  assert.equal(new Date(value.observed_at).toISOString(),value.observed_at);assert.equal(Object.keys(value.metrics).length,8);
  for(const metric of Object.values(value.metrics))assert.deepEqual(metric,{count:0,clipped:false,oldest_age_seconds:null});
  assert.ok(!JSON.stringify(value).includes('heartbeat'));
});
test('cash expiry matches unpaid pending cash eligibility across branches and excludes future/received work',async()=>{
  const f=await seedHealthFixture(db);await f.order();await f.order({branch:f.second});await f.order({due:false});await f.order({status:'accepted'});await f.order({status:'completed',payment:'paid'});
  const value=await snapshot();assert.equal(value.metrics.cash_expiry_due.count,2);assert.ok(value.metrics.cash_expiry_due.oldest_age_seconds>=600);
});
test('reward expiry excludes handovers, finished reservations and future holds',async()=>{
  const f=await seedHealthFixture(db);await f.reservation();await f.reservation({due:false});await f.reservation({status:'claiming'});await f.reservation({status:'fulfilled'});
  assert.equal((await snapshot()).metrics.reward_expiry_due.count,1);
});
test('push due sends, receipts, expired leases and unknown outcomes remain distinct',async()=>{
  const f=await seedHealthFixture(db);
  for(const args of [{state:'queued'},{state:'retry'},{state:'queued',due:false},{state:'ticket'},{state:'ticket',due:false},{state:'sending'},{state:'checking'},{state:'sending',leasePast:false},{state:'unknown'},{state:'failed'},{state:'provider_accepted'}]){await f.delivery(args);await f.nextEvent();}
  const {metrics}=await snapshot();assert.equal(metrics.push_send_due.count,2);assert.equal(metrics.push_receipt_due.count,1);assert.equal(metrics.push_lease_overdue.count,2);assert.equal(metrics.push_unknown.count,1);
});
test('cash custody and open finance variances are counts only and exclude settled/rejected records',async()=>{
  const f=await seedHealthFixture(db);
  for(const settled of [false,true]){
    const order=await f.order({status:'completed',payment:'paid'});
    await db.query(`INSERT INTO public.cash_receipts(order_id,store_id,sale_reference,currency,amount_minor,tendered_minor,change_minor,received_by,current_holder_id,settled_at)
      VALUES($1,$2,$3,'USD',1000,1000,0,$4,$4,CASE WHEN $5 THEN now() ELSE NULL END)`,[order,f.branch,randomUUID(),f.user,settled]);
  }
  for(const [i,status] of ['variance','rejected','accepted','stale','matched'].entries())await db.query(`INSERT INTO public.finance_reconciliations(id,store_id,business_day,currency,submitted_by,observed,snapshot,signature,evidence,status,revision)
    VALUES($1,$2,current_date-$3::int,'USD',$4,'{}','{}','private-signature','Private fiscal evidence',$5,1)`,[randomUUID(),f.branch,i,f.user,status]);
  const value=await snapshot();assert.equal(value.metrics.cash_custody_open.count,1);assert.equal(value.metrics.finance_variance_open.count,1);
  const text=JSON.stringify(value);for(const forbidden of ['private','Private','amount_minor','USD',f.user,f.branch,f.device])assert.ok(!text.includes(forbidden),forbidden);
});
test('counts saturate explicitly at 1000 and retain the oldest observation',async()=>{
  const f=await seedHealthFixture(db);
  await db.query(`INSERT INTO public.orders(user_id,store_id,total_amount,payment_method,payment_status,acceptance_deadline)
    SELECT $1,$2,1,'cash','unpaid',now()-make_interval(secs=>n) FROM generate_series(1,1002) n`,[f.user,f.branch]);
  const value=(await snapshot()).metrics.cash_expiry_due;assert.equal(value.count,1000);assert.equal(value.clipped,true);assert.ok(value.oldest_age_seconds>=1002);
});
test('collecting metrics leaves orders, reservations, delivery leases, cash and ledger records unchanged',async()=>{
  const f=await seedHealthFixture(db);await f.order();await f.reservation();await f.delivery();
  const tables=['orders','reward_reservations','push_deliveries','cash_receipts','cash_movements','loyalty_accounts','loyalty_ledger','notification_events','push_delivery_results'];
  const contents=async()=>Promise.all(tables.map(async table=>(await db.query(`SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]') AS rows FROM public.${table} t`)).rows[0].rows));
  const before=await contents();await snapshot();await snapshot();assert.deepEqual(await contents(),before);
});
test('snapshot executes inside a read-only transaction',async()=>{
  await db.exec('SET TRANSACTION READ ONLY');assert.equal((await snapshot()).coverage,'queue-state-only');
});
test('future-dated exception records stay invalid rather than becoming a falsely clear zero-age queue',async()=>{
  const f=await seedHealthFixture(db);await f.delivery({state:'unknown',age:'-10 minutes'});
  const value=await snapshot();assert.ok(value.metrics.push_unknown.oldest_age_seconds<0);
  const rules=syntheticHealthPolicy(healthSignals);rules.rules.push_unknown={warning_count:null,critical_count:null,warning_age_seconds:60,critical_age_seconds:300};
  assert.equal(evaluateOperationalHealth(value,rules).status,'unknown');
});
