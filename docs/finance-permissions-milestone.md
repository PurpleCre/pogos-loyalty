# Manager/finance access and reconciliation milestone

Updated: 2 November 2026. **Implemented locally; Pogo’s authority matrix, actual till evidence and hosted/device/concurrency acceptance remain open.** No hosted migration, role assignment, real financial statement, publication or OTA was performed.

## Starting point

The preceding notification checkpoint was reverified at **265 passing tests**, including type/lint/schema/SDK/peer checks. Its disabled dispatch, scheduler/provider ownership, real Deno/Supabase and physical-device gates remain open. This milestone adds no dependency and does not activate any branch or notification service.

## Permissions delivered

Two enum values are introduced in a separate migration so PostgreSQL commits them before their use. Existing users keep their roles; no manager, finance user, cashier or approval is seeded.

| Capability | Customer | Staff | Manager | Finance | Administrator |
| --- | --- | --- | --- | --- | --- |
| Personal customer account/orders | Own account | Own account | Own account | Own account | Own account |
| Branch worklist, customer fulfilment details, cash/reward operations | No | Assigned branches | Assigned branches | No | All branches |
| Operational intake/availability | No | Assigned branches | Assigned branches | No | All branches |
| Acknowledge cash into till | No | Separate cashier approval | Separate cashier approval | No | Separate cashier approval |
| Masked cash/GAAP-reference reports | No | No | Assigned branches | Assigned branches | All branches |
| Submit external reconciliation observations | No | No | Assigned branches | Assigned branches | All branches |
| Review a matching observation | No | No | No | Assigned branches; another submitter | Another submitter |
| Refund execution, supervisor overrides, historical-opening approval | No | Existing responsible-operator actions only | Existing responsible-operator actions only | No delegated approval | Existing administrator commands |
| Role grants, pricing/catalogue administration, privacy review and push exceptions | No | No | No | No | Existing administrator gates; privacy review also needs named assignment |
| Chain-wide account point totals | No | No | No | No | Aggregate overview and existing reconciliation controls |

MFA and current branch membership are enforced by the database for the new privileged capabilities. Managers use existing ordinary staff workflows; this milestone does not grant them administrator overrides. Finance access does not expose customer contact/address columns or grant a branch worklist. An employee may still use their own ordinary customer account.

Administrator access changes validate verified, non-deleted targets, explicit distinct branch IDs and a reason; preserve a live final administrator; revoke old invitations and obsolete cashier grants; and append immutable identity evidence. A unique index prevents combining multiple delegated branch roles. Historical admin+staff rows remain subject to the live inventory rather than being silently rewritten. Privileged accounts cannot expand their scope by accepting an ordinary staff invitation. New manager/finance roles are included in privacy deletion/MFA checks and push registration/inbox/eligibility checks; finance users do not receive branch-order pushes through operational staff assignment.

This is a conservative implementation pending Pogo’s approval. Delegating refunds, opening-balance approvals, spending limits, chain-wide finance access or supervisor overrides requires a separately reviewed authority decision. A manager grant does not automatically approve a cashier.

## Financial reporting

Profile → Cash reports and till reconciliation opens an account/role/branch-scoped screen. The administrator’s old “Revenue Today” total included unpaid orders and mixed currencies; it has been replaced with access to the currency-specific cash reports.

- Reports use server-defined **Africa/Harare calendar days**, inclusive at local midnight and exclusive at the next midnight. These are posted event timestamps, not a client-approved custom shift or GAAP trading-day calendar. Finance/operations must confirm their actual cutoff policy.
- All monetary aggregates and exported amounts are decimal minor-unit **strings**, parsed/formatted using `BigInt` rather than JavaScript floating point. USD and ZWG remain separate; no FX, tax, points value or revenue-recognition rule is invented.
- Daily values include gross recorded cash sales, refunds, net recorded collections, collector deposits acknowledged into till and net till movement (deposits minus refunds). They derive from immutable cash movements. Refunds do not erase a collector’s outstanding custody obligation.
- Current outstanding cash and pending handovers cover **all dates** and are labelled separately. Missing receipts are surfaced. Reward handovers/voids cover the selected day across currencies, and active point holds cover all dates. Counts/points are not assigned a monetary value.
- Administrators can inspect exact chain-wide spendable/held points, unreviewed-opening counts and projection differences. A branch-scoped finance role does not receive unrelated chain-wide customer balances.
- A prepared JSON report includes the complete selected cash-entry set, document references and a source fingerprint. Cursor, scope, count, final-source and account checks reject incomplete or changed collection. More than 5,000 entries or five million JSON characters requires a support-assisted export; totals are not truncated. Native temporary files use the existing export cleanup directory and are removed after sharing or account changes; browser object URLs are revoked. User-saved external copies remain under the recipient’s control.

These reports describe the app’s records. Physical cash, GAAP app-linked sale/refund/deposit records, fiscal references and programme rules still require real finance/operations acceptance. Whole-till totals contain other restaurant activity and must not be entered as the app-linked subset.

## Reconciliation workflow

