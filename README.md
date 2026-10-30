# Pogo’s Zimbabwe

Mobile ordering and loyalty application for Pogo’s, built with Expo / React Native, Expo Router, TypeScript, NativeWind and Supabase.

The confirmed branches are **Msasa, Kamfinsa and Westgate**. The first production release targets loyalty and ordering with cash on collection/delivery. GAAP is the POS vendor; digital payments follow later.

## Current status

Production implementation is underway. The foundation and cash checkout increments are verified locally. Branch-scoped fulfilment, cash/till acknowledgement, full till-funded refunds and an audited loyalty ledger are now implemented locally. **This is not a production release.** Branch checkout stays disabled until its business data, cashier assignments, earning rules and operating procedures are approved and staged/device checks pass. Reward reservation, private collection tickets and staff handover are implemented locally and remain gated by approved branch offers and staging/device checks. QR receipt earning, gifting, self-service POS linking, unaudited points adjustments and client-side staff creation remain unavailable. GAAP ingestion is disabled by default pending vendor verification. Historical points are preserved as opening entries requiring review before new earning settles. The legacy GAAP processor is disabled until it uses the ledger.

See the [production plan](docs/production-implementation-plan.md), [task backlog](docs/production-backlog.csv), and [implementation progress/deployment notes](docs/implementation-progress.md).

See the [cash checkout milestone](docs/cash-checkout-milestone.md) for the original quotation/order-creation evidence. See the [cash fulfilment and ledger milestone](docs/cash-fulfilment-milestone.md) for cash handling evidence. The [reward redemption milestone](docs/reward-redemption-milestone.md) records the latest acceptance report, accounting rules, configuration and release gates.

## Local development

Use Node.js 22.19 or a compatible Node 22 release; `.nvmrc` pins the version tested in CI.

```sh
nvm use
npm ci
cp .env.example .env
```

Set the client-visible Supabase URL/anon or publishable key and the platform-restricted maps key for your development project. Sentry is optional through `EXPO_PUBLIC_SENTRY_DSN`. Never place service-role, payment or webhook secrets in `EXPO_PUBLIC_` values.

```sh
npm start
npm run android
npm run ios
```

Native builds require the corresponding Android/iOS development tools. For database-backed device testing, configure an isolated Supabase environment; the automated database below is an in-memory PostgreSQL test engine, not a network database for the app.

## Verification

```sh
npm run check
npm run build:check
```

`check` runs TypeScript, lint, security/cache/signature tests and generated-database-type drift checks. Database tests apply the complete migration history to local PGlite, reproduce Supabase auth identities/roles, and execute SQL under anonymous/customer/staff/admin roles. They load no `.env` and contact no live database. They do not replace deployed Supabase, Edge Function or device acceptance tests.

`build:check` exports the Android JavaScript/Hermes bundle to ignored `dist/android`; it does not produce or install a signed APK. Pull requests run these checks, and automatic preview EAS updates depend on them.

After schema changes:

```sh
npm run db:types
npm run db:types:check
```

Database types and enum constants are generated from the migrated local PostgreSQL catalogue; do not edit `lib/types.ts` by hand.

## Database changes

The historical catalogue/order creation migration fills a gap in the recorded history. **Do not push it blindly to an existing project.** First compare the deployed schema/history, review legacy policies and triggers, rehearse the upgrade, and follow the deployment notes. No hosted migrations have been applied by this implementation work.

Some historical migrations still contain demo seeds. Fresh disposable resets are useful for engineering, but those records are not approved Pogo’s branch/menu data. Production fixture separation, verified branch/menu import, SDK/dependency upgrades, trusted staff/cash fulfilment and the audited loyalty ledger remain planned work. Root maintenance scripts can write remote data and are not part of the test commands.
