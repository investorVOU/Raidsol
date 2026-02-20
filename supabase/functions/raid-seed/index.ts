import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

/**
 * raid-seed — Provably Fair Pre-Commitment
 *
 * Called BEFORE the player enters a raid.
 * Generates a cryptographically secure server seed, stores it hashed,
 * and returns only the hash to the client.
 * The raw seed is revealed via submit-raid-result after the raid ends,
 * allowing anyone to verify the outcome was not manipulated.
 */
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { wallet_address } = await req.json();

    if (!wallet_address) {
      return new Response(
        JSON.stringify({ error: 'wallet_address required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Cryptographically secure random server seed (32 bytes → 64-char hex)
    const seedBytes = new Uint8Array(32);
    crypto.getRandomValues(seedBytes);
    const serverSeed = Array.from(seedBytes, (b) => b.toString(16).padStart(2, '0')).join('');

    // SHA-256 commitment hash shown to the player pre-raid
    const hashBuffer = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(serverSeed),
    );
    const serverSeedHash = Array.from(
      new Uint8Array(hashBuffer),
      (b) => b.toString(16).padStart(2, '0'),
    ).join('');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data, error } = await supabase
      .from('raid_seeds')
      .insert({ wallet_address, server_seed: serverSeed, server_seed_hash: serverSeedHash })
      .select('id, server_seed_hash')
      .single();

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({ seed_id: data.id, server_seed_hash: data.server_seed_hash }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
