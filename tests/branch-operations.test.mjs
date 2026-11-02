import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { createTestDatabase, asRole } from '../scripts/test-database.mjs';
let db;
before(async () => { db = await createTestDatabase(); });
after(async () => { await db?.close(); });
async function fixture() {
  const f = Object.fromEntries(['staff','customer','other','admin','branch','second','disabled'].map(key => [key,randomUUID()]));
  for (const id of [f.staff,f.customer,f.other,f.admin]) await db.query('INSERT INTO auth.users(id,email) VALUES($1,$2)',[id,`${id}@fixture.test`]);
  for (const branch of [f.branch,f.second,f.disabled]) await db.query(`INSERT INTO public.stores(id,name,address,distance_miles) VALUES($1,'Operations fixture','Test only',0)`,[branch]);
  await db.query(`INSERT INTO public.user_roles(user_id,role,staff_store_id) VALUES($1,'staff',$2),($3,'admin',NULL)`,[f.staff,f.branch,f.admin]);
  await db.query('INSERT INTO public.staff_memberships(user_id,store_id) VALUES($1,$2)',[f.staff,f.branch]);
  for (const branch of [f.branch,f.second]) {
    await db.query('INSERT INTO public.cash_branch_cashiers(store_id,user_id,active) VALUES($1,$2,true)',[branch,f.admin]);
    await db.query(`INSERT INTO public.cash_order_settings(store_id,currency,enabled,pricing_approved,fulfilment_enabled,acceptance_minutes) VALUES($1,'USD',true,true,true,10)`,[branch]);
  }
  await db.query(`INSERT INTO public.cash_order_settings(store_id,currency) VALUES($1,'USD')`,[f.disabled]);
  f.category=(await db.query(`INSERT INTO public.menu_categories(name) VALUES('Operations fixture') RETURNING id`)).rows[0].id;
  f.item=(await db.query(`INSERT INTO public.menu_items(category_id,name,price) VALUES($1,'Shared fixture meal',10) RETURNING id`,[f.category])).rows[0].id;
  f.foreign=(await db.query(`INSERT INTO public.menu_items(category_id,name,price,store_id) VALUES($1,'Foreign fixture meal',10,$2) RETURNING id`,[f.category,f.second])).rows[0].id;
  return f;
}
const rpc = async (actor, name, args=[], aal='aal2', role='authenticated') => asRole(db,role,actor,async()=>{
  const result=await db.query(`SELECT public.${name}(${args.map((_,i)=>`$${i+1}`).join(',')}) AS value`,args);
  return result.rows[0].value;
},{aal,amr:[{method:'password',timestamp:Math.floor(Date.now()/1000)}]});
const command=(f,version,value,action='intake',item=null,id=randomUUID(),actor=f.staff,reason='Shift operations fixture')=>rpc(actor,'operate_branch',[id,f.branch,version,action,value,reason,item]);
const quote=(f,branch=f.branch,item=f.item)=>rpc(f.customer,'quote_cash_order',[JSON.stringify({store_id:branch,fulfilment_mode:'collection',contact:{name:'Fixture Customer',phone:'+263771234567'},address:null,lines:[{menu_item_id:item,quantity:1,choice_ids:[]}]})],'aal1');
const place=(f,q,key=randomUUID())=>rpc(f.customer,'place_cash_order',[q.quote_id,key],'aal1');

test('branch controls require current branch membership and MFA; customers and service role cannot execute them',async()=>{
  const f=await fixture();
  for(const actor of [f.customer,f.other]) {
    await assert.rejects(rpc(actor,'get_branch_operations',[f.branch]),{code:'42501'});
    await assert.rejects(command(f,0,true,'intake',null,randomUUID(),actor),{code:'42501'});
    await assert.rejects(rpc(actor,'list_branch_menu',[f.branch]),{code:'42501'});
    await assert.rejects(rpc(actor,'branch_operations_history',[f.branch]),{code:'42501'});
  }
  await assert.rejects(rpc(f.staff,'get_branch_operations',[f.branch],'aal1'),{code:'42501'});
  await assert.rejects(rpc(f.staff,'operate_branch',[randomUUID(),f.branch,0,'intake',true,'Fixture pause',null],'aal1'),{code:'42501'});
  await assert.rejects(rpc(f.staff,'get_branch_operations',[f.second]),{code:'42501'});
  for(const role of ['anon','service_role']) await assert.rejects(rpc(null,'get_branch_operations',[f.branch],'aal2',role),{code:'42501'});
  assert.equal((await rpc(f.admin,'get_branch_operations',[f.second])).store_id,f.second);
});

