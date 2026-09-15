import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Store } from '@/hooks/useStores';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

export interface LocationData {
  id: string;
  address: string;
  latitude: number;
  longitude: number;
  tag?: string; // 'Home', 'Work', 'Custom'
}

interface OrderContextType {
  deliveryLocation: LocationData | null;
  setDeliveryLocation: (location: LocationData | null) => void;
  selectedStore: Store | null;
  setSelectedStore: (store: Store | null) => void;
  savedLocations: LocationData[];
  saveLocation: (location: LocationData) => Promise<void>;
  removeLocation: (id: string) => Promise<void>;
}

const OrderContext = createContext<OrderContextType | undefined>(undefined);

const LOCATIONS_KEY = '@pogos_saved_locations';

export function OrderProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [deliveryLocation, setDeliveryLocation] = useState<LocationData | null>(null);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [savedLocations, setSavedLocations] = useState<LocationData[]>([]);

  // Load saved locations on mount
  useEffect(() => {
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
            console.error('Supabase fetch error', error);
          } else if (data) {
            setSavedLocations(data as LocationData[]);
            // Cache locally
            await AsyncStorage.setItem(LOCATIONS_KEY, JSON.stringify(data));
            return;
          }
        }

        // Fallback to local storage (unauthenticated or offline)
        const stored = await AsyncStorage.getItem(LOCATIONS_KEY);
        if (stored) {
          setSavedLocations(JSON.parse(stored));
        }
      } catch (e) {
        console.error('Failed to load saved locations', e);
      }
    };
    loadLocations();
  }, [user]);

  const saveLocation = async (location: LocationData) => {
    try {
      let dbLocation = location;
      const exists = savedLocations.find(loc => loc.id === location.id);
      
      if (user) {
        const isUUID = location.id && location.id.length === 36 && location.id.includes('-');
        const insertData = {
          user_id: user.id,
          address: location.address,
          latitude: location.latitude,
          longitude: location.longitude,
          tag: location.tag,
        };
        
        if (isUUID) {
          // Update existing
          const { data, error } = await supabase
            .from('user_locations')
            .update(insertData)
            .eq('id', location.id)
            .select()
            .single();
            
          if (error) throw error;
          if (data) dbLocation = data as LocationData;
        } else {
          // Insert new (let Supabase generate UUID)
          const { data, error } = await supabase
            .from('user_locations')
            .insert([insertData])
            .select()
            .single();
            
          if (error) throw error;
          if (data) dbLocation = data as LocationData;
        }
      }
      
      let updatedLocations;
      if (exists) {
        updatedLocations = savedLocations.map(loc => loc.id === location.id ? dbLocation : loc);
      } else {
        updatedLocations = [...savedLocations, dbLocation];
      }
      
      setSavedLocations(updatedLocations);
      await AsyncStorage.setItem(LOCATIONS_KEY, JSON.stringify(updatedLocations));
      
      if (deliveryLocation?.id === location.id) {
        setDeliveryLocation(dbLocation);
      }
    } catch (e) {
      console.error('Failed to save location', e);
    }
  };

  const removeLocation = async (id: string) => {
    try {
      if (user) {
        const isUUID = id && id.length === 36 && id.includes('-');
        if (isUUID) {
          const { error } = await supabase
            .from('user_locations')
            .delete()
            .eq('id', id);
          if (error) throw error;
        }
      }
      
      const updatedLocations = savedLocations.filter(loc => loc.id !== id);
      setSavedLocations(updatedLocations);
      await AsyncStorage.setItem(LOCATIONS_KEY, JSON.stringify(updatedLocations));
      
      if (deliveryLocation?.id === id) {
        setDeliveryLocation(null);
      }
    } catch (e) {
      console.error('Failed to remove location', e);
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
