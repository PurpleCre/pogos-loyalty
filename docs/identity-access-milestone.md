# Identity recovery and staff access

Updated: 31 October 2026. Status: implemented and verified locally; hosted authentication, native/device and operational activation gates remain open. This increment advances Phase 2 without declaring its privacy or granular permission work complete.

## Customer authentication and recovery

- A single root authentication provider manages the application. Login/signup share session state with customer and staff screens; the nested provider was removed.
- Email/password remains the supported method. New passwords require 12–128 characters in the client; existing passwords can still sign in. The hosted Auth service must enforce the approved password policy too. No phone/SMS flow or provider was assumed.
- Signup confirmation, resend confirmation, forgotten password, PKCE callback and password-reset screens are implemented. Recovery/confirmation links must open on the device/browser context that started the request. The SDK stores its PKCE verifier through the session adapter, including concurrent-flow identifiers. Bearer-token callback parameters and arbitrary post-login redirects are rejected.
- A recovery guard commits before code exchange, persists across native restarts, and keeps recovery sessions on the password-reset path. Replayed route mounts exchange once. Invalid links preserve an existing guard; unexpected SDK/storage exceptions keep a blocking guard. A callback cannot silently retain a different account’s session.
- Successful password changes require a fresh login. Global refresh-session sign-out is attempted; its failure is surfaced. Local sign-out immediately hides private state and commits a persistent logout intent before network work, preventing interrupted logout from restoring the old native session. Storage failure is not silently downgraded to plaintext.
- Auth/role work runs outside Supabase’s auth-event lock. Revision guards reject stale role responses. Account and permission changes clear private query state; administrator identity lists and transaction state are scoped to the current account/access state. Foreground and 30-second role checks refresh the UI; the database remains the authority on every protected request.

## Session storage

Native credentials and PKCE verifiers use SDK-compatible `expo-secure-store` **58.0.2**, with device-only/unlocked Keychain accessibility. Large values are split on Unicode code-point boundaries into bounded encrypted chunks. A final generation manifest commits the value; interrupted writes cannot combine old and new tokens. The previous committed generation is removed after success. Corrupt/incomplete committed values fail closed.

