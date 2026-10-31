if (process.env.EXPO_NO_DOTENV !== '1') require('dotenv/config');
const bindings = require('./config/environments.json');
const { validateBuildBinding } = require('./config/environment.cjs');
module.exports = () => {
  const target = validateBuildBinding(process.env, bindings);
  const verification = target.verification;
  const suffix = target.name === 'production' ? '' : target.name === 'staging' ? ' (Staging)' : ' (Dev)';
  const androidKey = process.env.ANDROID_MAPS_API_KEY || (target.name === 'development' ? process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY : undefined);
  const iosKey = process.env.IOS_MAPS_API_KEY || (target.name === 'development' ? process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY : undefined);
  return {
    expo: {
      name: verification ? 'Pogo’s Verify' : `Pogo’s${suffix}`, slug: 'pogos', version: '1.1.0',
      scheme: verification ? 'pogos-verify' : target.scheme,
      orientation: 'portrait', icon: './assets/icon.png', userInterfaceStyle: 'light',
      splash: { image: './assets/splash-icon.png', resizeMode: 'contain', backgroundColor: '#ffffff' },
      ios: { supportsTablet: true, bundleIdentifier: verification ? 'com.pogos.verify' : target.iosBundleIdentifier },
      android: { package: verification ? 'com.pogos.verify' : target.androidApplicationId,
        adaptiveIcon: { foregroundImage: './assets/adaptive-icon.png', backgroundColor: '#dc2626' },
        predictiveBackGestureEnabled: true },
      web: { favicon: './assets/favicon.png' },
      runtimeVersion: { policy: 'fingerprint' },
      plugins: ['expo-router', '@sentry/react-native',
        ['expo-secure-store', { configureAndroidBackup: true }],
        ['react-native-maps', { androidGoogleMapsApiKey: androidKey, iosGoogleMapsApiKey: iosKey }],
        ['expo-camera', { cameraPermission: 'Allow Pogo’s to scan your reward collection ticket.', microphonePermission: false, recordAudioAndroid: false }],
        ['expo-location', { locationWhenInUsePermission: 'Allow Pogo’s to place your delivery pin and find nearby branches.', isAndroidBackgroundLocationEnabled: false }],
        'expo-notifications'],
      extra: { environment: target.name, supabaseProjectRef: target.supabaseProjectRef,
        ...(verification ? {} : { eas: { projectId: target.expoProjectId } }) },
      ...(verification ? { updates: { enabled: false } } : {
        owner: target.expoOwner, updates: { url: `https://u.expo.dev/${target.expoProjectId}` },
      }),
    },
  };
};
