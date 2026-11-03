# Offline/lifecycle and launch experience milestone

Updated: 3 November 2026. Local implementation checkpoint for the cash-first release. Pogo’s visual/product approval and physical-device, hosted and busy-shift acceptance remain required before production.

## Starting evidence and scope

The finance checkpoint was reverified at 292 passing tests before this increment. This work changes client behavior, recovery coordination and device-storage handling. It adds no dependency, migration, live branch configuration or cloud activation. The inventory remains 67 public tables and account exports retain 29 sections.

## Delivered behavior

### Saved selections and interrupted checkout

Cart selections persist by account and environment, including the branch and modifier variant IDs. Saved records are validated and derived line IDs/subtotals are rebuilt. The stored prices are estimates; the server still resolves actual meals, options, availability, currency, fees and total in a fresh quotation. Existing signed-in selections take precedence over an in-memory visitor cart at sign-in. Visitor selections are removed only after any adopted copy has been durably saved; a failed handoff preserves the original for retry. Another customer’s cart is never promoted; ordinary logout removes the departing account’s stored selections while preserving financial command recovery.

Cart storage uses account leases and serialized writes. Switching accounts invalidates old work; cleanup waits behind an already-running save and then removes it. A queued old save cannot recreate the cart after cleanup. Corrupt/unreadable saved selections block editing/checkout until explicit replacement; failed saves expose a retry and block new quotation/placement. Replacing selections never clears a submitted order’s journal. Browser storage and native AsyncStorage are ordinary device data stores, not encrypted credential storage; no contact, delivery address, token or reward bearer claim is added to the cart record.

Confirmed checkout now retires the matching persisted cart **before** removing the recovery key. If cart retirement fails, the same submission key remains recoverable. A crash after retirement but before journal removal safely replays the original order. Branch and modifier/quantity fingerprints prevent a late confirmation from clearing newer selections, including identical universal meals selected at a different branch. The live in-memory cart uses the same guard. Unscoped old fingerprints do not automatically clear a new persisted cart.

Concurrent checkout starts in one app instance cannot overwrite a pending key. A stale UI recovery reference cannot replace a different saved reference. Existing backend idempotency remains the authority across devices. Financial writes are not auto-queued, replayed on reconnection or cancelled because the app backgrounds. A network/auth ambiguity keeps its journal for explicit checking; ordinary logout preserves it.

Quotes are tied to the current draft, foreground lifecycle, server expiry and a conservative five-minute monotonic limit. Backgrounding invalidates review; foregrounding checks pending recovery and requires another quote. A late quotation response from before background is rejected. Device clock rollback does not extend the quote. Actual server checks still decide whether submission is valid.

### Cached browsing and read freshness

Public branch/menu browsing can restore a validated saved snapshot. Cache keys include environment and branch; only whitelisted public catalogue/store fields persist. Privileged menu reads are not saved into the public cache. Snapshots older than 24 hours or dated in the future are not used. This is a technical browsing limit, not a legal retention policy or proof that expired files were erased.

A shared read controller handles menu, branch, order and points/history reads with bounded read waits, latest-response checks, scope disposal and foreground/browser-reconnect refresh. Requests stop polling in the background. Saved data starts unverified; connection/request failures leave an explicitly stale snapshot instead of silently reporting zero points or no orders. Permission/auth failures remove private snapshots. Slow cache hydration cannot overwrite a newer successful result or restore a denied private read. A backward clock invalidates freshness. The app describes request freshness, not a guessed global online state.

Customer orders and points/history remain in memory and are scoped to the account; they are not newly persisted for offline access. Status labels show when data was last refreshed. Recent point history is explicitly labelled as the latest ten entries. A successful read is evidence as of that refresh, not a guarantee that the network or the branch state has remained unchanged.

Reward worklists/points also refresh on foreground and invalidate old results on background or access failure. New reservation/operation commands require a recently verified snapshot; journal recovery remains available independently. The manager reward-worklist client guard now matches the existing server permission. Existing private reward tickets continue to clear on background and require server validation. Staff cash/branch safeguards, finance recovery and transactional push controls remain in effect.

Saved-address network writers now carry cleanup generations; a late pre-logout request cannot recreate a removed address cache. Known legacy account-specific achievement/referral caches are removed at logout without removing another account’s keys. Authenticated address saves require a successful server response rather than claiming that a failed save succeeded locally.

### Launch presentation and support

