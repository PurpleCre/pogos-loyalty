import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { Text } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { mergeCartItem, cartSelectionFingerprint, replaceBranchCart, type CartItem, type CartState } from '@/lib/cart';
import { Confirmation } from '@/components/ui/confirmation';
import { cartRepository } from '@/lib/cart-persistence';
import { restoreCartSession } from '@/lib/cart-storage';
export type { CartItem } from '@/lib/cart';
interface CartContextType {
  items: CartItem[]; storeId: string | null;
  addToCart(item: Omit<CartItem, 'id' | 'subtotal'>, storeId: string): boolean;
  notice: { text: string; error: boolean } | null; dismissNotice(): void;
  removeFromCart(id: string): void; updateQuantity(id: string, quantity: number): void; clearCart(): void;
  cartTotal: number; itemCount: number; hydrated: boolean; saving: boolean; storageError: string;
  retrySave(): void; discardSavedCart(): void;
  retireSubmittedSelections(fingerprint: string): void;
}
const CartContext = createContext<CartContextType | undefined>(undefined);
export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth(); const owner = user?.id ?? null;
  const guestDraft = useRef<CartState | null>(null);
  return <AccountCart key={owner ?? 'guest'} owner={owner} guestDraft={guestDraft}>{children}</AccountCart>;
}
function AccountCart({ owner, guestDraft, children }: { owner: string | null; guestDraft: React.RefObject<CartState | null>; children: React.ReactNode }) {
  const [cart, setCart] = useState<CartState>({ owner, items: [], storeId: null });
  const latest = useRef(cart); const revision = useRef(0);
  const session = useRef<ReturnType<typeof cartRepository.open> | null>(null);
  const [hydrated, setHydrated] = useState(false); const [saving, setSaving] = useState(false); const [storageError, setError] = useState('');
  const [notice, setNotice] = useState<CartContextType['notice']>(null);
  const [replacement, setReplacement] = useState<{ expected: string; storeId: string; item: Omit<CartItem, 'id' | 'subtotal'> } | null>(null);
  const load = useCallback(async (lease: ReturnType<typeof cartRepository.open>) => {
    const version = ++revision.current; const guest = guestDraft.current;
    setSaving(true); setError('');
    try {
      const saved = await restoreCartSession(lease, owner, guest, () => cartRepository.clearAccount(null));
      if (!lease.isCurrent() || revision.current !== version) return;
      if (owner !== null && guestDraft.current === guest) guestDraft.current = null;
      latest.current = saved; setCart(saved); setHydrated(true);
      if (owner === null) guestDraft.current = saved;
    } catch { if (lease.isCurrent() && revision.current === version) setError('Saved selections could not be restored. Retry, or explicitly discard this saved cart. Order recovery references are kept separately.'); }
    finally { if (lease.isCurrent() && revision.current === version) setSaving(false); }
  }, [owner, guestDraft]);
  useEffect(() => {
    const lease = cartRepository.open(owner); session.current = lease;
    void load(lease);
    return () => { lease.close(); ++revision.current; };
  }, [owner, load]);
  const persist = async (next: CartState) => {
    const lease = session.current; if (!lease?.isCurrent()) return;
    const version = ++revision.current; setSaving(true); setError('');
    try { await lease.save(next); if (lease.isCurrent() && version === revision.current) { setHydrated(true); setError(''); } }
    catch { if (lease.isCurrent() && version === revision.current) setError('Your latest selections could not be saved. Keep this app open and retry before checkout.'); }
    finally { if (lease.isCurrent() && version === revision.current) setSaving(false); }
  };
  const change = (update: (previous: CartState) => CartState) => {
    if (!hydrated || !session.current?.isCurrent()) return false;
    try {
      const next = update(latest.current); latest.current = next; setCart(next);
      if (owner === null) guestDraft.current = next;
      void persist(next);
      return true;
    } catch (cause) {
      setNotice({ text: cause instanceof Error ? cause.message : 'Check your selections and try again.', error: true });
      return false;
    }
  };
  const addToCart: CartContextType['addToCart'] = (item, storeId) => {
    if (!hydrated || !session.current?.isCurrent()) return false;
    if (latest.current.storeId && latest.current.storeId !== storeId && latest.current.items.length) {
      setReplacement({ expected: cartSelectionFingerprint(latest.current), storeId, item: { ...item, choice_ids: [...item.choice_ids], choice_labels: [...item.choice_labels] } });
      return true;
    }
    const added = change(previous => ({ owner, storeId, items: mergeCartItem(previous.items, item) }));
    if (added) setNotice({ text: `${item.name} added to your cart.`, error: false });
    return added;
  };
  const clearCart = () => change(() => ({ owner, items: [], storeId: null }));
  const removeFromCart = (id: string) => change(previous => { const items = previous.items.filter(row => row.id !== id); return { ...previous, items, storeId: items.length ? previous.storeId : null }; });
  const updateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) { removeFromCart(id); return; } if (!Number.isInteger(quantity) || quantity > 99) return;
    change(previous => ({ ...previous, items: previous.items.map(row => row.id === id ? { ...row, quantity, subtotal: row.price * quantity } : row) }));
  };
  const discardSavedCart = () => {
    const next = { owner, items: [], storeId: null }; latest.current = next; setCart(next);
    if (owner === null) guestDraft.current = next;
    void persist(next);
  };
  return <CartContext.Provider value={{ ...cart, hydrated, saving, storageError, addToCart, notice, dismissNotice: () => setNotice(null), removeFromCart, updateQuantity, clearCart,
    cartTotal: cart.items.reduce((sum, row) => sum + row.subtotal, 0), itemCount: cart.items.reduce((sum, row) => sum + row.quantity, 0),
    retrySave: () => { if (hydrated) void persist(latest.current); else if (session.current) void load(session.current); }, discardSavedCart,
    retireSubmittedSelections: fingerprint => { if (cartSelectionFingerprint(latest.current) === fingerprint) clearCart(); } }}>{children}
    <Confirmation visible={!!replacement} title="Replace your branch cart?" confirmLabel="Replace selections" cancelLabel="Keep current cart" destructive onClose={() => setReplacement(null)} onConfirm={() => {
      if (!replacement) return;
      const changed = change(previous => replaceBranchCart(previous, replacement.expected, replacement.storeId, replacement.item));
      setReplacement(null);
      if (changed) setNotice({ text: `Started a new branch cart with ${replacement.item.name}.`, error: false });
    }}>
      <Text className="text-subtle leading-6">Your current selections belong to another branch. Replacing them starts a new cart with {replacement?.item.name}. Your existing orders are kept.</Text>
    </Confirmation>
  </CartContext.Provider>;
}
export function useCart() { const value = useContext(CartContext); if (!value) throw new Error('CartProvider required'); return value; }
