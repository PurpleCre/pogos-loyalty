# Pogo’s Zimbabwe

Mobile ordering and loyalty application for Pogo’s, built with Expo / React Native, Expo Router, TypeScript, NativeWind and Supabase.

The confirmed branches are **Msasa, Kamfinsa and Westgate**. The first production release targets loyalty and ordering with cash on collection/delivery. GAAP is the POS vendor; digital payments follow later.

## Current status

Production implementation is underway. The foundation and cash checkout increments are verified locally. Branch-scoped fulfilment, cash/till acknowledgement, full till-funded refunds and an audited loyalty ledger are now implemented locally. **This is not a production release.** Branch checkout stays disabled until its business data, cashier assignments, earning rules and operating procedures are approved and staged/device checks pass. Reward reservation, private collection tickets and staff handover are implemented locally and remain gated by approved branch offers and staging/device checks. QR receipt earning, gifting, self-service POS linking, unaudited points adjustments and client-side staff creation remain unavailable. GAAP ingestion is disabled by default pending vendor verification. Historical points are preserved as opening entries requiring review before new earning settles. The legacy GAAP processor is disabled until it uses the ledger.

See the [production plan](docs/production-implementation-plan.md), [task backlog](docs/production-backlog.csv), and [implementation progress/deployment notes](docs/implementation-progress.md).

The [4 November shared-menu import](docs/shared-menu-import.md) is applied to the connected **development** database: 51 products across nine categories, the user-selected displayed SadieXpress USD prices, captured modifiers, 44 product photos and the Pogo’s logo/header. Msasa, Kamfinsa and Westgate share the catalogue; four source-unavailable items remain hidden from customers. The authorised reset removed nine legacy orders and preserved unrelated loyalty/history data. Westgate can be browsed but stays closed pending its operating setup. This is a snapshot import, with images hosted in our own storage. `npm run menu:verify:development` performs read-only public API/image acceptance; do not rerun the destructive replacement as routine setup. A matching native build is required for the new `expo-image` module.

See the [cash checkout milestone](docs/cash-checkout-milestone.md), [cash fulfilment and ledger milestone](docs/cash-fulfilment-milestone.md), and [reward redemption milestone](docs/reward-redemption-milestone.md) for financial workflow evidence. The [platform readiness report](docs/platform-readiness-milestone.md) and [identity report](docs/identity-access-milestone.md) record the SDK/session/MFA work and open release gates. The [privacy increment](docs/privacy-milestone.md) adds exports, consent and deletion tracking; policy approval and actual erasure remain gated. [Branch operations](docs/branch-operations-milestone.md) adds intake/availability controls, foreground attention and stale/reconnect safeguards. [Transactional notifications](docs/transactional-notifications-milestone.md) add a disabled-by-default outbox/worker, native registration lifecycle and an in-app inbox. The [manager/finance increment](docs/finance-permissions-milestone.md) adds branch-scoped roles, exact per-currency cash reports, complete JSON exports and independent reconciliation review. The latest [offline and launch UX increment](docs/offline-launch-ux-milestone.md) adds saved carts, explicit stale browsing/points/order states, quote lifecycle checks and safe checkout/cart retirement. The [privacy core minimisation increment](docs/privacy-core-minimisation-milestone.md) adds a disabled service-only operation, financial rollback checks, immutable run recovery and explicit retained-record review. The default suite has 493 tests, including client-intake, minimisation, runner-boundary and shared-menu replacement checks. The [Edge runtime sprint](docs/edge-runtime-sprint.md) now has 28 native Deno HTTP cases, protected expiry entrypoints and strict checks for all seven functions; providers and the backend are simulated in that suite. A separate [PostgreSQL concurrency suite](docs/postgres-integration-sprint.md) passes 13 real concurrent scenarios and transactional migration replay. The [error-reporting safety sprint](docs/monitoring-safety-sprint.md) adds an explicit payload allowlist, isolated default-off reporting configuration and an [incident-response runbook](docs/operations-monitoring-runbook.md). The [backend queue-health foundation](docs/backend-health-sprint.md) adds service-only aggregate gauges, an unknown-safe evaluator and an unpublished synthetic dashboard. The [worker/collector, recovery and security increment](docs/milestone-5-local-engineering.md) adds durable worker observations, local alert-state handling, a real PostgreSQL dump/restore and load rehearsal, and a release-blocking dependency audit. The [loyalty and notification integrity increment](docs/loyalty-notification-integrity-sprint.md) adds a service-only mismatch/backlog snapshot, strict policy and collector/alert integration. The [security and scaled-performance increment](docs/security-performance-sprint.md) applies the supported Expo 58.0.23 patch, clears the high/critical dependency gate (17 moderate findings remain), and adds a four-case scaled PostgreSQL workload with an integrity-query correction. Hosted/provider/device, Pogo’s product approval and actual till acceptance remain open.

