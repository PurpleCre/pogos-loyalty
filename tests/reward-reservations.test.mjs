import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { createTestDatabase, asRole } from '../scripts/test-database.mjs';
const ids = Array.from({ length: 11 }, (_, i) => `a5000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`);
const [customer, poor, legacy, debtor, staff, otherStaff, admin, store, otherStore, cashier, secondCustomer] = ids;
let db, offer, otherOffer, reward, item, rule, counter = 0;
before(async () => {
  db = await createTestDatabase({ beforeContainment: async d => {
    for (const [user, points] of [[customer, 10000], [poor, 5], [legacy, 1000], [secondCustomer, 1000]]) {
      await d.query('INSERT INTO auth.users(id, email) VALUES ($1, $2)', [user, `${user}@test.invalid`]);
      await d.query('UPDATE public.user_points SET current_points = $2, total_earned = $2 WHERE user_id = $1', [user, points]);
    }
  } });
  for (const user of [debtor, staff, otherStaff, admin, cashier]) await db.query('INSERT INTO auth.users(id, email) VALUES ($1, $2)', [user, `${user}@test.invalid`]);
  await db.query(`INSERT INTO public.stores(id, name, address, distance_miles) VALUES ($1, 'Fixture Msasa', 'Test only', 0), ($2, 'Fixture Westgate', 'Test only', 0)`, [store, otherStore]);
  await db.query(`INSERT INTO public.user_roles(user_id, role, staff_store_id) VALUES ($1, 'staff', $4), ($2, 'staff', $5), ($3, 'admin', NULL), ($6, 'staff', $4)`, [staff, otherStaff, admin, store, otherStore, cashier]);
  await db.exec(`INSERT INTO public.staff_memberships(user_id, store_id) SELECT user_id, staff_store_id FROM public.user_roles WHERE role = 'staff' AND staff_store_id IS NOT NULL ON CONFLICT DO NOTHING`);
  for (const user of [customer, poor, secondCustomer]) await rpc('approve_loyalty_opening', [user, user === poor ? 5 : user === customer ? 10000 : 1000, 'Fixture reviewed opening'], admin);
  await db.query(`INSERT INTO public.reward_branch_settings(store_id, enabled, terms_approved, max_active_per_customer) VALUES ($1, true, true, 20), ($2, true, true, 20)`, [store, otherStore]);
  reward = (await db.query(`INSERT INTO public.rewards(name, points_cost, category, available) VALUES ('Fixture reward', 999, 'food', true) RETURNING id`)).rows[0].id;
  offer = await makeOffer(store, 80, 200);
  otherOffer = await makeOffer(otherStore, 90, 5);
  await db.query(`INSERT INTO public.cash_branch_cashiers(store_id, user_id, active) VALUES ($1, $2, true)`, [store, cashier]);
  await db.query(`INSERT INTO public.cash_order_settings(store_id, currency, enabled, pricing_approved, fulfilment_enabled, acceptance_minutes)
    VALUES ($1, 'USD', true, true, true, 10)`, [store]);
  const category = (await db.query(`INSERT INTO public.menu_categories(name) VALUES ('Fixture menu') RETURNING id`)).rows[0].id;
  item = (await db.query(`INSERT INTO public.menu_items(name, price, category_id, store_id) VALUES ('Fixture meal', 10, $1, $2) RETURNING id`, [category, store])).rows[0].id;
  rule = (await db.query(`INSERT INTO public.cash_loyalty_rules(store_id, currency, basis, points_per_unit, spend_unit_minor, max_points, active)
    VALUES ($1, 'USD', 'subtotal', 10, 100, 1000, true) RETURNING id`, [store])).rows[0].id;
});
after(async () => { await db?.close(); });
async function rpc(name, params = [], actor = customer, role = 'authenticated') {
  return asRole(db, role, actor, async () => (await db.query(`SELECT public.${name}(${params.map((_, i) => `$${i + 1}`).join(',')}) AS result`, params)).rows[0].result,
    { aal: [customer, poor, legacy, debtor, secondCustomer].includes(actor) ? 'aal1' : 'aal2' });
}
async function makeOffer(branch, cost = 80, stock = 5, minutes = 30) {
  return (await db.query(`INSERT INTO public.reward_branch_offers(store_id, reward_id, name, terms, gaap_product_reference, points_cost, reservation_minutes, available_units, enabled)
    VALUES ($1, $2, 'Fixture free item', 'One item, collect at this branch', 'GAAP-TEST-ITEM', $3, $4, $5, true) RETURNING id`, [branch, reward, cost, minutes, stock])).rows[0].id;
}
const reserve = (id = offer, actor = customer, key = randomUUID()) => rpc('reserve_reward', [id, key], actor);
async function row(id) { return (await db.query('SELECT * FROM public.reward_reservations WHERE id = $1', [id])).rows[0]; }
async function balance(user = customer) { return (await db.query('SELECT * FROM public.user_points WHERE user_id = $1', [user])).rows[0]; }
async function stock(id = offer) { return (await db.query('SELECT available_units FROM public.reward_branch_offers WHERE id = $1', [id])).rows[0].available_units; }
async function command(id, action, details = {}, actor = staff, version, key = randomUUID()) {
  return rpc('operate_reward_reservation', [id, key, version ?? (await row(id)).version, action, JSON.stringify(details)], actor);
}
const ticket = (id, actor = customer) => rpc('get_my_reward_ticket', [id], actor);
async function fulfilDetails(id, owner = customer, ref = `2026/T1/REWARD-${++counter}`) {
  const current = await row(id);
  if (current.status === 'reserved') {
    const t = await ticket(id, owner);
    await command(id, 'begin', { claim_code: t.claim_code });
  }
  return { handover_confirmed: true, gaap_reference: ref };
}
async function paidOrder(owner = debtor, saleReference = `2026/T1/CASH-${++counter}`) {
  const q = await rpc('quote_cash_order', [JSON.stringify({ store_id: store, fulfilment_mode: 'collection', contact: { name: 'Test', phone: '+263771234567' }, address: null,
    lines: [{ menu_item_id: item, quantity: 1, choice_ids: [] }] })], owner);
  const result = await rpc('place_cash_order', [q.quote_id, randomUUID()], owner);
  const id = result.order_id;
  for (const [version, action] of ['accept', 'prepare', 'ready'].entries()) await rpc('operate_cash_order', [id, randomUUID(), version, action, '{}'], staff);
  await rpc('operate_cash_order', [id, randomUUID(), 3, 'complete', JSON.stringify({ cash_received: true, handover_confirmed: true, cash_currency: 'USD', tendered_minor: 1000, sale_reference: saleReference })], staff);
  return id;
}
async function refundOrder(id, ref = `2026/T1/CN-${++counter}`) {
  return rpc('operate_cash_order', [id, randomUUID(), 4, 'refund', JSON.stringify({ refund_confirmed: true, refund_source: 'till', credit_note_reference: ref, reason: 'Fixture full cash refund' })], admin);
}

