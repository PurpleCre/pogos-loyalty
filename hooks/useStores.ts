import { useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/lib/types';
import { useReadResource } from './useReadResource';
import { createBrowsingCache, storeBrowseSchema } from '@/lib/browsing-cache';
import { runtimeEnvironment } from '@/lib/environment';
export type Store = Tables<'stores'>;
export function useStores() {
  const cache = useMemo(() => createBrowsingCache(AsyncStorage, runtimeEnvironment.name, 'stores', storeBrowseSchema), []);
  const load = useCallback(async (signal: AbortSignal) => {
    const { data, error } = await supabase.from('stores').select('*').neq('name', "Pogo's Closed Branch").order('name').abortSignal(signal);
    if (error) throw error; return storeBrowseSchema.parse(data);
  }, []);
  const resource = useReadResource('public-stores', load, { cache, interval: 30000 });
  return { stores: resource.data ?? [], loading: resource.loading, fresh: resource.fresh, refreshedAt: resource.refreshedAt,
    error: resource.error ? new Error('Branch details could not be refreshed.') : null, refetch: resource.refetch };
}
