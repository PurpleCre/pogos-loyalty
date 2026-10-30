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

export function createLocationCache(storage: Storage) {
  return {
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
      await storage.setItem(keyFor(userId), JSON.stringify(locations));
    },
    async clear(userId: string | null) {
      await storage.removeItem(keyFor(userId));
      await storage.removeItem(legacyKey);
    },
  };
}
