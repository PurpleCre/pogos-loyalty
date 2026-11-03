# Backend queue-health monitoring foundation

3 November 2026. **Implemented and verified locally as a further slice of milestone 5. Milestone 5 remains in progress; six delivery groups remain.** No client approval, production target, threshold, scheduler or actual alert is assumed.

## Delivered

`20261103030000_operational_health.sql` adds the service-only `operational_health_snapshot()` RPC. It uses a stable, read-only SQL query with an empty search path, explicit grants and four supporting partial indexes. Anonymous users and all authenticated customer/staff/manager/finance/admin identities cannot execute it; a customer claim naming the service role cannot override database grants.

The snapshot reports eight aggregate gauges across the database:

| Signal | Records observed | Oldest age measured from |
| --- | --- | --- |
| `cash_expiry_due` | Unpaid pending cash orders whose acceptance deadline has passed | Acceptance deadline |
| `reward_expiry_due` | Expired reservations still `reserved`; handovers are excluded | Reservation expiry |
| `push_send_due` | Due `queued` / `retry` delivery rows | Next available time |
| `push_receipt_due` | Due `ticket` receipt checks | Next available time |
| `push_lease_overdue` | Expired `sending` / `checking` leases | Lease deadline |
| `push_unknown` | Delivery rows requiring unknown-outcome review | Last row update |
| `cash_custody_open` | Receipts without a settled timestamp | Receipt creation |
| `finance_variance_open` | Reconciliation observations still marked `variance` | Observation creation |

Each gauge reports a count, clipping flag and oldest age in whole seconds (null when empty). Counts cap at **1,000**, sampling the oldest 1,001 qualifying rows to detect clipping. `1000+` is a lower bound, not an exact count. The timestamp is a single UTC statement observation. No customer/account/branch/order/device IDs, contacts, coordinates, claim secrets, token/provider payloads, money, currency or fiscal references are returned. These are sensitive business aggregates and remain server-only.

Collection does not expire orders/rewards, materialise or dispatch notifications, acknowledge cash, adjust points, alter finance observations or install a job. The app’s ordering and loyalty ledger remain authoritative; no GAAP automation or second loyalty balance is introduced.

## Evaluator and server adapter

`scripts/operational-health.mjs` validates the exact snapshot/policy schema and evaluates configured count and/or age thresholds. It also provides a fixed read-only SDK RPC adapter, with cancellation, an eight-second default client deadline, disabled implicit SDK retries and generic error outcomes. It takes an existing server-owned client; it loads no `.env` and constructs no connection from user input. A future caller must configure the approved HTTPS destination, server credential storage, redirect protection and actual PostgREST/database timeout.

Missing, malformed, future, stale, failed and timed-out observations evaluate to **unknown**. Missing rules/freshness configuration also remain unknown. Proven warning/critical observations take precedence over an unknown rule; a clipped count cannot become clear merely because a configured age threshold has not fired. “Clear” means only the observed queues were below those configured thresholds at that observation, within the allowed freshness window.

`config/operational-health.json` is an explicit unconfigured draft. Freshness and all eight rules are null. `npm run health:check` validates structure without treating it as approval or activation. Configured count thresholds must be ordered integers from 1–1,000; age thresholds must be ordered positive integers no more than one year; freshness is bounded to one day. These are technical input bounds, not proposed service commitments. At least one count/age pair is required per configured rule. Real values must come from measured demand, operating response and approval.

Queue state does **not** prove scheduler execution, successful worker runs, alert delivery or actual service availability. Missing coverage is explicit: worker heartbeats, notification events not yet materialised into deliveries, loyalty-ledger reconciliation, runtime capacity, backup freshness and actual alert delivery. Cash/finance gauges count records; they do not reconcile money or prove a physical handover/GAAP document. A future-dated oldest record in a non-due gauge retains its negative age; the evaluator rejects that snapshot as unknown rather than manufacturing a clear zero-age observation. Investigate source-clock/data issues through restricted tools.

## Local dashboard and CI

