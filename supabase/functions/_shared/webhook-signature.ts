/** Preliminary HMAC contract. Keep GAAP ingestion disabled until vendor approval. */
export async function verifyWebhookSignature(
  body: string,
  signature: string | null,
  secret: string,
): Promise<boolean> {
  if (!signature || !secret) return false;
  const hex = signature.replace(/^sha256=/, '');
  if (!/^[a-fA-F0-9]{64}$/.test(hex)) return false;
  const bytes = Uint8Array.from(hex.match(/.{2}/g)!, value => parseInt(value, 16));
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'],
  );
  return crypto.subtle.verify('HMAC', key, bytes, encoder.encode(body));
}
