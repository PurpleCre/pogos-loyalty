import { z } from 'zod';
import { newSubmissionKey } from './cash-checkout.ts';

export const staffActionSchema = z.enum(['accept', 'prepare', 'ready', 'dispatch', 'complete', 'cancel', 'expire',
  'request_cash_handover', 'cancel_cash_handover', 'accept_cash_handover', 'settle_cash', 'refund', 'retry_loyalty']);
export type StaffAction = z.infer<typeof staffActionSchema>;
const commandSchema = z.object({
  orderId: z.uuid(), expectedVersion: z.number().int().nonnegative(), action: staffActionSchema,
  details: z.record(z.string(), z.union([z.string(), z.number().int(), z.boolean()])),
});
export type StaffCommand = z.infer<typeof commandSchema>;
const pendingSchema = commandSchema.extend({ commandId: z.uuid() });
export type PendingStaffCommand = z.infer<typeof pendingSchema>;
export const staffResultSchema = z.object({ order_id: z.uuid(), status: z.string(), version: z.number().int(),
  payment_status: z.string(), cash_custody_status: z.string().nullable(), loyalty_status: z.string() });
export type StaffResult = z.infer<typeof staffResultSchema>;
type Submit = (pending: PendingStaffCommand) => Promise<StaffResult>;
interface Storage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}
const fingerprint = (value: StaffCommand) => JSON.stringify([value.orderId, value.expectedVersion, value.action,
  Object.entries(value.details).sort(([a], [b]) => a.localeCompare(b))]);

export function parseCashMinor(text: string): number {
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(text.trim())) throw new Error('Enter a cash amount with at most two decimal places.');
  const [whole, fraction = ''] = text.trim().split('.');
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (amount > 200000000) throw new Error('Cash amount exceeds the permitted limit.');
  return amount;
}

export function createStaffRecovery(storage: Storage) {
  const busy = new Set<string>();
  const keyFor = (owner: string) => `@pogos_pending_staff_command:${owner}`;
  const load = async (owner: string): Promise<PendingStaffCommand | null> => {
    const value = await storage.getItem(keyFor(owner));
    return value ? pendingSchema.parse(JSON.parse(value)) : null;
  };
  const send = async (owner: string, pending: PendingStaffCommand, submit: Submit) => {
    try {
      const result = staffResultSchema.parse(await submit(pending));
      // Cleanup failure must not hide a confirmed command. The surviving key
      // replays the saved server result on the next check.
      try { await storage.removeItem(keyFor(owner)); } catch { /* replay safely */ }
      return result;
    } catch (error) {
      const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
      // PostgreSQL validation/constraint/version errors roll back the command.
      // Auth and transport failures remain unresolved until checked again.
      if (code.startsWith('22') || code.startsWith('23') || code === '40001') await storage.removeItem(keyFor(owner));
      throw error;
    }
  };
  const lock = async <T>(owner: string, action: () => Promise<T>) => {
    if (busy.has(owner)) throw new Error('An order action is already being checked.');
    busy.add(owner);
    try { return await action(); } finally { busy.delete(owner); }
  };
  return {
    load,
    execute: (owner: string, request: StaffCommand, submit: Submit) => lock(owner, async () => {
      const command = commandSchema.parse(request);
      const existing = await load(owner);
      if (existing && fingerprint(existing) !== fingerprint(command)) throw new Error('Check the previous staff action before starting another.');
      const pending = existing ?? { ...command, commandId: newSubmissionKey() };
      if (!existing) await storage.setItem(keyFor(owner), JSON.stringify(pending));
      return send(owner, pending, submit);
    }),
    recover: (owner: string, submit: Submit) => lock(owner, async () => {
      const pending = await load(owner);
      return pending ? send(owner, pending, submit) : null;
    }),
  };
}
