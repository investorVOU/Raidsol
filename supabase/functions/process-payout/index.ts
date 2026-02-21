/**
 * process-payout
 *
 * Sends mainnet SOL from the treasury to a user who has unclaimed_sol.
 * Uses tweetnacl + raw JSON-RPC instead of @solana/web3.js to avoid
 * Deno cold-start failures caused by that package's heavy Node.js imports.
 *
 * Required Supabase secrets:
 *   TREASURY_WALLET_KEYPAIR  — JSON array of 64 bytes (Solana keypair)
 *   SOLANA_RPC_URL           — optional, defaults to mainnet-beta
 */

import nacl from 'https://esm.sh/tweetnacl@1.0.3';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

const RPC_URLS: string[] = [
  Deno.env.get('SOLANA_RPC_URL'),
  Deno.env.get('HELIUS_RPC_URL'),
  Deno.env.get('ALCHEMY_RPC_URL'),
].filter((u): u is string => typeof u === 'string' && u.startsWith('http'));
if (RPC_URLS.length === 0) RPC_URLS.push('https://api.mainnet-beta.solana.com');

// ── E. Treasury Protection limits ─────────────────────────────────────────
// Max SOL per single withdrawal request
const MAX_SINGLE_PAYOUT_SOL = Number(Deno.env.get('MAX_SINGLE_PAYOUT_SOL') ?? '5');
// Max SOL withdrawable per wallet per rolling 24 hours
const MAX_DAILY_PAYOUT_SOL  = Number(Deno.env.get('MAX_DAILY_PAYOUT_SOL')  ?? '20');
const LAMPORTS_PER_SOL = 1_000_000_000;

// ── Helpers ────────────────────────────────────────────────────────────────

const BS58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function bs58Decode(s: string): Uint8Array {
  const out = [0];
  for (const c of s) {
    let carry = BS58.indexOf(c);
    if (carry < 0) throw new Error(`Invalid base58 char: ${c}`);
    for (let i = 0; i < out.length; i++) {
      carry += out[i] * 58;
      out[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry) { out.push(carry & 0xff); carry >>= 8; }
  }
  for (let i = 0; i < s.length && s[i] === '1'; i++) out.push(0);
  return new Uint8Array(out.reverse());
}

function bs58Encode(bytes: Uint8Array): string {
  const d = [0];
  for (const b of bytes) {
    let carry = b;
    for (let i = 0; i < d.length; i++) {
      carry += d[i] << 8;
      d[i] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry) { d.push(carry % 58); carry = (carry / 58) | 0; }
  }
  let r = '';
  for (let i = 0; i < bytes.length && bytes[i] === 0; i++) r += '1';
  for (let i = d.length - 1; i >= 0; i--) r += BS58[d[i]];
  return r;
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrays) { out.set(a, off); off += a.length; }
  return out;
}

// Solana compact-u16 encoding
function cu16(n: number): Uint8Array {
  if (n <= 0x7f) return new Uint8Array([n]);
  if (n <= 0x3fff) return new Uint8Array([(n & 0x7f) | 0x80, n >> 7]);
  return new Uint8Array([(n & 0x7f) | 0x80, ((n >> 7) & 0x7f) | 0x80, n >> 14]);
}

function leU32(n: number): Uint8Array {
  return new Uint8Array([n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff]);
}

function leU64(n: number): Uint8Array {
  const b = new Uint8Array(8);
  let v = n;
  for (let i = 0; i < 8; i++) { b[i] = v & 0xff; v = Math.floor(v / 256); }
  return b;
}

function toBase64(bytes: Uint8Array): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let r = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i], b1 = bytes[i + 1] ?? 0, b2 = bytes[i + 2] ?? 0;
    r += chars[b0 >> 2];
    r += chars[((b0 & 3) << 4) | (b1 >> 4)];
    r += i + 1 < bytes.length ? chars[((b1 & 15) << 2) | (b2 >> 6)] : '=';
    r += i + 2 < bytes.length ? chars[b2 & 63] : '=';
  }
  return r;
}

// ── Solana JSON-RPC ────────────────────────────────────────────────────────

async function rpc<T = unknown>(method: string, params: unknown[]): Promise<T> {
  let lastErr: unknown;
  for (const url of RPC_URLS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      });
      const j = await res.json();
      if (j.error) throw new Error(`RPC ${method}: ${JSON.stringify(j.error)}`);
      return j.result as T;
    } catch (e) {
      console.warn(`[RPC] ${url} failed for ${method}:`, e);
      lastErr = e;
    }
  }
  throw lastErr;
}

// ── Transaction builder ────────────────────────────────────────────────────
// Builds a minimal SystemProgram.transfer transaction message.
// Account order: [from(signer), to, systemProgram(11111...)]
// SystemProgram ID = 32 zero bytes in binary / "1111...1111" in base58.

const SYSTEM_PROGRAM = new Uint8Array(32); // all zeros = system program

