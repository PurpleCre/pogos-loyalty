import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mergeCartItem, cartFingerprint, checkoutLines, cartForAccount } from '../lib/cart.ts';
import { createCheckoutRecovery, normaliseContactPhone } from '../lib/cash-checkout.ts';
const quote = 'a2000000-0000-4000-8000-000000000001';
const order = { order_id: 'b2000000-0000-4000-8000-000000000002', status: 'pending' };
const meal = { menu_item_id: 'pizza', name: 'Pizza', price: 10, quantity: 1, choice_ids: ['thin'], choice_labels: ['Thin'] };
function fixture() {
  const values = new Map();
  const storage = { getItem: async k => values.get(k) ?? null, setItem: async (k, v) => { values.set(k, v); }, removeItem: async k => { values.delete(k); } };
  return { values, storage, recovery: createCheckoutRecovery(storage) };
}
test('different meal choices remain separate and identical variants merge', () => {
  let cart = mergeCartItem([], meal);
  cart = mergeCartItem(cart, { ...meal, choice_ids: ['thick'], choice_labels: ['Thick'], price: 11 });
  cart = mergeCartItem(cart, meal);
  assert.equal(cart.length, 2);
  assert.equal(cart[0].quantity, 2);
  assert.equal(cart[1].subtotal, 11);
  assert.ok(!('price' in checkoutLines(cart)[0]));
  assert.equal(cartFingerprint(cart), cartFingerprint([...cart].reverse()));
});
test('Zimbabwe local contact numbers are normalised without assuming phone ownership', () => {
  assert.equal(normaliseContactPhone('077 123 4567'), '+263771234567');
  assert.equal(normaliseContactPhone('+263 77 123 4567'), '+263771234567');
});
test('guest selections survive sign-in, while private carts never cross logout/account boundaries', () => {
  const guest = { owner: null, items: mergeCartItem([], meal), storeId: 'msasa' };
  const signedIn = cartForAccount(guest, 'alice');
  assert.equal(signedIn.items.length, 1);
  assert.equal(signedIn.owner, 'alice');
  assert.equal(cartForAccount(signedIn, 'bob').items.length, 0);
  assert.equal(cartForAccount(signedIn, null).items.length, 0);
});
test('lost response survives a fresh client and retries the exact same order reference', async () => {
  const { recovery, storage } = fixture(); let firstKey;
  await assert.rejects(recovery.place('alice', quote, 'cart', async (_q, key) => { firstKey = key; throw new Error('Connection lost after commit'); }));
  const restarted = createCheckoutRecovery(storage);
  const checkpoint = await restarted.load('alice');
  assert.equal(checkpoint.submissionKey, firstKey);
  assert.equal(await restarted.load('bob'), null);
  assert.deepEqual(await restarted.recover('alice', checkpoint, async (q, key) => { assert.equal(q, quote); assert.equal(key, firstKey); return order; }), order);
  assert.equal(await restarted.load('alice'), null);
});
test('storage failure prevents sending an order', async () => {
  const { storage } = fixture(); let calls = 0;
  storage.setItem = async () => { throw new Error('Disk unavailable'); };
  await assert.rejects(createCheckoutRecovery(storage).place('alice', quote, 'cart', async () => { calls++; return order; }));
  assert.equal(calls, 0);
});
test('an unresolved order blocks another quote and validation failures permit requoting', async () => {
  const { recovery } = fixture();
  await assert.rejects(recovery.place('alice', quote, 'cart', async () => { throw new Error('Timeout'); }));
  await assert.rejects(recovery.place('alice', order.order_id, 'other-cart', async () => order), /previous order/);
  const pending = await recovery.load('alice');
  await assert.rejects(recovery.recover('alice', pending, async () => { throw { code: '22023', message: 'Quote expired' }; }));
  assert.equal(await recovery.load('alice'), null);
});
test('an auth/session change never discards an unresolved order checkpoint', async () => {
  const { recovery } = fixture();
  await assert.rejects(recovery.place('alice', quote, 'cart', async () => { throw { code: 'PGRST301', message: 'Session expired' }; }));
  const pending = await recovery.load('alice');
  assert.ok(pending);
  await assert.rejects(recovery.recover('alice', pending, async () => { throw new Error('Account changed'); }));
  assert.deepEqual(await recovery.load('alice'), pending);
});
test('failed checkpoint cleanup never hides a confirmed order', async () => {
  const { storage } = fixture();
  storage.removeItem = async () => { throw new Error('Temporary storage failure'); };
  const recovery = createCheckoutRecovery(storage);
  assert.deepEqual(await recovery.place('alice', quote, 'cart', async () => order), order);
  assert.ok(await recovery.load('alice'));
});
