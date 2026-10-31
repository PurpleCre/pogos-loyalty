import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSessionStorage } from '../lib/session-storage.ts';
import { normaliseEmail, validatePassword, safeAuthDestination, callbackInput, roleSnapshot } from '../lib/identity.ts';
function memory() {
  const data=new Map();return {data, async getItem(k){return data.get(k)??null;},async setItem(k,v){data.set(k,v);},async removeItem(k){data.delete(k);}};
}
test('native session adapter stores large Unicode sessions in bounded encrypted chunks and removes plaintext',async()=>{
  const secure=memory(),legacy=memory();legacy.data.set('session','old plaintext credential');
  const storage=createSessionStorage(secure,legacy);
  assert.equal(await storage.getItem('session'),null);assert.equal(legacy.data.size,0);
  const session=JSON.stringify({access_token:'x'.repeat(12000),user:{name:'😀漢'.repeat(2000)}});
  await storage.setItem('session',session);
  assert.equal(await storage.getItem('session'),session);
  assert.equal(legacy.data.size,0);
  for(const value of secure.data.values())assert.ok(Buffer.byteLength(value,'utf8')<2048);
});
test('a failed refresh write preserves the complete previous session rather than mixed tokens',async()=>{
  const secure=memory(),legacy=memory(),storage=createSessionStorage(secure,legacy);
  await storage.setItem('session','old-session');const set=secure.setItem;let calls=0;
  secure.setItem=async(k,v)=>{if(++calls===2)throw Error('Keychain full');return set(k,v);};
  await assert.rejects(storage.setItem('session','new'.repeat(1000)),/Keychain full/);
  assert.equal(await storage.getItem('session'),'old-session');assert.equal(secure.data.size,2);
});
test('a failed manifest commit cannot replace a valid session',async()=>{
  const secure=memory(),legacy=memory(),storage=createSessionStorage(secure,legacy);
  await storage.setItem('session','old-session');const set=secure.setItem;
  secure.setItem=async(k,v)=>{if(k==='pogos.secure.session')throw Error('Commit failed');return set(k,v);};
  await assert.rejects(storage.setItem('session','new-session'),/Commit failed/);
  assert.equal(await storage.getItem('session'),'old-session');
});
test('an interrupted uncommitted generation is ignored; missing committed chunks fail closed',async()=>{
  const secure=memory(),storage=createSessionStorage(secure,memory());await storage.setItem('session','valid');
  secure.data.set('pogos.secure.session.orphan.0','uncommitted');assert.equal(await storage.getItem('session'),'valid');
  const entry=JSON.parse(secure.data.get('pogos.secure.session'));secure.data.delete(`pogos.secure.session.${entry.generation}.0`);
  assert.equal(await storage.getItem('session'),null);assert.equal(secure.data.has('pogos.secure.session'),false);
});
test('logout removes the manifest and all committed credentials; concurrent operations retain call order',async()=>{
  const secure=memory(),legacy=memory(),storage=createSessionStorage(secure,legacy);
  await Promise.all([storage.setItem('session','one'),storage.setItem('session','two'),storage.removeItem('session')]);
  assert.equal(await storage.getItem('session'),null);assert.equal(secure.data.size,0);assert.equal(legacy.data.size,0);
});
test('secure storage failure cannot silently downgrade to plaintext or poison later requests',async()=>{
  const secure=memory(),legacy=memory(),storage=createSessionStorage(secure,legacy);const set=secure.setItem;
  secure.setItem=async()=>{throw Error('Device locked');};await assert.rejects(storage.setItem('session','credential'),/Device locked/);assert.equal(legacy.data.size,0);
  secure.setItem=set;await storage.setItem('session','credential');assert.equal(await storage.getItem('session'),'credential');
});
test('project storage keys stay isolated and oversized values are rejected before writing',async()=>{
  const secure=memory(),storage=createSessionStorage(secure,memory());await storage.setItem('project-a','a');await storage.setItem('project-b','b');
  await storage.removeItem('project-a');assert.equal(await storage.getItem('project-b'),'b');
  const before=secure.data.size;await assert.rejects(storage.setItem('huge','x'.repeat(100000)),/exceeds/);assert.equal(secure.data.size,before);
});
test('email and password validation reject invalid input without modifying passwords',()=>{
  assert.equal(normaliseEmail(' STAFF@EXAMPLE.TEST '),'staff@example.test');
  for(const value of ['','x','a@b','a b@example.test'])assert.throws(()=>normaliseEmail(value));
  assert.throws(()=>validatePassword('short'));assert.throws(()=>validatePassword('x'.repeat(129)));assert.doesNotThrow(()=>validatePassword('twelve good characters'));
});
test('untrusted post-login redirects cannot leave the approved customer routes',()=>{
  for(const value of ['https://evil.test','//evil.test','/(app)/admin','/auth/callback?code=x',['/'],'/\\evil.test'])assert.equal(safeAuthDestination(value),'/(app)/dashboard');
  assert.equal(safeAuthDestination('/(app)/cart'),'/(app)/cart');assert.equal(safeAuthDestination('/'),'/');
});
test('only bounded PKCE code callbacks are accepted; bearer-token injection and duplicate query parameters are rejected',()=>{
  assert.deepEqual(callbackInput({code:'fixture-code-123',sb_flow_id:'a'.repeat(32)}),{code:'fixture-code-123',flowId:'a'.repeat(32)});
  for(const params of [{},{code:['one','two']},{code:'x'.repeat(2049)},{code:'fixture-code-123',access_token:'injected'},{code:'fixture-code-123',refresh_token:'injected'},{code:'fixture-code-123',error:'access_denied'},{code:'fixture-code-123',sb_flow_id:['x','y']}])assert.throws(()=>callbackInput(params));
});
test('role snapshots deny staff/admin tools at AAL1 and support explicit multi-branch grants',()=>{
  assert.equal(roleSnapshot([{role:'admin'}],[],'aal1').role,'user');assert.equal(roleSnapshot([{role:'admin'}],[],'aal1').requiresMfa,true);
  assert.equal(roleSnapshot([{role:'staff'}],['a','b'],'aal2').role,'staff');assert.equal(roleSnapshot([{role:'staff'}],[],'aal2').role,'user');
  assert.equal(roleSnapshot([{role:'staff'},{role:'user'},{role:'admin'}],['a'],'aal2').role,'admin');assert.equal(roleSnapshot([{role:'user'}],[],'aal1').requiresMfa,false);
});

