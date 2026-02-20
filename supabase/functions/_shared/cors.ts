/**
 * CORS headers for Solana Raid Edge Functions.
 *
 * Allowed origins: production domains + localhost for local dev.
 * Add any new dev ports to ALLOWED_ORIGINS below.
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

const ALLOWED_ORIGINS = [
  'https://solraid.app',
  'https://www.solraid.app',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:5173',
  'http://localhost:4173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3002',
  'http://127.0.0.1:5173',
];

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  const isAllowed = ALLOWED_ORIGINS.includes(origin);

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wallet-signature, x-wallet-pubkey',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Vary': 'Origin',
  };
}

// Legacy alias kept for any functions still using the old import.
// All functions should use getCorsHeaders(req) instead.
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wallet-signature, x-wallet-pubkey',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};