test('reservation atomically holds authoritative points and stock without a redemption transaction', async () => {
  const before = await balance(); const units = await stock();
  const r = await reserve(); const after = await balance();
  assert.equal(r.points_cost, 80); assert.equal(after.current_points, before.current_points - 80);
  assert.equal(after.reserved_points, before.reserved_points + 80); assert.equal(after.total_redeemed, before.total_redeemed);
  assert.equal(await stock(), units - 1);
  assert.equal((await db.query('SELECT id FROM public.transactions WHERE reservation_id = $1', [r.reservation_id])).rows.length, 0);
  assert.deepEqual(await rpc('loyalty_reconciliation', [], admin), []);
});
test('reserve command replays the same reservation after intake closes and rejects changed requests', async () => {
  const key = randomUUID(); const r = await reserve(offer, customer, key); const units = await stock();
  await db.query('UPDATE public.reward_branch_settings SET enabled = false WHERE store_id = $1', [store]);
  try { assert.deepEqual(await reserve(offer, customer, key), r); }
  finally { await db.query('UPDATE public.reward_branch_settings SET enabled = true WHERE store_id = $1', [store]); }
  assert.equal(await stock(), units);
  await assert.rejects(reserve(otherOffer, customer, key), { code: '22023' });
});
test('insufficient and unreviewed balances cannot reserve, even when the template cost differs', async () => {
  const before = await stock();
  await assert.rejects(reserve(offer, poor), { code: '22023' });
  await assert.rejects(reserve(offer, legacy), { code: '22023' });
  assert.equal(await stock(), before);
  assert.equal((await balance(poor)).current_points, 5);
});
test('approved branch settings, opening hours, stock and catalogue eligibility gate new reservations', async () => {
  const empty = await makeOffer(store, 80, 0);
  await assert.rejects(reserve(empty), { code: '22023' });
  for (const [table, column, value, idColumn, id] of [
    ['reward_branch_settings', 'terms_approved', false, 'store_id', store],
    ['reward_branch_offers', 'enabled', false, 'id', offer],
    ['stores', 'is_open', false, 'id', store], ['rewards', 'available', false, 'id', reward],
  ]) {
    await db.query(`UPDATE public.${table} SET ${column} = $1 WHERE ${idColumn} = $2`, [value, id]);
    try { await assert.rejects(reserve(), { code: '22023' }); }
    finally { await db.query(`UPDATE public.${table} SET ${column} = true WHERE ${idColumn} = $1`, [id]); }
  }
});
test('branch offer terms and cost are immutable; existing reservations survive an intake pause', async () => {
  const r = await reserve();
  await assert.rejects(db.query('UPDATE public.reward_branch_offers SET points_cost = 1 WHERE id = $1', [offer]), { code: '42501' });
  await db.query('UPDATE public.reward_branch_offers SET enabled = false WHERE id = $1', [offer]);
  try {
    assert.equal((await ticket(r.reservation_id)).snapshot.name, 'Fixture free item');
    await command(r.reservation_id, 'fulfil', await fulfilDetails(r.reservation_id));
  } finally { await db.query('UPDATE public.reward_branch_offers SET enabled = true WHERE id = $1', [offer]); }
});
test('one remaining stock unit can back only one reservation', async () => {
  const last = await makeOffer(store, 80, 1);
  await reserve(last);
  await assert.rejects(reserve(last, secondCustomer), { code: '22023' });
  assert.equal(await stock(last), 0);
  assert.equal((await db.query('SELECT id FROM public.reward_reservations WHERE offer_id = $1', [last])).rows.length, 1);
});
test('configured active reservation limit is enforced under the account lock', async () => {
  await db.query('UPDATE public.reward_branch_settings SET max_active_per_customer = 1 WHERE store_id = $1', [otherStore]);
  const r = await reserve(otherOffer, secondCustomer);
  try { await assert.rejects(reserve(otherOffer, secondCustomer), { code: '22023' }); }
  finally { await command(r.reservation_id, 'cancel', {}, secondCustomer); }
});
test('claim secret is owner-only, stable for recovery, and absent from list and audit data', async () => {
  const r = await reserve(); const first = await ticket(r.reservation_id);
  assert.ok(first.claim_code); assert.equal((await ticket(r.reservation_id)).claim_code, first.claim_code);
  for (const actor of [secondCustomer, staff, otherStaff, admin]) await assert.rejects(ticket(r.reservation_id, actor), { code: '42501' });
  const rows = await asRole(db, 'authenticated', customer, () => db.query('SELECT * FROM public.reward_reservations WHERE id = $1', [r.reservation_id]));
  assert.ok(!JSON.stringify(rows).includes(first.claim_code));
  for (const role of ['anon', 'authenticated', 'service_role']) await asRole(db, role, customer, async () => {
    await assert.rejects(db.exec('SELECT * FROM public.reward_claim_secrets'), { code: '42501' });
  });
});
test('claim lookup is scoped to branch staff and reveals no secret in the result', async () => {
  const r = await reserve(); const t = await ticket(r.reservation_id);
  const found = await rpc('lookup_reward_claim', [store, t.claim_code], staff);
  assert.equal(found.reservation_id, r.reservation_id); assert.ok(!JSON.stringify(found).includes(t.claim_code));
  await assert.rejects(rpc('lookup_reward_claim', [store, t.claim_code], customer), { code: '42501' });
  await assert.rejects(rpc('lookup_reward_claim', [store, t.claim_code], otherStaff), { code: '42501' });
  await assert.rejects(rpc('lookup_reward_claim', [otherStore, t.claim_code], otherStaff), { code: '22023' });
});
test('fulfilment requires the exact customer claim, handover and a GAAP reference', async () => {
  const r = await reserve(); const details = await fulfilDetails(r.reservation_id);
  for (const invalid of [{ ...details, claim_code: randomUUID() }, { ...details, handover_confirmed: false }, { ...details, gaap_reference: '' }, { ...details, price: 0 }])
    await assert.rejects(command(r.reservation_id, 'fulfil', invalid), { code: '22023' });
  await assert.rejects(command(r.reservation_id, 'fulfil', details, customer), { code: '42501' });
  await assert.rejects(command(r.reservation_id, 'fulfil', details, otherStaff), { code: '42501' });
  assert.equal((await row(r.reservation_id)).status, 'claiming');
});
test('fulfilment settles the hold once, increments gross redeemed and consumes the claim', async () => {
  const r = await reserve(); const details = await fulfilDetails(r.reservation_id); const before = await balance(); const units = await stock(); const key = randomUUID();
  const result = await command(r.reservation_id, 'fulfil', details, staff, 1, key);
  const after = await balance();
  assert.equal(result.status, 'fulfilled'); assert.equal(after.current_points, before.current_points);
  assert.equal(after.reserved_points, before.reserved_points - 80); assert.equal(after.total_redeemed, before.total_redeemed + 80);
  assert.equal(await stock(), units);
  assert.deepEqual(await command(r.reservation_id, 'fulfil', details, staff, 1, key), result);
  await assert.rejects(command(r.reservation_id, 'fulfil', details), { code: '22023' });
  assert.equal((await ticket(r.reservation_id)).claim_code, null);
  const stored = await db.query('SELECT request FROM public.reward_commands WHERE actor_id = $1 AND command_id = $2', [staff, key]);
  assert.ok(!JSON.stringify(stored).includes('claim_code'));
  assert.deepEqual(await rpc('loyalty_reconciliation', [], admin), []);
});
test('customer cancellation releases both points and stock exactly once', async () => {
  const before = await balance(); const units = await stock(); const r = await reserve(); const key = randomUUID();
  const result = await command(r.reservation_id, 'cancel', {}, customer, 0, key);
  assert.equal(result.status, 'cancelled'); assert.equal((await balance()).current_points, before.current_points); assert.equal(await stock(), units);
  assert.deepEqual(await command(r.reservation_id, 'cancel', {}, customer, 0, key), result);
  await assert.rejects(command(r.reservation_id, 'cancel', {}, customer), { code: '22023' });
});
test('branch release requires a reason and cannot cross customer or branch authority', async () => {
  const r = await reserve();
  await assert.rejects(command(r.reservation_id, 'release'), { code: '22023' });
  await assert.rejects(command(r.reservation_id, 'cancel', {}, staff), { code: '42501' });
  await assert.rejects(command(r.reservation_id, 'cancel', {}, secondCustomer), { code: '42501' });
  await assert.rejects(command(r.reservation_id, 'release', { reason: 'No stock' }, otherStaff), { code: '42501' });
  await command(r.reservation_id, 'release', { reason: 'Verified stockout, points released' });
  assert.equal((await row(r.reservation_id)).status, 'cancelled');
});
test('stale versions fail and command references cannot be repurposed across actions', async () => {
  const key = randomUUID(); const r = await reserve(offer, customer, key);
  await assert.rejects(command(r.reservation_id, 'cancel', {}, customer, 1), { code: '40001' });
  await assert.rejects(command(r.reservation_id, 'cancel', {}, customer, 0, key), { code: '22023' });
  await command(r.reservation_id, 'cancel', {}, customer);
});
test('expired rewards cannot be fulfilled and service expiry releases points/stock once', async () => {
  const r = await reserve(); const details = { handover_confirmed: true, gaap_reference: 'UNUSED' }; const before = await balance(); const units = await stock();
  await db.query(`UPDATE public.reward_reservations SET expires_at = now() - interval '1 minute' WHERE id = $1`, [r.reservation_id]);
  await assert.rejects(command(r.reservation_id, 'fulfil', details), { code: '22023' });
  assert.equal((await ticket(r.reservation_id)).claim_code, null);
  await assert.rejects(rpc('expire_reward_reservations', [100], staff), { code: '42501' });
  assert.equal(await rpc('expire_reward_reservations', [100], null, 'service_role'), 1);
  assert.equal(await rpc('expire_reward_reservations', [100], null, 'service_role'), 0);
  assert.equal((await balance()).current_points, before.current_points + 80); assert.equal(await stock(), units + 1);
});
test('customer can release an expired hold without waiting for the worker', async () => {
  const r = await reserve();
  await db.query(`UPDATE public.reward_reservations SET expires_at = now() - interval '1 minute' WHERE id = $1`, [r.reservation_id]);
  assert.equal((await command(r.reservation_id, 'cancel', {}, customer)).status, 'expired');
});
test('normalised GAAP references cannot fulfil two reward reservations', async () => {
  const first = await reserve(); const second = await reserve();
  const reference = ` 2026/t1/reward-${++counter} `;
  await command(first.reservation_id, 'fulfil', await fulfilDetails(first.reservation_id, customer, reference));
  await assert.rejects(command(second.reservation_id, 'fulfil', await fulfilDetails(second.reservation_id, customer, reference.trim().toUpperCase())), { code: '23505' });
  assert.equal((await row(second.reservation_id)).status, 'claiming');
});
test('cash and reward sales share branch fiscal-reference uniqueness', async () => {
  const cashId = await paidOrder(customer);
  const cashRef = (await db.query('SELECT sale_reference FROM public.cash_receipts WHERE order_id = $1', [cashId])).rows[0].sale_reference;
  const r = await reserve();
  await assert.rejects(command(r.reservation_id, 'fulfil', await fulfilDetails(r.reservation_id, customer, cashRef)), { code: '23505' });
  const rewardRef = `2026/T1/REWARD-${++counter}`;
  await command(r.reservation_id, 'fulfil', await fulfilDetails(r.reservation_id, customer, rewardRef));
  await assert.rejects(paidOrder(customer, rewardRef), { code: '23505' });
});
test('purchase refund after reservation creates debt and blocks unsupported handover, while cancellation releases it', async () => {
  const cashId = await paidOrder(debtor); const r = await reserve(offer, debtor);
  await refundOrder(cashId);
  assert.equal((await balance(debtor)).current_points, -80); assert.equal((await balance(debtor)).reserved_points, 80);
  await assert.rejects(fulfilDetails(r.reservation_id, debtor), { code: '22023' });
  await command(r.reservation_id, 'cancel', {}, debtor);
  assert.equal((await balance(debtor)).current_points, 0); assert.equal((await balance(debtor)).reserved_points, 0);
});
test('refund after reward handover records points debt without inventing a second release', async () => {
  const cashId = await paidOrder(debtor); const r = await reserve(offer, debtor);
  await command(r.reservation_id, 'fulfil', await fulfilDetails(r.reservation_id, debtor)); await refundOrder(cashId);
  assert.equal((await balance(debtor)).current_points, -80);
  await assert.rejects(reserve(offer, debtor), { code: '22023' });
  assert.equal((await row(r.reservation_id)).status, 'fulfilled');
});
test('mistaken fulfilment can be voided by admin only with no benefit provided and a credit note', async () => {
  const r = await reserve(); await command(r.reservation_id, 'fulfil', await fulfilDetails(r.reservation_id));
  const before = await balance(); const units = await stock();
  const details = { benefit_not_provided: true, credit_note_reference: `2026/T1/CN-${++counter}`, reason: 'Wrong confirmation; customer received no item' };
  await assert.rejects(command(r.reservation_id, 'void', details), { code: '42501' });
  await assert.rejects(command(r.reservation_id, 'void', { ...details, benefit_not_provided: false }, admin), { code: '22023' });
  await command(r.reservation_id, 'void', details, admin);
  const after = await balance(); assert.equal(after.current_points, before.current_points + 80); assert.equal(after.total_redeemed, before.total_redeemed);
  assert.equal(await stock(), units + 1); assert.equal((await row(r.reservation_id)).status, 'voided');
  await assert.rejects(command(r.reservation_id, 'void', details, admin), { code: '22023' });
  assert.deepEqual(await rpc('loyalty_reconciliation', [], admin), []);
});
test('cash refunds and reward voids cannot reuse a credit note', async () => {
  const cashId = await paidOrder(customer); const ref = `2026/T1/CN-${++counter}`; await refundOrder(cashId, ref);
  const r = await reserve(); await command(r.reservation_id, 'fulfil', await fulfilDetails(r.reservation_id));
  await assert.rejects(command(r.reservation_id, 'void', { benefit_not_provided: true, credit_note_reference: ref, reason: 'No benefit provided' }, admin), { code: '23505' });
  assert.equal((await row(r.reservation_id)).status, 'fulfilled');
});
test('ledger failure rolls back reservation stock, secret, event and command', async () => {
  const before = await balance(); const units = await stock(); const key = randomUUID();
  await db.exec(`CREATE FUNCTION public.test_reward_failure() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN
    IF NEW.kind = 'reward_hold' THEN RAISE EXCEPTION 'Simulated ledger failure'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER test_reward_failure BEFORE INSERT ON public.loyalty_ledger FOR EACH ROW EXECUTE FUNCTION public.test_reward_failure()`);
  try {
    await assert.rejects(reserve(offer, customer, key));
    assert.equal(await stock(), units); assert.deepEqual(await balance(), before);
    assert.equal((await db.query('SELECT * FROM public.reward_commands WHERE command_id = $1', [key])).rows.length, 0);
    assert.equal((await db.query('SELECT count(*) AS count FROM public.reward_reservations r LEFT JOIN public.reward_claim_secrets s ON s.reservation_id = r.id WHERE s.reservation_id IS NULL')).rows[0].count, 0);
  } finally { await db.exec('DROP TRIGGER test_reward_failure ON public.loyalty_ledger; DROP FUNCTION public.test_reward_failure()'); }
  await reserve(offer, customer, key);
});
test('failed fulfilment rolls back GAAP reference, transaction and hold settlement', async () => {
  const r = await reserve(); const details = await fulfilDetails(r.reservation_id); const before = await balance(); const key = randomUUID();
  await db.exec(`CREATE FUNCTION public.test_reward_failure() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN
    IF NEW.kind = 'reward_redeem' THEN RAISE EXCEPTION 'Simulated ledger failure'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER test_reward_failure BEFORE INSERT ON public.loyalty_ledger FOR EACH ROW EXECUTE FUNCTION public.test_reward_failure()`);
  try {
    await assert.rejects(command(r.reservation_id, 'fulfil', details, staff, 0, key));
    assert.deepEqual(await balance(), before); assert.equal((await row(r.reservation_id)).status, 'claiming');
    for (const table of ['reward_fulfilments', 'transactions']) assert.equal((await db.query(`SELECT * FROM public.${table} WHERE reservation_id = $1`, [r.reservation_id])).rows.length, 0);
    assert.equal((await db.query('SELECT * FROM public.branch_fiscal_references WHERE reward_reservation_id = $1', [r.reservation_id])).rows.length, 0);
  } finally { await db.exec('DROP TRIGGER test_reward_failure ON public.loyalty_ledger; DROP FUNCTION public.test_reward_failure()'); }
  await command(r.reservation_id, 'fulfil', details, staff, 1, key);
});
test('direct writes, internal helpers and audit mutation are denied to all API roles', async () => {
  for (const [role, actor] of [['anon', null], ['authenticated', customer], ['authenticated', admin], ['service_role', null]]) {
    await asRole(db, role, actor, async () => {
      await assert.rejects(db.exec('UPDATE public.reward_branch_offers SET available_units = 100000'), { code: '42501' });
      await assert.rejects(db.exec(`UPDATE public.reward_reservations SET status = 'fulfilled'`), { code: '42501' });
      await assert.rejects(db.exec('SELECT public.reward_result(gen_random_uuid())'), { code: '42501' });
      await assert.rejects(db.exec(`SELECT public.release_reward_hold(gen_random_uuid(), NULL, 'cancelled', 'forged')`), { code: '42501' });
    });
  }
  await assert.rejects(db.exec(`UPDATE public.reward_events SET event_type = 'fulfilled'`), { code: '42501' });
  await assert.rejects(db.exec('DELETE FROM public.branch_fiscal_references'), { code: '42501' });
});
test('reservation reads are isolated by customer and staff branch, with internal notes private', async () => {
  const r = await reserve(); await command(r.reservation_id, 'release', { reason: 'Internal support evidence' });
  for (const [actor, visible] of [[customer, true], [secondCustomer, false], [staff, true], [otherStaff, false], [admin, true]]) {
    const data = await asRole(db, 'authenticated', actor, () => db.query('SELECT * FROM public.reward_reservations WHERE id = $1', [r.reservation_id]));
    assert.equal(data.rows.length, visible ? 1 : 0);
  }
  const notes = await asRole(db, 'authenticated', customer, () => db.query('SELECT * FROM public.reward_events WHERE reservation_id = $1', [r.reservation_id]));
  assert.equal(notes.rows.length, 0);
});
test('reconciliation detects reserved-point drift and ends balanced', async () => {
  await db.exec('BEGIN');
  try {
    await db.query('UPDATE public.loyalty_accounts SET reserved_points = reserved_points + 1 WHERE user_id = $1', [customer]);
    await db.query('UPDATE public.user_points SET reserved_points = reserved_points + 1 WHERE user_id = $1', [customer]);
    assert.ok((await rpc('loyalty_reconciliation', [], admin)).some(value => value.user_id === customer));
  } finally { await db.exec('ROLLBACK'); }
  assert.deepEqual(await rpc('loyalty_reconciliation', [], admin), []);
});

