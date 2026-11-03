import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {healthSignals} from '../scripts/operational-health.mjs';
import {workerNames} from '../scripts/worker-health.mjs';
import {runMonitoringCycle,collectWorkerHealth} from '../scripts/monitoring-cycle.mjs';
import {localAlertStore} from '../scripts/local-alert-store.mjs';
import {syntheticHealthPolicy} from './helpers/health-fixture.mjs';
import {syntheticIntegrityPolicy,emptyIntegritySnapshot} from './helpers/integrity-fixture.mjs';
const now=Date.parse('2026-11-03T12:00:00.000Z');
const workerPolicy={max_snapshot_age_seconds:60,workers:Object.fromEntries(workerNames.map(name=>[name,{expected_interval_seconds:60,max_run_seconds:30,max_success_age_seconds:120}]))};
const samples=()=>({integrity:emptyIntegritySnapshot(now),queue:{schema_version:1,observed_at:new Date(now).toISOString(),scope:'all-branches',coverage:'queue-state-only',metrics:Object.fromEntries(healthSignals.map(name=>[name,{count:0,clipped:false,oldest_age_seconds:null}]))},worker:{schema_version:1,observed_at:new Date(now).toISOString(),workers:Object.fromEntries(workerNames.map(name=>[name,{outcome:'success',started_age_seconds:10,completed_age_seconds:5,last_success_age_seconds:5}]))}});
const client=data=>({rpc(name){assert.ok(['operational_health_snapshot','worker_health_snapshot','operational_integrity_snapshot'].includes(name));return {abortSignal(){return {retry:async()=>({data:name==='worker_health_snapshot'?data.worker:name==='operational_integrity_snapshot'?data.integrity:data.queue,error:null})};}};}});
test('combined collector deduplicates incidents and sends explicit recovery through a simulated provider',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'pogos-cycle-'));try{
    const data=samples();data.queue.metrics.cash_expiry_due={count:2,clipped:false,oldest_age_seconds:60};const store=localAlertStore(directory);let sends=0;
    const options={client:client(data),queuePolicy:syntheticHealthPolicy(healthSignals),workerPolicy,integrityPolicy:syntheticIntegrityPolicy(),store,deliver:async()=>{sends++;return 'accepted';},now:()=>now};
    assert.equal((await runMonitoringCycle(options)).alerts.active,1);await runMonitoringCycle(options);assert.equal(sends,1);
    options.client=client(samples());assert.equal((await runMonitoringCycle(options)).alerts.active,0);assert.equal(sends,2);
  }finally{await rm(directory,{recursive:true,force:true});}
});
test('a slower older collector cannot overwrite or alert from observations after a newer cycle',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'pogos-cycle-'));try{
    const store=localAlertStore(directory),data=samples();let release,started;
    const gate=new Promise(resolve=>{release=resolve;}),begun=new Promise(resolve=>{started=resolve;});
    const slow={rpc(name){return {abortSignal(){return {retry:async()=>{started();await gate;return {data:name==='worker_health_snapshot'?data.worker:name==='operational_integrity_snapshot'?data.integrity:data.queue,error:null};}};}};}};
    data.queue.metrics.cash_expiry_due={count:2,clipped:false,oldest_age_seconds:60};
    const options={client:slow,queuePolicy:syntheticHealthPolicy(healthSignals),workerPolicy,integrityPolicy:syntheticIntegrityPolicy(),store,deliver:async()=>{throw Error('Superseded collector must not notify');},now:()=>now};
    const old=runMonitoringCycle(options).then(value=>({value}),error=>({error}));await begun;
    await runMonitoringCycle({...options,client:client(samples())});release();assert.match((await old).error.message,/superseded/);
    const state=await store.withLock(tx=>tx.read());assert.equal(state.incidents['queue.cash_expiry_due'].severity,'clear');assert.equal(state.outbox.length,0);
  }finally{await rm(directory,{recursive:true,force:true});}
});
test('worker collector cancels hung queries and never returns an empty healthy observation on errors',async()=>{
  let aborted=false;const hung={rpc(){return {abortSignal(signal){signal.addEventListener('abort',()=>{aborted=true;});return {retry:()=>new Promise(()=>{})};}};}};
  const result=await collectWorkerHealth(hung,workerPolicy,{timeoutMs:5});assert.equal(aborted,true);assert.equal(result.status,'unknown');assert.equal(result.reason,'collection_timeout');
  assert.equal((await collectWorkerHealth({rpc(){throw Error('private');}},workerPolicy)).status,'unknown');
});
test('integrity incidents deduplicate and disabled push remains active until a valid clear observation',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'pogos-cycle-'));try{
    const data=samples();data.integrity.metrics.loyalty_mismatches.count=1;data.integrity.metrics.push_materialisation_due={count:1,clipped:false,oldest_age_seconds:600};
    let sends=0;const options={client:client(data),queuePolicy:syntheticHealthPolicy(healthSignals),workerPolicy,integrityPolicy:syntheticIntegrityPolicy(),store:localAlertStore(directory),deliver:async()=>{sends++;return 'accepted';},now:()=>now};
    assert.equal((await runMonitoringCycle(options)).alerts.active,2);await runMonitoringCycle(options);assert.equal(sends,2);
    data.integrity=emptyIntegritySnapshot(now);data.integrity.push_enabled=false;assert.equal((await runMonitoringCycle(options)).alerts.active,1);
    data.integrity.push_enabled=true;assert.equal((await runMonitoringCycle(options)).alerts.active,0);assert.equal(sends,5);
  }finally{await rm(directory,{recursive:true,force:true});}
});
test('slow integrity collection cannot clear incidents using fast samples that expired before state commit',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'pogos-cycle-'));try{
    let clock=now,release,started;const begun=new Promise(resolve=>{started=resolve;}),gate=new Promise(resolve=>{release=resolve;});const data=samples();
    const slow={rpc(name){return {abortSignal(){return {retry:async()=>{
      if(name==='operational_integrity_snapshot'){started();await gate;return {data:data.integrity,error:null};}
      return {data:name==='worker_health_snapshot'?data.worker:data.queue,error:null};
    }};}};}};
    const pending=runMonitoringCycle({client:slow,queuePolicy:syntheticHealthPolicy(healthSignals),workerPolicy,integrityPolicy:syntheticIntegrityPolicy(),store:localAlertStore(directory),deliver:async()=> 'accepted',now:()=>clock});
    await begun;await new Promise(resolve=>setImmediate(resolve));clock=now+61000;release();const result=await pending;
    assert.equal(result.queue.reason,'snapshot_stale_at_commit');assert.equal(result.workers.reason,'snapshot_stale_at_commit');assert.equal(result.alerts.active,16);
  }finally{await rm(directory,{recursive:true,force:true});}
});
