export interface CartItem {
  id: string;
  menu_item_id: string;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
  choice_ids: string[];
  choice_labels: string[];
}

export interface CartState { owner: string | null; items: CartItem[]; storeId: string | null }
export function cartForAccount(state: CartState, owner: string | null): CartState {
  if (state.owner === owner) return state;
  // A visitor can carry their selections into sign-in. A departing customer's
  // cart is never inherited by a visitor or another customer.
  if (state.owner === null && owner !== null) return { ...state, owner };
  return { owner, items: [], storeId: null };
}

export function cartLineId(itemId: string, choices: string[]) {
  return JSON.stringify([itemId, [...choices].sort()]);
}

export function mergeCartItem(items: CartItem[], incoming: Omit<CartItem, 'id' | 'subtotal'>): CartItem[] {
  const id = cartLineId(incoming.menu_item_id, incoming.choice_ids);
  const existing = items.find(item => item.id === id);
  const quantity = (existing?.quantity ?? 0) + incoming.quantity;
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) throw new Error('Choose between 1 and 99 of this meal.');
  const next = { ...incoming, id, quantity, subtotal: incoming.price * quantity };
  return existing ? items.map(item => item.id === id ? next : item) : [...items, next];
}

// Prices/names are intentionally absent: the server resolves both from IDs.
export function checkoutLines(items: CartItem[]) {
  return items.map(item => ({ menu_item_id: item.menu_item_id, quantity: item.quantity, choice_ids: [...item.choice_ids].sort() }));
}

export function cartFingerprint(items: CartItem[]) {
  return JSON.stringify(checkoutLines(items).sort((a, b) => cartLineId(a.menu_item_id, a.choice_ids).localeCompare(cartLineId(b.menu_item_id, b.choice_ids))));
}

export function cartSelectionFingerprint(cart: Pick<CartState, 'storeId' | 'items'>) {
  return JSON.stringify([cart.storeId, cartFingerprint(cart.items)]);
}
