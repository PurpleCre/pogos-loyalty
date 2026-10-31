import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { createTestDatabase, asRole } from '../scripts/test-database.mjs';

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