The current project’s legacy plaintext auth values are removed when accessed, rather than imported as trusted sessions. Users must sign in once after this upgrade; old pending email links may need replacement. Crash-orphaned chunks remain encrypted and are not loaded; this adapter does not promise forensic erasure or automatic orphan enumeration. OS storage limits, locked-device behavior, uninstall/reinstall and backup/restore require physical-device verification. [SecureStore platform behavior](https://docs.expo.dev/versions/latest/sdk/securestore/)

Web bearer sessions are memory-only, so a reload requires sign-in. Only expiring PKCE proof material uses same-tab `sessionStorage`; this lets confirmation/recovery redirects complete without persisting access/refresh tokens in browser storage. Browser origin/redirect configuration and browser end-to-end acceptance remain required.

The native plugin enables Android backup exclusions. `native:preflight` checks that both backup-rule resources are referenced. Actual merged native backups and iOS Keychain behavior have not been exercised on devices. SecureStore changes the native fingerprint: **install a fresh native build before using OTA updates for this runtime**. Existing automatic development and manual development/staging OTA triggers remain enabled.

## Staff permissions and invitations

| Actor/session | Server permission |
| --- | --- |
| Customer, AAL1 | Existing own-account customer paths; no staff or admin commands |
| Assigned staff, AAL1 or missing assurance | Own customer access; branch queues and operations denied |
| Assigned staff, AAL2 | Explicit active branch memberships, potentially multiple branches; existing cash/reward rules still apply |
| Administrator, AAL1 | Own-account paths; administrative reads/writes and invitations denied |
| Administrator, AAL2 | Existing administrator scope plus audited access commands; last administrator cannot be removed |
| Anonymous | Public catalogue/branch paths only; no private queues, invitations or access commands |

An authenticator screen supports TOTP enrollment, factor choice and challenge/verification. Setup secrets and QR generation stay local to the screen; backgrounding clears displayed setup/code state. An existing verified factor is not silently removed. No unauthenticated MFA-reset or password-recovery bypass was introduced. Server policies require the signed JWT’s AAL2 value and fresh role/membership rows, not the client’s drawer state. [Supabase TOTP flow](https://supabase.com/docs/guides/auth/auth-mfa/totp)

The migration `20261031000001_identity_access.sql` backfills explicit memberships from historical `staff_store_id`, preserves financial data, and removes direct role table/column writes even for app administrators. `set_identity_access` atomically applies a reviewed role/branch set, records before/after evidence with the actor/reason, protects the last administrator, disables removed cashier assignments, and invalidates old invitations that could restore access. Audit rows cannot be updated/deleted by API or service roles. Accepted-invitation replay cannot restore a revoked membership.

Revocation affects subsequent database commands/reads without waiting for JWT refresh. It does not erase previously downloaded data or cancel an already-running transaction. Full PostgreSQL contention and actual PostgREST/realtime/session tests remain required. Existing cashier designations remain separate approvals: inviting staff does not make them a cashier.

Administrators use **Admin → Users** to create seven-day, branch-scoped invitations and revoke pending ones. Recipient accounts are created/verified by recipients themselves. **No invitation email is sent by this implementation**: the administrator tells the recipient to open **Profile → Account security and branch invitations**, enroll/verify MFA, then accept the matching invitation. Only the current verified `auth.users.email` can accept; profile metadata cannot supply that identity. Invitation retries reuse an ID while the unchanged form remains mounted; a process restart can create another pending invitation, but membership acceptance is an atomic upsert, not an extra financial grant.

Legacy privileged push/special-offer functions now ask the database for administrator permission using the caller’s JWT instead of querying roles with a service client. The legacy push sender still requires replacement for reliable transactional delivery. No Edge Function was deployed or invoked, no staff/administrator account was created, and no message was sent.

## Verification

The final local suite contains **181 passing tests**, including cash/reward customer journeys at AAL1, the previous financial/security regressions, explicit AAL1/AAL2/anonymous matrices, multi-branch access and delivery dispatch, direct-write denial, recipient verification, invitation expiry/replay/revocation, immutable access audit, final-administrator protection, legacy assignment backfill, large/Unicode/failed session writes, browser proof storage and PKCE recovery lifecycle contracts.

TypeScript, lint, generated database-type drift, SDK compatibility and strict installed peers pass. Android/iOS Hermes exports and temporary native generation pass with disposable inputs. PGlite supplies simulated JWT claims; these tests do not validate JWT signatures, run hosted Auth, send recovery email, or simulate full PostgreSQL concurrency. Native generation/export is not compilation, signing, installation or device acceptance. The fresh dependency audit remains **26 entries: 2 low, 21 moderate, 3 high, zero critical**; the platform security gate remains open.

```sh
npm run check
npm run build:check
npm run native:preflight
```

## Activation and remaining Phase 2 gates

1. Confirm environment/account ownership and rehearse the complete migration on an isolated representative copy. Inventory legacy staff/admin rows, verified emails and cashier grants; compare membership backfill and finance totals. Coordinate old-client behavior: AAL1 staff/admin requests will be denied after this migration. Do not migrate a live project merely because local tests pass.
2. Establish at least two recoverable, approved administrator accounts and enroll MFA before branch activation. First-admin bootstrap and lost-factor handling require a controlled platform-owner procedure with identity verification and audit evidence; no self-service elevation endpoint exists. Test administrator removal, stale JWTs and revocation races against real Postgres/PostgREST.
3. Configure Auth email confirmation, TOTP enrollment/verification, redirect allowlists for each approved app scheme/web origin, sender/domain/SMTP, password policy, session limits, rate limits and abuse controls in the owned hosted project. Choose and test secure password-change/reauthentication behavior with recovery, rather than assuming a client length check secures the Auth API. Local TOML enables confirmation/TOTP and development redirects only; it has not started a local Auth container or modified hosted settings. Verify SDK flow-id query parameters through actual email links. [Auth configuration](https://supabase.com/docs/guides/local-development/cli/config), [password policy](https://supabase.com/docs/guides/auth/password-security)
4. Build/install the new runtime, then exercise cold/warm email callbacks, wrong-device/expired/replayed links, wrong codes, lost factors, process kills during recovery/logout, offline logout, secure-store failures, account switching, foreground refresh and real Android/iOS notification behavior. Verify global sign-out and the remaining access-JWT lifetime; refresh-session revocation alone does not instantly invalidate every issued JWT.
5. Verify both privileged Edge Functions deny anonymous/customer/AAL1/stale-revoked administrator tokens in the Supabase/Deno runtime. Configure only the required environment secrets; never ship a service key in a client. The Deno runtime is unavailable on this host, so its function execution is still an external acceptance gate.
6. Finish the broader authorization inventory, approved manager/finance permission tiers, retention/consent/export/deletion workflows and public privacy/deletion resources. This increment supports customer/staff/admin roles only and does not invent finance/manager grants or legal retention rules. These remain explicitly open in P2-02/03/05; Phase 2’s complete production gate is not closed.

No cloud migration, build, publication, account provisioning or communication was performed. The next independent implementation area is the remaining privacy/data lifecycle and branch operational readiness work; resolve its business/legal decisions alongside the hosted identity acceptance above.