1. A manager/finance user or administrator submits canonical non-negative observed sales/refund/deposit amounts for one branch, Harare day and currency, with an evidence reference. The original observation and app snapshot are immutable. A matching observation is `matched`; a difference is `variance`. Neither is independent acceptance.
2. A different assigned finance reviewer or administrator checks evidence and records a versioned decision/reason. Self-review is denied, including for administrators. A variance cannot be accepted as a match, and no review changes an order, receipt, cash movement, fiscal reference or loyalty balance.
3. Review recomputes the source fingerprint. Changed sources record `stale` instead of acceptance. Rejected/stale cases can be replaced with linked observations. New external evidence can also create a linked revision of an accepted case without rewriting the old statement. Current reports flag accepted snapshots whose source later changed. A per-period revision number, assigned under the period lock, determines the latest case even when transaction timestamps tie or transactions started in a different order.
4. Cash source inserts take a shared period lock; submit/review take the exclusive side before a fresh snapshot. This coordinates new postings with review and avoids reading a pre-wait snapshot. The full PostgreSQL lock/concurrency exercise remains mandatory; serial PGlite does not demonstrate it.
5. Commands persist locally before transmission, pin the original account token and replay the same server journal identity after response loss. Wrong scope/result/version/status is not treated as success. Definitive validation/version rollbacks clear a failed checkpoint; network/auth ambiguity remains for explicit recovery. Another branch/action cannot overwrite it. Normal logout preserves the checkpoint; confirmed completed deletion removes it after approved outstanding-work resolution.

There is one open case per branch/day/currency. Acceptance is a statement about recorded evidence at a point in time, not a permanent freeze of that trading day. Later cash deposits/refunds can make a previously accepted snapshot stale. An unexplained or rejected variance remains visible; business policy for resolving actual shortages and approving exceptions is still required from finance. The app does not force a zero variance by adjusting source money.

## Acceptance evidence

The combined suite has **292 passing tests**, including **15 new database cases and 12 new client cases**. Coverage includes scoped role grants and revocation, MFA across reports/privacy/push, blocked invitation expansion, operational versus finance access, large exact totals, currency isolation, Harare boundaries/connection timezone independence, two-person review, immutable observations/audit, variances, stale sources, linked accepted-period revisions, same-transaction revision ordering and reaffirmation after rejection, rejected mutations, complete export/recovery failure modes and a real cash refund with continuing collector custody.

TypeScript, lint, generated-type drift, SDK compatibility and installed peers pass. Android/iOS Hermes exports and temporary native project generation pass locally. The local engine uses simulated Supabase roles/JWT claims; signed JWT/PostgREST, true concurrent PostgreSQL, physical sharing/storage/lifecycle, signed builds, independent security review and actual tills remain separate gates. Existing platform advisory/native/CI and legal/ownership gates are not closed by these tests.

```sh
npm run check
npm run build:check
npm run native:preflight
```

The migrations are `20261102000002_finance_role_values.sql`, `20261102000003_finance_permissions.sql` and `20261102000004_finance_reconciliation.sql`. Generated types come from the full local migration catalogue. The privacy inventory now covers **67 public tables**; the **29th export section** contains the caller’s finance action metadata while internal branch financial statements and other operators’ notes require reviewer assessment. Fiscal/employee evidence retention and actual erasure remain unapproved; immutable audit is not permission for indefinite retention.

## Activation and work still requiring review

1. Approve the role/action matrix with Pogo’s sponsor, branch operations and finance. Supply verified staff identities, branch IDs and named submitters plus independent reviewers. Confirm whether broader chain-finance visibility or delegated refund/override limits are required. No such delegation was assumed or assigned.
2. Inventory live roles, grants, memberships, invitations, cashier rows and migration history, including legacy combinations. Rehearse migration on an isolated representative copy with balances/receipts/fiscal references preserved. Resolve ambiguous delegated-role combinations before adding the index. Preserve administrator recovery and coordinate old-client behavior. Apply enum, permission and reporting migrations in order before updating/assigning the new app roles.
3. Verify anonymous, customer A/B, staff, manager/finance branch A/B, administrator, AAL1/AAL2 and revoked/processing/deleted account behavior through actual Supabase APIs. Test simultaneous role changes, submissions, reviewers, postings and export pages in full PostgreSQL; include midnight, timezone, refunds, handovers and source changes during approval.
4. Approve accepted currencies, inclusive pricing/tax/rounding, till/fiscal ownership, actual GAAP sale/credit-note/deposit formats and the manual bridge or verified integration. Supply app-linked worked examples and opening balances. Reconcile a paid order, refund, cash handover and reward against the actual branch till. The new observation form is not GAAP integration or an opening-balance import.
5. Rehearse variance investigation, rejecting/correcting evidence, late-posting revisions, independent reviewer availability and shift handover. Define discrepancy owners, evidence standards, report/employee-data retention and the approved controlled correction procedure. Never edit immutable receipts/ledgers to make a report match.
6. Test intended Android/iOS hardware and supported browsers: account/role/branch switching, stale access, MFA/recovery, process kills during commands, offline/logout, unreadable recovery, large exports, sharing cancellation and cleanup. Do not drop an ambiguous financial checkpoint to unblock a device; a named authorised owner must investigate its server receipt.
7. Complete monitoring/load/recovery, signed-build/store/privacy, staff training and pilot gates. No branch, cloud environment, role, GAAP integration or OTA was activated here. Automatic development OTA after checks on main and manual development/staging triggers remain unchanged.

The next independent implementation area is offline/lifecycle and customer launch-UX hardening, alongside the outstanding client data, hosted acceptance and production hardening work. This milestone advances the permissions/reporting backlog without declaring the project production-ready.
