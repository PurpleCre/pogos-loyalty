import { useState, useEffect, useRef } from 'react';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { useAuth } from './useAuth';

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
    }),
});

export const usePushNotifications = () => {
    const { user } = useAuth();
    const owner = user?.id;
    const currentOwner = useRef(owner); currentOwner.current = owner;
    const [tokenState, setToken] = useState<{ owner: string; token: string | undefined } | null>(null);
    const expoPushToken = tokenState && tokenState.owner === owner ? tokenState.token : undefined;
    const [notificationState, setNotification] = useState<{ owner: string; value: Notifications.Notification } | null>(null);
    const notification = notificationState && notificationState.owner === owner ? notificationState.value : undefined;
    const notificationListener = useRef<ReturnType<typeof Notifications.addNotificationReceivedListener> | null>(null);

    const registerForPushNotificationsAsync = async () => {
        if (!Device.isDevice) return;
        let token;

        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'default',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#FF231F7C',
            });
        }

        if (Device.isDevice) {
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;
            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }
            if (finalStatus !== 'granted') {
                return;
            }
            try {
                const projectId =
                    Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
                if (!projectId) return;
                token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
            } catch (e) {
                return;
            }
        }

        return token;
    };

    useEffect(() => {
        if (!owner) return;
        let cancelled = false;
        void registerForPushNotificationsAsync().then(token => {
            if (!cancelled && currentOwner.current === owner) setToken({ owner, token });
        }).catch(() => {
            if (!cancelled && currentOwner.current === owner) setToken({ owner, token: undefined });
        });
        notificationListener.current = Notifications.addNotificationReceivedListener(value => {
            if (currentOwner.current === owner) setNotification({ owner, value });
        });
        return () => { cancelled = true; notificationListener.current?.remove(); };
    }, [owner]);

    return { expoPushToken, notification };
};
