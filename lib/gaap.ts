import { logPrivateError } from '@/lib/privacy-logging';
/**
 * GAAP POS Integration Service
 * 
 * Client-side service layer for GAAP integration features.
 * Handles customer linking, sync status, and GAAP config management.
 * 
 * API calls to GAAP Unity will be added once GAAP provides documentation.
 * For now, all GAAP data flows through the webhook → Supabase pipeline.
 */

import { supabase } from '@/lib/supabase';

// ─── Types ───────────────────────────────────────────────────

export interface GaapCustomerLink {
  id: string;
  user_id: string;
  gaap_customer_id: string;
  gaap_customer_phone: string | null;
  gaap_customer_email: string | null;
  linked_at: string;
  verified: boolean;
  last_synced_at: string | null;
}

export interface GaapSyncLogEntry {
  id: string;
  gaap_transaction_id: string;
  gaap_receipt_number: string | null;
  user_id: string | null;
  store_id: string | null;
  points_awarded: number;
  transaction_amount: number | null;
  line_items: any[];
  sync_status: 'success' | 'failed' | 'duplicate' | 'unmatched';
  error_message: string | null;
  synced_at: string;
}

export interface GaapConfig {
  id: string;
  store_id: string | null;
  api_base_url: string;
  api_key: string | null;
  webhook_secret: string | null;
  environment: 'sandbox' | 'production';
  is_active: boolean;
  last_webhook_at: string | null;
  last_sync_error: string | null;
  config_metadata: Record<string, any>;
}

export interface GaapIntegrationStats {
  totalSynced: number;
  totalFailed: number;
  totalUnmatched: number;
  totalPointsAwarded: number;
  linkedCustomers: number;
  lastWebhookAt: string | null;
}

// ─── Customer Linking ────────────────────────────────────────

/**
 * Link the current user's account to their GAAP customer profile.
 * This is how users opt-in to automatic point earning from POS purchases.
 */
export async function linkGaapCustomer(
  userId: string,
  gaapCustomerId: string,
  phone?: string,
  email?: string
): Promise<{ error: string | null }> {
  return { error: 'Please ask your branch to verify your in-store account. Self-service linking is not available yet.' };
}

/** Linking changes require a verified server-side workflow. */
export async function unlinkGaapCustomer(_userId: string): Promise<{ error: string | null }> {
  return { error: 'Please contact your branch to update your in-store account link.' };
}

/**
 * Get the current user's GAAP link status.
 */
export async function getGaapCustomerLink(userId: string): Promise<GaapCustomerLink | null> {
  const { data, error } = await supabase
    .from('gaap_customer_links')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !data) return null;
  return data as GaapCustomerLink;
}

// ─── Sync Log (Admin) ────────────────────────────────────────

/**
 * Fetch recent GAAP sync log entries for the admin panel.
 */
export async function fetchGaapSyncLog(
  options: {
    limit?: number;
    status?: string;
    storeId?: string;
  } = {}
): Promise<GaapSyncLogEntry[]> {
  let query = supabase
    .from('gaap_sync_log')
    .select('*')
    .order('synced_at', { ascending: false })
    .limit(options.limit || 50);

  if (options.status) {
    query = query.eq('sync_status', options.status);
  }

  if (options.storeId) {
    query = query.eq('store_id', options.storeId);
  }

  const { data, error } = await query;

  if (error) {
    logPrivateError('Error fetching sync log:', error);
    return [];
  }

  return (data || []) as GaapSyncLogEntry[];
}

/**
 * Get integration statistics for the admin dashboard.
 */
export async function fetchGaapStats(): Promise<GaapIntegrationStats> {
  const [
    { count: totalSynced },
    { count: totalFailed },
    { count: totalUnmatched },
    { count: linkedCustomers },
  ] = await Promise.all([
    supabase.from('gaap_sync_log').select('id', { count: 'exact', head: true }).eq('sync_status', 'success'),
    supabase.from('gaap_sync_log').select('id', { count: 'exact', head: true }).eq('sync_status', 'failed'),
    supabase.from('gaap_sync_log').select('id', { count: 'exact', head: true }).eq('sync_status', 'unmatched'),
    supabase.from('gaap_customer_links').select('id', { count: 'exact', head: true }),
  ]);

  // Sum of points awarded
  const { data: pointsData } = await supabase
    .from('gaap_sync_log')
    .select('points_awarded')
    .eq('sync_status', 'success');

  const totalPointsAwarded = pointsData?.reduce((sum, row) => sum + (row.points_awarded || 0), 0) || 0;

  // Last webhook timestamp
  const { data: lastWebhook } = await supabase
    .from('gaap_sync_log')
    .select('synced_at')
    .order('synced_at', { ascending: false })
    .limit(1)
    .single();

  return {
    totalSynced: totalSynced || 0,
    totalFailed: totalFailed || 0,
    totalUnmatched: totalUnmatched || 0,
    totalPointsAwarded,
    linkedCustomers: linkedCustomers || 0,
    lastWebhookAt: lastWebhook?.synced_at || null,
  };
}

// ─── GAAP Config (Admin) ─────────────────────────────────────

/**
 * Get GAAP configuration for a specific store.
 */
export async function getGaapConfig(storeId?: string): Promise<GaapConfig | null> {
  let query = supabase.from('gaap_config').select('*');
  
  if (storeId) {
    query = query.eq('store_id', storeId);
  }

  const { data, error } = await query.single();
  if (error || !data) return null;
  return data as GaapConfig;
}

/**
 * Get all GAAP configurations (admin).
 */
export async function getAllGaapConfigs(): Promise<GaapConfig[]> {
  const { data, error } = await supabase
    .from('gaap_config')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return [];
  return (data || []) as GaapConfig[];
}

/**
 * Create or update GAAP configuration for a store.
 */
export async function upsertGaapConfig(
  storeId: string,
  config: {
    api_key?: string;
    webhook_secret?: string;
    environment?: 'sandbox' | 'production';
    is_active?: boolean;
    gaap_store_id?: string;
  }
): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase
      .from('gaap_config')
      .upsert({
        store_id: storeId,
        api_key: config.api_key,
        webhook_secret: config.webhook_secret,
        environment: config.environment || 'sandbox',
        is_active: config.is_active ?? false,
        config_metadata: {
          gaap_store_id: config.gaap_store_id || null,
        },
        updated_at: new Date().toISOString(),
      }, { onConflict: 'store_id' });

    if (error) throw error;
    return { error: null };
  } catch (err: any) {
    return { error: err.message || 'Failed to save GAAP config' };
  }
}

/**
 * Delete GAAP configuration for a store.
 */
export async function deleteGaapConfig(storeId: string): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase
      .from('gaap_config')
      .delete()
      .eq('store_id', storeId);

    if (error) throw error;
    return { error: null };
  } catch (err: any) {
    return { error: err.message || 'Failed to delete GAAP config' };
  }
}

// ─── Webhook URL Helper ──────────────────────────────────────

/**
 * Get the webhook URL that should be registered with GAAP.
 * This is the URL GAAP will POST transaction events to.
 */
export function getGaapWebhookUrl(): string {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
  // Edge functions URL format: {supabase_url}/functions/v1/{function_name}
  return `${supabaseUrl}/functions/v1/gaap-webhook`;
}
