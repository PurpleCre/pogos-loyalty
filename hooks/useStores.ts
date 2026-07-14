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
  { id: '1', name: "Pogo's Kamfinsa", address: "Shops 1 & 2, Kamfinsa Shopping Centre, Greendale, Harare", distance_miles: 1.2, is_open: true, latitude: -17.8083, longitude: 31.1098, image_url: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=500&q=80" },
  { id: '2', name: "Pogo's Msasa", address: "94 Mutare Road, Msasa, Harare", distance_miles: 3.1, is_open: true, latitude: -17.8427, longitude: 31.0968, image_url: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=500&q=80" }
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
        .order('name', { ascending: true });

      if (error) {
        console.warn("Falling back to mock stores due to Supabase error:", error.message);
        setStores(MOCK_STORES);
        setLoading(false);
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
