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
        // TODO: Implement pending actions queue
        console.log('Pending action added (not implemented)', action);
    };

    return { isOnline, saveOfflineData, getOfflineData, addPendingAction };
};
