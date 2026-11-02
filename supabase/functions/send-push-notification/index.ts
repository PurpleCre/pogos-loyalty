import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
// Arbitrary-recipient VAPID/Capacitor broadcasts and fake deliveries retired.
// Transactional messages originate only in trusted database event triggers.
serve(() => new Response(JSON.stringify({ error: 'Legacy push sender retired' }), {
  status: 410, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
}));
