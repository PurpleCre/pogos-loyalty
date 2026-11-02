import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {randomUUID} from 'node:crypto';
import {createTestDatabase,asRole} from '../scripts/test-database.mjs';
let db;
before(async()=>{db=await createTestDatabase();});after(async()=>{await db?.close();});
const rpc=(actor,name,args=[],aal='aal2',role='authenticated')=>asRole(db,role,actor,async()=>
  (await db.query(`SELECT public.${name}(${args.map((_,i)=>`$${i+1}`).join(',')}) AS value`,args)).rows[0].value,
  {aal,amr:[{method:'password',timestamp:Math.floor(Date.now()/1000)}]});
async function fixture(){const f=Object.fromEntries(['admin','manager','finance','reviewer','staff','customer','other','branch','second'].map(k=>[k,randomUUID()]));
  for(const id of [f.admin,f.manager,f.finance,f.reviewer,f.staff,f.customer,f.other])await db.query('INSERT INTO auth.users(id,email) VALUES($1,$2)',[id,`${id}@finance.test`]);
  for(const branch of [f.branch,f.second])await db.query(`INSERT INTO public.stores(id,name,address,distance_miles) VALUES($1,'Finance fixture','Test only',0)`,[branch]);
  await db.query(`INSERT INTO public.user_roles(user_id,role) VALUES($1,'admin'),($2,'manager'),($3,'finance'),($4,'finance'),($5,'staff'),($6,'manager')`,[f.admin,f.manager,f.finance,f.reviewer,f.staff,f.other]);
  for(const [user,branch]of [[f.manager,f.branch],[f.finance,f.branch],[f.reviewer,f.branch],[f.staff,f.branch],[f.other,f.second]])await db.query('INSERT INTO public.staff_memberships(user_id,store_id) VALUES($1,$2)',[user,branch]);
  await db.query('INSERT INTO public.cash_branch_cashiers(store_id,user_id,active) VALUES($1,$2,true)',[f.branch,f.staff]);
  await db.query(`INSERT INTO public.cash_order_settings(store_id,currency,enabled,pricing_approved,fulfilment_enabled,acceptance_minutes) VALUES($1,'USD',true,true,true,10)`,[f.branch]);
  const category=(await db.query(`INSERT INTO public.menu_categories(name) VALUES('Finance fixture') RETURNING id`)).rows[0].id;
  f.item=(await db.query(`INSERT INTO public.menu_items(category_id,store_id,name,price) VALUES($1,$2,'Fixture meal',10.10) RETURNING id`,[category,f.branch])).rows[0].id;
  f.day=(await db.query(`SELECT to_char(clock_timestamp() AT TIME ZONE 'Africa/Harare','YYYY-MM-DD') AS day`)).rows[0].day;return f;
}
async function pendingOrder(f){const quote=await rpc(f.customer,'quote_cash_order',[JSON.stringify({store_id:f.branch,fulfilment_mode:'collection',contact:{name:'Private customer',phone:'+263771234567'},address:null,lines:[{menu_item_id:f.item,quantity:1,choice_ids:[]}]})],'aal1');
  return rpc(f.customer,'place_cash_order',[quote.quote_id,randomUUID()],'aal1');}
