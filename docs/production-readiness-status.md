# Production readiness checkpoint

Verified: 2 November 2026. Release 1 is loyalty and cash ordering/collection/delivery for Msasa, Kamfinsa and Westgate. Digital payments remain Release 2.

## Current milestone verdict

**Manager/finance permissions and reconciliation: local implementation complete and reverified; production acceptance remains open.**

- A fresh `npm run check` passes: **292 tests, zero failures**, TypeScript, lint, migration-derived type drift, SDK compatibility and installed dependency peers. The suite contains 15 finance database cases and 12 finance client cases.
- Review confirms branch-scoped manager/finance access, MFA, separation from administrator/refund authority, independent review, immutable observations, explicit variances, source-change detection, revision ordering, exact currency-separated totals and durable command recovery/export handling.
- The successful Android/iOS exports were checked against the current finance screen, pure client library and API adapter: all three files match their exported source-map content on both platforms. Existing temporary native project generation passed. These are bundle/prebuild results, not signed native compilation or physical-device acceptance.
- The full migration catalogue and privacy inventory are consistent locally: 67 public tables and 29 account-export sections. `git diff --check` passes.

There is no newly identified local failure blocking the next independent implementation milestone. The finance work still needs Pogo’s approved authority matrix and assignments, trading-day/currency rules, actual app-linked GAAP/till evidence, representative hosted migration, signed-JWT/API and true PostgreSQL concurrency tests, device acceptance and approved employee/financial-record retention. These remain mandatory release conditions. See the [finance activation checklist](finance-permissions-milestone.md).

## Remaining milestone count

**Seven delivery milestones remain through the controlled three-branch rollout.** The first six produce an approved production candidate; the seventh is the observed production pilot and staged expansion. Post-launch reviews remain part of handover.

This is a consolidation of the open work in the [task backlog](production-backlog.csv), including approvals and acceptance set aside in earlier increments. The original plan has nine overlapping phases (0–8) and the CSV has 49 task rows; neither number represents nine or 49 new coding sprints. Earlier phases retain open production gates even when their code has passed local checks. The seven groups below give subsequent checkpoints a consistent count without marking those gates complete or adding release scope.

| Remaining milestone | Work and carried-over review | Main backlog references | Completion evidence |
| --- | --- | --- | --- |
| 1. Offline/lifecycle and customer launch experience | Finish stale/offline browsing, persisted cart and interruption handling; remove placeholder queue clearing and unsupported/demo claims; apply approved branding, Zimbabwe defaults, accessible states and support paths. Keep unfinished QR earning, gifting/referrals and AI features disabled. | P1-06, P4-03/05, P6-01/05 | Critical customer/staff journeys survive process kills, reconnect and account switching without lost or duplicated financial actions; product walkthrough accepted. |
| 2. Client ownership, production data and business approval | Confirm Pogo’s account/signing/domain ownership, pilot and responsible owners; inventory actual data; approve branch catalogue/hours/zones/fees, currencies/tax/rounding, loyalty terms and openings, role/cashier matrix and GAAP manual bridge or verified automation. Configure only verified data and reconcile any historical import. | P0, P1-01/06, P3-01/02/06, P4-01/02/04, P5-04/06 | Owned environments, signed business source data and reconciled opening totals; named approvers and operators; approved till/fiscal procedure. |
| 3. Privacy completion and public support pages | Obtain controller/notice/retention/vendor approvals; implement and rehearse actual erasure/minimisation with downstream evidence and backup handling; publish approved privacy/deletion/support pages on the owned origin. Existing request/export orchestration alone does not complete erasure. | P2-05, P7-05 | Approved policies and executable procedure; representative deletion/export exercises and accessible public pages accepted. |
| 4. Hosted integration, finance/till and device acceptance | Rehearse migrations against representative existing data; verify real Auth/JWT/RLS/PostgREST/Deno and revocation; test true concurrent orders/rewards/cash/finance commands; configure and exercise expiry/push workers, receipts and schedules; verify real GAAP/till examples and intended branch devices. | P1-02/05, P2-01–04, P3-03–06, P4-01/02/04, P5-03/06, P6-02–06 | Customer/branch/role isolation, interrupted recovery, native notification/sharing/storage and busy-shift scenarios pass; real cash/reward/refund/till totals reconcile. |
| 5. Security, performance, monitoring and recovery | Resolve remaining platform/security findings and independent review; run realistic integration/load/soak/accessibility checks; configure redacted telemetry, alerts and budgets; rehearse backup/restore, migration/cutover and forward recovery with reconciled financial totals. Verify hosted CI and publication protection. | P0-04, P1-04/05, P2-03, P7-01–04 | No unresolved release-blocking findings; agreed performance/recovery targets met; a simulated incident reaches a named operator and restores correctly. |
| 6. Signed release and operational readiness | Build/sign and test production candidates; complete listings, review accounts and privacy forms; rehearse OTA compatibility/recovery; train primary/backup branch operators and support; approve launch roster and all release evidence against an exact commit/build. | P7-05/06, G7 | Engineering, QA, operations, finance, privacy and sponsor approve the candidate and operating procedures. |
| 7. Observed pilot and controlled chain rollout | Choose the best-prepared branch, run an internal shift and invited cohort, observe at least two representative trading weeks including busy periods, resolve findings, then activate the other two branches individually; complete ownership handover and 7/30-day reviews. | P8-01–04 | Daily cash/points/fiscal reconciliation, service/support results and branch pause criteria accepted; each branch independently passes activation. |

Client decisions and policy/vendor work can proceed alongside milestone 1. Hosted acceptance, hardening and release preparation overlap where their dependencies allow. These are delivery groups with evidence gates, not elapsed-time estimates. The two trading weeks begin with actual pilot service and cannot be replaced by local tests.

## Work awaiting external evidence

Pogo’s has not yet confirmed production ownership, its complete branch/business data, finance/role authority, policy/retention approval or pilot selection. The temporary privacy email remains **pgonese6@gmail.com**. Use the [client information request](client-information-request.md) to collect the missing inputs. Development use of the connected accounts does not establish production ownership.

Previously implemented checkout, fulfilment/loyalty, identity, privacy, branch operations, push and finance increments all retain their hosted/device/business acceptance gates. Push dispatch and unapproved branch/reward activation remain disabled pending their checks. GAAP discovery is required now; automatic GAAP sync can follow an approved manual bridge. Digital payment implementation and optional marketing/AI features are excluded from the seven-milestone cash-first count.

This verification changed documentation only. It did not apply hosted migrations, assign real roles, activate dispatch or publish an app/OTA.
