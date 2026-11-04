# Production platform readiness

Updated: 31 October 2026. Local implementation and validation record; hosted setup and device acceptance are separate gates.

Follow-on, 3 November: [supported security patches and scaled performance](security-performance-sprint.md) updates Expo to 58.0.23 / CLI 58.1.19 and aligns its native/router compatibility map. The current audit has zero high/critical and 17 moderate package findings; this supersedes the historical security counts below. All 484 default tests, SDK/peers, fresh Android/iOS exports and native-project generation pass. Matching native binaries, signed/device/hosted acceptance, moderate review and independent security remain required. No OTA/build publication occurred.

## Ownership and environment decision

Pogo’s ownership of Expo/EAS and Supabase staging/production accounts is **unconfirmed**. The user authorised the current connected accounts for development work. Accordingly, `config/environments.json` preserves the existing configured Expo project and Supabase URL’s project reference **for development only**. This is not evidence of Pogo’s production ownership.

Staging and production bindings remain empty until the sponsor/platform owner supplies verified projects, app identifiers, schemes and responsibilities. Configuration deliberately fails if those bindings are absent, if a build profile selects the wrong environment, or if projects/identities are accidentally reused across environments. No hosted database, app publication or account provisioning was performed in this increment.

`supabase/config.toml` now uses `pogos-development` as its **local stack label**. That value does not select a linked remote database. Inventory the CLI’s actual linked-project metadata separately before any hosted migration; the previous local label’s resemblance to a project reference did not establish the authoritative database.

## Implemented platform boundaries

- Public Supabase configuration is validated at Expo configuration time and app startup. URLs must match the selected approved project. Secret/service-role keys, non-anon JWTs, mismatched project JWTs, malformed URLs and cross-environment reuse fail without echoing key contents. Publishable-key shape checks do not prove the key’s project ownership or verify JWT signatures; actual hosted API acceptance remains required.
- Development retains the current project with an explicit development app name, scheme and application IDs. Staging/production require their own approved bindings. The checked-in EAS preview credentials/targets were removed. Existing ignored developer `.env` values were not copied into release profiles.
- EAS profiles select development, preview/staging and production environments explicitly. Maps use platform-specific native-plugin inputs; the existing public maps key is a development-only fallback. Correct API restrictions, application identifiers and signing fingerprints must be configured and exercised on actual devices.
- Native runtime compatibility uses Expo’s fingerprint policy instead of the old fixed Android runtime string. Native dependency/config changes require matching binaries; an OTA export is not a substitute for a native rebuild.
- Pushes to `main` run checks and then publish a development OTA. Manual runs can select development or approved staging. Publication is environment-scoped, follows checks and configuration validation, and uses pinned EAS CLI 27.2.0. There is no production publisher. Actual hosted CI/environment protection, credentials and channel mappings remain to be configured and verified by the repository/platform owner. See the [OTA runbook](ota-updates.md).
- Offline bundle and native-project checks use dummy loopback/public/map inputs, disable updates and telemetry, omit the linked EAS project, and never load the developer’s `.env`. Hosted builds/updates cannot use those verification inputs. Verification bundles are not distribution artifacts.
- Native preflight generates projects in a fresh temporary source copy with `--no-install`; it preserves any developer native folders. Generated Android Maps configuration is checked for the dummy key. CocoaPods/Gradle compilation, signing, installation and device journeys require separate evidence.
- Gesture and safe-area providers are explicit. Navigation imports follow Expo Router’s current entry points, all drawer routes are declared, CSS side-effect types are declared, and the removed absolute-fill alias is replaced.
- Catalogue writes now send table columns explicitly instead of nested option read models. The notification adapter uses current banner/list behavior, catches registration failures, scopes asynchronous state by account, and no longer logs tokens or notification payloads. This does not implement the planned transactional notification service.

## Upgrade method and evidence

The preceding reward milestone was rechecked before work: 141 tests, TypeScript, lint and database-type drift passed. A fresh dependency audit confirmed the previous **48 findings: 8 low, 15 moderate, 23 high and 2 critical**.

Expo’s official upgrade guide recommends incremental SDK transitions. Official bundled dependency maps were read for SDKs 53 through 58. Stale optional router dependencies were resolved through clean installs rather than `--force` or `--legacy-peer-deps`. [Expo upgrade guide](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/)

| Checkpoint | Evidence |
| --- | --- |
| SDK 53 / RN 0.79 | Dependency compatibility and TypeScript pass; Android and iOS Hermes export pass |
| SDK 54 / RN 0.81 | Dependency compatibility and TypeScript pass; real Worklets dependency replaces the old alias/autolinking workaround |
| SDK 55 / RN 0.83 | Dependency compatibility and TypeScript pass |
| SDK 56 / RN 0.85 | Dependency compatibility passes; TypeScript identifies CSS side-effect and removed absolute-fill API changes, corrected for the next pass |
| SDK 57 / RN 0.86 | Dependency compatibility and TypeScript pass with those corrections |
| SDK 58 / RN 0.88.1 / React 19.3.0 | Clean lockfile installation, 149 tests, TypeScript, lint, database-type drift, SDK compatibility and strict installed-peer checks pass; Android/iOS Hermes exports and both native-project generation pass |

