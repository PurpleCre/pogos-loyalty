# Pogo’s × GAAP integration meeting pack

Prepared: 3 November 2026. Meeting date and attendees: to confirm.

**Meeting objective:** agree a supported integration route for Pogo’s installed systems, obtain the technical material and test access, and assign owners/dates for proving the cash-ordering and loyalty workflows. A capability discussed in the meeting remains unconfirmed until the relevant version, evidence and commercial conditions are recorded.

**Confirmed project requirement:** retain the ordering and loyalty systems built into Pogo’s app and connect both to GAAP. The app’s loyalty ledger remains authoritative for points, holds, earning, redemption and reversals. The meeting must establish how GAAP supports that external loyalty system; adopting GAAP Rewards as a replacement is not the requested scope. Pogo’s programme rules, vendor capability and production activation still require their existing approvals.

## 1. Opening brief to share with GAAP

> Pogo’s operates three active Zimbabwe branches: Msasa, Kamfinsa and Westgate. We have built our own ordering and loyalty systems into the app and need to connect both to GAAP. Our loyalty ledger will continue to own points, earning, reservations, redemptions and reversals. The first release covers collection/delivery with cash payment; digital payments follow later.
>
> We need to establish which supported GAAP interfaces are available on the installed systems for order submission, menu/modifier/pricing information, sale/payment/refund events, external loyalty-member identification, reward fulfilment and reconciliation. Please demonstrate how a third-party loyalty system can participate at the till, including any balance/eligibility queries and redemption authorisation, without creating a second independently writable points balance. Please distinguish facilities available to our custom app from those limited to GAAP’s own applications or existing certified partners.
>
> Please include an integration engineer familiar with the Zimbabwe installations and the relevant reseller/support team. We would like a technical walkthrough, redacted sale/refund/reward examples, interface documentation, sandbox arrangements, licensing/certification requirements, a complete cost proposal and named implementation/support owners.

