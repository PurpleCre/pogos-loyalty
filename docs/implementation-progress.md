# Implementation progress

Updated: 31 October 2026. Scope: local implementation increments for the cash-first release at Msasa, Kamfinsa and Westgate. GAAP is the confirmed POS vendor. Digital payments remain Release 2.

## Subsequent verification and checkout increment

The foundation increment was rechecked before advancing: all 28 original tests, TypeScript, lint and database-type drift checks passed. The next local increment implements trusted cash quotation/order creation, modifier-aware cart lines, delivery-zone checks, immutable contact/item/address snapshots and persistent submission recovery. See the [cash checkout milestone](cash-checkout-milestone.md) for its acceptance report and boundaries. The combined suite now contains 67 tests and Android bundle export passes. No hosted configuration or deployment was performed.

## Cash fulfilment and ledger increment

The next local milestone is implemented: branch-authorised/versioned fulfilment commands, delivery collector assignment, exact cash receipt/change, two-person till acknowledgement, full till-funded refunds, immutable earning rules, opening-balance review and a projected loyalty ledger. Staff actions survive interrupted responses through persisted command identity. Customer tracking/history now reflects the expanded states and refunds. The combined suite has 100 passing tests; TypeScript, lint, local type drift and Android bundle export pass.

See [cash fulfilment acceptance and activation procedure](cash-fulfilment-milestone.md). Branch flags remain disabled by default; no real cashiers, timers or earning rules were assumed. Expiry has a service-only worker function but still requires a hosted schedule. The legacy GAAP processor is now disabled for the service role too. No hosted project or publication changed. Reward reservation/fulfilment is the next implementation increment.

The remaining sections preserve the foundation milestone’s original evidence and deployment prerequisites. Statements about disabled legacy checkout and future ledger work below describe that earlier checkpoint; the linked milestone reports record the subsequent implementation.

## Implemented locally

- Restored the missing historical catalogue/order creation migration so the full recorded migration sequence applies in disposable PostgreSQL. Added the staff enum and store assignment through migrations rather than an ad hoc remote script.
- Revoked direct customer/admin writes to balances and financial records, including legacy column-specific grants; blocked forged achievements, referrals, gifts, sync logs and self-verified POS links. Restricted editable profile fields so an email/POS identifier cannot be supplied as a customer-controlled matching key.
- Disabled the vulnerable legacy transfer function and limited GAAP processing RPC execution to the service role. Added explicit function search paths and deny-by-default privileges for newly created functions.
- Applied restrictive order/item and catalogue write boundaries that also constrain older permissive policies. Customer and branch-staff order visibility is exercised with real database roles, including simulated permissive legacy policies.
- Removed any legacy unpaid-order award trigger and paused signup referral bonuses. Existing balances and transaction rows are preserved; opening-balance reconciliation is still required before ledger migration.
- Disabled speculative GAAP ingestion by default; missing signatures/secrets fail verification. HMAC uses Web Crypto verification. Unknown/inactive branches are rejected and JSON payloads are no longer double encoded. The actual GAAP signing/event contract remains unverified.
- Added an explicit authenticated-user check to AI support and administrator authorization to the legacy push sender. The push sender still needs replacement with the planned outbox/Expo implementation; it is not a production notification service.
- Removed unsafe client write implementations for checkout, QR earning, redemption, gifting, account linking, unaudited points adjustments, and auth-admin user creation. Customer screens show unavailable states instead of awarding demo points or promising automatic linking.
- Scoped saved-address caches by account, discarded unattributable legacy cache data, blocked stale account responses from replacing current private state, and cleared private query/cart state on identity changes. Deferred role lookup outside the auth callback and guarded stale role responses.
- Generated all public-table/function/enum types and enum constants from the migrated local PostgreSQL catalogue. Fixed the original type failures, nullable-field handling, an incompatible order-query builder assignment, and conditional hook ordering in the dashboard.
- Removed fallback branches with fake IDs from live fetching. Branch fetch failures now surface an error. Confirmed production branch/menu import is still pending.
- Added `npm run check`, local database security tests, cache/signature tests, type-drift checks, a working ESLint 10 configuration, and a reusable CI workflow. Preview EAS publishing now depends on checks and Android bundle export.
- Replaced the placeholder Sentry DSN with optional environment configuration; provided `.env.example`, Node version configuration and accurate development documentation.

