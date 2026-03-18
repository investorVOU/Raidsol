import { getCorsHeaders } from '../_shared/cors.ts';

const ULTRA = 'https://lite-api.jup.ag/ultra/v1';
const KEY   = Deno.env.get('JUPITER_API_KEY') ?? '';

const headers = () => ({
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  ...(KEY ? { 'Authorization': `Bearer ${KEY}` } : {}),
});

Deno.serve(async (req: Request) => {
  const corsH = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsH });

  try {
    const body = await req.json();

    // ── GET order (quote preview OR order with taker for execution) ──
    if (body.action === 'order') {
      const qs  = new URLSearchParams(body.params).toString();
      const res = await fetch(`${ULTRA}/order?${qs}`, {
        headers: headers(),
        signal: AbortSignal.timeout(10_000),
      });
      const data = await res.json();
      return new Response(JSON.stringify(data), {
        status: res.ok ? 200 : res.status,
        headers: { ...corsH, 'Content-Type': 'application/json' },
      });
    }

    // ── POST execute (signed transaction + requestId) ──
    if (body.action === 'execute') {
      const res = await fetch(`${ULTRA}/execute`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(body.payload),
        signal: AbortSignal.timeout(15_000),
      });
      const data = await res.json();
      return new Response(JSON.stringify(data), {
        status: res.ok ? 200 : res.status,
        headers: { ...corsH, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400, headers: { ...corsH, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsH, 'Content-Type': 'application/json' },
    });
  }
});
