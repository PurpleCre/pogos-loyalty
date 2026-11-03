# Pogo’s client data intake

This is an engineering companion to [the client questionnaire](../../docs/client-information-request.md). Pogo’s can return ordinary approved documents; engineering transcribes them into the private JSON pack. The client does not need to fill JSON or invent database UUIDs.

The committed template contains only the confirmed chain/release/branch names. Unknowns are `null` or empty lists. **No real menu, price, address, currency, rate, offer, staff assignment or approval is seeded.** Current connected accounts remain development-only. Staging/production identifiers in the template are unconfirmed.

## Commands

Use the repository’s pinned Node 22 toolchain and installed dependencies. These commands neither load `.env` nor contact Supabase, Expo, GAAP or a cloud account.

```sh
npm run client:init
npm run client:status
npm run client:status -- .local/client-data/pack.json
npm run client:check -- .local/client-data/pack.json --scope pilot
npm run client:digest -- .local/client-data/pack.json
npm run client:plan -- .local/client-data/pack.json --scope pilot --out .local/client-data/review-v1.json
```

`client:init` creates `.local/client-data/pack.json` with owner-only file permissions, refusing an existing file. `.local/` is ignored by Git. Actual source documents, completed packs, rosters and review artifacts belong in the agreed restricted location; do not add credentials or raw customer data. Nothing imports this pack into the app.

`status` defaults to the committed empty template and prints a redacted report. It exits zero because it is an inspection command, even when data is missing. `check` is the strict gate: exit **0** means the supplied configuration claims are complete enough for human review; **1** means missing, conflicting, stale or unsupported decisions; **2** means invalid command/file/JSON. Missing data is expected until Pogo’s responds. Neither success nor an approval record means production readiness.

`plan` requires a successful strict assessment and a new output path. It writes a **nonexecutable JSON proposal** with owner-only permissions, never overwrites a file, and has no apply command. All ordering, fulfilment, catalogue visibility, reward, pricing/terms approval and service flags stay off. Existing mappings yield `review_existing`, never an upsert/update/delete. It does not grant roles, approve cashiers, import historical points or modify `config/environments.json`.

Default scope is `chain`: all three branches need complete data. `--scope pilot` requires an explicitly nominated `pilotBranch` and checks that branch; the other branches can remain unconfirmed. Global ownership, finance/programme/access/GAAP/opening evidence is still required. Cross-branch mapping collisions remain invalid even outside pilot scope. Pilot review does not approve chain rollout.

The existing native config needs both Android/iOS identifiers even when the first launch is Android-only. A reserved/approved technical identifier does not assert Apple listing/signing ownership or activate an iOS release. Production and staging identifiers must be isolated from each other and from the current development binding; the same authorised Expo organisation may own different projects.

## Field guide

