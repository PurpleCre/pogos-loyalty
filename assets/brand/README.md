# Pogo’s brand assets

`pogos-logo.webp` is the original 234 × 234 captured logo from the Pogo’s listing, recorded in `client-materials/pogos-sadiexpress-2026-11-04/`. Its artwork and colours are preserved. `pogos-header.webp` is the captured wide header.

The app packaging assets were exported from that existing logo on 4 November 2026:

| Asset | Dimensions | Layout |
| --- | --- | --- |
| `assets/icon.png` | 1024 × 1024 | Opaque white RGB canvas; centred 896px logo; native launcher rounding is applied by the operating system. |
| `assets/adaptive-icon.png` | 1024 × 1024 | Centred 640px logo with transparent outer padding; white Android adaptive background; badge stays inside the safe area. |
| `assets/splash-icon.png` | 1024 × 1024 | Logo on white; displayed at 200 logical pixels by the native splash plugin. |
| `assets/favicon.png` | 64 × 64 | Logo on white for browser tabs. |

The source was decoded to PNG with macOS `sips`; Expo’s installed image utility dependency resized and padded it with bicubic interpolation. No artwork or lettering was redrawn. The original captured file remains unchanged. Upscaling provides the required packaging dimensions but does not add source detail; a client-supplied vector or higher-resolution master can replace it before final release.

`app.config.js` binds the icon, adaptive icon, favicon and `expo-splash-screen` plugin. The splash background is white, matching the logo. These are native build assets: an OTA cannot replace an installed launcher icon or native launch screen. Generate a matching new binary and check a cold launch on Android/iOS. Expo Go and development-client launch screens do not reproduce the final standalone splash reliably; use a preview/release build for visual acceptance, following [Expo’s guidance](https://docs.expo.dev/develop/user-interface/splash-screen-and-app-icon/).

Verification on 4 November: SDK alignment, dependency peers and temporary Android/iOS native-project generation pass. The generated iOS icon matches the configured icon pixels; its launch storyboard uses `SplashScreenLogo`. Android generates all five splash density variants and white launcher/splash backgrounds. The original captured WebP hash still matches the capture manifest. No native compilation, signing, installation or publication was performed.
