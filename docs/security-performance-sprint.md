# Security remediation and scaled performance

Verified locally on **3 November 2026**. This work resolves the previously recorded high-severity dependency path and adds a larger, reproducible PostgreSQL performance workload. It also fixes a query-cost problem that the workload reproduced. **Milestone 5 remains open**, with six overall delivery groups remaining. No hosted migration, schedule, provider send, signed build or OTA publication was performed.

## Supported dependency remediation

Expo **58.0.23** and its CLI **58.1.19** replace Expo 58.0.21 / CLI 58.1.17. The [official Expo patch release](https://github.com/expo/expo/releases/tag/expo@58.0.23) lists the CLI and related dependency updates. The manifest and lockfile also align seven direct packages with the new SDK's bundled compatibility map: development client, linking, notifications, router, sharing, updates and safe-area context.

The old CLI required Zod `^3.25.76`; the new CLI has no direct Zod dependency. The resolved lockfile contains one Zod copy, **4.6.7**, rather than replacing Zod 3 with an unsupported major override. The [reviewed Zod advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) lists 4.6.6 as patched. No advisory suppression, forced resolution or relaxation of the high/critical audit gate was introduced.

The final registry audit at **2026-11-03 20:21 UTC** passes the existing high/critical gate: **0 critical, 0 high, 17 moderate, 0 low** package findings, versus the preceding 2 high / 20 moderate / 1 low checkpoint. These are affected package entries, not counts of independent vulnerabilities. Intermediate network timeouts produced unknown/failed gate results; the final complete response matches the current manifest/lockfile source identity.

The registry gate must be rerun for the exact release candidate. Its `releaseReady` field refers only to that dependency gate's high/critical policy; it does not approve the application or waive moderate findings and independent security review. Review the source-identified report under `dist/security-audit/`.

These dependency changes affect the native runtime fingerprint. Generate matching native binaries and complete signed-build/device acceptance before distributing this runtime. An OTA cannot upgrade an older native installation to these dependencies. Existing development/main and manual development/staging OTA triggers remain configured; nothing was published here.

## Scaled, isolated workload

```sh
npm run test:postgres:pull  # only when the fixed local image is absent
npm run test:performance
```

The new fixed `--performance` runner accepts no URL, database, test path, caller-selected volume, duration or concurrency. It replays the complete migration chain into a new owned PostgreSQL container, binds only to loopback, uses a random local credential and refuses remote Docker endpoints. The container has one CPU, 384 MiB memory and a 256 MiB temporary database filesystem. It mounts no user data, makes no implicit image pull and removes only its own identity-checked container. The performance child has a five-minute deadline, followed by bounded termination; individual SQL statements retain the existing ten-second timeout.

The fixture scales through 100, 500 and **2,000 synthetic customer accounts**. At the largest tier there are **2,018 total accounts, 20,018 ledger rows, 8,000 notification events and 4,000 devices**. Half the events are expired history; the remaining events represent **8,000 eligible event/device pairs**, reported as a clipped 1,000-count observation. Fixtures insert through normal constraints and triggers. Synthetic earning/order rows used to build volume are owner-level setup, separate from the real cash RPC workflows that follow.

Each tier measures seven service-role RPC reads and a read-only `EXPLAIN (ANALYZE, BUFFERS, TIMING OFF, FORMAT JSON)` of the current function body. The latter runs as the disposable owner and is labelled accordingly; it is not an assertion about an identical hosted/service query plan. Evidence retains only fixed aggregate plan fields: timing, root buffer counts, node-type counts, approved relation scan-output counts and disk-sort counts. SQL, expressions, parameters, account IDs, contacts, device tokens and raw errors are excluded. Scan-output counts derive from per-loop output averages; they are not exact rows visited. Root buffer counts are inclusive and are not summed again across children. See [PostgreSQL's EXPLAIN guidance](https://www.postgresql.org/docs/17/using-explain.html).

An eight-client burst then completes **96 actual cash RPC workflows** across three synthetic branches. A thirty-second workload combines six paced cash clients with two full-integrity observers. Missed cadence slots are skipped, preventing a catch-up burst; results report achieved samples rather than assuming the offered rate was sustained. Exact receipt/movement/point totals, zero ledger mismatches and zero provider dispatches are checked. A separate case verifies that a one-millisecond server deadline cancels the expensive read and that the session recovers after rollback.

## Query-cost correction and measurements

The initial workload failed: concurrent integrity observers reached the unchanged ten-second SQL deadline. Its largest-tier median RPC read was **3,250.97 ms**. The failed diagnostic report is retained locally as `dist/performance-acceptance/baseline-report.json`; its source identity predates the correction.

`20261103060000_integrity_query_cost.sql` replaces nested per-pair recipient helper calls in the observer with equivalent relational account/deletion/order/reward predicates. Branch assignment still uses its authoritative helper. The read-only statement snapshot, ledger checks, expiry/project/binding/MFA fences, missing-pair semantics, output schema and service-only grants are preserved. No repair, materialisation, lease, dispatch, table or index is added. Eligibility changes must keep this observer and the authoritative helper aligned; new parity cases cover branch roles/memberships, reward ownership, deletion states and account availability, alongside the existing order/device/access cases.

The corrected workload passes all **four PostgreSQL performance cases** with cleanup complete:

| Measurement | Local observation |
| --- | --- |
| 100-customer RPC read | p50 12.40 ms; largest of seven 22.23 ms |
| 500-customer RPC read | p50 28.01 ms; largest of seven 71.47 ms |
| 2,000-customer RPC read | p50 **99.23 ms**; largest of seven **122.22 ms** |
| Eight-client burst | 96 workflows; p95 **1,626.71 ms**; 12.62 completed orders/second over the burst |
| Thirty-second mixed workload | **174 workflows and 58 integrity reads** |
| Mixed workflow latency | p95 **720.57 ms** |
| Mixed integrity-read latency | p95 **1,308.18 ms**; maximum 1,823.69 ms |

These are diagnostic local measurements, not approved performance targets. The before/after runs share the fixed profile and resource caps but are separate executions, with host/cache variability. Seven baseline samples do not establish a tail-latency service objective. The database is synthetic, analysed and mostly warm; active holds/rewards, finance/report exports, skewed recipients, much longer histories, Auth/PostgREST/network costs, real devices, cold storage and a long soak remain separate workloads. Returned-count clipping still does not bound all ledger scans or server work. Collection cadence and server/API/client timeouts require hosted measurement and operational approval.

## Verification and release gates

| Check | Result |
| --- | --- |
| `npm run check` | **484 tests**, zero failures/skips/cancellations; type/lint/types/SDK/peer/intake-template/reporting/health-policy checks pass |
| Integrity and evidence cases | Two additional eligibility-parity cases and three aggregate-evidence cases; existing access/ledger/device tests pass |
| `npm run edge:check` / `test:edge` | Strict checks pass; **28 runtime cases** pass using loopback fake backend/provider responses |
| `npm run test:postgres` | **13 concurrency cases** pass against the full updated migration chain |
| `npm run test:resilience` | **8 recovery/integrity cases** pass, including the 73-table restore; cleanup complete |
| `npm run test:performance` | **4 scaled workload/cancellation cases** pass; cleanup complete; targets/production acceptance remain false |
| `npm run native:preflight` | Android/iOS projects generate in a temporary copy without installing native dependencies |
| `npm run build:check` | Android/iOS Hermes bundles and maps export; audited tooling dependencies remain absent from both module graphs |
| `npm run security:audit` | High/critical gate passes; **17 moderate** package findings remain for review |

Native exports retain the earlier Sentry optional `expo-router/build/global-state/router-store` resolution warning. The installed Sentry helper catches the missing private module and returns null; both exports complete. App code adds no private import. Tracing remains disabled, reporting remains unconfigured, and actual provider/native startup still requires acceptance. This package does not add a dependency workaround or claim route-tracing compatibility. No clean-install, signed native compilation or physical-device result is claimed; registry checks, installed peers, project generation and exports provide the local evidence here.

Evidence paths are ignored build artifacts, replaced by later runs. Archive the reports for the exact candidate. The reusable PostgreSQL CI job now runs this fixed performance profile and uploads `dist/performance-acceptance/` alongside concurrency and recovery reports for seven days. A fresh CI run does not manufacture the historical baseline report. No hosted workflow was triggered.

Remaining Milestone 5 work includes moderate dependency review and independent security assessment; hosted CI/publication protection; representative hosted/native performance, accessibility and long-soak acceptance; owned monitoring storage, protected dashboard, authenticated acknowledgement, escalation and controlled archive/replay; capacity/managed-backup collectors and an external watchdog; actual incident delivery and managed recovery/cutover with cash/GAAP and privacy reconciliation. Thresholds, recipients and schedules remain unconfigured.

See the [Milestone 5 report](milestone-5-local-engineering.md), [integrity package](loyalty-notification-integrity-sprint.md) and [readiness checkpoint](production-readiness-status.md).
