import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

const RPC_URLS: string[] = [
  Deno.env.get('SOLANA_RPC_URL'),
  Deno.env.get('HELIUS_RPC_URL'),
  Deno.env.get('ALCHEMY_RPC_URL'),
].filter((u): u is string => typeof u === 'string' && u.startsWith('http'));
if (RPC_URLS.length === 0) RPC_URLS.push('https://api.mainnet-beta.solana.com');

const USDC_MINT = Deno.env.get('USDC_MINT_ADDRESS') ?? 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const SKR_MINT  = Deno.env.get('SKR_MINT_ADDRESS')  ?? 'SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3';

// ── B. On-chain verification constants ────────────────────────────────────
const MAX_TX_AGE_SEC = 600; // 10 minutes (extended for slow networks)

async function solanaRpc(method: string, params: unknown[]): Promise<unknown> {
  let lastErr: unknown;
  for (const url of RPC_URLS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      });
      const json = await res.json();
      if (json.error) throw new Error(`RPC ${method}: ${JSON.stringify(json.error)}`);
      return json.result;
    } catch (e) {
      console.warn(`[RPC] ${url} failed for ${method}:`, e);
      lastErr = e;
    }
  }
  throw lastErr;
}

const respond = (body: object, status = 200, corsH: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsH, 'Content-Type': 'application/json' },
  });

/**
 * verify-payment
 *
 * Called after a user submits an on-chain SOL or USDC payment.
 * Verifies the transaction on-chain, then credits the item to the user's profile.
 *
 * Security B additions:
 *  - Transaction age check: rejects txs older than MAX_TX_AGE_SEC
 *  - Replay attack protection: rejects already-used tx_signature
 *  - Explicit sender verification: wallet_address must be tx fee-payer
 *
 * Body: {
 *   wallet_address: string,
 *   tx_signature: string,
 *   item_id: string,
 *   expected_lamports: number,   // lamports for SOL; micro-USDC (6 dec) for USDC
 *   payment_type: 'STORE_SOL' | 'STORE_USDC' | 'STORE_SKR',
 * }
 */
