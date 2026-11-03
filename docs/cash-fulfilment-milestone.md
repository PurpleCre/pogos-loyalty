# Cash fulfilment and loyalty ledger milestone

Follow-on verified 3 November: [the Edge runtime sprint](edge-runtime-sprint.md) supplies the default-disabled `expire-cash-orders` HTTP entrypoint with a dedicated worker key and fixed SQL batch of 100. No hosted schedule is installed; deployment, gateway, measured capacity and monitoring acceptance remain required.

Updated: 31 October 2026. Status: implemented and verified locally. Pogo’s confirmed branches remain Msasa, Kamfinsa and Westgate. Nothing was deployed or activated.

The previous [cash checkout increment](cash-checkout-milestone.md) was verified before this work. This increment connects its pending/unpaid orders to branch operations, cash receipts, till acknowledgement, full refunds and auditable earning. It does not complete every task in the production roadmap.

## Acceptance evidence

| Requirement | Implemented behaviour |
| --- | --- |
| Branch authority | Staff commands derive the actor from authentication and verify current branch membership; administrators can select a branch. Customers, anonymous callers and other-branch staff cannot operate the order |
| Fulfilment | Collection follows pending → accepted → preparing → ready → completed. Delivery adds assignment to a branch collector and dispatch before completion. State jumps and stale order versions fail |
| Acceptance timeout | A configured deadline is stamped at creation. Overdue requests cannot be accepted. Staff can close expired requests; a service-only, bounded, skip-locked worker command cancels overdue unpaid pending orders |
| Cash collection | Completion requires cash currency, integer tender, GAAP sale reference, confirmation of cash received/change returned, and customer handover. Receipt, status, purchase transaction, earning and audit commit together |
| Delivery handover | The assigned collector confirms delivery. An administrator override requires a reason and records the actual confirming administrator as the cash holder |
| Cash custody | Collected net order value stays outstanding with its holder. The holder nominates another configured cashier; that cashier must count and acknowledge it. A configured cashier can count personally held cash directly into the till. Pending handovers can be cancelled with a reason |
| Retry safety | Actor/command keys save the exact request and result. Exact replays return the recorded result; changed requests or stale versions fail. The app persists before sending, retains ambiguous failures across restarts, and blocks unrelated commands until checked |
| Full cash refunds | Administrators confirm a full refund paid from the GAAP till, with reason and unique credit-note reference. The original earn is reversed once. Refunds may restore a negative points balance without blocking the customer’s cash return |
| Refund custody accounting | A till-funded refund does not erase cash still held by a collector. That collected cash must still reach the till. Refunds directly funded from a collector’s unsettled cash and partial refunds are not supported by this increment |
| Versioned earning | The quote captures an immutable rule version and estimate. The configured subtotal/total basis, integer ratio, floor rounding and cap determine points. Disabling a rule affects future quotes; existing quoted orders retain that rule |
| Opening balances | Existing balances and historical gross totals are preserved as unreviewed opening entries. A reviewed zero-start account created after migration can earn. Paid orders on unreviewed accounts await administrator review, then an explicit earning retry |
| Audit and reconciliation | Ledger, cash movements, commands and internal status history are append-only. Original receipt values cannot change. Ledger projection updates the existing customer balance. Reconciliation finds balance/gross-total drift and missing records |
| Customer experience | Tracking includes acceptance and dispatch; recent terminal orders link to receipts. Receipts distinguish paid/refunded/cancelled totals. Refund history labels point reversals, and the unsupported double-points promotion is removed |
| Operator experience | Branch worklists include active orders, outstanding cash and pending earning reviews; pagination and exact order-ID lookup support older cases. Operators can inspect audit history. Cash reporting separates currencies and uses Africa/Harare business days |
| Privacy and legacy containment | Cash receipts and internal audit notes are visible only to authorised branch staff/admins. Customers retain their own order/status and loyalty reads. Direct points writes and the old GAAP earning processor stay disabled, including service-role column grants on points |

Implementation: `supabase/migrations/20261030000003_cash_fulfilment_ledger.sql`, `lib/staff-commands.ts`, `lib/staff-orders.ts`, `hooks/useStaff.ts`, staff/admin screens and customer order/history integration.

Validation commands:

```sh
npm run check
npm run build:check
```

The combined suite has 100 passing tests. TypeScript, lint and local database-type drift checks pass. Android Expo/Metro/Hermes bundle export passes; this is not a signed APK or a device acceptance test. The new coverage exercises permissions, exact receipts/change, command replay, stale versions, duplicate sale/credit-note references, state transitions, collector overrides, two-person till acknowledgement, expiry, rule snapshots, opening review, refunds, ledger failure rollback, reconciliation, currency boundaries and persistent client recovery.

