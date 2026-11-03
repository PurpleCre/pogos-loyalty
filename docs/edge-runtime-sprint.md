# Edge runtime and protected workers sprint

Verified locally: **3 November 2026**. This sprint completes the local Deno handler implementation and acceptance slice of **milestone 4**. Milestone 4 remains in progress; **six delivery groups remain** in the [readiness checkpoint](production-readiness-status.md).

Pogo’s own ordering system and loyalty ledger remain authoritative. GAAP integration must connect both using a vendor-approved contract; this sprint does not introduce GAAP Rewards or another spendable balance.

Follow-on: the [worker/collector, recovery and security report](milestone-5-local-engineering.md) records the latest 453/28/13/5 local checks, 71-table inventory and remaining security/production blockers. Earlier counts and audit snapshots below describe their original checkpoints. Instrumented workers now require `20261103040000_worker_observations.sql` before function deployment; flags remain off until accepted.

## Completion audit — 3 November 2026

**Verdict: local Edge runtime sprint complete; milestone 4 and production activation remain open.** A fresh verification reran all three commands below successfully. No implementation correction was needed.

| Completion requirement | Fresh evidence | Verdict |
| --- | --- | --- |
| Existing app/database checks remain green | `npm run check`: 388 passed, zero failed/skipped/cancelled; type/lint/types/SDK/peers/template checks passed | Pass |
| All seven functions type-check | `npm run edge:check`: seven entrypoints and runtime suite checked | Pass |
| Protected workers and closed endpoints behave as documented | `npm run test:edge`: 22 passed; JUnit has 22 cases and no failures/errors | Pass |
| Entrypoints use the intended handler and deployment configuration | All seven mappings and strict per-function configs inspected; three workers pin SDK 2.118.0; Deno pinned to 2.9.6 | Pass |
| CI includes runtime checks before OTA | YAML parses; Edge job runs both commands and uploads evidence; OTA requires the reusable checks workflow | Pass locally; hosted run pending |
| Evidence identifies the tested source without claiming hosted acceptance | Check/test reports share source SHA-256 `f4145c203c64b98821fbc8f3e427b14ef2bcab601fbe61561a0b25df62f35aec`; both record `hostedAcceptance: false` | Pass |

The runtime verification finished at **2026-11-03 17:16:47 UTC**. Backlog structure remains valid (49 tasks, 12 columns), and `git diff --check` passes. No cloud or provider action was taken. The production acceptance items at the end of this report remain outstanding; they are not waived by this local completion verdict.

## Delivered

Three thin Edge entrypoints share strict server-side request handling:

| Function | Exact enable switch | Dedicated `X-Worker-Key` secret | Fixed operation |
| --- | --- | --- | --- |
| `dispatch-transactional-push` | `TRANSACTIONAL_PUSH_ENABLED=true` | `PUSH_WORKER_SECRET` | Claim 10 deliveries; eligibility fence; existing provider send/receipt and acknowledgement engine |
| `expire-cash-orders` | `CASH_ORDER_EXPIRY_ENABLED=true` | `CASH_ORDER_EXPIRY_WORKER_SECRET` | `expire_pending_cash_orders(p_limit: 100)` |
| `expire-reward-reservations` | `REWARD_RESERVATION_EXPIRY_ENABLED=true` | `REWARD_EXPIRY_WORKER_SECRET` | `expire_reward_reservations(p_limit: 100)` |

All switches default off. These handlers require POST and an independently generated secret of 32–256 printable non-space ASCII characters. A customer bearer token grants no authority. Requests accept an empty body or JSON `{}` only; callers cannot choose RPCs, batch sizes, recipients, branches or targets. Bodies have a 1 KiB maximum and a three-second read deadline. Responses prevent caching and hide raw upstream errors.

The SDK uses server credentials only, disables session persistence, rejects database redirects and limits each database fetch to eight seconds. Implicit SDK mutation retries are disabled. The existing push engine separately retries an idempotent result acknowledgement; an uncertain provider send remains unknown rather than being blindly resent. Expiry responses validate a real bounded integer count. Existing SQL permissions, financial invariants and push database switches still apply.

The three internal functions have `verify_jwt=false` because their dedicated handler secret supplies authentication. This is deliberate server-job authentication and must be verified through the deployed gateway before activation. No schedule has been installed.

The speculative legacy GAAP, marketing and AI support endpoints now return a closed response even when their historical enable flags are true. They do not parse requests, read credentials, invoke providers or process business data. The retired arbitrary push sender returns 410. Reopening any of these requires a reviewed implementation; setting an old flag cannot enable them. In particular, the GAAP webhook is not an implemented ordering/loyalty integration.