async function paid(f){const created=await pendingOrder(f);let version=0;
  for(const action of ['accept','prepare','ready','complete']){const details=action==='complete'?{cash_received:true,handover_confirmed:true,cash_currency:'USD',tendered_minor:2000,sale_reference:`FIXTURE/${randomUUID()}`}:{ };
    await rpc(f.staff,'operate_cash_order',[created.order_id,randomUUID(),version++,action,JSON.stringify(details)]);}
  return created.order_id;
}
const report=(f,actor=f.finance,day=f.day,currency='USD',branch=f.branch)=>rpc(actor,'finance_branch_report',[branch,day,currency]);
const observed=r=>Object.fromEntries(['received_minor','refunded_minor','settled_minor'].map(k=>[k,r.period[k]]));
const submit=(f,values,id=randomUUID(),actor=f.manager,evidence='GAAP fixture app-linked report')=>rpc(actor,'submit_finance_reconciliation',[id,f.branch,f.day,'USD',JSON.stringify(values),evidence]);
const review=(f,entry,accept=true,actor=f.reviewer,id=randomUUID(),reason='Verified app-linked till evidence')=>rpc(actor,'review_finance_reconciliation',[entry.id,id,entry.version,accept,reason]);
async function rawMovement(f,{amount='100',currency='USD',date=null,type='received',branch=f.branch}={}){
  const order=(await db.query('INSERT INTO public.orders(user_id,store_id,total_amount) VALUES($1,$2,10) RETURNING id',[f.customer,branch])).rows[0].id;
  const id=randomUUID();await db.query(`INSERT INTO public.cash_movements(id,order_id,store_id,actor_id,event_type,amount_minor,currency,reference,created_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,coalesce($9::timestamptz,now()))`,[id,order,branch,f.staff,type,amount,currency,`SYNTHETIC/${randomUUID()}`,date]);return id;
}

