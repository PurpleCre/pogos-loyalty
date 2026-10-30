import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { createTestDatabase, asRole } from '../scripts/test-database.mjs';

const ids = Array.from({ length: 9 }, (_, i) => `a3000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`);
const [customer, staff, cashier, admin, outsider, store, otherStore, legacy, debtor] = ids;
let db, item, rule, counter = 0;
before(async () => {
  db = await createTestDatabase({ beforeContainment: async d => {
    await d.query(`INSERT INTO auth.users(id, email) VALUES ($1, 'legacy@example.test'), ($2, 'debt@example.test')`, [legacy, debtor]);
    await d.query('UPDATE public.user_points SET current_points = 125, total_earned = 150, total_redeemed = 25 WHERE user_id = $1', [legacy]);
    await d.query('UPDATE public.user_points SET current_points = -5 WHERE user_id = $1', [debtor]);
    await d.exec('GRANT UPDATE (current_points), INSERT (user_id, current_points) ON public.user_points TO service_role');
  } });
  for (const [id, name] of [[customer, 'Customer'], [staff, 'Collector'], [cashier, 'Cashier'], [admin, 'Admin'], [outsider, 'Other staff']]) {
    await db.query(`INSERT INTO auth.users(id, email, raw_user_meta_data) VALUES ($1, $2, $3)`, [id, `${name.replaceAll(' ', '')}@example.test`, JSON.stringify({ full_name: name })]);
  }
  await db.query(`INSERT INTO public.stores(id, name, address, distance_miles) VALUES ($1, 'Fixture Msasa', 'Test only', 0), ($2, 'Fixture Westgate', 'Test only', 0)`, [store, otherStore]);
  await db.query(`INSERT INTO public.user_roles(user_id, role, staff_store_id) VALUES ($1, 'staff', $4), ($2, 'staff', $4), ($3, 'admin', NULL), ($5, 'staff', $6)`, [staff, cashier, admin, store, outsider, otherStore]);
  await db.query(`INSERT INTO public.cash_branch_cashiers(store_id, user_id, active) VALUES ($1, $2, true)`, [store, cashier]);
  await db.query(`INSERT INTO public.cash_order_settings(store_id, currency, enabled, pricing_approved, collection_enabled, delivery_enabled, fulfilment_enabled, acceptance_minutes)
    VALUES ($1, 'USD', true, true, true, true, true, 10)`, [store]);
  await db.query(`INSERT INTO public.cash_delivery_zones(store_id, name, boundary, fee_minor, active)
    VALUES ($1, 'Fixture zone', '((30,-18),(32,-18),(32,-17),(30,-17))', 250, true)`, [store]);
  const category = (await db.query(`INSERT INTO public.menu_categories(name) VALUES ('Test only') RETURNING id`)).rows[0].id;
  item = (await db.query(`INSERT INTO public.menu_items(name, price, category_id, store_id) VALUES ('Fixture Pizza', 10.10, $1, $2) RETURNING id`, [category, store])).rows[0].id;
  rule = (await db.query(`INSERT INTO public.cash_loyalty_rules(store_id, currency, basis, points_per_unit, spend_unit_minor, max_points, active)
    VALUES ($1, 'USD', 'subtotal', 1, 100, 1000, true) RETURNING id`, [store])).rows[0].id;
});
after(async () => { await db?.close(); });

async function rpc(name, params, actor = staff, role = 'authenticated') {
  return asRole(db, role, actor, async () => (await db.query(`SELECT public.${name}(${params.map((_, i) => `$${i + 1}`).join(',')}) AS result`, params)).rows[0].result);
}
async function newOrder(mode = 'collection', owner = customer) {
  const request = { store_id: store, fulfilment_mode: mode, contact: { name: 'Test Customer', phone: '+263771234567' },
    address: mode === 'delivery' ? { address: '12 Test Road', latitude: -17.8, longitude: 31 } : null,
    lines: [{ menu_item_id: item, quantity: 1, choice_ids: [] }] };
  const quote = await rpc('quote_cash_order', [JSON.stringify(request)], owner);
  const result = await rpc('place_cash_order', [quote.quote_id, randomUUID()], owner);
  return { id: result.order_id, quote };
}
async function order(id) { return (await db.query('SELECT * FROM public.orders WHERE id = $1', [id])).rows[0]; }
async function command(id, action, details = {}, actor = staff, expected, key = randomUUID()) {
  return rpc('operate_cash_order', [id, key, expected ?? (await order(id)).version, action, JSON.stringify(details)], actor);
}
async function ready(mode = 'collection', owner = customer) {
  const result = await newOrder(mode, owner);
  await command(result.id, 'accept'); await command(result.id, 'prepare'); await command(result.id, 'ready');
  return result;
}
function cashDetails(reference = `2026-10-30/T1/SALE-${++counter}`) {
  return { cash_received: true, handover_confirmed: true, cash_currency: 'USD', tendered_minor: 2000, sale_reference: reference };
}
async function points(owner = customer) { return (await db.query('SELECT * FROM public.user_points WHERE user_id = $1', [owner])).rows[0]; }

