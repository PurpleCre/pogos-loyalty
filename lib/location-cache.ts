export interface LocationRecord {
  id: string;
  address: string;
  latitude: number;
  longitude: number;
  tag?: string | null;
}

interface Storage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

const legacyKey = '@pogos_saved_locations';
const keyFor = (userId: string | null) => `@pogos_locations:${userId ?? 'guest'}`;

const lanes = new WeakMap<object, Map<string, { epoch: number; tail: Promise<unknown> }>>();
function lane(storage: object, owner: string | null) {
  let entries = lanes.get(storage); if (!entries) { entries = new Map(); lanes.set(storage, entries); }
  const key = keyFor(owner); let entry = entries.get(key); if (!entry) { entry = { epoch: 0, tail: Promise.resolve() }; entries.set(key, entry); } return entry;
}
function enqueue<T>(entry: ReturnType<typeof lane>, action: () => Promise<T>) {
  const next = entry.tail.catch(() => undefined).then(action); entry.tail = next; return next;
}
export async function clearLocationCache(storage: Pick<Storage, 'removeItem'>, owner: string | null) {
  const entry = lane(storage, owner); ++entry.epoch;
  const results = await Promise.allSettled([enqueue(entry, () => storage.removeItem(keyFor(owner))), storage.removeItem(legacyKey)]);
  if (results.some(result => result.status === 'rejected')) throw new Error('Location cache cleanup failed.');
}

export function createLocationCache(storage: Storage) {
  const writer = (owner: string | null) => {
    const entry = lane(storage, owner); const epoch = entry.epoch;
    return (locations: LocationRecord[]) => enqueue(entry, async () => { if (entry.epoch === epoch) await storage.setItem(keyFor(owner), JSON.stringify(locations)); });
  };
  return {
    writer,
    async read(userId: string | null): Promise<LocationRecord[]> {
      // Never migrate the old shared cache: its owner cannot be established.
      await storage.removeItem(legacyKey);
      const raw = await storage.getItem(keyFor(userId));
      if (!raw) return [];
      try {
        const data: unknown = JSON.parse(raw);
        if (!Array.isArray(data)) return [];
        return data.filter((entry): entry is LocationRecord =>
          typeof entry === 'object' && entry !== null &&
          typeof entry.id === 'string' && typeof entry.address === 'string' &&
          typeof entry.latitude === 'number' && Number.isFinite(entry.latitude) &&
          typeof entry.longitude === 'number' && Number.isFinite(entry.longitude) &&
          (entry.tag === undefined || entry.tag === null || typeof entry.tag === 'string'));
      } catch {
        return [];
      }
    },
    async write(userId: string | null, locations: LocationRecord[]) {
      await writer(userId)(locations);
    },
    async clear(userId: string | null) {
      await clearLocationCache(storage, userId);
    },
  };
}
