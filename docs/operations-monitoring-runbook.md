# Monitoring and incident response

Prepared 3 November 2026 for the cash-first release at Msasa, Kamfinsa and Westgate. **Draft operational procedure; owners, service targets, provider configuration and real incident/restore rehearsals remain unconfirmed.** The local [error-reporting sprint](monitoring-safety-sprint.md) does not install a monitoring service, scheduler or alert route.

## Owners and release evidence

Before the pilot, record a named primary and deputy for technical incidents, each branch shift, finance/reconciliation, privacy/security and release approval. Record their attended coverage, tested escalation channels and who may pause/resume intake. The temporary privacy mailbox `pgonese6@gmail.com` is not a confirmed technical on-call route. Do not rely on customer push or the app itself as the sole incident channel.

Pogo’s must approve response/escalation targets, peak demand, alert thresholds, service budgets and recovery objectives. Proposed values in the production plan are not accepted operating commitments. Return client references **O08, A07, P05/P07, T07 and R03/R04/R07** with owners and evidence. Protect incident records and their retention/access under the reviewed policy.

## Error-reporting activation

The current app sends no Sentry reports: `config/error-reporting.json` has three explicit null bindings. Supplying only a DSN does not enable reporting.

1. Confirm Sentry organisation/project owners, access/MFA/recovery, region, contract, permitted data, retention, erasure/export and support procedure. Review historical Sentry/native records separately; new redaction cannot erase past submissions.
2. Choose a separate SaaS project ID per environment. Replace only that environment's null binding with public destination identifiers, for example:

   ```json
   { "origin": "https://o123.ingest.sentry.io", "projectId": "456" }
   ```

   This example is synthetic. Use the actual approved HTTPS ingestion origin without a trailing slash. Never put an auth/upload token or a customer identifier in the binding. A self-hosted destination/tunnel requires a separate reviewed transport change.
3. Run `npm run monitoring:check`. The check validates structure and project isolation; it does not contact Sentry or establish ownership/approval. It is included in `npm run check` and the reusable CI gate. Configure that environment's public DSN and exact `EXPO_PUBLIC_ERROR_REPORTING_ENABLED=true` only for the controlled acceptance build/update. Keep Sentry administration/source-upload credentials server-side. The OTA workflow defaults the flag to false.
4. On each intended native platform, exercise a synthetic JS exception with deliberately synthetic contact/address/token fields, source paths and an attachment. Inspect the actual outgoing envelope and provider record against the [payload allowlist](monitoring-safety-sprint.md). Verify environment/release/OTA distribution, grouping and source-map usability. Test disabled and mismatched destinations with network inspection. The local core-SDK test does not prove native SDK startup or real ingestion.
5. Configure release/error alerts, tested recipients/deputies, provider failure/budget alerts, access and retention. Trigger a synthetic alert and prove receipt, acknowledgement, escalation and resolution through the actual channel. A locally passing sanitizer or a Sentry issue is not proof an operator was alerted.
6. Rehearse account switch/logout with in-flight reports, provider unavailability and opt-out in the next build/update. Turning off the flag prevents new app reporting after that version is installed; it cannot recall in-flight events, delete provider history or change an old installed client. Use provider controls and the reviewed incident process for urgent containment.

The initial reporting scope is **JavaScript errors only**. Native SDK/crash capture, native caches, screenshots, hierarchy, breadcrumbs, logs, sessions, replay, tracing and profiling are disabled. Free-form messages and event attachments are removed. This reduces diagnosis detail; native crash monitoring and symbolication must pass their own review before release acceptance. Do not assume the project now has crash-free-session metrics or performance monitoring.

Even a minimized event has technical identifiers/timing. The provider receives a network connection and public project routing information; `sendDefaultPii=false` and `infer_ip=never` do not mean the provider never handles transport metadata. Client/privacy review still applies.

## Operational signals still to configure

These are required monitoring responsibilities, not implemented alerts. Choose thresholds and observation intervals from approved shift volume, measured capacity and response coverage. Treat a missing/stale observation or failed collector as **unknown**, never healthy. Keep payloads to environment, approved branch reference where needed, fixed signal code, counts/age and a restricted incident link. Retrieve customer/order/fiscal evidence only through authorised operational tools.

| Signal | Evidence source and failure to exercise | Response/acceptance owner |
| --- | --- | --- |
| Order intake and branch attention | Actual pending/overdue queue, oldest unaccepted work and device foreground/reconnect state; test missed sound, app background, network/power loss and unattended device | Branch operator and deputy; technical owner for service failure |
| Expiry jobs | Protected scheduler invocation, failed/disabled HTTP responses, execution age, oldest eligible unpaid order/untouched reward and processed backlog; test overlapping runs and lost responses | Technical owner; branch/finance confirm released obligations |
| Transactional push | Scheduler failures, pending/leased age, unknown sends, missing receipts, provider tickets/receipts and invalid token cleanup; simulate unknown outcomes without blind resend | Technical owner; branch service must continue when push fails |
| Cash and till | Currency-separated app-linked sales/refunds/deposits, custody, missing receipts and stale/variance observations versus actual GAAP documents/till subset | Branch cashier/collector plus independent finance reviewer |
| Loyalty | Ledger/projection mismatch, held/reserved points, opening review, failed/replayed commands and refund reversals | Finance/programme owner plus technical owner |
| Identity and privacy | Real revocation/MFA/recovery failures, wrong branch/account access, export/deletion failures and overdue approved processing tasks | Security/privacy owner; technical owner |
| Runtime and capacity | Hosted API/function/database error rates/latency, connections, saturation, collector freshness and resource limits; representative load/soak | Technical owner with approved performance targets |
| Recovery and budgets | Backup completion, retention, last verified restore, RPO/RTO evidence, database/mail/maps/push/monitoring spend and quota | Technical/finance owners; sponsor approves budget and recovery objectives |

