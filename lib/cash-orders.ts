import 'react-native-get-random-values';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import type { Json } from './types';
import { cashQuoteSchema, orderResultSchema, createCheckoutRecovery, type CheckoutRequest } from './cash-checkout';

export const checkoutRecovery = createCheckoutRecovery(AsyncStorage);
async function accessTokenFor(owner: string) {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session || session.user.id !== owner) throw new Error('Your account changed. Sign in to check your order.');
  return session.access_token;
}
export async function quoteCashOrder(request: CheckoutRequest, owner: string) {
  const token = await accessTokenFor(owner);
  const { data, error } = await supabase.rpc('quote_cash_order', { p_request: request as unknown as Json })
    .setHeader('Authorization', `Bearer ${token}`);
  if (error) throw error;
  return cashQuoteSchema.parse(data);
}
export async function submitCashOrder(owner: string, quoteId: string, submissionKey: string) {
  const token = await accessTokenFor(owner);
  // Pin the original session; the shared client's identity may change while an
  // interrupted request is awaiting storage/network work. Auth failures keep
  // the original account's recovery checkpoint rather than discarding it.
  const { data, error } = await supabase.rpc('place_cash_order', { p_quote_id: quoteId, p_submission_key: submissionKey })
    .setHeader('Authorization', `Bearer ${token}`);
  if (error) throw error;
  return orderResultSchema.parse(data);
}
export function formatMoney(minor: number, currency: string) {
  return `${currency} ${(minor / 100).toFixed(2)}`;
}
