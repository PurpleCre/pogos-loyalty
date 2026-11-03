import assert from 'node:assert/strict';
import pg from 'pg';
import {randomUUID} from 'node:crypto';
import {readdir,readFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import {testDatabaseBootstrap} from '../../scripts/test-database.mjs';
import {validateAcceptanceConfig} from '../../scripts/postgres-acceptance-safety.mjs';

const config=validateAcceptanceConfig(JSON.parse(process.env.POGOS_ACCEPTANCE_CONFIG??'null'));
export async function connect(){
  const db=new pg.Client({...config,ssl:false,application_name:'pogos-disposable-acceptance',connectionTimeoutMillis:2000,
    options:'-c statement_timeout=10000 -c lock_timeout=8000 -c idle_in_transaction_session_timeout=20000 -c timezone=UTC'});
  try{await db.connect();db.pid=(await db.query('SELECT pg_backend_pid() AS id')).rows[0].id;return db;}
  catch(error){await db.end().catch(()=>{});throw error;}
}
export async function initialise(db){
  assert.equal((await db.query('SELECT current_database() AS name')).rows[0].name,config.database);
  const custom=(await db.query(`SELECT nspname FROM pg_namespace WHERE nspname NOT LIKE 'pg_%' AND nspname NOT IN ('public','information_schema')`)).rows;
  const tables=(await db.query(`SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public'`)).rows[0].n;
  assert.equal(custom.length,0,'Refusing fixture installation into a database with existing custom schemas');assert.equal(tables,0,'Refusing a nonempty database');
  await db.query(testDatabaseBootstrap);
  for(const filename of (await readdir(new URL('../../supabase/migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort()){
    await db.query('BEGIN');
    try{await db.query(await readFile(new URL(`../../supabase/migrations/${filename}`,import.meta.url),'utf8'));await db.query('COMMIT');}
    catch(error){await db.query('ROLLBACK');throw Error(`Transactional PostgreSQL migration failed: ${filename} (${error.code})`);}
  }
}
export async function asActor(db,user,role='authenticated'){
  assert.ok(['authenticated','anon','service_role'].includes(role));
  await db.query('BEGIN');await db.query(`SET LOCAL ROLE ${role}`);
  await db.query(`SELECT set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)`,[user??'',JSON.stringify({aal:'aal2',amr:[{method:'password',timestamp:Math.floor(Date.now()/1000)}]})]);
}
export async function sessions(work){
  const opened=[];
  try{opened.push(await connect());opened.push(await connect());return await work(...opened);}
  finally{await Promise.allSettled(opened.map(db=>db.query('ROLLBACK')));await Promise.allSettled(opened.map(db=>db.end()));}
}
export function start(promise){let settled=false;const result=promise.then(value=>{settled=true;return{value};},error=>{settled=true;return{error};});return{result,get settled(){return settled;}};}
export async function blocked(observer,pending,waiter,holder){
  const end=Date.now()+5000;
  while(Date.now()<end){
    const pids=(await observer.query('SELECT pg_blocking_pids($1) AS pids',[waiter.pid])).rows[0].pids;
    if(pids.includes(holder.pid))return;
    if(pending.settled){const value=await pending.result;assert.fail(`Competing query did not wait for the expected PostgreSQL lock (${value.error?.code??'completed early'})`);}
    await delay(25);
  }
  assert.fail('Expected PostgreSQL lock wait was not observed within five seconds');
}
export async function success(pending){const r=await pending.result;if(r.error)throw r.error;return r.value;}
export const rpc=async(db,name,args=[])=>{
  assert.match(name,/^[a-z_]+$/);
  return(await db.query(`SELECT public.${name}(${args.map((_,i)=>`$${i+1}`).join(',')}) AS value`,args)).rows[0].value;
};
export async function customer(db){const id=randomUUID();await db.query(`INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,'{"full_name":"Synthetic customer"}')`,[id,`${id}@acceptance.invalid`]);return id;}
export async function fixture(db){
  const f={branch:randomUUID(),customer:await customer(db),staff:await customer(db),cashier:await customer(db),admin:await customer(db),finance:await customer(db),reviewer:await customer(db)};
  await db.query(`INSERT INTO public.stores(id,name,address,distance_miles) VALUES($1,'Synthetic branch','Fixture only',0)`,[f.branch]);
  await db.query(`INSERT INTO public.user_roles(user_id,role) VALUES($1,'staff'),($2,'staff'),($3,'admin'),($4,'finance'),($5,'finance')`,[f.staff,f.cashier,f.admin,f.finance,f.reviewer]);
  for(const user of [f.staff,f.cashier,f.finance,f.reviewer])await db.query(`INSERT INTO public.staff_memberships(user_id,store_id) VALUES($1,$2)`,[user,f.branch]);
  await db.query(`INSERT INTO public.cash_branch_cashiers(store_id,user_id,active) VALUES($1,$2,true)`,[f.branch,f.cashier]);
  await db.query(`INSERT INTO public.cash_order_settings(store_id,currency,enabled,pricing_approved,collection_enabled,fulfilment_enabled,acceptance_minutes) VALUES($1,'USD',true,true,true,true,10)`,[f.branch]);
  await db.query(`INSERT INTO public.cash_loyalty_rules(store_id,currency,basis,points_per_unit,spend_unit_minor,max_points,active) VALUES($1,'USD','subtotal',1,100,1000,true)`,[f.branch]);
  const category=(await db.query(`INSERT INTO public.menu_categories(name) VALUES('Synthetic category') RETURNING id`)).rows[0].id;
  f.item=(await db.query(`INSERT INTO public.menu_items(name,price,category_id,store_id) VALUES('Synthetic meal',100,$1,$2) RETURNING id`,[category,f.branch])).rows[0].id;
  f.day=(await db.query(`SELECT to_char(clock_timestamp() AT TIME ZONE 'Africa/Harare','YYYY-MM-DD') AS day`)).rows[0].day;
  return f;
}
export async function committed(db,user,name,args=[]){
  await asActor(db,user);
  try{const result=await rpc(db,name,args);await db.query('COMMIT');return result;}
  catch(error){await db.query('ROLLBACK');throw error;}
}
export const quote=(db,f)=>committed(db,f.customer,'quote_cash_order',[{store_id:f.branch,fulfilment_mode:'collection',contact:{name:'Synthetic customer',phone:'+263770000001'},address:null,lines:[{menu_item_id:f.item,quantity:1,choice_ids:[]}]}]);
export async function ready(db,f){
  const q=await quote(db,f),order=await committed(db,f.customer,'place_cash_order',[q.quote_id,randomUUID()]);
  for(const [version,action]of ['accept','prepare','ready'].entries())await committed(db,f.staff,'operate_cash_order',[order.order_id,randomUUID(),version,action,{}]);
  return order.order_id;
}
export const cashDetails=()=>({cash_received:true,handover_confirmed:true,cash_currency:'USD',tendered_minor:10000,sale_reference:`SYNTHETIC-${randomUUID()}`});
export async function funded(db,f){const order=await ready(db,f);await committed(db,f.staff,'operate_cash_order',[order,randomUUID(),3,'complete',cashDetails()]);return order;}
export async function offer(db,f,{stock=10}={}){
  await db.query(`INSERT INTO public.reward_branch_settings(store_id,enabled,terms_approved,max_active_per_customer) VALUES($1,true,true,3) ON CONFLICT(store_id) DO NOTHING`,[f.branch]);
  return(await db.query(`INSERT INTO public.reward_branch_offers(store_id,reward_id,name,terms,gaap_product_reference,points_cost,reservation_minutes,available_units,enabled) SELECT $1,id,'Synthetic reward','Fixture only','SYNTHETIC',70,30,$2,true FROM public.rewards WHERE available LIMIT 1 RETURNING id`,[f.branch,stock])).rows[0].id;
}