Database tests apply all migrations to disposable PGlite with Supabase-like identities and roles; they do not read production credentials. PGlite serialises engine access. Full PostgreSQL concurrent-session/lock tests, actual Supabase JWT/PostgREST/RLS/realtime behaviour, device lifecycle/recovery tests and real-till exercises remain release gates.

## Activation and operating procedure

1. Complete the live environment inventory, backup, schema/history comparison and isolated upgrade rehearsal described in [implementation progress](implementation-progress.md). Reconcile existing financial counts/totals before and after migration. Historical demo fixtures are not production branch data.
2. Obtain verified branch IDs, catalogue prices/modifiers, currency, inclusive-price/fiscal policy, delivery fees/coverage and opening/intake procedure. Existing cash checkout gates still apply. No real branch data, cashiers or earning rates are seeded here.
3. In a reviewed operator configuration, assign real staff to their branch and configure active `cash_branch_cashiers` entries for designated till receivers. App staff cannot grant themselves cashier status. Removing a cashier or branch membership affects subsequent commands immediately on the server; unresolved cash custody requires an owned support resolution.
4. Approve the acceptance interval (supported technical range: 1–120 minutes) and configure `cash_order_settings.acceptance_minutes`. `fulfilment_enabled` defaults false. Quotation and first submission require that flag and at least one active, authorised branch cashier. Existing order recovery and operational resolution remain available during an intake pause.
5. Finance must supply each currency’s earning basis, points numerator, spend denominator in minor units, cap and effective time. Configure a new `cash_loyalty_rules` row rather than changing a used rule. Formula: `min(cap, floor(eligible_minor × points_per_unit / spend_unit_minor))`. No FX conversion or earning rate is assumed. Without an applicable rule the quote promises no points and completion records `no_rule`; first-release loyalty activation still needs an approved rule.
6. Review each historical opening against approved records through Admin → Loyalty review, recording the evidence/reference. This confirms the preserved opening; it does not adjust an incorrect balance or prove the historical data was legitimate. Resolve discrepancies through a reviewed migration/support process before approval. After review, open paid orders marked `awaiting_review` and retry earning. The ledger/projection check does not substitute for finance sign-off.
7. Rehearse the manual GAAP bridge: enter the app order reference in the actual GAAP sale; capture the complete unique GAAP reference, including business date, till and sale number. Refunds require the corresponding credit note and a full cash return from the till. References are normalised and unique within the branch, but the app cannot verify that a sale or physical cash exchange occurred. Staff attestations require daily matching against the actual tills and an exception owner.
8. Schedule `expire_pending_cash_orders` in staging using a protected service/owner job, then verify its execution, monitoring and batch capacity before release. The migration supplies the worker function only; it does not install a hosted schedule. The command is unavailable to customers and ordinary staff.
9. Exercise collection, delivery, absent customer, expiry, cancellation, duplicate references, lost response/restart, collector-to-cashier handover, till-funded refund and loyalty reversal on the intended devices. Check daily received/refunded/net/till totals per currency and all-date outstanding custody. These are movement totals, not an independently reconciled GAAP till-closing balance.
10. Enable intake only after operations/finance approval and staged acceptance. Activate branches independently; test pausing one branch and recovering existing orders. Keep the release/pilot gates in the production plan.

Configuration writes remain a reviewed operator responsibility; this increment does not expose a customer or staff activation/rate editor. Approval of business policy is still outstanding; local implementation is not approval to trade.

## Original next increment

Follow-on update, 31 October 2026: [reward reservation and fulfilment](reward-redemption-milestone.md) is now implemented locally. The next paragraph records this cash milestone’s original boundary; live reward activation remains gated.

Reward redemption remains disabled. Next: ledger-backed reward reservations, release/expiry, branch-scoped staff fulfilment, overspend prevention and refund interactions. QR claims, gifting/referrals and automatic in-store GAAP earning remain unavailable until their separate rules and verification exist. The legacy GAAP processor’s service execution is revoked; a webhook flag or saved integration configuration alone cannot enable it.

Other open gates include production identity/invitations/MFA, branch availability and new-order alerts, offline/foreground behaviour, transactional notification outbox, approved operational reports, independent security/load testing, backup/restore, fiscal/privacy review, real device/native builds, supported Expo/RN/dependency remediation, training and an observed one-branch pilot. The previously recorded 48 dependency audit findings have not been remediated in this increment.
