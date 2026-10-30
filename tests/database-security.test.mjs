import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createTestDatabase, asRole } from '../scripts/test-database.mjs';

const alice = 'a0000000-0000-4000-8000-000000000001';
const bob = 'b0000000-0000-4000-8000-000000000002';
const staff = 'c0000000-0000-4000-8000-000000000003';
const admin = 'd0000000-0000-4000-8000-000000000004';
const branchA = 'e0000000-0000-4000-8000-000000000005';
const branchB = 'f0000000-0000-4000-8000-000000000006';
let db;

before(async () => {
  db = await createTestDatabase({ beforeContainment: async database => {
    await database.exec(`CREATE POLICY "Legacy overly broad orders read" ON public.orders FOR SELECT USING (true)`);
    await database.exec(`CREATE POLICY "Legacy overly broad items read" ON public.order_items FOR SELECT USING (true)`);
    await database.exec(`CREATE POLICY "Legacy overly broad menu update" ON public.menu_items FOR UPDATE USING (true) WITH CHECK (true)`);
    await database.exec(`GRANT UPDATE (current_points) ON public.user_points TO authenticated;
      CREATE POLICY "Legacy overly broad points update" ON public.user_points FOR UPDATE USING (true) WITH CHECK (true)`);
    await database.exec(`CREATE FUNCTION public.handle_order_created() RETURNS TRIGGER
      LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN
        UPDATE public.user_points SET current_points = current_points + NEW.points_earned
          WHERE user_id = NEW.user_id;
        RETURN NEW;
      END $$;
      CREATE TRIGGER on_order_created AFTER INSERT ON public.orders
        FOR EACH ROW EXECUTE FUNCTION public.handle_order_created()`);
    await database.query(`INSERT INTO auth.users(id, email) VALUES ($1, 'alice@example.test')`, [alice]);
    await database.query('UPDATE public.user_points SET current_points = 125 WHERE user_id = $1', [alice]);
  } });
  for (const [id, email] of [[bob, 'bob@example.test'], [staff, 'staff@example.test'], [admin, 'admin@example.test']]) {
    await db.query('INSERT INTO auth.users(id, email) VALUES ($1, $2)', [id, email]);
  }
  await db.query(`INSERT INTO public.stores(id, name, address, distance_miles) VALUES ($1, 'Test A', 'Fixture', 0), ($2, 'Test B', 'Fixture', 0)`, [branchA, branchB]);
  await db.query(`INSERT INTO public.user_roles(user_id, role, staff_store_id) VALUES ($1, 'staff', $2), ($3, 'admin', NULL)`, [staff, branchA, admin]);
  await db.query(`INSERT INTO public.orders(user_id, store_id, total_amount) VALUES ($1, $2, 10), ($3, $4, 20)`, [alice, branchA, bob, branchB]);
  await db.exec(`INSERT INTO public.order_items(order_id, menu_item_id, quantity, unit_price)
    SELECT o.id, m.id, 1, m.price FROM public.orders o
    CROSS JOIN LATERAL (SELECT id, price FROM public.menu_items ORDER BY id LIMIT 1) m`);
});
after(async () => { await db?.close(); });

test('full migration history applies and containment preserves existing balances', async () => {
  const result = await db.query('SELECT current_points FROM public.user_points WHERE user_id = $1', [alice]);
  assert.equal(result.rows[0].current_points, 125);
});

test('customers read their own balance and cannot read another customer balance', async () => {
  await asRole(db, 'authenticated', alice, async () => {
    const result = await db.query('SELECT user_id, current_points FROM public.user_points');
    assert.deepEqual(result.rows, [{ user_id: alice, current_points: 125 }]);
  });
});

for (const [name, sql, params] of [
  ['mint points', 'UPDATE public.user_points SET current_points = 999999 WHERE user_id = $1', [alice]],
  ['fabricate a purchase', `INSERT INTO public.transactions(user_id, transaction_type, points_earned) VALUES ($1, 'purchase', 10000)`, [alice]],
  ['forge an achievement', `INSERT INTO public.user_achievements(user_id, achievement_id) SELECT $1, id FROM public.achievements LIMIT 1`, [alice]],
  ['forge a referral', `INSERT INTO public.referrals(referrer_id, referred_id, referral_code) VALUES ($1, $2, 'FORGED')`, [alice, bob]],
  ['forge sync evidence', `INSERT INTO public.gaap_sync_log(gaap_transaction_id) VALUES ('forged')`, []],
  ['self-verify a POS identity', `INSERT INTO public.gaap_customer_links(user_id, gaap_customer_id, verified) VALUES ($1, 'victim', true)`, [alice]],
  ['change matching email', `UPDATE public.profiles SET email = 'bob@example.test' WHERE id = $1`, [alice]],
  ['submit a client-priced order', 'INSERT INTO public.orders(user_id, total_amount) VALUES ($1, 0.01)', [alice]],
]) {
  test(`customer cannot ${name}`, async () => {
    await asRole(db, 'authenticated', alice, () => assert.rejects(db.query(sql, params), { code: '42501' }));
  });
}

