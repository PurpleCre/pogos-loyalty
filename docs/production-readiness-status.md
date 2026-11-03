# Production readiness checkpoint

Verified: 3 November 2026. Release 1 is loyalty and cash ordering/collection/delivery for Msasa, Kamfinsa and Westgate. Digital payments remain Release 2.

## Current milestone verdict

**Milestone 2 — client ownership, production data and business approval: in progress, awaiting client evidence.** The user reconfirmed on 3 November that no new approvals have been supplied. Engineering preparation now includes a private intake template/schema, redacted checks, approval/content hashes, disabled configuration proposals and a read-only inventory procedure. At the client-data checkpoint the full suite passed **353 tests**, including 31 intake/CLI/database cases; type/lint/schema/SDK/peer/template checks pass. No account, real data, role or branch configuration was changed. See the [milestone report and exact outstanding inputs](client-data-milestone.md).

This is preparation for closing milestone 2, not evidence that ownership or business policy has been approved. **Six delivery milestones still remain**, with milestone 2 active. Actual configuration/financial correctness must be established against named client evidence and a representative hosted clone.

## Privacy completion engineering increment

**Milestone 3 — in progress; core minimisation implemented locally and disabled.** The fresh combined suite passes **378 tests** with type/lint/schema/SDK/peer/template checks. A fixed-scope service-only operation, current field/policy coverage, terminal-only push purge, financial invariants, immutable retry receipts and separate retained-record review are implemented. A private unapproved field-review generator covers all **70 local public tables**; exports remain 29 sections. Standalone previews stay unindexed until explicit release mode. See [the scope, evidence and remaining activation work](privacy-core-minimisation-milestone.md).

Client ownership/business approval remains open alongside this engineering work. Actual controller/notice/retention/vendor approval, provider revocation, residual/manual minimisation, hosted/device rehearsal and owned public hosting are still required. No real erasure, hosted migration or publication occurred; **six delivery groups remain**.

## Previous offline/lifecycle checkpoint

**Offline/lifecycle and launch experience: implemented locally; physical-device and Pogo’s product acceptance remain open.** The full suite passes 322 tests, including 30 storage/recovery/lifecycle cases; type/lint/schema/SDK/peer checks and Android/iOS Hermes exports pass. Saved carts, public browsing snapshots, truthful private-read freshness, background/quote guards, durable matching-cart retirement before journal cleanup and preserved legacy action evidence are included. Unsupported promotions, stock hero imagery and fabricated delivery estimates are removed; Harare map/address defaults and a public help path are included. See the [milestone evidence and acceptance checklist](offline-launch-ux-milestone.md).

This completes local delivery group 1. Its brand/product approval and actual process-kill/network/storage/accessibility acceptance are carried into groups 2, 4 and 6. No hosted configuration, migration, live activation or publication was performed.

## Previous finance checkpoint

**Manager/finance permissions and reconciliation: local implementation complete and reverified; production acceptance remains open.**

- A fresh `npm run check` passes: **292 tests, zero failures**, TypeScript, lint, migration-derived type drift, SDK compatibility and installed dependency peers. The suite contains 15 finance database cases and 12 finance client cases.
- Review confirms branch-scoped manager/finance access, MFA, separation from administrator/refund authority, independent review, immutable observations, explicit variances, source-change detection, revision ordering, exact currency-separated totals and durable command recovery/export handling.
- The successful Android/iOS exports were checked against the current finance screen, pure client library and API adapter: all three files match their exported source-map content on both platforms. Existing temporary native project generation passed. These are bundle/prebuild results, not signed native compilation or physical-device acceptance.
- The full migration catalogue and privacy inventory are consistent locally: 67 public tables and 29 account-export sections. `git diff --check` passes.

There is no newly identified local failure blocking the next independent implementation milestone. The finance work still needs Pogo’s approved authority matrix and assignments, trading-day/currency rules, actual app-linked GAAP/till evidence, representative hosted migration, signed-JWT/API and true PostgreSQL concurrency tests, device acceptance and approved employee/financial-record retention. These remain mandatory release conditions. See the [finance activation checklist](finance-permissions-milestone.md).

## Remaining milestone count

**Six delivery milestones remain through the controlled three-branch rollout.** Five remaining groups produce an approved production candidate; the final group is the observed production pilot and staged expansion. Post-launch reviews remain part of handover.

