# Temporary named developer bypass

Implemented and activated on 4 November 2026 at the user’s explicit request. Scope: the repository’s connected development project, `hsyibcyvujwwqygigepe`, and these two emails only:

| Account | Verified activation check |
| --- | --- |
| `pgonese6@gmail.com` | Existing account, verified email, existing `admin` role. Allowlist entry enabled. |
| `rathvelem@gmail.com` | Account does not yet exist. Allowlist entry enabled for later use; it cannot grant access until the account exists, its email is verified and a staff/admin role is assigned through the normal process. |

No account, application role, branch membership or cashier assignment was created or changed. Configuration was applied to the existing connected project used for development. Supabase’s CLI labels its default database branch “production”; staging/production application bindings remain unconfigured, and no separate production project was targeted.

## Lifetime and use

All exceptions expire at **00:00 on 11 November 2026, Africa/Harare** (10 November at 22:00 UTC). Each explicit session lasts at most **eight hours**, bounded by that deadline. Repeating an active start does not extend it.

After the new app source is published through the checked development OTA workflow, sign in normally and choose **Use developer bypass** on Account security. Elevated screens display **DEVELOPMENT · MFA BYPASS ACTIVE** and an **End bypass** control. Signing in again requires explicit opt-in. The app does not manufacture a verified authenticator or an AAL2 JWT.

The earlier customer-only proposal was replaced when the user chose staff/admin access. The implementation retains the account’s existing role and branch scope.

## Server boundary

The database requires all of the following on each privileged request:

- A signed Auth issuer for the exact development project, an existing real Auth session matching `session_id` and the current user, and password authentication evidence.
- An enabled, unexpired entry matching the current verified `auth.users.email`; profile/user metadata cannot supply the email. Deleted accounts and recovery authentication cannot qualify.
- An existing `staff` or `admin` role, plus the existing per-role/branch/cashier/approval checks for the requested operation.
- An explicitly started, unexpired development session for that exact Auth session and user.

`identity_aal2()` retains its original meaning. Only the operational access predicates `has_role`, `cash_staff_access` and `finance_branch_access` accept the new `identity_access_assured()` exception. Personal privacy reauthentication, authenticator/invitation verification and persistent push-device MFA evidence retain actual MFA requirements. This bypass does not activate ordering, rewards, notification workers, GAAP, payments or any client approval gate.

Grant/session/audit tables have RLS enabled and no direct client/service table grants. Only the service-only configuration command can enable/disable either approved email. Session opt-in/termination operates on the current authenticated user. Audit events record configuration and explicit session start/end and cannot be updated or deleted through the API. The privacy data map classifies the new developer identity/session/audit fields; retention/legal approvals remain unconfirmed. Expiration does not erase audit evidence.

Revocation, role removal, email verification loss, account deletion, session termination or session/grant expiry stops the exception. Revoking a grant also ends its active development sessions. Existing downloaded information cannot be retroactively erased; the database is authoritative for subsequent requests. The client refreshes roles and removes its elevated UI on expiry, foreground refresh or sign-out.

## Operator controls

`scripts/development-mfa-bypass.mjs` is an operator-only tool, excluded from cloud app archives and never imported by application code. It validates the development binding, linked project and service-key project. It prints only the named account readiness/roles and allowlist state, never passwords, tokens or factor secrets.

```sh
node scripts/development-mfa-bypass.mjs --status
node scripts/development-mfa-bypass.mjs --disable
```

`--disable` immediately revokes both entries and ends their active development sessions. `--enable` re-enables only these two entries before the fixed deadline; it does not create accounts, roles or sessions. Extending the deadline requires a reviewed code/migration change.

## Verification and activation evidence

- `npm run check`: **523 tests pass**, including 12 new server/client cases covering default-off behavior, service-only configuration, named opt-in, unchanged actual AAL, alternate issuers, missing claims, recovery/non-password authentication, future-account prerequisites, branch limits, real-session binding, stop/revoke/expiry, client expiry/account changes and immutable auditing.
- Nine browser journey assertions pass through the installed Supabase SDK with a local simulated backend: opt-in, administrator navigation with an AAL1 token, visible developer state, absence of a false MFA claim, stop, expiry, sign-out, a new sign-in and revocation. Three phone captures have zero runtime errors, overflow or visible broken images. Evidence is in ignored `dist/developer-review/`.
- Web and Android/iOS exports pass. All **115 mapped application sources** on each native platform match the final files.
- The linked-project dry run listed only `20261104010000_development_mfa_bypass.sql`. That migration was applied successfully to the pinned project, and the service-only configuration command enabled both named entries. The activation check confirms that the database can read Auth session metadata. Private operator evidence is in `.local/developer-access/enable.json`.

No real developer session was started by the agent and no user credentials were requested. Actual device/session acceptance still requires the developer to sign in and explicitly opt in. The native exports and browser fixtures do not publish an OTA: the updated client source must go through the existing checked publishing workflow before the button is available on the phone.
