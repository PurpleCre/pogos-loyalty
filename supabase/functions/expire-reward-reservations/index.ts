import { createInternalWorker } from '../_shared/internal-workers.ts';
Deno.serve(createInternalWorker('reward-expiry'));
