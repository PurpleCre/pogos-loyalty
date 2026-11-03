# PostgreSQL concurrency sprint

Verified: 3 November 2026. **The local concurrency sprint is implemented and tested. Delivery milestone 4 remains in progress; hosted, device and real-till acceptance is outstanding.** Client ownership/business approval and privacy activation remain open. Six delivery groups remain.

Follow-on: the [worker/collector, recovery and security report](milestone-5-local-engineering.md) records the latest 453/28/13/5 local checks, 71-table inventory and remaining security/production blockers. Earlier counts and audit snapshots below describe their original checkpoints. Instrumented workers now require `20261103040000_worker_observations.sql` before function deployment; flags remain off until accepted.

## Result

The existing regression suite was previously verified at 380 cases. The new harness adds five runner-boundary cases to `npm run check`, bringing that suite to **385 passing tests** with TypeScript, lint, database-type drift, SDK, dependency-peer and client-template checks passing. A separate `npm run test:postgres` now passes **13 real PostgreSQL integration cases**, with zero failures. These are separate suites, not additional PGlite claims.

The successful run used **PostgreSQL 17.11**, Node **22.19.0**, the development-only `pg` **8.23.1** driver and Docker image ID `sha256:266d3c257594e195b309ae9d1805e54c788f1d7b375f56bf6c367aac6c917e7b`. The actual server version/image are recorded per run; this does not establish the hosted project's version. The migration chain executes one transaction per file against a fresh PostgreSQL instance and produces the expected **70 public tables**, with real activation switches initially off. Customer export sections remain 29.

## What the scenarios prove

