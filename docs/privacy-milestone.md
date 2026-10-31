# Privacy request, export and consent increment

Updated: 31 October 2026. **Implemented and verified locally; policy/retention approval, actual erasure execution and hosted/native acceptance remain open.** This is not a completed production privacy gate.

## Previous milestone verification

The identity increment was rechecked before advancing: all **181** existing tests, TypeScript, lint, generated schema types, SDK compatibility and strict installed-peer checks passed. Both native exports and temporary project generation passed. Its hosted Auth/PostgREST/Deno, physical-device, owner and granular manager/finance gates remain open.

The follow-on review found and corrected a logout cleanup gap: clearing the session reference before the sign-out event could leave the departing account’s address cache. Cleanup now captures the owner first and attempts every owned cache removal. Ordinary logout preserves durable financial recovery identities; completed deletion removes those checkpoints too. Failures are surfaced instead of claiming confirmed cleanup. New regression tests cover these distinctions and another account’s isolation.

## What changed

- **Account controls:** Profile → Privacy, account export and deletion. Password reauthentication uses the same account; enrolled MFA is required too. Users can prepare a JSON export, explicitly opt in/out of marketing, submit/cancel deletion before processing and read public status updates.
- **Public resources:** `/privacy-policy` and `/account-deletion` routes plus standalone HTML page previews. The confirmed temporary contact is **pgonese6@gmail.com**. No controller identity, legal basis, retention period, response deadline or approval was invented. The full notice is visibly unavailable until approved.
- **Exports:** 25 whitelisted sections, owned server-side cursors, restart recovery, exact large-balance strings and bounded device collection. Auth/MFA/QR/push credentials, integration configuration, raw vendor payloads, internal notes and other people’s contacts are excluded. The controller offers no partial file after a paging, size, transport or account-switch failure. Native temporary files and browser object URLs are cleaned up; user-saved external copies remain under the user’s control.
- **Consent:** separate, default-off email marketing with versioned notice acknowledgement, verified email, append-only evidence and withdrawal. Old command retries cannot restore later-withdrawn consent. The recipient API excludes stale-version opt-ins and processing/deleted accounts.
- **Deletion workflow:** recent password AMR plus MFA where required; durable requests even when blocked; explicit reviewer assignment with administrator MFA; versioned review/start/pause/resume; trading/reward/staff/cash checks; system tasks and server-only completion evidence. Changed policies invalidate old task evidence. Starting processing freezes new customer trading commands and direct application writes; completed requests create a stale-token access boundary.
- **Inventory and minimisation:** all **57** local public tables and their fields are classified in `config/privacy-data-map.json`, with Auth/device/vendor stores recorded separately. Tests detect inventory drift. Error logging uses bounded machine codes; telemetry excludes private payload/context fields and auth URL parameters.
- **Vendor boundaries:** legacy marketing delivery and AI support are disabled by default pending their separate delivery/privacy controls. No email, AI request, account deletion or vendor operation was performed.

The migration is `20261031000002_privacy_lifecycle.sql`. It seeds only the user-approved temporary contact; no policy, retention approval, reviewer assignment or processing activation is seeded. The workflow never silently cascades financial/fiscal records away.

## Acceptance evidence

The combined suite contains **214 passing tests**. Added cases exercise recent-password versus refresh claims, enrolled/privileged MFA, account-bound requests, stable retries, pagination/completion/restart, precision, real secret/payload exclusion, ordinary versus deletion cleanup, telemetry minimisation, active trading and staff blockers, reviewer segregation, pause/resume and policy changes, six-system evidence, immutable audit, queue timestamp ties, static-page escaping and release blocking. Approved-erasure tests simulate operator work in disposable PostgreSQL; they do not perform or prove a real provider erasure.

A representative local deletion-completion fixture retains its original cash receipt, sale reference, order amount, fiscal registry and points record while stale-token application access is denied. This demonstrates the orchestration/access boundary, not legal approval of those retained records.

TypeScript, lint, generated type drift, SDK and strict peer checks pass. Android/iOS Hermes exports and temporary native generation pass. Standalone public previews build without hosting or the native application. Changed Edge Functions passed TypeScript syntax validation; Deno execution remains untested on this host. All database tests use simulated Supabase roles/claims in PGlite and do not prove signed JWT, email, true concurrent Postgres or device behavior.

The fresh online audit reports **26 affected package entries: 1 low, 23 moderate, 2 high, zero critical**. The high entries remain Expo CLI and its Zod 3 dependency; they are an open security gate. The exports still reject those audited tooling roots if they enter the native module graph. No security exception was approved.

```sh
npm run check
npm run build:check
npm run native:preflight
npm run privacy:pages
```

## Public-page artifacts

`npm run privacy:pages` writes reviewable standalone pages to `dist/privacy-pages/privacy/index.html` and `dist/privacy-pages/account-deletion/index.html`. Draft pages use `noindex`; they do not pretend to be an approved policy. CI also prepares these previews as a separate artifact.

For a future reviewed release, `npm run privacy:pages -- --release --notice=/path/to/reviewed-notice.json` requires the approved notice record (version, controller, body, support email, approver/time and approval reference). This checks record presence/format; the responsible owner must verify the actual approval and hosted content. No real approved record was supplied or published. Full Expo web-app acceptance is separate from these standalone pages; no full web build is claimed here.

## Required activation work

Follow [the data-lifecycle inventory and operator runbook](privacy/data-lifecycle.md). In particular:

1. Confirm controller/approver, mailbox control and production contact, legal basis/retention/hosting/vendor decisions, and an owned public HTTPS origin.
2. Inventory the live project, buckets, logs, backups and historical vendor data; compare them with the local map and migration history. Rehearse the complete migration on an isolated representative copy.
3. Approve and rehearse the executable per-dataset erasure/minimisation procedure or worker. **This increment supplies request/export/consent orchestration and evidence checks, not an automatic erasure worker.** Keep processing disabled until the actual operation, retained-record deadlines and downstream/backup handling are approved and demonstrated.
4. Record approved immutable policy versions and named reviewers, coordinate active orders/rewards/staff responsibilities and cashier custody, then validate start/pause/resume, policy changes, external receipts and actual completion against full Supabase/Postgres.
5. Build/install the new FileSystem/Sharing runtime and test native/browser exports, storage failure, sharing cancellation, process kills, account switching, current/old JWT access and secure cache cleanup. Export/project generation does not compile or sign an app. Automatic development OTA and manual development/staging triggers remain enabled for matching runtimes.
6. Publish the approved public pages, exercise them without the installed app, verify mailbox operation and store metadata, then complete privacy/independent security acceptance. Broader granular permissions and the prior platform gates remain open.

No cloud migration, publication, mailbox configuration, customer communication or real data erasure was performed. The next independent implementation area is branch operational readiness: intake/availability controls, new-order alerts and reconnect/shift handling, while the sponsor resolves the privacy and hosted acceptance gates above.