function buildTransferMessage(
  from: Uint8Array,
  to: Uint8Array,
  lamports: number,
  blockhash: Uint8Array,
): Uint8Array {
  const instrData = concat(leU32(2), leU64(lamports)); // SystemProgram::transfer enum index 2
  return concat(
    new Uint8Array([1, 0, 1]),                // message header
    cu16(3), from, to, SYSTEM_PROGRAM,        // 3 account keys
    blockhash,                                // recent blockhash
    cu16(1),                                  // 1 instruction
    new Uint8Array([2]),                      // programIdIndex = 2 (system program)
    cu16(2), new Uint8Array([0, 1]),          // accounts: from=0, to=1
    cu16(instrData.length), instrData,        // instruction data
  );
}

// ── Edge function ──────────────────────────────────────────────────────────

const json = (body: object, status = 200, corsH: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsH, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req: Request) => {
  const corsH = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsH });
  }

  try {
    const { wallet_address, amount_sol } = await req.json();

    if (!wallet_address || !amount_sol || amount_sol <= 0) {
      return json({ error: 'wallet_address and a positive amount_sol are required' }, 400, corsH);
    }

    // ── F. Wallet ownership verification ──────────────────────────────
    // Client must sign the message  "payout:<wallet>:<amount>"  with its
    // Solana keypair and pass the base58 signature + pubkey as headers.
    const sigHeader    = req.headers.get('x-wallet-signature');
    const pubkeyHeader = req.headers.get('x-wallet-pubkey');

    if (!sigHeader || !pubkeyHeader) {
      return json({
        error: 'Wallet signature required. Headers: x-wallet-signature (base58), x-wallet-pubkey (base58)',
      }, 401, corsH);
    }

    try {
      // Signature arrives as standard base64 (browser btoa); pubkey as base58
      const sigBytes    = Uint8Array.from(atob(sigHeader), c => c.charCodeAt(0));
      const pubkeyBytes = bs58Decode(pubkeyHeader);

      // Pubkey header must match the wallet being paid out
      if (bs58Encode(pubkeyBytes) !== wallet_address) {
        return json({ error: 'x-wallet-pubkey does not match wallet_address' }, 401, corsH);
      }

      // Message = UTF-8 bytes of "payout:<wallet>:<amount>"
      const message = new TextEncoder().encode(`payout:${wallet_address}:${amount_sol}`);
      const valid   = nacl.sign.detached.verify(message, sigBytes, pubkeyBytes);
      if (!valid) {
        return json({ error: 'Invalid wallet signature — are you signing the correct message?' }, 401, corsH);
      }
    } catch (e) {
      return json({ error: `Signature verification error: ${e}` }, 401, corsH);
    }

    // ── E. Single-withdrawal cap ───────────────────────────────────────
    if (Number(amount_sol) > MAX_SINGLE_PAYOUT_SOL) {
      return json({
        error: `Single withdrawal capped at ${MAX_SINGLE_PAYOUT_SOL} SOL. Split your withdrawal into smaller amounts.`,
      }, 400, corsH);
    }

    console.log(`[payout] START wallet=${wallet_address} amount=${amount_sol} rpc=${RPC}`);

    // ── Load treasury keypair ─────────────────────────────────────────
    const keypairJson = Deno.env.get('TREASURY_WALLET_KEYPAIR');
    if (!keypairJson) {
      return json({ error: 'TREASURY_WALLET_KEYPAIR secret not configured' }, 500, corsH);
    }

    let keypair: nacl.SignKeyPair;
    try {
      keypair = nacl.sign.keyPair.fromSecretKey(new Uint8Array(JSON.parse(keypairJson)));
    } catch (e) {
      return json({ error: `Invalid TREASURY_WALLET_KEYPAIR: ${e}` }, 500);
    }

    const treasuryAddress = bs58Encode(keypair.publicKey);
    console.log(`[payout] treasury pubkey: ${treasuryAddress}`);

    // ── Supabase ─────────────────────────────────────────────────────
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ── E. Daily withdrawal limit check ──────────────────────────────
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentWithdrawals } = await supabase
      .from('withdrawals')
      .select('amount_sol')
      .eq('wallet_address', wallet_address)
      .eq('status', 'CONFIRMED')
      .gte('created_at', since24h);

    const dailyTotal = (recentWithdrawals ?? []).reduce(
      (sum: number, w: { amount_sol: number }) => sum + Number(w.amount_sol),
      0,
    );

    if (dailyTotal + Number(amount_sol) > MAX_DAILY_PAYOUT_SOL) {
      const remaining = Math.max(0, MAX_DAILY_PAYOUT_SOL - dailyTotal);
      return json({
        error: `Daily withdrawal limit (${MAX_DAILY_PAYOUT_SOL} SOL) reached. You have ${remaining.toFixed(4)} SOL remaining today.`,
      }, 429, corsH);
    }

    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('unclaimed_sol, username')
      .eq('wallet_address', wallet_address)
      .single();

    if (profileErr || !profile) {
      return json({ error: 'Profile not found' }, 404, corsH);
    }

    const available = Number(profile.unclaimed_sol);
    const actualAmount = Math.min(Number(amount_sol), available);
    if (actualAmount <= 0) {
      return json({ error: 'No unclaimed balance available' }, 400, corsH);
    }

    const lamports = Math.round(actualAmount * LAMPORTS_PER_SOL);
    console.log(`[payout] available=${available} actualAmount=${actualAmount} lamports=${lamports}`);

    // ── Atomically deduct first (double-spend guard) ──────────────────
    const { error: deductErr } = await supabase
      .from('profiles')
      .update({ unclaimed_sol: Math.max(0, available - actualAmount), updated_at: new Date().toISOString() })
      .eq('wallet_address', wallet_address)
      .gte('unclaimed_sol', actualAmount);

    if (deductErr) {
      console.error('[payout] deduct error:', deductErr);
      return json({ error: 'Balance update conflict — please retry' }, 409, corsH);
    }

    // ── Check on-chain treasury balance ──────────────────────────────
    let treasuryLamports = 0;
    try {
      const balResult = await rpc<{ value: number }>('getBalance', [treasuryAddress, { commitment: 'confirmed' }]);
      treasuryLamports = balResult.value;
      console.log(`[payout] treasury on-chain: ${treasuryLamports} lamports (${treasuryLamports / LAMPORTS_PER_SOL} SOL)`);
    } catch (e) {
      console.warn('[payout] Could not fetch treasury balance:', e);
    }

    if (treasuryLamports < lamports + 5000) {
      // Restore unclaimed and abort
      await supabase.from('profiles')
        .update({ unclaimed_sol: available, updated_at: new Date().toISOString() })
        .eq('wallet_address', wallet_address);
      return json({
        error: `Treasury has insufficient funds: ${treasuryLamports} lamports on-chain, need ${lamports + 5000}. Address: ${treasuryAddress}`,
      }, 500, corsH);
    }

    // ── Build + sign + send transaction ──────────────────────────────
    let txSignature: string;
    try {
      const { value: { blockhash, lastValidBlockHeight } } = await rpc<{
        value: { blockhash: string; lastValidBlockHeight: number };
      }>('getLatestBlockhash', [{ commitment: 'confirmed' }]);

      console.log(`[payout] blockhash=${blockhash}`);

      const from = keypair.publicKey;
      const to = bs58Decode(wallet_address);
      const bh = bs58Decode(blockhash);

      const message = buildTransferMessage(from, to, lamports, bh);
      const sig = nacl.sign.detached(message, keypair.secretKey);
      const rawTx = toBase64(concat(cu16(1), sig, message));

      txSignature = await rpc<string>('sendTransaction', [
        rawTx,
        { encoding: 'base64', skipPreflight: false, preflightCommitment: 'confirmed' },
      ]);

      console.log(`[payout] tx sent: ${txSignature}`);

      // Poll for confirmation
      let confirmed = false;
      for (let attempt = 0; attempt < 20; attempt++) {
        await new Promise(r => setTimeout(r, 1500));
        const statuses = await rpc<{ value: Array<{ confirmationStatus?: string; err?: unknown } | null> }>(
          'getSignatureStatuses', [[txSignature]],
        );
        const s = statuses.value[0];
        if (s && (s.confirmationStatus === 'confirmed' || s.confirmationStatus === 'finalized')) {
          if (s.err) throw new Error(`Transaction failed on-chain: ${JSON.stringify(s.err)}`);
          confirmed = true;
          console.log(`[payout] tx confirmed: ${txSignature}`);
          break;
        }
        // Stop polling if block expired
        const currentHeight = await rpc<number>('getBlockHeight', []).catch(() => 0) as number;
        if (currentHeight > lastValidBlockHeight) {
          throw new Error('Transaction expired (block height exceeded)');
        }
      }

      if (!confirmed) throw new Error('Transaction confirmation timed out after 30s');
    } catch (txErr) {
      console.error('[payout] tx failed — restoring unclaimed_sol:', txErr);
      await supabase.from('profiles')
        .update({ unclaimed_sol: available, updated_at: new Date().toISOString() })
        .eq('wallet_address', wallet_address);
      return json({ error: `On-chain transaction failed: ${txErr}` }, 500, corsH);
    }

    // ── Mark confirmed in DB ──────────────────────────────────────────
    await supabase.from('withdrawals').insert({
      wallet_address,
      amount_sol: actualAmount,
      tx_signature: txSignature,
      status: 'CONFIRMED',
    }).then(() => {}); // ignore if table doesn't exist yet

    await supabase.from('activity_feed').insert({
      event_type: 'PAYOUT',
      username: profile.username || wallet_address.slice(0, 6) + '...',
      amount_sol: actualAmount,
    });

    console.log(`[payout] SUCCESS amount=${actualAmount} tx=${txSignature}`);
    return json({ success: true, tx_signature: txSignature, amount_paid: actualAmount }, 200, corsH);

  } catch (err) {
    console.error('[payout] Unhandled error:', err);
    return json({ error: `Unexpected error: ${err}` }, 500, corsH);
  }
});
