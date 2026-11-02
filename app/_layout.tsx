import "../global.css";
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { runtimeEnvironment } from '@/lib/environment';
import { Slot } from "expo-router";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CartProvider } from '@/contexts/CartContext';
import { AuthProvider } from '@/hooks/useAuth';
import { OrderProvider } from '@/contexts/OrderContext';
import { PrivacyExportCleanup } from '@/components/auth/PrivacyExportCleanup';
import { PushNotificationsProvider } from '@/hooks/usePushNotifications';
import { sanitizeTelemetry } from '@/lib/privacy-logging';

import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.EXPO_PUBLIC_SENTRY_DSN,
  debug: false,
  environment: runtimeEnvironment.name,
  sendDefaultPii: false,
  beforeSend: event => sanitizeTelemetry(event),
  beforeBreadcrumb: breadcrumb => sanitizeTelemetry(breadcrumb),
});

const queryClient = new QueryClient();

function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}><SafeAreaProvider>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <PushNotificationsProvider>
        <PrivacyExportCleanup />
        <OrderProvider>
          <CartProvider>
            <Slot />
          </CartProvider>
        </OrderProvider>
        </PushNotificationsProvider>
      </AuthProvider>
    </QueryClientProvider>
    </SafeAreaProvider></GestureHandlerRootView>
  );
}

export default Sentry.wrap(RootLayout);
