# Milestone 5 — local engineering and remaining release gates

Verified 3 November 2026. **The locally executable worker monitoring, collector/alert-state, recovery/load rehearsal and security-audit work below is complete. Milestone 5 remains open.** No real scheduler, recipient, provider, hosted migration, monitoring project or production approval was activated. The app’s own ordering system and loyalty ledger remain authoritative; GAAP automation still awaits its approved contract.

Follow-on: the [loyalty/notification integrity work package](loyalty-notification-integrity-sprint.md) is now locally complete, with 479 regression tests and eight PostgreSQL resilience/integrity cases. It adds the previously missing ledger and unmaterialised-pair observations plus a dedicated synthetic report. Counts and measurements below record the earlier checkpoint.

Latest follow-on: [supported security patches and scaled performance](security-performance-sprint.md) pass 484 regressions, 28 Deno cases, 13 PostgreSQL concurrency, eight recovery and four scaled-performance cases, with new native exports/preflight. Expo 58.0.23 removes the affected CLI Zod path; the final high/critical dependency gate passes with 17 moderate package findings remaining. A 2,000-customer workload reproduced an integrity timeout and verifies its forward SQL correction. The security result and small-load measurements below are historical; independent security, representative hosted/device/long-soak acceptance and production monitoring remain open.

## Worker observations and missed-run detection

`20261103040000_worker_observations.sql` adds three fixed service-only operational rows, one each for push, cash expiry and reward expiry. They contain only a technical run UUID, outcome and timestamps; no account link, recipient, provider payload or credential. Direct table access is revoked for customers and service-role clients; narrow recording/read RPCs provide the boundary. The privacy inventory is now **71 public tables**, with **29 account-export sections**. Review field/retention coverage before any approved erasure policy is activated.

After method/key/config/body validation, each internal Deno worker records `running` before doing work. An unacknowledged start prevents work. A successful batch records `success`; ambiguous push work records `unresolved`; an invocation error attempts a `failed` observation. An older completion cannot overwrite the latest run. Same-result completion retries do not move timestamps or repeat business work. Failure to acknowledge completion returns an actionable 503; it is not a receipt proving that the financial/provider operation rolled back.

`worker_health_snapshot()` exposes only outcomes and ages, without run IDs. The evaluator detects never-seen, missed, overdue, failed/unresolved and success-overdue workers. Malformed, stale, future and contradictory observations remain unknown. `config/worker-health.json` leaves freshness and all three rules null. Approve actual expected intervals, maximum run duration and success windows before configuring them. A worker success proves an application batch completed, not that a provider delivered a message or that a customer received food/cash.

## Collector and local alert state

`runMonitoringCycle` is a server-job entrypoint with injected client, private store and delivery adapter. It collects the existing eight queue gauges and worker observations with bounded requests. It has no environment/credential/recipient discovery and installs no timetable. Collection generations prevent a slower older cycle from overwriting a newer observation.

The local store uses private permissions, an exclusive lock, validated bounded JSON, exclusive temporary writes, file/directory syncing and atomic replacement. Corrupt state is preserved for review. Locks are never automatically broken; a crashed process can require owned manual recovery. This is a local rehearsal adapter, not an approved shared/cloud store.

Alerts deduplicate unchanged states, separate transport acceptance from human acknowledgement, and create explicit recovery only from a clear observation. Unknown observations remain active. State changes retain prior outbox evidence. Each dispatch sends at most four events with an eight-second default per-attempt deadline. A persisted abandoned send, timeout or uncertain transport remains unknown and is never blindly resent. Outbox capacity is 64 events; exhaustion stops processing rather than deleting evidence. Real retention/archive, safe manual replay, authenticated acknowledgement and timed escalation need the reviewed operational implementation.

```sh
npm run health:check
npm run health:demo
npm run monitoring:demo
```

The monitoring demo replays migrations into disposable PGlite and uses an exclusively created private temporary store. It proves missed workers with empty queues, durable deduplication, recovery after observed successful runs, collector failure and uncertain simulated delivery. It sends **no real messages**. Reports in `dist/monitoring-cycle/` carry source identity and explicit simulated-delivery/unapproved-threshold/hosted-acceptance flags. The existing queue-only dashboard remains a synthetic static artifact; it does not become a live dashboard because a collector module exists.

## PostgreSQL load and recovery rehearsal

```sh
npm run test:postgres:pull   # explicit image preparation, only if missing
npm run test:postgres
npm run test:resilience
```

The resilience mode reuses the runner’s strict local-only Docker/loopback configuration, unique ownership label, bounded temporary PostgreSQL storage and identity-scoped cleanup. It accepts no URL, existing database, test path or backup target. It never mounts user data. Backup files and the restored database exist only inside its own disposable container.

On PostgreSQL **17.11**, the rehearsal:

1. Completes 24 synthetic cash orders across three synthetic branches with four concurrent clients, checking exact cash movement and loyalty totals.
2. Verifies queue gauges, fenced worker outcomes and authenticated-role denial on real PostgreSQL.
3. Creates a consistent custom-format `pg_dump` backup, restores into a separately created empty database, and matches fingerprints for all **73 tables**: 71 public plus two synthetic Auth tables. It also checks restored access restrictions.
4. Detects a post-backup cash gap of **10,000 synthetic minor units**, a **100-point** gap and a missing privacy suppression. It keeps `safe_to_resume: false` rather than treating a successful restore as reconciliation.
5. Replays a synthetic privacy tombstone and verifies restored account access is fenced. This is owner-level test-fixture setup, not an actual deletion workflow, provider-erasure receipt or permission to mark a real request complete. The financial/GAAP recovery obligation remains explicitly unresolved.

