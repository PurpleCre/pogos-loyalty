# Loyalty and notification integrity monitoring

Verified locally: **3 November 2026**. The ledger-integrity and notification-materialisation work package is implemented and tested. **Milestone 5 remains in progress.** No hosted migration, real alert, schedule, provider send, financial repair or GAAP integration was activated. The app’s own loyalty ledger remains authoritative.

Follow-on: [security remediation and scaled performance](security-performance-sprint.md) measures this observer at 2,000 synthetic customers and corrects nested per-pair query cost in `20261103060000_integrity_query_cost.sql`. It adds eligibility parity cases, passes 484 regressions and four scaled PostgreSQL cases, and supersedes the earlier blocked dependency result. The counts and function/index description below record this package's original checkpoint; production activation/representative measurement remain open.

## Aggregate observations

`20261103050000_integrity_monitoring.sql` adds a stable, read-only, service-only `operational_integrity_snapshot()` RPC and two supporting indexes. It is separate from the existing eight fast queue gauges because checking ledger integrity can require a full ledger scan. The schema remains **71 public tables**, and account exports remain **29 sections**.

| Signal | Observation | Limits |
| --- | --- | --- |
| `loyalty_mismatches` | Number of accounts with an internal projection/opening/gross/held-point mismatch | Count capped at 1,000 with explicit clipping; no mismatch-age claim |
| `push_materialisation_due` | Currently eligible notification/device pairs without any delivery row | Count capped at 1,000 with clipping; oldest eligible event age in seconds |

Both observations use one consistent database statement snapshot. Output contains observation time, scope, coverage, push-enabled state, counts/clipping and the backlog age. It contains no customer/account/order/device/branch identifiers, contact data, balances, currency, provider tokens, claim codes or fiscal references. Anonymous and authenticated customer/staff/manager/finance/admin execution is denied; a forged role claim does not grant execution.

## Ledger checks

The account population includes account projections, display projections, ledger entries and active reward holds. Missing projection rows and hold-only subjects cannot disappear from the check. Each affected account is counted once even if several checks fail.

The query verifies:

- Exactly one opening entry and equality between its points and the account opening balance.
- Ledger point sums against the account balance and displayed spendable balance.
- Ledger reserved-point sums against account/display holds and active `reserved` / `claiming` reservation costs.
- Opening earned points plus gross earn entries against account/display earned totals.
- Opening redeemed points plus ledger redemption entries against account/display redeemed totals.

PostgreSQL performs exact arithmetic; raw point totals are never converted to JavaScript numbers or returned. Negative balances resulting from supported refund/debt behavior are not treated as discrepancies merely for being negative. Real earning/refund/reward rules and opening-source truth remain separate finance acceptance conditions.

A configured ledger rule must make the first mismatch critical: count thresholds are both 1 and age thresholds are null. Operators cannot configure a tolerance for inconsistent projections or invent when a mismatch began. Collection never updates balances, ledger entries, holds or approval state; investigation and governed correction remain separate actions.

## Notification eligibility

The backlog counts **event/device pairs**, not distinct notifications or proven missed customer messages. One event with two eligible devices can contribute two pairs. It checks enabled project settings, matching device project, active non-null token, device/event expiry, device binding time, service enablement time, current recipient/ownership/branch eligibility, deletion state and current MFA evidence for privileged recipients.

Any existing delivery row excludes that pair, including failed/cancelled/unknown rows, because the worker also preserves that pair’s unique identity. Existing delivery failures are monitored by the queue gauges and worker outcomes. The query mirrors materialisation and its final eligibility fence but does not acquire pair locks, create deliveries, claim jobs, dispatch messages or change their state.

A disabled push service is explicit in the response. When its backlog rule is configured, the evaluator returns **unknown / push_disabled**, rather than calling a disabled dispatch path clear. A zero missing-pair count does not prove provider/device delivery or that a worker is running. Those remain separate observations.

## Policy, collector and alert integration

`config/integrity-health.json` leaves freshness and both rules null. `npm run health:check` validates it alongside queue and worker policies. Backlog count/age thresholds require approved operational values; the ledger rule has the fixed zero-tolerance semantics above. No threshold or project approval is implied by the test fixtures.

`scripts/integrity-health.mjs` supplies strict snapshot/policy validation, evaluation and a fixed SDK read-only RPC adapter. Its request has an eight-second default client deadline, cancellation and no implicit retry. Missing, malformed, stale, future, failed, disabled and clipped-without-a-proven-threshold observations cannot become false clear results. Raw backend errors are not logged or forwarded.

