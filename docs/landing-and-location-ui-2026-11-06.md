# Home and delivery picker refresh — 6 November 2026

Home now puts ordering first: a compact food hero, direct branch choices, a prominent menu button, a cart shortcut with the actual selection count, and a loyalty shortcut. Signed-in customers see their balance with its freshness label; guests see a sign-in prompt. Menu previews use catalogue images and prices from the existing menu reader, scoped to the selected branch. Preview prices remain estimates. The layout adapts from narrow phones to a desktop image-and-copy layout.

Selecting a Home branch updates the ordering branch without replacing a different branch’s cart. The existing menu and cart rules still handle branch changes and checkout. Home also retains account and support access, branch refresh, menu loading and refresh recovery.

The delivery picker is now a full-screen editor with a larger map, a fixed central pin on native platforms, saved-address previews, numbered pin/address steps and a persistent confirmation footer. Dragging or tapping the native map selects the entrance; opening the picker alone does not turn the default Harare viewport into a delivery pin or request GPS permission. Saved addresses require explicit confirmation, and editing one for a single order leaves the saved record unchanged unless the customer requests a labelled save.

Written addresses remain required. Validation focuses and scrolls to the address field. Location and saving failures appear in the footer, with explicit recovery after an optional save fails. Save and map controls prevent conflicting operations during confirmation; account changes and closing invalidate pending confirmation results.

GPS uses a recent cached fix only within 60 seconds and a requested 100 m accuracy, then requests a fresh fix if needed. Stale or invalid results are rejected; approximate results disclose accuracy and ask the customer to review the entrance. Native GPS lookup has a 12-second deadline after permission is granted. Manual map selection invalidates a pending GPS result. Browser GPS has equivalent freshness feedback and cancellation guards, while preserving its existing coordinate-entry fallback. No new map provider, paid search service or geocoding dependency was added. The branch’s online quote remains responsible for delivery coverage and fees.

## Verification

Final verification evidence is recorded in `dist/landing-map-review/verification.json`, with the browser assertions in `dist/landing-map-review/report.json` and phone, tablet and desktop screenshots alongside them. Automated checks include address/pin validation and GPS freshness, accuracy and invalid-coordinate cases in `tests/location-picker.test.mjs`.

## Android acceptance after delivery

On an installed development build, check that dragging the native map places the fixed pin at the entrance, tapping recentres it, and zooming leaves confirmation usable after the map settles. Test permission denial and a successful GPS fix. Open a saved address, edit its text, confirm, and check that checkout receives the edit while the original saved address remains available. With the keyboard open, trigger a required-address error and verify that both the field and confirmation controls remain usable. Press Android Back in the picker to dismiss it without changing the confirmed address.

No connected Android device or configured emulator was available for physical gesture, keyboard and GPS acceptance. The changes are prepared locally; this work does not publish an OTA update.
