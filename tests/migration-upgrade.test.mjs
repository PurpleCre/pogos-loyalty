import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createTestDatabase, asRole } from '../scripts/test-database.mjs';

test('location migration tolerates existing policies, preserves addresses and keeps ownership boundaries', async () => {
  const alice = randomUUID(); const bob = randomUUID();
  const aliceAddress = randomUUID(); const bobAddress = randomUUID();
  const migration = '20260916010000_user_locations.sql';
  let originalRows;
  const db = await createTestDatabase({ beforeMigration: async (database, name) => {
    if (name !== migration) return;
    const sql = await readFile(new URL(`../supabase/migrations/${migration}`, import.meta.url), 'utf8');
    await database.exec(sql);
    for (const id of [alice, bob]) await database.query('INSERT INTO auth.users(id,email) VALUES ($1,$2)', [id, `${id}@fixture.test`]);
    await database.query(`INSERT INTO public.user_locations(id,user_id,address,latitude,longitude)
      VALUES ($1,$2,'Alice original',-17,31),($3,$4,'Bob original',-18,30)`, [aliceAddress,alice,bobAddress,bob]);
    originalRows = (await database.query('SELECT * FROM public.user_locations ORDER BY id')).rows;
    await database.exec(`CREATE POLICY "Deployment-specific address boundary" ON public.user_locations
      AS RESTRICTIVE FOR SELECT TO authenticated USING (user_id=auth.uid());
      ALTER POLICY "Users can update their own locations" ON public.user_locations USING (true)`);
    // Simulate an unrecorded manual install, then another attempted replay.
    await database.exec(sql);
  }});
  try {
    assert.deepEqual((await db.query('SELECT * FROM public.user_locations ORDER BY id')).rows, originalRows);
    assert.equal((await db.query(`SELECT count(*)::int AS count FROM pg_policies
      WHERE schemaname='public' AND tablename='user_locations' AND policyname LIKE 'Users can % their own locations'`)).rows[0].count, 4);
    assert.equal((await db.query(`SELECT count(*)::int AS count FROM pg_policies
      WHERE schemaname='public' AND tablename='user_locations' AND policyname='Deployment-specific address boundary'`)).rows[0].count, 1);
    assert.equal((await db.query(`SELECT count(*)::int AS count FROM pg_trigger
      WHERE tgrelid='public.user_locations'::regclass AND tgname='trigger_user_locations_updated_at'`)).rows[0].count, 1);
    await asRole(db, 'authenticated', alice, async () => {
      assert.deepEqual((await db.query('SELECT id FROM public.user_locations')).rows, [{ id: aliceAddress }]);
      assert.equal((await db.query(`UPDATE public.user_locations SET address='Changed' WHERE id=$1 RETURNING id`, [bobAddress])).rows.length, 0);
      assert.equal((await db.query('DELETE FROM public.user_locations WHERE id=$1 RETURNING id', [bobAddress])).rows.length, 0);
      await assert.rejects(db.query('UPDATE public.user_locations SET user_id=$1 WHERE id=$2', [bob,aliceAddress]), { code: '42501' });
      await assert.rejects(db.query(`INSERT INTO public.user_locations(user_id,address,latitude,longitude) VALUES ($1,'Forged',0,0)`, [bob]), { code: '42501' });
      const inserted = (await db.query(`INSERT INTO public.user_locations(user_id,address,latitude,longitude) VALUES ($1,'New',0,0) RETURNING id`, [alice])).rows[0].id;
      assert.equal((await db.query(`UPDATE public.user_locations SET address='Updated' WHERE id=$1 RETURNING address`, [inserted])).rows[0].address, 'Updated');
      assert.equal((await db.query('DELETE FROM public.user_locations WHERE id=$1 RETURNING id', [inserted])).rows.length, 1);
    });
    await asRole(db, 'anon', null, async () => {
      assert.deepEqual((await db.query('SELECT id FROM public.user_locations')).rows, []);
    });
  } finally { await db.close(); }
});

