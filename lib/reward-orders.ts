import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { accessTokenFor } from './cash-orders';
import { createRewardRecovery, rewardResultSchema, rewardTicketSchema, rewardLookupSchema, parseRewardClaim, type PendingRewardCommand } from './reward-redemption';
import type { Json } from './types';
export const rewardRecovery = createRewardRecovery(AsyncStorage);
export async function submitRewardCommand(owner: string, command: PendingRewardCommand) {
  const token = await accessTokenFor(owner);
  const request = command.request;
  const query = request.kind === 'reserve'
    ? supabase.rpc('reserve_reward', { p_offer_id: request.offerId, p_command_id: command.commandId })
    : supabase.rpc('operate_reward_reservation', { p_reservation_id: request.reservationId, p_command_id: command.commandId,
      p_expected_version: request.expectedVersion, p_action: request.action, p_details: request.details as Json });
  const { data, error } = await query.setHeader('Authorization', `Bearer ${token}`);
  if (error) throw error;
  return rewardResultSchema.parse(data);
}
export async function getRewardTicket(owner: string, reservationId: string) {
  const token = await accessTokenFor(owner);
  const { data, error } = await supabase.rpc('get_my_reward_ticket', { p_reservation_id: reservationId }).setHeader('Authorization', `Bearer ${token}`);
  if (error) throw error;
  return rewardTicketSchema.parse(data);
}
export async function lookupRewardClaim(owner: string, branchId: string, claimCode: string) {
  const token = await accessTokenFor(owner);
  const { data, error } = await supabase.rpc('lookup_reward_claim', { p_store_id: branchId, p_claim_code: parseRewardClaim(claimCode) }).setHeader('Authorization', `Bearer ${token}`);
  if (error) throw error;
  return rewardLookupSchema.parse(data);
}
export function rewardError(error: unknown) {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    if (error.code === '23505') return 'That GAAP sale or credit note has already been used. Check the branch receipt.';
    if (error.code === '40001') return 'This reservation changed. Refresh and check its latest state.';
  }
  if (typeof error === 'object' && error !== null && 'message' in error) return String(error.message);
  return 'Unable to confirm this reward action. Check the pending action before trying another.';
}
