# Error-reporting safety and incident-response foundation

3 November 2026. **Local implementation slice of milestone 5; production monitoring, broader security/performance/recovery acceptance and the milestone remain open. Six delivery groups remain.** Client approvals and the GAAP ordering/external-loyalty contract are still pending. The app’s ordering system and loyalty ledger remain authoritative.

Follow-on: the [backend queue-health sprint](backend-health-sprint.md) subsequently adds a local service-only aggregate snapshot, evaluator and synthetic dashboard. The audit below records the earlier reporting-only checkpoint; deployed collectors, worker heartbeats, real dashboards/alerts and the broader milestone remain open.

## Completion audit — 3 November 2026

**Milestone 5 is not complete. The local JS error-reporting safety work and draft runbook preparation are complete and reverified.** No additional implementation defect was found within that bounded scope. The remaining milestone includes engineering work as well as client/provider approval and real operational acceptance.

| Requirement | Verification | Verdict |
| --- | --- | --- |
| Local regression and configuration gates | Fresh `npm run check`: 407 passed, zero failures/skips/cancellations; type/lint/schema/SDK/peer/template/monitoring checks pass | Pass |
| Error payload and SDK transport safeguards | The full run includes all 19 reporting cases, including late-added private fields/attachments and disabled/mismatched destinations through the installed core SDK | Pass locally |
| Native bundle inclusion | Existing successful Android/iOS Hermes export source maps match the current reporting module and app entrypoint | Pass; exports revalidated, not rebuilt |
| CI and inactive configuration | YAML parses; monitoring validation is required by `check`; OTA requires reusable checks and defaults reporting off; all three bindings remain null | Pass locally; hosted execution pending |
| Runbook preparation | Activation, required-signal matrix, assignment, containment, financial recovery/reconciliation and resumption procedures present; local links resolve | Draft complete; approval/drill pending |
| Backend metrics, dashboards and worker monitoring | Requirements documented; collector/heartbeat, dashboards and operational alert integration not implemented by this sprint | Open engineering work |
| Actual alerts, ownership, response targets and budgets | No provider activation or delivered/acknowledged/escalated incident evidence; owners and approvals remain unconfirmed | Open |
| Broader security, performance and recovery | Independent security/dependency review, representative load/soak/accessibility, hosted protection and backup/restore/cutover/incident exercises still required | Open |

The audit finished at **2026-11-03 17:34:55 UTC**. Ignored `dist/monitoring-acceptance/report.json` records the tested-source SHA-256 `3dfa0fb39e7c8a6f26c94b581d9a22fa77d758e382f2ab3b99d8836736eda8d5`, installed SDK versions and explicit `milestoneComplete: false` / `hostedAcceptance: false`. This is a local audit snapshot, not an installed monitoring service or a reusable live acceptance runner. `git diff --check` and the 49-task/12-column backlog structure pass. No code, deployment, provider or publication change was needed for this verification.

## Problem and resulting behavior

The earlier recursive telemetry scrubber removed known sensitive keys but retained arbitrary keys and URL paths. An address, customer/order identifier or unstructured contact text could survive under an unexpected field. Supplying a Sentry DSN also enabled reporting without an environment-specific destination binding. `sendDefaultPii=false` alone does not strip every application-supplied field or control every SDK payload type.

The new reporting policy reconstructs a small JS exception event from allowed fields, clears attachments and applies the same filtering at the last JS envelope boundary. Free-text messages, breadcrumbs, unknown fields and private source/URL paths no longer pass through. Data injected after the first event hook is filtered again before the SDK transport.

Reporting now needs **both** exact `EXPO_PUBLIC_ERROR_REPORTING_ENABLED=true` and an HTTPS SaaS DSN matching that environment’s configured origin/project ID. Project IDs must differ between development, staging and production. All three [bindings](../config/error-reporting.json) remain null; no reporting is activated. Invalid flags, unknown/unconfigured environments, malformed/foreign DSNs and shared projects fail closed. Configuration identifies a destination, not client ownership or privacy approval.

## Payload policy

