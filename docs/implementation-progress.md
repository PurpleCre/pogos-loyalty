# Implementation progress

Updated: 3 November 2026. Scope: local implementation increments for the cash-first release at Msasa, Kamfinsa and Westgate. GAAP is the confirmed POS vendor. Digital payments remain Release 2.

## Privacy core minimisation and review preparation

The 353-test client-data checkpoint was reverified before independent milestone 3 engineering. Client approvals remain unconfirmed, so milestone 2 stays open. A default-disabled, service-only core minimisation operation now checks current case/policy/field coverage and provider deletion, removes scoped contact/device data, preserves financial state with rollback checks and records immutable retry receipts. Unresolved notification dispatch blocks erasure. Separate retained/unstructured-record review and matching application evidence are required for completion. A private unapproved field-review generator and corrected unindexed public previews are included.

The complete `npm run check` passes **378 tests**, including 25 new core/policy/draft/preview cases; inventory covers **70 public tables**, with 29 export sections. The [implementation report](privacy-core-minimisation-milestone.md) records exact scope and limitations. Policy/retention/vendor approval, actual provider/manual/downstream/backup work, hosted/device acceptance and owned public hosting remain open. No real erasure, migration, activation or publication occurred. Six delivery groups remain.

## Client ownership/data onboarding preparation

The user reconfirmed on 3 November that there are no new client approvals. Milestone 2 is **in progress awaiting client evidence**. A private draft, strict schema, redacted completeness/capability reports, canonical approval digests and disabled configuration-review proposals are implemented, together with a read-only inventory and mapping/clone procedure. No source facts, production ownership, real balances or permissions are invented or applied. The complete local suite has **353 passing tests**, including 31 new intake/CLI/database cases, and `npm run check` checks that the committed template remains an unapproved draft. See [the milestone report and outstanding client inputs](client-data-milestone.md). Six delivery groups remain; actual ownership/data/business approval is not closed by engineering tooling.

## Offline/lifecycle and launch experience increment

The 292-test finance checkpoint was reverified before advancing. Account/environment-scoped cart persistence, validated public menu/branch snapshots, explicit private-read freshness, foreground/late-response guards and quote expiry are implemented locally. Confirmed checkout now retires matching branch selections durably before removing its recovery key. Logout fences old cart/address writers while preserving financial journals; unknown legacy offline actions are preserved for investigation rather than cleared or replayed. Launch screens remove stock/disabled-feature promotions and guessed delivery promises, use Harare map defaults and require a written address, and provide a public help/recovery route. Manager reward worklist access now matches server permission.

The increment first passed 315 tests. Reverification on 3 November corrected guest-copy ordering, reward-screen reactivation and overlapping recovery loading; the combined suite now has **322 passing tests**, including 30 lifecycle cases; type/lint/schema/SDK/peer checks and Android/iOS Hermes exports pass. See the [offline implementation and physical acceptance checklist](offline-launch-ux-milestone.md). Pogo’s artwork/product approval, actual devices/process kills, hosted acceptance and all earlier release gates remain open. No dependency, migration, cloud change, branch activation or publication was added. The [readiness checkpoint](production-readiness-status.md) now carries **six remaining delivery groups**, beginning with client ownership/data/business approval; current device/product acceptance is included in those groups.

## Reverification and remaining delivery milestones

The finance increment was reverified with a fresh `npm run check`: **292 passing tests**, zero failures, and successful type/lint/migration-type/SDK/peer checks. The finance screen and libraries match the successful Android/iOS exported source maps. Its local implementation is complete; Pogo’s authority approval, actual till reconciliation and hosted/concurrency/device acceptance remain open. The [production readiness checkpoint](production-readiness-status.md) consolidates all remaining implementation, review and release work into **seven delivery milestones**: six through an approved production candidate, followed by the observed pilot and staged three-branch rollout. This grouping carries forward earlier gates; it does not mark any original phase production-complete.

## Manager/finance permissions and reconciliation increment

The 265-test notification checkpoint was reverified before adding branch-scoped manager/finance roles, current-row MFA/privacy/push checks, governed role assignment, masked exact-money reports and immutable two-person reconciliation cases. Variances cannot be accepted as matching, changed snapshots become stale and external evidence revisions retain their prior case. Reports distinguish daily sales/refunds/deposits from all-date custody and preserve currencies and integer precision. The administrator's mixed/unpaid revenue card now links to currency-specific reports. Durable command recovery and complete scoped JSON exports are included. The combined suite has **292 passing tests**; see [finance implementation and activation](finance-permissions-milestone.md).

