import { z } from 'zod';

const minor = z.number().int().min(0).max(100000000);
export const cashQuoteSchema = z.object({
  quote_id: z.uuid(), store_id: z.uuid(), branch_name: z.string(),
  currency: z.enum(['USD', 'ZWG']), fulfilment_mode: z.enum(['collection', 'delivery']),
  expires_at: z.string().refine(value => Number.isFinite(Date.parse(value))),
  subtotal_minor: minor, delivery_fee_minor: minor, total_minor: minor,
  estimated_points: z.number().int().nonnegative().default(0), loyalty_earn_configured: z.boolean().default(false),
  contact: z.object({ name: z.string(), phone: z.string() }),
  address: z.object({ address: z.string(), latitude: z.number(), longitude: z.number(), instructions: z.string(), zone_id: z.uuid(), zone_name: z.string() }).nullable(),
  lines: z.array(z.object({
    menu_item_id: z.uuid(), name: z.string(), quantity: z.number().int().positive(),
    unit_price_minor: minor, line_total_minor: minor,
    modifiers: z.array(z.object({ choice_id: z.uuid(), option_id: z.uuid(), option_name: z.string(), name: z.string(), price_adjustment_minor: z.number().int() })),
  })),
});
export type CashQuote = z.infer<typeof cashQuoteSchema>;
export interface CheckoutRequest {
  store_id: string;
  fulfilment_mode: 'collection' | 'delivery';
  contact: { name: string; phone: string };
  address: { address: string; latitude: number; longitude: number; instructions: string } | null;
  lines: { menu_item_id: string; quantity: number; choice_ids: string[] }[];
}
export const orderResultSchema = z.object({ order_id: z.uuid(), status: z.string() });
export type OrderResult = z.infer<typeof orderResultSchema>;
const pendingSchema = z.object({ quoteId: z.uuid(), submissionKey: z.uuid(), cartFingerprint: z.string() });
export type PendingCheckout = z.infer<typeof pendingSchema>;
interface Storage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}
export type SubmitOrder = (quoteId: string, submissionKey: string) => Promise<OrderResult>;

export function snapshotText(value: unknown, field: string): string {
  if (typeof value !== 'object' || value === null || !(field in value)) return '';
  const result = (value as Record<string, unknown>)[field];
  return typeof result === 'string' ? result : '';
}

export function normaliseContactPhone(phone: string) {
  const compact = phone.trim().replace(/[\s()-]/g, '');
  if (/^0[0-9]{9}$/.test(compact)) return `+263${compact.slice(1)}`;
  if (/^263[0-9]{9}$/.test(compact)) return `+${compact}`;
  return compact;
}
export function newSubmissionKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function createCheckoutRecovery(storage: Storage) {
  const keyFor = (userId: string) => `@pogos_pending_cash_order:${userId}`;
  const load = async (userId: string): Promise<PendingCheckout | null> => {
    const raw = await storage.getItem(keyFor(userId));
    if (!raw) return null;
    // A corrupt checkpoint must not silently become permission for a new order.
    return pendingSchema.parse(JSON.parse(raw));
  };
  const recover = async (userId: string, pending: PendingCheckout, submit: SubmitOrder) => {
    try {
      const result = orderResultSchema.parse(await submit(pending.quoteId, pending.submissionKey));
      try {
        await storage.removeItem(keyFor(userId));
      } catch {
        // A confirmed order must still be shown if local cleanup fails. A
        // surviving checkpoint safely resolves to this same order next time.
      }
      return result;
    } catch (error) {
      // These are definitive SQL validation failures. Ambiguous/network/auth
      // failures keep the checkpoint, including a lost successful response.
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === '22023') {
        await storage.removeItem(keyFor(userId));
      }
      throw error;
    }
  };
  return {
    load, recover,
    async place(userId: string, quoteId: string, fingerprint: string, submit: SubmitOrder) {
      const existing = await load(userId);
      if (existing && existing.quoteId !== quoteId) throw new Error('Check your previous order before submitting another one.');
      const pending = existing ?? { quoteId, submissionKey: newSubmissionKey(), cartFingerprint: fingerprint };
      // Persist before the first network request. Failed persistence sends nothing.
      if (!existing) await storage.setItem(keyFor(userId), JSON.stringify(pending));
      return recover(userId, pending, submit);
    },
  };
}
