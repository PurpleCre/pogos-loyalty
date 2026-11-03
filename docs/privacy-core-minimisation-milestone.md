# Privacy core minimisation and review preparation

Verified: 3 November 2026. **Milestone 3 is in progress. The core operation is implemented and tested locally, disabled by default. Production privacy readiness is not complete.**

The preceding client-data preparation was reverified with `npm run check` at 353 tests. Pogo’s confirmed no new approvals, so milestone 2 remains open. Independent privacy engineering proceeded without inventing a controller, retention periods, vendor decisions or public origin. Six delivery groups remain; the approval-dependent groups are not closed by this work.

## Implemented scope

Migration `20261103000000_privacy_core_erasure.sql` adds a server-only, fixed-scope application operation, immutable approval/run records and a private transaction capability. No approvals, account assignments or activation flags are seeded. `privacy_settings.application_erasure_enabled` defaults to false, independently of the existing deletion-processing switch. The current public inventory contains **70 tables**; customer exports remain **29 sections**.

`minimize_privacy_application(request, expected_version, policy_version, run_id, operator_reference, row_limit)` requires a processing deletion case, current notice/retention versions, current application approval, exact field coverage, resolved trading/staff/cash/reward obligations and an Auth deletion flag. The provider step is deliberately separate: this function cannot revoke sessions or call Auth-admin/vendor APIs. Its presence check does not prove actual provider revocation or upstream erasure.

The operation removes the account’s saved locations, POS links, legacy push subscriptions/notifications, native installation bindings, recipient events and dependent terminal delivery evidence, reward claim secrets and export cursors. It clears core profile contacts, owned order contact/address snapshots, quote request/contact/address content, reward customer names, owned GAAP payload/error/line-item fields, involved gift messages and matching invitation contacts/reasons; marketing defaults back to off. Invitation matching uses the accepted account or current Auth/profile email. Older aliases and arbitrary references need manual review.

Amounts, currencies, quote pricing/items, receipts, custody movements, fiscal references, ledger/account/points records, reward financial state and finance cases remain. A before/after financial fingerprint aborts the transaction on drift. This is minimisation of a documented subset, not universal anonymisation or deletion of every related record.

Queued, leased, retrying, ticket/receipt-waiting and unknown push results block the whole operation. Provider-accepted, failed, cancelled and expired jobs are eligible for the reviewed purge. An immutable push-result deletion exception exists only for terminal jobs scoped to the case within the private transaction capability. It does not allow audit updates, general audit deletion, flag-based bypasses or disabling triggers. Already-submitted messages still need processor review.

A stable run ID recovers a lost response. Changed run parameters, case versions, policies or financial sources fail closed. An affected-row ceiling (default 10,000; maximum 50,000) rolls back all mutations if exceeded; it is not a guarantee on scan cost or elapsed time. Larger accounts need a separately reviewed batch design. Replay, attestation, task recording and completion recheck known mutable core fields; a privileged writer reintroducing contact data invalidates the prior receipt. A completed run does **not** complete the application task or deletion request.

## Field and retained-record review

`npm run privacy:policy:draft` builds an unapproved field-review document from the actual local migration catalogue in `.local/privacy/policy-draft.json`. The directory is ignored; new files are private and exclusive, so an existing review is preserved. `-- --output=PATH` selects another restricted location. No `.env`, hosted connection, credentials, real records or settings writes are involved.

The draft includes an ordered field-list fingerprint, the fixed operation version and every public `table.column`. It proposes `core` only for fields touched by the fixed operation; other actions, all reasons/deadlines and all approval metadata remain unconfirmed. It cannot activate processing or insert an approval.

An accountable reviewer must supply a version, matching immutable retention approval, actual approval reference/person/time and approval expiry, together with each field decision. The private database validator requires exact field coverage and three keys per decision: `action`, `reason_reference`, `retain_until`.

- `core` is mandatory for the operation’s defined fields, with a reason and null deadline because the operation removes/minimises its defined account-scoped subset immediately.
- `retain` or `manual` is required for other subject/audit fields, with an actual finite future deadline and reason/reference from the approved retention plan. Deadlines must use absolute UTC `YYYY-MM-DDTHH:MM:SS[.ffffff]Z` timestamps (optional fraction, up to six digits); relative dates, date-only values and other offsets are rejected.
- `not_subject` with a reason and null deadline is permitted only for the listed business catalogue/configuration tables. It must be justified against actual content.

**The field list is not a complete schema compatibility check or a JSON/free-text identity scanner.** Core scope is narrower than every occurrence of a person’s information in a field: other recipients’ messages, actor references, historical aliases, quote item text, command snapshots, append-only audit notes and vendor evidence may remain. The companion approved retention/runbook must explicitly govern these residual categories, reasons, access and deadlines, including residual content in a core field. Neither a `core` label nor a pseudonymous UUID establishes that a record has ceased to be personal data.

Registering/selecting real approval records is a separately reviewed database-owner change. The service role cannot mint its own approval, directly forge a run or write the private capability. No unattended erasure scheduler or arbitrary-table operation is introduced.

After a successful run, an authorised operator must actually complete the retained/unstructured-record review and record its reference through `attest_privacy_application_review(request, expected_version, policy_version, run_id, evidence_reference, operator_reference)`. This is a recorded attestation, not an automated inspection or independent verification. `record_privacy_task(..., 'application', 'completed', evidence, operator)` now requires a current run and matching attestation. Final completion also checks those same references. Changed policies/versions/sources require reassessment; never invent or reuse receipts to bypass it.

## Verification

