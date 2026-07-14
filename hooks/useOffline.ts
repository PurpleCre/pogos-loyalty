import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
// import { NetInfo } from "@react-native-community/netinfo"; // Can add later for real offline status

export const useOffline = () => {
    const [isOnline, setIsOnline] = useState(true);

    const saveOfflineData = async (key: string, data: any) => {
        try {
            await AsyncStorage.setItem(`offline_${key}`, JSON.stringify(data));
        } catch (e) {
            console.error('Failed to save offline data', e);
        }
    };

    const getOfflineData = async (key: string) => {
        try {
            const data = await AsyncStorage.getItem(`offline_${key}`);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error('Failed to get offline data', e);
            return null;
        }
    };

    const addPendingAction = async (action: any) => {
        try {
            const currentQueue = await getOfflineData('pending_actions') || [];
            currentQueue.push({ ...action, timestamp: new Date().toISOString() });
            await saveOfflineData('pending_actions', currentQueue);
        } catch (e) {
            console.error('Failed to add pending action', e);
        }
    };

    const processPendingActions = async () => {
        try {
            const queue = await getOfflineData('pending_actions');
            if (queue && queue.length > 0) {
                // Here we would typically process the actions sequentially
                // For now, we clear the queue as if they were processed
                // TODO: Wire up actual action handlers based on action.type
                await AsyncStorage.removeItem('offline_pending_actions');
            }
        } catch (e) {
            console.error('Failed to process pending actions', e);
        }
    };

    return { isOnline, saveOfflineData, getOfflineData, addPendingAction, processPendingActions };
};
