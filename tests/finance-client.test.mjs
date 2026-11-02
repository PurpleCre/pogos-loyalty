import assert from 'node:assert/strict';
import {test} from 'node:test';
import {moneyText,parseObservedMoney,harareDay,validReportDay,createFinanceRecovery,collectFinanceReport} from '../lib/finance.ts';
import {roleSnapshot,branchScopedRole} from '../lib/identity.ts';
const branch='a6110000-0000-4000-8000-000000000001',owner='b6110000-0000-4000-8000-000000000001',caseId='c6110000-0000-4000-8000-000000000001';
const request={kind:'submit',storeId:branch,day:'2026-11-01',currency:'USD',observed:{received_minor:'1010',refunded_minor:'0',settled_minor:'0'},evidence:'Fixture linked till report'};
const receipt=p=>({id:p.command.kind==='submit'?p.commandId:p.command.caseId,store_id:p.command.storeId,status:p.command.kind==='submit'?'matched':p.command.accept?'accepted':'rejected',version:p.command.kind==='submit'?0:p.command.expectedVersion+1});
function fixture(){const values=new Map();const storage={async getItem(k){return values.get(k)??null;},async setItem(k,v){values.set(k,v);},async removeItem(k){values.delete(k);}};return{values,storage,recovery:createFinanceRecovery(storage)};}
test('financial formatting and observation parsing preserve values above Number precision without FX or floating-point arithmetic',()=>{
  assert.equal(moneyText('9007199254740993','USD'),'USD 90071992547409.93');assert.equal(moneyText('-1','ZWG'),'ZWG -0.01');
  assert.equal(parseObservedMoney('90071992547409.93'),'9007199254740993');assert.equal(parseObservedMoney('001.2'),'120');assert.equal(parseObservedMoney('0.29'),'29');
  for(const value of ['1e3','1.005','-1','1,000','NaN',''])assert.throws(()=>parseObservedMoney(value));
});
test('business-day defaults use Harare midnight and date validation rejects rollover and malformed input',()=>{
  assert.equal(harareDay(new Date('2026-11-01T21:59:59Z')),'2026-11-01');assert.equal(harareDay(new Date('2026-11-01T22:00:00Z')),'2026-11-02');
  assert.equal(validReportDay('2024-02-29'),true);for(const date of ['2026-02-29','2026-02-30','2026-1-1','bad'])assert.equal(validReportDay(date),false);
});
test('manager and finance sessions require MFA and a branch scope without turning finance into staff or admin',()=>{
  for(const role of ['manager','finance']){
    const first=roleSnapshot([{role}],[branch],'aal1');assert.equal(first.role,'user');assert.equal(first.requiresMfa,true);
    assert.equal(roleSnapshot([{role}],[branch],'aal2').role,role);assert.equal(roleSnapshot([{role}],[],'aal2').role,'user');assert.equal(branchScopedRole(role),true);
  }
  assert.equal(branchScopedRole('admin'),false);assert.equal(roleSnapshot([{role:'staff'},{role:'finance'}],[branch],'aal2').role,'finance');
});
test('lost finance response survives restart and recovers the original case/command identity and exact strings',async()=>{
  const {recovery,storage}=fixture();let first;
  await assert.rejects(recovery.execute(owner,request,async p=>{first=p;throw Error('Lost response after commit');}));
  const restarted=createFinanceRecovery(storage);assert.equal(await restarted.load('another-account'),null);
  assert.deepEqual(await restarted.recover(owner,async p=>{assert.deepEqual(p,first);return receipt(p);}),receipt(first));assert.equal(await restarted.load(owner),null);
});
test('persistence failure, corruption and an unresolved different branch/case prevent sending another financial action',async()=>{
  const{values,storage,recovery}=fixture();let sent=0;storage.setItem=async()=>{throw Error('Storage full');};
  await assert.rejects(recovery.execute(owner,request,async p=>{sent++;return receipt(p);}));assert.equal(sent,0);
  values.set(`@pogos_pending_finance_command:${owner}`,'{broken');await assert.rejects(recovery.execute(owner,request,async p=>{sent++;return receipt(p);}));assert.equal(sent,0);
  const fresh=fixture();await assert.rejects(fresh.recovery.execute(owner,request,async()=>{throw Error('Timeout');}));
  await assert.rejects(fresh.recovery.execute(owner,{...request,storeId:caseId},async p=>receipt(p)),/saved finance action/);
});
test('a mismatched or impossible financial success retains the checkpoint rather than claiming approval',async()=>{
  for(const changes of [{id:caseId},{store_id:caseId},{status:'accepted'},{version:9}]){
    const{recovery}=fixture();await assert.rejects(recovery.execute(owner,request,async p=>({...receipt(p),...changes})),/could not be confirmed/);assert.ok(await recovery.load(owner));
  }
});
test('stale/validation rollbacks clear recovery but auth and transport ambiguity remain recoverable',async()=>{
  for(const code of ['22023','23505','40001','42501','PGRST301','NETWORK']){
    const{recovery}=fixture();await assert.rejects(recovery.execute(owner,request,async()=>{throw{code};}));assert.equal(!!await recovery.load(owner),['42501','PGRST301','NETWORK'].includes(code));
  }
});
test('a stale review is a real recorded outcome and cleanup failure permits only an exact replay',async()=>{
  const{recovery,storage}=fixture();storage.removeItem=async()=>{throw Error('Storage unavailable');};const review={kind:'review',storeId:branch,caseId,expectedVersion:3,accept:true,reason:'External evidence checked'};let first;
  const result=await recovery.execute(owner,review,async p=>{first=p;return{...receipt(p),status:'stale'};});assert.equal(result.status,'stale');
  assert.deepEqual(await recovery.recover(owner,async p=>{assert.deepEqual(p,first);return result;}),result);
});
test('overlapping finance actions cannot replace the persisted request',async()=>{
  const{recovery}=fixture();let release,started;const ready=new Promise(r=>{started=r;});
  const first=recovery.execute(owner,request,async p=>{started();await new Promise(r=>{release=r;});return receipt(p);});await ready;
  await assert.rejects(recovery.execute(owner,request,async p=>receipt(p)),/already being checked/);release();await first;
});
const row=i=>({id:`d6110000-0000-4000-8000-${String(i).padStart(12,'0')}`,order_id:caseId,event_type:'received',amount_minor:'1010',reference:'GAAP fixture',created_at:'2026-11-01T12:00:00Z'});
function report(count='2'){return{as_of:'2026-11-01T12:00:00Z',period:{store_id:branch,business_day:'2026-11-01',currency:'USD',period_start:'2026-10-31T22:00:00Z',period_end:'2026-11-01T22:00:00Z',
  received_minor:'2020',refunded_minor:'0',settled_minor:'0',net_received_minor:'2020',net_till_movement_minor:'0',sale_count:'2',refund_count:'0',entry_count:count,signature:'a'.repeat(64)},
  outstanding_all_dates_minor:'2020',pending_handovers_all_dates:'0',missing_receipts_all_dates:'0',reward_handovers_day:'0',reward_voids_day:'0',held_reward_points_all_dates:'0',latest_reconciliation:null};}
