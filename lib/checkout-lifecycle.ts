import type { PendingCheckout } from './cash-checkout.ts';

export function createRecoveryReader(load: () => Promise<PendingCheckout | null>, publish: (state: {
  pending: PendingCheckout | null; loading: boolean; blocked: boolean;
}) => void) {
  let version = 0; let active = true;
  return {
    activate() { active = true; },
    invalidate() { ++version; },
    stop() { active = false; ++version; },
    async read() {
      const request = ++version; if (!active) return;
      publish({ pending: null, loading: true, blocked: false });
      try {
        const pending = await load();
        if (active && request === version) publish({ pending, loading: false, blocked: false });
      } catch {
        if (active && request === version) publish({ pending: null, loading: false, blocked: true });
      }
    },
  };
}

export function quoteReviewIsCurrent(review: { draft: string; receivedAt: number; monotonicAt: number; expiresAt: string } | null,
  draft: string, wall: number, monotonic: number, active: boolean) {
  if (!review || !active || review.draft !== draft || wall < review.receivedAt) return false;
  const elapsed = monotonic - review.monotonicAt;
  return Number.isFinite(elapsed) && elapsed >= 0 && elapsed < 300000 && Date.parse(review.expiresAt) > wall;
}
