/**
 * CORS headers for Solana Raid Edge Functions.
 *
 * Using wildcard origin so mobile dapp browsers (Seeker, Phantom In-App,
 * Solflare WebView) can call edge functions without being blocked.
 * Supabase edge functions are already protected by the `apikey` header,
 * so wildcard CORS does not meaningfully reduce security.
 *
 * Usage in every edge function:
 *   import { getCorsHeaders } from '../_shared/cors.ts';
 *   const corsH = getCorsHeaders(req);
 *
 *   if (req.method === 'OPTIONS') {
 *     return new Response('ok', { headers: corsH });
 *   }
 *   return new Response(JSON.stringify(data), {
 *     headers: { ...corsH, 'Content-Type': 'application/json' },
 *   });
 */

export function getCorsHeaders(_req?: Request): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wallet-signature, x-wallet-pubkey',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  };
}

// Legacy alias — kept for backwards compat.
export const corsHeaders = getCorsHeaders();
