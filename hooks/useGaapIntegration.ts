import { logPrivateError } from '@/lib/privacy-logging';
/**
 * useGaapIntegration Hook
 * 
 * Provides GAAP POS integration state for the app.
 * Used by profile screen (link/unlink) and admin panel (config/stats).
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import {
  GaapCustomerLink,
  GaapSyncLogEntry,
  GaapIntegrationStats,
  GaapConfig,
  getGaapCustomerLink,
  linkGaapCustomer,
  unlinkGaapCustomer,
  fetchGaapSyncLog,
  fetchGaapStats,
  getAllGaapConfigs,
  upsertGaapConfig,
  deleteGaapConfig,
  getGaapWebhookUrl,
} from '@/lib/gaap';

export interface UseGaapIntegrationReturn {
  // Customer link state
  customerLink: GaapCustomerLink | null;
  isLinked: boolean;
  linkLoading: boolean;
  linkAccount: (gaapCustomerId: string, phone?: string) => Promise<{ error: string | null }>;
  unlinkAccount: () => Promise<{ error: string | null }>;

  // Admin: Sync log
  syncLog: GaapSyncLogEntry[];
  syncLogLoading: boolean;
  fetchSyncLog: (options?: { status?: string; storeId?: string }) => Promise<void>;

  // Admin: Stats
  stats: GaapIntegrationStats | null;
  statsLoading: boolean;
  fetchStats: () => Promise<void>;

  // Admin: Config
  configs: GaapConfig[];
  configsLoading: boolean;
  fetchConfigs: () => Promise<void>;
  saveConfig: (storeId: string, config: {
    api_key?: string;
    webhook_secret?: string;
    environment?: 'sandbox' | 'production';
    is_active?: boolean;
    gaap_store_id?: string;
  }) => Promise<{ error: string | null }>;
  removeConfig: (storeId: string) => Promise<{ error: string | null }>;

  // Webhook URL
  webhookUrl: string;

  // General
  refetch: () => void;
}

export const useGaapIntegration = (): UseGaapIntegrationReturn => {
  const { user } = useAuth();

  // Customer link state
  const [customerLink, setCustomerLink] = useState<GaapCustomerLink | null>(null);
  const [linkLoading, setLinkLoading] = useState(true);

  // Admin states
  const [syncLog, setSyncLog] = useState<GaapSyncLogEntry[]>([]);
  const [syncLogLoading, setSyncLogLoading] = useState(false);
  const [stats, setStats] = useState<GaapIntegrationStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [configs, setConfigs] = useState<GaapConfig[]>([]);
  const [configsLoading, setConfigsLoading] = useState(false);

  // Load customer link on mount
  useEffect(() => {
    if (user) {
      loadCustomerLink();
    } else {
      setCustomerLink(null);
      setLinkLoading(false);
    }
  }, [user]);

  const loadCustomerLink = async () => {
    if (!user) return;
    setLinkLoading(true);
    try {
      const link = await getGaapCustomerLink(user.id);
      setCustomerLink(link);
    } catch (err) {
      logPrivateError('Error loading GAAP link:', err);
    } finally {
      setLinkLoading(false);
    }
  };

  // Link account
  const linkAccount = async (gaapCustomerId: string, phone?: string) => {
    if (!user) return { error: 'Not authenticated' };
    
    setLinkLoading(true);
    const result = await linkGaapCustomer(user.id, gaapCustomerId, phone, user.email || undefined);
    
    if (!result.error) {
      await loadCustomerLink();
    }
    setLinkLoading(false);
    return result;
  };

  // Unlink account
  const unlinkAccount = async () => {
    if (!user) return { error: 'Not authenticated' };
    
    setLinkLoading(true);
    const result = await unlinkGaapCustomer(user.id);
    
    if (!result.error) {
      setCustomerLink(null);
    }
    setLinkLoading(false);
    return result;
  };

  // Fetch sync log (admin)
  const fetchSyncLogData = useCallback(async (options?: { status?: string; storeId?: string }) => {
    setSyncLogLoading(true);
    const data = await fetchGaapSyncLog(options);
    setSyncLog(data);
    setSyncLogLoading(false);
  }, []);

  // Fetch stats (admin)
  const fetchStatsData = useCallback(async () => {
    setStatsLoading(true);
    const data = await fetchGaapStats();
    setStats(data);
    setStatsLoading(false);
  }, []);

  // Fetch configs (admin)
  const fetchConfigsData = useCallback(async () => {
    setConfigsLoading(true);
    const data = await getAllGaapConfigs();
    setConfigs(data);
    setConfigsLoading(false);
  }, []);

  // Save config
  const saveConfig = async (storeId: string, config: {
    api_key?: string;
    webhook_secret?: string;
    environment?: 'sandbox' | 'production';
    is_active?: boolean;
    gaap_store_id?: string;
  }) => {
    const result = await upsertGaapConfig(storeId, config);
    if (!result.error) {
      await fetchConfigsData();
    }
    return result;
  };

  // Remove config
  const removeConfig = async (storeId: string) => {
    const result = await deleteGaapConfig(storeId);
    if (!result.error) {
      await fetchConfigsData();
    }
    return result;
  };

  // Refresh all data
  const refetch = () => {
    loadCustomerLink();
    fetchStatsData();
    fetchSyncLogData();
    fetchConfigsData();
  };

  return {
    customerLink,
    isLinked: !!customerLink,
    linkLoading,
    linkAccount,
    unlinkAccount,

    syncLog,
    syncLogLoading,
    fetchSyncLog: fetchSyncLogData,

    stats,
    statsLoading,
    fetchStats: fetchStatsData,

    configs,
    configsLoading,
    fetchConfigs: fetchConfigsData,
    saveConfig,
    removeConfig,

    webhookUrl: getGaapWebhookUrl(),

    refetch,
  };
};
