import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/lib/types';

export type Store = Tables<'stores'>;

export function useStores() {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => { void fetchStores(); }, []);

  const fetchStores = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: queryError } = await supabase.from('stores').select('*').order('name');
      if (queryError) throw queryError;
      setStores(data ?? []);
    } catch (cause) {
      setStores([]);
      const message = cause instanceof Error ? cause.message : 'Unable to load Pogo’s branches. Please try again.';
      setError(new Error(message));
    } finally {
      setLoading(false);
    }
  };

  return { stores, loading, error, refetch: fetchStores };
}