GAAP publicly describes third-party e-commerce and loyalty integrations and describes POS connections to ordering and rewards solutions. These establish a useful starting point for discussion, **not confirmation of access, APIs, installed-version compatibility or licensing for Pogo’s custom app**. [GAAP third-party integrations](https://gaap.co.za/3rd-party-integration/), [GAAP POS overview](https://gaap.co.za/point-of-sale/).

**Current engineering position:** cash-order, fulfilment, refund and loyalty-ledger workflows are implemented and tested locally. Actual GAAP interoperability and real till reconciliation are unverified. Automatic GAAP ingestion is disabled; the legacy transaction processor is also blocked from service execution. Names such as “Unity,” the example webhook payload and assumed signature headers in the repository are provisional. They must not be presented as GAAP’s agreed contract or as a live integration.

### The two connections we need

This is the required integration boundary for vendor discovery; the GAAP-facing adapter is not yet verified or activated.

| Connection | Required flow | Authority / acceptance condition |
| --- | --- | --- |
| App ordering → GAAP | App order/reference, branch, items/modifiers, agreed prices, collection/delivery details and unpaid cash status reach the supported POS/kitchen route | Recover the same GAAP order after a timeout; no duplicate order or kitchen ticket |
| GAAP → app ordering | Supported acknowledgements, rejection/status updates, sale/payment/refund identities and reconciliation data return through the adapter | Map actual GAAP states and references to the app; preserve customer payment versus till cash settlement |
| GAAP sale → our loyalty | A verified paid sale is correlated to a verified app member and processed through our ledger’s earning rules | One earning per canonical sale across app and in-store channels; the adapter cannot blindly award again for an already-earned app sale |
| Our loyalty → GAAP reward fulfilment | An app-authorised reservation/redemption is associated with the supported GAAP reward item/tender/document workflow; the fulfilment result returns to our app | Our ledger validates/reserves points and commits or releases the hold through trusted commands; GAAP cannot independently adjust our balance |
| GAAP refund/correction → our loyalty | A verified credit note/correction links to the original sale or reward and triggers the appropriate app-ledger reversal/release workflow | One traceable reversal; no duplicate effect, guessed member match or silent balance overwrite |

Agree the exact timing and supported mechanisms with GAAP. Current app rewards involve a branch claim and confirmed physical handover; integration must preserve those controls. If GAAP offers a balance display or eligibility lookup, it must read our authority through a protected interface. Offline redemption cannot be approved from an independently spendable stale copy of the balance.

## 2. Prepare before the meeting

Bring Pogo’s decision-maker, a branch operations representative, finance/reconciliation owner and our technical lead. Ask GAAP to bring its integration engineer and the person responsible for the installed systems. Commercial and privacy questions can have named follow-up owners if the relevant specialists cannot attend.

Prepare these materials:

- A three-branch installation sheet: actual GAAP product/version/build, branch/store codes, till identifiers, licence/modules, reseller, cloud/on-premise arrangement, kitchen printer/display setup and typical internet/power interruptions. Leave unknown entries blank.
- A short **synthetic-data** app walkthrough: collection order with a modifier, delivery cash collection, loyalty earning, standalone reward collection, a full refund and finance reconciliation. Explain where the implemented workflow requires staff to supply the GAAP reference manually.
- Redacted actual GAAP examples supplied by Pogo’s: one sale, one refund/credit note, one end-of-shift/day report, and any existing reward transaction. Preserve identifier structure, item/modifier codes, currency, tax fields and timestamps; remove customer contacts and credentials.
- Proposed business rules for discussion: accepted currencies, earn timing and exclusions, refund authority, reward items, delivery cash custody and reporting cut-offs. These are client decisions still requiring approval.
- This pack, the [client information request](client-information-request.md) and a place to record answers, documentary evidence, owners and dates. Use restricted channels for any later credentials or real customer records.

No production key, customer database, direct database login or real unapproved transaction is needed for this first meeting. Do not register the current development webhook as a production endpoint.

## 3. Suggested 60-minute agenda

| Time | Discussion | Required outcome |
| --- | --- | --- |
| 0–5 min | Pogo’s three-branch, cash-first scope and launch priorities | Shared scope; digital payments kept for the later release |
| 5–15 min | Installed versions, topology and supported custom-app interfaces | Version/branch capability list and route options |
| 15–30 min | Walk through an order, cash sale, refund and standalone reward | Actual document/tender/state behavior and identifiable gaps |
| 30–45 min | Interface contract, connection to our loyalty ledger, member mapping, retries, outages and security | Documentation/sample requests and technical follow-up list |
| 45–55 min | Sandbox, certification, fees, support and pilot | Named technical/commercial owners and dates |
| 55–60 min | Read back decisions and unresolved items | Written actions and next technical session |

If a demonstration needs more time, arrange a dedicated working session rather than accepting an unsupported verbal assurance.

## 4. Ten questions that must be answered

1. **What is installed at each branch?** Confirm exact product/build, licensed modules, whether an upgrade or branch connector is needed, and support responsibility in Zimbabwe. Do not assume all three branches have identical capabilities.
2. **Can both our ordering system and our existing loyalty ledger integrate, and through which supported route?** Direct documented interface, certified connector/partner, or another vendor-supported mechanism? Which partner agreements, certifications or modules are required? Identify any restriction that only permits GAAP-owned applications; that restriction is a gap against our custom-system requirement.
3. **What can be read and written?** Ask separately about menu/modifiers, branch/channel prices, availability, unpaid orders, kitchen routing, acceptance/status changes, payment completion, cancellation, sale/refund history and reward transactions. “There is an API” is insufficient; request the operation list and versioned specification.
4. **Can our order reference survive the entire process?** Can GAAP store and return an external order UUID? Can we look up a submission after a timeout before sending it again? What stable identifier distinguishes a transaction across branch, till/device, business date, document type and reprints?
5. **How does cash on delivery work?** Demonstrate an unpaid order entering the POS, customer cash collection by a delivery collector, and later collector-to-cashier settlement. Which tender, debtor/clearing or cash-custody records represent each step? A customer payment and cash arriving in the till are different events.
6. **How does GAAP connect to our existing loyalty authority?** Can a cashier identify our member, query app-owned eligibility/balance where needed, request or reference an app-authorised reward, and return its fulfilment/correction result? Which callbacks/interfaces support reserve, redeem, commit, release and reversal? Are there existing points/vouchers to inventory and reconcile into an approved opening position in our system? If a route requires GAAP Rewards to own the balance, record it as an incompatibility and request an alternative supported route, rather than treating replacement as agreed scope.
7. **How are sales and refunds delivered to us?** Webhooks, polling, exports or a connector? Request guarantees and limits for event identity, ordering, duplicates, retry/replay, timestamps, delivery delay, refund-to-original-sale linkage, authentication and request verification. Do not assume the code’s current HMAC convention is supported.
8. **How do currencies, prices and fiscal documents behave?** Confirm the actual branch currencies/tender codes, taxes, inclusive pricing, rounding, modifiers/combos and delivery charges. Who issues each official document, when, and which original-sale/credit-note identifiers are exposed? Ask GAAP and Pogo’s finance/adviser to establish the applicable Zimbabwe process; do not infer it from a South African example.
9. **What happens when a till, branch connector or internet connection is unavailable?** Which operations queue, reject or continue? How do we recover after uncertain submission/payment results, catch up missed sales, avoid duplicate tickets/earning and reconcile late postings? What happens to reward redemption while the balance authority is unavailable?
10. **What is needed to prove and operate this?** Sandbox/test till, sample catalogue/data, credentials issued securely, commercial charges, certification criteria, supported versions, change notices, support/escalation contacts and dates. Require an itemised answer rather than only an estimate for “integration.”

For every technical answer record: **available / requires upgrade or module / requires development / unavailable / unknown**, with the branch/version, documentation reference, named owner and follow-up date.

## 5. Proposed responsibility split to discuss

App ownership of ordering and loyalty is the confirmed project direction. The following GAAP interfaces and operational mappings still need vendor confirmation and Pogo’s business approval.

| Area | Proposed position / decision needed |
| --- | --- |
| App order identity | App creates a durable order UUID; GAAP stores/returns it with its own stable transaction identity. A lost acknowledgement must be recoverable by lookup. |
| Menu, modifiers and prices | Choose one approved master and document branch/channel overrides. GAAP is a candidate master; the current app uses an approved local catalogue/quote engine. Decide how rejected or changed POS prices are resolved before a customer is charged; do not silently alter a confirmed quote. |
| POS and fiscal documents | GAAP’s actual till/document process must be demonstrated. App cash receipts currently record operational attestations; they are not independently verified GAAP/fiscal documents. |
| Customer payment and cash custody | App distinguishes customer payment, collector holding cash, cashier acceptance/settlement and till-funded refunds. Agree the matching GAAP records without treating a delivery collector’s cash as already banked or deposited in the till. |
| Loyalty | Our existing app ledger remains the authority. Confirm supported external-loyalty hooks, member mapping and client programme approval. GAAP supplies verified transaction/fulfilment evidence and uses app-authorised reward decisions; it does not maintain an independent spendable balance. A route that requires replacing our ledger is a capability gap, not an approved design change. |
| In-store earning | Separate from earning on app cash orders. Identify the member and sale explicitly; establish one canonical paid-sale identity and one earning path across both channels. Unmatched or ambiguous events need review, not guessed phone/email matching. |
| Rewards | Current app supports one standalone benefit per reservation and a unique GAAP sale reference for its handover. It does not combine a reward and paid order, accept a cash top-up, deliver a reward, or apply a general basket discount. Ask GAAP to demonstrate the appropriate item/tender/accounting/fiscal treatment; zero customer cash does not establish zero tax or a particular document rule. |
| Stock | App reward allocations are separate from GAAP inventory. Decide whether supported availability/reservation interfaces can be added. Do not promise real-time shared stock from a menu export alone. |
| Reconciliation | Use app-linked sales/refunds/settlements, per branch and currency. Whole-till turnover includes other sales. Agree transaction timestamps, business-day/shift cut-offs and the distinction between sales date, cash collection date and cash settlement date. |
| Customer data and security | Use a verified opaque member-ID mapping where supported. Agree minimum fields, access/scopes, retention, hosting/subprocessors and deletion/export responsibilities with the client privacy owner. Integration secrets belong on the server, not in the mobile app. |

**Important earning question:** the implemented cash-completion command can award points when an approved earning rule is configured. A later GAAP notification of the same sale must reconcile with that effect rather than create a second earning. The future adapter must define this correlation explicitly; the legacy processor remains disabled.

## 6. Request a concrete technical handover

Ask GAAP for these deliverables, with owners and delivery dates:

- Versioned API/interface documentation and supported operation list; approved connector/deployment topology if relevant.
- An isolated sandbox/test till and the onboarding/certification process. Request credentials through the agreed secure channel, separately from ordinary meeting notes.
- Realistic redacted request/response/event examples: create/read order, finalised cash sale, cancellation, full refund, standalone reward and any reversal/correction.
- The identifier dictionary: company/branch, terminal/till, product/variant/modifier, customer/member, transaction/document, original sale, credit note, event ID, external order reference and timestamp/business date.
- Menu/price/availability export or supported read examples, including currency, tax/rounding and branch/channel-specific prices.
- The cash tender/custody and daily report examples that finance will use to reconcile app-linked activity.
- Authentication/verification specification, credential scopes and rotation, rate/payload limits, error codes, idempotency and lookup behavior, event retries/replay and version/change policy.
- Itemised commercial terms: setup/development, per-branch/till/API/module charges, certification, upgrades/connector hosting, support and renewals. Ask whether proposed fees/capabilities cover all three Zimbabwe branches.
- Named technical and support contacts, a pilot installation plan, expected dependencies and dates for the first successful sandbox transaction.

Requested identifiers describe the information needed, not mandatory field names. Request GAAP’s actual schema; do not hand over the repository’s guessed JSON as if it were an existing standard.

## 7. Acceptance scenarios for the follow-up working session

| Scenario | Evidence needed before accepting the integration |
| --- | --- |
| Collection order with modifier | Correct branch, item/modifier, price/currency, external reference and intended kitchen route; customer payment recorded only at the agreed stage |
| Delivery cash order | Unpaid-to-paid transition plus distinct collector/cashier settlement; failed delivery/cancellation behavior understood |
| Submission times out after GAAP accepted it | Lookup/retry recovers one order and one kitchen ticket; uncertain state is visible |
| Duplicate or delayed sale event | One earning, with stable identity; event delay or replay does not create another sale/award |
| Full refund | Original-sale link, unique credit note, original currency, correct cash movement and one loyalty reversal; treatment of already-spent points agreed |
| Standalone reward | Customer mapping, one hold and handover, appropriate GAAP document/treatment, one redemption and a controlled correction path |
| Wrong branch, unknown SKU or changed price | Explicit rejection/review; no silent substitution, cross-branch posting or invented customer matching |
| Till/connector/internet outage | Agreed queue/reject/recovery behavior, missed-event catch-up and prevention of blind duplicate retries |
| End-of-day reconciliation | App-linked sales, refunds, cash custody/settlement and rewards reconcile to the correct GAAP subset and cut-off, independently for each approved currency |

Current app cash refunds are **full, till-funded refunds**. If GAAP/Pogo’s require partial refunds, split tenders, mixed paid/reward baskets or other launch-critical behavior, record an explicit scope/implementation change.

## 8. Choose a route and leave with actions

| Route | When it is a candidate | Required proof |
| --- | --- | --- |
| Direct supported integration | Installed versions expose the required ordering operations and support our external loyalty authority | Written interface/version/access confirmation; both ordering and app-owned loyalty sandbox workflows pass; supported pricing and exception handling |
| GAAP-approved connector/partner | An intermediary supports both our ordering system and our loyalty ledger without replacing them | Named supported partner, end-to-end contract, data/security responsibilities, operational support and itemised costs |
| Audited manual till bridge for launch | Automation would delay launch and Pogo’s operations/finance approve a workable alternative | Staff enter the app reference into GAAP and capture the unique GAAP document reference in the app; cash/rewards/refunds are rehearsed and reconciled daily, with exception owners and workable volume limits |

A manual bridge is not automatically acceptable because the app has a receipt field. If GAAP cannot preserve a usable cross-reference, issue the necessary documents, support the reward/cash procedure or produce the required reconciliation evidence, it remains an unresolved launch dependency. Automatic in-store earning stays disabled until its own evidence exists.

Fill this in before ending the call:

| Decision/action | Answer / evidence reference | Owner | Due date |
| --- | --- | --- | --- |
| Product/version/modules per branch | Unconfirmed | | |
| Supported custom-app route and limitations | Unconfirmed | | |
| Existing app loyalty ledger remains authoritative | Confirmed project requirement; GAAP support mechanism unconfirmed | | |
| Ordering interface and external loyalty/member/redemption hooks | Unconfirmed; both connections required | | |
| Cash-on-delivery and fiscal/document workflow | Unconfirmed | | |
| Documentation, samples and sandbox access | Pending | | |
| Costs, certification and support terms | Unconfirmed | | |
| Pilot branch and sandbox success criteria | Unconfirmed; client to approve | | |
| Manual bridge decision if automation is delayed | Unconfirmed; operations/finance to approve | | |
| Follow-up engineering session and unresolved questions | To schedule | | |

After the meeting, reconcile the written answers with the application model, classify any scope changes, and schedule the sandbox proof before committing to production integration dates. No vendor has been contacted and no integration or account setting changed while preparing this pack.