## Runtime and evidence

Deno **2.9.6** is an exact development dependency. Worker import maps pin Supabase JS **2.118.0**, matching the currently installed app SDK. Each function has its own strict `deno.json`, following [Supabase dependency guidance](https://supabase.com/docs/guides/functions/dependencies). No remote std/esm imports remain in these entrypoints.

```sh
npm ci
npm run check
npm run edge:check
npm run test:edge
```

Verified results:

| Check | Result | Scope |
| --- | --- | --- |
| `npm run check` | **388 tests pass**, zero failures | Node/PGlite regressions plus TypeScript, lint, migration-derived types, SDK, peers and client template |
| `npm run edge:check` | Pass | Strict native Deno type checking of all seven entrypoints and the runtime suite |
| `npm run test:edge` | **22 tests pass**, zero failures | Native Deno handler HTTP, actual SDK transport to a loopback fake backend, simulated provider responses |

Runtime cases cover methods, missing/wrong/cross-job secrets, exact enable switches, missing configuration, fixed service credentials, input rejection, body limits/deadline, bounded RPCs, invalid counts, redacted errors, disabled implicit retries, redirect refusal, push eligibility fences, ticket versus delivery evidence, unknown send outcomes, acknowledgement-only recovery and held-closed legacy endpoints.

The runner strips inherited app/provider credentials and startup injection variables. Tests receive explicit worker environment permissions and loopback network access only, with no runtime file, subprocess or external provider access. Dependencies resolve from the installed npm graph with `--cached-only --no-remote`; tests load no `.env`. Ignored `.local/deno-edge-cache` holds the runtime cache. The runner rejects extra targets/permission arguments.

Ignored `dist/edge-runtime/` contains check/test JSON reports and JUnit results. The JSON records the installed runtime/SDK, timestamps, source fingerprint and `hostedAcceptance: false`. The current check and test reports have matching source fingerprints. Archive the reports with a reviewed candidate; later runs replace them. The fingerprint identifies the tested handler surface, not client approval or the entire app.

The prior [PostgreSQL sprint](postgres-integration-sprint.md) separately verified 13 real concurrent scenarios on PostgreSQL 17.11. No database schema changed here; those cases were not rerun in this sprint. The 22 Deno cases do not add live PostgreSQL, PostgREST, Auth or provider coverage.

## CI and limits

The reusable checks workflow now includes a separate Edge job, with strict checking, runtime tests and seven-day evidence uploads. Its completion is included in the existing OTA workflow dependency. Automatic development OTA after successful checks on main and manual development/staging selection remain configured. No hosted workflow run, commit, push, OTA publication or branch-protection change was performed.

Native Deno is not the hosted Supabase Edge Runtime. These tests do not prove deployed entrypoint startup, gateway headers/JWT enforcement, real Auth/MFA/revocation, PostgREST/RLS, actual provider delivery/receipts or physical-device behavior. Provider responses are injected; only handler/backend test traffic uses actual HTTP. A ticket remains distinct from delivered notification evidence.

## Required before activation

1. Confirm account/project ownership and inventory the authorised environment. Rehearse migration upgrades against a representative clone and review existing grants/data; do not assume the local chain matches the hosted project.
2. Deploy the reviewed functions disabled, configure unique secrets through the server secret store, and prove missing/wrong/cross-job keys, methods, disabled switches and customer bearer rejection through the real gateway. Keep service/provider/job keys outside mobile and `EXPO_PUBLIC_` configuration.
3. With approved synthetic accounts and explicit test scope, enable one expiry job at a time and verify actual expired versus ineligible records, financial/allocation rollback, overlapping runs and lost responses against the real backend. Reconcile outcomes before enabling branch trading.
4. Agree scheduler cadence, measured capacity, timeouts, named ownership, monitoring and recovery. Install authenticated schedules only in the reviewed environment. Monitor expiry backlog/age, failed invocations and processed counts; exercise alerting and secret rotation. No cadence, demand or service target is assumed here.
5. Complete approved push processor/copy/consent setup, database and server switches, real tickets/receipts, invalid token cleanup, ambiguous outcomes and Android/iOS device acceptance. Verify real JWT/RLS and revoked/deleted account isolation separately.
6. Obtain the GAAP ordering and external-loyalty contracts, sandbox, branch/item/reference mappings, reversal semantics and till reconciliation examples. Implement against that evidence while preserving the app’s ledger. Client/privacy approval, security/load/recovery review and the observed pilot remain release gates.

No cloud configuration, live data, provider delivery, actual deletion, native build, schedule or publication changed in this sprint.