No role, cashier, business rule, cloud migration, financial statement, publication or OTA was activated. Pogo’s authority matrix, actual GAAP/till/opening evidence, full PostgreSQL concurrency and hosted/device acceptance remain open. The current inventory has 67 public tables and exports have 29 sections. Earlier sections preserve their checkpoint counts and boundaries; production ownership, actual erasure/retention, platform security, recovery/training and pilot gates still apply.

## Transactional notifications increment

The branch-operations checkpoint was reverified at 239 passing tests, including type/lint/schema/SDK/peer checks, Android/iOS exports and native generation, before advancing. The notification increment replaces the fake legacy sender with a default-disabled transactional outbox, installation proof/project binding, scoped native opt-in/withdrawal, event-triggered inbox, bounded worker leases/dispatch fences, separate Expo tickets/receipts, retry/invalid-token handling and governed unknown-result review. Notification taps revalidate current ownership and permissions before a closed app route opens. The full suite now has **265 passing tests** with type/lint/schema/SDK/peer checks passing. The inventory now covers 64 public tables; exports have 28 sections and actual deletion completion rejects retained push bindings/events. See [notification implementation and activation](transactional-notifications-milestone.md).

Both Android/iOS exports and temporary native generation pass; the native graphs include the native push adapter and exclude server worker code. No real push, migration, deployment, schedule or publication was performed. Owned project/provider configuration, Deno/gateway tests, real PostgreSQL concurrency, signed binaries and physical-device delivery/lifecycle acceptance remain open. Production privacy/erasure, fiscal/finance, granular permissions, hardening/recovery/training and pilot gates are still required. Earlier sections preserve their checkpoint counts and acceptance boundaries.

## Branch operations sprint

The 216-test checkpoint was reverified before adding scoped cash-intake pause/resume, branch-specific stock availability, immutable/recoverable commands, pending/overdue attention and opt-in foreground sound. Staff refreshes now expose stale data and block new changes until the queue is current; background/foreground, branch/account switching and late responses are guarded. The complete suite has **239 passing tests** with type/lint/schema/SDK/peer checks, Android/iOS Hermes exports and temporary native generation passing. The current inventory has 59 public tables and exports have 26 sections, including owned operational summaries. See [branch operations acceptance](branch-operations-milestone.md).

No live data/configuration, migration, OTA or app publication was changed. Real PostgreSQL concurrency, Supabase API/realtime, native sound/device and busy-shift acceptance remain required. Production branch data and staff-control approval are still client inputs. Next: transactional notifications/outbox/token lifecycle and delivery acceptance (P6-04); broader offline UX, reporting and all prior release gates remain open. The following sections retain their checkpoint-specific test counts and original boundaries.

## Historical migration replay correction

A reported remote push stopped at the location migration because an identically named policy already existed. The historical location and GAAP migrations now replace only their known policy names, preserving tables/data and unrelated policies. Added upgrade regressions exercise preinstalled objects/data, repeated migration execution, address ownership and final GAAP containment. The combined suite now has **216 passing tests**; type/lint/schema/SDK/peer checks pass. See [migration recovery steps](migration-replay-recovery.md) for explicit linked-project planning/retry commands and history-reconciliation boundaries. No remote command was executed while preparing this correction; the rest of this report retains its checkpoint-specific test counts.

## Subsequent verification and checkout increment

The foundation increment was rechecked before advancing: all 28 original tests, TypeScript, lint and database-type drift checks passed. The next local increment implements trusted cash quotation/order creation, modifier-aware cart lines, delivery-zone checks, immutable contact/item/address snapshots and persistent submission recovery. See the [cash checkout milestone](cash-checkout-milestone.md) for its acceptance report and boundaries. The combined suite now contains 67 tests and Android bundle export passes. No hosted configuration or deployment was performed.

## Cash fulfilment and ledger increment

