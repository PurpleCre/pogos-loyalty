import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { createReadResource, readIsFresh, type ReadState } from '@/lib/read-resource';

export interface ReadCache<T> {
  read(): Promise<{ data: T; at: number } | null>;
  write(data: T, at: number): Promise<void>;
}
export function useReadResource<T>(scope: string, load: (signal: AbortSignal) => Promise<T>, options: {
  enabled?: boolean; interval?: number; cache?: ReadCache<T>;
} = {}) {
  const { enabled = true, interval = 15000, cache } = options;
  const resource = useMemo(() => createReadResource(load, { onVerified: cache?.write }), [load, cache, scope]);
  const [stored, setStored] = useState<{ resource: typeof resource; scope: string; state: ReadState<T> }>({ resource, scope, state: resource.get() });
  const [, setTick] = useState(Date.now());
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    resource.activate(); let alive = true;
    const unsubscribe = resource.subscribe(state => { if (alive) setStored({ resource, scope, state }); });
    if (enabled && cache) void cache.read().then(saved => { if (alive && saved) resource.seed(saved.data, saved.at); }).catch(() => undefined);
    const refresh = () => { if (enabled && AppState.currentState === 'active') void resource.refresh(); };
    refresh();
    const subscription = AppState.addEventListener('change', next => {
      setActive(next === 'active'); resource.invalidate(); if (next === 'active') refresh();
    });
    const timer = setInterval(refresh, interval);
    const clock = setInterval(() => { if (AppState.currentState === 'active') setTick(Date.now()); }, 1000);
    const online = () => { resource.invalidate(); refresh(); };
    const offline = () => resource.invalidate();
    if (Platform.OS === 'web' && typeof window !== 'undefined') { window.addEventListener('online', online); window.addEventListener('offline', offline); }
    return () => {
      alive = false; unsubscribe(); resource.stop(); subscription.remove(); clearInterval(timer); clearInterval(clock);
      if (Platform.OS === 'web' && typeof window !== 'undefined') { window.removeEventListener('online', online); window.removeEventListener('offline', offline); }
    };
  }, [resource, scope, enabled, cache, interval]);
  const refetch = useCallback(async () => { if (enabled && AppState.currentState === 'active') await resource.refresh(); }, [enabled, resource]);
  const state = stored.resource === resource && stored.scope === scope ? stored.state : resource.get();
  return { ...state, loading: enabled && (state.loading || (!state.data && !state.error)), fresh: enabled && readIsFresh(state, Date.now(), active), refetch };
}