test('manager and finance grants require admin MFA, distinct explicit branches and verified targets',async()=>{const f=await fixture();
  for(const actor of [f.manager,f.finance,f.customer])await assert.rejects(rpc(actor,'set_identity_access',[f.customer,'finance',[f.branch],'Not authorised']),{code:'42501'});
  await assert.rejects(rpc(f.admin,'set_identity_access',[f.customer,'finance',[f.branch],'Fixture grant'],'aal1'),{code:'42501'});
  for(const branches of [[],[f.branch,f.branch],[randomUUID()]])await assert.rejects(rpc(f.admin,'set_identity_access',[f.customer,'finance',branches,'Fixture grant']),{code:'22023'});
  await rpc(f.admin,'set_identity_access',[f.customer,'finance',[f.branch],'Approved fixture finance assignment']);
  assert.equal(await rpc(f.customer,'finance_branch_access',[f.branch]),true);assert.equal(await rpc(f.customer,'cash_staff_access',[f.branch,f.customer]),false);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM public.cash_branch_cashiers WHERE user_id=$1',[f.customer])).rows[0].n,0);
  assert.equal((await db.query(`SELECT count(*)::int AS n FROM public.identity_access_events WHERE subject_id=$1 AND action='set_access'`,[f.customer])).rows[0].n,1);
});
test('manager operations remain branch-scoped while finance cannot fulfil, read customer delivery data, edit menus or grant roles',async()=>{const f=await fixture();const id=await paid(f);
  assert.equal(await rpc(f.manager,'cash_staff_access',[f.branch,f.manager]),true);assert.equal(await rpc(f.manager,'cash_staff_access',[f.second,f.manager]),false);
  const pending=await pendingOrder(f);assert.equal((await rpc(f.manager,'operate_cash_order',[pending.order_id,randomUUID(),0,'accept','{}'])).status,'accepted');
  await rpc(f.manager,'operate_branch',[randomUUID(),f.branch,0,'intake',true,'Shift pause',null]);
  await assert.rejects(rpc(f.finance,'get_branch_operations',[f.branch]),{code:'42501'});
  await assert.rejects(rpc(f.finance,'operate_cash_order',[id,randomUUID(),4,'refund',JSON.stringify({})]),{code:'42501'});
  await assert.rejects(rpc(f.manager,'operate_cash_order',[id,randomUUID(),4,'refund',JSON.stringify({})]),{code:'42501'});
  await asRole(db,'authenticated',f.finance,async()=>{assert.deepEqual((await db.query('SELECT id,contact_snapshot FROM public.orders WHERE id=$1',[id])).rows,[]);});
  await asRole(db,'authenticated',f.manager,async()=>{assert.equal((await db.query('UPDATE public.menu_items SET price=1 WHERE id=$1 RETURNING id',[f.item])).rows.length,0);});
  assert.equal((await db.query('SELECT price FROM public.menu_items WHERE id=$1',[f.item])).rows[0].price,'10.10');
  for(const actor of [f.customer,f.staff,f.other])await assert.rejects(report(f,actor),{code:'42501'});
});
test('new privileged roles require MFA for reports, privacy, push and invitation acceptance',async()=>{const f=await fixture();
  for(const actor of [f.manager,f.finance]){
    await assert.rejects(rpc(actor,'finance_branch_report',[f.branch,f.day,'USD'],'aal1'),{code:'42501'});
    await assert.rejects(rpc(actor,'submit_privacy_request',[randomUUID(),'export'],'aal1'),{code:'42501'});
    await assert.rejects(rpc(actor,'my_notification_inbox',[],'aal1'),{code:'42501'});
    await assert.rejects(rpc(actor,'register_push_device',[randomUUID(),'a'.repeat(64),`ExpoPushToken[${randomUUID()}]`,randomUUID(),'android'],'aal1'),{code:'42501'});
    const blocked=await rpc(actor,'submit_privacy_request',[randomUUID(),'deletion']);assert.equal(blocked.blocker,'staff_access');
  }
  const invite=randomUUID();await rpc(f.admin,'invite_branch_staff',[invite,`${f.finance}@finance.test`,f.second,'Fixture invitation']);
  await assert.rejects(rpc(f.finance,'accept_staff_invitation',[invite]),{code:'42501'});
});
test('granting finance immediately revokes old cashier/operational authority and role revocation closes report access',async()=>{const f=await fixture();
  await rpc(f.admin,'set_identity_access',[f.staff,'finance',[f.branch],'Move to finance']);
  assert.equal((await db.query('SELECT active FROM public.cash_branch_cashiers WHERE user_id=$1',[f.staff])).rows[0].active,false);
  assert.equal(await rpc(f.staff,'cash_staff_access',[f.branch,f.staff]),false);assert.equal(await rpc(f.staff,'finance_branch_access',[f.branch]),true);
  await rpc(f.admin,'set_identity_access',[f.staff,'user',[],'Revoke finance']);
  await assert.rejects(report(f,f.staff),{code:'42501'});
  assert.equal(await rpc(f.customer,'has_role',[f.finance,'finance']),false);
});
test('cash reports use exact minor-unit strings, immutable cash events and separate USD/ZWG totals',async()=>{const f=await fixture();const id=await paid(f);
  await rpc(f.staff,'operate_cash_order',[id,randomUUID(),4,'settle_cash',JSON.stringify({cash_counted:true,till_reference:`TILL/${randomUUID()}`})]);
  let value=await report(f);assert.equal(value.period.received_minor,'1010');assert.equal(value.period.settled_minor,'1010');assert.equal(value.outstanding_all_dates_minor,'0');
  await rawMovement(f,{amount:'9007199254740993'});await rawMovement(f,{amount:'7000',currency:'ZWG'});
  value=await report(f);assert.equal(value.period.received_minor,'9007199254742003');assert.equal((await report(f,f.finance,f.day,'ZWG')).period.received_minor,'7000');
  assert.ok(!JSON.stringify(value).includes('Private customer'));assert.ok(!JSON.stringify(value).includes('+263'));assert.ok(!JSON.stringify(value).includes(f.customer));
  const entries=await rpc(f.finance,'finance_entries',[f.branch,f.day,'USD',value.period.signature,null,100]);
  assert.ok(entries.entries.every(row=>typeof row.amount_minor==='string'&&!('actor_id'in row)&&!('details'in row)));
});
test('Harare periods are half-open local days, independent of the connection timezone',async()=>{const f=await fixture();
  const day=(await db.query(`SELECT to_char((clock_timestamp() AT TIME ZONE 'Africa/Harare')::date-1,'YYYY-MM-DD') AS day`)).rows[0].day;
  const bounds=(await rpc(f.finance,'finance_branch_report',[f.branch,day,'USD'])).period;
  await rawMovement(f,{amount:'10',date:bounds.period_start});
  await rawMovement(f,{amount:'20',date:new Date(Date.parse(bounds.period_start)-1).toISOString()});
  await rawMovement(f,{amount:'30',date:bounds.period_end});
  const before=await report(f,f.finance,day);assert.equal(before.period.received_minor,'10');
  await db.exec(`SET TIME ZONE 'Pacific/Auckland'`);try{const after=await report(f,f.finance,day);assert.equal(after.period.signature,before.period.signature);assert.equal(after.period.received_minor,'10');}finally{await db.exec(`SET TIME ZONE 'UTC'`);}
});
test('a matching observation requires a separate scoped finance reviewer and preserves all financial records',async()=>{const f=await fixture();const id=await paid(f);const baseline=(await db.query('SELECT * FROM public.cash_receipts WHERE order_id=$1',[id])).rows;
  const r=await report(f);const entry=await submit(f,observed(r));assert.equal(entry.status,'matched');
  await assert.rejects(review(f,entry,true,f.manager),{code:'42501'});
  const own=await submit(f,observed(r),entry.id);assert.deepEqual(own,entry);
  const command=randomUUID();const accepted=await review(f,entry,true,f.reviewer,command);assert.equal(accepted.status,'accepted');
  assert.deepEqual(await review(f,entry,true,f.reviewer,command),accepted);
  assert.deepEqual((await db.query('SELECT * FROM public.cash_receipts WHERE order_id=$1',[id])).rows,baseline);
  assert.equal((await report(f)).latest_reconciliation.status,'accepted');
  await assert.rejects(submit(f,observed(r)),{code:'22023'});
});
test('finance users cannot approve their own observations and cross-branch reviewers cannot approve or recover a command',async()=>{const f=await fixture();await paid(f);const entry=await submit(f,observed(await report(f)),randomUUID(),f.finance);
  await assert.rejects(review(f,entry,true,f.finance),{code:'42501'});
  await assert.rejects(review(f,entry,true,f.other),{code:'42501'});
  const command=randomUUID();await review(f,entry,true,f.reviewer,command);
  await rpc(f.admin,'set_identity_access',[f.reviewer,'finance',[f.second],'Reassign finance scope']);
  await assert.rejects(review(f,entry,true,f.reviewer,command),{code:'42501'});
});
test('variance remains explicit and cannot be accepted as matching or used to adjust money or points',async()=>{const f=await fixture();await paid(f);const r=await report(f);const values={...observed(r),received_minor:'1000'};const entry=await submit(f,values);assert.equal(entry.status,'variance');
  await assert.rejects(review(f,entry,true),{code:'22023'});
  assert.equal((await report(f)).period.received_minor,'1010');
  const rejected=await review(f,entry,false);assert.equal(rejected.status,'rejected');
  const corrected=await submit(f,observed(r),randomUUID(),f.manager,'Corrected GAAP report');assert.equal(corrected.status,'matched');
  assert.equal((await rpc(f.finance,'list_finance_reconciliations',[f.branch]))[0].previous_id,entry.id);
});
test('changed sources mark an open case stale and previously accepted evidence is visibly out of date',async()=>{const f=await fixture();await paid(f);let r=await report(f);const original=await submit(f,observed(r));
  await rawMovement(f,{amount:'25'});const stale=await review(f,original,true);assert.equal(stale.status,'stale');
  r=await report(f);const replacement=await submit(f,observed(r),randomUUID(),f.manager,'Updated source report');await review(f,replacement,true);
  await rawMovement(f,{amount:'30'});const current=await report(f);assert.equal(current.latest_reconciliation.signature_current,false);
  const old=await rpc(f.finance,'list_finance_reconciliations',[f.branch]);assert.equal(old.find(row=>row.id===original.id).snapshot.received_minor,'1010');
});
test('new external evidence can reopen an accepted period without rewriting its original snapshot',async()=>{const f=await fixture();await paid(f);const r=await report(f);const original=await submit(f,observed(r));await review(f,original,true);
  const revised=await submit(f,{...observed(r),settled_minor:'1'},randomUUID(),f.manager,'Newly discovered till discrepancy');assert.equal(revised.status,'variance');
  const rows=await rpc(f.finance,'list_finance_reconciliations',[f.branch]);assert.equal(rows[0].previous_id,original.id);assert.equal(rows.find(row=>row.id===original.id).status,'accepted');assert.equal((await report(f)).latest_reconciliation.status,'variance');
});
test('command changes, malformed amounts, direct writes and audit rewriting fail without side effects',async()=>{const f=await fixture();const r=await report(f);const id=randomUUID();await submit(f,observed(r),id);
  await assert.rejects(submit(f,observed(r),id,f.manager,'Different evidence'),{code:'22023'});
  for(const values of [{...observed(r),received_minor:1},{...observed(r),received_minor:'01'},{...observed(r),received_minor:'-1'},{...observed(r),extra:'injection'}])await assert.rejects(submit(f,values),{code:'22023'});
  for(const role of ['anon','authenticated','service_role'])await asRole(db,role,role==='authenticated'?f.finance:null,async()=>{await assert.rejects(db.query(`UPDATE public.finance_reconciliations SET status='accepted'`),{code:'42501'});await assert.rejects(db.query('DELETE FROM public.finance_commands'),{code:'42501'});});
  await assert.rejects(db.query(`UPDATE public.finance_reconciliations SET evidence='Rewritten' WHERE id=$1`,[id]),{code:'42501'});
  await assert.rejects(db.query(`DELETE FROM public.finance_reconciliation_events`),{code:'42501'});
  await assert.rejects(rpc(f.finance,'finance_period_snapshot',[f.branch,f.day,'USD']),{code:'42501'});
});
test('export paging detects source changes, and chain-wide account totals remain administrator-only without currency valuation',async()=>{const f=await fixture();await rawMovement(f,{amount:'10'});const r=await report(f);
  await rawMovement(f,{amount:'20'});await assert.rejects(rpc(f.finance,'finance_entries',[f.branch,f.day,'USD',r.period.signature,null,100]),{code:'40001'});
  await assert.rejects(rpc(f.finance,'finance_chain_points'),{code:'42501'});const totals=await rpc(f.admin,'finance_chain_points');assert.equal(totals.valuation_minor,null);assert.equal(totals.valuation_currency,null);assert.equal(typeof totals.spendable_points,'string');
});

