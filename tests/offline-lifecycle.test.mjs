import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { createReadResource, readIsFresh } from '../lib/read-resource.ts';
import { createCartRepository, validateSavedCart } from '../lib/cart-storage.ts';
import { createBrowsingCache, menuBrowseSchema, storeBrowseSchema } from '../lib/browsing-cache.ts';
import { quoteReviewIsCurrent } from '../lib/checkout-lifecycle.ts';
import { legacyQueueNeedsReview } from '../lib/legacy-offline.ts';
import { createCheckoutRecovery } from '../lib/cash-checkout.ts';
import { cartFingerprint, cartSelectionFingerprint } from '../lib/cart.ts';
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const memory=()=>{const data=new Map();return {data,async getItem(k){return data.get(k)??null;},async setItem(k,v){data.set(k,v);},async removeItem(k){data.delete(k);}};};
const branch=randomUUID(),item=randomUUID(),choice=randomUUID();
const draft=(owner='alice')=>({owner,storeId:branch,items:[{id:'untrusted-id',menu_item_id:item,name:'Fixture meal',price:10.1,quantity:2,subtotal:0,choice_ids:[choice],choice_labels:['Fixture choice']}]});

test('cart selections survive a new repository instance and derived IDs/totals are rebuilt',async()=>{
 const storage=memory();const first=createCartRepository(storage,'development').open('alice');await first.save(draft());first.close();
 const second=createCartRepository(storage,'development').open('alice');const value=await second.load();
 assert.equal(value.storeId,branch);assert.equal(value.items[0].subtotal,20.2);assert.notEqual(value.items[0].id,'untrusted-id');assert.deepEqual(value.items[0].choice_ids,[choice]);
 assert.deepEqual((await createCartRepository(storage,'production').open('alice').load()).items,[]);
 assert.deepEqual((await createCartRepository(storage,'development').open('bob').load()).items,[]);
});
test('cart reads reject wrong owners, altered envelopes and corrupt records without silently deleting selections',async()=>{
 const storage=memory();const key='@pogos_cart:v1:development:alice';
 for(const raw of ['broken',JSON.stringify({version:1,environment:'production',cart:draft()}),JSON.stringify({version:1,environment:'development',cart:draft('bob')})]){
  storage.data.set(key,raw);await assert.rejects(createCartRepository(storage,'development').open('alice').load());assert.equal(storage.data.get(key),raw);
 }
});
test('saved carts reject duplicate variants, invalid quantities, nonfinite prices and branchless lines',()=>{
 for(const value of [{...draft(),storeId:null},{...draft(),items:[...draft().items,...draft().items]},
 {...draft(),items:[{...draft().items[0],quantity:100}]},{...draft(),items:[{...draft().items[0],price:Infinity}]},
 {...draft(),items:[{...draft().items[0],choice_ids:[choice,choice]}]}])assert.throws(()=>validateSavedCart(value,'alice'));
 const value=validateSavedCart({...draft(),items:[...draft().items,{...draft().items[0],choice_ids:[]}]},'alice');assert.equal(value.items.length,2);
});
test('queued cart saves cannot resurrect a cart after logout cleanup or touch a financial recovery journal',async()=>{
 const storage=memory(),gate=deferred(),started=deferred();const base=storage.setItem;
 storage.setItem=async(k,v)=>{started.resolve();await gate.promise;return base(k,v);};
 storage.data.set('@pogos_pending_cash_order:alice','preserve checkpoint');
 const repository=createCartRepository(storage,'development'),session=repository.open('alice');
 const first=session.save(draft());await started.promise;
 const second=session.save({...draft(),items:[{...draft().items[0],quantity:3}]});const rejected=assert.rejects(second,/account changed/);
 const clear=repository.clearAccount('alice');gate.resolve();await first;await rejected;await clear;
 assert.equal(storage.data.has('@pogos_cart:v1:development:alice'),false);assert.equal(storage.data.get('@pogos_pending_cash_order:alice'),'preserve checkpoint');
 await assert.rejects(session.save(draft()),/account changed/);
});
test('a late old-account cart read is fenced even after switching back to the same account',async()=>{
 const storage=memory(),gate=deferred(),started=deferred();const base=storage.getItem;
 storage.getItem=async(k)=>{started.resolve();await gate.promise;return base(k);};
 const repository=createCartRepository(storage,'development'),alice=repository.open('alice');const read=alice.load();const rejected=assert.rejects(read,/account changed/);await started.promise;
 const bob=repository.open('bob');const newAlice=repository.open('alice');bob.close();assert.equal(newAlice.isCurrent(),true);
 gate.resolve();await rejected;
});
test('cart storage errors are observable and a later save can safely retry the latest selections',async()=>{
 const storage=memory();let fail=true;const base=storage.setItem;storage.setItem=async(k,v)=>{if(fail)throw Error('full');await base(k,v);};
 const session=createCartRepository(storage,'development').open('alice');await assert.rejects(session.save(draft()),/full/);fail=false;
 await session.save({...draft(),items:[{...draft().items[0],quantity:3}]});assert.equal((await session.load()).items[0].quantity,3);
});
test('cart persistence is separate from interrupted order identity across restart and recovery',async()=>{
 const storage=memory(),cart=createCartRepository(storage,'development').open('alice');await cart.save(draft());const fingerprint=cartFingerprint(await cart.load().then(v=>v.items));
 const quote=randomUUID(),order=randomUUID();let commands=new Set(),calls=0;
 const send=async(_quote,id)=>{calls++;commands.add(id);if(calls===1)throw Error('response lost');return {order_id:order,status:'pending'};};
 await assert.rejects(createCheckoutRecovery(storage).place('alice',quote,fingerprint,send),/response lost/);
 const restarted=createCartRepository(storage,'development').open('alice');assert.equal((await restarted.load()).items.length,1);
 const recovery=createCheckoutRecovery(storage),pending=await recovery.load('alice');const result=await recovery.recover('alice',pending,send);
 assert.equal(result.order_id,order);assert.equal(commands.size,1);await restarted.save({owner:'alice',storeId:null,items:[]});assert.equal(await recovery.load('alice'),null);
});
test('saved read data is never fresh until a successful network read and failures retain a stale snapshot',async()=>{
 let time=1000,fail=false;const resource=createReadResource(async()=>{if(fail)throw Error('offline');return ['current'];},{now:()=>time});
 resource.seed(['saved'],500);assert.equal(readIsFresh(resource.get(),1000),false);
 await resource.refresh();assert.equal(readIsFresh(resource.get(),1000),true);fail=true;time=1100;await resource.refresh();
 assert.deepEqual(resource.get().data,['current']);assert.equal(resource.get().error,true);assert.equal(readIsFresh(resource.get(),1100),false);
});
test('newer reads win and an old response cannot cross background/foreground or scope disposal',async()=>{
 const pending=[];const resource=createReadResource(()=>{const call=deferred();pending.push(call);return call.promise;});
 const old=resource.refresh(),latest=resource.refresh();pending[1].resolve('new');await latest;pending[0].resolve('old');await old;assert.equal(resource.get().data,'new');
 const beforeBackground=resource.refresh();resource.invalidate();pending[2].resolve('background response');await beforeBackground;assert.equal(resource.get().verified,false);assert.equal(resource.get().data,'new');
 const beforeStop=resource.refresh();resource.stop();resource.activate();const afterReturn=resource.refresh();pending[4].resolve('returned');await afterReturn;pending[3].resolve('stale scope');await beforeStop;assert.equal(resource.get().data,'returned');
});
test('permission/auth failures remove private snapshots and late cache hydration cannot restore them',async()=>{
 for(const error of [{code:'42501'},{code:'PGRST301'},{status:401},{status:403}]){
  let fail=false;const resource=createReadResource(async()=>{if(fail)throw error;return {private:'fixture'};});await resource.refresh();fail=true;await resource.refresh();
  resource.seed({private:'old cache'},100);assert.equal(resource.get().data,null);assert.equal(resource.get().verified,false);
 }
});
test('read freshness rejects expired timestamps, background and a backward clock',()=>{
 const state={data:1,verified:true,error:false,loading:false,refreshedAt:1000};assert.equal(readIsFresh(state,1001),true);
 assert.equal(readIsFresh(state,999),false);assert.equal(readIsFresh(state,31000),false);assert.equal(readIsFresh(state,1001,false),false);
});
test('read timeouts return an unverified state and cannot later turn a lost response into success',async()=>{
 const gate=deferred();const resource=createReadResource(()=>gate.promise,{timeoutMs:5});await resource.refresh();assert.equal(resource.get().error,true);assert.equal(resource.get().verified,false);
 gate.resolve('too late');await Promise.resolve();assert.equal(resource.get().data,null);
});
test('public browsing cache strips unrelated fields and enforces environment, branch and age boundaries',async()=>{
 const storage=memory();let now=1000;const schema=z.object({name:z.string()});const cache=createBrowsingCache(storage,'development','menu:A',schema,()=>now);
 await cache.write({name:'Public meal',private:'must not persist'},1000);assert.equal(JSON.stringify([...storage.data.values()]).includes('must not persist'),false);
 assert.equal((await cache.read()).data.name,'Public meal');assert.equal(await createBrowsingCache(storage,'development','menu:B',schema,()=>now).read(),null);
 const raw=storage.data.get('@pogos_browse:v1:development:menu:A');storage.data.set('@pogos_browse:v1:production:menu:A',raw);
 assert.equal(await createBrowsingCache(storage,'production','menu:A',schema,()=>now).read(),null);
 now=999;assert.equal(await cache.read(),null);now=86401001;assert.equal(await cache.read(),null);
});
test('public menu and branch cache schemas retain no customer or privileged payload fields',()=>{
 const menu=menuBrowseSchema.parse({categories:[],items:[{id:item,category_id:randomUUID(),name:'Fixture',description:'',price:10,image_url:'',is_available:true,contact_snapshot:{phone:'private'},secret:'never'}]});
 const stores=storeBrowseSchema.parse([{id:branch,name:'Fixture',address:'Public branch address',distance_miles:0,is_open:true,latitude:null,longitude:null,created_at:null,image_url:null,private:'never'}]);
 assert.equal(JSON.stringify({menu,stores}).includes('private'),false);assert.equal(JSON.stringify(menu).includes('never'),false);
});
test('legacy offline activity is detected without reading its contents into UI, replaying it or deleting it',async()=>{
 const storage=memory();assert.equal(await legacyQueueNeedsReview(storage),false);
 for(const [raw,result]of [['[]',false],['[{"customer":"private"}]',true],['broken',true],['{}',true],['x'.repeat(1000001),true]]){
  storage.data.set('offline_pending_actions',raw);assert.equal(await legacyQueueNeedsReview(storage),result);assert.equal(storage.data.get('offline_pending_actions'),raw);
 }
});
test('checkout review expires on draft/background/clock changes and monotonic elapsed time cannot extend a quote',()=>{
 const review={draft:'same',receivedAt:1000,monotonicAt:100,expiresAt:new Date(301000).toISOString()};
 assert.equal(quoteReviewIsCurrent(review,'same',1001,101,true),true);
 for(const args of [['changed',1001,101,true],['same',1001,101,false],['same',999,101,true],['same',1001,99,true],['same',301000,200,true],['same',2000,300100,true]])assert.equal(quoteReviewIsCurrent(review,...args),false);
});

