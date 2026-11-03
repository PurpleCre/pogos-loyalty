# Client ownership, production data and business approval milestone

Updated: 3 November 2026. **Engineering preparation implemented; milestone 2 remains open awaiting client evidence.** The user reconfirmed that no new approvals or production data have been supplied. The six remaining delivery groups are unchanged.

## Confirmed facts and present boundary

Pogo’s operates Msasa, Kamfinsa and Westgate in Zimbabwe. Release 1 is loyalty plus ordering with cash on collection/delivery; GAAP is the POS vendor, digital payments follow later and launch priority is ASAP. Current connected accounts are authorised for development only. Production/staging ownership, legal entity, account administrators, pilot/platform choices, real branch/menu/pricing/delivery/loyalty rules, role/finance authority, support details and privacy/retention approval remain unconfirmed. The temporary privacy contact remains pgonese6@gmail.com.

No real trading data, account transfer, migration, role assignment, balance import, branch flag or publication was performed. This milestone cannot be closed merely because intake tooling passes tests. Read the [client questionnaire](client-information-request.md) alongside the [engineering field guide](../config/client-intake/README.md).

## Engineering work delivered

- A strict JSON template/schema holds the three confirmed branch names and explicit unknowns. A private working copy is created in ignored `.local/client-data/pack.json`; existing files are never overwritten. No demonstration prices, addresses, currencies, benefits, people or production identifiers are seeded.
- Local commands validate ownership/project isolation; versioned source evidence; named owner/approval references; exact currency-separated minor-unit amounts; catalogue/options/UUID mappings; delivery polygons/priorities; hours and operating facts; supported finance/loyalty/GAAP scope; cashier/admin recovery and independent finance references; opening-total declarations; pilot versus chain scope.
- Unsupported requirements produce capability gaps, including FX, partial/other refunds, a different reporting cutoff, multi-required modifier selections, automatic point expiry or GAAP automation. Pogo’s must approve a supported launch scope or engineering must implement the requirement. A validator is not authority to change business rules.
- A canonical content digest binds proposed decisions to exact source versions/mappings. Stale, missing, duplicate, future or wrongly attributed approval records block configuration review. Approval evidence is separate from signed content to avoid circular hashes. Neither hashes nor typed approver references prove a person’s identity, signature, ownership or the truth of a source document.
- A passing intake can generate only a nonexecutable JSON proposal. Catalogue, cash, loyalty and reward settings remain unavailable/inactive; price/terms approval, service modes and branch activation remain off. Existing records produce explicit review proposals. No SQL executor, upsert/delete, role/cashier grant, environment-file update, historical balance import or automatic activation is exposed.
- A read-only inventory SQL file is prepared and exercised against the local schema. It shows schema/RLS/grants, public branch/catalogue/configuration identifiers and aggregate role/cash/opening totals. It does not fetch customer contacts, staff email lists, auth/device credentials or raw transactional payloads.
- `npm run check` now verifies that the committed template is structurally valid yet correctly blocks configuration review. It deliberately does not require real client approvals for development CI/OTA. Strict real-pack checking is an explicit separate gate.

## Commands and expected result now

```sh
npm run client:init
npm run client:status
npm run client:check -- .local/client-data/pack.json --scope pilot
npm run client:digest -- .local/client-data/pack.json
npm run client:plan -- .local/client-data/pack.json --scope pilot --out .local/client-data/review-v1.json
```

The working draft has already been created. Repeating `init` refuses to overwrite it. `status` is an inspection command and may exit zero with blockers; strict `check`/`plan` exit 1 while required data/approval is missing. Invalid command/file/JSON exits 2. Current check failure is expected and correctly prevents a proposal; it is not an application regression. Successful strict checking means ready for **human configuration review**, never production readiness.

## Inventory, mapping and historical/demo handling

