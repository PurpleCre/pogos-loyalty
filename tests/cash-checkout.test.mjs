import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { createTestDatabase, asRole } from '../scripts/test-database.mjs';

const user = 'a1000000-0000-4000-8000-000000000001';
const other = 'b1000000-0000-4000-8000-000000000002';
const store = 'c1000000-0000-4000-8000-000000000003';
const otherStore = 'd1000000-0000-4000-8000-000000000004';
let db, item, choice, secondChoice, foreignChoice, foreignItem, zone;
before(async () => {
  db = await createTestDatabase();
  await db.query(`INSERT INTO auth.users(id, email) VALUES ($1, 'cash@example.test'), ($2, 'other@example.test')`, [user, other]);
  await db.query(`INSERT INTO public.stores(id, name, address, distance_miles) VALUES ($1, 'Test Msasa', 'Fixture only', 0), ($2, 'Test Westgate', 'Fixture only', 0)`, [store, otherStore]);
  await db.query(`INSERT INTO public.cash_order_settings(store_id, currency, enabled, pricing_approved, delivery_enabled)
    VALUES ($1, 'USD', true, true, true)`, [store]);
  const category = (await db.query(`INSERT INTO public.menu_categories(name) VALUES ('Test meals') RETURNING id`)).rows[0].id;
  item = (await db.query(`INSERT INTO public.menu_items(category_id, name, price, store_id) VALUES ($1, 'Test Pizza', 10.10, $2) RETURNING id`, [category, store])).rows[0].id;
  foreignItem = (await db.query(`INSERT INTO public.menu_items(category_id, name, price, store_id) VALUES ($1, 'Other branch meal', 1, $2) RETURNING id`, [category, otherStore])).rows[0].id;
  const option = (await db.query(`INSERT INTO public.menu_item_options(menu_item_id, name, is_required, max_choices) VALUES ($1, 'Base', true, 1) RETURNING id`, [item])).rows[0].id;
  const choices = await db.query(`INSERT INTO public.menu_item_option_choices(option_id, name, price_adjustment) VALUES ($1, 'Thin', 0.20), ($1, 'Thick', 0.30) RETURNING id`, [option]);
  [choice, secondChoice] = choices.rows.map(row => row.id);
  const foreignOption = (await db.query(`INSERT INTO public.menu_item_options(menu_item_id, name) VALUES ($1, 'Other option') RETURNING id`, [foreignItem])).rows[0].id;
  foreignChoice = (await db.query(`INSERT INTO public.menu_item_option_choices(option_id, name) VALUES ($1, 'Foreign') RETURNING id`, [foreignOption])).rows[0].id;
  zone = (await db.query(`INSERT INTO public.cash_delivery_zones(store_id, name, boundary, fee_minor, active)
    VALUES ($1, 'Fixture area', '((30,-18),(32,-18),(32,-17),(30,-17))', 250, true) RETURNING id`, [store])).rows[0].id;
});
after(async () => { await db?.close(); });

function request(overrides = {}) {
  return { store_id: store, fulfilment_mode: 'collection', contact: { name: 'Test Customer', phone: '+263771234567' }, address: null,
    lines: [{ menu_item_id: item, quantity: 2, choice_ids: [choice] }], ...overrides };
}
async function quote(payload = request(), actor = user) {
  return asRole(db, 'authenticated', actor, async () => (await db.query('SELECT public.quote_cash_order($1::jsonb) AS result', [JSON.stringify(payload)])).rows[0].result);
}
async function place(quoteId, key = randomUUID(), actor = user) {
  return asRole(db, 'authenticated', actor, async () => (await db.query('SELECT public.place_cash_order($1, $2) AS result', [quoteId, key])).rows[0].result);
}

test('server calculates exact minor-unit prices including modifiers', async () => {
  const q = await quote();
  assert.equal(q.currency, 'USD');
  assert.equal(q.lines[0].unit_price_minor, 1030);
  assert.equal(q.subtotal_minor, 2060);
  assert.equal(q.total_minor, 2060);
});
test('delivery includes server fee, matched zone and complete contact/address snapshot', async () => {
  const q = await quote(request({ fulfilment_mode: 'delivery', address: { address: '12 Fixture Road', latitude: -17.8, longitude: 31, instructions: 'Call at gate' } }));
  assert.equal(q.delivery_fee_minor, 250);
  const result = await place(q.quote_id);
  const order = (await db.query('SELECT * FROM public.orders WHERE id = $1', [result.order_id])).rows[0];
  assert.equal(order.total_minor, 2310);
  assert.equal(order.payment_status, 'unpaid');
  assert.equal(order.points_earned, 0);
  assert.equal(order.contact_snapshot.phone, '+263771234567');
  assert.equal(order.delivery_snapshot.instructions, 'Call at gate');
  assert.equal(order.delivery_snapshot.zone_id, zone);
  assert.equal((await db.query('SELECT * FROM public.transactions WHERE user_id = $1', [user])).rows.length, 0);
  assert.equal((await db.query('SELECT current_points FROM public.user_points WHERE user_id = $1', [user])).rows[0].current_points, 0);
});

