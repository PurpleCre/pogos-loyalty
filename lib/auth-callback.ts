import { callbackInput } from './identity.ts';
import type { KeyValueStorage } from './session-storage.ts';
type CallbackResult = 'recovery' | 'signed-in';
interface Dependencies {
  storage: KeyValueStorage; markerKey: string;
  owner(): string | undefined;
  recoveryOwner(): string | null;
  beforeExchange(): void;
  exchange(code: string, flowId?: string): Promise<{ data: { session: { user: { id: string } } | null }; error: unknown }>;
  signOut(): Promise<unknown>;
  setRecovery(value: boolean): void;
}
// One callback exchange per code, including duplicate route mounts. Failed
// exchanges restore a pre-existing recovery guard rather than unlocking it.
export function createAuthCallback(dependencies: Dependencies) {
  let last: { code: string; promise: Promise<CallbackResult> } | null = null;
  let busy = false;
  return async (params: Record<string, unknown>): Promise<CallbackResult> => {
    const input = callbackInput(params);
    if (last?.code === input.code) return last.promise;
    if (busy) throw new Error('Finish the current sign-in link first.');
    busy = true;
    const promise = (async (): Promise<CallbackResult> => {
      const previous = await dependencies.storage.getItem(dependencies.markerKey);
      await dependencies.storage.setItem(dependencies.markerKey, 'pending');
      const owner = dependencies.owner();
      dependencies.beforeExchange();
      let result;
      try {
        result = await dependencies.exchange(input.code, input.flowId);
      } catch {
        // An unexpected storage/SDK exception may occur after a session write.
        // Keep the committed guard until an explicit logout/recovery resolves it.
        dependencies.setRecovery(true);
        throw new Error('Unable to finish this link safely. Sign out and request a fresh email.');
      }
      if (result.error || !result.data.session) {
        if (previous) await dependencies.storage.setItem(dependencies.markerKey, previous);
        else await dependencies.storage.removeItem(dependencies.markerKey);
        throw new Error('This link expired or belongs to another device. Request a new email here.');
      }
      const nextOwner = result.data.session.user.id;
      if (owner && nextOwner !== owner) { await dependencies.signOut(); throw new Error('Account changed. Request a fresh link while signed out.'); }
      const recovery = dependencies.recoveryOwner() === nextOwner;
      if (recovery) await dependencies.storage.setItem(dependencies.markerKey, nextOwner);
      else await dependencies.storage.removeItem(dependencies.markerKey);
      dependencies.setRecovery(recovery);
      return recovery ? 'recovery' : 'signed-in';
    })().finally(() => { busy = false; });
    last = { code: input.code, promise }; return promise;
  };
}
