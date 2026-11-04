# Android development APK

Requested: **4 November 2026**, Android APK first. **Build finished successfully at 09:10 Harare time.** EAS build: [28d17837-9fb2-4ef7-9c72-d1fca75eee9b](https://expo.dev/accounts/purpl3cr3/projects/pogos/builds/28d17837-9fb2-4ef7-9c72-d1fca75eee9b). [Download the signed APK](https://expo.dev/artifacts/eas/-H9095zm6e2K1AHDrkkNa3k5u-hQttucj35PgV4NgJE.apk).

The downloaded APK passes ZIP integrity and Android signature verification. Its manifest confirms **Pogo’s (Dev)**, application ID `com.purpl3cr3.pogos.dev`, version **1.1.0 (1)**, Android minimum API 24, target API 36 and four packaged CPU architectures. Its size is **141,555,908 bytes** (about 142 MB / 135 MiB). APK SHA-256: `7e49ddb8e865a01532504cd5c2c6912018f94459ca519bba75c6ba31b66938dc`. Its single signing certificate SHA-256 is `070a24c58ca4ab849643976433f1a0c6a832fb6b5f752df6a0f16e56750c82fa`; APK Signature Scheme v2 verifies. A private local copy and reports are retained in `.local/eas-build/`.

## Build identity

| Setting | Value |
| --- | --- |
| Expo account/project | `purpl3cr3/pogos`, `1341ce01-7787-4a04-95f1-0ad259a5847c` |
| EAS profile | `development-apk` |
| EAS environment/channel | `development` / `development` |
| Android application ID | `com.purpl3cr3.pogos.dev` |
| Backend | Existing development Supabase project `hsyibcyvujwwqygigepe` |
| Distribution | Internal, standalone APK; no Metro server required |
| App version / Android version code | `1.1.0` / `1` |
| Native runtime fingerprint | `0b8da87f9f04be4585d39184ce6c4861b9a6534e` |
| Node / EAS CLI | `22.19.0` / `27.2.0` |

This profile extends development but sets `developmentClient = false` and requests an APK. It keeps unconfigured error reporting and Sentry uploads off. The existing `development` developer-client profile remains available. This is a development build against the authorised connected account; it does not establish production ownership, activate trading or publish to an app store.

EAS created a managed Android signing keystore for this development application ID and initialised its remote version code to 1. The old local keystore remains unchanged and excluded from uploads. No signing key was downloaded into the repository. Retain this managed development identity for subsequent upgrades to this APK.

## Configuration and source verification

The EAS development environment initially had no variables. Five required project-scoped values were created: `EXPO_PUBLIC_APP_ENV`, `EXPO_PUBLIC_SUPABASE_PROJECT_REF`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` and `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`. The public anon/Maps values use sensitive visibility. No server database credential, service-role key or management token was uploaded. Native Google Maps key restrictions still need acceptance for the development app ID/signing fingerprint.

The full local check passes **493 tests**, including the new standalone-profile isolation regression. The eight environment cases pass again against the final profile. SDK/dependency checks and the logo’s Android/iOS native generation passed in the preceding asset change.

The cloud build completes native Android compilation, signing and artifact upload; Gradle reports `BUILD SUCCESSFUL in 23m 10s`. A fresh audit of the built package configuration has **zero high/critical/low findings and 17 moderate findings**. Moderate/independent review and physical-device acceptance remain open; this is not production readiness.

The final EAS archive was inspected before submission: **187 files, 2.64 MiB uncompressed** (about 1.6 MB uploaded). Its app configuration, profile, environment validator, package lock and three native brand images match the working tree. No `.env`, server credential, local backup, signing key, Git history or captured client research file is present. `.easignore` preserves the existing ignore rules and adds these build exclusions. The private archive manifest and execution logs are in ignored `.local/eas-build/`.

EAS records base Git commit `84902decb4b6e724b1ad98be666a752ad625e52a`, but this build also includes the current uncommitted logo, splash, packaging and APK-profile changes. The private archive manifest records their hashes; the base commit alone cannot reproduce this binary. No commit or push was performed for this build.

## Installation and acceptance

Use the EAS installation link or APK artifact above on an Android device and permit installation from the chosen browser if Android requests it. A new APK replaces another installation only when the app ID and signing identity match; do not uninstall an app containing unresolved local order/recovery evidence merely to bypass a signing error.

Check the launcher icon, cold-start splash, shared menu/photos/prices, authentication, storage/recovery, Maps/location and compatible development OTA updates. An APK build alone does not prove those device journeys. Checkout, rewards and other branch release gates remain as configured; this build does not activate them. iPhone signing/build/device registration and production approval remain separate work.

For subsequent builds, use:

```sh
eas build --platform android --profile development-apk
```

This produces an installable APK using [EAS internal distribution](https://docs.expo.dev/build/internal-distribution/). Actual preview/release builds are required for final native splash acceptance; Expo Go/developer-client behavior differs, as described in [Expo’s splash guidance](https://docs.expo.dev/develop/user-interface/splash-screen-and-app-icon/).