for (const [description, build] of [
  ['client price injection', () => request({ total_minor: 1 })],
  ['line price injection', () => request({ lines: [{ menu_item_id: item, quantity: 1, choice_ids: [choice], unit_price: 0.01 }] })],
  ['another branch item', () => request({ lines: [{ menu_item_id: foreignItem, quantity: 1, choice_ids: [] }] })],
  ['missing required choice', () => request({ lines: [{ menu_item_id: item, quantity: 1, choice_ids: [] }] })],
  ['foreign choice', () => request({ lines: [{ menu_item_id: item, quantity: 1, choice_ids: [foreignChoice] }] })],
  ['duplicate choice', () => request({ lines: [{ menu_item_id: item, quantity: 1, choice_ids: [choice, choice] }] })],
  ['too many choices', () => request({ lines: [{ menu_item_id: item, quantity: 1, choice_ids: [choice, secondChoice] }] })],
  ['zero quantity', () => request({ lines: [{ menu_item_id: item, quantity: 0, choice_ids: [choice] }] })],
  ['fractional quantity', () => request({ lines: [{ menu_item_id: item, quantity: 1.5, choice_ids: [choice] }] })],
  ['empty cart', () => request({ lines: [] })],
  ['unconfigured branch', () => request({ store_id: otherStore })],
  ['missing delivery address', () => request({ fulfilment_mode: 'delivery' })],
  ['out-of-zone pin', () => request({ fulfilment_mode: 'delivery', address: { address: 'Other town road', latitude: -20, longitude: 29 } })],
  ['placeholder address', () => request({ fulfilment_mode: 'delivery', address: { address: 'Selected from Map', latitude: -17.8, longitude: 31 } })],
  ['invalid contact', () => request({ contact: { name: '', phone: '123' } })],
]) {
  test(`quote rejects ${description}`, async () => {
    const beforeCount = (await db.query('SELECT count(*)::int AS n FROM public.cash_order_quotes')).rows[0].n;
    await assert.rejects(quote(build()), { code: '22023' });
    assert.equal((await db.query('SELECT count(*)::int AS n FROM public.cash_order_quotes')).rows[0].n, beforeCount);
  });
}
test('quote expires before order creation', async () => {
  const q = await quote();
  await db.query(`UPDATE public.cash_order_quotes SET expires_at = now() - interval '1 minute' WHERE id = $1`, [q.quote_id]);
  await assert.rejects(place(q.quote_id), { code: '22023' });
});
test('another customer cannot read or consume a quote', async () => {
  const q = await quote();
  await assert.rejects(place(q.quote_id, randomUUID(), other), { code: '22023' });
  await asRole(db, 'authenticated', other, async () => {
    assert.equal((await db.query('SELECT id FROM public.cash_order_quotes WHERE id = $1', [q.quote_id])).rows.length, 0);
    await assert.rejects(db.query(`UPDATE public.cash_order_quotes SET snapshot = '{}' WHERE id = $1`, [q.quote_id]), { code: '42501' });
  });
});
test('untrusted callers cannot enable a branch or alter its delivery fee', async () => {
  await asRole(db, 'authenticated', user, async () => {
    await assert.rejects(db.query(`UPDATE public.cash_order_settings SET enabled = true`), { code: '42501' });
    await assert.rejects(db.query(`UPDATE public.cash_delivery_zones SET fee_minor = 0`), { code: '42501' });
  });
});
test('same submission and same quote return the same order, including after closure/expiry', async () => {
  const q = await quote();
  const key = randomUUID();
  const first = await place(q.quote_id, key);
  await db.query('UPDATE public.stores SET is_open = false WHERE id = $1', [store]);
  try {
    assert.deepEqual(await place(q.quote_id, key), first);
    assert.deepEqual(await place(q.quote_id, randomUUID()), first);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM public.orders WHERE quote_id = $1', [q.quote_id])).rows[0].n, 1);
  } finally { await db.query('UPDATE public.stores SET is_open = true WHERE id = $1', [store]); }
});
test('reusing a submission key for another quote is rejected', async () => {
  const q = await quote(); const next = await quote(); const key = randomUUID();
  await place(q.quote_id, key);
  await assert.rejects(place(next.quote_id, key), { code: '22023' });
});
test('prices and descriptions are frozen in the quote and resulting order', async () => {
  const q = await quote();
  await db.query(`UPDATE public.menu_items SET price = 12, name = 'Changed later' WHERE id = $1`, [item]);
  try {
    const result = await place(q.quote_id);
    const row = (await db.query('SELECT * FROM public.order_items WHERE order_id = $1', [result.order_id])).rows[0];
    assert.equal(row.item_name, 'Test Pizza');
    assert.equal(row.unit_price_minor, 1030);
    assert.equal(row.modifiers_snapshot[0].name, 'Thin');
  } finally { await db.query(`UPDATE public.menu_items SET price = 10.10, name = 'Test Pizza' WHERE id = $1`, [item]); }
});
test('stock pause after quote prevents submission', async () => {
  const q = await quote();
  await db.query('UPDATE public.menu_items SET is_available = false WHERE id = $1', [item]);
  try { await assert.rejects(place(q.quote_id), { code: '22023' }); }
  finally { await db.query('UPDATE public.menu_items SET is_available = true WHERE id = $1', [item]); }
});
test('a failure after a valid first line rolls back order, lines, events and quote consumption', async () => {
  const q = await quote(request({ lines: [
    { menu_item_id: item, quantity: 1, choice_ids: [choice] },
    { menu_item_id: item, quantity: 2, choice_ids: [secondChoice] },
  ] })); const key = randomUUID();
  await db.exec(`CREATE FUNCTION public.fail_test_order_item() RETURNS TRIGGER LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'Simulated line write failure'; END $$;
    CREATE TRIGGER fail_test_order_item BEFORE INSERT ON public.order_items FOR EACH ROW WHEN (NEW.quantity = 2) EXECUTE FUNCTION public.fail_test_order_item()`);
  try {
    await assert.rejects(place(q.quote_id, key));
    assert.equal((await db.query('SELECT id FROM public.orders WHERE submission_key = $1', [key])).rows.length, 0);
    assert.equal((await db.query('SELECT order_id FROM public.cash_order_quotes WHERE id = $1', [q.quote_id])).rows[0].order_id, null);
  } finally { await db.exec('DROP TRIGGER fail_test_order_item ON public.order_items; DROP FUNCTION public.fail_test_order_item()'); }
  const result = await place(q.quote_id, key);
  assert.equal((await db.query('SELECT id FROM public.order_status_events WHERE order_id = $1', [result.order_id])).rows.length, 1);
});
test('anonymous callers cannot quote or place orders', async () => {
  await asRole(db, 'anon', null, async () => {
    await assert.rejects(db.query('SELECT public.quote_cash_order($1)', [JSON.stringify(request())]), { code: '42501' });
    await assert.rejects(db.query('SELECT public.place_cash_order($1, $2)', [randomUUID(), randomUUID()]), { code: '42501' });
  });
});

