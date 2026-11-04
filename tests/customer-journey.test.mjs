import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkoutFieldErrors } from '../lib/checkout-guidance.ts';
import { normaliseContactPhone } from '../lib/cash-checkout.ts';
import { cartSelectionFingerprint, mergeCartItem, replaceBranchCart } from '../lib/cart.ts';

const request = (overrides = {}) => ({ store_id: 'msasa', fulfilment_mode: 'collection', contact: { name: 'Alex', phone: '+263771234567' }, address: null, lines: [], ...overrides });
test('checkout guidance accepts local Zimbabwe and international numbers after normalisation', () => {
  for (const phone of ['077 123 4567', '+263 77 123 4567', '263771234567', '+27 82 123 4567']) {
    assert.deepEqual(checkoutFieldErrors(request({ contact: { name: 'Alex', phone: normaliseContactPhone(phone) } })), {});
  }
});
test('checkout reports name and phone errors together without accepting unnormalised or incomplete numbers', () => {
  const errors = checkoutFieldErrors(request({ contact: { name: ' ', phone: '077' } }));
  assert.deepEqual(Object.keys(errors), ['name', 'phone']);
  for (const phone of ['+012345678', '+1234567', '+1234567890123456', '0771234567', '12345678']) assert.ok(checkoutFieldErrors(request({ contact: { name: 'Alex', phone } })).phone);
});
test('delivery guidance requires both a real written address and a valid pin', () => {
  assert.deepEqual(Object.keys(checkoutFieldErrors(request({ fulfilment_mode: 'delivery' }))), ['location', 'address']);
  for (const address of ['x', 'Selected from map', ' UNKNOWN ADDRESS ', 'x'.repeat(501)]) {
    assert.ok(checkoutFieldErrors(request({ fulfilment_mode: 'delivery', address: { address, latitude: -17.8, longitude: 31, instructions: '' } })).address);
  }
  for (const [latitude, longitude] of [[NaN, 31], [-17, Infinity], [91, 31], [-17, -181]]) {
    assert.ok(checkoutFieldErrors(request({ fulfilment_mode: 'delivery', address: { address: '94 Mutare Road', latitude, longitude, instructions: '' } })).location);
  }
});
test('collection never requires a saved delivery address or optional instructions', () => {
  assert.deepEqual(checkoutFieldErrors(request()), {});
  assert.deepEqual(checkoutFieldErrors(request({ fulfilment_mode: 'delivery', address: { address: '94 Mutare Road', latitude: -17.8, longitude: 31, instructions: '' } })), {});
  assert.ok(checkoutFieldErrors(request({ fulfilment_mode: 'delivery', address: { address: '94 Mutare Road', latitude: -17.8, longitude: 31, instructions: 'x'.repeat(501) } })).instructions);
});

const meal = { menu_item_id: 'pizza', name: 'Pizza', price: 10, quantity: 1, choice_ids: ['medium'], choice_labels: ['Medium'] };
const cart = () => ({ owner: 'alice', storeId: 'msasa', items: mergeCartItem([], meal) });
test('confirmed branch replacement keeps the owner and replaces only the intended cart', () => {
  const previous = cart();
  const next = replaceBranchCart(previous, cartSelectionFingerprint(previous), 'kamfinsa', { ...meal, choice_ids: ['large'], choice_labels: ['Large'] });
  assert.equal(next.owner, 'alice'); assert.equal(next.storeId, 'kamfinsa');
  assert.deepEqual(next.items[0].choice_ids, ['large']); assert.equal(next.items.length, 1);
  assert.equal(previous.storeId, 'msasa'); assert.deepEqual(previous.items[0].choice_ids, ['medium']);
});
test('a pending branch confirmation cannot overwrite a cart changed in the meantime', () => {
  const previous = cart(), expected = cartSelectionFingerprint(previous);
  for (const changed of [{ ...previous, storeId: 'westgate' }, { ...previous, items: [] }, { ...previous, items: mergeCartItem(previous.items, meal) }]) {
    assert.throws(() => replaceBranchCart(changed, expected, 'kamfinsa', meal), /cart changed/);
  }
});
test('invalid branch replacements fail without removing the existing selections', () => {
  const previous = cart();
  assert.throws(() => replaceBranchCart(previous, cartSelectionFingerprint(previous), 'kamfinsa', { ...meal, quantity: 100 }), /between 1 and 99/);
  assert.equal(previous.items[0].quantity, 1); assert.equal(previous.storeId, 'msasa');
});