test('a failed initial read can still show a late-arriving saved public menu without calling it fresh',async()=>{
 const resource=createReadResource(async()=>{throw Error('offline');});await resource.refresh();resource.seed(['saved menu'],10);
 assert.deepEqual(resource.get().data,['saved menu']);assert.equal(resource.get().verified,false);assert.equal(resource.get().error,true);
});
test('confirmed order cleanup keeps its recovery key until matching cart retirement is durable',async()=>{
 const storage=memory(),repository=createCartRepository(storage,'development'),session=repository.open('alice');await session.save(draft());
 const fingerprint=cartSelectionFingerprint(await session.load()),quote=randomUUID(),order=randomUUID();
 const realWrite=storage.setItem;let fail=true;storage.setItem=async(k,v)=>{if(fail&&k.startsWith('@pogos_cart:'))throw Error('cart disk full');await realWrite(k,v);};
 const ids=new Set();const send=async(_quote,id)=>{ids.add(id);return {order_id:order,status:'pending'};};
 const recovery=createCheckoutRecovery(storage,{onConfirmed:(owner,pending)=>repository.completeSubmission(owner,pending.cartFingerprint)});
 await assert.rejects(recovery.place('alice',quote,fingerprint,send),/cart disk full/);
 assert.ok(await recovery.load('alice'));assert.equal((await session.load()).items.length,1);
 fail=false;const saved=await recovery.load('alice');assert.equal((await recovery.recover('alice',saved,send)).order_id,order);
 assert.equal(ids.size,1);assert.equal((await session.load()).items.length,0);assert.equal(await recovery.load('alice'),null);
});
test('a kill after cart retirement but before journal cleanup preserves replay and does not erase later changed selections',async()=>{
 const storage=memory(),repository=createCartRepository(storage,'development'),session=repository.open('alice');await session.save(draft());
 const fingerprint=cartSelectionFingerprint(await session.load());const remove=storage.removeItem;let fail=true;
 storage.removeItem=async(k)=>{if(fail&&k.startsWith('@pogos_pending_cash_order:'))throw Error('kill before removal');await remove(k);};
 const recovery=createCheckoutRecovery(storage,{onConfirmed:(owner,pending)=>repository.completeSubmission(owner,pending.cartFingerprint)}),quote=randomUUID(),order=randomUUID();
 const send=async()=>({order_id:order,status:'pending'});await recovery.place('alice',quote,fingerprint,send);
 assert.equal((await session.load()).items.length,0);assert.ok(await recovery.load('alice'));
 await session.save({...draft(),items:[{...draft().items[0],quantity:3}]});fail=false;
 await recovery.recover('alice',await recovery.load('alice'),send);assert.equal((await session.load()).items[0].quantity,3);
});
test('simultaneous order starts cannot overwrite the durable identity and a stale UI checkpoint cannot erase a new one',async()=>{
 const storage=memory(),gate=deferred(),recovery=createCheckoutRecovery(storage);const quote=randomUUID(),order=randomUUID();
 const first=recovery.place('alice',quote,'cart',async()=>gate.promise);
 await assert.rejects(recovery.place('alice',randomUUID(),'other',async()=>{throw Error('must not send');}),/still being checked/);
 gate.resolve({order_id:order,status:'pending'});await first;
 await assert.rejects(recovery.place('alice',randomUUID(),'new',async()=>{throw Error('offline');}),/offline/);
 const current=await recovery.load('alice');
 await assert.rejects(recovery.recover('alice',{...current,quoteId:randomUUID()},async()=>{throw Error('must not send');}),/reference changed/);
 assert.deepEqual(await recovery.load('alice'),current);
});