The measured run recorded workflow p50 **195 ms**, p95 **507 ms**, maximum **528 ms**, and restore **1,758 ms**. These are synthetic local observations, not production throughput, long-duration soak evidence, approved RPO/RTO or customer response commitments. The report records `performanceAccepted: false`, `recoveryTargetsApproved: false`, simulated external GAAP evidence and completed container cleanup. Real managed backups/PITR, Auth/storage/functions/providers, representative volumes, real fiscal evidence and privacy restore-suppression procedures still need rehearsal.

The restored database shares global roles with its own disposable PostgreSQL cluster; global-role/managed-service recovery is not exercised. Local alert files and external provider records are outside this database backup and need their own approved recovery procedure.

## Earlier security review result — superseded by the supported patch

```sh
npm run security:audit
```

The new public-registry audit gate writes a bounded, redacted, source-identified report and returns failure for high/critical findings. Network failure or incomplete audit evidence is unknown and cannot produce release approval. A separate PR/manual workflow uploads the report; repository protection and actual hosted execution remain unverified. Existing automatic **development** OTA checks remain configured. The security gate must pass for a production candidate; this increment does not introduce a production publication workflow.

The fresh audit reports **0 critical, 2 high, 20 moderate and 1 low package findings**. Security acceptance is **blocked**. The high path is Expo CLI’s nested Zod **3.25.76**, while the CLI declares `^3.25.76`. The published advisory lists a patched version of **4.6.6**. [GitHub’s reviewed advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5)

An `npm audit fix --dry-run --ignore-scripts` plan still reported the same two high findings. No install, lockfile change, forced major override or advisory suppression was applied. A reported available fix is not proof a compatible installed chain is patched. Resolve this through a compatible toolchain update, then repeat SDK/native/build and security acceptance. Earlier bundle checks excluded the affected CLI path; no new native bundle was exported here. That prior scope evidence is not a security waiver or proof all moderate findings are harmless. Independent security review remains required.

## Earlier checkpoint verification and evidence

| Check | Result |
| --- | --- |
| `npm run check` | **453 passing tests**, zero failures/skips/cancellations; type/lint/types/SDK/peer/template and monitoring-policy gates pass |
| `npm run edge:check` | All seven functions and runtime suite type-check |
| `npm run test:edge` | **28 passing Deno cases**, with real loopback HTTP/SDK and simulated backend/provider responses |
| `npm run test:postgres` | **13 passing real PostgreSQL concurrency cases**, including full current migration replay |
| `npm run test:resilience` | **5 passing real PostgreSQL load/recovery cases**; cleanup complete |
| `health:demo` / `monitoring:demo` | Synthetic queue and collector/outbox rehearsals pass |
| `security:audit` | **Blocked**, expected nonzero exit; releaseReady false |

Ignored evidence directories are `dist/edge-runtime`, `dist/postgres-acceptance`, `dist/resilience-acceptance`, `dist/operational-health`, `dist/monitoring-cycle` and `dist/security-audit`. Later runs replace latest-run reports; archive the actual candidate’s reports. Reusable CI now runs the resilience and monitoring rehearsals and uploads reports. No hosted run was triggered. Unit/PGlite tests use simulated roles and core-SDK/fake-provider ports; real PostgreSQL does not replace signed-JWT/PostgREST, native device or real vendor acceptance.

## Remaining to close milestone 5

1. Review the remaining moderate dependency findings and obtain independent security review of the actual deployed surface. Repeat the passing high/critical gate for the candidate. Verify hosted CI, protected publication and failure behavior.
2. Confirm owned monitoring/storage/projects, regions/privacy/retention, responders/deputies, approved cadence/thresholds/performance/recovery targets and budgets. Connect the collector, durable production store, protected dashboard and chosen alert transport. Implement/rehearse authenticated acknowledgement, timed escalation and controlled archive/replay against that infrastructure; prove actual recipient receipt.
3. Deploy reviewed migrations before the instrumented functions. An old database without `record_worker_observation` makes the new workers fail closed before work. Configure only accepted server secrets/flags and job schedules; verify wrong-key/JWT/RLS, actual runtime, overlapping runs, missed schedules and recovery in the authorised environment. Observe new successful runs after a restore; do not use restored old heartbeat rows as evidence of live execution.
4. Deploy and measure the implemented internal-ledger and unmaterialised-pair observations; complete actual cash/GAAP reconciliation and add capacity/managed-backup freshness collectors. Install an independent external watchdog for a stopped collector or unavailable database. A collector cannot reliably announce its own total outage through that same unavailable service.
5. Complete representative hosted/native performance/load/soak/accessibility, actual alert/incident and managed backup/restore/cutover exercises. The scaled local workload and query correction are complete; real volumes/targets and a long soak still need acceptance. Reconcile real app-linked GAAP/cash/loyalty records and apply approved privacy restore suppression before reopening service. Local synthetic timings and tombstone fixtures cannot approve these decisions.

See the [readiness checkpoint](production-readiness-status.md) and [operator runbook](operations-monitoring-runbook.md). Six overall delivery groups remain; this work does not close earlier client/privacy/GAAP/device gates.
