const messages = {
  gaap: 'GAAP integration awaits the approved ordering and external-loyalty contract.',
  marketing: 'Marketing delivery is unavailable pending an approved delivery implementation.',
  support: 'Automated support is unavailable. Contact Pogo’s for help.',
  'legacy-push': 'Legacy push sender retired',
} as const;

// No environment activation switch, SDK, body parsing or provider calls.
// A new reviewed implementation is required to enable these services.
export function closedEndpoint(kind: keyof typeof messages) {
  return (request: Request): Response => {
    const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
      'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...headers, Allow: 'POST, OPTIONS' } });
    return new Response(JSON.stringify({ error: messages[kind] }), { status: kind === 'legacy-push' ? 410 : 503, headers });
  };
}
