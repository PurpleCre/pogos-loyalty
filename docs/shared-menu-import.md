# Shared Pogo’s menu — development import

Completed and verified: **4 November 2026**. Connected development project: `hsyibcyvujwwqygigepe`. Staging and production ownership remain unconfirmed.

## Confirmed scope and source

The user instructed us to replace existing orders/menu, confirmed that **Msasa, Kamfinsa and Westgate share one menu**, and selected the **displayed SadieXpress USD prices**. Hawaiian Pizza is **USD 8.96**; the Large modifier adds **USD 3.36**. The source’s differently valued `originalPrice` is not used.

The frozen [capture pack](../client-materials/pogos-sadiexpress-2026-11-04/README.md) records the public Pogo’s listing at <https://delivery.sadiexpress.com/en/harare/vendor/1067>, its items, dialogs, options and image hashes. The development import is [versioned separately](../config/pogos-menu-2026-11-04.json); SHA-256: `071b27fd877ef7bfa6040f4dfb869c35fefb1a842ca18634425e3b0edb875979`. This is a snapshot import. The app does not call SadieXpress, receive orders from it or use its CDN at runtime.

## Applied changes

| Data | Before | Verified after |
| --- | ---: | ---: |
| Orders | 9 | 0 |
| Order lines | 11 | 0 |
| Menu categories | 9 | 9 |
| Menu products | 15 | 51 |
| Item-specific modifier groups | 4 | 18 |
| Item-specific modifier choices | 13 | 60 |
| Available products | — | 47 |
| Product photo assignments | — | 44 |
| Hosted images including logo/header | — | 46 |

The nine removed orders were legacy records without governed cash/payment or linked loyalty evidence. The operation preserved all **62 unrelated public tables at the canonical row-content level**, including the two loyalty accounts and opening ledger entries, existing points, three unlinked historical transactions, profiles, rewards, financial audit tables and release settings. No immutable financial trigger was disabled. Existing order quotes and branch stock overrides were empty.

All 51 products have `store_id = NULL`, so all three branches use the same definitions, IDs, prices and choices. Deterministic IDs preserve source-to-app mappings. Branch overrides remain available for future stock management.

Four captured products remain unavailable: Regular Coleslaw, Large Coleslaw, Mexican Salad and Strawberry Cheesecake. They are loaded for administrators but omitted from the customer menu until availability is confirmed. Seven products have no source photo and use the app’s neutral fallback: Mediterranean Pizza, Pogo Dew Pizza (Tweaked), Chicken Bites, Tandoori Wrapper, Hawaiian Wrapper, Chicken Bites Meal Deal and Malva Pudding. No substitute food photos were invented.

The public `pogos-menu` storage bucket contains immutable, versioned WebP copies. Every hosted file was downloaded anonymously and checked against its captured SHA-256 hash. The captured logo and header are also bundled locally. `expo-image` provides WebP rendering, caching and failed-image fallback in the customer/admin/staff views. A matching native build is required; an OTA alone cannot install this new native module.

Existing Msasa/Kamfinsa IDs, addresses, coordinates and open flags were preserved. Westgate was absent and now has ID `8882edb2-92bf-5751-904c-cc8b4e7e2a1a`, blank address, null map coordinates and `is_open = false` until its operating setup is confirmed. Its menu can still be browsed. Two previously quarantined “Pogo’s Closed Branch” fixture rows remain preserved and are excluded from the customer branch query. All three confirmed branches use the captured header image.

Two reviewed migrations were applied through the linked Supabase CLI: `20261103060000_integrity_query_cost.sql` and `20261104000000_catalogue_sort_order.sql`. The latter adds product ordering and its index; reusable migrations do not reset data. The Supabase CLI calls this project’s default database branch “production”; the application’s explicit environment binding and the user’s authorisation designate this account/project for **development only**. No staging/production binding was created or changed.

## Verification

- `npm run check`: **492 tests pass**, plus TypeScript, lint, generated-type consistency, SDK/peer, intake-template and disabled monitoring-policy checks. Eight new catalogue cases exercise exact money, stable mappings, image hashes, transactional replacement, preservation, linked-ledger/audit refusal, stale-backup/replay fencing and identical USD 12.32 Large Hawaiian quotes at three synthetic branches.
- `npm run menu:verify:development`: anonymous PostgREST reads confirm **nine categories and 47 available products at each branch**, including exact nested modifier prices/IDs, sorting, shared scope and no branch stock overrides. Anonymous downloads verify all **46 hosted images**. This command uses no service-role or management credential.
- `npm run build:check`: fresh Android/iOS Hermes exports and source-map checks pass. `npm run native:preflight`: both native projects generate successfully. These do not compile/sign an app or establish physical-device acceptance.
- `npm run security:audit`: **zero high/critical/low findings; 17 moderate findings remain**. Passing the audit’s high/critical gate does not establish production readiness.
- The current real PostgreSQL concurrency rerun could not start because Docker is stopped/inaccessible. Its earlier 13-case result is historical, not a new pass for this change. Fresh local PGlite migration replay and the actual development import/API checks above passed.

Private backup, SQL, upload manifest and database verification are in ignored `.local/menu-replacement/2026-11-04T04-58-07.924Z-65755b19-1766-40d8-bd4e-42ef70b5ba90/`. The backup contains order/customer data and uses private file permissions; do not commit or share it in a client pack. Public-route acceptance is recorded in `.local/menu-replacement/public-verification.json`. Routine check/export logs are ignored `.local/menu-*.log` files.

## Operator procedure

```sh
# Read-only current-data backup and SQL proposal; no upload or database writes.
npm run menu:plan:development

# Read-only verification of the completed import through public app routes.
npm run menu:verify:development
```

`npm run menu:replace:development` is the **destructive, explicitly authorised development reset** used for this task. It is not setup, a recurring sync or a routine verification command. Do not repeat it merely to refresh images. It checks the fixed development binding, saves a fresh private backup/SQL, verifies captured assets, uploads immutable objects, then locks and compares the inventoried public tables before a single transactional replacement. Governed cash/order/menu history or linked loyalty/notification/fiscal evidence stops the reset. Canonical fingerprints fence intervening writes and replay of a previously generated SQL plan. All unrelated row content must still match before commit.

The operator requires a Supabase management token and matching server storage credential in its existing private environment; neither is exposed to the mobile app or verification output. There is no automatic mutation retry. After a timeout or lost response, inspect the database and saved evidence before considering another reset. Backup restoration requires a reviewed recovery plan against any subsequent activity; never overwrite newer financial or customer history with this snapshot.

## Still required before release

Confirm the four unavailable items, seven missing photos, ingredient/allergen wording, rights to publish the captured assets, GAAP product/tax mappings, tax-inclusive pricing/fees, branch details/hours and ongoing menu ownership. The shared-menu and displayed-price decisions are now recorded; they do not approve loyalty rules, delivery zones, cashiers, retention policy or release ownership. Westgate’s address/maps/hours remain unconfirmed. Checkout/rewards/dispatch/monitoring were not activated, no real order or earning was created for verification, and no app/OTA was published. Existing persisted carts may contain retired product IDs; the fresh server quote continues to reject invalid selections.

**Milestone 2 and milestone 5 remain open; the six remaining delivery groups are unchanged.** This task completes the requested development menu replacement, not production acceptance.
