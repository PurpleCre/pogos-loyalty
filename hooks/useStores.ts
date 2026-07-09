import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface Store {
  id: string;
  name: string;
  address: string;
  distance_miles: number;
  is_open: boolean;
  latitude: number;
  longitude: number;
  image_url?: string;
}

const MOCK_STORES: Store[] = [
  { id: '1', name: "Pogo's Main St.", address: "123 Main St, City Center", distance_miles: 1.2, is_open: true, latitude: 40.7128, longitude: -74.0060, image_url: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=500&q=80" },
  { id: '2', name: "Pogo's Downtown", address: "456 Market St, Downtown", distance_miles: 3.1, is_open: true, latitude: 40.7282, longitude: -73.9942, image_url: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=500&q=80" },
  { id: '3', name: "Pogo's Uptown", address: "789 Park Ave, Uptown", distance_miles: 4.5, is_open: true, latitude: 40.7589, longitude: -73.9851, image_url: "https://images.unsplash.com/photo-1552566626-52f8b828add9?w=500&q=80" },
  { id: '4', name: "Pogo's Suburban", address: "101 Mall Rd, Suburbia", distance_miles: 8.9, is_open: false, latitude: 40.8500, longitude: -73.8667, image_url: "https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=500&q=80" }
];

export function useStores() {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    fetchStores();
  }, []);

  const fetchStores = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('stores')
        .select('*')
        .order('distance_miles', { ascending: true });

      if (error) {
        console.warn("Falling back to mock stores due to Supabase error:", error.message);
        setStores(MOCK_STORES);
        return;
      }

      let fetchedStores = data && data.length > 0 ? data : MOCK_STORES;
      
      // Inject mock images if the database doesn't have them yet
      fetchedStores = fetchedStores.map((store: Store, index: number) => {
        if (!store.image_url) {
          return { 
            ...store, 
            image_url: MOCK_STORES[index % MOCK_STORES.length].image_url 
          };
        }
        return store;
      });

      setStores(fetchedStores);
    } catch (e: any) {
      console.error("Error fetching stores:", e);
      setStores(MOCK_STORES);
    } finally {
      setLoading(false);
    }
  };

  return { stores, loading, error, refetch: fetchStores };
}
