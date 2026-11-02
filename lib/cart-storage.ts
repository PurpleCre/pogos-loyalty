import { z } from 'zod';
import { cartLineId, type CartState } from './cart.ts';
import { cartSelectionFingerprint } from './cart.ts';
interface Storage { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void>; removeItem(key: string): Promise<void> }
const lineSchema = z.object({ menu_item_id: z.uuid(), name: z.string().max(500), price: z.number().finite().nonnegative().max(1000000000),
  quantity: z.number().int().min(1).max(99), choice_ids: z.array(z.uuid()).max(100), choice_labels: z.array(z.string().max(500)).max(100) });
const draftSchema = z.object({ owner: z.string().nullable(), storeId: z.uuid().nullable(), items: z.array(lineSchema).max(100) });
export async function restoreCartSession(session: {
  isCurrent(): boolean; load(): Promise<CartState>; save(cart: CartState): Promise<void>;
}, owner: string | null, guest: CartState | null, clearGuest: () => Promise<void>) {
  let saved = await session.load();
  if (!session.isCurrent()) throw new Error('Cart account changed.');
  if (owner !== null && guest) {
    const visitor = validateSavedCart(guest, null);
    if (!saved.items.length && visitor.items.length) {
      saved = { ...visitor, owner };
      // Keep the original until its replacement is durably stored. Retrying
      // after a kill uses the existing owned copy instead of merging twice.
      await session.save(saved);
    }
    if (!session.isCurrent()) throw new Error('Cart account changed.');
    await clearGuest();
  }
  if (!session.isCurrent()) throw new Error('Cart account changed.');
  return saved;
}
export function validateSavedCart(value: unknown, owner: string | null): CartState {
  const parsed = draftSchema.parse(value);
  if (parsed.owner !== owner || (!!parsed.items.length !== !!parsed.storeId)) throw new Error('Saved cart scope is invalid.');
  const ids = new Set<string>();
  const items = parsed.items.map(item => {
    if (new Set(item.choice_ids).size !== item.choice_ids.length) throw new Error('Saved choices are duplicated.');
    const id = cartLineId(item.menu_item_id, item.choice_ids);
    if (ids.has(id)) throw new Error('Saved cart lines are duplicated.'); ids.add(id);
    return { ...item, id, subtotal: item.price * item.quantity };
  });
  return { ...parsed, items };
}
// Leases fence old-account saves. Serialization prevents queued writes from
// resurrecting a removed cart. Command journals are never touched here.
export function createCartRepository(storage: Storage, environment: string) {
  let generation = 0; let activeOwner: string | null | undefined;
  const queues = new Map<string, Promise<unknown>>();
  const key = (owner: string | null) => `@pogos_cart:v1:${environment}:${owner ?? 'guest'}`;
  const enqueue = <T>(owner: string | null, operation: () => Promise<T>): Promise<T> => {
    const id = key(owner); const previous = queues.get(id) ?? Promise.resolve();
    const task = previous.catch(() => undefined).then(operation); queues.set(id, task);
    void task.finally(() => { if (queues.get(id) === task) queues.delete(id); }).catch(() => undefined);
    return task;
  };
  return {
    async completeSubmission(owner: string, fingerprint: string) {
      await enqueue(owner, async () => {
        const raw = await storage.getItem(key(owner)); if (!raw) return;
        if (raw.length > 1000000) throw new Error('Saved cart is too large.');
        const record = z.object({ version: z.literal(1), environment: z.string(), cart: draftSchema }).parse(JSON.parse(raw));
        if (record.environment !== environment) throw new Error('Saved cart environment changed.');
        const cart = validateSavedCart(record.cart, owner);
        if (cartSelectionFingerprint(cart) !== fingerprint) return;
        await storage.setItem(key(owner), JSON.stringify({ version: 1, environment, cart: { owner, storeId: null, items: [] } }));
      });
    },
    async clearAccount(owner: string | null) {
      if (activeOwner === owner) { ++generation; activeOwner = undefined; }
      await enqueue(owner, () => storage.removeItem(key(owner)));
    },
    open(owner: string | null) {
      const lease = ++generation; activeOwner = owner;
      const isCurrent = () => lease === generation && activeOwner === owner;
      return {
        isCurrent,
        close() { if (isCurrent()) { ++generation; activeOwner = undefined; } },
        async load(): Promise<CartState> {
          return enqueue(owner, async () => {
            const raw = await storage.getItem(key(owner));
            if (!isCurrent()) throw new Error('Cart account changed.');
            if (!raw) return { owner, storeId: null, items: [] };
            if (raw.length > 1000000) throw new Error('Saved cart is too large.');
            const record = z.object({ version: z.literal(1), environment: z.string(), cart: draftSchema }).parse(JSON.parse(raw));
            if (record.environment !== environment) throw new Error('Saved cart environment changed.');
            return validateSavedCart(record.cart, owner);
          });
        },
        async save(value: CartState) {
          const cart = validateSavedCart(value, owner);
          return enqueue(owner, async () => {
            if (!isCurrent()) throw new Error('Cart account changed.');
            await storage.setItem(key(owner), JSON.stringify({ version: 1, environment, cart }));
          });
        },
      };
    },
  };
}