The combined collector now observes queue, worker and integrity domains. It maps the new signals to `integrity.loyalty_mismatches`, `integrity.push_materialisation_due` and `collector.integrity`, keeping 16 fixed local signal codes overall. The private outbox preserves earlier events and deduplicates stable states. Existing state files can retain their prior signals; no state reset is required. Older software cannot safely read newly introduced signal codes, so review downgrade/archive handling before production.

The cycle rechecks all sample freshness under the state lock immediately before committing observations. A slow integrity RPC or store delay cannot let an earlier fast sample clear an incident after its freshness window has expired. A superseded collector still cannot overwrite a newer cycle. Alert transport acceptance remains separate from human acknowledgement and actual delivery.

## Rehearsal and evidence

```sh
npm run health:check
npm run monitoring:demo
npm run check
npm run test:postgres
npm run test:resilience
```

The expanded monitoring rehearsal uses disposable PGlite and synthetic private state only. It demonstrates a mismatched projection plus an eligible missing delivery pair, deduplication, recovery after rolling back the synthetic corruption and materialising the pair through the real SQL worker, and unknown outcomes when collection fails. The fixture rollback is not a repair API or authority to modify real balances. No Expo request is made.

An unpublished standalone report is written to **`dist/integrity-health/index.html`**. The source-identified JSON evidence in `dist/monitoring-cycle/report.json` includes `integrityIncident` and `integrityRecovered`, with simulated-delivery and unapproved-threshold flags. The HTML has four labelled scenarios, escaped values, no scripts/external assets and a restrictive content-security policy. Ledger age is shown as unavailable. Existing reusable CI runs the rehearsal and uploads the new artifact for seven days; no hosted workflow was triggered.

Validation:

| Check | Result and scope |
| --- | --- |
| `npm run check` | **479 tests pass**, zero failures/skips/cancellations; type/lint/types/SDK/peers/template and monitoring-policy gates pass |
| New local cases | **26**: 15 SQL/access/privacy/invariant/backlog cases, nine policy/evaluator/SDK/report cases, two combined-collector cases |
| `npm run test:postgres` | **13** real PostgreSQL concurrency cases pass with the complete new migration chain |
| `npm run test:resilience` | **8** real PostgreSQL load/recovery/integrity cases pass; temporary container cleanup completes |
| Monitoring rehearsal | Pass: both integrity signals open, deduplicate and recover; collection failures remain unknown |

SQL cases cover correct large integer projections, active holds, missing account/display/opening rows, orphan holds, gross differences, one-count-per-account behavior, 1,000-count clipping, oldest backlog ordering, multiple devices, existing pair states, project/token/binding/expiry/ownership/deletion/MFA exclusions, aggregate privacy and read-only execution without advisory locks. Real PostgreSQL additionally proves snapshot consistency before and after a competing cash earning commits, service permissions and actual SQL materialisation without dispatch.

The synthetic PostgreSQL workload remains 24 cash workflows across three branches/four clients; the additional integrity cases create separate functional fixtures. The restore still compares 73 public/synthetic-Auth tables and detects unresolved post-backup cash, points and privacy obligations. It does not approve production performance or recovery targets. Deno handlers and mobile runtime code did not change; the preceding 28 Deno cases remain separate checkpoint evidence and were not rerun in this package. No dependencies changed. The previously recorded dependency security gate remains blocked; this work does not remediate or waive its findings.

## Production acceptance still required

1. Review target ownership, actual schema/history, the forward migration and index-build/upgrade impact. Deploy the migration before the updated collector, then prove real signed-JWT/PostgREST denial and server access in the authorised environment.
2. Measure whole-ledger and candidate-pair query plans, sort/index cost, runtime and cancellation against representative volumes. Capping returned counts does not cap all scans or server execution time. Configure verified database/API timeouts and approved collection cadence; the separate endpoint allows a different cadence from fast queue gauges.
3. Approve freshness/backlog thresholds, responders, privacy/access/retention and production storage/transport. Connect the collector, protected dashboard and actual alerts. Rehearse acknowledgement, escalation, replay/archive and external watchdogs; no live recipient or schedule is supplied here.
4. Reconcile actual cash/GAAP and opening sources independently. These checks prove internal projections and eligible missing pairs only. Managed-backup freshness, capacity, external collector outage detection, independent security review, realistic load/soak/accessibility and real incident/restore acceptance remain open.

See [milestone 5’s broader local engineering report](milestone-5-local-engineering.md) and the [readiness checkpoint](production-readiness-status.md). Six overall delivery groups remain.
