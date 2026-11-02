export interface ReadState<T> {
  data: T | null;
  refreshedAt: number | null;
  verified: boolean;
  loading: boolean;
  error: boolean;
}
export function readIsFresh<T>(state: ReadState<T>, now = Date.now(), active = true, maxAge = 30000) {
  return active && state.verified && !state.error && state.refreshedAt !== null &&
    now >= state.refreshedAt && now - state.refreshedAt < maxAge;
}
export function accessFailure(error: unknown) {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  const status = error && typeof error === 'object' && 'status' in error ? Number(error.status) : 0;
  return ['42501', 'PGRST301', 'PGRST302', 'PGRST303'].includes(code) || status === 401 || status === 403;
}
// Read requests may expire. Financial writes use their own durable journals and
// must never be replayed or discarded by this controller.
export function createReadResource<T>(load: (signal: AbortSignal) => Promise<T>, options: {
  now?: () => number; timeoutMs?: number; onVerified?: (data: T, at: number) => Promise<void>;
} = {}) {
  const now = options.now ?? Date.now;
  let state: ReadState<T> = { data: null, refreshedAt: null, verified: false, loading: false, error: false };
  let generation = 0; let active = true; let maySeed = true;
  let abort: AbortController | null = null;
  const listeners = new Set<(value: ReadState<T>) => void>();
  const publish = (next: ReadState<T>) => { state = next; for (const listener of listeners) listener(state); };
  const invalidate = () => { ++generation; abort?.abort(); abort = null; publish({ ...state, verified: false, loading: false }); };
  return {
    get: () => state,
    subscribe(listener: (value: ReadState<T>) => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    seed(data: T, at: number) { if (active && maySeed && state.data === null) publish({ ...state, data, refreshedAt: at, verified: false }); },
    activate() { active = true; },
    invalidate,
    stop() { active = false; invalidate(); },
    async refresh() {
      if (!active) return;
      const request = ++generation; abort?.abort(); const controller = new AbortController(); abort = controller;
      let timer: ReturnType<typeof setTimeout> | undefined;
      publish({ ...state, loading: true });
      try {
        const data = await Promise.race([load(controller.signal), new Promise<never>((_, reject) => {
          timer = setTimeout(() => { controller.abort(); reject(new Error('Read timed out')); }, options.timeoutMs ?? 12000);
        })]);
        if (!active || request !== generation) return;
        maySeed = false;
        const at = now(); publish({ data, refreshedAt: at, verified: true, loading: false, error: false });
        // Losing a noncritical browsing cache does not invalidate a server read.
        await options.onVerified?.(data, at).catch(() => undefined);
      } catch (error) {
        if (!active || request !== generation) return;
        maySeed = !accessFailure(error) && state.data === null;
        publish({ ...state, ...(accessFailure(error) ? { data: null, refreshedAt: null } : {}), verified: false, loading: false, error: true });
      } finally { if (timer) clearTimeout(timer); if (request === generation) abort = null; }
    },
  };
}
