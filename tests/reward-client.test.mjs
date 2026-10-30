import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRewardRecovery, parseRewardClaim, remainingTicketMs } from '../lib/reward-redemption.ts';
const id = 'a6000000-0000-4000-8000-000000000001';
const store = 'a6000000-0000-4000-8000-000000000002';
const reserve = { kind: 'reserve', offerId: id };
const result = { reservation_id: id, store_id: store, status: 'reserved', version: 0, points_cost: 80, expires_at: '2026-10-31T10:30:00Z', claimed_by: null };
function fixture() {
  const values = new Map();
  const storage = { getItem: async key => values.get(key) ?? null, setItem: async (key, value) => { values.set(key, value); }, removeItem: async key => { values.delete(key); } };
  return { values, storage, recovery: createRewardRecovery(storage) };
}
test('reward scan accepts only the dedicated QR payload or full UUID, never arbitrary links', () => {
  assert.equal(parseRewardClaim(`pogos:reward:${id}`), id); assert.equal(parseRewardClaim(` ${id.toUpperCase()} `), id);
  for (const input of ['', '123456', `https://example.test/${id}`, 'pogos:reward:bad', `pogos:order:${id}`]) assert.throws(() => parseRewardClaim(input));
});
test('ticket countdown uses server time and monotonic elapsed time independently of phone timezone or wall clock', () => {
  const ticket = { ...result, server_now: '2026-10-31T10:20:00Z' };
  assert.equal(remainingTicketMs(ticket, 1000, 61000), 540000);
  assert.equal(remainingTicketMs(ticket, 1000, 1000000), 0);
});
test('interrupted reservation survives restart and returns the same server identity', async () => {
  const { recovery, storage } = fixture(); let command;
  await assert.rejects(recovery.execute('customer', reserve, async value => { command = value; throw new Error('Lost after commit'); }));
  const restarted = createRewardRecovery(storage);
  assert.equal(await restarted.load('other-customer'), null);
  assert.deepEqual(await restarted.recover('customer', async value => { assert.deepEqual(value, command); return result; }), result);
  assert.equal(await restarted.load('customer'), null);
});
test('interrupted staff claim preserves the exact proof and key without permitting a different action', async () => {
  const { recovery } = fixture(); let key;
  const request = { kind: 'operate', reservationId: id, expectedVersion: 0, action: 'begin', details: { claim_code: store } };
  await assert.rejects(recovery.execute('operator', request, async value => { key = value.commandId; throw new Error('Connection lost'); }));
  await assert.rejects(recovery.execute('operator', reserve, async () => result), /previous reward action/);
  await recovery.recover('operator', async value => { assert.equal(value.commandId, key); assert.equal(value.request.details.claim_code, store); return { ...result, status: 'claiming', version: 1, claimed_by: store }; });
});
test('storage failure sends no command; cleanup failure still reports confirmed success', async () => {
  const { storage } = fixture(); let calls = 0;
  storage.setItem = async () => { throw new Error('Disk full'); };
  await assert.rejects(createRewardRecovery(storage).execute('customer', reserve, async () => { calls++; return result; })); assert.equal(calls, 0);
  const other = fixture(); other.storage.removeItem = async () => { throw new Error('Cleanup unavailable'); };
  const recovery = createRewardRecovery(other.storage);
  assert.deepEqual(await recovery.execute('customer', reserve, async () => result), result); assert.ok(await recovery.load('customer'));
});
test('definitive validation/version failures clear checkpoints while auth and transport errors remain', async () => {
  for (const code of ['22023', '23505', '40001', '42501', 'PGRST301', 'NETWORK']) {
    const { recovery } = fixture();
    await assert.rejects(recovery.execute('customer', reserve, async () => { throw { code }; }));
    assert.equal(!!await recovery.load('customer'), ['42501', 'PGRST301', 'NETWORK'].includes(code));
  }
});
test('overlapping submissions cannot replace an actor’s pending reward action', async () => {
  const { recovery } = fixture(); let release; let started;
  const ready = new Promise(resolve => { started = resolve; });
  const first = recovery.execute('customer', reserve, async () => { started(); await new Promise(resolve => { release = resolve; }); return result; });
  await ready;
  await assert.rejects(recovery.execute('customer', reserve, async () => result), /already being checked/);
  release(); await first;
});
test('corrupt checkpoints and malformed responses keep submission blocked until resolved', async () => {
  const { values, recovery } = fixture(); values.set('@pogos_pending_reward_command:customer', '{bad'); let calls = 0;
  await assert.rejects(recovery.execute('customer', reserve, async () => { calls++; return result; })); assert.equal(calls, 0);
  values.clear(); await assert.rejects(recovery.execute('customer', reserve, async () => ({ status: 'reserved' })));
  assert.ok(await recovery.load('customer'));
});