Staff, manager, finance and administrator operations require authenticator verification. Administrators create branch invitations in **Admin → Users**; recipients verify their own email and accept under **Profile → Account security and branch invitations**. Invitations do not send email or create an account on the recipient’s behalf. A fresh native build is required for SecureStore; existing plaintext sessions require a new sign-in. Hosted auth configuration and migration/device acceptance remain outstanding.

Privacy controls are under **Profile → Privacy, account export and deletion**. The temporary contact is **pgonese6@gmail.com**. No real policy, retention approval or privacy reviewer is seeded; deletion processing stays disabled. File exports need a fresh FileSystem/Sharing native build. The [operator runbook and data map](docs/privacy/data-lifecycle.md) record what must be approved and rehearsed before erasure or publication.

**Profile → Order updates and device notifications** opens the transactional inbox. Native push requires explicit opt-in, an approved project, a physical development/release build and server activation; Expo Go/browser push is not enabled. Both dispatch switches default off. Retire the deployed legacy sender and follow the [notification activation procedure](docs/transactional-notifications-milestone.md) before enabling delivery.

**Profile → Cash reports and till reconciliation** is available to managers and finance users for assigned branches, and administrators for all branches. Finance access does not grant fulfilment or refund authority; managers retain ordinary branch operations. Cashier approval remains separate. Observations need an independent finance/admin reviewer and do not change cash or points. No manager/finance roles are seeded; Pogo’s must approve assignments and the authority matrix before activation.

Saved menu data is for browsing; a fresh online quote confirms currency, stock and the total. Cart selections persist on this device by environment/account and clear on logout; interrupted financial command references survive logout. An older unknown offline-activity queue is preserved for support investigation. **Help** is available at `/support`; general branch support channels still need confirmation.

Client ownership/data onboarding is now supported by [the intake tooling](config/client-intake/README.md) and a [review/inventory procedure](docs/client-data-milestone.md). `npm run client:status` shows the explicit missing inputs. Actual client approvals are still unconfirmed, so milestone 2 remains open and six delivery groups remain. Generated proposals keep trading disabled and cannot apply changes.

## Local development

Use Node.js 22.19 or a compatible Node 22 release; `.nvmrc` pins the version tested in CI.

```sh
nvm use
npm ci
cp .env.example .env
```

Set `EXPO_PUBLIC_APP_ENV=development` and the client-visible Supabase URL/anon or publishable key matching the approved development project in `config/environments.json`. The existing configured accounts are authorised for development only; staging/production bindings remain unconfirmed and fail closed. See `.env.example` for platform-specific Maps inputs. JS error reporting requires a matching isolated binding in `config/error-reporting.json`, `EXPO_PUBLIC_SENTRY_DSN` and exact `EXPO_PUBLIC_ERROR_REPORTING_ENABLED=true`. All bindings are currently unconfigured and reporting stays disabled. Follow the [review and activation procedure](docs/operations-monitoring-runbook.md) before configuring it. Never place service-role, payment or webhook secrets in `EXPO_PUBLIC_` values.

```sh
npm start
npm run android
npm run ios
```

Native builds require the corresponding Android/iOS development tools. For database-backed device testing, configure an isolated Supabase environment; the automated database below is an in-memory PostgreSQL test engine, not a network database for the app.

The app icon, Android adaptive icon, native splash screen and browser favicon now use the captured Pogo’s logo on white. See [asset provenance and sizing](assets/brand/README.md). Icon/splash changes require a new native binary; OTA updates cannot replace them. Verify the final splash on a preview/release build.

For an installable Android test app that runs without Metro, use `eas build --platform android --profile development-apk`. This standalone APK uses the authorised development project, app ID `com.purpl3cr3.pogos.dev` and development OTA channel; it is separate from the `development` profile’s developer client. Required public Supabase/Maps settings are configured in the EAS development environment. Keep private credentials out of the source archive; `.easignore` excludes local backups, environment files, signing keys, Git history and client research materials. Staging/production builds remain unconfigured. See [the Android build record](docs/android-development-build.md).

## Verification

```sh
npm run check
npm run build:check
npm run build:web:check
npm run native:preflight
npm run test:postgres
npm run test:resilience
npm run test:performance
npm run security:audit
npm run doctor
npm run config:check
npm run monitoring:check
npm run health:check
npm run health:demo
npm run monitoring:demo
npm run privacy:pages
npm run privacy:policy:draft
```