This is a consolidation of the open work in the [task backlog](production-backlog.csv), including approvals and acceptance set aside in earlier increments. The original plan has nine overlapping phases (0–8) and the CSV has 49 task rows; neither number represents nine or 49 new coding sprints. Earlier phases retain open production gates even when their code has passed local checks. The remaining groups keep their original numbers (2–7) so subsequent checkpoints retain a consistent count. The completed local group 1 is recorded above; its external acceptance is carried forward rather than marked production-complete.

| Remaining milestone | Work and carried-over review | Main backlog references | Completion evidence |
| --- | --- | --- | --- |
| 2. Client ownership, production data and business approval | Intake/validation/proposal tooling is implemented locally; client evidence remains missing. Confirm Pogo’s account/signing/domain ownership, pilot and responsible owners; inventory actual data; approve branding/licensed assets/support contacts, branch catalogue/hours/zones/fees, currencies/tax/rounding, loyalty terms and openings, role/cashier matrix and GAAP manual bridge or verified automation. Configure only verified data and reconcile any historical import. | P0, P1-01/06, P3-01/02/06, P4-01/02/04, P5-04/06 | Owned environments, signed business source data and reconciled opening totals; named approvers and operators; approved till/fiscal procedure. |
| 3. Privacy completion and public support pages | Core minimisation and review tooling are implemented locally and disabled; obtain controller/notice/retention/vendor approvals and rehearse actual erasure/minimisation with downstream evidence and backup handling; publish approved privacy/deletion/support pages on the owned origin. Existing request/export orchestration alone does not complete erasure. | P2-05, P7-05 | Approved policies and executable procedure; representative deletion/export exercises and accessible public pages accepted. |
| 4. Hosted integration, finance/till and device acceptance | Rehearse migrations against representative existing data; verify real Auth/JWT/RLS/PostgREST/Deno and revocation; test true concurrent orders/rewards/cash/finance commands; configure and exercise expiry/push workers, receipts and schedules; verify real GAAP/till examples and intended branch devices. | P1-02/05, P2-01–04, P3-03–06, P4-01/02/04, P5-03/06, P6-02–06 | Customer/branch/role isolation, interrupted recovery, native notification/sharing/storage and busy-shift scenarios pass; real cash/reward/refund/till totals reconcile. |
| 5. Security, performance, monitoring and recovery | Resolve remaining platform/security findings and independent review; run realistic integration/load/soak/accessibility checks; configure redacted telemetry, alerts and budgets; rehearse backup/restore, migration/cutover and forward recovery with reconciled financial totals. Verify hosted CI and publication protection. | P0-04, P1-04/05, P2-03, P7-01–04 | No unresolved release-blocking findings; agreed performance/recovery targets met; a simulated incident reaches a named operator and restores correctly. |
| 6. Signed release and operational readiness | Build/sign and test production candidates; complete listings, review accounts and privacy forms; rehearse OTA compatibility/recovery; train primary/backup branch operators and support; approve launch roster and all release evidence against an exact commit/build. | P7-05/06, G7 | Engineering, QA, operations, finance, privacy and sponsor approve the candidate and operating procedures. |
| 7. Observed pilot and controlled chain rollout | Choose the best-prepared branch, run an internal shift and invited cohort, observe at least two representative trading weeks including busy periods, resolve findings, then activate the other two branches individually; complete ownership handover and 7/30-day reviews. | P8-01–04 | Daily cash/points/fiscal reconciliation, service/support results and branch pause criteria accepted; each branch independently passes activation. |

Client decisions, policy/vendor work and device acceptance can proceed in parallel where their dependencies allow. Hosted acceptance, hardening and release preparation overlap where their dependencies allow. These are delivery groups with evidence gates, not elapsed-time estimates. The two trading weeks begin with actual pilot service and cannot be replaced by local tests.

## Work awaiting external evidence

Pogo’s has not yet confirmed production ownership, its complete branch/business data, finance/role authority, policy/retention approval or pilot selection. The temporary privacy email remains **pgonese6@gmail.com**. Use the [client information request](client-information-request.md) to collect the missing inputs. Development use of the connected accounts does not establish production ownership.

Previously implemented checkout, fulfilment/loyalty, identity, privacy, branch operations, push and finance increments all retain their hosted/device/business acceptance gates. Push dispatch and unapproved branch/reward activation remain disabled pending their checks. GAAP discovery is required now; automatic GAAP sync can follow an approved manual bridge. Digital payment implementation and optional marketing/AI features are excluded from the remaining cash-first milestone count.

The earlier finance verification changed documentation only; the subsequent offline milestone changes client code and storage handling. It did not apply hosted migrations, assign real roles, activate dispatch or publish an app/OTA.
