import { createContext, useContext, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { useAuth } from '@/hooks/useAuth';

interface CheckoutDetails {
  mode: 'collection' | 'delivery'; name: string; phone: string;
  address: string; instructions: string; locationKey: string;
}
const emptyDetails = (): CheckoutDetails => ({ mode: 'delivery', name: '', phone: '', address: '', instructions: '', locationKey: '' });
const Context = createContext<{ details: CheckoutDetails; setDetails: Dispatch<SetStateAction<CheckoutDetails>>; clearDetails(): void } | null>(null);

// Contact details survive navigation only. Never persist these fields to device
// storage or transfer them across sign-in, sign-out or account changes.
export function CheckoutDraftProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return <AccountDraft key={user?.id ?? 'guest'}>{children}</AccountDraft>;
}
function AccountDraft({ children }: { children: ReactNode }) {
  const [details, setDetails] = useState(emptyDetails);
  return <Context.Provider value={{ details, setDetails, clearDetails: () => setDetails(emptyDetails()) }}>{children}</Context.Provider>;
}
export function useCheckoutDraft() {
  const value = useContext(Context);
  if (!value) throw new Error('CheckoutDraftProvider required');
  return value;
}
