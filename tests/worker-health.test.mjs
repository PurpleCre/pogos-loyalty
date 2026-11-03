import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {randomUUID} from 'node:crypto';
import {createTestDatabase,asRole} from '../scripts/test-database.mjs';
import {evaluateWorkerHealth,validateWorkerPolicy,workerNames} from '../scripts/worker-health.mjs';
let db;before(async()=>{db=await createTestDatabase();});after(async()=>{await db?.close();});
const rpc=(name,args=[])=>asRole(db,'service_role',null,async()=>(await db.query(`SELECT public.${name}(${args.map((_,i)=>`$${i+1}`).join(',')}) AS value`,args)).rows[0].value);
test('worker records and functions cannot be read, written or forged by customers or administrators',async()=>{
  for(const role of ['anon','authenticated'])for(const sql of ['SELECT * FROM public.worker_observations',"UPDATE public.worker_observations SET outcome='never'",'SELECT public.worker_health_snapshot()',`SELECT public.record_worker_observation('push','${randomUUID()}','success')`])await assert.rejects(asRole(db,role,null,()=>db.query(sql)),{code:'42501'});
  await assert.rejects(asRole(db,'service_role',null,()=>db.query('SELECT * FROM public.worker_observations')),{code:'42501'});
});
test('new observations are never-run, bounded to three workers and expose no run identifier',async()=>{
  const value=await rpc('worker_health_snapshot');assert.equal(Object.keys(value.workers).length,3);assert.ok(Object.values(value.workers).every(x=>x.outcome==='never'));
  assert.ok(!JSON.stringify(value).includes('run_id'));
});
test('starts and terminal retries are idempotent and cannot rewrite a terminal result',async()=>{
  const run=randomUUID();assert.equal(await rpc('record_worker_observation',['cash-expiry',run,'running']),true);
  assert.equal(await rpc('record_worker_observation',['cash-expiry',run,'running']),true);
  assert.equal(await rpc('record_worker_observation',['cash-expiry',run,'success']),true);
  const before=(await db.query("SELECT * FROM public.worker_observations WHERE worker='cash-expiry'")).rows[0];
  assert.equal(await rpc('record_worker_observation',['cash-expiry',run,'success']),true);assert.equal(await rpc('record_worker_observation',['cash-expiry',run,'failed']),false);
  assert.equal(await rpc('record_worker_observation',['cash-expiry',run,'running']),false);
  assert.deepEqual((await db.query("SELECT * FROM public.worker_observations WHERE worker='cash-expiry'")).rows[0],before);
});
test('older runs cannot overwrite the latest run or manufacture successful evidence',async()=>{
  const old=randomUUID(),current=randomUUID();await rpc('record_worker_observation',['push',old,'running']);await rpc('record_worker_observation',['push',current,'running']);
  assert.equal(await rpc('record_worker_observation',['push',old,'success']),false);assert.equal((await rpc('worker_health_snapshot')).workers.push.outcome,'running');
  await rpc('record_worker_observation',['push',current,'unresolved']);assert.equal((await rpc('worker_health_snapshot')).workers.push.outcome,'unresolved');
});
test('invalid names, missing runs and invalid outcomes do not change observations',async()=>{
  for(const args of [['other',randomUUID(),'running'],['push',null,'running'],['push',randomUUID(),'delivered'],[null,randomUUID(),'running']])await assert.rejects(rpc('record_worker_observation',args),{code:'22023'});
  assert.equal((await db.query('SELECT count(*)::int AS n FROM public.worker_observations')).rows[0].n,3);
});
const now=Date.parse('2026-11-03T12:00:00.000Z');
const policy=()=>({max_snapshot_age_seconds:60,workers:Object.fromEntries(workerNames.map(name=>[name,{expected_interval_seconds:60,max_run_seconds:30,max_success_age_seconds:120}]))});
const sample=()=>({schema_version:1,observed_at:new Date(now).toISOString(),workers:Object.fromEntries(workerNames.map(name=>[name,{outcome:'success',started_age_seconds:10,completed_age_seconds:5,last_success_age_seconds:5}]))});
test('worker policy remains unconfigured until explicitly supplied and never treats missing data as healthy',()=>{
  const draft={max_snapshot_age_seconds:null,workers:Object.fromEntries(workerNames.map(x=>[x,null]))};assert.doesNotThrow(()=>validateWorkerPolicy(draft));assert.equal(evaluateWorkerHealth(sample(),draft,now).status,'unknown');
  assert.equal(evaluateWorkerHealth(null,policy(),now).status,'unknown');assert.equal(evaluateWorkerHealth(sample(),policy(),now+61000).reason,'snapshot_stale');assert.equal(evaluateWorkerHealth(sample(),policy(),now-1).reason,'snapshot_in_future');
});
test('missed, hung, failed and unresolved runs alert even when all business queues might be empty',()=>{
  for(const [outcome,started,completed,last,reason] of [['never',null,null,null,'never_observed'],['running',31,null,10,'run_overdue'],['success',61,55,55,'missed_run'],['failed',1,0,10,'unsuccessful_run'],['unresolved',1,0,10,'unsuccessful_run'],['running',1,null,121,'success_overdue']]){
    const value=sample();value.workers.push={outcome,started_age_seconds:started,completed_age_seconds:completed,last_success_age_seconds:last};const result=evaluateWorkerHealth(value,policy(),now);assert.equal(result.status,'critical');assert.equal(result.workers[0].reason,reason);
  }
  assert.equal(evaluateWorkerHealth(sample(),policy(),now).status,'clear');
});
test('unknown workers, bad clocks/ages and contradictory records are rejected without echoing payloads',()=>{
  for(const mutate of [x=>{x.private='contact';},x=>{x.workers.push.started_age_seconds=-1;},x=>{x.workers.push.outcome='delivered';},x=>{x.workers.push.completed_age_seconds=null;},x=>{x.workers.push.completed_age_seconds=20;},x=>{x.observed_at='private';}]){const x=sample();mutate(x);const result=evaluateWorkerHealth(x,policy(),now);assert.equal(result.status,'unknown');assert.ok(!JSON.stringify(result).includes('private'));}
});
