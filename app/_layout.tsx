import { StatusBar } from 'expo-status-bar';
import "../global.css";
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { runtimeEnvironment } from '@/lib/environment';
import { Slot } from "expo-router";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CartProvider } from '@/contexts/CartContext';
import { CheckoutDraftProvider } from '@/contexts/CheckoutDraftContext';
import { AuthProvider } from '@/hooks/useAuth';
import { OrderProvider } from '@/contexts/OrderContext';
import { LegacyOfflineNotice } from '@/components/LegacyOfflineNotice';
import { PrivacyExportCleanup } from '@/components/auth/PrivacyExportCleanup';
import { PushNotificationsProvider } from '@/hooks/usePushNotifications';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { errorReportingOptions } from '@/lib/error-reporting';
import reportingBindings from '@/config/error-reporting.json';

import * as Sentry from '@sentry/react-native';

Sentry.init(errorReportingOptions({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  enabled: process.env.EXPO_PUBLIC_ERROR_REPORTING_ENABLED,
  environment: runtimeEnvironment.name,
  version: Constants.expoConfig?.version,
  updateId: Updates.updateId,
}, reportingBindings));

const queryClient = new QueryClient();

function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}><SafeAreaProvider><StatusBar style="dark" />
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <PushNotificationsProvider>
        <PrivacyExportCleanup />
        <OrderProvider>
          <CartProvider>
            <CheckoutDraftProvider>
            <LegacyOfflineNotice />
            <Slot />
            </CheckoutDraftProvider>
          </CartProvider>
        </OrderProvider>
        </PushNotificationsProvider>
      </AuthProvider>
    </QueryClientProvider>
    </SafeAreaProvider></GestureHandlerRootView>
  );
}

export default Sentry.wrap(RootLayout);
