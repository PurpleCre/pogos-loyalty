# Pogo’s Zimbabwe — Client Information and Approval Pack

**Project:** Ordering and loyalty application — cash-first launch  
**Prepared:** 31 October 2026 | **Updated:** 4 November 2026 | **Version:** 1.1

**Client coordinator:** ____________________ | **Date returned:** ____________________

## How to complete this pack

Please nominate one coordinator to collect answers from operations, finance, brand, IT and the person responsible for privacy. This pack covers information and approvals needed from Pogo’s; engineering remains responsible for implementation, technical testing and recording release evidence.

Answer using the reference numbers below, or provide an existing document and identify the relevant section. For an unknown answer, write **Unconfirmed**, name the person who will resolve it and give an expected response date. For an item that does not apply, explain why. Proposed rules need the named approver’s written acceptance before activation.

Use these priorities:

| Priority | When we need it |
| --- | --- |
| Start now | Needed to configure the product, settle scope or remove an external dependency. |
| Before pilot | Must be resolved before real customers use the first branch. |
| Before branch rollout | Must be verified separately before each additional branch is activated. |
| Later release | May remain deferred and disabled for the cash-first launch. |

Provide access through named account invitations or an agreed secure handover. Do not put passwords, API keys, recovery codes, payment details or unredacted customer records in this questionnaire. Redact customer/staff information in sample receipts and screenshots. Access to real data must have an agreed purpose, owner and transfer method.

## 1. What is already confirmed

These answers are carried forward from the project discussions. Please correct them only if they have changed.

| Item | Confirmed position |
| --- | --- |
| Customer | Pogo’s restaurant chain in Zimbabwe; contracting legal entity still to be supplied. |
| Active branches | Msasa, Kamfinsa and Westgate. |
| Shared menu and displayed prices | Confirmed by the user on 4 November: all three branches share the captured 51-item SadieXpress menu and its displayed USD prices. Imported into development; tax/fees, current stock, allergens, media rights and GAAP mappings still need review. |
| First release | Loyalty and ordering, with cash on collection/delivery. |
| POS vendor | GAAP; installed versions, capabilities and access remain to be verified. |
| Digital payments | Follow in a later release. |
| Launch priority | As soon as possible; no committed launch date or pilot branch yet. |
| Development accounts | Currently connected accounts may be used for development. Pogo’s staging/production ownership is unconfirmed. |
| Development updates | Automatic OTA updates after checks on pushes to main, plus manual trigger. Staging is a manual choice; production release authority remains to be agreed. |
| Privacy contact | pgonese6@gmail.com is the temporary contact. Confirm mailbox control and whether this will remain public. |
| Privacy and retention approval | Approver and rules are unconfirmed. Actual erasure remains gated on those decisions and a rehearsed procedure. |

## 2. Business ownership, contacts and launch decisions

**Priority: Start now. Suggested respondent: business sponsor / authorised representative.**

| Ref | Information or decision needed |
| --- | --- |
| B01 | Full registered legal entity name, registration details, registered address, approved trading name and relevant tax/fiscal registration details. Identify any different entities or franchise owners operating the branches. Supply documents through the agreed channel. |
| B02 | Name, role and business contact of the authorised sponsor; who may approve scope, spending, contracts, customer terms and go-live? Name a deputy. |
| B03 | Name the operations lead, finance approver, brand/menu approver, IT/account owner, privacy approver and launch/support lead. State if any position still needs to be assigned. |
| B04 | Preferred pilot branch and reasons: staff availability, hardware, connectivity, manageable demand and readiness. Which branch manager will own the pilot? |
| B05 | Any business deadline, blackout periods, campaigns or events affecting launch. Confirm budget ceiling, funded team availability and who approves recurring service costs. |
| B06 | Which customer platforms must launch first: Android, iOS or both? What devices will staff use? Is any browser-based staff operation required? Separate web ordering is a separate scope decision. |
| B07 | Confirm cash collection and cash delivery are available at each branch, whether any customer group is excluded, customer age eligibility and required languages. Email/password is the current implementation; flag any requirement for phone-only access. |
| B08 | Identify the official website, social accounts and public customer-support channels. Confirm which are owned by Pogo’s and may be linked in the app. |