test('a till-funded refund does not erase outstanding collector cash and net till movements reflect actual acknowledgements',async()=>{const f=await fixture();const id=await paid(f);
  await rpc(f.admin,'operate_cash_order',[id,randomUUID(),4,'refund',JSON.stringify({refund_confirmed:true,refund_source:'till',credit_note_reference:`CREDIT/${randomUUID()}`,reason:'Fixture full refund'})]);
  let r=await report(f);assert.equal(r.period.received_minor,'1010');assert.equal(r.period.refunded_minor,'1010');assert.equal(r.period.net_received_minor,'0');
  assert.equal(r.period.net_till_movement_minor,'-1010');assert.equal(r.outstanding_all_dates_minor,'1010');
  await rpc(f.staff,'operate_cash_order',[id,randomUUID(),5,'settle_cash',JSON.stringify({cash_counted:true,till_reference:`TILL/${randomUUID()}`})]);
  r=await report(f);assert.equal(r.period.net_till_movement_minor,'0');assert.equal(r.outstanding_all_dates_minor,'0');
});

test('period revision ordering cannot hide a newer variance behind an accepted case with the same transaction timestamp',async()=>{const f=await fixture();const r=await report(f);
  await db.exec('BEGIN');try{
    const original=await submit(f,observed(r),'f7770000-0000-4000-8000-000000000001');await review(f,original,true);
    const revised=await submit(f,{...observed(r),received_minor:'1'},'a7770000-0000-4000-8000-000000000001',f.manager,'Revised independent till evidence');
    const current=await report(f);assert.equal(current.latest_reconciliation.id,revised.id);assert.equal(current.latest_reconciliation.status,'variance');
    const rows=await rpc(f.finance,'list_finance_reconciliations',[f.branch]);assert.equal(rows.find(row=>row.id===revised.id).revision,2);
    await review(f,revised,false);
    const reaffirmed=await submit(f,observed(r),randomUUID(),f.manager,'GAAP fixture app-linked report');assert.equal(reaffirmed.status,'matched');
    await db.exec('COMMIT');
  }catch(error){await db.exec('ROLLBACK');throw error;}
});