The next local milestone is implemented: branch-authorised/versioned fulfilment commands, delivery collector assignment, exact cash receipt/change, two-person till acknowledgement, full till-funded refunds, immutable earning rules, opening-balance review and a projected loyalty ledger. Staff actions survive interrupted responses through persisted command identity. Customer tracking/history now reflects the expanded states and refunds. The combined suite has 100 passing tests; TypeScript, lint, local type drift and Android bundle export pass.

See [cash fulfilment acceptance and activation procedure](cash-fulfilment-milestone.md). Branch flags remain disabled by default; no real cashiers, timers or earning rules were assumed. Expiry has a service-only worker function but still requires a hosted schedule. The legacy GAAP processor is now disabled for the service role too. No hosted project or publication changed. The subsequent reward reservation/fulfilment increment is recorded below.

## Reward reservation and fulfilment increment

The reward milestone is implemented locally: approved immutable branch offers, points/allocation holds, private owner tickets and locally generated QR codes, exclusive staff claim before physical handover, GAAP-linked fulfilment, unused release/expiry and governed correction. Purchase-refund timing is tested; balances and held points reconcile to the ledger and reservations. Customer and staff commands persist before submission and recover exact interrupted requests.

The combined suite at this checkpoint had 141 passing tests, with TypeScript, lint, generated-type drift and Android bundle export passing. See [reward acceptance and activation procedure](reward-redemption-milestone.md). No real benefits, rates, stock, reservation periods or branch flags were configured. A hosted expiry schedule, actual till/finance approval, full PostgreSQL concurrency and native QR/device tests remain outstanding. No hosted project or publication changed.

## Platform and environment increment

The 141-test reward milestone was reverified before advancing through Expo SDKs 53–58 to Expo 58.0.21, React Native 0.88.1 and React 19.3.0. The final 149-test suite, TypeScript, lint, generated types, SDK compatibility and strict peer graph checks pass. Android/iOS Hermes exports and native project generation pass with disposable inputs. Expo Doctor passes 19/20 checks; this host lacks CocoaPods and full Xcode. Native compilation and device acceptance remain open.

Current configured accounts are retained for development under the user’s authorisation. Staging/production ownership is unconfirmed; unapproved or mixed environment bindings fail closed. Development OTA publishing runs after checks on pushes to `main`; manual runs can select development or approved staging. See the [OTA runbook](ota-updates.md). No hosted migration, build, publication or provisioning was performed.

The final audit reports 26 affected package entries (2 low, 21 moderate, 3 high, zero critical), compared with the original 48. The high entries trace to Expo CLI’s Zod 3 dependency; the app uses patched Zod 4.6.7. Both native source maps exclude the audited tooling roots. Remaining findings are an open release gate, not an accepted exception. See [platform readiness evidence and handoff](platform-readiness-milestone.md).

## Identity recovery and staff access increment

The identity increment implements one auth provider, email confirmation/resend and PKCE recovery, encrypted/chunked native credentials, memory-only browser bearer sessions, persistent recovery/logout guards, authenticator enrollment/verification, explicit multi-branch membership and audited role/invitation/revocation commands. Direct role table/column writes are removed. Staff/admin AAL1 requests are denied by database policies and command checks; privileged Edge Functions now check the caller’s database permission instead of reading roles through service credentials. Administrator state is scoped to the current account/access state.

The combined suite has 181 passing tests, including customer cash/reward journeys at AAL1 and explicit staff/admin AAL2 denial/grant cases. TypeScript, lint, generated types, SDK/peer checks and Android/iOS exports pass; native generation verifies SecureStore backup-rule references. See [identity acceptance and activation](identity-access-milestone.md) for evidence, storage tradeoffs and the migration procedure. No invitation email, account creation, hosted setting change, migration or publication was performed. Cashier approval remains separate. Hosted Auth/PostgREST/Deno tests, fresh native builds/devices, lost-factor operations, granular manager/finance tiers and privacy/export/deletion remain open Phase 2 gates; the complete phase is not marked production-ready. Automatic development OTA after checks on `main` and manual development/staging triggers remain enabled.

## Privacy request, export and consent increment

The identity checkpoint was reverified before advancing; a subsequent review corrected explicit logout address-cache cleanup while preserving financial recovery checkpoints. The privacy increment adds fresh-identity account exports, versioned default-off marketing consent, durable deletion requests and customer updates, named MFA reviewer controls, processing pause/resume and six-system evidence gates. Approved processing freezes new trading; completed deletion denies old-token access while retaining approved financial records. No automatic erasure worker or real policy/retention approval is claimed.