### Contact register

| Responsibility | Name / role | Business email / phone | Deputy | Approval authority |
| --- | --- | --- | --- | --- |
| Sponsor / release authority | To supply | | | |
| Operations / pilot manager | To supply | | | |
| Finance / loyalty | To supply | | | |
| Brand / menu | To supply | | | |
| IT / service accounts | To supply | | | |
| GAAP vendor contact | To supply | | | |
| Privacy / legal | To supply | | | |
| Customer support / incidents | To supply | | | |

## 3. Branch information — complete for all three branches

**Priority: Start now; verify again before each branch rollout. Suggested respondent: branch managers / operations.**

Supply one branch sheet for **Msasa**, one for **Kamfinsa** and one for **Westgate**. Shared rules may refer to a common approved document; state every exception.

| Ref | Field | Branch answer |
| --- | --- | --- |
| BR01 | Branch name, operating legal entity and manager/deputy | |
| BR02 | Physical address, map pin/coordinates, entrance and collection instructions | |
| BR03 | Public order/support phone and internal escalation contact | |
| BR04 | Opening hours by day, public-holiday hours, collection/delivery cut-off times and after-hours handling | |
| BR05 | Collection and delivery services offered; expected preparation time and customer promise | |
| BR06 | Maximum orders per period, busy-period limits, pause/resume authority and stockout process | |
| BR07 | Staff devices: quantity, model, operating-system version, shared/personal ownership and charging location | |
| BR08 | Internet/Wi-Fi/mobile coverage, power reliability and backup connectivity/power | |
| BR09 | GAAP version, tills, printers, branch/store codes, support provider and fiscal equipment/process | |
| BR10 | Staff roster, cashiers/collectors, shifts, handover owner and training availability | |
| BR11 | Approved emergency/manual ordering procedure when a device, internet connection or till fails | |
| BR12 | Branch approver, evidence/document version and readiness target date | |

## 4. Menu, pricing and brand assets

**Priority: Start now. Suggested respondent: menu/brand owner, operations and finance.**

We have already captured the menu, options, logo and available product photos and applied the [shared development menu](shared-menu-import.md). Please review that material and provide corrections or remaining details rather than recreating it. Confirm the four source-unavailable products, supply the seven missing photos if available, and identify the effective date, responsible menu owner, tax treatment, GAAP codes, allergens and publication rights. The user’s shared-menu/displayed-price decision does not settle those remaining inputs.

| Ref | Information or decision needed |
| --- | --- |
| M01 | Shared menu is confirmed and the captured list is imported in development. Review its names/descriptions/portions, effective date and responsible owner; provide stable GAAP/SKU mappings and any corrections. |
| M02 | Displayed captured USD prices are selected for the app. Confirm tax inclusivity, packaging/service charges, promotion/combo treatment, effective date and who approves/publishes subsequent changes. |
| M03 | Sizes, variants and modifiers: required/optional choices, minimum/maximum selections, quantities, extra prices, unavailable combinations and special-instruction limits. |
| M04 | Item availability by branch, day/time and stock; stockout/substitution policy; whether a sold-out item may be substituted only after customer approval. |
| M05 | Ingredients, allergens, dietary claims, preparation/cross-contact notices and the person responsible for accuracy and updates. Supply approved wording. |
| M06 | Approved logos, app name, colours, fonts, menu/product photos and icons. Confirm ownership/licences, allowed uses, attribution and permission to publish. |
| M07 | Approved customer wording: ordering terms, collection/delivery expectations, cancellation/refund terms, loyalty terms and support messages. Identify the final copy approver. |

**Suggested menu spreadsheet columns:** Branch; category; SKU; item name; description; variant; currency; inclusive price; modifier group; option; option price; minimum/maximum choices; availability; allergens; image filename; effective date; approver. Include a mapping to GAAP item codes where available.

## 5. Collection, delivery and order handling