test('cash fulfilment creates an exact receipt, change, single earning and matching projection', async () => {
  const baseline = await points(); const result = await ready();
  assert.equal(result.quote.estimated_points, 10);
  const data = await command(result.id, 'complete', cashDetails());
  assert.equal(data.status, 'completed'); assert.equal(data.payment_status, 'paid'); assert.equal(data.loyalty_status, 'awarded');
  assert.equal(data.points_earned, 10); assert.equal(data.cash_custody_status, 'held');
  const receipt = (await db.query('SELECT * FROM public.cash_receipts WHERE order_id = $1', [result.id])).rows[0];
  assert.equal(receipt.amount_minor, 1010); assert.equal(receipt.change_minor, 990); assert.equal(receipt.current_holder_id, staff);
  assert.equal((await points()).current_points, baseline.current_points + 10);
  assert.equal((await db.query(`SELECT * FROM public.loyalty_ledger WHERE order_id = $1 AND kind = 'earn'`, [result.id])).rows.length, 1);
  assert.equal((await db.query(`SELECT points_earned FROM public.transactions WHERE order_id = $1`, [result.id])).rows[0].points_earned, 10);
  assert.deepEqual(await rpc('loyalty_reconciliation', [], admin), []);
});
test('same command replays once, while changed content and stale versions are rejected', async () => {
  const { id } = await newOrder(); const key = randomUUID();
  const first = await command(id, 'accept', {}, staff, 0, key);
  assert.deepEqual(await command(id, 'accept', {}, staff, 0, key), first);
  await assert.rejects(command(id, 'prepare', {}, staff, 0, key), { code: '22023' });
  await assert.rejects(command(id, 'prepare', {}, staff, 0), { code: '40001' });
  assert.equal((await db.query(`SELECT id FROM public.order_status_events WHERE order_id = $1 AND event_type = 'accept'`, [id])).rows.length, 1);
});
test('customers, other branches and anonymous callers cannot operate orders or invoke internal earning', async () => {
  const { id } = await newOrder();
  for (const actor of [customer, outsider]) await assert.rejects(command(id, 'accept', {}, actor), { code: '42501' });
  await assert.rejects(rpc('operate_cash_order', [id, randomUUID(), 0, 'accept', '{}'], null, 'anon'), { code: '42501' });
  await assert.rejects(rpc('apply_cash_order_earning', [id, staff], staff), { code: '42501' });
});
test('invalid state jumps and unrelated detail fields cannot bypass handover', async () => {
  const { id } = await newOrder();
  for (const action of ['ready', 'prepare', 'complete', 'dispatch']) await assert.rejects(command(id, action, action === 'complete' ? cashDetails() : {}), { code: '22023' });
  await assert.rejects(command(id, 'accept', { cash_received: true }), { code: '22023' });
  assert.equal((await order(id)).version, 0);
});
test('cash handover rejects underpayment, currency mismatch, and missing confirmations or reference', async () => {
  const { id } = await ready();
  for (const details of [
    { ...cashDetails(), tendered_minor: 1000 }, { ...cashDetails(), cash_currency: 'ZWG' },
    { ...cashDetails(), cash_received: false }, { ...cashDetails(), handover_confirmed: false }, { ...cashDetails(), sale_reference: '' },
  ]) await assert.rejects(command(id, 'complete', details), { code: '22023' });
  assert.equal((await order(id)).payment_status, 'unpaid');
  assert.equal((await db.query('SELECT * FROM public.cash_receipts WHERE order_id = $1', [id])).rows.length, 0);
});
test('normalised sale references cannot be reused for another order', async () => {
  const one = await ready(); const two = await ready();
  await command(one.id, 'complete', cashDetails('2026/T1/SAME-REF'));
  await assert.rejects(command(two.id, 'complete', cashDetails(' 2026/t1/same-ref ')), { code: '23505' });
  assert.equal((await order(two.id)).payment_status, 'unpaid');
});
test('delivery requires dispatch to a same-branch collector, who alone confirms cash and handover', async () => {
  const { id } = await ready('delivery');
  await assert.rejects(command(id, 'complete', cashDetails()), { code: '22023' });
  await assert.rejects(command(id, 'dispatch', { collector_id: outsider }), { code: '22023' });
  await command(id, 'dispatch', { collector_id: staff });
  await assert.rejects(command(id, 'complete', cashDetails(), cashier), { code: '42501' });
  await assert.rejects(command(id, 'complete', cashDetails(), admin), { code: '42501' });
  await command(id, 'complete', cashDetails(), staff);
  assert.equal((await order(id)).total_minor, 1260); assert.equal((await order(id)).points_earned, 10);
});
test('cash holder requests handover and only the named authorised cashier acknowledges it', async () => {
  const { id } = await ready(); await command(id, 'complete', cashDetails());
  await assert.rejects(command(id, 'request_cash_handover', { receiver_id: outsider }), { code: '22023' });
  await command(id, 'request_cash_handover', { receiver_id: cashier });
  await assert.rejects(command(id, 'accept_cash_handover', { cash_counted: true, till_reference: 'Till batch' }, staff), { code: '42501' });
  await assert.rejects(command(id, 'accept_cash_handover', { cash_counted: false, till_reference: 'Till batch' }, cashier), { code: '22023' });
  const data = await command(id, 'accept_cash_handover', { cash_counted: true, till_reference: 'Till batch' }, cashier);
  assert.equal(data.cash_custody_status, 'settled');
  assert.equal((await db.query('SELECT current_holder_id FROM public.cash_receipts WHERE order_id = $1', [id])).rows[0].current_holder_id, cashier);
  await assert.rejects(command(id, 'settle_cash', { cash_counted: true, till_reference: 'Again' }, cashier), { code: '22023' });
});
test('a designated cashier can settle cash personally received at collection', async () => {
  const { id } = await ready(); await command(id, 'complete', cashDetails(), cashier);
  const result = await command(id, 'settle_cash', { cash_counted: true, till_reference: 'Counter shift A' }, cashier);
  assert.equal(result.cash_custody_status, 'settled');
});
test('cancellation requires a reason, never awards points and cannot replace a paid refund', async () => {
  const baseline = (await points()).current_points;
  const { id } = await newOrder();
  await assert.rejects(command(id, 'cancel'), { code: '22023' });
  await command(id, 'cancel', { reason: 'Customer requested cancellation' });
  await assert.rejects(command(id, 'accept'), { code: '22023' });
  assert.equal((await points()).current_points, baseline);
  const paid = await ready(); await command(paid.id, 'complete', cashDetails());
  await assert.rejects(command(paid.id, 'cancel', { reason: 'Attempting paid cancellation' }), { code: '22023' });
});
test('overdue orders cannot be accepted and expiry worker is service-only and idempotent', async () => {
  const { id } = await newOrder();
  await db.query(`UPDATE public.orders SET acceptance_deadline = now() - interval '1 minute' WHERE id = $1`, [id]);
  await assert.rejects(command(id, 'accept'), { code: '22023' });
  await assert.rejects(rpc('expire_pending_cash_orders', [100], staff), { code: '42501' });
  assert.ok(await rpc('expire_pending_cash_orders', [100], null, 'service_role') >= 1);
  assert.equal((await order(id)).status, 'cancelled');
  assert.equal(await rpc('expire_pending_cash_orders', [100], null, 'service_role'), 0);
});
test('quoted earning rules are immutable and honoured after being disabled for future quotes', async () => {
  const { id } = await ready();
  await assert.rejects(db.query('UPDATE public.cash_loyalty_rules SET points_per_unit = 99 WHERE id = $1', [rule]), { code: '42501' });
  await db.query('UPDATE public.cash_loyalty_rules SET active = false WHERE id = $1', [rule]);
  try {
    await command(id, 'complete', cashDetails()); assert.equal((await order(id)).points_earned, 10);
    const next = await ready(); assert.equal(next.quote.loyalty_earn_configured, false);
    await command(next.id, 'complete', cashDetails()); assert.equal((await order(next.id)).loyalty_status, 'no_rule');
  } finally { await db.query('UPDATE public.cash_loyalty_rules SET active = true WHERE id = $1', [rule]); }
});
test('legacy openings are preserved and reviewed before a pending earning can settle once', async () => {
  assert.equal((await points(legacy)).current_points, 125);
  const { id } = await ready('collection', legacy); await command(id, 'complete', cashDetails());
  assert.equal((await order(id)).loyalty_status, 'awaiting_review'); assert.equal((await points(legacy)).current_points, 125);
  await assert.rejects(rpc('approve_loyalty_opening', [legacy, 124, 'Checked original balance'], admin), { code: '22023' });
  await assert.rejects(rpc('approve_loyalty_opening', [legacy, 125, 'Checked original balance'], staff), { code: '42501' });
  await rpc('approve_loyalty_opening', [legacy, 125, 'Reconciled with historical evidence'], admin);
  await command(id, 'retry_loyalty', {}, admin); await command(id, 'retry_loyalty', {}, admin);
  assert.equal((await points(legacy)).current_points, 135);
  assert.equal((await db.query(`SELECT id FROM public.loyalty_ledger WHERE order_id = $1 AND kind = 'earn'`, [id])).rows.length, 1);
});
test('full refund is admin-only, reverses the original earn once and retains unsettled cash custody', async () => {
  const baseline = (await points()).current_points;
  const { id } = await ready(); await command(id, 'complete', cashDetails());
  const details = { refund_confirmed: true, refund_source: 'till', credit_note_reference: `CN-${++counter}`, reason: 'Full cash returned to customer' };
  await assert.rejects(command(id, 'refund', details), { code: '42501' });
  await assert.rejects(command(id, 'refund', { ...details, refund_source: 'collector' }, admin), { code: '22023' });
  await command(id, 'refund', details, admin);
  assert.equal((await points()).current_points, baseline);
  const updated = await order(id);
  assert.equal(updated.payment_status, 'refunded'); assert.equal(updated.points_reversed, 10); assert.equal(updated.cash_custody_status, 'held');
  await assert.rejects(command(id, 'refund', details, admin), { code: '22023' });
  assert.equal((await db.query(`SELECT id FROM public.loyalty_ledger WHERE order_id = $1 AND kind = 'reversal'`, [id])).rows.length, 1);
});
test('refunds can restore a reviewed negative opening without blocking the customer cash return', async () => {
  await rpc('approve_loyalty_opening', [debtor, -5, 'Reviewed historical points debt'], admin);
  const { id } = await ready('collection', debtor); await command(id, 'complete', cashDetails());
  assert.equal((await points(debtor)).current_points, 5);
  await command(id, 'refund', { refund_confirmed: true, refund_source: 'till', credit_note_reference: `CN-${++counter}`, reason: 'Return paid cash' }, admin);
  assert.equal((await points(debtor)).current_points, -5);
});
test('ledger failure rolls back cash, state, transaction and command together', async () => {
  const { id } = await ready(); const version = (await order(id)).version; const key = randomUUID(); const details = cashDetails();
  await db.exec(`CREATE FUNCTION public.test_fail_earn() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN
    IF NEW.kind = 'earn' THEN RAISE EXCEPTION 'Simulated ledger outage'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER test_fail_earn BEFORE INSERT ON public.loyalty_ledger FOR EACH ROW EXECUTE FUNCTION public.test_fail_earn()`);
  try {
    await assert.rejects(command(id, 'complete', details, staff, version, key));
    const row = await order(id); assert.equal(row.version, version); assert.equal(row.status, 'ready'); assert.equal(row.payment_status, 'unpaid');
    for (const table of ['cash_receipts', 'cash_movements', 'transactions']) {
      assert.equal((await db.query(`SELECT * FROM public.${table} WHERE order_id = $1`, [id])).rows.length, 0);
    }
    assert.equal((await db.query('SELECT * FROM public.cash_order_commands WHERE command_id = $1', [key])).rows.length, 0);
  } finally { await db.exec('DROP TRIGGER test_fail_earn ON public.loyalty_ledger; DROP FUNCTION public.test_fail_earn()'); }
  await command(id, 'complete', details, staff, version, key);
});
test('audit tables are append-only and untrusted roles cannot alter ledger or projections', async () => {
  await assert.rejects(db.exec(`UPDATE public.cash_receipts SET sale_reference = 'ALTERED'`), { code: '42501' });
  await assert.rejects(db.exec(`UPDATE public.loyalty_ledger SET points_delta = 1 WHERE kind = 'opening'`), { code: '42501' });
  await assert.rejects(db.exec('DELETE FROM public.cash_movements'), { code: '42501' });
  for (const [role, actor] of [['authenticated', customer], ['authenticated', admin], ['service_role', null]]) {
    await asRole(db, role, actor, async () => {
      await assert.rejects(db.query(`INSERT INTO public.loyalty_ledger(user_id, event_key, kind, points_delta) VALUES ($1, 'forged', 'opening', 9999)`, [customer]), { code: '42501' });
      await assert.rejects(db.query('UPDATE public.user_points SET current_points = 9999 WHERE user_id = $1', [customer]), { code: '42501' });
    });
  }
});
test('reconciliation and cash reporting respect branch access and currency boundaries', async () => {
  const summary = await rpc('cash_branch_summary', [store]);
  assert.equal(summary.currencies[0].currency, 'USD');
  assert.equal(summary.currencies[0].net_minor, summary.currencies[0].received_minor - summary.currencies[0].refunded_minor);
  await assert.rejects(rpc('cash_branch_summary', [store], outsider), { code: '42501' });
  await assert.rejects(rpc('loyalty_reconciliation', [], customer), { code: '42501' });
  assert.deepEqual(await rpc('loyalty_reconciliation', [], admin), []);
  await asRole(db, 'authenticated', customer, async () => {
    assert.ok((await db.query('SELECT user_id FROM public.loyalty_ledger')).rows.every(row => row.user_id === customer));
    assert.equal((await db.query('SELECT * FROM public.cash_receipts')).rows.length, 0);
  });
});