The user confirmed **pgonese6@gmail.com** as the temporary privacy contact. The local data map classifies all 57 public tables; the complete suite has **214 passing tests**, with type/lint/schema/SDK/peer checks, Android/iOS exports, native generation and standalone public-page preview generation passing. The new audit reports 26 affected entries (1 low, 23 moderate, 2 high, zero critical); tooling/security gates remain open. See [privacy acceptance](privacy-milestone.md) and [the approval/operator runbook](privacy/data-lifecycle.md).

No cloud migration, account/vendor erasure, communication or website/OTA publication was performed. Approved executable erasure/minimisation, retention deadlines, provider/backup handling, public hosting, real Auth/Deno/Postgres and device/browser acceptance remain required. The next independent work area is branch operational readiness: intake/availability controls, new-order alerts and reconnect/shift behavior.

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

1. Establish which hosted Supabase project is authoritative. The legacy `supabase/config.toml` identifier was a local stack label, not proof of a linked remote project. Inventory actual CLI link metadata and service ownership; the currently configured project is approved for development only.
2. Inventory the live schema, migration history, explicit table/column/function grants, RLS policies, triggers, staff assignments, deployed functions and data read-only. In particular, inspect column-specific grants as well as table grants and grants to any custom API roles; the local fixture models the standard anon/authenticated roles.
3. Back up and rehearse on an isolated representative copy. Compare the backfilled historical table definitions with the actual deployed definitions; `CREATE TABLE IF NOT EXISTS` preserves existing tables but does not reconcile their columns, constraints or permissions. Resolve schema/history discrepancies before migration execution or marking historical versions applied.
4. Review the containment migration and expected downtime/feature unavailability. Disable GAAP ingestion while its contract is provisional. The migration revokes standard API-role table/column writes; inspect inherited grants and custom roles identified by inventory too, and confirm no alternate privileged write path remains.
5. Coordinate app/function/database changes under a reviewed release. Verify customer A/B, staff branch A/B, admin and anonymous access against the actual Supabase API after staging deployment, including old-client attempts. Run Edge Function authentication/disabled-ingestion scenarios in the Deno/Supabase runtime.
6. Confirm balance/transaction counts and branch queue visibility, monitor denied legacy calls, and give support a clear customer message. Keep the financial restrictions in place; restore service through trusted commands rather than reopening unsafe grants.

No cloud deployment or native app release was performed. Hosted CI execution, live-schema comparison, real-device auth/cache behavior, Edge Function runtime tests, and upgrade/cutover rehearsal remain required.

## Remaining first-release work

1. Inventory deployed data and ownership; separate historical demo fixtures from production data. Verify approved branch records, menus/modifiers, currencies, delivery zones/fees, staff devices and cash/till procedures for all three branches.
2. Complete security remediation/review, hosted CI and native build/device acceptance for the locally verified Expo 58 upgrade. The latest privacy audit has 26 affected package entries, including 2 high in a tooling dependency chain and zero critical. Resolve the remaining platform gates in the linked report before release.
3. Deploy and validate the implemented server quotations and atomic idempotent cash orders in staging, import verified business data and complete device/concurrent-session tests before activating a branch.
4. Stage the implemented earning/refund and reward reservation/fulfilment commands, complete opening-balance reconciliation, approve real benefits and configure/test reward expiry. Run concurrent-session and device acceptance before activating redemption.
5. Stage and exercise the implemented branch fulfilment/cash workflow, configure the expiry worker, and reconcile it against real tills. Obtain the GAAP contract or approve/rehearse the documented manual bridge; automation remains disabled.
6. Stage and accept identity/invitation/MFA, manager/finance scope, privacy request/export, transactional notification and reporting controls; approve Pogo’s authority matrix, fiscal responsibilities and actual erasure/retention procedure. Complete broader offline/reconnect and customer launch UX, monitoring, recovery rehearsal and branch training.
7. Run release acceptance and an observed one-branch pilot before enabling the remaining two branches. Retain the product/security/finance/privacy gates in the production plan.

The backlog records partial work explicitly. Local containment is not marked as deployed, and broader phases are not marked complete by these changes.