**Priority: Start now. Suggested respondent: operations / delivery lead.**

| Ref | Information or decision needed |
| --- | --- |
| O01 | Collection process: where customers collect, how staff identify an order, who confirms handover, collection time promises, late collection and no-show handling. |
| O02 | Delivery operator: Pogo’s employees, contractors or another provider; coverage maps/boundaries per branch, excluded areas, permitted overlaps and who assigns a branch. |
| O03 | Delivery fees by zone/currency, minimum/maximum order, free-delivery thresholds if any, permitted addresses, landmark/contact requirements and estimated delivery times. |
| O04 | Driver/collector assignment and reassignment; information a driver needs; departure/handover confirmation; proof of delivery and who can resolve an interrupted delivery. |
| O05 | Branch order-acknowledgement deadline, escalation if missed, automatic expiry expectations, capacity limits and who may pause intake. Define what happens to already accepted orders. |
| O06 | Rules for customer cancellation, staff rejection, stockouts after acceptance, incorrect orders, substitutions, unreachable customers and failed delivery. State who bears delivery charges and authorises exceptions. |
| O07 | Cash flow from customer to collector to cashier: tender/change, change float, two-person handover, evidence, unpaid/short/over payments, missing cash and shift-end custody. |
| O08 | Peak orders per hour/day and concurrent staff per branch; busiest periods; acceptable missed-alert escalation and whether staff devices must remain attended. |
| O09 | Existing order, delivery and shift checklists or anonymised sample forms. Name the owner who will rehearse the complete workflow on branch hardware. |

## 6. Finance, refunds and fiscal records

**Priority: Start now; written approval before pilot. Suggested respondent: finance.**

| Ref | Information or decision needed |
| --- | --- |
| F01 | Accepted cash currencies at each branch and how menu prices, delivery fees, tender, change and refunds are denominated. If conversion is required, specify the approved rate source, timing and rounding. No exchange rate will be assumed. |
| F02 | Approved tax/inclusive-price treatment, rounding and charges; who issues the legally required receipt/fiscal document and where that responsibility sits in GAAP. |
| F03 | Cash refund policy: eligibility, full versus partial refunds, time limits, original currency, source of cash, approval levels, required GAAP credit-note reference and customer evidence. The current cash workflow supports full till-funded refunds; identify any launch-critical partial-refund requirement. |
| F04 | Financial permissions and limits: who may approve a cashier, acknowledge a handover, refund, correct an order, resolve a shortfall or approve a historical balance. State any required separation between requester and approver. |
| F05 | Business-day/shift cut-off, reconciliation frequency, finance export format, report recipients and how exceptions are assigned and closed. Current reports use Africa/Harare days; confirm any different accounting boundary. |
| F06 | Required reports and examples: sales, delivery fees, cash outstanding/custody, refunds, till differences, earned/redeemed/held points, reward liability and branch comparisons. Supply approved calculation examples and expected totals. |
| F07 | Named finance signatory for money calculations, migration balances and real-till rehearsal; timetable and evidence required for approval. |

## 7. GAAP vendor information and launch bridge

**Priority: Start now. Suggested respondent: GAAP contact, operations and finance.**

Use the [GAAP meeting pack](gaap-integration-meeting-pack.md) for the pre-read, agenda, priority questions, required samples and action log.

Confirmed direction: connect the app’s existing ordering system and its own authoritative loyalty ledger to GAAP. The vendor discussion must establish external-loyalty support alongside ordering; replacement with GAAP’s loyalty product is outside the requested scope.

