export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}
// Bearer tokens stay in memory in browsers. Only short-lived PKCE proof
// material survives a same-tab redirect, using sessionStorage rather than
// localStorage; no access/refresh session is persisted there.
export function createBrowserSessionStorage(legacy: KeyValueStorage, proofs: KeyValueStorage): KeyValueStorage {
  const memory = new Map<string, string>();
  const isProof = (key: string) => key.endsWith('-code-verifier');
  return {
    async getItem(key) {
      await legacy.removeItem(key);
      if (!isProof(key)) return memory.get(key) ?? null;
      const raw = await proofs.getItem(key);
      if (!raw) return null;
      try {
        const record = JSON.parse(raw);
        if (typeof record.value === 'string' && record.expires > Date.now()) return record.value;
      } catch { /* Invalid proof material is discarded. */ }
      await proofs.removeItem(key); return null;
    },
    async setItem(key, value) {
      await legacy.removeItem(key);
      if (isProof(key)) await proofs.setItem(key, JSON.stringify({ value, expires: Date.now() + 3600000 }));
      else memory.set(key, value);
    },
    async removeItem(key) { memory.delete(key); await proofs.removeItem(key); await legacy.removeItem(key); },
  };
}
type Manifest = { version: 1; generation: string; count: number };
const chunkSize = 384; // <=1536 UTF-8 bytes, below historically small Keychain limits.
const maxChunks = 256;
function manifest(value: string | null): Manifest | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (parsed.version === 1 && /^[a-z0-9-]+$/.test(parsed.generation) && Number.isInteger(parsed.count) && parsed.count >= 1 && parsed.count <= maxChunks) return parsed;
  } catch { /* Corrupt manifests never become a usable session. */ }
  return null;
}
// Every chunk lives in SecureStore. A final manifest swap commits a complete
// generation; failed/interrupted writes cannot mix old and refreshed tokens.
export function createSessionStorage(secure: KeyValueStorage, legacy: KeyValueStorage): KeyValueStorage {
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(operation: () => Promise<T>): Promise<T> => {
    const pending = queue.then(operation); queue = pending.catch(() => undefined); return pending;
  };
  const indexKey = (key: string) => `pogos.secure.${key}`;
  const partKey = (key: string, entry: Manifest, part: number) => `${indexKey(key)}.${entry.generation}.${part}`;
  const cleanup = async (key: string, entry: Manifest | null) => {
    if (entry) await Promise.all(Array.from({ length: entry.count }, (_, i) => secure.removeItem(partKey(key, entry, i)).catch(() => undefined)));
  };
  return {
    getItem: key => serial(async () => {
      // Deliberately require sign-in once instead of importing plaintext tokens.
      await legacy.removeItem(key);
      const entry = manifest(await secure.getItem(indexKey(key)));
      if (!entry) return null;
      const parts = await Promise.all(Array.from({ length: entry.count }, (_, i) => secure.getItem(partKey(key, entry, i))));
      if (parts.some(part => part === null)) { await secure.removeItem(indexKey(key)); await cleanup(key, entry); return null; }
      return parts.join('');
    }),
    setItem: (key, value) => serial(async () => {
      if (!value.length || value.length > chunkSize * maxChunks) throw new Error('Session storage value exceeds the supported size.');
      const old = manifest(await secure.getItem(indexKey(key)));
      const characters = Array.from(value); // Never split a surrogate pair across native writes.
      const entry: Manifest = { version: 1, generation: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`, count: Math.ceil(characters.length / chunkSize) };
      try {
        for (let i = 0; i < entry.count; i++) await secure.setItem(partKey(key, entry, i), characters.slice(i * chunkSize, (i + 1) * chunkSize).join(''));
        await secure.setItem(indexKey(key), JSON.stringify(entry));
      } catch (error) { await cleanup(key, entry); throw error; }
      await cleanup(key, old);
      await legacy.removeItem(key);
    }),
    removeItem: key => serial(async () => {
      const old = manifest(await secure.getItem(indexKey(key)));
      await secure.removeItem(indexKey(key));
      await legacy.removeItem(key);
      await cleanup(key, old);
    }),
  };
}
