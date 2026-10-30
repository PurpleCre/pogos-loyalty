import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createStaffRecovery, parseCashMinor } from '../lib/staff-commands.ts';
const request = { orderId: 'a4000000-0000-4000-8000-000000000001', expectedVersion: 3, action: 'complete',
  details: { cash_received: true, handover_confirmed: true, tendered_minor: 2000, cash_currency: 'USD', sale_reference: '2026-10-30/T1/S1' } };
const result = { order_id: request.orderId, status: 'completed', version: 4, payment_status: 'paid', cash_custody_status: 'held', loyalty_status: 'awarded' };
function fixture() {
  const values = new Map();
  const storage = { getItem: async key => values.get(key) ?? null,
    setItem: async (key, value) => { values.set(key, value); }, removeItem: async key => { values.delete(key); } };
  return { values, storage, recovery: createStaffRecovery(storage) };
}
test('cash tender parses exact minor units and rejects rounding, negatives, exponent and overflow', () => {
  assert.equal(parseCashMinor('10.10'), 1010); assert.equal(parseCashMinor('0.29'), 29);
  assert.equal(parseCashMinor(' 20.5 '), 2050); assert.equal(parseCashMinor('2000000'), 200000000);
  for (const text of ['1.005', '-1', '1e3', '1,000', '', 'Infinity', '2000000.01']) assert.throws(() => parseCashMinor(text));
});
test('lost command response survives restart and replays identical reference, body and version', async () => {
  const { recovery, storage } = fixture(); let first;
  await assert.rejects(recovery.execute('collector', request, async value => { first = value; throw new Error('Lost after commit'); }));
  const restarted = createStaffRecovery(storage);
  assert.deepEqual(await restarted.load('collector'), first);
  assert.equal(await restarted.load('cashier'), null);
  assert.deepEqual(await restarted.recover('collector', async value => { assert.deepEqual(value, first); return result; }), result);
  assert.equal(await restarted.load('collector'), null);
});
test('pending action blocks different staff commands and detail ordering does not change identity', async () => {
  const { recovery } = fixture(); let id;
  await assert.rejects(recovery.execute('collector', request, async value => { id = value.commandId; throw new Error('Timeout'); }));
  await assert.rejects(recovery.execute('collector', { ...request, action: 'cancel', details: { reason: 'No customer' } }, async () => result), /previous staff action/);
  const reordered = { ...request, details: Object.fromEntries(Object.entries(request.details).reverse()) };
  await recovery.execute('collector', reordered, async value => { assert.equal(value.commandId, id); return result; });
});
test('persistence failure prevents a financial command from being sent', async () => {
  const { storage } = fixture(); let calls = 0;
  storage.setItem = async () => { throw new Error('Disk unavailable'); };
  await assert.rejects(createStaffRecovery(storage).execute('collector', request, async () => { calls++; return result; }));
  assert.equal(calls, 0);
});
test('validation, duplicate references and stale versions clear failed commands; auth and transport ambiguity remain', async () => {
  for (const code of ['22023', '23505', '40001', '42501', 'PGRST301', 'NETWORK']) {
    const { recovery } = fixture();
    await assert.rejects(recovery.execute('collector', request, async () => { throw { code }; }));
    assert.equal(!!await recovery.load('collector'), ['42501', 'PGRST301', 'NETWORK'].includes(code));
  }
});
test('failed cleanup still reports success and its saved command safely replays', async () => {
  const { storage } = fixture(); storage.removeItem = async () => { throw new Error('Storage failure'); };
  const recovery = createStaffRecovery(storage); let id;
  assert.deepEqual(await recovery.execute('collector', request, async value => { id = value.commandId; return result; }), result);
  assert.ok(await recovery.load('collector'));
  assert.deepEqual(await recovery.recover('collector', async value => { assert.equal(value.commandId, id); return result; }), result);
});
test('overlapping commands for an actor cannot overwrite the pending reference', async () => {
  const { recovery } = fixture(); let release; let started;
  const ready = new Promise(resolve => { started = resolve; });
  const first = recovery.execute('collector', request, async () => { started(); await new Promise(resolve => { release = resolve; }); return result; });
  await ready;
  await assert.rejects(recovery.execute('collector', request, async () => result), /already being checked/);
  release(); await first;
});
test('corrupt recovery data blocks commands and malformed successful responses remain unresolved', async () => {
  const { values, recovery } = fixture();
  values.set('@pogos_pending_staff_command:collector', '{bad');
  let calls = 0;
  await assert.rejects(recovery.execute('collector', request, async () => { calls++; return result; }));
  assert.equal(calls, 0);
  values.clear();
  await assert.rejects(recovery.execute('collector', request, async () => ({ status: 'completed' })));
  assert.ok(await recovery.load('collector'));
});
