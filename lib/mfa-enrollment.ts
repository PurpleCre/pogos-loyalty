// A mobile Auth Site URL can have no hostname. Supabase otherwise derives the
// TOTP issuer from that hostname, which makes setup fail before returning a key.
export const totpEnrollment = { factorType: 'totp', friendlyName: 'Pogo’s authenticator', issuer: 'Pogos' } as const;
export interface MfaFactor { id: string; factor_type: string; status: string; friendly_name?: string }
interface Setup { id: string; secret: string; uri: string }
export interface MfaSetupState { pendingId: string | null; setup: Setup | null }
export const emptyMfaSetup: MfaSetupState = { pendingId: null, setup: null };
export function mfaSetupReducer(state: MfaSetupState, event:
  | { type: 'started'; setup: Setup }
  | { type: 'hide' }
  | { type: 'reset' }
  | { type: 'reconcile'; factors: MfaFactor[] }): MfaSetupState {
  if (event.type === 'started') return { pendingId: event.setup.id, setup: event.setup };
  if (event.type === 'hide') return { pendingId: state.pendingId, setup: null };
  if (event.type === 'reset') return emptyMfaSetup;
  return event.factors.some(factor => factor.id === state.pendingId && factor.factor_type === 'totp' && factor.status === 'unverified') ? state : emptyMfaSetup;
}

interface MfaClient {
  listFactors(): Promise<{ data: { all: MfaFactor[] } | null; error: unknown }>;
  unenroll(input: { factorId: string }): Promise<{ error: unknown }>;
  enroll(input: typeof totpEnrollment): Promise<{ data: { id: string; totp: { secret: string; uri: string } } | null; error: unknown }>;
}
export async function startTotpSetup(client: MfaClient, ensureCurrent: () => Promise<void>) {
  await ensureCurrent();
  const listed = await client.listFactors();
  if (listed.error) throw listed.error;
  if (!listed.data) throw new Error('Security settings unavailable.');
  await ensureCurrent();
  const verified = listed.data.all.find(factor => factor.factor_type === 'totp' && factor.status === 'verified');
  if (verified) return { kind: 'existing' as const, factor: verified };
  // Only discard unfinished keys created by this application. Other factors,
  // including verified authenticators, must never be removed to repair setup.
  for (const factor of listed.data.all.filter(factor => factor.factor_type === 'totp' && factor.status === 'unverified' && factor.friendly_name === totpEnrollment.friendlyName)) {
    await ensureCurrent();
    const removed = await client.unenroll({ factorId: factor.id });
    if (removed.error) throw removed.error;
  }
  await ensureCurrent();
  const result = await client.enroll(totpEnrollment);
  if (result.error) throw result.error;
  await ensureCurrent();
  if (!result.data) throw new Error('Setup response unavailable.');
  return { kind: 'new' as const, setup: { id: result.data.id, secret: result.data.totp.secret, uri: result.data.totp.uri } };
}

export type MfaAction = 'load' | 'enroll' | 'verify' | 'invite' | 'signout';
export function mfaFailureMessage(error: unknown, action: MfaAction): string {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : null;
  const messages: Record<string, string> = {
    mfa_totp_enroll_not_enabled: 'Authenticator setup is disabled on the sign-in service. Contact support; retrying a code will not fix this.',
    mfa_totp_verify_not_enabled: 'Authenticator verification is disabled on the sign-in service. Contact support.',
    mfa_factor_name_conflict: 'An authenticator with this name already exists. Refresh security settings and use your existing authenticator.',
    too_many_enrolled_mfa_factors: 'Your account has reached its authenticator limit. Contact your branch manager to review existing factors.',
    mfa_verification_failed: 'That code was not accepted. Use the latest six-digit code and check that your phone’s time is automatic.',
    mfa_challenge_expired: 'The code check expired. Enter the current code and verify again.',
    mfa_ip_address_mismatch: 'Your connection changed during verification. Stay on the same connection and verify the current code again.',
    mfa_factor_not_found: 'This authenticator setup is no longer available. Refresh security settings before trying again.',
    session_not_found: 'Your sign-in session expired. Sign out and sign in again.',
    invalid_totp_code: 'Enter the six-digit code from your authenticator app.',
    session_changed: 'Your account or app state changed. Return to the app and refresh security settings.',
    over_request_rate_limit: 'Too many security requests. Wait a moment before trying again.',
    unexpected_failure: action === 'enroll' ? 'The sign-in service could not create an authenticator setup. Refresh and try again; contact support if this continues.' : 'The sign-in service could not complete this action. Try again shortly.',
  };
  if (typeof code === 'string' && Object.hasOwn(messages, code)) return `${messages[code]} (${code})`;
  if (action === 'enroll') return 'Authenticator setup could not finish. Check your connection, then try setup again.';
  if (action === 'verify') return 'The code could not be verified. Check your connection and try the current six-digit code again.';
  if (action === 'load') return 'Security settings could not be refreshed. Check your connection and try again.';
  return 'This security action could not finish. Check your connection and try again.';
}
