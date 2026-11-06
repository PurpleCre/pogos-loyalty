# Android Back navigation — 5 November 2026

The root and sign-in layouts now use Expo Router's native `Stack`, with native headers hidden to retain the existing screen headers. The root has an `index` anchor so a cold link to a detail screen can return to Home. The drawer uses `fullHistory`, preserving repeated visits such as Menu → Cart → Menu; Android Back returns to Cart and then the original Menu visit. An open drawer still closes before navigation goes back. At Home with no earlier route, the platform retains its normal exit behavior.

The previous drawer `history` mode deduplicated earlier visits, exhausting navigation sooner than the user's actual journey. The root previously rendered a `Slot` rather than an explicit native stack. The change uses the navigation library's hardware-back handling; no global handler intercepts modal dismissal or forces navigation around account guards.

Verification:

- `npm run check` passed its 528 existing tests and all configured checks. Four additional regression tests in `tests/navigation-back.test.mjs` passed separately. They load the actual layout configuration and execute the installed Expo Android hardware-back callback against the installed stack/drawer reducers, including repeated visits, drawer closing, detail screens and root fall-through.
- Twelve browser assertions passed through the rendered app using local synthetic data: cold Support → Home, Home → branch picker → Menu → Cart, repeated visits and Back, and Profile → Sign-in → Forgot password → Sign-in → Profile. No runtime errors or unexpected writes. Evidence: `dist/back-navigation-review/report.json`.
- Web, Android and iOS exports passed. Both native source maps matched all 115 mapped application sources, with zero differences. Evidence: `dist/back-navigation-review/verification.json`.

No Android device or configured emulator was available, so physical button and gesture acceptance remain a device check after delivery. This change is prepared locally for the existing checked development OTA workflow; no OTA was published by this work.

Device acceptance: after installing the update, open Home → branch picker → Menu → Cart → Menu. Press Android Back repeatedly and confirm Cart → Menu → branch picker → Home. Open the drawer and confirm the first Back only closes it. From Sign-in, open Forgot password and confirm Back returns to Sign-in. Open a direct Support link and confirm Back reaches Home.

Implementation references: [Expo Stack](https://docs.expo.dev/router/advanced/stack/) and [router anchors](https://docs.expo.dev/router/advanced/router-settings/).