`npm run check` passes **380 tests, zero failures**, TypeScript, lint, migration-derived type drift, SDK compatibility, installed dependency peers and the unapproved client-template check. This adds **27 tests** to the client-data checkpoint: 26 core/policy/draft cases and one public-preview regression. Existing lifecycle tests now execute actual core minimisation before completion rather than manually simulating application scrubbing; external Auth/manual/vendor receipts remain synthetic.

Tests cover service-only access, approval/context/receipt forgery denial, disabled operation, provider prerequisite, malformed/null field decisions, schema/approval/deadline drift, account isolation, quote/order/GAAP/gift minimisation, invitation matching after provider contact removal, terminal/uncertain push handling, immutable audit controls, transactional row-limit rollback, lost responses, stale identities, policy changes, pause/resume, manual attestation, remaining vendor tasks, financial drift and contact reintroduction. A synthetic database trigger that changes points forces rollback. The completion fixture retains its cash receipt, fiscal reference, order amount and points while stale JWT application access is denied.

The private draft generator and standalone privacy/deletion preview builder both run locally. Preview pages now remain `noindex` even when a notice is supplied, unless explicit release mode is selected. Release mode still needs the reviewed notice record; metadata validation cannot establish the truth of an approval or control of the future origin. The operator must verify those before publication.

Database cases use disposable PGlite and simulated roles/claims. They do not prove actual Auth-admin behavior, signed JWTs, full PostgreSQL concurrency, PostgREST, provider delivery/erasure or device cleanup. No app runtime/dependency changed; new native compilation/device acceptance remains in its existing release groups. No hosted migration, real account/vendor deletion, push dispatch, website/app/OTA publication or production activation was performed.

## Completion audit — 3 November

**Verdict: the local core implementation passes verification after two corrections; the full milestone is not complete.** The initial 378-test suite passed again, but new regression cases exposed two gaps that the existing cases did not cover:

1. PostgreSQL accepted JSON deadlines such as `tomorrow`, which move with subsequent validations instead of defining a fixed approved instant. The validator now requires the absolute UTC format above.
2. Financial fingerprints serialized timestamps in the SQL session's time zone. Retrying the same run in a Harare-time session incorrectly reported financial drift. Fingerprint serialization is now pinned to UTC.

Both new cases failed against the previous code and pass with `20261103010000_privacy_validation_hardening.sql`. The focused privacy suite passes **51 cases**. The full project check passes **380 cases**; the draft CLI and public-page preview builder also run successfully. The changes preserve the original migration and function permissions, add no tables or approval records, and leave activation off. New native exports were not needed for this SQL/test/documentation correction.

| Required element | Audit evidence | Verdict |
| --- | --- | --- |
| Fixed account-scoped core operation and access controls | Actual local SQL execution, role/forgery denials, unresolved-push blocking, rollback and core-data reintroduction tests | Verified locally |
| Financial preservation and retry recovery | Receipt/fiscal/order/points retention, deliberate mutation rollback, immutable run recovery and cross-time-zone regression | Verified locally |
| Field inventory and approval preparation | Exact 70-table field map and private CLI draft; no fabricated approvals or deadlines | Tooling verified; actual policy approval outstanding |
| Reviewer/manual/completion safeguards | Version/policy changes, separate matching attestation, six-system evidence and stale-token completion boundary tested with fixtures | Verified locally; genuine execution evidence outstanding |
| Real provider, residual/manual, vendor and backup treatment | Auth deletion flag and external receipts are simulated; no real-system erasure or backup rehearsal was performed | Outstanding |
| Representative hosted migration, signed JWT and concurrent access acceptance | Disposable PGlite only; development account access does not establish production ownership | Outstanding |
| Approved public policy/deletion/support resources | Standalone draft generation, escaping, unindexed previews and missing-notice release rejection pass; no owned origin or publication evidence supplied | Outstanding |

No new client approvals were supplied during this audit. Milestones 2 and 3 remain open and the remaining delivery count stays at six. The table records completion evidence, rather than treating a passing local suite as production acceptance.

For an upgrade, existing immutable policies containing noncanonical deadlines need a newly approved policy version; do not edit their history. If a previous run was fingerprinted under a non-UTC session, preserve its receipt and use the reviewed pause/resume procedure with a new case version and run ID to reassess it. This migration does not rewrite old evidence or claim that a previous run changed money. Rehearse any existing-case upgrade on an isolated representative clone before deployment.

## Work required to close milestone 3

1. Obtain controller/approver/contact ownership, approved notice and field/retention plan, named operators and all vendor/hosting/transfer decisions. Reconcile the actual schema, content, buckets, logs and historical imports with the local inventory.
2. Approve and rehearse provider revocation/deletion before application scrubbing. Demonstrate provider behavior, historical aliases and retained financial/audit treatment against representative data on an isolated hosted clone; verify actual concurrent worker and customer boundaries.
3. Perform and record application residual/manual minimisation, GAAP, mail, monitoring, device/export, backup expiry/restore-suppression and any other applicable system procedures. Approve restricted retained-record access and deadline follow-up. This operation does not execute future retention expiry or erase external copies.
4. Demonstrate the six-system completion flow with genuine evidence and supported failure recovery; assess larger-account batching and obtain independent privacy/security acceptance.
5. Publish the approved privacy/deletion/support resources on an owned HTTPS origin, verify the mailbox and unauthenticated request path, and complete store/device acceptance. No client approval or public hosting is currently confirmed.

See [the lifecycle runbook](privacy/data-lifecycle.md), [client information request](client-information-request.md) and [remaining delivery groups](production-readiness-status.md).