test('GAAP migration tolerates existing policies and data before later containment disables legacy writes', async () => {
  const actor = randomUUID(); const branch = randomUUID();
  const migration = '20261001000000_gaap_integration.sql';
  const tables = ['gaap_sync_log','gaap_customer_links','gaap_config'];
  const original = {};
  const db = await createTestDatabase({ beforeMigration: async (database, name) => {
    if (name !== migration) return;
    const sql = await readFile(new URL(`../supabase/migrations/${migration}`, import.meta.url), 'utf8');
    await database.exec(sql);
    await database.query('INSERT INTO auth.users(id,email) VALUES ($1,$2)', [actor,`${actor}@fixture.test`]);
    await database.query(`INSERT INTO public.stores(id,name,address,distance_miles) VALUES ($1,'Existing fixture','Test only',0)`, [branch]);
    await database.query(`INSERT INTO public.gaap_sync_log(gaap_transaction_id,user_id,store_id,transaction_amount,points_awarded) VALUES ('existing-fixture-sale',$1,$2,12.50,12)`, [actor,branch]);
    await database.query(`INSERT INTO public.gaap_customer_links(user_id,gaap_customer_id,verified) VALUES ($1,'existing-fixture-customer',true)`, [actor]);
    await database.query(`INSERT INTO public.gaap_config(store_id,api_key,webhook_secret) VALUES ($1,'fixture-only-key','fixture-only-secret')`, [branch]);
    for (const table of tables) original[table] = (await database.query(`SELECT * FROM public.${table} ORDER BY id`)).rows;
    await database.exec(sql);
  }});
  try {
    for (const table of tables) assert.deepEqual((await db.query(`SELECT * FROM public.${table} ORDER BY id`)).rows, original[table]);
    await asRole(db, 'authenticated', actor, async () => {
      assert.deepEqual((await db.query('SELECT gaap_customer_id FROM public.gaap_customer_links')).rows, [{gaap_customer_id:'existing-fixture-customer'}]);
      assert.deepEqual((await db.query('SELECT id FROM public.gaap_config')).rows, []);
      assert.deepEqual((await db.query('SELECT id FROM public.gaap_sync_log')).rows, []);
      await assert.rejects(db.query(`UPDATE public.gaap_customer_links SET verified=false WHERE user_id=$1`, [actor]), { code: '42501' });
      await assert.rejects(db.query(`INSERT INTO public.gaap_sync_log(gaap_transaction_id) VALUES ('forged-fixture')`), { code: '42501' });
    });
    for (const role of ['anon','authenticated','service_role']) {
      assert.equal((await db.query(`SELECT has_function_privilege($1,
        'public.process_gaap_transaction(text,text,text,text,text,uuid,numeric,jsonb,jsonb)', 'EXECUTE') AS allowed`, [role])).rows[0].allowed, false);
    }
  } finally { await db.close(); }
});