- The home and loyalty screens use the existing Pogo’s text/color treatment and confirmed Msasa, Kamfinsa and Westgate names. Stock hero imagery and unsupported earning/referral/gifting/achievement promotions are removed. Final artwork, brand specifications, meal content and product approval still come from Pogo’s.
- Receipt earning and point gifting remain disabled. Achievement/referral routes now display an unavailable message without executing their old cache/mutation hooks; the unused hooks and fake offline queue processor are removed. Native reward collection QR tickets remain part of the approved core workflow.
- Menu amounts are labelled estimates, with currency and the authoritative total confirmed at checkout. Missing meal descriptions are not replaced by fabricated product claims. Unavailable/inactive categories are excluded from customer browsing.
- Branch selection no longer invents delivery times or uses legacy distance defaults as actual customer distance. Where coordinates are present, distance is only approximate straight-line distance; delivery coverage/fees still come from the quote. Stale branch hours say they are unverified, and customers can browse reported-closed branches without implying that checkout is enabled.
- The map defaults to a Harare viewport, never an assumed customer address. A written address is required with a pin; placeholder/unknown addresses are removed. Denied location permission leaves manual pin/address selection available. Authenticated saved-address failure is visible. Offline map tiles/GPS availability and service coverage are not promised.
- Public `/support` explains order/reward recovery and links account requests. It uses **pgonese6@gmail.com** only as the confirmed temporary privacy contact. General support hours, branch phone numbers and response promises are not invented. Private order/history destinations ask visitors to sign in.

## Legacy queue handling

`offline_pending_actions` has no trustworthy owner, verified command identity or successful server receipt. The old code cleared it as though it had been processed. That processor is removed. An installation notice detects nonempty, malformed or oversized evidence and points to support without displaying its raw contents, replaying it or deleting it. An unknown queue remains preserved across logout.

Before enabling affected existing installations, an authorised operator must investigate the entries against real orders/points/cash and document resolution under the approved privacy/support procedure. Do not convert them into fresh financial requests or erase them to make a warning disappear. A missing or empty queue is not proof of delivery; confirmed server receipts and the modern per-account command journals remain authoritative. No automatic migration of these unknown actions was assumed.

## Local verification

The complete regression suite has **322 passing tests**, including **30 offline/lifecycle cases**. Coverage includes persisted variants, environment/owner isolation, corrupt records, queued writes and logout, late reads, storage retries, order response loss, cart retirement/journal ordering, changed branch selections, simultaneous checkout, stale UI checkpoints, read timeout/disposal/auth failures, late cache hydration, cache whitelisting/age, legacy preservation, quote expiry and address-cache resurrection prevention.

TypeScript, lint, generated-type drift, SDK and installed peer checks pass. Android/iOS Hermes bundle exports pass; all 25 checked runtime source files match both exported source maps. These test pure controllers/storage failures and the local SQL fixture; they do not execute React Native interactions, real OS process kills, signed builds, actual networks/GPS/sharing or true concurrent hosted PostgreSQL. The prior native project-generation check still applies to unchanged native dependencies/configuration; bundle export is not native compilation.

```sh
npm run check
npm run build:check
```

## Reverification — 3 November 2026

The review found and corrected three additional gaps: guest-cart cleanup ran before its owned replacement was durably saved; returning to a reward screen after an unsubscribed background/foreground cycle could leave refresh paused; and overlapping initial/foreground recovery reads could leave checkout loading. Cart restore now supports an explicit retry and copies before cleanup. Reward activation reads the current AppState and invalidates old freshness before refreshing. Recovery reads share a versioned loader that settles loading only for the latest live request.

Seven additional regressions cover failed/interrupted guest handoff, owned-cart priority/account changes, overlapping/stopped recovery reads and actual reward-hook callbacks under mocked AppState/API/effect scheduling. These hook tests do not replace React Native renderer or physical-device acceptance. The combined suite is now 322 tests, with 30 cases across the two lifecycle test files. No hosted state, role or publication changed during verification.

## Acceptance carried into the remaining milestones

1. Pogo’s must approve branding/copy, actual menu and branches, business/loyalty terms, support ownership and channels, and the target hardware/platform matrix. Client data and production ownership are the next delivery group; use the existing client information request.
2. On intended Android/iOS hardware, test cold launch with a saved cart; visitor sign-in and account changes; offline browsing with/without cache; airplane mode before/after quotation and during submission; kills before/after journal save, server commit, cart retirement and cleanup; storage failure/corruption; permission denial and inaccurate location. Reconcile every command to one real server result.
3. Exercise background/foreground and stale access for customer points/orders/rewards, staff cash/reward/branch operations, finance exports/recovery and notification taps. Include manager reward operations, multi-device edits, native deep links and revoked/processing/deleted accounts through real signed APIs. Verify shared-device cleanup, native/browser storage constraints and accessibility with screen readers/large text.
4. Inventory existing installations and their legacy queues/caches under an approved process. Confirm server evidence and minimise retained personal records without deleting unknown financial activity. Local cleanup is not forensic or backup erasure.
5. Complete the unchanged privacy/actual-erasure, hosted integration/till, security/performance/recovery, signed release/training and observed-pilot gates. Nothing in this increment enables real ordering, rewards, push dispatch, GAAP automation, marketing or publication.

Six delivery groups remain after this local implementation checkpoint; the device/product acceptance above is carried into those groups rather than marked complete. See the [readiness checkpoint](production-readiness-status.md).