test('admin cannot bypass financial commands with direct balance updates', async () => {
  await asRole(db, 'authenticated', admin, () => assert.rejects(
    db.query('UPDATE public.user_points SET current_points = 1000 WHERE user_id = $1', [alice]), { code: '42501' },
  ));
});

test('profile display name remains editable without granting matching-key changes', async () => {
  await asRole(db, 'authenticated', alice, async () => {
    const result = await db.query(`UPDATE public.profiles SET full_name = 'Alice' WHERE id = $1 RETURNING full_name`, [alice]);
    assert.equal(result.rows[0].full_name, 'Alice');
    const other = await db.query(`UPDATE public.profiles SET full_name = 'Wrong' WHERE id = $1 RETURNING id`, [bob]);
    assert.equal(other.rows.length, 0);
  });
});

for (const role of ['anon', 'authenticated']) {
  test(`${role} cannot invoke privileged GAAP processing or legacy points transfer`, async () => {
    await asRole(db, role, role === 'authenticated' ? alice : null, async () => {
      await assert.rejects(db.query(`SELECT public.process_gaap_transaction('forged')`), { code: '42501' });
      await assert.rejects(db.query(`SELECT public.share_user_points($1, 'alice@example.test', 10)`, [bob]), { code: '42501' });
    });
  });
}

test('legacy GAAP processing is disabled for service role until it uses the audited ledger', async () => {
  const result = await db.query(`SELECT has_function_privilege('service_role',
    'public.process_gaap_transaction(text,text,text,text,text,uuid,numeric,jsonb,jsonb)', 'EXECUTE') AS allowed`);
  assert.equal(result.rows[0].allowed, false);
});

test('customers and branch staff see only their permitted orders', async () => {
  for (const [user, expected] of [[alice, alice], [bob, bob], [staff, alice]]) {
    await asRole(db, 'authenticated', user, async () => {
      const result = await db.query('SELECT user_id FROM public.orders');
      assert.deepEqual(result.rows, [{ user_id: expected }]);
      const items = await db.query('SELECT o.user_id FROM public.order_items i JOIN public.orders o ON o.id = i.order_id');
      assert.deepEqual(items.rows, [{ user_id: expected }]);
      assert.equal((await db.query('SELECT * FROM public.order_items')).rows.length, 1);
    });
  }
  await asRole(db, 'anon', null, async () => {
    assert.equal((await db.query('SELECT id FROM public.orders')).rows.length, 0);
    assert.equal((await db.query('SELECT id FROM public.order_items')).rows.length, 0);
  });
  await asRole(db, 'authenticated', admin, async () => {
    assert.equal((await db.query('SELECT id FROM public.orders')).rows.length, 2);
  });
});

test('legacy permissive policies cannot let a customer change menu prices', async () => {
  await asRole(db, 'authenticated', alice, async () => {
    const result = await db.query('UPDATE public.menu_items SET price = 0.01 RETURNING id');
    assert.equal(result.rows.length, 0);
  });
  await asRole(db, 'authenticated', admin, async () => {
    const result = await db.query('UPDATE public.menu_items SET price = price RETURNING id');
    assert.ok(result.rows.length > 0);
  });
});

test('signup metadata cannot claim a referral bonus before a qualifying purchase', async () => {
  await db.query(`INSERT INTO public.referral_codes(user_id, code) VALUES ($1, 'TESTCODE')`, [alice]);
  await db.query(`INSERT INTO auth.users(email, raw_user_meta_data) VALUES ('new@example.test', '{"referral_code":"TESTCODE"}')`);
  assert.equal((await db.query('SELECT * FROM public.referrals')).rows.length, 0);
  assert.equal((await db.query('SELECT current_points FROM public.user_points WHERE user_id = $1', [alice])).rows[0].current_points, 125);
});

test('new functions are not executable by anonymous or authenticated callers by default', async () => {
  await db.exec('CREATE FUNCTION public.test_private_function() RETURNS INTEGER LANGUAGE SQL AS $$ SELECT 1 $$');
  const result = await db.query(`SELECT has_function_privilege('anon', 'public.test_private_function()', 'EXECUTE') AS anon,
    has_function_privilege('authenticated', 'public.test_private_function()', 'EXECUTE') AS authenticated`);
  assert.deepEqual(result.rows[0], { anon: false, authenticated: false });
});

test('a manually installed legacy trigger cannot award points on an unpaid order', async () => {
  await db.query('INSERT INTO public.orders(user_id, total_amount, points_earned) VALUES ($1, 99, 99)', [alice]);
  assert.equal((await db.query('SELECT current_points FROM public.user_points WHERE user_id = $1', [alice])).rows[0].current_points, 125);
});
