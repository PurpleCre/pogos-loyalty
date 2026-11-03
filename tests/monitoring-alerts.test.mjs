import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtemp,rm,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {alertSignals,emptyAlertState,advanceAlerts,acknowledgeAlert,dispatchLocalAlerts} from '../scripts/monitoring-alerts.mjs';
import {localAlertStore} from '../scripts/local-alert-store.mjs';
const observations=()=>Object.fromEntries(alertSignals.map(x=>[x,'clear']));
test('incidents deduplicate until status changes; unknown does not silently recover a critical incident',()=>{
  const values=observations();values['worker.push']='critical';let state=advanceAlerts(emptyAlertState(),values);assert.equal(state.outbox.length,1);
  state=advanceAlerts(state,values);assert.equal(state.outbox.length,1);state=acknowledgeAlert(state,'worker.push',state.outbox[0].key);assert.equal(state.incidents['worker.push'].acknowledged,true);
  values['worker.push']='unknown';state=advanceAlerts(state,values);assert.equal(state.incidents['worker.push'].active,true);assert.equal(state.outbox.length,2);
  values['worker.push']='clear';state=advanceAlerts(state,values);assert.equal(state.outbox.length,3);assert.equal(state.outbox[2].active,false);
  assert.throws(()=>acknowledgeAlert(state,'worker.push',state.outbox[0].key));
});
test('invalid observations, corrupt state and capacity cannot discard historical uncertain outcomes',()=>{
  assert.throws(()=>advanceAlerts(emptyAlertState(),{'private@example.test':'critical'}));assert.throws(()=>advanceAlerts({},{ }));
  const values=observations();let state=emptyAlertState();for(let i=0;i<64;i++){values['worker.push']=i%2?'critical':'warning';state=advanceAlerts(state,values);}
  values['worker.push']='unknown';assert.throws(()=>advanceAlerts(state,values),/full/);assert.equal(state.outbox.length,64);
});
test('durable local outbox persists before sending, deduplicates after restart and separates delivery from human acknowledgement',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'pogos-alerts-')),store=localAlertStore(directory);let sends=0;
  try{
    const values=observations();values['worker.push']='critical';await store.withLock(async tx=>tx.write(advanceAlerts(await tx.read(),values)));
    const first=await dispatchLocalAlerts(store,async message=>{sends++;const disk=JSON.parse(await readFile(join(directory,'state.json'),'utf8'));assert.equal(disk.outbox[0].state,'sending');assert.deepEqual(Object.keys(message).sort(),['active','key','severity','signal']);return 'accepted';});
    assert.equal(first.outbox[0].state,'accepted');assert.equal(first.incidents['worker.push'].acknowledged,false);
    await dispatchLocalAlerts(localAlertStore(directory),async()=>{sends++;return 'accepted';});assert.equal(sends,1);
  }finally{await rm(directory,{recursive:true,force:true});}
});
test('abandoned sends, ambiguous transport and damaged files require review rather than blind replay/reset',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'pogos-alerts-')),store=localAlertStore(directory);
  try{
    const values=observations();values['worker.push']='critical';const initial=advanceAlerts(emptyAlertState(),values);initial.outbox[0].state='sending';
    await store.withLock(tx=>tx.write(initial));let sends=0;const state=await dispatchLocalAlerts(store,async()=>{sends++;return 'accepted';});assert.equal(sends,0);assert.equal(state.outbox[0].state,'unknown');
    await writeFile(join(directory,'state.json'),'{broken');await assert.rejects(store.withLock(tx=>tx.read()),/unreadable/);assert.equal(await readFile(join(directory,'state.json'),'utf8'),'{broken');
  }finally{await rm(directory,{recursive:true,force:true});}
});
test('concurrent dispatchers cannot both claim the same local outbox',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'pogos-alerts-')),store=localAlertStore(directory);try{
    await store.withLock(async()=>{await assert.rejects(store.withLock(()=>{}),{code:'EEXIST'});});
  }finally{await rm(directory,{recursive:true,force:true});}
});
test('hung delivery times out as unknown and each dispatch has a bounded four-event batch',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'pogos-alerts-')),store=localAlertStore(directory);try{
    await store.withLock(async tx=>tx.write(advanceAlerts(await tx.read(),{})));let calls=0,aborted=0;
    const result=await dispatchLocalAlerts(store,(_message,{signal})=>{calls++;signal.addEventListener('abort',()=>{aborted++;});return new Promise(()=>{});},{timeoutMs:5});
    assert.equal(calls,4);assert.equal(aborted,4);assert.equal(result.outbox.filter(x=>x.state==='unknown').length,4);assert.equal(result.outbox.filter(x=>x.state==='ready').length,12);
  }finally{await rm(directory,{recursive:true,force:true});}
});