test('intake pause invalidates new quotes and unsubmitted quotes while received orders and their retries remain resolvable',async()=>{
  const f=await fixture(); const q=await quote(f); const acceptedQuote=await quote(f); const key=randomUUID();
  const order=await place(f,acceptedQuote,key);
  await command(f,0,true);
  await assert.rejects(quote(f),{code:'22023'});
  await assert.rejects(place(f,q),{code:'22023'});
  assert.equal((await place(f,acceptedQuote,key)).order_id,order.order_id);
  const accepted=await rpc(f.staff,'operate_cash_order',[order.order_id,randomUUID(),0,'accept','{}']);
  assert.equal(accepted.status,'accepted');
  await command(f,1,false);
  assert.ok((await quote(f)).quote_id);
});

test('resuming cannot grant launch, pricing, fulfilment, opening or cashier approval',async()=>{
  const f=await fixture();
  await rpc(f.admin,'operate_branch',[randomUUID(),f.disabled,0,'intake',false,'Fixture resume',null]);
  const status=await rpc(f.admin,'get_branch_operations',[f.disabled]);
  assert.equal(status.enabled,false); assert.equal(status.pricing_approved,false); assert.equal(status.fulfilment_enabled,false);
  await assert.rejects(quote(f,f.disabled),{code:'22023'});
  await command(f,0,false);
  await db.query('UPDATE public.stores SET is_open=false WHERE id=$1',[f.branch]);
  await assert.rejects(quote(f),{code:'22023'});
});

test('shared menu item pauses are branch-specific and rechecked at submission',async()=>{
  const f=await fixture(); const q=await quote(f);
  await command(f,0,false,'availability',f.item);
  await assert.rejects(quote(f),{code:'22023'}); await assert.rejects(place(f,q),{code:'22023'});
  assert.ok((await quote(f,f.second)).quote_id);
  assert.equal((await db.query('SELECT is_available FROM public.menu_items WHERE id=$1',[f.item])).rows[0].is_available,true);
  const menu=await rpc(f.staff,'list_branch_menu',[f.branch]);
  assert.equal(menu.items.find(row=>row.id===f.item).branch_available,false);
  assert.equal(menu.items.some(row=>row.id===f.foreign),false);
  await assert.rejects(command(f,0,false,'availability',f.foreign),{code:'22023'});
  await command(f,1,true,'availability',f.item);
  assert.ok((await place(f,q)).order_id);
});

test('restoring branch availability cannot override a globally disabled item or category',async()=>{
  const f=await fixture(); await command(f,0,true,'availability',f.item);
  await db.query('UPDATE public.menu_items SET is_available=false WHERE id=$1',[f.item]);
  await assert.rejects(quote(f),{code:'22023'});
  await db.query('UPDATE public.menu_items SET is_available=true WHERE id=$1',[f.item]);
  await db.query('UPDATE public.menu_categories SET is_active=false WHERE id=$1',[f.category]);
  await assert.rejects(quote(f),{code:'22023'});
});

test('lost-response retry returns the original receipt without undoing a newer pause or availability change',async()=>{
  const f=await fixture(); const id=randomUUID(); const original=await command(f,0,true,'intake',null,id);
  await command(f,1,false);
  assert.deepEqual(await command(f,0,true,'intake',null,id),original);
  assert.equal((await rpc(f.staff,'get_branch_operations',[f.branch])).paused,false);
  await assert.rejects(command(f,0,false,'intake',null,id),{code:'22023'});
  await assert.rejects(command(f,0,true,'intake',null,id,f.admin),{code:'22023'});
  const itemId=randomUUID(); const stock=await command(f,0,false,'availability',f.item,itemId);
  await command(f,1,true,'availability',f.item);
  assert.deepEqual(await command(f,0,false,'availability',f.item,itemId),stock);
  assert.equal((await db.query('SELECT available FROM public.branch_menu_availability WHERE store_id=$1 AND menu_item_id=$2',[f.branch,f.item])).rows[0].available,true);
});

test('versions, NULLs and malformed commands fail without partial changes or audit receipts',async()=>{
  const f=await fixture();
  await command(f,0,true);
  await assert.rejects(command(f,0,false),{code:'40001'});
  for(const args of [
    [randomUUID(),f.branch,null,'intake',false,'Fixture pause',null],
    [randomUUID(),f.branch,1,'intake',null,'Fixture pause',null],
    [randomUUID(),f.branch,1,'intake',false,'x',null],
    [randomUUID(),f.branch,1,'intake',false,'Fixture pause',f.item],
    [randomUUID(),f.branch,0,'availability',true,'Fixture pause',null],
    [randomUUID(),f.branch,1,'price',false,'Fixture pause',null],
  ]) await assert.rejects(rpc(f.staff,'operate_branch',args),{code:'22023'});
  assert.equal((await db.query('SELECT count(*)::int AS n FROM public.branch_operation_commands WHERE store_id=$1',[f.branch])).rows[0].n,1);
  assert.equal((await rpc(f.staff,'get_branch_operations',[f.branch])).version,1);
});

