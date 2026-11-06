# Delivery location confirmation — 6 November 2026

The reported symptom was no visible response when tapping Confirm Location. Code inspection found that missing or invalid written addresses were rejected with an error at the top of the scrolling picker, away from the confirmation controls. Optional saved-label failures used the same distant error area. These are confirmed failure paths; the original phone session was not available to determine which one it encountered.

`components/LocationPickerModal.tsx` now shows address validation beside the required written address and focuses that field. Saving errors appear beside the confirmation controls and scroll into view. An explicit **Use without saving** action lets the customer confirm a valid pin and address for the order after an optional saved-address failure. Repeated taps cannot start concurrent saves, and the inputs remain disabled during a save. Existing account-change and modal-close guards remain in place.

Verification:

- `npm run check`: 532 tests passed, zero failures. TypeScript and ESLint passed again after the final component edit; `git diff --check` passed.
- Thirteen browser assertions passed with local synthetic accounts and data, including visible validation, valid confirmation, reopening and cancelling, failed and successful labelled saves, explicit recovery, repeated taps, and updating the written address in checkout. No runtime exceptions or unexpected writes. The two 390px screenshots had no horizontal overflow or broken images. Evidence: `dist/location-confirm-review/report.json` and the adjacent screenshots.
- Web, Android and iOS exports succeeded. All 115 mapped application sources in each export matched the current files, with zero differences. Evidence: `dist/location-confirm-review/source-verification.json`.

This fix is prepared locally and has not been published through OTA. No connected Android device or configured emulator was available. After delivery, verify on Android: choose a pin, leave the written address empty, and confirm that the address field receives focus with an inline explanation. Enter a street, suburb and landmarks, then confirm that the picker closes and checkout displays that address. Also test a labelled save with an interrupted connection and its recovery action.
