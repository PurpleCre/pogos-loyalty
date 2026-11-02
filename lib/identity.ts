export function normaliseEmail(value: string): string {
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.');
  return email;
}
export function validatePassword(value: string): void {
  if (value.length < 12 || value.length > 128) throw new Error('Use a password between 12 and 128 characters.');
}
const destinations = new Set(['/', '/privacy', '/notifications', '/finance', '/support', '/(app)/dashboard', '/(app)/cart', '/(app)/profile', '/(app)/rewards', '/(app)/order-tracking', '/(app)/transactions', '/(app)/staff-dashboard']);
export function safeAuthDestination(value: unknown): string {
  return typeof value === 'string' && destinations.has(value) ? value : '/(app)/dashboard';
}
export function callbackInput(params: Record<string, unknown>): { code: string; flowId?: string } {
  if (params.error || params.error_code || params.access_token || params.refresh_token || typeof params.code !== 'string' || !/^[A-Za-z0-9_-]{8,2048}$/.test(params.code)) throw new Error('This sign-in link is invalid or expired. Request a new email on this device.');
  const flowId = params.sb_flow_id;
  if (flowId !== undefined && (typeof flowId !== 'string' || !/^[A-Za-z0-9_-]{8,128}$/.test(flowId))) throw new Error('This sign-in link is invalid.');
  return { code: params.code, ...(flowId ? { flowId: flowId as string } : {}) };
}
export function roleSnapshot(rows: { role: string; staff_store_id?: string | null }[], stores: string[], aal: string | null) {
  const assignedRole = rows.some(row => row.role === 'admin') ? 'admin' : rows.some(row => row.role === 'finance') ? 'finance' :
    rows.some(row => row.role === 'manager') ? 'manager' : rows.some(row => row.role === 'staff') ? 'staff' : 'user';
  const hasScope = assignedRole === 'admin' || assignedRole === 'user' || stores.length > 0;
  return { assignedRole, role: hasScope && (assignedRole === 'user' || aal === 'aal2') ? assignedRole : 'user', requiresMfa: assignedRole !== 'user' && aal !== 'aal2', stores } as const;
}
export const branchScopedRole = (role: string) => ['staff','manager','finance'].includes(role);
