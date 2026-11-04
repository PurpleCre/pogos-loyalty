# Authenticator setup failure after sign-in

4 November 2026. Reported on the Android development app: **Set up authenticator** fails before displaying a key or requesting a code. Assigned staff/admin accounts remain at the MFA gate.

## Confirmed cause

Read-only checks of the authorised development project `hsyibcyvujwwqygigepe` confirmed that TOTP enrollment and verification are enabled and the configured factor limit is 10. The Auth Site URL uses the `pogos:` scheme and has no hostname.

Recent Auth logs contain four HTTP 500 setup failures between 09:14:21 and 09:14:34 UTC with error code `unexpected_failure` and the internal diagnostic **Issuer must be set**. No account identifiers, setup keys or bearer credentials were printed or retained in the diagnostic report. The logs were read through bounded Management API queries, not by accessing account factors.

The app did not supply an issuer to `mfa.enroll`. Supabase derives the default from the Auth Site URL’s hostname, so this mobile URL produced an empty issuer. [Supabase’s implementation](https://github.com/supabase/auth/blob/master/internal/api/mfa.go) shows the fallback and TOTP generation path. This was a setup failure, not an incorrect authenticator code.

## Changes

- Enrollment now supplies the explicit issuer `Pogos`. It does not depend on the Auth Site URL or alter email/deep-link configuration.
- Existing verified TOTP factors are reused rather than replaced. Restarting setup removes only unfinished factors with this app’s exact authenticator name; unrelated factors are retained.
- Moving to an authenticator app clears the displayed private key, QR and entered code, while retaining the pending factor ID in the mounted account screen. Returning can finish the same enrollment. If the key was not added, **Start setup again** explicitly explains that the unfinished key is replaced.
- Factor reconciliation removes a pending selection when the server reports it missing, verified or of another type. Nothing in local setup state grants AAL2 or staff/admin access.
- Requests are guarded against simultaneous button presses and account/background changes. Security settings must load before setup or verification controls activate.
- Safe, action-specific feedback distinguishes disabled enrollment, existing-factor conflicts, limits, code failures, expiry, connection changes and server failure. Arbitrary Auth response text, emails and secrets are not reflected in messages or logs.

## Verification and delivery

`npm run check` passes **511 tests**, including eleven new enrollment, secret-clearing, pending-factor, cancellation and safe-feedback cases. The existing database MFA/role tests remain in the suite. Web and Android/iOS Hermes exports pass. Source-map verification confirms all 113 mapped application sources on each native platform match the edited files.

Eight browser assertions pass using the real installed Supabase SDK against local-only simulated Auth endpoints: AAL1 administrator gating, typed service errors, explicit issuer/key display, secret/code clearing on background, returning to the same unfinished factor without re-enrollment, wrong-code denial, successful AAL2 verification and exit to the dashboard. Four 390px captures have zero runtime errors, overflow or visible broken images. Evidence is in ignored `dist/mfa-review/report.json`, `summary.json`, `native-source-verification.json` and the PNG captures. This simulation does not enroll or verify a real account.

No hosted Auth configuration, user role, account factor or database record was changed by this diagnosis or patch. No real account was enrolled or challenged. The browser check uses synthetic factors and tokens; it cannot prove device/provider acceptance.

This is JavaScript-only work using existing native dependencies. The installed APK and the previously published OTA do not contain this patch until the checked development OTA workflow publishes the new source and the device loads it. Physical-device confirmation is still required. MFA must remain enforced; resetting/removing a verified factor is not part of this hotfix.

The subsequent, separately authorised [named developer bypass](developer-access-2026-11-04.md) adds an expiring development-only exception with backend activation. Its migration/activation and remaining client-delivery requirements are recorded separately; no authenticator factor is removed by that exception.
