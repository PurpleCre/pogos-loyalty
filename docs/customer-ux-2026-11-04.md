# Customer journey UX increment

4 November 2026. Builds on the teal, charcoal and white screen refresh. This increment improves customer interaction and recovery; it does not approve production trading or enable a provider integration.

## Changes

| Journey | Result |
| --- | --- |
| Adding meals | Meals without options add directly. Customised meals retain the options sheet. A visible, dismissible announcement confirms additions and links to the cart. Required choices still need selection; optional single choices can be deselected. |
| Editing variants | The menu offers **Edit** for customised items, leading to the cart where each choice combination has its own quantity control. It no longer arbitrarily subtracts the first variant when several choices share one menu item. |
| Changing branches | Browsing another branch keeps the current cart. Its old quantities are not shown as selections for the newly browsed branch. Replacing selections requires a shared mobile/browser confirmation. The replacement checks the cart fingerprint again and refuses to overwrite a cart changed since confirmation opened. Existing order recovery references remain separate. |
| Starting checkout | Guests review meals and estimates, then sign in before entering private contact information. Both auth modes explain saved-cart priority. An existing account cart is restored ahead of guest selections, consistent with the existing storage rules. |
| Returning from sign-in | Password sign-in and immediate-session sign-up honour the existing allowlisted checkout destination. Switching between sign-in and sign-up retains email/name while clearing the password and visibility state. Duplicate in-flight submissions are blocked locally. |
| Completing details | Checkout shows name, phone, pin and written-address guidance next to the relevant fields. Invalid details do not request a quote; the first invalid text field receives focus. Zimbabwe local phone normalisation and international phone support remain unchanged. |
| Returning to the menu | **Add more meals** returns to the cart’s branch. Contact details, fulfilment choice and written-address edits survive navigation in memory for the current account. They are not newly written to device storage and clear on account changes, sign-out, restart or confirmed checkout. A quote is not restored across checkout remounts. |
| Choosing a pin | Opening the location picker does not request permission. Native users explicitly choose **Use my current location**; browsers retain their explicit location button and manual coordinates. An existing pin/address is prefilled, and moving a pin no longer erases the address. Saving a labelled location remains an explicit separate choice under the existing account-scoped storage model. |
| Reviewing the amount | Cart lines and meal subtotals show USD menu estimates, separate from the server quote. A fresh total dismisses the keyboard and brings the review action into view. The review includes the actual branch, service, contact and delivery/collection address, with the server expiry time. Changed/expired totals explain why a fresh quote is needed. Only a current server quote enables submission. |
| Reserving a reward | The chosen menu branch is used initially when available. A bounded confirmation shows branch, points, terms and hold duration without needing to find a panel elsewhere on the page. Errors remain visible in the confirmation; successful feedback uses the normal brand treatment. Existing reservation, freshness and recovery checks remain. |

## Verification

- `npm run check`: **500 tests pass**, including seven new behavioural cases for local checkout guidance and safe branch replacement. TypeScript, lint, schema drift and existing repository checks pass.
- Shared controls expose checked, selected, disabled and busy state to browser assistive technology as well as the native accessibility state API.
- Web and Android/iOS Hermes exports pass. Native source-map verification confirms all **112 mapped application/component/context/hook/library sources on each platform** match the final edited files; `native-source-verification.json` records the result.
- **27 browser journey assertions pass**, with seven phone/desktop captures, zero runtime exceptions, zero page-width overflow and zero visible broken images. The pass checks separate Medium/Large variants, local field validation and focus, sign-in return, quote invalidation/expiry, visible review action, draft preservation, explicit pin selection, private-draft storage exclusion, branch cancellation/replacement, reward review/cancellation and sign-out cleanup.
- Three synthetic quote requests were answered locally; no order placement or reward reservation command was attempted. No operation was sent to a live backend.
- Screenshots and the [UX review gallery](../dist/ux-review/index.html) are recorded in ignored `dist/ux-review/`, with `report.json` and `summary.json`. Local-only harnesses are in ignored `.local/` and are not imported by application code.
- The browser harness uses synthetic accounts, fake Auth/quote responses and the captured menu on a loopback-only verification backend. This is client interaction evidence, not hosted service or real trading acceptance.

## Release checks still required

Physical Android/iOS keyboards, accessibility services, permission denial and real Maps behaviour need device checks. The earlier APK predates the UI/UX increments. No replacement binary, OTA, migration, policy change, live order or reward reservation is published by this work. Client approval, owned production configuration and the existing release gates remain open.