Deno.serve(async (req: Request) => {
  const corsH = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsH });
  }

  try {
    const { wallet_address, tx_signature, item_id, expected_lamports, payment_type } =
      await req.json();

    if (!wallet_address || !tx_signature || !item_id) {
      return respond({ error: 'wallet_address, tx_signature, and item_id are required' }, 400, corsH);
    }

    const TREASURY_ADDRESS = Deno.env.get('TREASURY_ADDRESS');
    if (!TREASURY_ADDRESS) {
      return respond({ error: 'TREASURY_ADDRESS secret not configured' }, 500, corsH);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ── B1. Replay attack protection — reject duplicate tx_signature ───
    const { data: existingPurchase } = await supabase
      .from('store_purchases')
      .select('tx_signature')
      .eq('tx_signature', tx_signature)
      .maybeSingle();

    if (existingPurchase) {
      return respond({ error: 'This transaction has already been used. Each transaction can only be submitted once.' }, 409, corsH);
    }

    // ── Fetch & validate transaction (retry up to 8x with 1.5s gap) ────
    let txData: any = null;
    for (let attempt = 0; attempt < 8; attempt++) {
      txData = await solanaRpc('getTransaction', [
        tx_signature,
        { encoding: 'json', maxSupportedTransactionVersion: 0, commitment: 'confirmed' },
      ]);
      if (txData) break;
      await new Promise(r => setTimeout(r, 1500));
    }

    if (!txData) {
      return respond({ error: 'Transaction not found after retries. Please try again shortly.' }, 400, corsH);
    }

    if (txData.meta?.err) {
      return respond({ error: 'Transaction failed on-chain' }, 400, corsH);
    }

    // ── B2. Transaction age check ──────────────────────────────────────
    // blockTime is a Unix timestamp (seconds); null if not yet confirmed on an archival node
    const blockTime: number | null = txData.blockTime ?? null;
    if (blockTime !== null) {
      const ageSec = Math.floor(Date.now() / 1000) - blockTime;
      if (ageSec > MAX_TX_AGE_SEC) {
        return respond({
          error: `Transaction is too old (${ageSec}s). Payments must be submitted within ${MAX_TX_AGE_SEC / 60} minutes of the on-chain transaction.`,
        }, 400, corsH);
      }
    }

    // Normalize accountKeys — some RPC nodes return objects { pubkey, signer, writable }
    // instead of plain strings, especially with newer validator versions.
    const rawKeys: (string | { pubkey: string })[] = txData.transaction.message.accountKeys ?? [];
    const accountKeys: string[] = rawKeys.map(k => (typeof k === 'string' ? k : k.pubkey));

    console.log('[verify-payment]', {
      payment_type,
      wallet_address,
      item_id,
      expected_lamports,
      accountKeys_0: accountKeys[0],
      accountKeys_len: accountKeys.length,
      TREASURY_ADDRESS: Deno.env.get('TREASURY_ADDRESS'),
    });

    // ── B3. Sender verification — wallet_address must be the fee-payer ─
    // In a standard Solana transaction the fee-payer is always accountKeys[0].
    if (accountKeys[0] !== wallet_address) {
      return respond({
        error: `Transaction fee-payer mismatch: tx signer=${accountKeys[0]}, expected=${wallet_address}`,
      }, 400, corsH);
    }

    if (payment_type === 'STORE_USDC' || payment_type === 'STORE_SKR') {
      // ── SPL token verification via token balance deltas ──────────────
      const mint = payment_type === 'STORE_USDC' ? USDC_MINT : SKR_MINT;
      const tokenLabel = payment_type === 'STORE_USDC' ? 'USDC' : 'SKR';

      const postTokenBalances: any[] = txData.meta?.postTokenBalances ?? [];
      const preTokenBalances: any[]  = txData.meta?.preTokenBalances  ?? [];

      const treasuryPost = postTokenBalances.find(
        (b: any) => b.mint === mint && b.owner === TREASURY_ADDRESS,
      );
      const treasuryPre = preTokenBalances.find(
        (b: any) => b.mint === mint && b.owner === TREASURY_ADDRESS,
      );

      const postAmount = Number(treasuryPost?.uiTokenAmount?.amount ?? 0);
      const preAmount  = Number(treasuryPre?.uiTokenAmount?.amount  ?? 0);
      const received   = postAmount - preAmount;

      if (received < (expected_lamports ?? 0)) {
        return respond({
          error: `Insufficient ${tokenLabel} payment: received ${received} raw units, expected ${expected_lamports}`,
        }, 400, corsH);
      }
    } else {
      // ── SOL verification via balance deltas ──────────────────────────
      const preBalances: number[]  = txData.meta.preBalances;
      const postBalances: number[] = txData.meta.postBalances;

      // Log all account deltas to help diagnose mismatches
      const deltas = accountKeys.map((k: string, i: number) => ({ key: k, delta: postBalances[i] - preBalances[i] }));
      console.log('[verify-payment] SOL deltas:', JSON.stringify(deltas));
      console.log('[verify-payment] Looking for TREASURY_ADDRESS:', TREASURY_ADDRESS);

      const senderIndex   = accountKeys.indexOf(wallet_address);
      const treasuryIndex = accountKeys.indexOf(TREASURY_ADDRESS);

      if (senderIndex === -1) {
        return respond({ error: 'Sender wallet not found in transaction accounts' }, 400, corsH);
      }

      if (treasuryIndex === -1) {
        // Help diagnose: show which account actually received SOL
        const recipient = deltas.find(d => d.delta > 0 && d.key !== wallet_address);
        return respond({
          error: `Treasury address not found in transaction. Expected treasury: ${TREASURY_ADDRESS}. Actual SOL recipient: ${recipient?.key ?? 'unknown'}. Check TREASURY_ADDRESS Supabase secret.`,
        }, 400, corsH);
      }

      const treasuryReceived = postBalances[treasuryIndex] - preBalances[treasuryIndex];

      if (treasuryReceived <= 0) {
        return respond({
          error: `Treasury address found but received no SOL (delta=${treasuryReceived}). This usually means TREASURY_ADDRESS matches the fee-payer (self-transfer). Treasury: ${TREASURY_ADDRESS}, sender: ${wallet_address}. Are they the same wallet?`,
        }, 400, corsH);
      }

      if (treasuryReceived < (expected_lamports ?? 0)) {
        return respond({
          error: `Insufficient SOL payment: received ${treasuryReceived} lamports, expected ${expected_lamports}`,
        }, 400, corsH);
      }
    }

    // ── Credit item in Supabase ─────────────────────────────────────────
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('owned_item_ids, sr_points')
      .eq('wallet_address', wallet_address)
      .single();

    if (profileError || !profile) {
      return respond({ error: 'Profile not found' }, 404, corsH);
    }

    if (profile.owned_item_ids.includes(item_id)) {
      // Already owned — return success (idempotent)
      return respond({ success: true, already_owned: true, owned_item_ids: profile.owned_item_ids, new_sr_points: profile.sr_points }, 200, corsH);
    }

    // SR reward: 1 SOL = 1000 SR (so price_in_sol * 1000)
    const priceInSol = payment_type === 'STORE_USDC'
      ? (expected_lamports ?? 0) / 1_000_000 / 150    // USDC: 6 decimals, 1 SOL ≈ 150 USDC
      : payment_type === 'STORE_SKR'
      ? (expected_lamports ?? 0) / 1_000_000 / 1000   // SKR:  6 decimals, 1 SOL ≈ 1000 SKR
      : (expected_lamports ?? 0) / 1_000_000_000;     // SOL:  lamports → SOL
    const srReward = Math.max(50, Math.floor(priceInSol * 1000));

    const newOwned = [...profile.owned_item_ids, item_id];
    const newSR    = Number(profile.sr_points) + srReward;

    await supabase
      .from('profiles')
      .update({ owned_item_ids: newOwned, sr_points: newSR, updated_at: new Date().toISOString() })
      .eq('wallet_address', wallet_address);

    // Log purchase in audit table (also serves as replay-protection record)
    await supabase.from('store_purchases').insert({
      wallet_address,
      item_id,
      price_sol: priceInSol,
      tx_signature,
    });

    return respond({ success: true, owned_item_ids: newOwned, new_sr_points: newSR }, 200, corsH);

  } catch (err) {
    return respond({ error: String(err) }, 500, getCorsHeaders(req));
  }
});
