import { z } from 'zod';
import { newSubmissionKey } from './cash-checkout.ts';

export const branchSnapshotSchema = z.object({
  store_id: z.uuid(), configured: z.boolean(), enabled: z.boolean(), pricing_approved: z.boolean(),
  fulfilment_enabled: z.boolean(), branch_open: z.boolean(), paused: z.boolean(), version: z.number().int().nonnegative(),
  currency: z.string().nullable(), server_time: z.string(),
  pending: z.object({ count: z.number().int().nonnegative(), signal: z.string(), earliest_deadline: z.string().nullable(), overdue_count: z.number().int().nonnegative() }),
});
export type BranchSnapshot = z.infer<typeof branchSnapshotSchema>;
export const branchMenuItemSchema = z.object({ id: z.uuid(), name: z.string(), category: z.string(), price: z.string(),
  base_available: z.boolean(), branch_available: z.boolean(), version: z.number().int().nonnegative() });
export type BranchMenuItem = z.infer<typeof branchMenuItemSchema>;
export const branchMenuPageSchema = z.object({ store_id: z.uuid(), items: z.array(branchMenuItemSchema), next_after: z.uuid().nullable() });
const commandSchema = z.object({ storeId: z.uuid(), expectedVersion: z.number().int().nonnegative(),
  action: z.enum(['intake', 'availability']), value: z.boolean(), reason: z.string().trim().min(3).max(300), itemId: z.uuid().nullable(),
}).refine(value => (value.action === 'intake') === (value.itemId === null), 'Choose a valid branch action.');
export type BranchCommand = z.infer<typeof commandSchema>;
const pendingSchema = z.object({ commandId: z.uuid(), command: commandSchema });
export type PendingBranchCommand = z.infer<typeof pendingSchema>;
export const branchResultSchema = z.object({ command_id: z.uuid(), store_id: z.uuid(), action: z.enum(['intake', 'availability']),
  menu_item_id: z.uuid().nullable(), value: z.boolean(), version: z.number().int().positive() });
export type BranchResult = z.infer<typeof branchResultSchema>;
interface Storage { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void>; removeItem(key: string): Promise<void> }
type Send = (pending: PendingBranchCommand) => Promise<BranchResult>;
export function createBranchRecovery(storage: Storage) {
  const busy = new Set<string>();
  const key = (owner: string) => `@pogos_pending_branch_command:${owner}`;
  const load = async (owner: string) => {
    const stored = await storage.getItem(key(owner));
    return stored ? pendingSchema.parse(JSON.parse(stored)) : null;
  };
  const send = async (owner: string, pending: PendingBranchCommand, submit: Send) => {
    try {
      const result = branchResultSchema.parse(await submit(pending));
      const command = pending.command;
      if (result.command_id !== pending.commandId || result.store_id !== command.storeId || result.action !== command.action ||
        result.menu_item_id !== command.itemId || result.value !== command.value || result.version !== command.expectedVersion + 1) {
        throw new Error('The branch action response could not be confirmed. Check the saved action.');
      }
      try { await storage.removeItem(key(owner)); } catch { /* Confirmed result; exact retry remains available. */ }
      return result;
    } catch (error) {
      const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
      if (code.startsWith('22') || code.startsWith('23') || code === '40001') await storage.removeItem(key(owner));
      throw error;
    }
  };
  const lock = async <T>(owner: string, action: () => Promise<T>) => {
    if (busy.has(owner)) throw new Error('A branch action is already being checked.');
    busy.add(owner);
    try { return await action(); } finally { busy.delete(owner); }
  };
  return { load,
    execute: (owner: string, request: BranchCommand, submit: Send) => lock(owner, async () => {
      const command = commandSchema.parse(request);
      const existing = await load(owner);
      if (existing && JSON.stringify(existing.command) !== JSON.stringify(command)) throw new Error('Check the previous branch action before making another change.');
      const pending = existing ?? { commandId: newSubmissionKey(), command };
      if (!existing) await storage.setItem(key(owner), JSON.stringify(pending));
      return send(owner, pending, submit);
    }),
    recover: (owner: string, submit: Send) => lock(owner, async () => {
      const pending = await load(owner);
      return pending ? send(owner, pending, submit) : null;
    }),
  };
}

export function queueIsFresh(lastSuccess: number | null, now: number, active: boolean, error: string) {
  return active && !error && lastSuccess !== null && now >= lastSuccess && now - lastSuccess < 45000;
}
// Memory-only acknowledgement silences reminders for this pending batch, never
// accepts an order. A new batch, branch visit or app restart requires attention.
export function createQueueAttention() {
  let signal = ''; let acknowledged = ''; let lastAlert = -Infinity;
  return {
    acknowledge() { acknowledged = signal; },
    observe(nextSignal: string, count: number, now: number) {
      if (signal !== nextSignal) { signal = nextSignal; lastAlert = -Infinity; }
      const needsAttention = count > 0 && signal !== acknowledged;
      const alert = needsAttention && now - lastAlert >= 30000;
      if (alert) lastAlert = now;
      return { needsAttention, alert };
    },
  };
}
