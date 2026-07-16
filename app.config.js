import 'dotenv/config';

export default {
  "expo": {
    "name": "Pogo's",
    "slug": "pogos",
    "version": "1.0.0",
    "scheme": "pogos",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "newArchEnabled": true,
    "splash": {
      "image": "./assets/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.purpl3cr3.pogos",
      "buildNumber": "1",
      "config": {
        "googleMapsApiKey": process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
      },
      "runtimeVersion": {
        "policy": "appVersion"
      }
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#dc2626"
      },
      "edgeToEdgeEnabled": true,
      "predictiveBackGestureEnabled": false,
      "package": "com.purpl3cr3.pogos",
      "versionCode": 1,
      "config": {
        "googleMaps": {
          "apiKey": process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
        }
      },
      "runtimeVersion": "1.0.0"
    },
    "web": {
      "favicon": "./assets/favicon.png"
    },
    "plugins": [
      "expo-router",
      "@sentry/react-native"
    ],
    "extra": {
      "router": {
        "origin": false
      },
      "eas": {
        "projectId": "1341ce01-7787-4a04-95f1-0ad259a5847c"
      }
    },
    "owner": "purpl3cr3",
    "updates": {
      "url": "https://u.expo.dev/1341ce01-7787-4a04-95f1-0ad259a5847c"
    }
  }
};