const page=(entries,next_after=null)=>({store_id:branch,business_day:'2026-11-01',currency:'USD',signature:'a'.repeat(64),entries,next_after});
test('report collection preserves exact entries across pages and verifies the final source fingerprint before offering a file',async()=>{
  const value=await collectFinanceReport(report(),async after=>after?page([row(2)]):page([row(1)],row(1).id),async()=>report(),()=>true);
  assert.equal(value.entries.length,2);assert.equal(value.entries[0].amount_minor,'1010');assert.equal(value.report.period.received_minor,'2020');
});
test('scope changes, altered sources, cursor loops and incomplete reports never produce a usable partial export',async()=>{
  for(const read of [async()=>({...page([row(1)]),store_id:caseId}),async()=>({...page([row(1)]),signature:'b'.repeat(64)}),async()=>page([row(1)],caseId),async()=>page([row(1)])]){
    await assert.rejects(collectFinanceReport(report(),read,async()=>report(),()=>true));
  }
  await assert.rejects(collectFinanceReport(report(),async()=>page([row(1),row(2)]),async()=>({...report(),period:{...report().period,signature:'b'.repeat(64)}}),()=>true));
  let current=true;await assert.rejects(collectFinanceReport(report(),async()=>{current=false;return page([row(1),row(2)]);},async()=>report(),()=>current));
});
test('oversized report collection stops with a support path instead of truncating the result',async()=>{
  let offset=0;await assert.rejects(collectFinanceReport(report('5001'),async()=>{const entries=Array.from({length:Math.min(100,5001-offset)},(_,i)=>row(offset+i+1));offset+=entries.length;return page(entries,offset<5001?entries.at(-1).id:null);},async()=>report('5001'),()=>true),/support-assisted/);
});
