# Triggering OTA updates

The `Publish OTA update` GitHub Actions workflow supports both:

- A push to `main`: run checks, then publish to the **development** channel using the EAS **development** environment.
- A manual run: choose **development** or **staging**. Staging uses the EAS **preview** environment and requires approved staging bindings first.

The update job waits for tests, types, lint, migration/type checks, SDK/peer checks, native project generation and both mobile bundle exports. Failed checks prevent publication. Current connected accounts are authorised for development; production publication is not configured.

## One-time account configuration

Commit/push the workflow changes so GitHub can run them. In repository Settings → Environments, configure `development` (and later an approved `staging`) with the appropriate branch restrictions and environment protection. Configure:

| GitHub value | Location |
| --- | --- |
| `EXPO_TOKEN` with access to the configured Expo project | Secret; existing repository secret is supported |
| `EXPO_PUBLIC_SUPABASE_URL` | Environment variable; existing repository/environment secret is also supported |
| `EXPO_PUBLIC_SUPABASE_PROJECT_REF` | Environment variable, optional if the URL matches the binding |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Secret containing the client anon/publishable key |
| `ANDROID_MAPS_API_KEY`, `IOS_MAPS_API_KEY` | Secrets for platform-restricted Maps keys |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | Existing development-only fallback secret if separate Maps keys are not configured |
| `EXPO_PUBLIC_SENTRY_DSN` | Optional environment variable |

In the same Expo project’s EAS **development** environment, configure `EXPO_PUBLIC_APP_ENV=development`, the matching Supabase public URL/key/reference and Maps inputs. Mirror the values used by the corresponding native build. These EAS values must have **plain text or sensitive** visibility; EAS secret visibility is unavailable to Update. Do not place server credentials in client values. For staging, use its approved project bindings and EAS **preview** values with `EXPO_PUBLIC_APP_ENV=staging`.

The workflow initially validates GitHub inputs; EAS then loads the selected server environment for export. Both paths run the app configuration validator. `POGOS_UPDATE_TARGET` prevents a mismatched EAS app environment from being published to the selected channel. Missing/unapproved configuration fails the update instead of falling back to another environment. [Expo environment usage](https://docs.expo.dev/eas/environment-variables/usage/)

## Publish manually

1. Open GitHub → Actions → **Publish OTA update** → **Run workflow**.
2. Select the committed branch/ref, normally `main`, and target `development`.
3. Run it and wait for both `checks` and `update` jobs to finish successfully.
4. Open the update group reported by EAS and confirm its project, channel, platform and runtime. Exercise the update on a compatible installed build before wider testing.

Pushing a commit to `main` runs the same development publication automatically. Manual staging runs remain blocked until staging ownership and configuration are approved. This local change has not executed either hosted path or configured any account secrets.

## Native runtime requirement

The SDK 52→58 upgrade, native dependencies and app identities require a **fresh native build/install**. An OTA cannot upgrade an old binary to SDK 58. Builds and updates use fingerprint-based runtime compatibility; do not restore the old fixed runtime to force delivery. After installing the matching build, compatible JavaScript/assets can ship through these triggers. Development clients can open published updates through their launcher; standalone build acceptance must exercise update download, restart and recovery on actual devices. [Expo runtime compatibility](https://docs.expo.dev/eas-update/runtime-versions/)