test('confirmation cannot clear a new branch cart with identical universal meals or an unscoped legacy fingerprint',async()=>{
 const storage=memory(),repository=createCartRepository(storage,'development'),session=repository.open('alice');await session.save(draft());
 const original=await session.load(),submitted=cartSelectionFingerprint(original);
 await session.save({...original,storeId:randomUUID()});await repository.completeSubmission('alice',submitted);
 assert.equal((await session.load()).items.length,1);
 await repository.completeSubmission('alice',cartFingerprint(original.items));assert.equal((await session.load()).items.length,1);
});

test('address cache cleanup fences a pre-logout network writer and orders removal after in-flight storage writes',async()=>{
 const {createLocationCache}=await import('../lib/location-cache.ts');const {clearAccountLocalData}=await import('../lib/account-cleanup.ts');
 const storage=memory(),cache=createLocationCache(storage),late=cache.writer('alice'),gate=deferred(),started=deferred(),set=storage.setItem;
 storage.setItem=async(k,v)=>{started.resolve();await gate.promise;return set(k,v);};
 const entry=[{id:'fixture',address:'Private address',latitude:0,longitude:0}];const inFlight=cache.write('alice',entry);await started.promise;
 const clearing=clearAccountLocalData(storage,'alice');gate.resolve();await inFlight;await clearing;await late(entry);
 assert.equal(storage.data.has('@pogos_locations:alice'),false);
 storage.setItem=set;await cache.writer('alice')(entry);assert.equal((await cache.read('alice')).length,1);
});
test('account cleanup removes known legacy personal caches while preserving unknown action evidence and another account',async()=>{
 const {clearAccountLocalData}=await import('../lib/account-cleanup.ts');const storage=memory();
 for(const key of ['offline_userAchievements_alice','offline_referralCode_alice','offline_referrals_alice','offline_referrals_bob','offline_pending_actions','@pogos_pending_cash_order:alice'])storage.data.set(key,'preserve or remove by ownership');
 await clearAccountLocalData(storage,'alice');assert.equal(storage.data.has('offline_referrals_alice'),false);assert.equal(storage.data.has('offline_userAchievements_alice'),false);assert.equal(storage.data.has('offline_referralCode_alice'),false);
 for(const key of ['offline_referrals_bob','offline_pending_actions','@pogos_pending_cash_order:alice'])assert.equal(storage.data.has(key),true);
});