test('beginning handover assigns one operator and prevents a second operator using the ticket', async () => {
  const r = await reserve(); const code = (await ticket(r.reservation_id)).claim_code;
  await assert.rejects(command(r.reservation_id, 'begin', { claim_code: randomUUID() }), { code: '22023' });
  const key = randomUUID();
  const result = await command(r.reservation_id, 'begin', { claim_code: code }, staff, 0, key);
  assert.equal(result.status, 'claiming'); assert.equal(result.claimed_by, staff);
  assert.deepEqual(await command(r.reservation_id, 'begin', { claim_code: code }, staff, 0, key), result);
  await assert.rejects(command(r.reservation_id, 'begin', { claim_code: code }, cashier, 0), { code: '40001' });
  await assert.rejects(command(r.reservation_id, 'fulfil', { handover_confirmed: true, gaap_reference: 'UNUSED' }, cashier), { code: '42501' });
  assert.equal((await ticket(r.reservation_id)).claim_code, null);
  await assert.rejects(rpc('lookup_reward_claim', [store, code], staff), { code: '22023' });
});
test('a started handover cannot auto-expire or be cancelled by the customer', async () => {
  const r = await reserve(); await fulfilDetails(r.reservation_id);
  const before = await balance();
  await db.query(`UPDATE public.reward_reservations SET expires_at = now() - interval '1 minute' WHERE id = $1`, [r.reservation_id]);
  assert.equal(await rpc('expire_reward_reservations', [100], null, 'service_role'), 0);
  assert.equal((await row(r.reservation_id)).status, 'claiming'); assert.deepEqual(await balance(), before);
  await assert.rejects(command(r.reservation_id, 'cancel', {}, customer), { code: '22023' });
  await assert.rejects(command(r.reservation_id, 'release', { reason: 'Operator resolution' }), { code: '42501' });
  await assert.rejects(command(r.reservation_id, 'release', { reason: 'Operator resolution', benefit_not_provided: true }, cashier), { code: '42501' });
  await command(r.reservation_id, 'release', { reason: 'Verified no benefit provided', benefit_not_provided: true });
  assert.equal((await row(r.reservation_id)).status, 'cancelled');
});
test('purchase refund after an authorised handover starts preserves debt while allowing truthful completion', async () => {
  const account = randomUUID(); await db.query('INSERT INTO auth.users(id, email) VALUES ($1, $2)', [account, `${account}@test.invalid`]);
  const cashId = await paidOrder(account); const r = await reserve(offer, account);
  const details = await fulfilDetails(r.reservation_id, account);
  await refundOrder(cashId);
  assert.equal((await balance(account)).current_points, -80);
  await command(r.reservation_id, 'fulfil', details);
  assert.equal((await balance(account)).current_points, -80); assert.equal((await balance(account)).reserved_points, 0);
  assert.equal((await row(r.reservation_id)).status, 'fulfilled');
  assert.deepEqual(await rpc('loyalty_reconciliation', [], admin), []);
});
test('supervisor completion of another operator’s started handover requires an override reason', async () => {
  const r = await reserve(); const details = await fulfilDetails(r.reservation_id);
  await assert.rejects(command(r.reservation_id, 'fulfil', details, admin), { code: '42501' });
  await command(r.reservation_id, 'fulfil', { ...details, reason: 'Verified completed handover after operator device failure' }, admin);
  assert.equal((await row(r.reservation_id)).status, 'fulfilled');
});

