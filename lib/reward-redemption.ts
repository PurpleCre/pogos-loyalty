import { z } from 'zod';
import { newSubmissionKey } from './cash-checkout.ts';

export const rewardStatusSchema = z.enum(['reserved', 'claiming', 'fulfilled', 'cancelled', 'expired', 'voided']);
export const rewardResultSchema = z.object({ reservation_id: z.uuid(), store_id: z.uuid(), status: rewardStatusSchema,
  version: z.number().int().nonnegative(), points_cost: z.number().int().positive(), expires_at: z.string(), claimed_by: z.uuid().nullable() });
export type RewardResult = z.infer<typeof rewardResultSchema>;
export const offerSchema = z.object({ id: z.uuid(), reward_id: z.uuid(), store_id: z.uuid(), name: z.string(), description: z.string(),
  terms: z.string(), points_cost: z.number().int().positive(), reservation_minutes: z.number().int().positive(),
  can_reserve: z.boolean(), category: z.string(), image_url: z.string().nullable() });
export type RewardOffer = z.infer<typeof offerSchema>;
export const rewardSnapshotSchema = z.object({ name: z.string(), description: z.string(), terms: z.string(), gaap_product_reference: z.string(), branch_name: z.string() });
export const rewardTicketSchema = rewardResultSchema.extend({ claim_code: z.uuid().nullable(), snapshot: rewardSnapshotSchema, server_now: z.string() });
export type RewardTicket = z.infer<typeof rewardTicketSchema>;
export const rewardLookupSchema = rewardResultSchema.extend({ snapshot: rewardSnapshotSchema, customer_name: z.string() });
export type RewardLookup = z.infer<typeof rewardLookupSchema>;
const requestSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('reserve'), offerId: z.uuid() }),
  z.object({ kind: z.literal('operate'), reservationId: z.uuid(), expectedVersion: z.number().int().nonnegative(),
    action: z.enum(['cancel', 'release', 'begin', 'fulfil', 'void']), details: z.record(z.string(), z.union([z.string(), z.number().int(), z.boolean()])) }),
]);
export type RewardRequest = z.infer<typeof requestSchema>;
const pendingSchema = z.object({ commandId: z.uuid(), request: requestSchema });
export type PendingRewardCommand = z.infer<typeof pendingSchema>;
export function parseRewardClaim(text: string) {
  const value = text.trim().replace(/^pogos:reward:/, '');
  const parsed = z.uuid().safeParse(value);
  if (!parsed.success) throw new Error('Scan a Pogo’s reward ticket or enter its complete claim code.');
  return parsed.data.toLowerCase();
}
export function remainingTicketMs(ticket: RewardTicket, receivedAt: number, now: number) {
  return Math.max(0, Date.parse(ticket.expires_at) - Date.parse(ticket.server_now) - Math.max(0, now - receivedAt));
}
interface Storage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}
const fingerprint = (request: RewardRequest) => JSON.stringify(request.kind === 'reserve' ? ['reserve', request.offerId] :
  ['operate', request.reservationId, request.expectedVersion, request.action, Object.entries(request.details).sort(([a], [b]) => a.localeCompare(b))]);
type Submit = (command: PendingRewardCommand) => Promise<RewardResult>;
export function createRewardRecovery(storage: Storage) {
  const busy = new Set<string>();
  const keyFor = (owner: string) => `@pogos_pending_reward_command:${owner}`;
  const load = async (owner: string): Promise<PendingRewardCommand | null> => {
    const raw = await storage.getItem(keyFor(owner));
    return raw ? pendingSchema.parse(JSON.parse(raw)) : null;
  };
  const lock = async <T>(owner: string, fn: () => Promise<T>) => {
    if (busy.has(owner)) throw new Error('A reward action is already being checked.');
    busy.add(owner);
    try { return await fn(); } finally { busy.delete(owner); }
  };
  const send = async (owner: string, command: PendingRewardCommand, submit: Submit) => {
    try {
      const result = rewardResultSchema.parse(await submit(command));
      try { await storage.removeItem(keyFor(owner)); } catch { /* a saved key safely replays */ }
      return result;
    } catch (error) {
      const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
      if (code.startsWith('22') || code.startsWith('23') || code === '40001') await storage.removeItem(keyFor(owner));
      throw error;
    }
  };
  return {
    load,
    execute: (owner: string, request: RewardRequest, submit: Submit) => lock(owner, async () => {
      request = requestSchema.parse(request);
      const previous = await load(owner);
      if (previous && fingerprint(previous.request) !== fingerprint(request)) throw new Error('Check the previous reward action before starting another.');
      const pending = previous ?? { commandId: newSubmissionKey(), request };
      if (!previous) await storage.setItem(keyFor(owner), JSON.stringify(pending));
      return send(owner, pending, submit);
    }),
    recover: (owner: string, submit: Submit) => lock(owner, async () => {
      const previous = await load(owner);
      return previous ? send(owner, previous, submit) : null;
    }),
  };
}