test('visitor selections survive a failed sign-in handoff and can be retried without merging twice',async()=>{
 const {restoreCartSession}=await import('../lib/cart-storage.ts');const storage=memory(),repo=createCartRepository(storage,'development');
 const guest=repo.open(null);await guest.save(draft(null));const original=await guest.load();guest.close();const owned=repo.open('alice');
 const set=storage.setItem;storage.setItem=async(k,v)=>{if(k.endsWith(':alice'))throw Error('disk full');return set(k,v);};
 await assert.rejects(restoreCartSession(owned,'alice',original,()=>repo.clearAccount(null)),/disk full/);
 assert.equal(storage.data.has('@pogos_cart:v1:development:guest'),true);assert.equal(storage.data.has('@pogos_cart:v1:development:alice'),false);
 storage.setItem=set;const restored=await restoreCartSession(owned,'alice',original,()=>repo.clearAccount(null));assert.equal(restored.items[0].quantity,2);
 assert.equal(storage.data.has('@pogos_cart:v1:development:guest'),false);assert.equal((await owned.load()).items[0].quantity,2);
});
test('a kill after owned cart copy preserves the original and retry prefers the owned copy',async()=>{
 const {restoreCartSession}=await import('../lib/cart-storage.ts');const storage=memory(),repo=createCartRepository(storage,'development');
 const guest=repo.open(null);await guest.save(draft(null));const original=await guest.load();guest.close();const owned=repo.open('alice');
 await assert.rejects(restoreCartSession(owned,'alice',original,async()=>{throw Error('interrupted guest cleanup');}),/interrupted/);
 assert.equal((await owned.load()).items[0].quantity,2);assert.equal(storage.data.has('@pogos_cart:v1:development:guest'),true);
 const restored=await restoreCartSession(owned,'alice',original,()=>repo.clearAccount(null));assert.equal(restored.items[0].quantity,2);
});
test('cart handoff preserves existing owned selections and stops before clearing a changed account',async()=>{
 const {restoreCartSession}=await import('../lib/cart-storage.ts');const storage=memory(),repo=createCartRepository(storage,'development'),owned=repo.open('alice');
 await owned.save({...draft(),items:[{...draft().items[0],quantity:4}]});const restored=await restoreCartSession(owned,'alice',draft(null),async()=>{});assert.equal(restored.items[0].quantity,4);
 const gate=deferred(),started=deferred();let cleared=false;
 const oldSession={isCurrent:owned.isCurrent,async load(){started.resolve();await gate.promise;return draft();},save:owned.save};
 const read=restoreCartSession(oldSession,'alice',draft(null),async()=>{cleared=true;});const rejects=assert.rejects(read,/account changed/);await started.promise;repo.open('bob');gate.resolve();await rejects;assert.equal(cleared,false);
});
test('foreground recovery replaces a pending initial read and always settles loading for the latest result',async()=>{
 const {createRecoveryReader}=await import('../lib/checkout-lifecycle.ts');const requests=[],states=[];
 const reader=createRecoveryReader(()=>{const next=deferred();requests.push(next);return next.promise;},state=>states.push(state));
 const initial=reader.read(),foreground=reader.read();const pending={quoteId:randomUUID(),submissionKey:randomUUID(),cartFingerprint:'fixture'};
 requests[1].resolve(pending);await foreground;requests[0].resolve(null);await initial;
 assert.deepEqual(states.at(-1),{pending,loading:false,blocked:false});
 const failed=reader.read();requests[2].reject(Error('unreadable'));await failed;assert.deepEqual(states.at(-1),{pending:null,loading:false,blocked:true});
 const retry=reader.read();requests[3].resolve(pending);await retry;assert.deepEqual(states.at(-1),{pending,loading:false,blocked:false});
});
test('disposed recovery reads cannot update another account or override an in-flight command',async()=>{
 const {createRecoveryReader}=await import('../lib/checkout-lifecycle.ts');const requests=[],states=[];
 const reader=createRecoveryReader(()=>{const next=deferred();requests.push(next);return next.promise;},state=>states.push(state));
 const old=reader.read();reader.stop();requests[0].resolve(null);await old;assert.equal(states.length,1);
 reader.activate();const beforeSubmit=reader.read();reader.invalidate();requests[1].resolve(null);await beforeSubmit;assert.equal(states.length,2);
});