| Ref | Information or decision needed |
| --- | --- |
| G01 | Vendor/reseller contact, installation/version per branch, support agreement and written confirmation of available integration capabilities and charges. |
| G02 | API/integration documentation, sandbox access, branch/product/customer identifiers, sale/refund examples, authentication/signature contract, retry behaviour and outage limitations where automation is supported. Arrange credentials separately. |
| G03 | Demonstrate an actual GAAP cash sale, reward/discount, cancellation and refund. Supply redacted receipt and credit-note samples showing stable references, currency and fiscal fields. |
| G04 | Can staff record the app order reference in GAAP and capture a unique GAAP sale/credit-note reference in the app? Explain limitations across tills, branches and business days. |
| G05 | Approve either a rehearsed manual till bridge for launch or verified automation. For a manual bridge, specify staff steps, reward-item entry, customer/account matching, duplicate-sale prevention, daily reconciliation, workload limits and outage procedure. |
| G06 | Name operations/finance/vendor participants for rehearsal and approval. Identify any requirement for automatic in-store earning at launch; this remains disabled until a verified integration is accepted. |
| G07 | Confirm supported integration with our app-owned loyalty ledger: external member identification, paid-sale/refund events, app-authorised reward reservation/redemption and fulfilment/correction results. Document how app orders avoid duplicate earning when GAAP reports the same sale. Identify routes that require replacing our ledger as gaps rather than approved scope. |

## 8. Loyalty programme and existing balances

**Priority: Start now; programme approval before pilot. Suggested respondent: finance / marketing.**

| Ref | Information or decision needed |
| --- | --- |
| L01 | Approved earn rule per currency: qualifying spend, points per amount, excluded items, treatment of tax/delivery/discounts, caps and effective dates. Supply worked examples. |
| L02 | Earn timing and refund treatment. Confirm the proposed rule of earning after confirmed cash payment and completion; decide how refunded purchases, already-used points and negative balances are handled. |
| L03 | Reward catalogue per branch: exact benefit/item and GAAP code, point cost, allocation/stock, eligibility, start/end date, terms, exclusions and reservation limit/time. |
| L04 | Reservation expiry/release, abandoned staff claims, physical reward handover, incorrect fulfilment, correction/refund authority and dispute process. Distinguish reservation expiry from any programme-wide points-expiry rule. |
| L05 | Points expiry, account inactivity, programme changes/closure, customer notices and treatment of historical versus new points. Flag rules needing additional implementation. |
| L06 | Existing programme/system, customer identifiers, balance source, transaction history, duplicates, disputes and known demo/test accounts. Provide aggregate counts and redacted samples first; arrange authorised detailed transfer separately. |
| L07 | Opening-balance reconciliation owner, exception approval, import cut-off, freeze window and signed before/after totals. Identify balances that must remain quarantined until reviewed. |
| L08 | Programme terms and approver. Confirm gifting, referral campaigns and advanced achievements may remain disabled for launch, or explicitly request a scope change. |

## 9. Staff access, identity and support

**Priority: Start now; verify before pilot and each branch rollout. Suggested respondent: operations / IT.**

| Ref | Information or decision needed |
| --- | --- |
| A01 | Staff list through an agreed restricted channel: name, verified work email, branch membership(s), job role, cashier/collector responsibilities, start/end dates and approving manager. |
| A02 | Approve an action-permission matrix for staff, branch managers, finance, administrators and privacy reviewers: viewing customers/orders, accepting/dispatching, refunds, corrections, cash handovers, reports, menu/intake changes, role grants and privacy processing. |
| A03 | Nominate at least two recoverable administrator accounts, MFA arrangements and a controlled first-admin/lost-factor recovery procedure with identity verification and audit ownership. |
| A04 | Shared-device policy, staff sign-in/sign-out, personal-device use, lost/stolen device response, onboarding/offboarding and emergency revocation contacts. |
| A05 | Confirm customer email/password access, acceptable verification/recovery experience, eligibility/minimum age and preferred languages. Any SMS/phone-only requirement needs separate provider/cost/delivery assessment. |
| A06 | Customer-support email/phone, operating hours, response expectations, complaint/refund escalation, identity verification and ownership of unresolved orders, cash or reward disputes. |
| A07 | Named human escalation for technical outages and security/privacy incidents, primary/deputy coverage during launch and who may pause a branch or the service. |

## 10. Privacy, retention and customer-facing policies

**Priority: Start now; approved decisions and rehearsed operations before pilot. Suggested respondent: appointed privacy/legal owner, finance and sponsor.**

