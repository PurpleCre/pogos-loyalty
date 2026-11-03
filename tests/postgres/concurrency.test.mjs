import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {connect,initialise,fixture,asActor,sessions,start,blocked,success,rpc,quote,ready,cashDetails,funded,offer,committed,customer} from './fixture.mjs';
let db;
before(async()=>{db=await connect();await initialise(db);});
after(async()=>{await db?.end();});
test('transactional migration replay reaches the expected inventory with all activations off',async()=>{
  assert.equal((await db.query(`SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`)).rows[0].n,71);
  assert.deepEqual((await db.query(`SELECT deletion_processing_enabled,application_erasure_enabled FROM public.privacy_settings`)).rows[0],{deletion_processing_enabled:false,application_erasure_enabled:false});
  assert.equal((await db.query(`SELECT enabled FROM public.push_settings`)).rows[0].enabled,false);
});
test('simultaneous identical checkout keys create one order and recover the committed result',async()=>{
  const f=await fixture(db),q=await quote(db,f),key=randomUUID();
  await sessions(async(a,b)=>{
    await asActor(a,f.customer);await asActor(b,f.customer);
    const first=await rpc(a,'place_cash_order',[q.quote_id,key]);
    const pending=start(rpc(b,'place_cash_order',[q.quote_id,key]));await blocked(db,pending,b,a);
    await a.query('COMMIT');assert.deepEqual(await success(pending),first);await b.query('COMMIT');
    assert.equal((await db.query(`SELECT count(*)::int AS n FROM public.orders WHERE user_id=$1 AND submission_key=$2`,[f.customer,key])).rows[0].n,1);
  });
});
test('concurrent cash handover retries retain one receipt, earning, movement and command',async()=>{
  const f=await fixture(db),order=await ready(db,f),key=randomUUID(),details=cashDetails();
  await sessions(async(a,b)=>{
    await asActor(a,f.staff);await asActor(b,f.staff);
    const first=await rpc(a,'operate_cash_order',[order,key,3,'complete',details]);
    const pending=start(rpc(b,'operate_cash_order',[order,key,3,'complete',details]));await blocked(db,pending,b,a);
    await a.query('COMMIT');assert.deepEqual(await success(pending),first);await b.query('COMMIT');
  });
  for(const [table,condition]of [['cash_receipts',''],['loyalty_ledger'," AND kind='earn'"],['cash_movements'," AND event_type='received'"]])assert.equal((await db.query(`SELECT count(*)::int AS n FROM public.${table} WHERE order_id=$1${condition}`,[order])).rows[0].n,1);
  assert.equal((await db.query(`SELECT current_points FROM public.user_points WHERE user_id=$1`,[f.customer])).rows[0].current_points,'100');
});
test('different cash commands competing on one version cannot both complete',async()=>{
  const f=await fixture(db),order=await ready(db,f);
  await sessions(async(a,b)=>{
    await asActor(a,f.staff);await asActor(b,f.cashier);
    await rpc(a,'operate_cash_order',[order,randomUUID(),3,'complete',cashDetails()]);
    const pending=start(rpc(b,'operate_cash_order',[order,randomUUID(),3,'complete',cashDetails()]));await blocked(db,pending,b,a);
    await a.query('COMMIT');assert.equal((await pending.result).error?.code,'40001');
  });
  assert.equal((await db.query(`SELECT count(*)::int AS n FROM public.cash_receipts WHERE order_id=$1`,[order])).rows[0].n,1);
});
test('competing reward holds cannot overspend the same real PostgreSQL account',async()=>{
  const f=await fixture(db);await funded(db,f);const item=await offer(db,f);
  await sessions(async(a,b)=>{
    await asActor(a,f.customer);await asActor(b,f.customer);
    await rpc(a,'reserve_reward',[item,randomUUID()]);
    const pending=start(rpc(b,'reserve_reward',[item,randomUUID()]));await blocked(db,pending,b,a);
    await a.query('COMMIT');assert.equal((await pending.result).error?.code,'22023');
  });
  assert.deepEqual((await db.query(`SELECT current_points,reserved_points FROM public.user_points WHERE user_id=$1`,[f.customer])).rows[0],{current_points:'30',reserved_points:'70'});
});
test('different customers cannot both reserve the last branch reward unit',async()=>{
  const f=await fixture(db);await funded(db,f);const other=await customer(db);await funded(db,{...f,customer:other});const item=await offer(db,f,{stock:1});
  await sessions(async(a,b)=>{
    await asActor(a,f.customer);await asActor(b,other);await rpc(a,'reserve_reward',[item,randomUUID()]);
    const pending=start(rpc(b,'reserve_reward',[item,randomUUID()]));await blocked(db,pending,b,a);
    await a.query('COMMIT');assert.equal((await pending.result).error?.code,'22023');
  });
  assert.equal((await db.query(`SELECT available_units FROM public.reward_branch_offers WHERE id=$1`,[item])).rows[0].available_units,'0');
  assert.equal((await db.query(`SELECT current_points FROM public.user_points WHERE user_id=$1`,[other])).rows[0].current_points,'100');
});
test('finance submission waits for an in-flight posting and reads the committed source',async()=>{
  const f=await fixture(db),order=await ready(db,f),id=randomUUID();
  await sessions(async(a,b)=>{
    await asActor(a,f.staff);await asActor(b,f.finance);
    await rpc(a,'operate_cash_order',[order,randomUUID(),3,'complete',cashDetails()]);
    const pending=start(rpc(b,'submit_finance_reconciliation',[id,f.branch,f.day,'USD',{received_minor:'0',refunded_minor:'0',settled_minor:'0'},'Synthetic independent till observation']));
    await blocked(db,pending,b,a);await a.query('COMMIT');assert.equal((await success(pending)).status,'variance');await b.query('COMMIT');
  });
  assert.equal((await db.query(`SELECT snapshot->>'received_minor' AS amount FROM public.finance_reconciliations WHERE id=$1`,[id])).rows[0].amount,'10000');
});
test('competing independent reviewers cannot accept the same stale case version twice',async()=>{
  const f=await fixture(db),id=randomUUID();
  await committed(db,f.admin,'submit_finance_reconciliation',[id,f.branch,f.day,'USD',{received_minor:'0',refunded_minor:'0',settled_minor:'0'},'Synthetic till evidence']);
  await sessions(async(a,b)=>{
    await asActor(a,f.finance);await asActor(b,f.reviewer);
    await rpc(a,'review_finance_reconciliation',[id,randomUUID(),0,true,'Synthetic independent review']);
    const pending=start(rpc(b,'review_finance_reconciliation',[id,randomUUID(),0,true,'Other synthetic independent review']));
    await blocked(db,pending,b,a);await a.query('COMMIT');assert.equal((await pending.result).error?.code,'40001');
  });
  assert.equal((await db.query(`SELECT count(*)::int AS n FROM public.finance_reconciliation_events WHERE reconciliation_id=$1 AND action='accepted'`,[id])).rows[0].n,1);
});
async function deletion(f){
  await db.query(`INSERT INTO public.privacy_reviewers(user_id) VALUES($1)`,[f.admin]);
  await db.query(`INSERT INTO public.privacy_notices(version,controller_name,body,support_email,approval_reference,approved_by,approved_at) VALUES('concurrency-fixture','Synthetic controller','Synthetic notice for disposable concurrency testing only.','privacy@acceptance.invalid','synthetic-only','Synthetic reviewer',now()) ON CONFLICT DO NOTHING`);
  await db.query(`INSERT INTO public.privacy_retention_approvals(version,policy_reference,approved_by,approved_at) VALUES('concurrency-fixture','synthetic-only','Synthetic reviewer',now()) ON CONFLICT DO NOTHING`);
  await db.query(`UPDATE public.privacy_settings SET active_notice_version='concurrency-fixture',retention_policy_version='concurrency-fixture',deletion_processing_enabled=true`);
  return committed(db,f.customer,'submit_privacy_request',[randomUUID(),'deletion']);
}
test('privacy start waits for checkout and then retains the newly committed active order',async()=>{
  const f=await fixture(db),request=await deletion(f),q=await quote(db,f);
  await sessions(async(a,b)=>{
    await asActor(a,f.customer);await asActor(b,f.admin);const placed=await rpc(a,'place_cash_order',[q.quote_id,randomUUID()]);
    const pending=start(rpc(b,'review_privacy_deletion',[request.id,request.version,'start','Synthetic race review']));
    await blocked(db,pending,b,a);await a.query('COMMIT');const result=await success(pending);assert.equal(result.blocker,'active_orders');await b.query('COMMIT');
    assert.equal((await db.query(`SELECT status FROM public.orders WHERE id=$1`,[placed.order_id])).rows[0].status,'pending');
  });
});
test('checkout waiting behind approved processing cannot create an order afterward',async()=>{
  const f=await fixture(db),request=await deletion(f),q=await quote(db,f);
  await sessions(async(a,b)=>{
    await asActor(a,f.admin);await asActor(b,f.customer);
    assert.equal((await rpc(a,'review_privacy_deletion',[request.id,request.version,'start','Synthetic processing start'])).status,'processing');
    const pending=start(rpc(b,'place_cash_order',[q.quote_id,randomUUID()]));await blocked(db,pending,b,a);
    await a.query('COMMIT');assert.equal((await pending.result).error?.code,'42501');
  });
  assert.equal((await db.query(`SELECT count(*)::int AS n FROM public.orders WHERE user_id=$1`,[f.customer])).rows[0].n,0);
});
test('expiry workers skip another session’s leased order instead of double-expiring or blocking',async()=>{
  const f=await fixture(db),orders=[];
  for(let i=0;i<2;i++){const q=await quote(db,f);orders.push((await committed(db,f.customer,'place_cash_order',[q.quote_id,randomUUID()])).order_id);}
  await db.query(`UPDATE public.orders SET acceptance_deadline=clock_timestamp()-interval '1 minute' WHERE id=ANY($1::uuid[])`,[orders]);
  await sessions(async(a,b)=>{
    await asActor(a,null,'service_role');await asActor(b,null,'service_role');
    assert.equal(await rpc(a,'expire_pending_cash_orders',[1]),1);
    const pending=start(rpc(b,'expire_pending_cash_orders',[1]));
    assert.equal(await Promise.race([success(pending),delay(4000,undefined,{ref:false}).then(()=>assert.fail('Expiry worker blocked instead of skipping the locked row'))]),1);
    await b.query('COMMIT');await a.query('COMMIT');
  });
  assert.equal((await db.query(`SELECT count(*)::int AS n FROM public.order_status_events WHERE order_id=ANY($1::uuid[]) AND event_type='expired'`,[orders])).rows[0].n,2);
});
async function pushFixture({materialized=true}={}){
  const f=await fixture(db),project=randomUUID(),jobs=[];
  await db.query(`UPDATE public.push_settings SET enabled=true,expo_project_id=$1,enabled_since=clock_timestamp()-interval '5 minutes'`,[project]);
    for(let i=0;i<2;i++){
      const user=await customer(db),order=randomUUID(),device=randomUUID(),event=randomUUID(),job=randomUUID();jobs.push(job);
      await db.query(`INSERT INTO public.orders(id,user_id,store_id,status,total_amount) VALUES($1,$2,$3,'completed',1)`,[order,user,f.branch]);
      await db.query(`INSERT INTO public.push_devices(id,secret_hash,user_id,project_id,platform,expo_token,active,aal2,bound_at,expires_at) VALUES($1,'synthetic-proof',$2,$3,'android',$4,true,false,clock_timestamp()-interval '1 minute',clock_timestamp()+interval '1 day')`,[device,user,project,`ExpoPushToken[synthetic_${device.replaceAll('-','')}]`]);
      await db.query(`INSERT INTO public.notification_events(id,source_id,kind,recipient_id,store_id,order_id) VALUES($1,$2,'order',$3,$4,$5)`,[event,randomUUID(),user,f.branch,order]);
      if(materialized)await db.query(`INSERT INTO public.push_deliveries(id,event_id,device_id,device_version) VALUES($1,$2,$3,1)`,[job,event,device]);
    }
  return jobs;
}
test('push workers lease disjoint committed jobs and a competing dispatch fence cannot send twice',async()=>{
  const jobs=await pushFixture();
  try{
    let leased;
    await sessions(async(a,b)=>{
      await asActor(a,null,'service_role');await asActor(b,null,'service_role');
      const first=await rpc(a,'claim_push_deliveries',[1]);assert.equal(first.length,1);leased=first[0];
      const pending=start(rpc(b,'claim_push_deliveries',[1]));
      const next=await Promise.race([success(pending),delay(4000,undefined,{ref:false}).then(()=>assert.fail('Push worker blocked instead of skipping the leased job'))]);
      assert.equal(next.length,1);assert.notEqual(next[0].id,leased.id);assert.ok(jobs.includes(next[0].id));
      await b.query('COMMIT');await a.query('COMMIT');
    });
    await sessions(async(a,b)=>{
      await asActor(a,null,'service_role');await asActor(b,null,'service_role');
      assert.ok(await rpc(a,'prepare_push_dispatch',[leased.id,leased.claim_id]));
      const pending=start(rpc(b,'prepare_push_dispatch',[leased.id,leased.claim_id]));await blocked(db,pending,b,a);
      await a.query('COMMIT');assert.equal(await success(pending),null);await b.query('COMMIT');
    });
  }finally{await db.query(`UPDATE public.push_settings SET enabled=false`);}
});
test('simultaneous push materialisation skips uncommitted pairs without blocking or duplicating jobs',async()=>{
  await pushFixture({materialized:false});
  try{
    await sessions(async(a,b)=>{
      await asActor(a,null,'service_role');await asActor(b,null,'service_role');
      const first=await rpc(a,'claim_push_deliveries',[1]);assert.equal(first.length,1);
      const pending=start(rpc(b,'claim_push_deliveries',[1]));
      const next=await Promise.race([success(pending),delay(4000,undefined,{ref:false}).then(()=>assert.fail('Materialisation waited on another worker’s uncommitted pair'))]);
      assert.deepEqual(next,[]);await b.query('COMMIT');await a.query('COMMIT');
      await asActor(b,null,'service_role');const recovered=await rpc(b,'claim_push_deliveries',[1]);
      assert.equal(recovered.length,1);assert.notEqual(recovered[0].id,first[0].id);await b.query('COMMIT');
    });
  }finally{await db.query(`UPDATE public.push_settings SET enabled=false`);}
});
