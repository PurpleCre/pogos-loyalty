import { z } from 'zod';
const schema = z.object({ available: z.boolean(), active: z.boolean(), expires_at: z.string().nullable(), server_time: z.string() });
export function developerAccessEnvironment(environment: { name: string; supabaseProjectRef: string; supabaseUrl: string }) {
  return environment.name === 'development' && (
    environment.supabaseProjectRef === 'hsyibcyvujwwqygigepe' && environment.supabaseUrl === 'https://hsyibcyvujwwqygigepe.supabase.co'
    || environment.supabaseProjectRef === 'local' && environment.supabaseUrl === 'http://127.0.0.1:54321');
}
export function developerAccessStatus(value: unknown, owner: string, wall = Date.now(), monotonic = performance.now()) {
  const parsed = schema.safeParse(value);
  if (!parsed.success) return null;
  const status = parsed.data;
  const remaining = status.expires_at ? Date.parse(status.expires_at) - Date.parse(status.server_time) : 0;
  if (!Number.isFinite(remaining) || !Number.isFinite(wall) || !Number.isFinite(monotonic)) return null;
  return { owner, available: status.available && remaining > 0, active: status.active, expiresAt: status.expires_at,
    receivedAt: wall, monotonicAt: monotonic, remainingMs: Math.min(remaining, 8 * 3600000) };
}
export function developerAccessActive(status: ReturnType<typeof developerAccessStatus>, owner: string | undefined, wall: number, monotonic: number) {
  if (!status || status.owner !== owner || !status.active || !status.available || !Number.isFinite(wall) || !Number.isFinite(monotonic)) return false;
  const elapsed = monotonic - status.monotonicAt;
  return wall >= status.receivedAt && elapsed >= 0 && Math.max(wall - status.receivedAt, elapsed) < status.remainingMs;
}