```sh
npm run health:check
npm run health:demo
npm run check
```

`health:demo` creates its own disposable, in-memory PGlite database, replays the complete local migration chain and reads through the service-role grant. Synthetic fixtures demonstrate:

1. Empty queues: clear under explicitly synthetic test thresholds.
2. Two overdue cash orders and an unknown push outcome: critical.
3. A stale observation: unknown.
4. A failed collector: unknown.

The script writes a standalone, unpublished dashboard to `dist/operational-health/index.html` and JSON evidence to `report.json`. They are prominently marked synthetic; demo thresholds are confined to test fixtures and do not populate the committed policy. No target/connection arguments are accepted, inherited project credentials are not read and no provider or hosted database is contacted. The report records source identity with `hostedAcceptance: false` and `thresholdApproval: false`. It does not contain raw fixture records.

The dashboard uses local styles with no scripts, fonts or external assets. HTML values are escaped and a restrictive content-security policy blocks external content. It is a static rehearsal artifact, not a connected production dashboard.

The ordinary check now includes health-policy validation; the reusable CI workflow also runs the synthetic rehearsal and uploads its reports for seven days. The existing OTA workflow depends on these checks. No hosted workflow was triggered, publication protection changed or OTA published.

## Verification

The full suite passes **432 tests**, including **25 new health cases**: eleven SQL/access/invariant cases and fourteen evaluator/SDK/HTML/CLI cases. TypeScript, lint, generated database types, SDK/peers, client template and both monitoring-policy checks pass.

SQL coverage verifies anon/customer/staff/manager/finance/admin denial, service access, stable definer/search-path metadata, UTC/zero gauges, matching expiry eligibility, distinct push stages/leases, custody/variance filtering, aggregate privacy, clipping/oldest ordering, unchanged financial/queue records and execution inside a read-only transaction. Evaluator coverage includes boundary thresholds, partial configuration, stale/future/bad clocks, malformed input, clipping, unknown outcomes and redacted failures. The installed Supabase JS SDK is exercised with synthetic fetch responses, including a failed RPC that makes one attempt and a cancelled hung collector.

PGlite uses simulated Supabase roles/claims; it does not prove real signed JWT/PostgREST grants or production query cost. The earlier 13 real PostgreSQL and 22 Deno cases remain separate checkpoint evidence and were not rerun here. No app runtime module changed, no dependency or public table was added, and no native export/build was performed for this backend-only increment. The privacy inventory remains 70 public tables and exports remain 29 sections.

## Remaining milestone 5 work

1. Review and apply the forward migration to an owned development/staging environment after schema/history and index-build/upgrade rehearsal. Measure plans, runtime/locks and load against representative volumes. A 1,001-row sample bounds the result/aggregate input, not every possible index scan, sort or server execution time. Client cancellation is not proof a server query immediately stopped.
2. Implement and rehearse a scheduled collector, durable worker/run heartbeats, external failure detection, actual dashboards/alert destinations, deduplication/escalation and alert-delivery/acknowledgement evidence. A queue with no rows cannot reveal a dead scheduler or unmaterialised outbox backlog. The new RPC and adapter supply observations but do not install this infrastructure.
3. Confirm owners/deputies, coverage, approved thresholds, privacy/vendor handling, retention and budgets. Keep service keys/observations outside mobile clients and public monitoring endpoints. Record actual environment and source/build identity with each collection through the reviewed service.
4. Add separately governed ledger/financial reconciliation and capacity/backup collectors; complete real GAAP/till reconciliation and device/incident acceptance. No generic “healthy” assertion may hide missing observations.
5. Complete independent security/dependency review, realistic performance/load/soak/accessibility and hosted CI/protection verification, plus a representative isolated restore/cutover rehearsal with cash/loyalty/GAAP and privacy restore-suppression checks.

See the [incident runbook](operations-monitoring-runbook.md) and [readiness checkpoint](production-readiness-status.md). No real data, role, branch, provider, secret, alert, scheduler, GAAP integration, privacy deletion or cloud deployment was activated.
