import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { accessTokenFor } from './cash-orders';
import { createBranchRecovery, branchResultSchema, type PendingBranchCommand } from './branch-operations';

export const branchRecovery = createBranchRecovery(AsyncStorage);
export async function submitBranchCommand(owner: string, pending: PendingBranchCommand) {
  const token = await accessTokenFor(owner);
  const value = pending.command;
  const { data, error } = await supabase.rpc('operate_branch', {
    p_id: pending.commandId, p_store_id: value.storeId, p_expected_version: value.expectedVersion,
    p_action: value.action, p_value: value.value, p_reason: value.reason, p_menu_item_id: value.itemId ?? undefined,
  }).setHeader('Authorization', `Bearer ${token}`);
  if (error) throw error;
  return branchResultSchema.parse(data);
}
