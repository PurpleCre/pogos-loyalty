import { logPrivateError } from '@/lib/privacy-logging';
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Store } from '@/hooks/useStores';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { accessTokenFor } from '@/lib/cash-orders';
import { createLocationCache } from '@/lib/location-cache';

export interface LocationData {
  id: string;
  address: string;
  latitude: number;
  longitude: number;
  tag?: string | null; // 'Home', 'Work', 'Custom'
}

interface OrderContextType {
  deliveryLocation: LocationData | null;
  setDeliveryLocation: (location: LocationData | null) => void;
  selectedStore: Store | null;
  setSelectedStore: (store: Store | null) => void;
  savedLocations: LocationData[];
  saveLocation: (location: LocationData) => Promise<LocationData | null>;
  removeLocation: (id: string) => Promise<void>;
}

const OrderContext = createContext<OrderContextType | undefined>(undefined);

const locationCache = createLocationCache(AsyncStorage);

export function OrderProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [deliveryState, setDeliveryState] = useState<{ owner: string | null; location: LocationData | null }>({ owner: user?.id ?? null, location: null });
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const accountId = user?.id ?? null;
  const deliveryLocation = deliveryState.owner === accountId ? deliveryState.location : null;
  const setDeliveryLocation = (location: LocationData | null) => setDeliveryState({ owner: accountId, location });
  const currentAccount = useRef(accountId);
  currentAccount.current = accountId;
  const [locationState, setLocationState] = useState<{ owner: string | null; locations: LocationData[] }>({ owner: accountId, locations: [] });
  const savedLocations = locationState.owner === accountId ? locationState.locations : [];
  const setSavedLocations = (locations: LocationData[]) => setLocationState({ owner: accountId, locations });

  // Load saved locations on mount
  useEffect(() => {
    let cancelled = false; const cacheWrite = locationCache.writer(accountId);
    setDeliveryLocation(null);
    setSelectedStore(null);
    setLocationState({ owner: accountId, locations: [] });
    const loadLocations = async () => {
      try {
        if (user) {
          // Load from Supabase
          const { data, error } = await supabase
            .from('user_locations')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });
            
          if (error) {
            logPrivateError('Supabase fetch error', error);
          } else if (data) {
            if (cancelled) return;
            setSavedLocations(data);
            // Cache locally
            await cacheWrite(data);
            return;
          }
        }

        // Fallback to local storage (unauthenticated or offline)
        const stored = await locationCache.read(accountId);
        if (!cancelled) setSavedLocations(stored);
      } catch (e) {
        logPrivateError('Failed to load saved locations', e);
      }
    };
    loadLocations();
    return () => { cancelled = true; };
  }, [accountId]);

  const saveLocation = async (location: LocationData) => {
    const cacheWrite = locationCache.writer(accountId);
    try {
      let saved = location;
      if (user) {
        const token = await accessTokenFor(user.id);
        const input = { user_id: user.id, address: location.address, latitude: location.latitude, longitude: location.longitude, tag: location.tag };
        const existing = savedLocations.some(row => row.id === location.id) && /^[0-9a-f-]{36}$/i.test(location.id);
        const query = existing ? supabase.from('user_locations').update(input).eq('id', location.id).eq('user_id', user.id) : supabase.from('user_locations').insert(input);
        const { data, error } = await query.select().single().setHeader('Authorization', `Bearer ${token}`);
        if (error || !data) throw error ?? new Error('Save unconfirmed');
        saved = data;
      }
      if (currentAccount.current !== accountId) return null;
      const next = [...savedLocations.filter(row => row.id !== location.id), saved];
      setSavedLocations(next);
      // A server-confirmed save remains valid if its optional local cache fails.
      await cacheWrite(next).catch(() => undefined);
      if (currentAccount.current !== accountId) return null;
      if (deliveryLocation?.id === location.id) setDeliveryLocation(saved);
      return saved;
    } catch (error) { logPrivateError('Location save could not be confirmed', error); return null; }
  };

  const removeLocation = async (id: string) => {
    const cacheWrite = locationCache.writer(accountId);
    try {
      if (user) {
        const isUUID = id && id.length === 36 && id.includes('-');
        if (isUUID) {
          const token = await accessTokenFor(user.id);
          const { error } = await supabase.from('user_locations').delete().eq('id', id).eq('user_id', user.id).setHeader('Authorization', `Bearer ${token}`);
          if (error) throw error;
        }
      }
      
      const updatedLocations = savedLocations.filter(loc => loc.id !== id);
      if (currentAccount.current !== accountId) return;
      setSavedLocations(updatedLocations);
      await cacheWrite(updatedLocations);
      
      if (deliveryLocation?.id === id) {
        setDeliveryLocation(null);
      }
    } catch (e) {
      logPrivateError('Failed to remove location', e);
    }
  };

  return (
    <OrderContext.Provider
      value={{
        deliveryLocation,
        setDeliveryLocation,
        selectedStore,
        setSelectedStore,
        savedLocations,
        saveLocation,
        removeLocation,
      }}
    >
      {children}
    </OrderContext.Provider>
  );
}

export function useOrder() {
  const context = useContext(OrderContext);
  if (context === undefined) {
    throw new Error('useOrder must be used within an OrderProvider');
  }
  return context;
}
