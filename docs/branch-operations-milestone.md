# Branch operations sprint

Updated: 2 November 2026. **Implemented and verified locally; hosted and physical-device/shift acceptance remain open.** Scope: the existing cash-first customer/staff app for Msasa, Kamfinsa and Westgate. No real branch settings, catalogue, cloud migration or release was changed in this sprint.

Subsequent verification: the complete 239-test checkpoint, type/lint/schema/SDK/peer checks, both native exports and temporary native generation passed again before advancing to [transactional notifications](transactional-notifications-milestone.md). The production acceptance items below remain open. The notification increment extends the current inventory/export beyond this report's 59-table/26-section checkpoint.

## Starting point

The preceding privacy and migration-replay checkpoint was reverified: **216 tests**, TypeScript, lint, generated database types, SDK compatibility and installed-peer checks passed. Its ownership, policy/erasure, real Supabase/Postgres/Deno, independent security, signed native/device and pilot gates remain open.

## Delivered

- **Cash-intake controls:** assigned staff with MFA and administrators can pause/resume one branch using a versioned command and required reason. A pause rejects fresh quotes and unsubmitted quotes. Previously received orders, financial recovery and operational resolution remain available. Resuming changes only the pause flag; it cannot grant pricing, fulfilment, opening, cashier or production approval. Reward intake remains separately governed.
- **Item availability:** shared and branch-specific menu items have a branch-scoped availability override. A staff stockout at one branch leaves the shared catalogue and other branches untouched. Global item/category restrictions still apply. Both quotation and submission enforce the override. Public availability flags contain no staff identity or reason. Customer menus filter those flags, refresh on foreground and periodically, and show a retry state on refresh failure.
- **Audit and interrupted actions:** immutable command receipts record the authenticated actor, branch, reason and result. Exact retries return the original receipt without repeating an old pause over a newer change. Stale versions, altered requests and reused identities fail. The app persists the command before sending and retains ambiguous/auth failures for explicit recovery; another branch/action cannot replace it. Scoped history supports older pages including equal timestamps.
- **Queue attention:** a server-derived count/signature covers every pending quoted cash order, including rows beyond the displayed page. The screen shows overdue requests and a persistent attention count. Local acknowledgement silences that batch's reminders; accepting an order remains its separate audited server command.
- **Foreground sound:** staff explicitly enable/test sound. Native uses a local Expo notification with generic text and no customer/order payload; browser code uses a user-initiated audio context. Reminders are limited to one per 30 seconds while the queue is fresh, the screen is active and sound is enabled. Permission/scheduling failures visibly turn sound off. Device volume, channel settings, silent mode and browser restrictions still require a heard test. This supplies no background push/outbox service or guarantee of sound delivery.
- **Stale/reconnect handling:** staff polling is bounded by a 12-second API timeout, coalesces overlapping refreshes and supplements realtime with 15-second refreshes. Foreground/realtime resubscription refreshes again. A failed refresh, background/blur or snapshot older than 45 seconds blocks new cash/branch changes. Cached details are labelled; access-denied responses clear the private worklist. Saved command recovery remains available. Branch/account scope and revision checks reject late responses. The 45-second bound is an implementation freshness guard, not a client-approved operating SLA.
- **Privacy continuity:** the inventory now covers **59 public tables**. The **26th export section**, `branch_operations`, contains only the caller's command summaries and omits internal reasons/payloads and other operators. Owned branch recovery checkpoints survive normal logout and are removed on confirmed completed deletion. Actual retention/erasure approval remains outstanding.

The migration is `supabase/migrations/20261102000000_branch_operations.sql`. It adds two settings columns and two tables, creates narrow APIs, and applies checked changes to the current quote/submit/export definitions. It seeds no operational data and does not turn an unapproved branch on. The new shared/exclusive branch locks coordinate quote/submit with pause/stock changes; true multi-session contention still needs full PostgreSQL testing.

## Verification

The full suite passes **239 tests**, including **12 new database cases** and **11 client recovery/attention cases**. Cases include current membership/MFA, cross-branch denial, revoked/processing identities, pause versus received-order recovery, shared-item isolation, stock changes between quote/submit, catalogue restrictions, exact retries, NULL/version validation, direct-write/audit denial, pagination, equal-time history, a 101-order queue, owned export minimisation, storage failure and stale/background/clock checks.

TypeScript, lint, generated-type drift, SDK compatibility and installed-peer checks pass. Android/iOS Hermes exports and temporary native generation pass. No new package dependency was added. The suite uses disposable PGlite with simulated roles/claims; it does not prove hosted JWT/realtime configuration, full Postgres lock behavior or actual device sound/lifecycle acceptance. Existing platform tooling advisories remain unresolved; this sprint is not a fresh dependency audit or security approval.

```sh
npm run check
npm run build:check
npm run native:preflight
```

## Activation and shift acceptance

1. Complete the live-schema/history inventory, ownership and representative backup/migration rehearsal. Coordinate this migration before an app update that calls its new APIs. Use only an approved development/staging target for rehearsal. Existing automatic development OTA after checks on main and manual development/staging triggers are preserved; none was published here.
2. Obtain the client pack's branch sheets, catalogue/modifiers/prices, delivery/cash procedures, staff roster, intended hardware and operating thresholds. No branch data was inferred from a branch name. Confirm whether all assigned staff may use operational pause/availability controls or whether the forthcoming manager tier must restrict them.
3. Test customer A/B, branch A/B, assigned staff, administrators, AAL1/AAL2, revoked membership and old JWTs through actual Supabase APIs. Exercise two operators changing the same version, pause versus simultaneous quote/submit and final stock changes on full PostgreSQL. Verify operations audit and own export, without exposing other staff/customer data.
4. Run a busy shift on the actual branch devices. Enable sound and confirm it is heard; test notification/channel denial, silent/volume settings, browser restrictions, screen lock, background/foreground, tab change, branch/account switching, lost connectivity, timeout, app kill and an interrupted command. Confirm pending/overdue counts and reminders when more than a page of orders exists. Staff must accept the order separately from silencing reminders.
5. Rehearse pausing one branch while accepted orders, cash handovers, refunds and reward collections continue. Test shared-item stockout without affecting another branch. Validate the baseline launch/pricing/fulfilment/cashier gates still reject unapproved configuration and that reward intake remains separately controlled.
6. Agree device-attendance, network/power backup, shift handover and escalation procedures. Review pending cash, branch commands, reward claims and oldest unaccepted orders at handover. Name the person who can resolve an unreadable or permanently unauthorised recovery checkpoint; do not delete it blindly or substitute a fresh command ID.

## Remaining boundaries and next sprint

Transactional background/customer push delivery, durable notification outbox, delivery receipts/retries/token lifecycle and notification routing remain **P6-04**, the next implementation area. Foreground local notifications do not close that item. Broader offline browsing/cache policy and the legacy generic offline-action placeholder remain open; the application must not rely on that placeholder to recover financial work. Cash/reward/branch commands use their own durable recovery mechanisms.

Client-approved production catalogue, branding/allergens, granular manager/finance permissions, finance/GAAP/fiscal and opening-balance acceptance, privacy policy/actual erasure, expiry schedules, production ownership/CI, security/load/recovery testing, signed builds, training and the observed pilot remain required. Local implementation does not activate a branch or declare Phase 6 or the project production-ready.

Notification behavior follows the [Expo notification API](https://docs.expo.dev/versions/v58.0.0/sdk/notifications/). Actual sound depends on OS/device permission and settings; the acceptance procedure above is required on the intended hardware.
