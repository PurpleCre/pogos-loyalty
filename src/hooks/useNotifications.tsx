import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useToast } from "./use-toast";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";

interface NotificationPermission {
  granted: boolean;
  denied: boolean;
  default: boolean;
}

export const useNotifications = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [permission, setPermission] = useState<NotificationPermission>({
    granted: false,
    denied: false,
    default: true
  });
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  // VAPID public key
  const VAPID_PUBLIC_KEY = 'BIl6FSX1QiDngUmFf9OSU4PjOOoF1UA2PnT_hpOzbplmhWs7piHMQprynKrHqC1iwYdVF22eNre2iPxzSx7CS84';

  useEffect(() => {
    if (user) {
      checkNotificationPermission();
      checkSubscriptionStatus();
      if (Capacitor.isNativePlatform()) {
        initializeCapacitorPushNotifications();
      } else {
        registerServiceWorker();
      }
    }
  }, [user]);

  const checkNotificationPermission = async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        const permStatus = await PushNotifications.checkPermissions();
        setPermission({
          granted: permStatus.receive === 'granted',
          denied: permStatus.receive === 'denied',
          default: permStatus.receive === 'prompt'
        });
      } catch (error) {
        console.error('Error checking Capacitor permissions:', error);
      }
    } else if ('Notification' in window) {
      const perm = Notification.permission;
      setPermission({
        granted: perm === 'granted',
        denied: perm === 'denied',
        default: perm === 'default'
      });
    }
  };

  const registerServiceWorker = async () => {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('Service worker registered:', registration);
      } catch (error) {
        console.error('Service worker registration failed:', error);
      }
    }
  };

  const initializeCapacitorPushNotifications = async () => {
    try {
      // Check permissions
      const permStatus = await PushNotifications.checkPermissions();
      
      if (permStatus.receive === 'prompt') {
        const requestResult = await PushNotifications.requestPermissions();
        if (requestResult.receive !== 'granted') {
          setPermission({ granted: false, denied: true, default: false });
          return;
        }
      } else if (permStatus.receive === 'denied') {
        setPermission({ granted: false, denied: true, default: false });
        return;
      }

      setPermission({ granted: true, denied: false, default: false });

      // Register for push notifications
      await PushNotifications.register();

      // Add listeners
      PushNotifications.addListener('registration', async (token) => {
        console.log('Push registration success, token:', token.value);
        await saveCapacitorSubscription(token.value);
        setIsSubscribed(true);
      });

      PushNotifications.addListener('registrationError', (error) => {
        console.error('Error on registration:', error);
        toast({
          title: "Registration Failed",
          description: "Failed to register for push notifications",
          variant: "destructive"
        });
      });

      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('Push notification received:', notification);
        toast({
          title: notification.title || "New Notification",
          description: notification.body || "You have a new notification"
        });
      });

      PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        console.log('Push notification action performed:', notification);
      });

    } catch (error) {
      console.error('Error initializing Capacitor push notifications:', error);
      setPermission({ granted: false, denied: true, default: false });
    }
  };

  const saveCapacitorSubscription = async (token: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: user.id,
          endpoint: `capacitor://fcm/${token}`,
          p256dh: '',
          auth: '',
          user_agent: 'Capacitor Android App'
        }, {
          onConflict: 'user_id,endpoint'
        });

      if (error) {
        console.error('Error saving Capacitor subscription:', error);
        toast({
          title: "Subscription Error",
          description: "Failed to save push notification subscription",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error saving Capacitor subscription:', error);
    }
  };

  const checkSubscriptionStatus = async () => {
    if (!user) return;

    try {
      if (Capacitor.isNativePlatform()) {
        const { data } = await supabase
          .from('push_subscriptions')
          .select('*')
          .eq('user_id', user.id)
          .like('endpoint', 'capacitor://%')
          .maybeSingle();
        
        setIsSubscribed(!!data);
      } else if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        setIsSubscribed(!!subscription);
      }
    } catch (error) {
      console.error('Error checking subscription status:', error);
    }
  };

  const requestPermission = async (): Promise<boolean> => {
    if (Capacitor.isNativePlatform()) {
      try {
        const result = await PushNotifications.requestPermissions();
        checkNotificationPermission();
        
        if (result.receive === 'granted') {
          toast({
            title: "Permission Granted",
            description: "You'll now receive push notifications"
          });
          return true;
        } else {
          toast({
            title: "Permission Denied",
            description: "Push notifications are disabled",
            variant: "destructive"
          });
          return false;
        }
      } catch (error) {
        console.error('Error requesting Capacitor permission:', error);
        return false;
      }
    } else if ('Notification' in window) {
      try {
        const permission = await Notification.requestPermission();
        checkNotificationPermission();
        
        if (permission === 'granted') {
          toast({
            title: "Permission Granted",
            description: "You'll now receive push notifications"
          });
          return true;
        } else {
          toast({
            title: "Permission Denied",
            description: "Push notifications are disabled",
            variant: "destructive"
          });
          return false;
        }
      } catch (error) {
        console.error('Error requesting permission:', error);
        return false;
      }
    } else {
      toast({
        title: "Not Supported",
        description: "Push notifications are not supported in this browser",
        variant: "destructive"
      });
      return false;
    }
  };

  const subscribe = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      if (Capacitor.isNativePlatform()) {
        // For Capacitor, the subscription is handled in initializeCapacitorPushNotifications
        await initializeCapacitorPushNotifications();
      } else {
        // Web push subscription logic
        const hasPermission = permission.granted || await requestPermission();
        if (!hasPermission) return;

        const registration = await navigator.serviceWorker.ready;
        
        // Convert VAPID key from base64 to Uint8Array
        const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
        
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey
        });

        // Save subscription to database
        const subscriptionData = {
          user_id: user.id,
          endpoint: subscription.endpoint,
          p256dh: arrayBufferToBase64(subscription.getKey('p256dh')!),
          auth: arrayBufferToBase64(subscription.getKey('auth')!),
          user_agent: navigator.userAgent
        };

        const { error } = await supabase
          .from('push_subscriptions')
          .upsert(subscriptionData, {
            onConflict: 'user_id,endpoint'
          });

        if (error) throw error;

        setIsSubscribed(true);
        toast({
          title: "Subscribed",
          description: "You're now subscribed to push notifications"
        });
      }
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      toast({
        title: "Subscription Failed",
        description: "Failed to subscribe to push notifications",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const unsubscribe = async () => {
    if (!user) return;

    setLoading(true);
    try {
      if (Capacitor.isNativePlatform()) {
        // For Capacitor, remove listeners and database entry
        PushNotifications.removeAllListeners();
        
        const { error } = await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', user.id)
          .like('endpoint', 'capacitor://%');

        if (error) throw error;
      } else {
        // Web push unsubscription logic
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        
        if (subscription) {
          await subscription.unsubscribe();
          
          // Remove from database
          const { error } = await supabase
            .from('push_subscriptions')
            .delete()
            .eq('user_id', user.id)
            .eq('endpoint', subscription.endpoint);

          if (error) throw error;
        }
      }

      setIsSubscribed(false);
      toast({
        title: "Unsubscribed",
        description: "You've been unsubscribed from push notifications"
      });
    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error);
      toast({
        title: "Unsubscribe Failed",
        description: "Failed to unsubscribe from push notifications",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return {
    permission,
    isSubscribed,
    loading,
    subscribe,
    unsubscribe,
    requestPermission
  };
};

// Helper functions
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}