| Allowed in a JS error | Removed or disabled |
| --- | --- |
| Valid SDK event ID and finite timestamp; error/fatal level | Customer/account/order IDs, route/transaction names, arbitrary tags and fingerprints |
| Known JS error class, with all exception text replaced by `[message omitted]` | Raw messages, custom exception names, logs, request/user/context/extra/thread/module payloads |
| At most three exceptions and 40 frames per exception | Unbounded/cyclic structures and unknown event fields |
| Canonical generated bundle basename, bounded line/column and boolean `in_app` | Filesystem prefixes, arbitrary filenames, URL host/path/query/fragment, functions, source snippets and local variables |
| Compiled environment, bounded app version, validated OTA update ID or `embedded`, fixed policy tag | Event-supplied release/environment/distribution and arbitrary SDK enrichments |
| Minimal envelope routing ID and `infer_ip=never` setting | Unknown envelope headers, trace context, attachments, feedback, session, replay, profile, log, metric and span items |

Native SDK/crash capture and automatic native initialization are disabled so a native report cannot bypass the JavaScript policy. Screenshot/view hierarchy, console logs, failed-request capture, auto sessions, breadcrumbs, replay, tracing/profile sampling and trace propagation are disabled or omitted. Only named error-handling integrations survive the SDK default list; future default collectors do not automatically gain access. This deliberately limits diagnosis detail. Actual native crash coverage, grouping, source-map usability, provider/network metadata handling and platform behavior still need acceptance; crash-free-session or performance monitoring is not supplied.

Sentry source/upload tokens remain server-side. No new native plugin, dependency, schema, permission, provider key or production destination was added. Existing unconfigured plugin upload behavior still requires reviewed source-map setup. Historical records, native caches and already-installed clients are not erased or remotely changed by this code.

The policy reflects the distinction between filtering an error and filtering other payloads: Sentry documents that attachments/replay need separate handling and that server-side filtering happens after transmission. See [Sentry’s explanation of data-scrubbing boundaries](https://www.sentry.help/en/articles/13964268-what-are-sentry-s-data-scrubbing-options). The implementation was checked against installed React Native SDK **8.28.0** and core SDK **10.75.2**; it does not depend on a guessed future API.

## Local checks

```sh
npm run monitoring:check
npm run check
npm run build:check
```

`monitoring:check` reads only the committed public destination file, validates its shape/isolation and prints configuration states without identifiers or credentials. No `.env`, target arguments, provider calls or activation are supported. It is included in the ordinary check command and therefore the reusable CI gate. The OTA workflow passes the environment’s optional public opt-in and defaults it to false; no OTA was published.

The full check passes **407 tests**, zero failures, with type/lint/schema/SDK/peer/client-template and monitoring-configuration gates. **19 new reporting cases** cover opt-in and isolation, DSN rejection, regional destinations, private-path/unknown-field leakage, bounded cyclic input, malformed events, secondary payload removal, metadata, integration filtering and actual installed core-SDK dispatch through an injected transport. The existing telemetry privacy regression now requires entire breadcrumbs/URLs to be removed.

The core-SDK tests exercise real event preparation, hooks, late-added scope data/attachments and transport submission. They use an in-process synthetic transport and make no provider request. They do not initialize the React Native SDK on a device or prove hosted ingestion/alerts. The prior 22 Deno and 13 real PostgreSQL scenarios are separate checkpoint evidence; their subjects did not change and those suites were not rerun here.

Android/iOS Hermes bundle exports and current-source-map identity checks verify native module resolution and inclusion of the new reporting policy. These are bundle checks, not signed builds or physical-device tests. Source uploads were disabled and no cloud setting changed.

## Operations delivered and outstanding

The [monitoring and incident runbook](operations-monitoring-runbook.md) supplies activation steps, a required-signal matrix and procedures for assignment, intake containment, durable command recovery, finance/GAAP reconciliation, isolated restore, resumption and review. It distinguishes missing observations from healthy service and keeps financial/customer evidence out of broad alert payloads.

**Local JS reporting safety and draft runbook preparation complete; milestone 5 remains in progress.** Still required:

1. Owned monitoring projects, privacy/region/retention/vendor approval, source-map/native startup acceptance and historical-record handling.
2. Named responders/deputies, coverage, approved thresholds/performance/recovery targets and budgets. No operating target is invented by this sprint.
3. Actual backend metrics, scheduler/collector freshness, dashboards, paging/budget alerts and proven receipt/acknowledgement/escalation. This code only hardens client JS errors; it does not monitor server workers or cash/loyalty invariants automatically.
4. Independent security/dependency review, realistic load/soak/accessibility testing, hosted CI/publication protection and an isolated representative backup/restore/cutover rehearsal with reconciled cash, GAAP and loyalty totals.
5. Actual incident exercises on the intended branches/devices and approval of the runbook. No messages, provider activation, schedule, live data, erasure, cloud deployment, native signing or publication occurred.