`check` runs TypeScript, lint, the full financial/security/identity suite, database-type drift, SDK compatibility, installed dependency and monitoring-binding and queue-health-policy checks. Database tests apply the complete migration history to local PGlite, reproduce Supabase auth identities/roles/AAL claims, and execute SQL under anonymous/customer/staff/admin roles. They load no `.env` and contact no live database. They do not replace deployed Supabase, concurrency, Edge Function or device acceptance tests. Separate native Deno checks use the pinned development dependency:

```sh
npm run edge:check
npm run test:edge
```

The Edge suite uses loopback HTTP with the actual SDK and synthetic responses; it loads no `.env` and cannot contact real providers. Reports and JUnit output go to ignored `dist/edge-runtime/`. See [scope and activation requirements](docs/edge-runtime-sprint.md).

`build:check` exports Android/iOS Hermes bundles and source maps to ignored `dist/android` and `dist/ios` using disposable inputs. `build:web:check` verifies the browser export in `dist/web`, including its sectioned source maps, and runs in CI alongside the native exports. Web development requires the SDK-aligned `react-native-web` dependency recorded in the lockfile; after dependency changes, restart Metro with `npm run web -- --clear`. These verification commands use disposable configuration and do not publish or connect to the development database. `native:preflight` generates both native projects in a temporary copy without installing dependencies. These do not compile or sign an app. `doctor` requires public metadata access; this host passes 19/20 checks with missing CocoaPods remaining. Pull requests run checks, native generation and exports.

OTA updates publish automatically to **development** after checks pass on pushes to `main`. To trigger one manually, open GitHub Actions → **Publish OTA update** → **Run workflow** and choose development or approved staging. See [OTA setup and runtime requirements](docs/ota-updates.md) for required GitHub/EAS configuration. Existing installations need a matching native build for the current SDK 58.0.23 fingerprint; an OTA cannot supply changed native dependencies.

`health:demo` replays local migrations into disposable PGlite and generates `dist/operational-health/index.html` plus `report.json` using synthetic thresholds/data. It has no target arguments or live credentials. The committed health policies are unconfigured and evaluate to unknown; no collector, scheduler or alert is activated. `monitoring:demo` also generates a synthetic integrity dashboard at `dist/integrity-health/index.html`, with ledger discrepancy, missing-pair, recovery and unavailable-collector scenarios. See [coverage and deployment requirements](docs/backend-health-sprint.md).

`privacy:pages` builds standalone, unpublished privacy/deletion previews in `dist/privacy-pages`. A release build requires `-- --release --notice=/path/to/reviewed-notice.json`; a missing approved notice fails before output is created. The complete web app, public origin and store-link acceptance remain separate gates.

`privacy:policy:draft` creates an exclusive private field-review draft in `.local/privacy/policy-draft.json` from local migrations. All approvals, reasons and retention decisions remain unconfirmed; it cannot apply or activate anything. See [scope and required review](docs/privacy-core-minimisation-milestone.md).

The real PostgreSQL suite uses its own temporary local Docker server and synthetic accounts. It refuses hosted targets, removes its own server and writes a redacted report to `dist/postgres-acceptance/report.json`. Prepare the image explicitly, then run:

```sh
npm run test:postgres:pull
npm run test:postgres
npm run test:resilience
```

See [the integration sprint](docs/postgres-integration-sprint.md) for exact coverage and the remaining hosted/device/till gates. The reusable CI workflow includes this suite; hosted workflow execution remains unverified.

`security:audit` queries the public advisory registry, writes a redacted report to `dist/security-audit/` and blocks production acceptance on high/critical findings or incomplete evidence. The 4 November result passes that gate with zero high/critical/low and 17 moderate package findings. Moderate and independent review remain open. This is separate from development OTA checks and does not establish production readiness. See [the remediation and remaining production gates](docs/security-performance-sprint.md).

After schema changes:

```sh
npm run db:types
npm run db:types:check
```

Database types and enum constants are generated from the migrated local PostgreSQL catalogue; do not edit `lib/types.ts` by hand.

## Database changes

The historical catalogue/order creation migration fills a gap in the recorded history. **Do not push it blindly to an existing project.** First compare the deployed schema/history, review legacy policies and triggers, rehearse the upgrade, and follow the deployment notes. The two migrations applied to the connected development project on 4 November are recorded in [the import report](docs/shared-menu-import.md); this does not prove a representative production upgrade.

Some historical migrations still contain demo seeds. Fresh disposable resets are useful for engineering, but those records are not approved Pogo’s branch/menu data. Verified imports, representative upgrade rehearsal, security remediation and native/device acceptance remain outstanding. Cash fulfilment and loyalty/reward ledgers are implemented locally with activation gates. Root maintenance scripts can write remote data and are not part of the test commands.
