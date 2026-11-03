import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createTestDatabase,asRole} from '../scripts/test-database.mjs';
import {clientFixture} from './helpers/client-pack-fixture.mjs';
import {buildConfigurationPlan} from '../scripts/client-onboarding/plan.mjs';

test('disabled configuration proposals satisfy the actual migration schema without enabling orders/rewards or changing historical balances',async()=>{
 const legacy=randomUUID();
 const db=await createTestDatabase({beforeMigration:async(database,name)=>{if(name==='20261030000003_cash_fulfilment_ledger.sql'){
  await database.query('INSERT INTO auth.users(id,email) VALUES($1,$2)',[legacy,'historical-fixture@example.test']);
  await database.query('UPDATE public.user_points SET current_points=777,total_earned=1000,total_redeemed=223 WHERE user_id=$1',[legacy]);
 }}});try{
  const original=(await db.query(`SELECT coalesce(sum(balance),0)::text AS points FROM public.loyalty_accounts`)).rows[0];
  assert.equal(original.points,'777');
  const plan=buildConfigurationPlan(clientFixture(),{scope:'chain',asOf:'2021-01-01'});
  // Only this synthetic local test applies proposed new rows. The CLI has no
  // executor. Existing-row proposals are intentionally never applied here.
  for(const proposal of plan.rows){
   assert.ok(['propose_insert','review_settings'].includes(proposal.operation));
   const fields=Object.keys(proposal.data);await db.query(`INSERT INTO public."${proposal.table}" (${fields.map(f=>'"'+f+'"').join(',')}) VALUES (${fields.map((_,i)=>'$'+(i+1)).join(',')})`,Object.values(proposal.data));
  }
  const ids=plan.rows.filter(r=>r.table==='stores').map(r=>r.key);
  for(const id of ids){
   assert.equal((await db.query('SELECT enabled OR pricing_approved OR fulfilment_enabled OR collection_enabled OR delivery_enabled AS live FROM public.cash_order_settings WHERE store_id=$1',[id])).rows[0].live,false);
   assert.equal((await db.query('SELECT enabled OR terms_approved AS live FROM public.reward_branch_settings WHERE store_id=$1',[id])).rows[0].live,false);
  }
  assert.deepEqual((await db.query(`SELECT coalesce(sum(balance),0)::text AS points FROM public.loyalty_accounts`)).rows[0],original);
  await asRole(db,'anon',null,async()=>{assert.equal((await db.query('SELECT id FROM public.menu_items WHERE store_id=ANY($1::uuid[])',[ids])).rows.length,0);});
  const price=plan.rows.find(r=>r.table==='menu_items');assert.equal((await db.query('SELECT price FROM public.menu_items WHERE id=$1',[price.key])).rows[0].price,'10.10');
 }finally{await db.close();}
});

test('the prepared inventory runs as a read-only transaction against the full local schema',async()=>{
 const db=await createTestDatabase();try{
  const before=(await db.query('SELECT count(*)::int AS n FROM public.menu_items')).rows[0].n;
  await db.exec(await readFile('docs/client-data-inventory.sql','utf8'));
  assert.equal((await db.query('SELECT count(*)::int AS n FROM public.menu_items')).rows[0].n,before);
 }finally{await db.close();}
});
