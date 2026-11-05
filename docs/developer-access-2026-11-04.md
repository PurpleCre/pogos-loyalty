# Named developer bypass until manual removal

Implemented and activated on 4 November 2026 at the user’s explicit request. Scope: the repository’s connected development project, `hsyibcyvujwwqygigepe`, and these two emails only:

| Account | Verified activation check |
| --- | --- |
| `pgonese6@gmail.com` | Existing account, verified email, existing `admin` role. Allowlist entry enabled. |
| `rathvelem@gmail.com` | Account does not yet exist. Allowlist entry enabled for later use; it cannot grant access until the account exists, its email is verified and a staff/admin role is assigned through the normal process. |

No account, application role, branch membership or cashier assignment was created or changed. Configuration was applied to the existing connected project used for development. Supabase’s CLI labels its default database branch “production”; staging/production application bindings remain unconfigured, and no separate production project was targeted.

## Lifetime and use

The user requested removal of the scheduled expiry on 4 November 2026; the follow-up migration was applied and verified on 5 November 2026. There is **no automatic grant deadline or eight-hour bypass-session cap**. The allowlist remains enabled until manually disabled. Each opted-in session remains bound to a real, valid Auth session and still ends on sign-out, **End bypass**, revocation or loss of the required account/role conditions.

Sign in normally and choose **Use developer bypass** on Account security. Elevated screens display **DEVELOPMENT · MFA BYPASS ACTIVE** and an **End bypass** control. Signing in again requires explicit opt-in. The app does not manufacture a verified authenticator or an AAL2 JWT. Updated client wording and non-expiring status support require delivery through the checked OTA workflow.

The earlier customer-only proposal was replaced when the user chose staff/admin access. The implementation retains the account’s existing role and branch scope.

## Server boundary

The database requires all of the following on each privileged request:

- A signed Auth issuer for the exact development project, an existing real Auth session matching `session_id` and the current user, and password authentication evidence.
- An enabled entry matching the current verified `auth.users.email`; profile/user metadata cannot supply the email. Deleted accounts and recovery authentication cannot qualify.
- An existing `staff` or `admin` role, plus the existing per-role/branch/cashier/approval checks for the requested operation.
- An explicitly started, unended development session for that exact Auth session and user.

`identity_aal2()` retains its original meaning. Only the operational access predicates `has_role`, `cash_staff_access` and `finance_branch_access` accept the new `identity_access_assured()` exception. Personal privacy reauthentication, authenticator/invitation verification and persistent push-device MFA evidence retain actual MFA requirements. This bypass does not activate ordering, rewards, notification workers, GAAP, payments or any client approval gate.

Grant/session/audit tables have RLS enabled and no direct client/service table grants. Only the service-only configuration command can enable/disable either approved email. Session opt-in/termination operates on the current authenticated user. Audit events record configuration and explicit session start/end and cannot be updated or deleted through the API. The privacy data map classifies the developer identity/session/audit fields; retention/legal approvals remain unconfirmed. Disabling access does not erase audit evidence.

Revocation, role removal, email verification loss, account deletion or session termination stops the exception. Revoking a grant also ends its active development sessions. Existing downloaded information cannot be retroactively erased; the database is authoritative for subsequent requests. The client refreshes roles and removes its elevated UI after revocation/foreground refresh or sign-out.

The follow-up migration converts existing grants and still-active bypass sessions to null expiry, preserves enabled/disabled flags and records the change in audit events. Ended or already expired sessions are not revived. New `development_mfa_status_v2()` responses identify non-expiring access explicitly. The original status endpoint supplies installed clients with a rolling compatibility refresh window so a null expiry does not lock them out; that display/cache window does not impose a backend session deadline. Historical audit events retain the original policy details.

## Operator controls

`scripts/development-mfa-bypass.mjs` is an operator-only tool, excluded from cloud app archives and never imported by application code. It validates the development binding, linked project and service-key project. It prints only the named account readiness/roles and allowlist state, never passwords, tokens or factor secrets.

```sh
node scripts/development-mfa-bypass.mjs --status
node scripts/development-mfa-bypass.mjs --disable
```

`--disable` immediately revokes both entries and ends their active development sessions. `--enable` re-enables only these two entries with no scheduled expiry; it does not create accounts, roles or sessions.

## Verification and activation evidence

- The follow-up passed `npm run check`: 528 tests, zero failures, plus the configured type, lint, SDK and policy checks. The 17 developer-access tests passed again after making the historical migration fixture independent of the old cutoff date. Coverage includes access beyond the old date/cap, explicit status validation, legacy finite responses, continued revocation and conversion without resurrecting expired/ended sessions.
- Ten browser assertions passed using local synthetic accounts, with three captures and zero runtime errors, unexpected writes, overflow or blocked images. The checks cover opt-in, existing admin access, no false MFA claim, continued access beyond a simulated legacy deadline, ending access, sign-out, new-sign-in opt-in and revocation. Evidence: `dist/developer-permanent-review/report.json` and `summary.json`.
- Web, Android and iOS exports passed. Both native source maps match all 115 mapped application sources with zero differences; evidence: `dist/developer-permanent-review/native-source-verification.json`.
- The original `20261104010000_development_mfa_bypass.sql` migration was applied to the pinned project, and the service-only configuration command enabled both named entries. The activation check confirms that the database can read Auth session metadata. Private original operator evidence is in `.local/developer-access/enable.json`.
- On 5 November 2026, `20261104020000_development_mfa_manual_expiry.sql` was applied to that same pinned development project. A subsequent live operator check confirmed both entries remain enabled and both have `expires_at: null`. The first account remains verified with its existing admin role; the second account remains absent. Private current evidence: `.local/developer-access/status.json`.

No real developer session was started by the agent and no user credentials were requested. Actual device/session acceptance still requires the developer to sign in and explicitly opt in. The native exports and browser fixtures do not publish an OTA: the updated client wording and v2 status handling must go through the existing checked publishing workflow. The compatibility endpoint supports installed clients during that transition.