SDK 56 moves external React Navigation imports to Expo Router entry points. SDK 58 includes further navigation/type changes, which must be assessed against the actual application and native dependencies. [Router 55→56 migration](https://docs.expo.dev/router/migrate/sdk-55-to-56/), [Router 57→58 migration](https://docs.expo.dev/router/migrate/sdk-57-to-58/), [SDK 58 release notes](https://expo.dev/changelog/sdk-58)

Runtime fingerprinting protects native/update compatibility; it does not approve environment ownership or application behavior. Platform-restricted Maps keys also require a binary rebuild. [Runtime versions](https://docs.expo.dev/eas-update/runtime-versions/), [EAS environments](https://docs.expo.dev/eas/environment-variables/), [Maps native setup](https://docs.expo.dev/versions/latest/sdk/map-view/)

## Earlier security findings and incomplete gates

The final online `npm audit --json` reports **26 affected package entries: 2 low, 21 moderate, 3 high, zero critical**. Audit propagation counts packages in dependency chains, not independent vulnerabilities. This replaces the original 48-entry baseline; it is not a clean security audit. The unused module-resolver Babel plugin and its older glob/minimatch dependencies were removed. No major-version overrides, advisory suppression or automatic force fixes were applied.

| Advisory root | Installed scope and next action |
| --- | --- |
| Zod, high | App uses patched **4.6.7**, with manifest minimum raised. Expo CLI 58.1.17 still requests Zod 3 (`^3.25.76`); its installed 3.25.76 copy produces high entries for Zod, CLI and Expo. Obtain a supported upstream fix or separately reviewed tooling mitigation; replacing Zod 3 with 4 is an API migration. |
| glob / minimatch, moderate | Build, fingerprint and lint tooling use glob 13.0.6 / minimatch 10.2.6. Patched 14.0.2 / 11.0.1 releases require major-version changes outside caller ranges. Review callers and native/fingerprint workflows before any targeted override, or consume compatible upstream updates. |
| deepmerge, low | Expo configuration uses 4.3.1; no patched release is currently published. Track upstream resolution and review any temporary mitigation. |

These roots are absent from both exported native module graphs; the application’s Zod 4 modules are present. `build:check` now exports source maps and fails if the audited tooling-only modules enter either graph. This narrows the demonstrated native-runtime exposure; it does not establish that development servers, CI, web builds, or untrusted build/configuration input are safe. The outstanding findings remain an open security release gate; no exception has been approved. [Zod advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5), [deepmerge advisory](https://github.com/advisories/GHSA-gcqx-w48m-w2h4), [glob fix release](https://github.com/isaacs/node-glob/releases/tag/v14.0.2), [minimatch fix release](https://github.com/isaacs/minimatch/releases/tag/v11.0.1)

Expo Doctor passes **19/20** checks with public metadata access. The remaining failure is the host’s missing CocoaPods (recommended >=1.15.2). The generated `.expo/README.md` was untracked so ignored local Expo state no longer fails project hygiene. Full Xcode is also absent. Neither Android nor iOS native compilation, signing, installation or device acceptance is claimed. The platform milestone is **implemented and verified locally, with security, native-build, hosted-CI and environment-ownership gates still open**.

Exports also emit an upstream Sentry/Expo Router private `router-store` resolution warning and fall back successfully. No private router-store import was added to application code. Sentry remains optional and unconfigured in verification builds; validate route tracing and symbol upload with the chosen hosted monitoring project before claiming monitoring acceptance.

## Repeatable checks

```sh
npm ci
npm run check
npm run build:check
npm run doctor
npm run native:preflight
npm run config:check
```

`check` includes real local PostgreSQL financial/security tests, type/lint checks, generated database-type drift and installed SDK compatibility. Added environment tests exercise credential/URL/profile isolation and offline-publish rejection. A synthetic upgrade fixture seeds a genuinely paid/earned cash order before the reward migration and verifies preserved balances, receipt/status and fiscal-reference backfill afterward. This does not replace a representative live-data clone rehearsal.

`config:check` passes for the current development binding and prints only environment/project identifiers. It does not contact Supabase or prove hosted migrations have been applied. `doctor` uses disposable configuration while checking package metadata; it exits nonzero for the CocoaPods host requirement described above. Native exports validate bundling; native preflight validates project generation/plugins. Neither is a signed native or device acceptance result. Hosted CI includes native generation and both exports; a hosted run is still outstanding.

## Hosted and operational handoff

1. Confirm Pogo’s legal/account ownership and named administrators/recovery contacts. Inventory the current development service before any migration; classify real versus demo data and compare remote grants, policies, triggers, schema and migration history with the local baseline.
2. Provision approved isolated staging/production projects and platform app identities, then populate the corresponding bindings in a reviewed change. Configure EAS/GitHub environment variables, Expo channels, maps restrictions and optional environment-specific monitoring. Never put privileged keys into `EXPO_PUBLIC_` values.
3. Rehearse backup/restore and the complete migration on an isolated representative copy. Reconcile financial counts, opening balances, receipts, reward holds and fiscal references before and after. Keep branch intake/reward flags disabled until the data and operating procedures pass acceptance.
4. Run actual Supabase JWT/PostgREST/RLS/realtime and multi-session contention tests. The PGlite suite serializes a local engine and does not prove lock behavior under full PostgreSQL concurrency or real service configuration.
5. Generate fresh native builds after this SDK/runtime/app-identity change. Verify camera/QR, maps/location, authentication/recovery, notification permissions, cash/reward recovery, account switching, backgrounding and accessibility on the intended branch/customer hardware.
6. Record exact source/build/runtime evidence, verify hosted CI prevents an intentionally failing change from publishing, configure release authority and complete the remaining security/privacy/operations/pilot gates. Keep automatic GAAP ingestion and digital payments disabled as scoped.

This machine has Android SDK/JDK tools but no full Xcode installation. iOS native compilation/signing cannot be claimed from JavaScript export or project generation. No production readiness gate is closed merely by upgrading package versions.

The subsequent [identity recovery and staff access increment](identity-access-milestone.md) implements secure sessions, email recovery, MFA and audited branch invitations/permissions locally. It preserves the OTA triggers above. It does not close this report’s external platform gates or the remaining privacy/granular permission work.
