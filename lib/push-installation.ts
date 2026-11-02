import { z } from 'zod';
import { newSubmissionKey } from './cash-checkout.ts';
export const installationSchema = z.object({ id: z.uuid(), secret: z.string().regex(/^[a-f0-9]{64}$/), enabledOwner: z.uuid().nullable(), confirmed: z.boolean().default(false), pendingRevocationOwner: z.uuid().nullable().default(null) });
export type PushInstallation = z.infer<typeof installationSchema>;
interface Storage { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> }
export function createPushInstallationManager(storage: Storage, key: string) {
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(fn: () => Promise<T>) => { const result = queue.then(fn); queue = result.catch(() => {}); return result; };
  const read = async () => { const raw = await storage.getItem(key); return raw ? installationSchema.parse(JSON.parse(raw)) : null; };
  return {
    read: () => serial(read),
    enable: (owner: string, isCurrent: () => boolean, register: (record: PushInstallation) => Promise<void>) => serial(async () => {
      z.uuid().parse(owner);
      const record = await read() ?? { id: newSubmissionKey(), secret: `${newSubmissionKey()}${newSubmissionKey()}`.replaceAll('-', ''), enabledOwner: null, confirmed: false, pendingRevocationOwner: null };
      if (!isCurrent()) throw Error('Account changed.');
      const next = { ...record, enabledOwner: owner, confirmed: false };
      await storage.setItem(key, JSON.stringify(next)); // Proof must survive a lost registration response.
      if (!isCurrent()) throw Error('Account changed.');
      await register(next);
      if (!isCurrent()) throw Error('Account changed.');
      await storage.setItem(key, JSON.stringify({ ...next, confirmed: true, pendingRevocationOwner: null }));
    }),
    disable: (owner: string, unregister: (record: PushInstallation) => Promise<void>) => serial(async () => {
      const record = await read(); if (!record || (record.enabledOwner !== owner && record.pendingRevocationOwner !== owner)) return;
      if (record.enabledOwner !== null && record.enabledOwner !== owner) return;
      const next = { ...record, enabledOwner: null, confirmed: false, pendingRevocationOwner: owner };
      await storage.setItem(key, JSON.stringify(next));
      await unregister(record); // Local withdrawal remains committed on network failure.
      await storage.setItem(key, JSON.stringify({ ...next, pendingRevocationOwner: null }));
    }),
  };
}
export const transactionPayloadSchema = z.object({ kind: z.literal('pogos-transaction'), event_id: z.uuid(), recipient_id: z.uuid() }).strict();
export const transactionRouteSchema = z.object({ kind: z.enum(['order', 'reward', 'branch']), store_id: z.uuid(), order_id: z.uuid().nullable(), reservation_id: z.uuid().nullable() });
export function notificationDestination(value: unknown) {
  const route = transactionRouteSchema.parse(value);
  if (route.kind === 'order' && route.order_id) return { pathname: '/(app)/order-tracking' as const, params: { orderId: route.order_id } };
  if (route.kind === 'branch' && route.order_id) return { pathname: '/(app)/staff-dashboard' as const, params: { storeId: route.store_id } };
  if (route.kind === 'reward' && route.reservation_id) return { pathname: '/(app)/rewards' as const };
  throw Error('Invalid update destination.');
}
