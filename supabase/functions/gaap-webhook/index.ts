import { closedEndpoint } from '../_shared/closed-endpoints.ts';
// Future adapters must preserve the app-owned ordering and loyalty ledger.
Deno.serve(closedEndpoint('gaap'));