## Validation evidence

- TypeScript: zero errors.
- ESLint: passes. Existing explicit-any and unused-variable cleanup remains outside this increment; the hooks ordering rule is enforced.
- Local database/security/cache/signature suite: 28 tests covering migration execution, preserved balances, untrusted writes, RPC grants, cross-account/branch reads, old permissive policies, unpaid-order triggers, referral abuse, account cache isolation, and signature validation.
- Database type generation: output is checked against the actual local migration catalogue, including enum constants.
- Android release bundle: Expo/Metro/Hermes export succeeds. This validates JavaScript/native-module bundling, not a signed APK, on-device behavior or store acceptance.
- All database tests use in-memory PGlite and minimal Supabase auth/role fixtures. No live project, user account, merchant account, database migration or app publication has been changed.

Repeatable commands:

```sh
npm run check
npm run build:check
```

## Existing-environment deployment prerequisites

This increment is intentionally a containment checkpoint, not a live checkout rollout. Applying its database migration disables legacy write endpoints for already installed clients too. It must be coordinated with customer-facing availability and branch support.

1. Establish which Supabase project is authoritative. The repository's legacy CLI project reference and EAS configuration point to different projects; do not choose a target by assumption.
2. Inventory the live schema, migration history, explicit table/column/function grants, RLS policies, triggers, staff assignments, deployed functions and data read-only. In particular, inspect column-specific grants as well as table grants and grants to any custom API roles; the local fixture models the standard anon/authenticated roles.
3. Back up and rehearse on an isolated representative copy. Compare the backfilled historical table definitions with the actual deployed definitions; `CREATE TABLE IF NOT EXISTS` preserves existing tables but does not reconcile their columns, constraints or permissions. Resolve schema/history discrepancies before migration execution or marking historical versions applied.
4. Review the containment migration and expected downtime/feature unavailability. Disable GAAP ingestion while its contract is provisional. The migration revokes standard API-role table/column writes; inspect inherited grants and custom roles identified by inventory too, and confirm no alternate privileged write path remains.
5. Coordinate app/function/database changes under a reviewed release. Verify customer A/B, staff branch A/B, admin and anonymous access against the actual Supabase API after staging deployment, including old-client attempts. Run Edge Function authentication/disabled-ingestion scenarios in the Deno/Supabase runtime.
6. Confirm balance/transaction counts and branch queue visibility, monitor denied legacy calls, and give support a clear customer message. Keep the financial restrictions in place; restore service through trusted commands rather than reopening unsafe grants.

No cloud deployment or native app release was performed. Hosted CI execution, live-schema comparison, real-device auth/cache behavior, Edge Function runtime tests, and upgrade/cutover rehearsal remain required.

## Remaining first-release work

1. Inventory deployed data and ownership; separate historical demo fixtures from production data. Verify approved branch records, menus/modifiers, currencies, delivery zones/fees, staff devices and cash/till procedures for all three branches.
2. Upgrade Expo/React Native and remediate dependencies with compatible native builds. Dependency installation currently reports 48 audit findings (8 low, 15 moderate, 23 high, 2 critical); these are not resolved by the authorization tests or a passing bundle export. Triage and verify remediation before release; do not use a blind force upgrade.
3. Deploy and validate the implemented server quotations and atomic idempotent cash orders in staging, import verified business data and complete device/concurrent-session tests before activating a branch.
4. Validate the implemented earning/refund ledger in staging and complete opening-balance reconciliation. Build reward reservations/fulfilment and replace the disabled redemption paths through those commands.
5. Stage and exercise the implemented branch fulfilment/cash workflow, configure the expiry worker, and reconcile it against real tills. Obtain the GAAP contract or approve/rehearse the documented manual bridge; automation remains disabled.
6. Complete production identity/invitations/MFA, privacy/deletion and fiscal responsibilities, transaction notifications, offline/reconnect handling, reports, monitoring, recovery rehearsal and branch training.
7. Run release acceptance and an observed one-branch pilot before enabling the remaining two branches. Retain the product/security/finance/privacy gates in the production plan.

The backlog records partial work explicitly. Local containment is not marked as deployed, and broader phases are not marked complete by these changes.
