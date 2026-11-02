import { z } from 'zod';
const price = z.number().finite().nonnegative().max(1000000000);
const text = z.string().max(4000);
const choice = z.object({ id: z.uuid(), option_id: z.uuid(), name: text, price_adjustment: z.number().finite(), is_default: z.boolean(), sort_order: z.number() });
const option = z.object({ id: z.uuid(), menu_item_id: z.uuid(), name: text, is_required: z.boolean(), max_choices: z.number().int().positive(), sort_order: z.number(), menu_item_option_choices: z.array(choice).max(100) });
export const menuBrowseSchema = z.object({
  categories: z.array(z.object({ id: z.uuid(), name: text, sort_order: z.number(), is_active: z.boolean().optional() })).max(300),
  items: z.array(z.object({ id: z.uuid(), category_id: z.uuid(), name: text, description: text, price, image_url: text, is_available: z.boolean(), store_id: z.uuid().nullable().optional(), menu_item_options: z.array(option).max(30).optional() })).max(1500),
});
export interface CacheStorage { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void>; }
export function createBrowsingCache<T>(storage: CacheStorage, environment: string, scope: string, schema: z.ZodType<T>, now = Date.now) {
  const key = `@pogos_browse:v1:${environment}:${scope}`;
  return {
    async read() {
      try {
        const raw = await storage.getItem(key); if (!raw || raw.length > 3000000) return null;
        const record = z.object({ version: z.literal(1), environment: z.string(), scope: z.string(), at: z.number().finite(), data: schema }).parse(JSON.parse(raw));
        if (record.environment !== environment || record.scope !== scope || record.at > now() || now() - record.at > 86400000) return null;
        return { data: record.data, at: record.at };
      } catch { return null; }
    },
    async write(data: T, at: number) {
      const raw = JSON.stringify({ version: 1, environment, scope, at, data: schema.parse(data) });
      if (raw.length > 3000000) throw new Error('Browsing cache is too large');
      await storage.setItem(key, raw);
    },
  };
}

export const storeBrowseSchema = z.array(z.object({
  id: z.uuid(), name: text, address: text, distance_miles: z.number().finite(), is_open: z.boolean(),
  latitude: z.number().finite().nullable(), longitude: z.number().finite().nullable(), created_at: text.nullable(), image_url: text.nullable(),
})).max(100);
