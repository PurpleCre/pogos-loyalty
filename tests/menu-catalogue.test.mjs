import assert from 'node:assert/strict';
import {before,after,beforeEach,afterEach,test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import {createTestDatabase,asRole} from '../scripts/test-database.mjs';
import {validateCatalogue,catalogueRows,menuId,tableFingerprintQuery,buildReplacementSql} from '../scripts/menu-catalogue.mjs';
const catalogue=JSON.parse(await readFile(new URL('../config/pogos-menu-2026-11-04.json',import.meta.url),'utf8'));
const project='a'.repeat(20),rows=catalogueRows(catalogue,project),header=rows.origin+'/2026-11-04/branding/test.webp';
test('confirmed shared catalogue maps stable IDs, exact prices, all options and owned image URLs',()=>{
  assert.equal(validateCatalogue(catalogue),catalogue);assert.equal(rows.categories.length,9);assert.equal(rows.items.length,51);assert.equal(rows.options.length,18);assert.equal(rows.choices.length,60);assert.equal(rows.assets.length,44);
  assert.equal(new Set([...rows.items,...rows.options,...rows.choices].map(r=>r.id)).size,129);
  assert.ok(rows.items.every(i=>i.store_id===null));assert.equal(rows.items.filter(i=>i.is_available).length,47);
  assert.equal(rows.items.find(i=>i.name==='Hawaiian Pizza').price,'8.96');assert.equal(rows.choices.find(c=>c.name==='Large').price_adjustment,'3.36');
  assert.ok(rows.items.every(i=>!i.image_url||i.image_url.startsWith(`https://${project}.supabase.co/`)));assert.deepEqual(catalogueRows(catalogue,project),rows);
});
test('invalid prices, source identities, categories, asset paths and defaults cannot become an import',()=>{
  for(const mutate of [c=>c.currency='ZWG',c=>c.items[0].price_minor=8.96,c=>c.items[0].price_minor=-1,c=>c.items[1].source_id=c.items[0].source_id,c=>c.items[0].category_source_id=0,c=>c.items[0].image_file='.env',c=>c.items[0].image_sha256='x',c=>c.items[0].options[0].choices[1].is_default=true,c=>c.items.pop()]){const copy=structuredClone(catalogue);mutate(copy);assert.throws(()=>catalogueRows(copy,project));}
  assert.throws(()=>catalogueRows(catalogue,'https://remote'));assert.throws(()=>tableFingerprintQuery('users; DROP SCHEMA public'));
});
test('all bundled and uploadable product images match the captured source hashes',async()=>{
  for(const asset of rows.assets){const bytes=await readFile(new URL('../'+asset.file,import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256);}
});
let db,user,legacyOrder;
before(async()=>{db=await createTestDatabase();});after(async()=>{await db?.close();});
beforeEach(async()=>{
  await db.exec('BEGIN');user=randomUUID();await db.query("INSERT INTO auth.users(id,email) VALUES($1,'menu-fixture@acceptance.invalid')",[user]);
  for(const branch of ['Msasa','Kamfinsa'])await db.query("INSERT INTO public.stores(name,address,distance_miles) VALUES($1,'Fixture only',0)",["Pogo's "+branch]);
  const item=(await db.query('SELECT id FROM public.menu_items LIMIT 1')).rows[0].id;
  legacyOrder=(await db.query("INSERT INTO public.orders(user_id,status,total_amount) VALUES($1,'pending',10) RETURNING id",[user])).rows[0].id;
  await db.query('INSERT INTO public.order_items(order_id,menu_item_id,quantity,unit_price) VALUES($1,$2,1,10)',[legacyOrder,item]);
});
afterEach(async()=>{await db.exec('ROLLBACK');});
async function fingerprints(){
  const tables=(await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name")).rows.map(r=>r.table_name),result={};
  for(const table of tables)result[table]=(await db.query(tableFingerprintQuery(table))).rows[0].md5;return result;
}
const body=f=>buildReplacementSql(catalogue,project,f,header).replace(/^BEGIN;\n/,'').replace(/\nCOMMIT;$/,'');
async function denied(sql,code){await db.exec('SAVEPOINT rejected_reset');try{await assert.rejects(db.exec(sql),{code});}finally{await db.exec('ROLLBACK TO SAVEPOINT rejected_reset; RELEASE SAVEPOINT rejected_reset');}}
test('legacy order/menu replacement preserves all unrelated data and imports one common catalogue',async()=>{
  const before=await fingerprints();await db.exec(body(before));
  assert.equal((await db.query('SELECT count(*)::int AS n FROM public.orders')).rows[0].n,0);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM public.menu_items')).rows[0].n,51);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM public.menu_item_options')).rows[0].n,18);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM public.menu_item_option_choices')).rows[0].n,60);
  for(const table of ['profiles','user_points','loyalty_accounts','loyalty_ledger','transactions','rewards','cash_order_settings'])assert.equal((await fingerprints())[table],before[table]);
  const westgate=(await db.query("SELECT * FROM public.stores WHERE name='Pogo''s Westgate'")).rows[0];assert.equal(westgate.latitude,null);assert.equal(westgate.longitude,null);assert.equal(westgate.address,'');assert.equal(westgate.is_open,false);
  for(const branch of ['Msasa','Kamfinsa','Westgate']){
    const id=(await db.query('SELECT id FROM public.stores WHERE name=$1',["Pogo's "+branch])).rows[0].id;
    assert.equal((await db.query('SELECT count(*)::int AS n FROM public.menu_items WHERE store_id IS NULL OR store_id=$1',[id])).rows[0].n,51);
  }
});
test('a linked loyalty earning blocks a reset without weakening the immutable ledger',async()=>{
  const store=(await db.query("SELECT id FROM public.stores WHERE name='Pogo''s Msasa'")).rows[0].id;
  const rule=(await db.query("INSERT INTO public.cash_loyalty_rules(store_id,currency,basis,points_per_unit,spend_unit_minor,max_points) VALUES($1,'USD','subtotal',1,100,1000) RETURNING id",[store])).rows[0].id;
  await db.query("INSERT INTO public.loyalty_ledger(user_id,order_id,event_key,kind,points_delta,rule_id) VALUES($1,$2,$3,'earn',10,$4)",[user,legacyOrder,randomUUID(),rule]);
  const before=await fingerprints();await denied(body(before),'42501');assert.deepEqual(await fingerprints(),before);
});
test('governed menu audit references stop the destructive replacement',async()=>{
  const store=(await db.query("SELECT id FROM public.stores WHERE name='Pogo''s Msasa'")).rows[0].id,item=(await db.query('SELECT id FROM public.menu_items LIMIT 1')).rows[0].id;
  await db.query("INSERT INTO public.branch_operation_commands(id,actor_id,store_id,action,menu_item_id,expected_version,request,result,reason) VALUES($1,$2,$3,'availability',$4,0,'{}','{}','Synthetic audit')",[randomUUID(),user,store,item]);
  const before=await fingerprints();await denied(body(before),'42501');assert.deepEqual(await fingerprints(),before);
});
test('a stale backup cannot erase intervening data or replay a completed reset',async()=>{
  const before=await fingerprints();await db.exec('UPDATE public.menu_items SET price=price+1');const changed=await fingerprints();await denied(body(before),'40001');assert.deepEqual(await fingerprints(),changed);
  await db.exec(body(changed));const next=(await db.query("INSERT INTO public.orders(user_id,status,total_amount) VALUES($1,'pending',8.96) RETURNING id",[user])).rows[0].id;
  await denied(body(changed),'40001');assert.equal((await db.query('SELECT id FROM public.orders WHERE id=$1',[next])).rows.length,1);
});
test('the imported pizza/choice prices quote exactly and consistently at all three branches',async()=>{
  await db.exec(body(await fingerprints()));
  const cashier=randomUUID();await db.query("INSERT INTO auth.users(id,email) VALUES($1,'menu-cashier@acceptance.invalid')",[cashier]);await db.query("INSERT INTO public.user_roles(user_id,role) VALUES($1,'staff')",[cashier]);
  const large=menuId('item:56863:option:5716:choice:18723');
  for(const branch of ['Msasa','Kamfinsa','Westgate']){
    const id=(await db.query('SELECT id FROM public.stores WHERE name=$1',["Pogo's "+branch])).rows[0].id;await db.query('UPDATE public.stores SET is_open=true WHERE id=$1',[id]);
    await db.query("INSERT INTO public.cash_order_settings(store_id,currency,enabled,pricing_approved,collection_enabled,fulfilment_enabled,acceptance_minutes) VALUES($1,'USD',true,true,true,true,10)",[id]);
    await db.query('INSERT INTO public.staff_memberships(user_id,store_id) VALUES($1,$2)',[cashier,id]);await db.query('INSERT INTO public.cash_branch_cashiers(store_id,user_id,active) VALUES($1,$2,true)',[id,cashier]);
    const request={store_id:id,fulfilment_mode:'collection',contact:{name:'Synthetic menu customer',phone:'+263770000001'},address:null,lines:[{menu_item_id:menuId('item:56863'),quantity:1,choice_ids:[large]}]};
    const quote=await asRole(db,'authenticated',user,async()=>(await db.query('SELECT public.quote_cash_order($1) AS value',[request])).rows[0].value,{aal:'aal1'});
    assert.equal(quote.currency,'USD');assert.equal(quote.total_minor,1232);
  }
});