Use existing branch attention/inbox and finance screens as operational evidence, with their freshness and scope limits. The [queue-health foundation](backend-health-sprint.md) now supplies a service-only aggregate snapshot, strict evaluator and synthetic dashboard for eight queue/custody/variance gauges. It supplies no deployed collector, heartbeat, production dashboard, approved thresholds, scheduler, paging integration, budget or escalation roster. Ledger/capacity/backup monitoring and actual alert delivery are explicitly outside that snapshot’s coverage.

## Queue-health collection acceptance

1. Inventory the authorised environment and rehearse `20261103030000_operational_health.sql` on a representative isolated copy. Review four supporting index builds and actual query cost/timeout behavior; the 1,000-count cap does not bound every possible scan/sort. Verify service-only execution and customer/staff/admin denial through actual signed JWT/PostgREST calls.
2. Keep the committed `config/operational-health.json` rules/freshness null until approved values are available. Run `npm run health:check`; configure ordered count and/or age pairs only against measured demand and response coverage. Each gauge’s age has a specific origin in the sprint report. Unknown observations must never be coerced to zero/clear.
3. Run the fixed `collectOperationalHealth` adapter from an approved server job with the correct environment, stored service credential, HTTPS/redirect controls and verified database/API/client timeouts. Keep raw errors and credentials out of incident/alert payloads. The existing offline demo cannot connect to a remote target.
4. Implement and verify collector/worker heartbeats, external missed-run detection, publication of current samples, alert deduplication, destinations/deputies and acknowledgement/escalation. Keep snapshot observation time distinct from collector run time, last actual worker success and actual provider delivery. Test a stopped scheduler with empty queues as well as a growing backlog.
5. Prove queue gauges, clipped counts and unknown outcomes against actual records without dispatching or altering financial work merely to clear an alert. Add separate governed ledger, capacity and backup checks; rehearse the incident paths below. A demo dashboard and service RPC alone do not close monitoring acceptance.

## Incident procedure

1. **Record and assign.** Open a restricted incident with a generated reference, UTC times (and Harare local display), environment, affected branches, fixed symptom code, current build/update, observed impact and named incident lead. Keep addresses, phones, tokens, claim secrets, raw SQL/provider payloads and customer lists out of broad notifications. Preserve original financial command/recovery references in authorised records.
2. **Contain new exposure/work.** For unsafe intake, an authorised assigned operator uses branch intake controls; reward intake has separate controls. Pausing intake does not cancel received orders, stop existing cash custody, settle a reward hold or fix a balance. Continue accepted-order, handover and refund handling under the approved procedure. Privileged access/privacy failures require security-led revocation and preservation of evidence. Disable affected worker/provider dispatch through reviewed server controls when appropriate; verify actual state.
3. **Establish truth before retrying.** Check authoritative order/reservation/command status and existing receipt/ledger evidence. Reuse the durable command ID for recovery; do not clear checkpoints or generate a new financial command to guess whether a timed-out operation committed. A push ticket or generic successful HTTP response does not prove a customer saw an update or that cash/food changed hands.
4. **Reconcile cash, loyalty and GAAP independently.** Finance compares the app-linked GAAP sales, credit notes and till movements per branch/day/currency with app receipts/custody/ledger. Never mix currencies or whole-till unrelated activity. Record a variance through the immutable observation/review process; an independent reviewer must assess it. Do not edit balances, delete receipts or invent a GAAP reference to clear an alert. Preserve unresolved cases and use the approved correction/refund path.
5. **Recover deliberately.** A reviewer approves the fix and candidate, checks old-client/OTA/native-runtime compatibility and tests affected retries and invariants on an isolated representative environment. For database recovery, confirm the owned backup and target, perform an isolated restore and reconcile external cash/GAAP and messages across the recovery window. Reapply privacy suppression/retention decisions; restored contact data must not silently reactivate processing. The existing local concurrency runner is not a backup/restore drill.
6. **Verify and resume.** Confirm real gateway/role isolation, worker backlog and schedules, device operation, financial reconciliation and the incident’s customer/service obligations. The authorised operations/finance/security owners approve resumption where relevant. Resume branches individually and observe the actual shift; a green test suite alone cannot resume trading.
7. **Close and review.** Record impact, timeline, root cause, changes, reconciliation/recovery evidence, operator receipt/acknowledgement and remaining actions with owners. Apply approved incident retention and customer/privacy communication procedures. Record actual measured recovery against approved targets; do not backfill unobserved evidence.

## Rehearsal and outstanding release gates

Use approved synthetic accounts and a reviewed environment. Demonstrate missed new-order attention, a failed expiry scheduler, push ambiguity, a cash/till variance, wrong-branch access and an isolated restore. For each scenario retain detection time, actual alert delivery/acknowledgement, named responder/deputy, containment, authoritative command recovery, reconciled totals and authorised resumption. Measure response and recovery against approved targets. These exercises remain outstanding.

Milestone 5 also needs independent security/dependency review, actual performance/accessibility/load/soak acceptance, hosted CI/publication protection and a representative backup/restore/cutover rehearsal. This document and local JS reporting hardening complete only the bounded foundation described in the sprint report.
