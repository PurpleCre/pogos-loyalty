# Cash checkout milestone

Updated: 30 October 2026. Scope: local server-priced quotation and transactional cash-order creation for Pogo’s Msasa, Kamfinsa and Westgate. This is an implementation increment, not permission to activate production ordering.

## Foundation milestone verification

Before starting this increment, `npm run check` was rerun against the committed foundation: TypeScript and lint passed, all 28 existing tests passed, and generated types matched the local migration catalogue. The original checks remain in the combined regression suite. Android export was also rerun after integration of checkout.

The foundation/security increment is complete within its documented local scope. This does not mark the broader platform phase complete: live-project inventory, hosted CI execution, schema upgrade rehearsal, native SDK/dependency remediation, real-device checks and Edge Function runtime verification remain open production gates. No live Supabase project, merchant account or app release was modified.

## Implemented checkout acceptance criteria

| Criterion | Implementation and evidence |
| --- | --- |
| Prices come from the server | `quote_cash_order` accepts IDs/quantities/choice IDs only; it rejects injected price/total fields and resolves catalogue prices and zone fees using exact integer minor units |
| Branch and meal eligibility | Only open, explicitly enabled branches with approved pricing can quote; wrong-branch items, inactive categories, stockouts, missing required choices, duplicates and excess choices are rejected |
| Collection and delivery | Customer name/phone are required; delivery requires a written address and pin inside an active branch polygon; the server chooses the configured fee by zone priority |
| Customer reviews a fixed total | Five-minute quotes contain currency, line/modifier prices, fees, contact, address and branch snapshots; prices/fees are honoured within that window, while pauses, currency changes, stock and choice eligibility are rechecked |
| Atomic creation | One PostgreSQL function writes the order, all item/modifier snapshots, first status event and quote consumption. An injected failure on a second line proves that no partial order survives |
| Safe retries | Customer-scoped submission keys, transaction locks and uniqueness guards return one order for repeated requests; another quote cannot reuse a key, and consuming the same quote cannot create another order |
| Interrupted submission recovery | The app saves the quote/key before the first submit; restarting can resolve the same request even with an empty cart. Network/auth ambiguity preserves the checkpoint; confirmed success remains visible if cleanup fails |
| Account separation | API calls pin the initiating account’s session; switching accounts cannot consume another customer’s quote or adopt their pending order/cart. Guest meal selections can be carried into sign-in |
| Correct customisations | Each unique combination is a separate cart line; identical variants merge. Server snapshots preserve meal and option names/prices after catalogue edits |
| Cash remains unpaid | Creation sets `payment_method=cash`, `payment_status=unpaid`, `status=pending`, and zero earned points. No purchase transaction or points credit is created |
| Reads show authoritative records | Order receipt reloads the saved order, customer details and item snapshots. Staff views show immutable choices and delivery/contact fields; fake driver details and fixed ETA claims were removed from tracking |
| Unsafe direct writes stay denied | Existing order/financial table restrictions remain; only authenticated, identity-derived checkout commands create cash orders. Customers cannot edit quotes, branch settings or delivery fees |

Implementation files: `supabase/migrations/20261030000002_cash_checkout.sql`, `lib/cart.ts`, `lib/cash-checkout.ts`, `lib/cash-orders.ts`, the cart/menu/order screens, and the staff detail view.

## Verification

`npm run check` covers the original foundation suite plus SQL checkout, cart-variant and interrupted-submission regression tests. The combined suite has 67 passing tests, with zero TypeScript/lint errors and no generated-type drift. `npm run build:check` exports the Android Hermes bundle.

PGlite executes real PostgreSQL migrations/functions/permissions but serializes access to its local engine. The overlapping retry test verifies duplicate request handling and database uniqueness; it does not prove multi-session lock contention or production load behavior. Run concurrent-session tests against isolated full PostgreSQL/Supabase before release. React Native device flows, actual Supabase JWT/PostgREST behavior, iOS/native builds, recovery across device restarts and operational branch exercises remain acceptance gates.

PostgreSQL provides the transaction-scoped locks and native polygon/point containment used here. Zone polygons use `(longitude, latitude)` pairs for local service areas; this is coverage checking, not road routing or travel-time prediction. [PostgreSQL locking](https://www.postgresql.org/docs/current/explicit-locking.html), [geometric operators](https://www.postgresql.org/docs/current/functions-geometry.html).

## Branch activation and operating constraints

The migration creates **no enabled branch settings and no delivery zones**. Names alone do not establish branch IDs, addresses, menus, currencies, fees or coverage. Follow the existing live-schema/upgrade prerequisites before applying the migration to any hosted project.

For each real branch, operations and finance must provide and approve:

1. Authoritative store ID, verified name/address/coordinates, catalogue and modifier records, opening/pausing procedure and contact details.
2. The currency in which that branch’s stored menu prices are denominated. Supported initial codes are USD and ZWG; there is no guessed FX conversion. Catalogue prices and delivery fees must represent the approved inclusive customer total. Fiscal/VAT responsibility remains with the approved GAAP/accounting process; the app does not invent a tax rate or issue a fiscal receipt.
3. Minimum subtotal, order-value cap, permitted collection/delivery modes, local service polygons, zone priority and fee in currency minor units.
4. Verified cash collection/refund/custody, handover, customer support, fiscal reference and GAAP receipt procedures, and staff capable of executing them.

Configure and validate `cash_order_settings` and `cash_delivery_zones` through a reviewed operator migration/process in staging. Their table writes are unavailable to customers and ordinary app staff. Set `pricing_approved` and `enabled` only after business data, the remaining fulfilment/cash workflow and operational tests are ready. Enabling one branch must not implicitly enable another. Pausing branch intake immediately rejects new quotes and unsubmitted quotes; already-created orders remain recoverable by their original references.

Quotes reject more than 50 lines or more than 99 units per line; a technical maximum of 100,000,000 minor units bounds an order. Finance/operations may configure a lower maximum and appropriate minimum. These are implementation safety limits, not approved trading policy. Quote cleanup, intake/rate limits and capacity policies belong to operational hardening before activation.

## Next implementation boundary

Trusted staff state transitions, acceptance expiry, delivery assignment/handover, cash receipt and custody, fiscal receipt references, cancellations/refunds, and the audited loyalty ledger are **not** implemented by this increment. New cash orders remain pending/unpaid; staff update buttons are disabled for them until those commands exist. The branch must not accept real app orders before that workflow passes its gate.

Continue with branch-scoped staff/cash handling and auditable events, then paid-and-completed earning, reward reservation/fulfilment and reversals. Gifting, QR claims, automatic GAAP linking/ingestion and digital payments remain disabled or deferred as documented in the production plan.
