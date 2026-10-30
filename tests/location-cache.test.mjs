import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createLocationCache } from '../lib/location-cache.ts';

const location = { id: 'home', address: 'Private test address', latitude: -17.8, longitude: 31 };
function fixture() {
  const values = new Map();
  const cache = createLocationCache({
    getItem: async key => values.get(key) ?? null,
    setItem: async (key, value) => { values.set(key, value); },
    removeItem: async key => { values.delete(key); },
  });
  return { values, cache };
}

test('another account and a guest cannot load the previous customer’s addresses', async () => {
  const { cache } = fixture();
  await cache.write('alice', [location]);
  assert.deepEqual(await cache.read('bob'), []);
  assert.deepEqual(await cache.read(null), []);
  assert.deepEqual(await cache.read('alice'), [location]);
});
test('legacy shared addresses are discarded, never assigned to the next account', async () => {
  const { values, cache } = fixture();
  values.set('@pogos_saved_locations', JSON.stringify([location]));
  assert.deepEqual(await cache.read('bob'), []);
  assert.equal(values.has('@pogos_saved_locations'), false);
});
test('signout cache clearing removes only the departing account’s data', async () => {
  const { cache } = fixture();
  await cache.write('alice', [location]);
  await cache.write('bob', [{ ...location, id: 'bob-home' }]);
  await cache.clear('alice');
  assert.deepEqual(await cache.read('alice'), []);
  assert.equal((await cache.read('bob'))[0].id, 'bob-home');
});
test('corrupt or invalid address entries are not shown', async () => {
  const { cache, values } = fixture();
  values.set('@pogos_locations:alice', 'broken JSON');
  assert.deepEqual(await cache.read('alice'), []);
  values.set('@pogos_locations:alice', JSON.stringify([location, null, { ...location, latitude: 'wrong' }]));
  assert.deepEqual(await cache.read('alice'), [location]);
});
