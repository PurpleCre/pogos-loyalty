import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Store } from '@/hooks/useStores';

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
  const [deliveryLocation, setDeliveryLocation] = useState<LocationData | null>(null);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [savedLocations, setSavedLocations] = useState<LocationData[]>([]);

  // Load saved locations on mount
  useEffect(() => {
    const loadLocations = async () => {
      try {
        const stored = await AsyncStorage.getItem(LOCATIONS_KEY);
        if (stored) {
          setSavedLocations(JSON.parse(stored));
        }
      } catch (e) {
        console.error('Failed to load saved locations', e);
      }
    };
    loadLocations();
  }, []);

  const saveLocation = async (location: LocationData) => {
    try {
      const exists = savedLocations.find(loc => loc.id === location.id);
      let updatedLocations;
      if (exists) {
        updatedLocations = savedLocations.map(loc => loc.id === location.id ? location : loc);
      } else {
        updatedLocations = [...savedLocations, location];
      }
      setSavedLocations(updatedLocations);
      await AsyncStorage.setItem(LOCATIONS_KEY, JSON.stringify(updatedLocations));
    } catch (e) {
      console.error('Failed to save location', e);
    }
  };

  const removeLocation = async (id: string) => {
    try {
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