1. Have Pogo’s identify the authoritative deployment, owner and authorised read-only operator. Record project references, package/listing continuity, installed versions and separate staging/production candidates. The development binding is not evidence of production ownership. No connected account was inventoried remotely during this work.
2. Obtain and restrict the relevant backup/clone. Inspect actual migration history with the installed CLI, including the prior replay incident. Compare the live schema with the local catalogue; a fresh local migration test does not prove compatibility with an existing deployment.
3. Review [client-data-inventory.sql](client-data-inventory.sql) before running it with an authorised connection. It is a read-only transaction ending in rollback; it assumes the complete current schema. On an older/incomplete schema, stop and reconcile drift rather than modifying data to make the inventory query pass. SQL policy/grant text and outputs still require restricted handling and review before sharing.
4. Classify actual users, balances, orders, fiscal references, branches, menu, images, roles/cashiers, integrations and historical demos. Historical migrations contain seeded New York branches, sample menu/customisations and stock photos. They remain intact to preserve migration history and existing relationships. Neither matching a name/UUID nor being listed in an old demo migration authorises deletion or repurposing of a referenced live record.
5. Establish exact UUID mappings against that inventory. Shared catalogue/reward definitions need identical mappings/content; new immutable rules/offers need new versions. Compare every existing mapping and plan its preservation or separately approved change. Never execute the synthetic test fixture against an actual project.
6. Reconcile historical openings account by account with finance, document exceptions, freeze/cutoff and exact source/preserved totals, then rehearse the controlled import/review on the clone. The intake checks only declared aggregates and requires zero unresolved declared exceptions; it does not import points or prove those declarations. Preserve receipts, held points, debt and fiscal references.
7. Have named approvers verify the exact candidate digest and evidence. Rehearse any separately prepared configuration changes while activation remains disabled. Stage real API/till/device/concurrency tests before an independent approved release enables service.

## Verification

The complete suite has **353 passing tests**, adding **31 intake/CLI/database cases** to the 322-test offline checkpoint. TypeScript, lint, migration-derived type drift, SDK/peer checks and the committed-template check pass. Tests cover blocked unconfirmed inputs, approval/source digest behavior, role attribution, environment isolation, exact money, source/identity mappings, immutable versions, modifier/zone integrity, unsupported scope, opening totals, pilot isolation, duplicate global definitions, redacted errors, private/exclusive file output, safe disabled proposals and actual local-schema inserts. The read-only inventory also runs without changing the fixture database.

The database test applies only generated **synthetic new rows** to local PGlite as test setup. The shipped CLI has no database connection/executor and applies nothing. These cases do not demonstrate real account ownership, written approval authenticity, actual financial correctness or compatibility with the hosted deployment. There are no mobile runtime/native dependency changes in this increment, so the preceding Android/iOS bundle and native gates remain at their recorded checkpoint.

## Inputs still needed to close this milestone

| Owner | Required evidence | Questionnaire references |
| --- | --- | --- |
| Sponsor/coordinator | Legal entity, named approvers/deputies, pilot, platform scope and release/support ownership | B01–B08, R01–R09 |
| IT/account owner | Owned repo/cloud/store/domain/mail/maps/monitoring inventory, signing/listing continuity, staged and production project identifiers, recovery/billing responsibilities and authorised clone/inventory access | T01–T11 |
| Operations/brand | Three branch sheets, catalogue/modifiers/allergens/licensed images, hours/phones/capacity, delivery boundaries/fees and collection/cash/outage procedures | BR01–BR12, M01–M07, O01–O08 |
| Finance/GAAP | Currency/inclusive pricing/refund/cutoff and report examples, real sale/reward/refund/fiscal evidence and approved manual bridge or a separately implemented verified integration | F01–F07, G01–G06 |
| Finance/programme | Rates/terms/offers/stock/expiry decisions, historical source classification, per-account exceptions and signed cutoff/opening totals | L01–L08, T09–T10 |
| Operations/IT/finance | Restricted verified staff/administrator/cashier roster, role/action limits, independent reviewers and controlled recovery | A01–A07, F04 |
| Privacy owner | Named owner/authority and approved handling of restricted intake/inventory/source evidence; full policy/erasure work continues in milestone 3 | P01–P08 |

Until those inputs are verified, the milestone remains **in progress with client dependencies**, not complete. Independent later engineering work can proceed when authorised; the missing decisions cannot be filled by fixture data or automatically inferred from the current development account.