test('failed hold release rolls back both points and stock, and the same command can retry', async () => {
  const r = await reserve(); const before = await balance(); const units = await stock(); const key = randomUUID();
  await db.exec(`CREATE FUNCTION public.test_reward_failure() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN
    IF NEW.kind = 'reward_release' THEN RAISE EXCEPTION 'Simulated release failure'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER test_reward_failure BEFORE INSERT ON public.loyalty_ledger FOR EACH ROW EXECUTE FUNCTION public.test_reward_failure()`);
  try {
    await assert.rejects(command(r.reservation_id, 'cancel', {}, customer, 0, key));
    assert.deepEqual(await balance(), before); assert.equal(await stock(), units); assert.equal((await row(r.reservation_id)).status, 'reserved');
  } finally { await db.exec('DROP TRIGGER test_reward_failure ON public.loyalty_ledger; DROP FUNCTION public.test_reward_failure()'); }
  await command(r.reservation_id, 'cancel', {}, customer, 0, key);
  assert.equal((await balance()).current_points, before.current_points + 80); assert.equal(await stock(), units + 1);
});
test('failed correction rolls back the credit note and point restoration before a safe retry', async () => {
  const r = await reserve(); await command(r.reservation_id, 'fulfil', await fulfilDetails(r.reservation_id));
  const before = await balance(); const units = await stock(); const key = randomUUID();
  const details = { benefit_not_provided: true, reason: 'Verified mistaken handover record', credit_note_reference: `2026/T1/CN-${++counter}` };
  await db.exec(`CREATE FUNCTION public.test_reward_failure() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN
    IF NEW.kind = 'reward_restore' THEN RAISE EXCEPTION 'Simulated correction failure'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER test_reward_failure BEFORE INSERT ON public.loyalty_ledger FOR EACH ROW EXECUTE FUNCTION public.test_reward_failure()`);
  try {
    await assert.rejects(command(r.reservation_id, 'void', details, admin, 2, key));
    assert.deepEqual(await balance(), before); assert.equal(await stock(), units); assert.equal((await row(r.reservation_id)).status, 'fulfilled');
    assert.equal((await db.query('SELECT * FROM public.reward_voids WHERE reservation_id = $1', [r.reservation_id])).rows.length, 0);
    assert.equal((await db.query(`SELECT * FROM public.branch_fiscal_references WHERE document_type = 'credit_note' AND reward_reservation_id = $1`, [r.reservation_id])).rows.length, 0);
  } finally { await db.exec('DROP TRIGGER test_reward_failure ON public.loyalty_ledger; DROP FUNCTION public.test_reward_failure()'); }
  await command(r.reservation_id, 'void', details, admin, 2, key);
  assert.equal((await balance()).current_points, before.current_points + 80); assert.equal(await stock(), units + 1);
  assert.deepEqual(await rpc('loyalty_reconciliation', [], admin), []);
});
