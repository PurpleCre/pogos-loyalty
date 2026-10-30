import AsyncStorage from '@react-native-async-storage/async-storage';
import { z } from 'zod';
import { supabase } from './supabase';
import { accessTokenFor } from './cash-orders';
import { createStaffRecovery, staffResultSchema, type PendingStaffCommand } from './staff-commands';
import type { Json } from './types';

export const staffRecovery = createStaffRecovery(AsyncStorage);
export const rosterSchema = z.array(z.object({ user_id: z.uuid(), name: z.string(), cashier: z.boolean() }));
export type BranchStaff = z.infer<typeof rosterSchema>[number];
export const branchSummarySchema = z.object({ business_day_start: z.string(), currencies: z.array(z.object({
  currency: z.string(), received_minor: z.number(), refunded_minor: z.number(), net_minor: z.number(),
  settled_minor: z.number(), held_minor: z.number(),
})) });
export type BranchSummary = z.infer<typeof branchSummarySchema>;

export async function submitStaffCommand(owner: string, command: PendingStaffCommand) {
  const token = await accessTokenFor(owner);
  const { data, error } = await supabase.rpc('operate_cash_order', {
    p_order_id: command.orderId, p_command_id: command.commandId, p_expected_version: command.expectedVersion,
    p_action: command.action, p_details: command.details as Json,
  }).setHeader('Authorization', `Bearer ${token}`);
  if (error) throw error;
  return staffResultSchema.parse(data);
}
export function staffError(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    if (error.code === '23505') return 'This sale or credit note reference has already been recorded. Check the GAAP receipt.';
    if (error.code === '40001') return 'This order changed. Refresh it and check the latest state before trying again.';
  }
  if (typeof error === 'object' && error !== null && 'message' in error) return String(error.message);
  return 'Unable to confirm this action. Check the pending action before trying another.';
}