This section requests Pogo’s decisions and professional review. It does not prescribe legal retention periods or establish regulatory compliance.

| Ref | Information or decision needed |
| --- | --- |
| P01 | Identify the entity responsible for customer/staff data, privacy approver and any privacy officer/adviser. Have that owner identify applicable obligations, filings and approvals. |
| P02 | Confirm control of pgonese6@gmail.com, who monitors it, response coverage and whether a permanent business address will replace it. Supply an owned public website/domain for privacy and deletion pages. |
| P03 | Approve purposes and permitted uses of account/contact, order/address/location, loyalty, staff, support, device and security data; customer eligibility, notices and any marketing consent requirements. |
| P04 | Supply an approved retention schedule by dataset: duration/start event, justification, owner, archive/delete/anonymise action, legal hold, exceptions and review date. Cover financial/fiscal records, addresses, accounts, loyalty, audit, support, device tokens, logs and backups. |
| P05 | Approve hosting regions, cross-border processing and service providers/contracts. Review Supabase, Expo, email, maps/location, monitoring, GAAP and any support/media providers actually used. Marketing and AI support remain disabled pending separate acceptance. |
| P06 | Approve access/export/deletion handling: identity verification, case owner, response process, active-order/cash/reward/staff blockers, records that must be retained, customer explanations and escalation. |
| P07 | Appoint authorised privacy reviewers and the operator responsible for actual erasure/minimisation across app data, Auth, GAAP, email, monitoring and backups. Approve the per-dataset procedure, vendor evidence and rehearsal; request tracking alone does not erase data. |
| P08 | Supply approved privacy notice, ordering/cancellation terms and loyalty terms with version, effective date, approver and approval reference. Approve public deletion instructions, store privacy disclosures and incident/breach handling responsibilities. |

## 11. Service accounts, access and existing deployment

**Priority: Start now. Suggested respondent: sponsor / IT owner.**

For each service, identify the owner, existing organisation/project, administrators/deputy, billing owner, recovery arrangements and person who can grant a named invitation. Separate development, staging and production. Existing development access does not establish production ownership.

| Ref | Service / information needed |
| --- | --- |
| T01 | Source repository/GitHub organisation, repository owner, release approvers and person able to configure CI secrets/environment protection. |
| T02 | Supabase projects: authoritative existing deployment, project identifiers, region, plan, billing/admin owner, backup availability and any currently active users. |
| T03 | Expo/EAS organisation/projects, billing, update channels, app identifiers and existing builds. Confirm who approves production builds and updates. |
| T04 | Google Play / Apple developer organisations, app listings, package/bundle IDs, signing ownership, transfer/upgrade constraints and any installed customer/staff versions. |
| T05 | Domain/DNS/website ownership, public support/privacy/deletion URLs and the person who can publish approved pages. |
| T06 | Transactional email service, sending domain/address, DNS/SMTP administrator, billing and recovery-link delivery requirements. Credentials follow secure handover. |
| T07 | Google Maps/cloud account and billing owner; monitoring/error-reporting organisation, separate project/region per environment, access/recovery and retention owner; push-service ownership and platform permissions. Approve named alert responders/deputies and budget/escalation coverage alongside A07/R04; see the monitoring/incident runbook. |
| T08 | Current integrations, deployed functions, scheduled jobs, storage/media, backups and third-party exports. Identify existing production incidents, known limitations and previous suppliers. |
| T09 | Authorised contact for a read-only inventory and representative-data migration rehearsal; who approves real-data access, backup, maintenance window and cutover? |
| T10 | Data classification: real versus demo users/orders/balances/assets, volumes, active sessions/orders/rewards and any records that cannot be moved or deleted. Share counts/redacted samples first. |
| T11 | Agreed acceptable data loss and service downtime for recovery, reporting needs, operating-cost ceiling and approver for additional capacity or service plans. |

## 12. Testing, training and launch acceptance

**Priority: Arrange now; complete before pilot and branch rollout. Suggested respondent: sponsor, branch managers, finance and support.**

