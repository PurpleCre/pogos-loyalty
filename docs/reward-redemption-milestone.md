# Reward reservation and fulfilment milestone

Updated: 31 October 2026. Status: implemented and verified locally for the cash-first Pogo’s release. No hosted migration, branch activation or publication was performed.

The preceding cash/ledger milestone was rechecked with its 100-test suite before implementation. This increment implements standalone, fixed-benefit rewards collected at one selected branch. It uses the existing audited loyalty account rather than direct client balance updates.

## Acceptance evidence

| Requirement | Implemented behaviour |
| --- | --- |
| Approved branch benefits | Immutable offer versions specify the exact benefit, terms, GAAP item reference, point cost and collection period. Branch approval/intake flags, actual allocation and active-reservation limit must be configured explicitly |
| Authoritative reservation | `reserve_reward` derives the customer from authentication, locks the account and offer, checks reviewed opening/funds/eligibility/capacity, and atomically reserves one benefit unit and the server-defined point cost |
| No double spending | A hold reduces spendable `current_points` and increases `reserved_points`. Account locks serialize spending across offers; stock locks protect the final allocation. A reservation is not yet a redeemed reward |
| Private ticket | Only the owning customer can retrieve the random UUID claim code. It is excluded from list reads, staff audits and server command bodies. QR generation runs locally; codes are not sent to a third-party image service |
| Branch claim | Branch-authorised staff scan or enter the full code and inspect the benefit/customer/GAAP item before starting handover. QR parsing accepts only the dedicated payload or a complete UUID |
| Exclusive handover | Starting handover atomically changes `reserved` to `claiming` and assigns an operator. A second operator cannot claim that ticket; the customer code is no longer retrievable or look-up eligible |
| Actual fulfilment | The assigned operator confirms actual customer handover and a unique full GAAP sale reference. Hold settlement, gross redeemed points, redemption transaction and audit commit together. Administrator overrides require a reason |
| Cancellation and expiry | Customers can cancel untouched reservations. Staff can release them with a reason. A bounded service-only worker expires untouched reservations and restores both points and allocation once |
| Started handover resolution | `claiming` holds do not auto-expire and customers cannot cancel them. The responsible operator or administrator can release only after confirming no benefit was provided, or can record the actual handover. This prevents automatic point returns while physical handover is uncertain |
| Purchase refund interactions | A refund before handover starts may create points debt and block the claim. If an authorised handover already started, staff may record its actual completion while preserving the debt. If no benefit was provided, a controlled release restores the held points. Already fulfilled rewards are not silently released after a purchase refund |
| Correction | An administrator can void a mistaken fulfilment only with evidence/reason, a unique GAAP credit note and confirmation that no item or other benefit was provided. Points and the unused allocation return once; this is not a return path for consumed benefits |
| Shared sale identity | Cash sales and standalone reward fulfilments share one branch sale-reference registry; cash refunds and reward corrections share the credit-note namespace. A fiscal reference cannot be reused across these paths |
| Recovery | Customer and staff commands persist their identity before sending. Exact retries return the saved server result; a lost response, restart or account change cannot silently authorize another request. Malformed storage/ambiguous responses keep recovery blocked |
| Reconciliation | Ledger sum equals spendable account/display balance; ledger reserved deltas equal account/display held points and all reserved/claiming reservations. Gross earned and redeemed projections are checked separately |
| User experience | Customers select a branch, review terms/cost/collection time, reserve, display a QR or copy code, and see history/held points. Staff have scanning, exclusive handover, release, correction, audit and older-reservation lookup. Unsupported fixed tier/progress claims and placeholder reward photos were removed from these screens |

Core files: `supabase/migrations/20261031000000_reward_reservations.sql`, `lib/reward-redemption.ts`, `lib/reward-orders.ts`, `hooks/useRewardReservations.ts`, the customer rewards screen, and the staff reward-collection tab.

## Points accounting and state flow

| Event | Spendable balance | Held points | Lifetime gross redeemed |
| --- | --- | --- | --- |
| Reserve a reward costing P | −P | +P | unchanged |
| Cancel / expire / release without benefit | +P | −P | unchanged |
| Confirm handover | unchanged | −P | +P |
| Correct mistaken fulfilment with no benefit | +P | unchanged | unchanged; restoration has its own entry |

States: `reserved → claiming → fulfilled`; untouched reservations can become `cancelled` or `expired`. A started handover needs an explicit no-benefit release to become `cancelled`. A mistaken fulfilled record can become `voided` under administrator control. Every transition increments a version and creates an immutable event.

Cash purchase refunds reverse original earning even if that makes spendable points negative. They never invent redemption reversals or delete history. A claim is funded when handover begins; later refund debt stays visible while its actual physical outcome is recorded. Operations/finance must approve this policy and own negative-balance exceptions before activation.

## Verification

```sh
npm run check
npm run build:check
```

The combined suite has **141 passing tests**: the previous 100, 33 new PostgreSQL reward tests, and eight client/recovery tests. TypeScript, lint and generated-type drift checks pass. Android Expo/Metro/Hermes export passes with the new local QR encoder (`qrcode-generator`, pinned to 2.0.4). No existing dependency versions were upgraded by that addition.

