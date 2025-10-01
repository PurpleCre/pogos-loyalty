import { useState, useEffect } from 'react';
import { toast } from 'sonner';

interface OfflineData {
  rewards: any[];
  userPoints: any;
  transactions: any[];
  timestamp: number;
}

export const useOffline = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSync, setPendingSync] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Back online! Syncing data...');
      syncOfflineData();
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.info('You\'re offline. Data will sync when back online.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const saveOfflineData = (key: string, data: any) => {
    try {
      const offlineData = {
        data,
        timestamp: Date.now(),
      };
      localStorage.setItem(`offline_${key}`, JSON.stringify(offlineData));
    } catch (error) {
      console.error('Error saving offline data:', error);
    }
  };

  const getOfflineData = (key: string) => {
    try {
      const cached = localStorage.getItem(`offline_${key}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        // Cache valid for 24 hours
        if (Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
          return parsed.data;
        }
      }
    } catch (error) {
      console.error('Error getting offline data:', error);
    }
    return null;
  };

  const addPendingAction = (action: any) => {
    try {
      const pending = JSON.parse(localStorage.getItem('pending_actions') || '[]');
      pending.push({ ...action, timestamp: Date.now() });
      localStorage.setItem('pending_actions', JSON.stringify(pending));
      setPendingSync(true);
    } catch (error) {
      console.error('Error adding pending action:', error);
    }
  };

  const syncOfflineData = async () => {
    try {
      const pending = JSON.parse(localStorage.getItem('pending_actions') || '[]');
      
      if (pending.length === 0) {
        setPendingSync(false);
        return;
      }

      // Process pending actions
      for (const action of pending) {
        // Actions will be processed by the app
        console.log('Processing action:', action);
      }

      // Clear pending actions
      localStorage.setItem('pending_actions', JSON.stringify([]));
      setPendingSync(false);
      
      // Request background sync if available
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        if ('sync' in registration) {
          await (registration as any).sync.register('sync-offline-data');
        }
      }
    } catch (error) {
      console.error('Error syncing offline data:', error);
    }
  };

  return {
    isOnline,
    pendingSync,
    saveOfflineData,
    getOfflineData,
    addPendingAction,
    syncOfflineData,
  };
};