| Ref | Information or decision needed |
| --- | --- |
| R01 | Named customer/staff testers, permission to use test accounts and intended Android/iOS/branch hardware. Supply device availability and dates for hands-on acceptance. |
| R02 | Availability for a realistic busy-shift exercise: cash collection/delivery, no-show, stockout, refund, reward, double submission, network/power loss, phone restart and shift handover. Engineering will provide the technical test plan. |
| R03 | Finance/operations participants for till and loyalty reconciliation, privacy participants for export/deletion rehearsal and technical owners for restore/recovery exercises. |
| R04 | Approve expected peak load, customer wait/response expectations, missed-order escalation, reliability goals and explicit go/no-go criteria. Proposed targets in the project plan still need agreement. |
| R05 | Training roster, branch champions/deputies, preferred training format, staff availability and sign-off on support/shift/outage procedures. |
| R06 | Pilot cohort, operating days/hours, feedback method, customer communication and support roster. The current plan requires at least two representative trading weeks, including busy periods; confirm the observation arrangements. |
| R07 | Who may stop or resume rollout for financial variance, lost orders, access/privacy issues or fulfilment failure? Agree escalation, customer communication and recovery responsibility. |
| R08 | Final approvers for product, engineering/QA, operations, finance, privacy and sponsor acceptance. Confirm branch-by-branch activation and follow-up reviews at 7 and 30 days. |
| R09 | Store listing text/screenshots, app icon, support details, required review access, approved privacy/deletion links and authority to submit/publish. |

## 13. Later-release decisions — optional now

These items do not block the agreed cash-first launch if they remain disabled. Record any requested change to that scope explicitly.

| Ref | Later decision |
| --- | --- |
| X01 | Digital payment providers/methods, merchant ownership, currencies, fees, settlement and refunds. |
| X02 | GAAP automation beyond an approved launch bridge, including automatic in-store earning and customer linking. |
| X03 | Gifting, referral campaigns, advanced achievements, broad marketing, AI support, third-party dispatch or separate web ordering. |
| X04 | Phone/SMS login or additional platforms/languages beyond the accepted first-release scope. |

## 14. Documents and access to return

Return these attachments where they exist. If something does not exist, name its owner and expected date rather than creating an unapproved rule to fill the gap.

- Legal/trading-entity details and the completed contact/approval register.
- Three completed branch sheets, coverage maps, cash/delivery and shift procedures.
- Approved branch menu/modifier/pricing spreadsheet and brand/media assets with usage rights.
- Finance/currency/refund rules, worked calculation examples and sample reports.
- GAAP capability documents and redacted sale/reward/refund receipts; proposed manual bridge steps.
- Loyalty rules, reward catalogue, opening-balance source summary and reconciliation owner.
- Restricted staff roster and approved permissions matrix.
- Privacy/retention decisions, approved customer terms/notices and vendor/hosting review.
- Service ownership/access inventory, existing deployment/data summary and named access coordinators.
- Tester/training roster, pilot availability and named release/support approvers.

**First response to unblock development:** coordinator and approvers; completed branch sheets; current menu/prices/modifiers; delivery/cash rules; finance and loyalty contacts; GAAP contact; account owners; privacy approver; and pilot/platform preference. Other responses can follow with an owner and date.

### Response and decision register

Copy this row for each reference or group of related references. A response may point to an attachment. Record the exact version and approver for policy decisions.

| Reference(s) | Answer / attachment and version | Owner | Status | Expected date | Approved by / date |
| --- | --- | --- | --- | --- | --- |
| Example: BR01–BR12, Msasa | Branch sheet filename/version | Branch manager | Draft / awaiting approval | To agree | |
| | | | | | |
| | | | | | |
| | | | | | |

### Client return acknowledgement

**Completed by / role:** ____________________  
**Business contact:** ____________________  
**Date:** ____________________  
**Outstanding references, owners and expected dates:** ____________________  
**Documents requiring further approval:** ____________________

Returning this pack records information and decisions. Production go-live is a separate approval after implementation, testing, operational rehearsal and release acceptance.
