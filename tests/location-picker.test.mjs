import test from 'node:test';
import assert from 'node:assert/strict';
import { validLocationPin, deliveryAddressError, gpsLocationFeedback, recentGpsOptions } from '../lib/location-picker.ts';
const now = 1_800_000_000_000;
const position = (overrides = {}) => ({ timestamp: now, coords: { latitude: -17.8252, longitude: 31.0335, accuracy: 20 }, ...overrides });

test('pin validation accepts real coordinate boundaries and rejects missing or non-finite pins', () => {
  for (const pin of [{ latitude: 0, longitude: 0 }, { latitude: -90, longitude: 180 }, { latitude: 90, longitude: -180 }]) assert.equal(validLocationPin(pin), true);
  for (const pin of [null, undefined, { latitude: NaN, longitude: 31 }, { latitude: 10, longitude: Infinity }, { latitude: -91, longitude: 31 }, { latitude: 10, longitude: 181 }]) assert.equal(validLocationPin(pin), false);
});
test('a map placeholder cannot substitute for a useful written delivery address', () => {
  for (const value of ['', '   ', 'abcd', ' Selected from map ', 'UNKNOWN ADDRESS']) assert.match(deliveryAddressError(value), /written delivery address/);
  assert.equal(deliveryAddressError('  94 Mutare Road, Msasa, front entrance  '), '');
});
test('stale or invalid GPS results cannot replace the customer’s pin', () => {
  assert.equal(gpsLocationFeedback(position({ timestamp: now - recentGpsOptions.maxAge - 1 }), now).usable, false);
  assert.equal(gpsLocationFeedback(position({ timestamp: NaN }), now).usable, false);
  assert.equal(gpsLocationFeedback(position({ timestamp: now + 6000 }), now).usable, false);
  assert.equal(gpsLocationFeedback(position({ coords: { latitude: 91, longitude: 31, accuracy: 10 } }), now).usable, false);
});
test('recent cached GPS results disclose their age and precision', () => {
  const feedback = gpsLocationFeedback(position({ timestamp: now - 45000 }), now);
  assert.equal(feedback.usable, true); assert.match(feedback.message, /45 seconds ago/); assert.match(feedback.message, /about 20 m/);
});
test('imprecise GPS results ask customers to place the pin at their entrance', () => {
  const feedback = gpsLocationFeedback(position({ coords: { latitude: -17.8, longitude: 31, accuracy: 900 } }), now);
  assert.equal(feedback.usable, true); assert.match(feedback.message, /about 900 m/); assert.match(feedback.message, /Move the pin/);
});
test('missing or invalid GPS accuracy stays unconfirmed instead of appearing precise', () => {
  for (const accuracy of [null, -1, NaN, Infinity]) {
    const feedback = gpsLocationFeedback(position({ coords: { latitude: -17.8, longitude: 31, accuracy } }), now);
    assert.equal(feedback.usable, true); assert.match(feedback.message, /Accuracy is unavailable/);
  }
});
test('a new GPS fix prompts entrance review and tolerates a small device clock difference', () => {
  const feedback = gpsLocationFeedback(position({ timestamp: now + 1000 }), now);
  assert.equal(feedback.usable, true); assert.match(feedback.message, /just now/); assert.match(feedback.message, /Check the pin is at your entrance/);
});
