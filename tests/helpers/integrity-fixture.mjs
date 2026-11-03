export const syntheticIntegrityPolicy=()=>({max_snapshot_age_seconds:60,rules:{
  loyalty_mismatches:{warning_count:1,critical_count:1,warning_age_seconds:null,critical_age_seconds:null},
  push_materialisation_due:{warning_count:1,critical_count:2,warning_age_seconds:60,critical_age_seconds:300},
}});
export const emptyIntegritySnapshot=now=>({schema_version:1,scope:'all-branches',coverage:'loyalty-and-push-materialisation',observed_at:new Date(now).toISOString(),push_enabled:true,
  metrics:{loyalty_mismatches:{count:0,clipped:false},push_materialisation_due:{count:0,clipped:false,oldest_age_seconds:null}}});
import {randomUUID} from 'node:crypto';
import {seedHealthFixture} from './health-fixture.mjs';


export async function seedIntegrityFixture(db){
  const f=await seedHealthFixture(db);f.orderId=await f.order({status:'completed',payment:'paid'});
  f.project=(await db.query('SELECT project_id FROM public.push_devices WHERE id=$1',[f.device])).rows[0].project_id;
  await db.query(`UPDATE public.push_settings SET enabled=true,expo_project_id=$1,enabled_since=now()-interval '2 hours'`,[f.project]);
  await db.query(`UPDATE public.push_devices SET bound_at=now()-interval '1 hour' WHERE id=$1`,[f.device]);
  await db.query(`UPDATE public.notification_events SET kind='order',order_id=$1,created_at=now()-interval '10 minutes',expires_at=now()+interval '20 minutes' WHERE id=$2`,[f.orderId,f.event]);
  f.fund=async(points='100')=>{
    const rule=(await db.query(`INSERT INTO public.cash_loyalty_rules(store_id,currency,basis,points_per_unit,spend_unit_minor,max_points,active) VALUES($1,'USD','subtotal',1,100,1000,false) RETURNING id`,[f.branch])).rows[0].id;
    await db.query(`INSERT INTO public.loyalty_ledger(user_id,order_id,event_key,kind,points_delta,rule_id) VALUES($1,$2,$3,'earn',$4,$5)`,[f.user,f.orderId,`synthetic:${randomUUID()}`,points,rule]);
  };
  return f;
}