test('revoked or processing accounts cannot use stale command references to change branch state',async()=>{
  const f=await fixture(); const id=randomUUID(); await command(f,0,true,'intake',null,id);
  await db.query('UPDATE public.staff_memberships SET active=false WHERE user_id=$1',[f.staff]);
  await assert.rejects(command(f,0,true,'intake',null,id),{code:'42501'});
  await db.query('UPDATE public.staff_memberships SET active=true WHERE user_id=$1',[f.staff]);
  await db.query(`INSERT INTO public.privacy_requests(id,user_id,kind,status) VALUES($1,$2,'deletion','processing')`,[randomUUID(),f.staff]);
  await assert.rejects(command(f,1,false),{code:'42501'});
});

test('direct writes and audit mutation are denied; public availability exposes no reasons or actor identities',async()=>{
  const f=await fixture(); await command(f,0,false,'availability',f.item);
  for(const role of ['anon','authenticated','service_role']) await asRole(db,role,role==='authenticated'?f.staff:null,async()=>{
    await assert.rejects(db.query('UPDATE public.branch_menu_availability SET available=true'),{code:'42501'});
    await assert.rejects(db.query('DELETE FROM public.branch_operation_commands'),{code:'42501'});
  });
  await assert.rejects(db.query(`UPDATE public.branch_operation_commands SET reason='Changed' WHERE store_id=$1`,[f.branch]),{code:'42501'});
  await asRole(db,'anon',null,async()=>{
    const row=(await db.query('SELECT * FROM public.branch_menu_availability WHERE store_id=$1 AND menu_item_id=$2',[f.branch,f.item])).rows[0];
    assert.deepEqual(Object.keys(row).sort(),['available','menu_item_id','store_id','version']);
  });
});

test('menu pagination and equal-time history cursors do not skip or repeat rows',async()=>{
  const f=await fixture();
  await db.query(`INSERT INTO public.menu_items(category_id,name,price,store_id) SELECT $1,'Fixture item '||n,1,$2 FROM generate_series(1,110) n`,[f.category,f.branch]);
  const ids=[]; let after=null;
  do { const page=await rpc(f.staff,'list_branch_menu',[f.branch,after,20]); ids.push(...page.items.map(row=>row.id)); after=page.next_after; } while(after);
  const expected=(await db.query('SELECT id FROM public.menu_items WHERE store_id=$1 OR store_id IS NULL ORDER BY id',[f.branch])).rows.map(row=>row.id);
  assert.deepEqual(ids,expected);
  await assert.rejects(rpc(f.staff,'list_branch_menu',[f.branch,null,101]),{code:'22023'});
  await db.exec('BEGIN');
  try { for(let i=0;i<51;i++) await command(f,i,i%2===0); await db.exec('COMMIT'); }
  catch(error) { await db.exec('ROLLBACK'); throw error; }
  const first=await rpc(f.staff,'branch_operations_history',[f.branch]); const last=first.at(-1);
  const second=await rpc(f.staff,'branch_operations_history',[f.branch,last.created_at,last.id]);
  assert.equal(first.length,50); assert.equal(second.length,1); assert.equal(new Set([...first,...second].map(row=>row.id)).size,51);
  await assert.rejects(rpc(f.staff,'branch_operations_history',[f.branch,last.created_at,null]),{code:'22023'});
});

test('attention counts the full pending queue including entries beyond a displayed page, without customer payloads',async()=>{
  const f=await fixture(); const orderIds=[];
  for(let i=0;i<101;i++) orderIds.push((await place(f,await quote(f))).order_id);
  await db.query(`UPDATE public.orders SET acceptance_deadline=now()-interval '1 minute' WHERE id=$1`,[orderIds[0]]);
  const snapshot=await rpc(f.staff,'get_branch_operations',[f.branch]);
  assert.equal(snapshot.pending.count,101); assert.equal(snapshot.pending.overdue_count,1);
  const serialised=JSON.stringify(snapshot);
  assert.ok(!serialised.includes('Fixture Customer')); assert.ok(!serialised.includes('+263')); assert.ok(!serialised.includes(orderIds[0]));
  await rpc(f.staff,'operate_cash_order',[orderIds[0],randomUUID(),0,'expire','{}']);
  const updated=await rpc(f.staff,'get_branch_operations',[f.branch]);
  assert.equal(updated.pending.count,100); assert.notEqual(updated.pending.signal,snapshot.pending.signal);
});

test('staff export includes only their own branch-command summaries and omits internal reasons and other operators',async()=>{
  const f=await fixture(); await command(f,0,true); await command(f,1,false,'intake',null,randomUUID(),f.admin,'Another operator internal reason');
  const request=await rpc(f.staff,'submit_privacy_request',[randomUUID(),'export']);
  const page=await rpc(f.staff,'export_privacy_section',[request.id,'branch_operations',null,100]);
  assert.equal(page.rows.length,1); assert.equal(page.rows[0].store_id,f.branch);
  assert.ok(!JSON.stringify(page).includes('reason')); assert.ok(!JSON.stringify(page).includes(f.admin));
});
