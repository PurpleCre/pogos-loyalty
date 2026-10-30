import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';
import { verifyWebhookSignature } from '../supabase/functions/_shared/webhook-signature.ts';

const body = '{"transaction_id":"test-sale"}';
const secret = 'test-only-secret';
const signature = createHmac('sha256', secret).update(body).digest('hex');

test('unsigned webhooks are rejected even when a secret is configured', async () => {
  assert.equal(await verifyWebhookSignature(body, null, secret), false);
});
test('a missing secret never bypasses signature verification', async () => {
  assert.equal(await verifyWebhookSignature(body, signature, ''), false);
});
test('valid signatures are accepted in raw and sha256-prefixed formats', async () => {
  assert.equal(await verifyWebhookSignature(body, signature, secret), true);
  assert.equal(await verifyWebhookSignature(body, `sha256=${signature}`, secret), true);
});
test('tampered bodies, wrong secrets and malformed signatures are rejected', async () => {
  for (const [payload, sig, key] of [[body + ' ', signature, secret], [body, signature, 'wrong'], [body, 'bad-signature', secret], [body, '0'.repeat(64), secret]]) {
    assert.equal(await verifyWebhookSignature(payload, sig, key), false);
  }
});