test('reward upgrade preserves a previously paid cash order, its receipt and earned balance while backfilling fiscal identity', async () => {
  const customer = randomUUID(); const staff = randomUUID(); const store = randomUUID();
  let order; let originalPoints; let originalReceipt;
  const db = await createTestDatabase({ beforeMigration: async (db, filename) => {
    if (filename !== '20261031000000_reward_reservations.sql') return;
    for (const id of [customer, staff]) await db.query('INSERT INTO auth.users(id, email) VALUES ($1, $2)', [id, `${id}@test.invalid`]);
    await db.query(`INSERT INTO public.stores(id, name, address, distance_miles) VALUES ($1, 'Upgrade fixture', 'Test only', 0)`, [store]);
    await db.query(`INSERT INTO public.user_roles(user_id, role, staff_store_id) VALUES ($1, 'staff', $2)`, [staff, store]);
    await db.query('INSERT INTO public.cash_branch_cashiers(store_id, user_id, active) VALUES ($1, $2, true)', [store, staff]);
    await db.query(`INSERT INTO public.cash_order_settings(store_id, currency, enabled, pricing_approved, fulfilment_enabled, acceptance_minutes) VALUES ($1, 'USD', true, true, true, 10)`, [store]);
    const category = (await db.query(`INSERT INTO public.menu_categories(name) VALUES ('Upgrade fixture') RETURNING id`)).rows[0].id;
    const item = (await db.query(`INSERT INTO public.menu_items(category_id, store_id, name, price) VALUES ($1, $2, 'Fixture meal', 10) RETURNING id`, [category, store])).rows[0].id;
    await db.query(`INSERT INTO public.cash_loyalty_rules(store_id, currency, basis, points_per_unit, spend_unit_minor, max_points, active) VALUES ($1, 'USD', 'subtotal', 1, 100, 100, true)`, [store]);
    const request = { store_id: store, fulfilment_mode: 'collection', contact: { name: 'Upgrade test', phone: '+263771234567' }, address: null, lines: [{ menu_item_id: item, quantity: 1, choice_ids: [] }] };
    await asRole(db, 'authenticated', customer, async () => {
      const quote = (await db.query('SELECT public.quote_cash_order($1) AS result', [JSON.stringify(request)])).rows[0].result;
      order = (await db.query('SELECT public.place_cash_order($1, $2) AS result', [quote.quote_id, randomUUID()])).rows[0].result.order_id;
    });
    await asRole(db, 'authenticated', staff, async () => {
      for (const [version, action] of ['accept', 'prepare', 'ready', 'complete'].entries()) {
        const details = action === 'complete' ? { cash_received: true, handover_confirmed: true, cash_currency: 'USD', tendered_minor: 1000, sale_reference: 'UPGRADE/TILL1/SALE1' } : {};
        await db.query('SELECT public.operate_cash_order($1, $2, $3, $4, $5)', [order, randomUUID(), version, action, JSON.stringify(details)]);
      }
    });
    originalPoints = (await db.query('SELECT current_points, total_earned, total_redeemed FROM public.user_points WHERE user_id = $1', [customer])).rows[0];
    originalReceipt = (await db.query('SELECT * FROM public.cash_receipts WHERE order_id = $1', [order])).rows[0];
  } });
  try {
    const points = (await db.query('SELECT current_points, total_earned, total_redeemed FROM public.user_points WHERE user_id = $1', [customer])).rows[0];
    assert.deepEqual(points, originalPoints); assert.equal(points.current_points, 10);
    assert.deepEqual((await db.query('SELECT * FROM public.cash_receipts WHERE order_id = $1', [order])).rows[0], originalReceipt);
    assert.equal((await db.query('SELECT reserved_points FROM public.user_points WHERE user_id = $1', [customer])).rows[0].reserved_points, 0);
    assert.equal((await db.query('SELECT cash_order_id FROM public.branch_fiscal_references WHERE store_id = $1 AND reference = $2', [store, originalReceipt.sale_reference])).rows[0].cash_order_id, order);
    assert.equal((await db.query('SELECT status FROM public.orders WHERE id = $1', [order])).rows[0].status, 'completed');
  } finally { await db.close(); }
});

test('identity migration preserves legacy branch assignments and requires MFA for their use', async () => {
  const actor = 'd9999999-0000-4000-8000-000000000001';
  const branch = 'd9999999-0000-4000-8000-000000000002';
  const database = await createTestDatabase({ beforeMigration: async (db, name) => {
    if (name !== '20261031000001_identity_access.sql') return;
    await db.query(`INSERT INTO auth.users(id,email) VALUES ($1,'legacy-staff@fixture.test')`, [actor]);
    await db.query(`INSERT INTO public.stores(id,name,address,distance_miles) VALUES ($1,'Legacy fixture','Fixture',0)`, [branch]);
    await db.query(`INSERT INTO public.user_roles(user_id,role,staff_store_id) VALUES ($1,'staff',$2)`, [actor,branch]);
  }});
  try {
    const membership = await database.query('SELECT store_id,active,granted_by FROM public.staff_memberships WHERE user_id=$1',[actor]);
    assert.deepEqual(membership.rows,[{store_id:branch,active:true,granted_by:null}]);
    for (const [aal,expected] of [['aal1',false],['aal2',true]]) {
      const result=await asRole(database,'authenticated',actor,()=>database.query('SELECT public.cash_staff_access($1,$2) AS allowed',[branch,actor]),{aal});
      assert.equal(result.rows[0].allowed,expected);
    }
  } finally { await database.close(); }
});
