import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createBranchRecovery, createQueueAttention, queueIsFresh } from '../lib/branch-operations.ts';
const owner='a8220000-0000-4000-8000-000000000001';
const command={storeId:'b8220000-0000-4000-8000-000000000001',expectedVersion:0,action:'intake',value:true,reason:'Busy shift',itemId:null};
const receipt=pending=>({command_id:pending.commandId,store_id:pending.command.storeId,action:pending.command.action,menu_item_id:pending.command.itemId,value:pending.command.value,version:pending.command.expectedVersion+1});
function fixture() {
  const data=new Map(); const storage={async getItem(key){return data.get(key)??null;},async setItem(key,value){data.set(key,value);},async removeItem(key){data.delete(key);}};
  return {data,storage,recovery:createBranchRecovery(storage)};
}
test('branch command survives response loss and restart with its original identity and account scope',async()=>{
  const {storage,recovery}=fixture(); let first;
  await assert.rejects(recovery.execute(owner,command,async pending=>{first=pending;throw Error('Lost response');}));
  const restart=createBranchRecovery(storage);
  assert.equal(await restart.load('another-account'),null);
  assert.deepEqual(await restart.load(owner),first);
  assert.deepEqual(await restart.recover(owner,async pending=>{assert.deepEqual(pending,first);return receipt(pending);}),receipt(first));
  assert.equal(await restart.load(owner),null);
});
test('another branch or changed action cannot replace an ambiguous command',async()=>{
  const {recovery}=fixture();
  await assert.rejects(recovery.execute(owner,command,async()=>{throw Error('Timeout');}));
  for(const change of [{value:false},{expectedVersion:1},{storeId:'c8220000-0000-4000-8000-000000000001'}]) {
    await assert.rejects(recovery.execute(owner,{...command,...change},async pending=>receipt(pending)),/previous branch action/);
  }
});
test('disk failure or corrupt pending state prevents sending a new branch action',async()=>{
  const {data,storage}=fixture(); let sent=0;
  storage.setItem=async()=>{throw Error('Disk full');};
  await assert.rejects(createBranchRecovery(storage).execute(owner,command,async p=>{sent++;return receipt(p);}));
  data.set(`@pogos_pending_branch_command:${owner}`,'{broken');
  await assert.rejects(createBranchRecovery(storage).execute(owner,command,async p=>{sent++;return receipt(p);}));
  assert.equal(sent,0);
});
test('mismatched success scope, command, action, version or value retains recovery rather than claiming completion',async()=>{
  for(const changes of [{store_id:'c8220000-0000-4000-8000-000000000001'},{command_id:'c8220000-0000-4000-8000-000000000001'},{action:'availability'},{version:9},{value:false},{menu_item_id:'c8220000-0000-4000-8000-000000000001'}]) {
    const {recovery}=fixture();
    await assert.rejects(recovery.execute(owner,command,async p=>({...receipt(p),...changes})),/could not be confirmed/);
    assert.ok(await recovery.load(owner));
  }
});
test('definitive rolled-back errors clear the checkpoint, while auth and network failures retain it',async()=>{
  for(const code of ['22023','23505','40001','42501','PGRST301','NETWORK']) {
    const {recovery}=fixture();
    await assert.rejects(recovery.execute(owner,command,async()=>{throw {code};}));
    assert.equal(!!await recovery.load(owner),['42501','PGRST301','NETWORK'].includes(code));
  }
});
test('confirmed response survives cleanup failure and can be checked again without a new command identity',async()=>{
  const {storage,recovery}=fixture(); storage.removeItem=async()=>{throw Error('Storage unavailable');}; let first;
  const result=await recovery.execute(owner,command,async p=>{first=p;return receipt(p);});
  assert.deepEqual(result,receipt(first)); assert.ok(await recovery.load(owner));
  assert.deepEqual(await recovery.recover(owner,async p=>{assert.deepEqual(p,first);return receipt(p);}),result);
});
test('concurrent attempts cannot overwrite a persisted branch command',async()=>{
  const {recovery}=fixture(); let release; let started;
  const ready=new Promise(resolve=>{started=resolve;});
  const first=recovery.execute(owner,command,async p=>{started();await new Promise(resolve=>{release=resolve;});return receipt(p);});
  await ready;
  await assert.rejects(recovery.execute(owner,{...command,value:false},async p=>receipt(p)),/already being checked/);
  release();await first;
});
test('malformed branch requests fail before persistence or network work',async()=>{
  for(const changes of [{reason:'x'},{action:'availability'},{action:'intake',itemId:'c8220000-0000-4000-8000-000000000001'},{expectedVersion:-1}]) {
    const {data,recovery}=fixture(); let sent=false;
    await assert.rejects(recovery.execute(owner,{...command,...changes},async p=>{sent=true;return receipt(p);}));
    assert.equal(data.size,0); assert.equal(sent,false);
  }
});
test('existing pending work alerts on first visit and repeats at most every 30 seconds',()=>{
  const alerts=createQueueAttention();
  assert.deepEqual(alerts.observe('batch1',4,1000),{needsAttention:true,alert:true});
  assert.equal(alerts.observe('batch1',4,2000).alert,false);
  assert.equal(alerts.observe('batch1',4,31000).alert,true);
});
test('local acknowledgement silences only that batch; changed work and a new shift require attention',()=>{
  const alerts=createQueueAttention(); alerts.observe('batch1',2,0); alerts.acknowledge();
  assert.deepEqual(alerts.observe('batch1',2,60000),{needsAttention:false,alert:false});
  assert.deepEqual(alerts.observe('batch2',2,61000),{needsAttention:true,alert:true});
  assert.deepEqual(alerts.observe('empty',0,62000),{needsAttention:false,alert:false});
  assert.equal(createQueueAttention().observe('batch2',2,62000).alert,true);
});
test('stale, background, failed or backward-clock snapshots cannot authorize new actions',()=>{
  assert.equal(queueIsFresh(1000,45999,true,''),true);
  for(const values of [[1000,46000,true,''],[1000,1100,false,''],[1000,1100,true,'Network error'],[null,1100,true,''],[1000,900,true,'']]) {
    assert.equal(queueIsFresh(...values),false);
  }
});
