import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {execFile} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {connect,initialise,fixture,committed,quote,ready,cashDetails,funded,rpc,asActor,sessions} from './fixture.mjs';
import {validateAcceptanceConfig,assertOwnedContainer,acceptanceLabel} from '../../scripts/postgres-acceptance-safety.mjs';
const config=validateAcceptanceConfig(JSON.parse(process.env.POGOS_ACCEPTANCE_CONFIG??'null'));
const container=process.env.POGOS_ACCEPTANCE_CONTAINER;
let db,restored;const branches=[],metrics={synthetic:true,concurrency:4,orders:24,branches:3};
const command=(args)=>new Promise((resolve,reject)=>execFile('docker',args,{env:{...process.env,PGPASSWORD:config.password},timeout:60000,maxBuffer:1024*1024},(error,stdout)=>error?reject(Error('Owned recovery command failed')):resolve(stdout)));
async function owned(args){
  const identity=(await command(['inspect','--format',`{{.Id}} {{index .Config.Labels "${acceptanceLabel}"}}`,container])).trim().split(' ');
  assertOwnedContainer(identity[0],identity[1],config.runId);assert.equal(identity[0],container);
  return command(['exec','--env','PGPASSWORD',container,...args]);
}
before(async()=>{assert.match(container??'',/^[a-f0-9]{64}$/);db=await connect();await initialise(db);});
after(async()=>{await restored?.end();await db?.end();});
test('three-branch synthetic cash workload preserves exact financial and loyalty totals under bounded concurrency',async()=>{
  for(let i=0;i<3;i++)branches.push(await fixture(db));
  const latencies=[];let cursor=0;
  await Promise.all(Array.from({length:4},async()=>{
    const client=await connect();try{
      while(cursor<24){const index=cursor++,f=branches[index%3],start=performance.now();await funded(client,f);latencies.push(performance.now()-start);}
    }finally{await client.end();}
  }));
  for(const f of branches){
    assert.equal((await db.query('SELECT count(*)::int AS n FROM public.cash_receipts WHERE store_id=$1',[f.branch])).rows[0].n,8);
    assert.equal((await db.query('SELECT sum(amount_minor)::text AS n FROM public.cash_movements WHERE store_id=$1 AND event_type=\'received\'',[f.branch])).rows[0].n,'80000');
    assert.equal((await db.query('SELECT balance::text FROM public.loyalty_accounts WHERE user_id=$1',[f.customer])).rows[0].balance,'800');
  }
  latencies.sort((a,b)=>a-b);metrics.workflow_latency_ms={p50:Math.round(latencies[11]),p95:Math.round(latencies[22]),max:Math.round(latencies[23])};
});
test('health snapshots and fenced worker observations execute on real PostgreSQL with grants intact',async()=>{
  await asActor(db,null,'service_role');const snapshot=await rpc(db,'operational_health_snapshot');assert.equal(snapshot.metrics.cash_custody_open.count,24);
  const old=randomUUID(),current=randomUUID();await rpc(db,'record_worker_observation',['push',old,'running']);await rpc(db,'record_worker_observation',['push',current,'running']);
  assert.equal(await rpc(db,'record_worker_observation',['push',old,'success']),false);assert.equal(await rpc(db,'record_worker_observation',['push',current,'success']),true);await db.query('COMMIT');
  await asActor(db,branches[0].admin);await assert.rejects(rpc(db,'worker_health_snapshot'),{code:'42501'});await db.query('ROLLBACK');
});
test('integrity observation counts a corrupted ledger projection without exposing or repairing it',async()=>{
  await asActor(db,null,'service_role');assert.equal((await rpc(db,'operational_integrity_snapshot')).metrics.loyalty_mismatches.count,0);await db.query('COMMIT');
  await db.query('BEGIN');try{
    await db.query('UPDATE public.loyalty_accounts SET balance=balance+1 WHERE user_id=$1',[branches[0].customer]);await db.query('SET LOCAL ROLE service_role');
    const snapshot=await rpc(db,'operational_integrity_snapshot');assert.equal(snapshot.metrics.loyalty_mismatches.count,1);assert.ok(!JSON.stringify(snapshot).includes(branches[0].customer));
  }finally{await db.query('ROLLBACK');}
  await asActor(db,branches[0].admin);await assert.rejects(rpc(db,'operational_integrity_snapshot'),{code:'42501'});await db.query('ROLLBACK');
});
test('integrity snapshots remain consistent across an uncommitted cash earning and its commit',async()=>{
  const order=await ready(db,branches[0]);
  await sessions(async(writer,observer)=>{
    await asActor(writer,branches[0].staff);await rpc(writer,'operate_cash_order',[order,randomUUID(),3,'complete',cashDetails()]);
    await asActor(observer,null,'service_role');assert.equal((await rpc(observer,'operational_integrity_snapshot')).metrics.loyalty_mismatches.count,0);
    await writer.query('COMMIT');assert.equal((await rpc(observer,'operational_integrity_snapshot')).metrics.loyalty_mismatches.count,0);await observer.query('COMMIT');
  });
});
test('eligible missing delivery pairs are observed and real SQL materialisation clears only that backlog',async()=>{
  const f=branches[0],project=randomUUID(),device=randomUUID();await db.query('UPDATE public.push_settings SET enabled=true,expo_project_id=$1,enabled_since=now()',[project]);
  await committed(db,f.customer,'register_push_device',[device,'a'.repeat(64),'ExpoPushToken[synthetic_integrity_device]',project,'android']);await funded(db,f);
  await asActor(db,null,'service_role');const before=await rpc(db,'operational_integrity_snapshot');assert.ok(before.metrics.push_materialisation_due.count>0);
  await rpc(db,'claim_push_deliveries',[10]);assert.equal((await rpc(db,'operational_integrity_snapshot')).metrics.push_materialisation_due.count,0);await db.query('COMMIT');
  assert.equal((await db.query('SELECT count(*)::int AS n FROM public.push_deliveries WHERE dispatch_started_at IS NOT NULL')).rows[0].n,0);
});
let hashes,backupAt,suppressedUser;
async function fingerprint(client){
  const tables=(await client.query(`SELECT table_schema,table_name FROM information_schema.tables WHERE table_type='BASE TABLE' AND table_schema IN ('public','auth') ORDER BY table_schema,table_name`)).rows;
  const result={};for(const {table_schema:s,table_name:t}of tables){assert.match(t,/^[a-z_]+$/);result[`${s}.${t}`]=(await client.query(`SELECT md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]')::text) AS value FROM ${s}.${t} t`)).rows[0].value;}return result;
}
test('consistent custom backup restores all synthetic tables and constraints into a new isolated database',async()=>{
  hashes=await fingerprint(db);backupAt=Date.now();
  await owned(['pg_dump','--username',config.user,'--dbname',config.database,'--format=custom','--file=/tmp/pogos-recovery.dump']);
  const name=`${config.database}_restored`,started=performance.now();
  await owned(['createdb','--username',config.user,'--maintenance-db',config.database,name]);
  await owned(['pg_restore','--username',config.user,'--dbname',name,'--exit-on-error','/tmp/pogos-recovery.dump']);
  metrics.restore_ms=Math.round(performance.now()-started);
  restored=new pg.Client({...config,database:name,ssl:false,connectionTimeoutMillis:2000,options:'-c statement_timeout=10000 -c timezone=UTC'});await restored.connect();
  assert.deepEqual(await fingerprint(restored),hashes);metrics.restored_tables=Object.keys(hashes).length;
  assert.equal((await restored.query("SELECT has_function_privilege('authenticated','public.worker_health_snapshot()','EXECUTE') AS allowed")).rows[0].allowed,false);
});
test('post-backup cash and privacy changes are detected as unresolved recovery obligations',async()=>{
  await funded(db,branches[0]);
  suppressedUser=branches[2].customer;
  // Synthetic tombstone fixture, not a deletion workflow or permission to
  // mark real deletion complete. Real external receipts need owned review.
  await db.query(`INSERT INTO public.privacy_requests(id,user_id,kind,status,completed_at) VALUES($1,$2,'deletion','completed',now())`,[randomUUID(),suppressedUser]);
  const sum=async client=>(await client.query("SELECT sum(amount_minor)::text AS n FROM public.cash_movements WHERE event_type='received'")).rows[0].n;
  assert.equal(BigInt(await sum(db))-BigInt(await sum(restored)),10000n);
  const balance=async client=>(await client.query('SELECT balance FROM public.loyalty_accounts WHERE user_id=$1',[branches[0].customer])).rows[0].balance;
  assert.equal(BigInt(await balance(db))-BigInt(await balance(restored)),100n);metrics.post_backup_points_gap='100';
  await asActor(restored,suppressedUser);assert.equal(await rpc(restored,'privacy_account_live'),true);await restored.query('COMMIT');
  await asActor(db,suppressedUser);assert.equal(await rpc(db,'privacy_account_live'),false);await db.query('COMMIT');
  metrics.post_backup_cash_gap_minor='10000';metrics.post_backup_privacy_suppression_required=1;metrics.backup_window_observed_ms=Date.now()-backupAt;metrics.safe_to_resume=false;
});
test('controlled suppression replay fences restored access while financial replay remains explicitly unresolved',async()=>{
  const tombstone=(await db.query('SELECT id,user_id,kind,status,completed_at FROM public.privacy_requests WHERE user_id=$1',[suppressedUser])).rows[0];
  await restored.query('BEGIN');
  try{
    await restored.query(`INSERT INTO public.privacy_requests(id,user_id,kind,status,completed_at) VALUES($1,$2,$3,$4,$5)`,[tombstone.id,tombstone.user_id,tombstone.kind,tombstone.status,tombstone.completed_at]);
    await restored.query('COMMIT');
  }catch(error){await restored.query('ROLLBACK');throw error;}
  await asActor(restored,suppressedUser);assert.equal(await rpc(restored,'privacy_account_live'),false);await restored.query('COMMIT');
  metrics.synthetic_privacy_suppression_replayed=true;metrics.external_gaap_evidence='simulated; real finance review required';
  console.log(`RESILIENCE_METRICS ${JSON.stringify(metrics)}`);
});