Coverage includes authoritative pricing, eligibility, last-unit capacity, active limits, account/branch isolation, secret privacy, single-operator claim, stale/replayed commands, handover evidence, expiry, cancellation, release, correction, shared GAAP reference collisions, both refund timings, reconciliation, storage failures and injected ledger failures during reserve/fulfil/release/correction. Failure injection proves financial/allocation/reference/audit changes roll back together.

PGlite applies the real migrations and permissions locally but serializes a single database engine. Last-unit and version tests do not replace full PostgreSQL concurrent-session contention tests. Actual PostgREST/JWT/RLS/realtime behavior, QR readability/camera permissions on branch hardware, background/restart recovery, signed native builds and real-till entry remain staging/device gates. Bundle export does not prove a physical reward was handed over.

## Configuration and activation

No branch settings, offers, stock allocations, point costs or collection periods are seeded. Historical sample rewards alone cannot be reserved. Configure through a reviewed operator migration/process in an isolated representative environment:

1. Complete the existing schema/history inventory, backup and upgrade rehearsal. Review the new shared fiscal-reference backfill against existing cash receipts and credit notes, and map legacy/demo data before cutover. Automatic GAAP ingestion remains disabled.
2. Approve fixed benefits and programme terms for each branch. Supply the real reward/catalogue ID, exact customer-facing name/description/terms, GAAP product reference and point cost. This increment supports one standalone reward benefit per reservation; it does not discount a paid order, combine several rewards on one GAAP document, deliver rewards, or collect a cash top-up.
3. Configure `reward_branch_settings` with an approved active-reservation limit (technical range 1–20 per customer at that branch). `enabled` and `terms_approved` default false. Set them only after acceptance. Pausing intake blocks new reservations while existing ones remain resolvable.
4. Insert an approved `reward_branch_offers` version with positive point cost (technical range 1–1,000,000), collection period (1–1,440 minutes), exact GAAP item, terms and a finite available allocation. Initial allocation is zero and offers default disabled. These ranges are technical bounds, not an approved Pogo’s policy. Changing an offer’s benefit/cost/terms/expiry requires a new version. Only intake and available allocation can change in place.
5. Treat reward allocation as its own approved stock allowance, not automatic GAAP/menu inventory synchronization. Reservations reduce it; unused releases restore it; actual handover consumes it. Restocking and physical stockout exceptions need an operator procedure. The app’s catalogue editor cannot approve or restock branch offers; its active flag controls eligibility for future reservations only.
6. Review historical opening balances using the preceding milestone’s evidence workflow. New zero-start reviewed accounts can use subsequently earned points. Reconcile spendable and held points before and after rehearsal; a projection check is not finance approval of historical balances.
7. Verify the real GAAP standalone reward/zero-payment sale and credit-note process with finance/vendor. Record the app reservation ID in GAAP, and the complete date/till/sale or credit-note reference in the app. Each standalone benefit requires its own unique document identity in this implementation. The software records attestations and uniqueness; it cannot verify that a GAAP sale or physical handover happened.
8. Configure a protected hosted job to call `expire_reward_reservations` (batch 1–500), verify its schedule/backlog/monitoring and reconcile released points/allocation. The migration supplies the worker function only. Customers can release their own expired untouched holds without waiting for that job.
9. Train staff to start the claim before giving out an item, confirm actual handover, recover interrupted actions before retrying, and resolve outstanding `claiming` entries during shift handover. Started claims intentionally do not auto-release. Revoked staff devices, abandoned claims and negative balances require a named administrator/support owner.
10. Exercise the complete path with customer A/B, branch A/B, administrator, anonymous access and real devices. Include two counters scanning one code, final-unit allocation, concurrent point spending/refunds, camera denial/manual entry, phone clock differences, lost connectivity, app kill, shift change, expiry and correction. Obtain programme/finance/operations approval before enabling a pilot branch.

Claims are bearer secrets. Screens hide them on backgrounding, and API reads/commands are pinned to the initiating account. A pending staff **begin** command must retain its proof locally for exact recovery; it uses the existing account-scoped AsyncStorage recovery mechanism. Secure device/session storage, clipboard handling, redaction, retention/deletion and production identity review remain explicit release gates. Never add raw codes to logs, analytics, support screenshots or an external QR renderer.

## Next milestone

The subsequent [platform readiness increment](platform-readiness-milestone.md) reverified this 141-test checkpoint and implemented the Expo/React Native upgrade, explicit environment boundaries and expanded local verification. That report records the latest audit and remaining security, ownership, hosted-CI, migration-rehearsal and native acceptance gates. This reward increment itself did not upgrade dependencies.

The broader cash-first roadmap still requires identity/privacy completion, approved real branch data and opening balances, actual GAAP/till finance acceptance, operational alerts/notifications/availability/offline behavior, independent hardening/recovery/training, and an observed pilot before three-branch rollout. This local acceptance report does not close those production gates.
