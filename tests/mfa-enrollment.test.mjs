import assert from 'node:assert/strict';
import { test } from 'node:test';
import { emptyMfaSetup, mfaSetupReducer, startTotpSetup, totpEnrollment, mfaFailureMessage } from '../lib/mfa-enrollment.ts';
const setup = { id: 'new-factor', secret: 'local-fixture-key', uri: 'otpauth://totp/Pogos:fixture?secret=local-fixture-key' };
const factor = (id, status = 'unverified', name = totpEnrollment.friendlyName, type = 'totp') => ({ id, factor_type: type, status, friendly_name: name });
function fixture(factors = []) {
  const calls = [];
  const client = {
    async listFactors() { calls.push('list'); return { data: { all: factors }, error: null }; },
    async unenroll({ factorId }) { calls.push(['remove', factorId]); return { error: null }; },
    async enroll(input) { calls.push(['enroll', input]); return { data: { id: setup.id, totp: { secret: setup.secret, uri: setup.uri } }, error: null }; },
  };
  return { client, calls };
}
test('TOTP enrollment supplies a nonempty issuer even when the Auth Site URL has no hostname', async () => {
  assert.equal(new URL('pogos://').hostname, '');
  const { client, calls } = fixture();
  assert.deepEqual(await startTotpSetup(client, async () => {}), { kind: 'new', setup });
  const parameters = calls.find(Array.isArray)[1];
  assert.equal(parameters.factorType, 'totp'); assert.equal(parameters.issuer, 'Pogos');
  assert.ok(parameters.issuer.trim()); assert.ok(!parameters.issuer.includes(':'));
});
test('an existing verified authenticator is used without removing or enrolling any factors', async () => {
  const verified = factor('verified-factor', 'verified');
  const { client, calls } = fixture([factor('unfinished'), verified]);
  assert.deepEqual(await startTotpSetup(client, async () => {}), { kind: 'existing', factor: verified });
  assert.deepEqual(calls, ['list']);
});
test('starting again replaces only unfinished Pogo’s TOTP keys and preserves unrelated factors', async () => {
  const { client, calls } = fixture([factor('own'), factor('other', 'unverified', 'Other app'), factor('phone', 'unverified', totpEnrollment.friendlyName, 'phone')]);
  await startTotpSetup(client, async () => {});
  assert.deepEqual(calls.filter(c => Array.isArray(c) && c[0] === 'remove'), [['remove', 'own']]);
  assert.equal(calls.at(-1)[0], 'enroll');
});
test('account/lifecycle changes before starting or before enrollment send no enrollment request', async () => {
  for (const failAt of [1, 2, 3]) {
    const { client, calls } = fixture(); let checks = 0;
    await assert.rejects(startTotpSetup(client, async () => { if (++checks === failAt) throw Error('Account changed'); }), /Account changed/);
    assert.equal(calls.some(c => Array.isArray(c) && c[0] === 'enroll'), false);
  }
});
test('a late enrollment result cannot expose a setup secret after the app/account changes', async () => {
  const { client } = fixture(); let checks = 0;
  await assert.rejects(startTotpSetup(client, async () => { if (++checks === 4) throw Error('App backgrounded'); }), /App backgrounded/);
});
test('failed factor listing or unfinished-key cleanup prevents creating another key', async () => {
  for (const stage of ['listFactors', 'unenroll']) {
    const { client, calls } = fixture([factor('unfinished')]);
    client[stage] = async () => ({ data: null, error: { code: 'unexpected_failure' } });
    await assert.rejects(startTotpSetup(client, async () => {}), { code: 'unexpected_failure' });
    assert.equal(calls.some(c => Array.isArray(c) && c[0] === 'enroll'), false);
  }
});
test('server enrollment errors retain their machine code for actionable UI feedback', async () => {
  const { client } = fixture(); client.enroll = async () => ({ data: null, error: { code: 'mfa_totp_enroll_not_enabled' } });
  await assert.rejects(startTotpSetup(client, async () => {}), { code: 'mfa_totp_enroll_not_enabled' });
});
test('leaving for an authenticator hides the secret while retaining the pending factor to verify', () => {
  const started = mfaSetupReducer(emptyMfaSetup, { type: 'started', setup });
  const hidden = mfaSetupReducer(started, { type: 'hide' });
  assert.equal(hidden.setup, null); assert.equal(hidden.pendingId, setup.id);
  const resumed = mfaSetupReducer(hidden, { type: 'reconcile', factors: [factor(setup.id)] });
  assert.deepEqual(resumed, hidden); assert.ok(!JSON.stringify(resumed).includes(setup.secret));
});
test('verified, removed or wrong-type pending factors cannot remain as unfinished setup', () => {
  const started = mfaSetupReducer(emptyMfaSetup, { type: 'started', setup });
  for (const factors of [[], [factor(setup.id, 'verified')], [factor(setup.id, 'unverified', '', 'phone')]]) {
    assert.deepEqual(mfaSetupReducer(started, { type: 'reconcile', factors }), emptyMfaSetup);
  }
  assert.deepEqual(mfaSetupReducer(started, { type: 'reset' }), emptyMfaSetup);
});
test('setup errors do not blame a code that has not been requested', () => {
  assert.match(mfaFailureMessage({ code: 'mfa_totp_enroll_not_enabled' }, 'enroll'), /disabled/);
  assert.match(mfaFailureMessage({ code: 'unexpected_failure' }, 'enroll'), /could not create/);
  assert.match(mfaFailureMessage({ code: 'mfa_factor_name_conflict' }, 'enroll'), /existing authenticator/);
  assert.match(mfaFailureMessage({ code: 'invalid_totp_code' }, 'verify'), /six-digit/);
});
test('security feedback never reflects arbitrary server messages, tokens, emails or unknown codes', () => {
  for (const action of ['enroll', 'verify', 'load', 'invite', 'signout']) {
    const text = mfaFailureMessage({ message: 'private-key private@example.test', code: 'private-key' }, action);
    assert.ok(!text.includes('private-key')); assert.ok(!text.includes('private@example.test'));
  }
  assert.ok(!mfaFailureMessage({ code: '__proto__', message: 'secret' }, 'enroll').includes('secret'));
});