Transactions use separate PostgreSQL clients and an independent observer connection. Blocking scenarios wait until `pg_blocking_pids` reports the expected holder before committing it; they do not rely solely on scheduling two promises. Each transaction stays on one client, following [node-postgres transaction guidance](https://node-postgres.com/features/transactions). Driver parameters carry values separately from query text.

| Scenario | Verified outcome |
| --- | --- |
| Transactional migration replay | Fresh schema reaches 70 tables; privacy and push are initially disabled |
| Simultaneous identical checkout key | One order; the waiting retry recovers the committed result |
| Identical cash completion commands | One receipt, earning and received movement; matching command replay |
| Different cash commands on one version | One succeeds; the competing stale version fails without another receipt |
| Competing reward holds on one account | Spendable/reserved points reconcile; the second hold cannot overspend |
| Two customers reserving the last reward unit | One reservation; stock reaches zero and the losing account retains its balance |
| Finance submission during a cash posting | Submission waits, reads the newly committed amount and records the resulting variance |
| Competing independent finance reviewers | One acceptance; a stale reviewer cannot create a second acceptance event |
| Privacy start after an in-flight checkout | Review waits and then blocks on the newly committed active order |
| Checkout after an in-flight privacy start | Checkout waits, then fails; no order appears after processing begins |
| Two expiry workers | A worker skips the other session's locked order; both orders expire once |
| Existing push jobs and dispatch fence | Claims lease disjoint committed jobs; a competing dispatch preparation cannot reuse the fence |
| New push job materialisation | A busy uncommitted pair is skipped; a later claim recovers the remaining job without duplicate creation |

## Worker correction found by the real tests

The push test initially blocked before reaching its `SKIP LOCKED` lease query. The earlier materialisation `INSERT ... ON CONFLICT DO NOTHING` could wait on another transaction's insert/update, even for an already existing delivery pair. Serial PGlite execution could not expose this contention.

Forward migration `20261103020000_push_claim_concurrency.sql` skips existing pairs and uses a nonblocking transaction advisory lock for new event/device pairs. Busy pairs can be reconsidered by a later worker call. The unique constraint and conflict handling remain as backstops, and function privileges are preserved. The existing-pair scenario reproduced the failure before this correction; both that scenario and the simultaneous-materialisation case pass afterward. This removes the reproduced materialisation contention; it is not a claim that every worker statement is wait-free or that provider delivery is exactly once.

No provider request occurs in these tests. Push settings are enabled only inside the disposable fixture, with synthetic tokens; no real notification, hosted dispatch activation or scheduler was used.

## Running and inspecting it

Start the local Docker engine, then run:

```sh
npm run test:postgres:pull
npm run test:postgres
```

Image download is explicit; normal test runs never pull implicitly. The pull/run tools refuse remote Docker endpoints and accept no hosted URL, target database, image or container argument. The runner creates a uniquely named, labelled local container, publishes its randomly assigned port only on `127.0.0.1`, generates a private ephemeral password and installs fixtures only into the fresh run-specific database. It loads no `.env` and uses no Supabase/EAS credentials. The current implementation supports a local Unix-socket Docker daemon.

The test server has a 384 MB memory limit, one CPU, 128-process limit and a bounded temporary in-memory data mount; no project/host directory or persistent data volume is mounted. Connections have statement, lock and idle-transaction timeouts. Synthetic actors and business settings are not approved Pogo’s production data. The shared bootstrap supplies minimal Auth tables/functions and role claims, rather than running Supabase Auth.

Normal completion/failure removes only the container with the matching ID/run label. Interrupt handling stops the test child and attempts the same cleanup. An OS kill or unavailable daemon can still require manual recovery: identify the exact run from its report/name, verify its `org.pogos.acceptance.run` label, and remove only that container. Do not prune unrelated Docker resources. The downloaded image stays cached for reruns; this sprint does not delete other projects' containers, images or volumes.

`dist/postgres-acceptance/report.json` records status, test counts, Node/server/image identity, a SHA-256 of the tested dependency manifests/migrations/runner/fixtures and cleanup outcome. It contains no connection password, bearer token or real account data. It explicitly records `hostedAcceptance: false` and the simulated-claim limitation. It is ignored locally, and subsequent runs replace this latest-run report; archive the actual report for a reviewed release candidate. The fingerprint covers this test surface, not the entire application or the truth of client approvals.

## CI and OTA

The reusable checks workflow now has a separate PostgreSQL job that downloads the test image, runs the suite and uploads its redacted report for seven days, including failed executions where a report exists. The existing OTA workflow depends on that reusable checks workflow, so its configured gate includes the PostgreSQL job. Automatic development updates on main and manual development/staging selection are preserved.

This is local workflow configuration. No GitHub-hosted run, repository/environment protection change, push, commit, app build, OTA publication or production deployment was performed. Hosted CI execution and protected-publication acceptance still need evidence.

## Acceptance still required in milestone 4

1. Inventory the authorised hosted project's actual version, schema/history, grants, Auth/functions/storage/realtime, feature flags and existing data. Rehearse upgrades on an isolated representative clone; the new suite proves a fresh transactional chain, not that deployed data matches it.
2. Test real signed JWT/password/MFA/recovery/revocation and PostgREST/RLS/realtime behavior, including customer/branch isolation and old clients. Synthetic SQL claims are not gateway or Auth evidence.
3. Execute Deno/gateway/secret checks and scheduled expiry/push work in the reviewed environment; verify schedules, monitoring, provider tickets/receipts and supported failure recovery. Selected local concurrency checks do not activate a scheduler or prove runtime/provider behavior.
4. Extend representative contention/load/soak coverage to actual shift volumes, role changes, refunds, reward handover/expiry, deletion/manual processing, financial report/export races and recovery. Obtain agreed performance targets and independent security review.
5. Reconcile Pogo’s approved app-linked GAAP/till sales, cash custody, refunds, reward handovers and openings for the intended branches/currencies. Complete physical Android/iOS build, sharing/storage/network/process-kill/notification and busy-shift exercises on the intended devices.

No hosted migration or real account/data/role/branch configuration changed. Privacy processing, unapproved trading and real push dispatch remain gated. See [the readiness checkpoint](production-readiness-status.md) and [client information request](client-information-request.md).
