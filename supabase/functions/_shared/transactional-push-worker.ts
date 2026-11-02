type Job = { id: string; claim_id: string; stage: 'send' | 'receipt' };
type Outcome = 'ticket' | 'provider_accepted' | 'receipt_pending' | 'device_unregistered' | 'rate_limited' | 'provider_error' | 'unknown' | 'permanent_error';
export interface PushWorkerPorts {
  claim(): Promise<unknown>; prepare(job: Job): Promise<unknown>;
  record(job: Job, outcome: Outcome, reference: string | null): Promise<void>;
  fetch: typeof fetch; accessToken: string;
}
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
async function limitedJson(response: Response) {
  const reader = response.body?.getReader(); if (!reader) throw Error('Empty provider response');
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) { const { done, value } = await reader.read(); if (done) break;
      size += value.length; if (size > 65536) throw Error('Oversized provider response'); chunks.push(value); }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return object(JSON.parse(new TextDecoder().decode(bytes)));
  } finally { await reader.cancel().catch(() => {}); }
}
function classify(value: unknown, stage: Job['stage']): { outcome: Outcome; reference: string | null } {
  const entry = object(value);
  if (entry.status === 'ok') {
    if (stage === 'receipt') return { outcome: 'provider_accepted', reference: null };
    if (typeof entry.id === 'string' && /^[A-Za-z0-9_-]{1,200}$/.test(entry.id)) return { outcome: 'ticket', reference: entry.id };
    return { outcome: 'unknown', reference: null };
  }
  const code = object(entry.details).error;
  return { outcome: code === 'DeviceNotRegistered' ? 'device_unregistered' : code === 'MessageRateExceeded' ? 'rate_limited' :
    stage === 'receipt' ? 'unknown' : entry.status === 'error' ? 'permanent_error' : 'unknown', reference: null };
}
export async function runTransactionalPushBatch(ports: PushWorkerPorts) {
  if (!ports.accessToken) throw Error('Push credentials unavailable');
  const rows = await ports.claim(); if (!Array.isArray(rows) || rows.length > 20) throw Error('Invalid worker batch');
  const jobs = rows.map(value => { const row = object(value);
    if (typeof row.id !== 'string' || typeof row.claim_id !== 'string' || !['send', 'receipt'].includes(String(row.stage))) throw Error('Invalid worker claim');
    return row as Job;
  });
  let recorded = 0; let skipped = 0; let unresolved = 0; let cursor = 0;
  const process = async (job: Job) => {
    try {
      const prepared = await ports.prepare(job); if (prepared === null) { skipped++; return; }
      const payload = object(prepared); if (payload.stage !== job.stage) throw Error('Worker stage mismatch');
      const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 8000);
      let result: { outcome: Outcome; reference: string | null } = { outcome: 'unknown', reference: null };
      try {
        const { stage: _stage, ...message } = payload;
        const response = await ports.fetch(job.stage === 'send' ? 'https://exp.host/--/api/v2/push/send' : 'https://exp.host/--/api/v2/push/getReceipts', {
          method: 'POST', redirect: 'error', signal: controller.signal,
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ports.accessToken}` },
          body: JSON.stringify(job.stage === 'send' ? message : { ids: [payload.ticket_id] }),
        });
        if (response.status === 429) result.outcome = 'rate_limited';
        else if (response.status >= 500) result.outcome = 'provider_error';
        else if (!response.ok) result.outcome = job.stage === 'receipt' ? 'unknown' : 'permanent_error';
        else {
          const json = await limitedJson(response);
          const data = job.stage === 'receipt' ? object(json.data)[String(payload.ticket_id)] : Array.isArray(json.data) && json.data.length === 1 ? json.data[0] : json.data;
          result = job.stage === 'receipt' && data === undefined ? { outcome: 'receipt_pending', reference: null } : classify(data, job.stage);
        }
      } catch { /* Transport/malformed replies are ambiguous; never claim delivered. */ }
      finally { clearTimeout(timer); }
      // Retry only recording the same result after a lost database response.
      let saved = false;
      for (let attempt = 0; attempt < 2 && !saved; attempt++) {
        try { await ports.record(job, result.outcome, result.reference); saved = true; } catch { /* Lease retains evidence. */ }
      }
      if (saved) recorded++; else unresolved++;
      if (saved && result.outcome === 'unknown') unresolved++;
    } catch { unresolved++; }
  };
  await Promise.all(Array.from({ length: Math.min(4, jobs.length) }, async () => {
    while (cursor < jobs.length) { const job = jobs[cursor++]; await process(job); }
  }));
  return { claimed: jobs.length, recorded, skipped, unresolved };
}
