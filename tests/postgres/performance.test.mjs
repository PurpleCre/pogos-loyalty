import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {connect,initialise,fixture,asActor,rpc,funded} from './fixture.mjs';
import {latencySummary,summariseExplain} from '../../scripts/performance-evidence.mjs';

// This file can only connect through the fixed disposable runner configuration.
// Larger row fixtures use owner inserts with all constraints/triggers enabled.
// They do not represent real programme rules, GAAP records or provider receipts.
const metrics={synthetic:true,resources:{cpus:1,memory_mib:384,database_tmpfs_mib:256},tiers:[],burst:{},sustained:{},productionAccepted:false};
let db,project,rule;const branches=[];
before(async()=>{
  db=await connect();await initialise(db);
  for(let i=0;i<3;i++)branches.push(await fixture(db));
  project=randomUUID();rule=(await db.query('SELECT id FROM public.cash_loyalty_rules WHERE store_id=$1',[branches[0].branch])).rows[0].id;
  await db.query(`UPDATE public.push_settings SET enabled=true,expo_project_id=$1,enabled_since=now()-interval '2 hours'`,[project]);
  await db.query('CREATE TEMP TABLE performance_subjects(id uuid PRIMARY KEY,order_id uuid NOT NULL)');
});
after(async()=>{console.log(`PERFORMANCE_METRICS ${JSON.stringify(metrics)}`);await db?.end();});
async function observe(client){
  await asActor(client,null,'service_role');
  try{const start=performance.now(),value=await rpc(client,'operational_integrity_snapshot');await client.query('COMMIT');return {value,ms:performance.now()-start};}
  catch(error){await client.query('ROLLBACK');throw error;}
}
async function seedSubjects(count){
  await db.query('BEGIN');
  try{
    await db.query('CREATE TEMP TABLE performance_new_subjects ON COMMIT DROP AS SELECT gen_random_uuid() AS id,gen_random_uuid() AS order_id FROM generate_series(1,$1)',[count]);
    await db.query(`INSERT INTO auth.users(id,email) SELECT id,id||'@performance.invalid' FROM performance_new_subjects`);
    await db.query(`INSERT INTO public.orders(id,user_id,store_id,total_amount,status,payment_method,payment_status)
      SELECT order_id,id,$1,10,'completed','cash','paid' FROM performance_new_subjects`,[branches[0].branch]);
    await db.query(`INSERT INTO public.loyalty_ledger(user_id,order_id,event_key,kind,points_delta,rule_id)
      SELECT id,order_id,'synthetic-performance:'||id||':'||n,'earn',10,$1 FROM performance_new_subjects CROSS JOIN generate_series(1,9) n`,[rule]);
    await db.query(`INSERT INTO public.push_devices(id,secret_hash,user_id,expo_token,project_id,platform,aal2,bound_at,expires_at)
      SELECT gen_random_uuid(),repeat('a',64),id,'ExpoPushToken[synthetic_'||replace(id::text,'-','')||'_'||n||']',$1,'android',false,now()-interval '1 hour',now()+interval '1 day'
      FROM performance_new_subjects CROSS JOIN generate_series(1,2) n`,[project]);
    await db.query(`INSERT INTO public.notification_events(source_id,kind,recipient_id,store_id,order_id,created_at,expires_at)
      SELECT gen_random_uuid(),'order',id,$1,order_id,now()-interval '10 minutes',now()+interval '1 hour'
      FROM performance_new_subjects CROSS JOIN generate_series(1,2) n`,[branches[0].branch]);
    // Expired history should affect plans without counting as eligible backlog.
    await db.query(`INSERT INTO public.notification_events(source_id,kind,recipient_id,store_id,order_id,created_at,expires_at)
      SELECT gen_random_uuid(),'order',id,$1,order_id,now()-interval '1 day',now()-interval '23 hours'
      FROM performance_new_subjects CROSS JOIN generate_series(1,2) n`,[branches[0].branch]);
    await db.query('INSERT INTO performance_subjects SELECT * FROM performance_new_subjects');await db.query('COMMIT');
  }catch(error){await db.query('ROLLBACK');throw error;}
}
test('scaled ledger and notification populations retain integrity, clipped pair counts and measured query plans',async()=>{
  let previous=0;
  for(const population of [100,500,2000]){
    const seededAt=performance.now();await seedSubjects(population-previous);previous=population;
    // The owner may analyse only this disposable database; production maintenance
    // cadence and data distributions are separate acceptance requirements.
    await db.query('ANALYZE');const latencies=[];
    for(let i=0;i<7;i++){
      const sample=await observe(db);latencies.push(sample.ms);
      assert.equal(sample.value.metrics.loyalty_mismatches.count,0);
      assert.equal(sample.value.metrics.push_materialisation_due.count,Math.min(population*4,1000));
      assert.equal(sample.value.metrics.push_materialisation_due.clipped,population*4>1000);
    }
    const body=(await db.query(`SELECT prosrc FROM pg_proc WHERE oid='public.operational_integrity_snapshot()'::regprocedure`)).rows[0].prosrc;
    await db.query('BEGIN READ ONLY');let plan;
    try{plan=summariseExplain((await db.query(`EXPLAIN (ANALYZE, BUFFERS, TIMING OFF, FORMAT JSON) ${body}`)).rows[0]['QUERY PLAN']);}
    finally{await db.query('ROLLBACK');}
    const totals=(await db.query(`SELECT (SELECT count(*)::int FROM public.loyalty_accounts) AS accounts,
      (SELECT count(*)::int FROM public.loyalty_ledger) AS ledger_rows,(SELECT count(*)::int FROM public.notification_events) AS event_rows,
      (SELECT count(*)::int FROM public.push_devices) AS devices`)).rows[0];
    const tier={synthetic_customers:population,expected_eligible_pairs:population*4,...totals,seed_and_samples_ms:Math.round(performance.now()-seededAt),rpc_latency:latencySummary(latencies),plan_context:'owner-explain-of-current-function-body',plan};
    metrics.tiers.push(tier);console.log(`PERFORMANCE_STAGE ${JSON.stringify(tier)}`);
  }
});
test('a server-side statement deadline cancels a scaled observation and the session recovers',async()=>{
  await asActor(db,null,'service_role');await db.query("SET LOCAL statement_timeout='1ms'");
  await assert.rejects(rpc(db,'operational_integrity_snapshot'),{code:'57014'});await db.query('ROLLBACK');
  assert.equal((await observe(db)).value.metrics.loyalty_mismatches.count,0);metrics.statement_timeout_verified=true;
});
async function verifyCash(){
  for(const f of branches){
    const receipts=(await db.query('SELECT count(*)::int AS n FROM public.cash_receipts WHERE store_id=$1',[f.branch])).rows[0].n;
    const received=(await db.query("SELECT coalesce(sum(amount_minor),0)::text AS n FROM public.cash_movements WHERE store_id=$1 AND event_type='received'",[f.branch])).rows[0].n;
    assert.equal(BigInt(received),BigInt(receipts)*10000n);
    const balance=(await db.query('SELECT balance FROM public.loyalty_accounts WHERE user_id=$1',[f.customer])).rows[0].balance;
    assert.equal(BigInt(balance),BigInt(receipts)*100n);
  }
  assert.equal((await observe(db)).value.metrics.loyalty_mismatches.count,0);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM public.push_deliveries')).rows[0].n,0);
}
test('an eight-client cash burst runs against the larger observation dataset with exact final cash and points',async()=>{
  const samples=[],started=performance.now();let cursor=0;
  await Promise.all(Array.from({length:8},async()=>{
    const client=await connect();try{while(cursor<96){const index=cursor++,start=performance.now();await funded(client,branches[index%3]);samples.push(performance.now()-start);}}
    finally{await client.end();}
  }));
  const elapsed=performance.now()-started;assert.equal(samples.length,96);await verifyCash();
  metrics.burst={clients:8,orders:samples.length,elapsed_ms:Math.round(elapsed),orders_per_second:Math.round(samples.length*100000/elapsed)/100,workflow_latency:latencySummary(samples)};
});
test('a bounded thirty-second read/write workload measures collector contention and preserves financial invariants',async()=>{
  const clients=[],workflow=[],snapshots=[],duration=30000;let completed=0,started,stop=false;
  try{
    for(let i=0;i<8;i++)clients.push(await connect());
    started=performance.now();const deadline=started+duration;
    const results=await Promise.allSettled(clients.map(async(client,index)=>{try{
      // Six paced cash writers, two paced full-integrity observers. Absolute
      // cadence skips missed slots; no unbounded catch-up burst or open loop.
      const period=index<6?1000:500;let slot=0;
      while(!stop&&performance.now()<deadline){
        const due=started+slot*period;if(due>=deadline)break;
        if(due>performance.now())await delay(due-performance.now());if(stop||performance.now()>=deadline)break;
        const start=performance.now();
        if(index<6){await funded(client,branches[index%3]);completed++;workflow.push(performance.now()-start);}
        else{const sample=await observe(client);assert.equal(sample.value.metrics.loyalty_mismatches.count,0);snapshots.push(sample.ms);}
        slot=Math.max(slot+1,Math.ceil((performance.now()-started)/period));
      }
    }catch(error){stop=true;throw error;}}));
    const failed=results.find(result=>result.status==='rejected');if(failed)throw failed.reason;
  }finally{await Promise.allSettled(clients.map(client=>client.end()));}
  assert.ok(completed>0);assert.ok(snapshots.length>0);await verifyCash();
  metrics.sustained={window_ms:duration,elapsed_ms:Math.round(performance.now()-started),cash_clients:6,observer_clients:2,cash_period_ms:1000,observer_period_ms:500,orders:completed,
    workflow_latency:latencySummary(workflow),observer_latency:latencySummary(snapshots),not_a_production_soak:true};
  metrics.database_size_bytes=Number((await db.query('SELECT pg_database_size(current_database()) AS n')).rows[0].n);
  metrics.financial_invariants_verified=true;metrics.provider_dispatches=0;
  metrics.profile_complete=true;
});