test('branch fulfilment and cashier gates reject new orders while preserving existing order recovery', async () => {
  const existing = await newOrder();
  const quote = await rpc('quote_cash_order', [JSON.stringify({ store_id: store, fulfilment_mode: 'collection',
    contact: { name: 'Test Customer', phone: '+263771234567' }, address: null, lines: [{ menu_item_id: item, quantity: 1, choice_ids: [] }] })], customer);
  await db.query('UPDATE public.cash_order_settings SET fulfilment_enabled = false WHERE store_id = $1', [store]);
  try {
    await assert.rejects(rpc('place_cash_order', [quote.quote_id, randomUUID()], customer), { code: '22023' });
    const row = await order(existing.id);
    assert.equal((await rpc('place_cash_order', [row.quote_id, row.submission_key], customer)).order_id, existing.id);
  } finally { await db.query('UPDATE public.cash_order_settings SET fulfilment_enabled = true WHERE store_id = $1', [store]); }
  await db.query('UPDATE public.cash_branch_cashiers SET active = false WHERE store_id = $1', [store]);
  try {
    await assert.rejects(newOrder(), { code: '22023' });
    await assert.rejects(rpc('place_cash_order', [quote.quote_id, randomUUID()], customer), { code: '22023' });
  } finally { await db.query('UPDATE public.cash_branch_cashiers SET active = true WHERE store_id = $1', [store]); }
});
test('delivery supervisor overrides require a reason and record the supervisor as the cash holder', async () => {
  const { id } = await ready('delivery');
  await command(id, 'dispatch', { collector_id: staff });
  await assert.rejects(command(id, 'complete', cashDetails(), admin), { code: '42501' });
  await command(id, 'complete', { ...cashDetails(), reason: 'Supervisor completed delivery and collected cash' }, admin);
  assert.equal((await db.query('SELECT current_holder_id FROM public.cash_receipts WHERE order_id = $1', [id])).rows[0].current_holder_id, admin);
});
test('cash reporting keeps USD and ZWG separate and uses Harare business-day boundaries', async () => {
  const usdBefore = (await rpc('cash_branch_summary', [store])).currencies.find(row => row.currency === 'USD');
  await db.query(`UPDATE public.cash_order_settings SET currency = 'ZWG' WHERE store_id = $1`, [store]);
  try {
    const { id } = await ready();
    assert.equal((await order(id)).currency, 'ZWG');
    await command(id, 'complete', { ...cashDetails(), cash_currency: 'ZWG' });
    const summary = await rpc('cash_branch_summary', [store]);
    assert.deepEqual(summary.currencies.find(row => row.currency === 'USD'), usdBefore);
    const zwg = summary.currencies.find(row => row.currency === 'ZWG');
    assert.equal(zwg.received_minor, 1010); assert.equal(zwg.held_minor, 1010);
    assert.equal(new Date(summary.business_day_start).getUTCHours(), 22);
    assert.equal((await order(id)).loyalty_status, 'no_rule');
  } finally { await db.query(`UPDATE public.cash_order_settings SET currency = 'USD' WHERE store_id = $1`, [store]); }
});
test('refund reference duplicates roll back the second refund without reversing its points', async () => {
  const first = await ready(); const second = await ready();
  await command(first.id, 'complete', cashDetails()); await command(second.id, 'complete', cashDetails());
  const details = { refund_confirmed: true, refund_source: 'till', reason: 'Customer cash returned', credit_note_reference: `2026/T1/CN-${++counter}` };
  await command(first.id, 'refund', details, admin);
  const before = (await points()).current_points;
  await assert.rejects(command(second.id, 'refund', details, admin), { code: '23505' });
  assert.equal((await order(second.id)).payment_status, 'paid');
  assert.equal((await points()).current_points, before);
});
test('reconciliation detects jointly altered projections and independent gross earning drift', async () => {
  await db.query('UPDATE public.loyalty_accounts SET balance = balance + 1 WHERE user_id = $1', [customer]);
  await db.query('UPDATE public.user_points SET current_points = current_points + 1 WHERE user_id = $1', [customer]);
  try { assert.ok((await rpc('loyalty_reconciliation', [], admin)).some(row => row.user_id === customer)); }
  finally {
    await db.query('UPDATE public.loyalty_accounts SET balance = balance - 1 WHERE user_id = $1', [customer]);
    await db.query('UPDATE public.user_points SET current_points = current_points - 1 WHERE user_id = $1', [customer]);
  }
  await db.query('UPDATE public.loyalty_accounts SET earned_gross = earned_gross + 1 WHERE user_id = $1', [customer]);
  await db.query('UPDATE public.user_points SET total_earned = total_earned + 1 WHERE user_id = $1', [customer]);
  try { assert.ok((await rpc('loyalty_reconciliation', [], admin)).some(row => row.user_id === customer)); }
  finally {
    await db.query('UPDATE public.loyalty_accounts SET earned_gross = earned_gross - 1 WHERE user_id = $1', [customer]);
    await db.query('UPDATE public.user_points SET total_earned = total_earned - 1 WHERE user_id = $1', [customer]);
  }
  assert.deepEqual(await rpc('loyalty_reconciliation', [], admin), []);
});
test('reconciliation reports missing balance projections', async () => {
  await db.exec('BEGIN');
  try {
    await db.query('DELETE FROM public.user_points WHERE user_id = $1', [customer]);
    assert.ok((await rpc('loyalty_reconciliation', [], admin)).some(row => row.user_id === customer));
  } finally { await db.exec('ROLLBACK'); }
  assert.deepEqual(await rpc('loyalty_reconciliation', [], admin), []);
});
test('internal staff audit notes stay private to authorised branch operators', async () => {
  const { id } = await newOrder();
  await command(id, 'cancel', { reason: 'Internal support review reference' });
  for (const [actor, count] of [[customer, 0], [outsider, 0], [staff, 2], [admin, 2]]) {
    const rows = await asRole(db, 'authenticated', actor, () => db.query('SELECT * FROM public.order_status_events WHERE order_id = $1', [id]));
    assert.equal(rows.rows.length, count);
  }
});
