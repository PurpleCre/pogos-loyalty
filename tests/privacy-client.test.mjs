import assert from 'node:assert/strict';
import { test } from 'node:test';
import { collectPrivacyExport,privacySections } from '../lib/privacy.ts';
import { logPrivateError,sanitizeTelemetry } from '../lib/privacy-logging.ts';
const id='d0000000-0000-4000-8000-000000000001';
const cursor='d0000000-0000-4000-8000-000000000002';
const page=(section,rows=[],next_cursor=null)=>({section,rows,next_cursor,generated_at:'2026-10-31T10:00:00Z',created_before:'2026-10-31T09:00:00Z'});
test('account export collects every section and page before marking it prepared',async()=>{
  let finishes=0;const seen=[];
  const result=await collectPrivacyExport(id,'owner',()=>true,{async page(_id,section,after){seen.push([section,after]);return section==='addresses'&&!after?page(section,[{address:'Fixture one'}],cursor):page(section,section==='addresses'?[{address:'Fixture two'}]:[]);},async finish(){finishes++;}});
  assert.equal(finishes,1);assert.equal(seen.length,privacySections.length+1);assert.equal(result.sections.addresses.length,2);assert.equal(result.account_id,'owner');
});
test('an account switch during export prevents completion or a usable partial file',async()=>{
  let current=true;let finishes=0;
  await assert.rejects(collectPrivacyExport(id,'old-owner',()=>current,{async page(_id,section){current=false;return page(section,[{private:'old account'}]);},async finish(){finishes++;}}),/account changed/);
  assert.equal(finishes,0);
});
test('wrong sections, changed cutoffs and malformed responses cannot become export files',async()=>{
  for(const variant of ['section','cutoff','malformed']){
    let n=0;let finishes=0;
    await assert.rejects(collectPrivacyExport(id,'owner',()=>true,{async page(_id,section){n++;const result=page(section);if(variant==='section')result.section='addresses';if(variant==='cutoff'&&n>1)result.created_before='other';if(variant==='malformed')result.rows='not an array';return result;},async finish(){finishes++;}}));
    assert.equal(finishes,0);
  }
});
test('repeated cursors, empty continuation pages and excessive exports fail before preparation',async()=>{
  for(const variant of ['repeat','empty','large']){
    let finishes=0;
    await assert.rejects(collectPrivacyExport(id,'owner',()=>true,{async page(_id,section){return page(section,variant==='empty'?[]:[{value:variant==='large'?'x'.repeat(5000001):'data'}],cursor);},async finish(){finishes++;}}));
    assert.equal(finishes,0);
  }
});
test('preparation failure does not return a completed export to the sharing layer',async()=>{
  await assert.rejects(collectPrivacyExport(id,'owner',()=>true,{async page(_id,section){return page(section);},async finish(){throw Error('Network interruption');}}),/Network interruption/);
});
test('private error logging emits only fixed context and a bounded machine code',()=>{
  const output=[];const original=console.error;console.error=(...args)=>output.push(args);
  try{logPrivateError('Save address failed',{code:'23505',message:'secret@example.test',details:'12 private street',token:'bearer'});logPrivateError('Authentication failed',{code:'email@example.test'});}
  finally{console.error=original;}
  assert.deepEqual(output,[['Save address failed',{code:'23505'}],['Authentication failed',{code:'unknown'}]]);
});
test('telemetry removes personal payloads, URL credentials and auth query/fragment values while keeping stack locations',()=>{
  const event={event_id:'fixture',user:{email:'person@example.test'},request:{data:{address:'private'}},extra:{password:'secret'},contexts:{private:'data'},exception:{values:[{type:'Error',value:'Private error',stacktrace:{frames:[{filename:'app.tsx',lineno:10,vars:{email:'hidden'}}]}}]},breadcrumbs:[{message:'raw personal text',data:{url:'pogos-dev://auth/callback?code=secret#access_token=token',Authorization:'Bearer secret'}}]};
  const result=sanitizeTelemetry(event);const text=JSON.stringify(result);
  for(const forbidden of ['person@example.test','private','secret','hidden','Private error','raw personal text','Bearer'])assert.ok(!text.includes(forbidden),forbidden);
  assert.equal(result.exception.values[0].stacktrace.frames[0].filename,'app.tsx');assert.ok(text.includes('pogos-dev://auth/callback'));
});

test('ordinary logout clears the departing address cache without dropping financial recovery or another account',async()=>{
  const {clearAccountLocalData}=await import('../lib/account-cleanup.ts');const {createLocationCache}=await import('../lib/location-cache.ts');
  const data=new Map();const storage={async getItem(key){return data.get(key)??null;},async setItem(key,value){data.set(key,value);},async removeItem(key){data.delete(key);}};
  await createLocationCache(storage).write('alice',[{id:'fixture',address:'Private address',latitude:0,longitude:0,tag:'Home'}]);
  data.set('@pogos_pending_cash_order:alice','cash');data.set('@pogos_pending_branch_command:alice','branch');data.set('@pogos_pending_finance_command:alice','finance');data.set('@pogos_locations:bob','other account');
  await clearAccountLocalData(storage,'alice');assert.equal(data.has('@pogos_locations:alice'),false);assert.equal(data.get('@pogos_pending_cash_order:alice'),'cash');assert.equal(data.get('@pogos_locations:bob'),'other account');
  assert.equal(data.get('@pogos_pending_branch_command:alice'),'branch');
  assert.equal(data.get('@pogos_pending_finance_command:alice'),'finance');
  await clearAccountLocalData(storage,'alice',true);assert.equal(data.has('@pogos_pending_cash_order:alice'),false);assert.equal(data.has('@pogos_pending_branch_command:alice'),false);assert.equal(data.has('@pogos_pending_finance_command:alice'),false);assert.equal(data.get('@pogos_locations:bob'),'other account');
});
test('cleanup attempts every account key and reports failures instead of claiming complete erasure',async()=>{
  const {clearAccountLocalData}=await import('../lib/account-cleanup.ts');const attempted=[];
  await assert.rejects(clearAccountLocalData({async removeItem(key){attempted.push(key);if(key.startsWith('@pogos_locations:'))throw Error('Storage unavailable');}},'alice',true),/could not be confirmed/);
  assert.equal(attempted.length,10);
});
