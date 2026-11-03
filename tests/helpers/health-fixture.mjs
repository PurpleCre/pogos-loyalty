import {randomUUID} from 'node:crypto';
// Synthetic owner-level fixtures only. They are never production activation or
// a simulation of physical cash, actual GAAP documents or real notifications.
export async function seedHealthFixture(db){
  const f=Object.fromEntries(['user','branch','second','device','event','offer','reward'].map(name=>[name,randomUUID()]));
  await db.query('INSERT INTO auth.users(id,email) VALUES($1,$2)',[f.user,'private-health-fixture@example.test']);
  for(const branch of [f.branch,f.second])await db.query(`INSERT INTO public.stores(id,name,address,distance_miles) VALUES($1,'Private fixture branch','Private address',0)`,[branch]);
  await db.query(`INSERT INTO public.rewards(id,name,points_cost,category) VALUES($1,'Private fixture benefit',10,'food')`,[f.reward]);
  await db.query(`INSERT INTO public.reward_branch_offers(id,store_id,reward_id,name,terms,gaap_product_reference,points_cost,reservation_minutes)
    VALUES($1,$2,$3,'Private benefit','Fixture only','PRIVATE-PRODUCT',10,10)`,[f.offer,f.branch,f.reward]);
  await db.query(`INSERT INTO public.push_devices(id,secret_hash,user_id,expo_token,project_id,platform,aal2,expires_at)
    VALUES($1,'private-secret-hash',$2,'ExpoPushToken[private_fixture]',$3,'android',true,now()+interval '1 day')`,[f.device,f.user,randomUUID()]);
  await db.query(`INSERT INTO public.notification_events(id,source_id,kind,recipient_id,store_id)
    VALUES($1,$2,'branch',$3,$4)`,[f.event,randomUUID(),f.user,f.branch]);
  f.order=async({status='pending',payment='unpaid',due=true,branch=f.branch}={})=>(await db.query(`
    INSERT INTO public.orders(user_id,store_id,total_amount,status,payment_method,payment_status,acceptance_deadline)
    VALUES($1,$2,10,$3,'cash',$4,now()+CASE WHEN $5 THEN interval '-10 minutes' ELSE interval '10 minutes' END) RETURNING id`,[f.user,branch,status,payment,due])).rows[0].id;
  f.reservation=async({status='reserved',due=true}={})=>(await db.query(`
    INSERT INTO public.reward_reservations(user_id,store_id,offer_id,points_cost,snapshot,customer_name,status,expires_at)
    VALUES($1,$2,$3,10,'{"private":"snapshot"}','Private customer',$4,now()+CASE WHEN $5 THEN interval '-10 minutes' ELSE interval '10 minutes' END) RETURNING id`,[f.user,f.branch,f.offer,status,due])).rows[0].id;
  f.delivery=async({state='queued',due=true,leasePast=true,age='10 minutes'}={})=>(await db.query(`
    INSERT INTO public.push_deliveries(event_id,device_id,device_version,state,available_at,lease_until,updated_at)
    VALUES($1,$2,1,$3,now()+CASE WHEN $4 THEN interval '-10 minutes' ELSE interval '10 minutes' END,
      now()+CASE WHEN $5 THEN interval '-10 minutes' ELSE interval '10 minutes' END,now()-$6::interval) RETURNING id`,[f.event,f.device,state,due,leasePast,age])).rows[0].id;
  // Each delivery needs its own event/device pair under the production unique key.
  f.nextEvent=async()=>{f.event=randomUUID();await db.query(`INSERT INTO public.notification_events(id,source_id,kind,recipient_id,store_id)
    VALUES($1,$2,'branch',$3,$4)`,[f.event,randomUUID(),f.user,f.branch]);};
  return f;
}
export const syntheticHealthPolicy=signals=>({max_snapshot_age_seconds:60,rules:Object.fromEntries(signals.map(name=>[name,{warning_count:1,critical_count:2,warning_age_seconds:null,critical_age_seconds:null}]))});