| Input | Source / responsibility | Interpretation |
| --- | --- | --- |
| `owners` | B02–B03, A03/A06 and T01–T11 | Stable opaque references into the named contact register. `fixture_*` people in automated tests are synthetic. Actual identity and authority must be independently verified. |
| `environments` | T01–T07, engineering/IT | Candidate public account/project/package identifiers only. Never API keys, passwords, signing material or recovery codes. No account is linked/transferred by a successful assessment. |
| `sources` | Versioned client documents | A local ID, exact version and SHA-256 of the source bytes. Keep documents in restricted storage. IDs are aliases, not a vendor contract. |
| `mapping` | T09–T10, engineering inventory | Actual UUID and `existing` or `new`, established against the named deployment/clone. Never ask Pogo’s to guess UUIDs or assume a demo record is a production branch. Immutable earning rules/offers require new version IDs. |
| `branches` | BR01–BR12, M01–M07, O01–O08 | Exact names/codes for Msasa/Kamfinsa/Westgate; real address/pin/phone/hours, service choices, staff/device/operating evidence and catalogue. `code` is an intake alias; `gaapBranchCode` is the opaque actual vendor value. |
| Menu/options/zones | M01–M05, O02–O03 and finance | Money is canonical decimal **minor-unit strings** (`"1010"`, not `10.10`). Longitude precedes latitude in polygons. A small simple polygon has 3–200 distinct vertices without repeating the first; order of overlapping zones needs unique explicit priorities. No road ETA is inferred. |
| `finance` | F01–F07 | Current code supports inclusive configured prices, one cash currency per branch, no FX, full till-funded same-currency refunds and Harare midnight reporting. Other requirements produce a capability gap requiring implementation or an explicit client scope decision. |
| `programme`, rules and offers | L01–L08 | Real point rates, allocation, terms, limits, expiry/collection and refund-debt decisions. No automatic programme-wide points expiry is implemented. Each branch needs an approved offer/rule; all proposed rows remain inactive. |
| `access` and branch people | A01–A04, F04 | Evidence for restricted roster/permissions/recovery, at least two distinct administrator references, named cashiers and distinct finance submitter/reviewer references. No passwords, staff email lists or role mutations are part of the proposal. |
| `gaap` | G01–G06 | Current launch path requires a separately approved/rehearsed manual bridge and sale/reward/refund evidence. Vendor codes remain opaque; no API/signature contract is invented. Automation stays a separate acceptance gate. |
| `openings` | L06–L07, T09–T10 | Declared source/preserved aggregates, cutoff, classification/freeze evidence and unresolved exceptions. Exact integer strings support large/negative balances. Equality is a consistency check on declarations, not proof of per-account correctness or an executed import. |
| `approvals` | Named business approvers | Exactly one recorded approval per required area with content digest, approver reference, date and separate evidence metadata. These are claims requiring independent verification; this tool does not authenticate signatures/people. |

Global categories and reward definitions may share UUIDs across branches only when their actual definitions and mapping modes match. Branch items/options/zones/rules/offers cannot reuse another entity’s UUID. Costs must stay valid for every permitted combination; more than one required option choice is a current capability gap. Images require a rights source; every item requires approved allergen evidence. Absence of an image does not create a fabricated replacement asset.

The JSON schema describes shape. The CLI additionally checks relationships, exact money, geometry, capability limits, ownership isolation and approvals. Passing a generic JSON-schema editor alone is insufficient.

## Evidence and approval sequence

1. Collect the questionnaire answers, versioned documents and named approvers. Keep unknowns explicit. Obtain authorised read-only inventory before mapping real existing data; use [the inventory procedure](../../docs/client-data-milestone.md).
2. Hash each underlying source file without printing its contents:

   ```sh
   node scripts/client-data.mjs hash .local/client-data/source-document.pdf
   ```

3. Transcribe and validate the pack. Fix missing facts and supported-policy issues with their owners. A change to unsupported business policy needs an explicit decision; do not silently coerce it into the current implementation.
4. Freeze the content for review and compute `client:digest`. It hashes the strict schema-validated, normalized content with sorted object keys; arrays retain their order. Approval records themselves are excluded. Source documents, versions, ownership, all branches and technical mappings are included, even for pilot scope: later edits require reapproval of the changed pack.
5. Obtain the written approvals against that exact digest and source versions. The external approval evidence is stored **inside each approval record**, outside `sources`, avoiding a circular dependency when a signed document contains the digest it approves. Do not include an approval document’s hash in the content it is signing.
6. Record approvals with independently verified approver references. Ownership permits sponsor/IT; brand permits brand/sponsor; finance/programme/openings require finance; access permits sponsor/operations; GAAP permits finance/operations; launch requires sponsor; each branch requires operations. Future/stale/duplicate approvals are rejected. These checks classify nominated roles and cannot prove the actual signer’s identity or read the external evidence.
7. Run strict check and create a new numbered proposal. Review every row against the real schema, preserved data and immutable version rules on an isolated representative clone. Only later governed implementation/release work can apply approved configuration or activate a branch.

Never re-sign fictional evidence simply to obtain a green report. A test fixture is not a completed client pack. Production still requires legal/privacy approval, actual erasure, hosted/till/device/concurrency/security/recovery/training and pilot gates.