test('PKCE recovery persists its guard before exchange, survives restart, and deduplicates callbacks',async()=>{
  const {createAuthCallback}=await import('../lib/auth-callback.ts');
  const storage=memory();let calls=0;let recoveryOwner=null;let recovery=false;
  const complete=createAuthCallback({storage,markerKey:'guard',owner:()=>undefined,recoveryOwner:()=>recoveryOwner,beforeExchange(){},async exchange(){
    calls++;assert.equal(storage.data.get('guard'),'pending');recoveryOwner='account-a';return {data:{session:{user:{id:'account-a'}}},error:null};
  },async signOut(){},setRecovery(value){recovery=value;}});
  assert.deepEqual(await Promise.all([complete({code:'fixture-code-123'}),complete({code:'fixture-code-123'})]),['recovery','recovery']);
  assert.equal(calls,1);assert.equal(recovery,true);assert.equal(await storage.getItem('guard'),'account-a');
});
test('a rejected link cannot remove an existing recovery guard',async()=>{
  const {createAuthCallback}=await import('../lib/auth-callback.ts');const storage=memory();await storage.setItem('guard','account-a');
  const complete=createAuthCallback({storage,markerKey:'guard',owner:()=>'account-a',recoveryOwner:()=>null,beforeExchange(){},async exchange(){return {data:{session:null},error:Error('expired')};},async signOut(){},setRecovery(){}});
  await assert.rejects(complete({code:'expired-code-123'}));assert.equal(await storage.getItem('guard'),'account-a');
});
test('unexpected SDK/storage failure preserves a blocking guard, while confirmed signup clears it',async()=>{
  const {createAuthCallback}=await import('../lib/auth-callback.ts');const storage=memory();let recovery=false;
  const dependencies={storage,markerKey:'guard',owner:()=>undefined,recoveryOwner:()=>null,beforeExchange(){},async signOut(){},setRecovery(value){recovery=value;}};
  const failing=createAuthCallback({...dependencies,async exchange(){throw Error('Storage failed after session commit');}});
  await assert.rejects(failing({code:'fixture-code-123'}));assert.equal(await storage.getItem('guard'),'pending');assert.equal(recovery,true);
  const confirmed=createAuthCallback({...dependencies,async exchange(){return {data:{session:{user:{id:'account-a'}}},error:null};}});
  assert.equal(await confirmed({code:'signup-code-123'}),'signed-in');assert.equal(await storage.getItem('guard'),null);assert.equal(recovery,false);
});
test('a callback cannot silently replace a different signed-in account',async()=>{
  const {createAuthCallback}=await import('../lib/auth-callback.ts');let signedOut=false;const storage=memory();
  const complete=createAuthCallback({storage,markerKey:'guard',owner:()=>'account-a',recoveryOwner:()=>null,beforeExchange(){},async exchange(){return {data:{session:{user:{id:'account-b'}}},error:null};},async signOut(){signedOut=true;await storage.removeItem('guard');},setRecovery(){}});
  await assert.rejects(complete({code:'fixture-code-123'}),/Account changed/);assert.equal(signedOut,true);assert.equal(await storage.getItem('guard'),null);
});

test('browser redirects retain expiring PKCE proofs without persisting bearer sessions',async()=>{
  const {createBrowserSessionStorage}=await import('../lib/session-storage.ts');const legacy=memory(),proofs=memory();
  const first=createBrowserSessionStorage(legacy,proofs);await first.setItem('project-auth-token','bearer-session');await first.setItem('project-auth-token-flow-id-code-verifier','proof');
  assert.equal(await first.getItem('project-auth-token'),'bearer-session');assert.equal(proofs.data.has('project-auth-token'),false);
  const reloaded=createBrowserSessionStorage(legacy,proofs);assert.equal(await reloaded.getItem('project-auth-token'),null);assert.equal(await reloaded.getItem('project-auth-token-flow-id-code-verifier'),'proof');assert.equal(legacy.data.size,0);
  await reloaded.removeItem('project-auth-token-flow-id-code-verifier');assert.equal(proofs.data.size,0);
});
test('browser expired or corrupt PKCE proof material is discarded',async()=>{
  const {createBrowserSessionStorage}=await import('../lib/session-storage.ts');const proofs=memory(),storage=createBrowserSessionStorage(memory(),proofs);
  proofs.data.set('a-code-verifier',JSON.stringify({value:'expired',expires:Date.now()-1}));proofs.data.set('b-code-verifier','invalid');
  assert.equal(await storage.getItem('a-code-verifier'),null);assert.equal(await storage.getItem('b-code-verifier'),null);assert.equal(proofs.data.size,0);
});
