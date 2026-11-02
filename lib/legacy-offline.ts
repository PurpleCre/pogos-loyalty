export async function legacyQueueNeedsReview(storage: { getItem(key: string): Promise<string | null> }) {
  // Unknown old actions have no trustworthy owner or idempotency receipt. Keep
  // them intact for an authorised investigation; never auto-submit or clear.
  const raw = await storage.getItem('offline_pending_actions');
  if (raw === null) return false;
  if (raw.length > 1000000) return true;
  try { const value = JSON.parse(raw); return !Array.isArray(value) || value.length > 0; } catch { return true; }
}
