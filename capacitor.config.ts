import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pogosgpc.app',
  appName: 'Pogos Loyalty',
  webDir: 'dist',
  server: {
    url: 'https://c1470fda-d52b-4d69-beb6-cb538aa47b85.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    }
  }
};

export default config;