test('a disabled branch and disabled delivery zone reject unsubmitted quotes', async () => {
  const q = await quote();
  await db.query('UPDATE public.cash_order_settings SET enabled = false WHERE store_id = $1', [store]);
  try { await assert.rejects(place(q.quote_id), { code: '22023' }); await assert.rejects(quote(), { code: '22023' }); }
  finally { await db.query('UPDATE public.cash_order_settings SET enabled = true WHERE store_id = $1', [store]); }
  const delivery = await quote(request({ fulfilment_mode: 'delivery', address: { address: '12 Fixture Road', latitude: -17.8, longitude: 31 } }));
  await db.query('UPDATE public.cash_delivery_zones SET active = false WHERE id = $1', [zone]);
  try { await assert.rejects(place(delivery.quote_id), { code: '22023' }); }
  finally { await db.query('UPDATE public.cash_delivery_zones SET active = true WHERE id = $1', [zone]); }
});
test('currency is configured by the branch without guessed exchange rates', async () => {
  const q = await quote();
  await db.query(`UPDATE public.cash_order_settings SET currency = 'ZWG' WHERE store_id = $1`, [store]);
  try {
    await assert.rejects(place(q.quote_id), { code: '22023' });
    const next = await quote(); assert.equal(next.currency, 'ZWG'); assert.equal(next.total_minor, 2060);
  } finally { await db.query(`UPDATE public.cash_order_settings SET currency = 'USD' WHERE store_id = $1`, [store]); }
});
test('unapproved pricing and configured minimum spend cannot be bypassed', async () => {
  await db.query('UPDATE public.cash_order_settings SET pricing_approved = false WHERE store_id = $1', [store]);
  try { await assert.rejects(quote(), { code: '22023' }); }
  finally { await db.query('UPDATE public.cash_order_settings SET pricing_approved = true, minimum_subtotal_minor = 3000 WHERE store_id = $1', [store]); }
  try { await assert.rejects(quote(), { code: '22023' }); }
  finally { await db.query('UPDATE public.cash_order_settings SET minimum_subtotal_minor = 0 WHERE store_id = $1', [store]); }
});
test('new required meal choices invalidate an unsubmitted quote', async () => {
  const q = await quote();
  const added = (await db.query(`INSERT INTO public.menu_item_options(menu_item_id, name, is_required) VALUES ($1, 'New choice', true) RETURNING id`, [item])).rows[0].id;
  try { await assert.rejects(place(q.quote_id), { code: '22023' }); }
  finally { await db.query('DELETE FROM public.menu_item_options WHERE id = $1', [added]); }
});
test('overlapping retry calls leave one order and one status event', async () => {
  const q = await quote(); const key = randomUUID();
  const results = await asRole(db, 'authenticated', user, () => Promise.all([
    db.query('SELECT public.place_cash_order($1, $2) AS result', [q.quote_id, key]),
    db.query('SELECT public.place_cash_order($1, $2) AS result', [q.quote_id, key]),
  ]));
  assert.deepEqual(results[0].rows[0], results[1].rows[0]);
  const id = results[0].rows[0].result.order_id;
  assert.equal((await db.query('SELECT id FROM public.order_status_events WHERE order_id = $1', [id])).rows.length, 1);
});
