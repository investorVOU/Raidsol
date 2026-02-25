import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

/**
 * check-briefing — Daily cipher puzzle answer submission
 *
 * Input:  { wallet_address, answer, date }
 * Output: { correct, reward_sr?, isFirst? }  — 200 on all valid requests
 *         { error }                           — 4xx on bad input / already claimed
 */

// ── 30-puzzle rotation ──────────────────────────────────────────────────────
// Cipher = displayed string; answer = normalised lowercase solution.
// Caesar shift kept to +3 for simplicity; keyword ciphers kept short.
const PUZZLES: { cipher: string; hint: string; answer: string }[] = [
  { cipher: 'VRODQD',            hint: 'Fastest blockchain',         answer: 'solana' },
  { cipher: 'EORFNFKDLQ',        hint: 'Chain of blocks',            answer: 'blockchain' },
  { cipher: 'VWDNH',             hint: 'Put skin in the game',       answer: 'stake' },
  { cipher: 'ZDOOHW',            hint: 'Holds your keys',            answer: 'wallet' },
  { cipher: 'YDOLGDWRU',         hint: 'Secures the network',        answer: 'validator' },
  { cipher: 'VPDUW FRQWUDFW',    hint: 'Self-executing code',        answer: 'smart contract' },
  { cipher: 'GHFHQWUDOLVHG',     hint: 'No single point of control', answer: 'decentralised' },
  { cipher: 'OLTXLGLWB',         hint: 'Ease of buying/selling',     answer: 'liquidity' },
  { cipher: 'SURWRFRO',          hint: 'Set of rules',               answer: 'protocol' },
  { cipher: 'VLJQDWXUH',         hint: 'Proves you signed it',       answer: 'signature' },
  { cipher: 'PLQWLQJ',           hint: 'Creating new tokens',        answer: 'minting' },
  { cipher: 'EXUQLQJ',           hint: 'Destroying tokens',          answer: 'burning' },
  { cipher: 'ODWHQFB',           hint: 'Network delay',              answer: 'latency' },
  { cipher: 'FRQVHQVXV',         hint: 'Agreement mechanism',        answer: 'consensus' },
  { cipher: 'WRNHQ',             hint: 'Digital asset unit',         answer: 'token' },
  { cipher: 'DLUGUURS',          hint: 'Free token distribution',    answer: 'airdrop' },
  { cipher: 'ZKLWHOLVW',         hint: 'Approved addresses only',    answer: 'whitelist' },
  { cipher: 'VOLFH',             hint: 'A piece of a block',         answer: 'slice' },
  { cipher: 'IRUNH',             hint: 'Split in the chain',         answer: 'fork' },
  { cipher: 'UXJSXOO',           hint: 'Exit scam',                  answer: 'rugpull' },
  { cipher: 'GHILODWLRQ',        hint: 'Token value goes down',      answer: 'deflation' },
  { cipher: 'LQIODWLRQ',         hint: 'Token supply grows',         answer: 'inflation' },
  { cipher: 'EULGGH',            hint: 'Cross-chain connector',      answer: 'bridge' },
  { cipher: 'RSWLPLVWLF',        hint: 'Bullish on the future',      answer: 'optimistic' },
  { cipher: 'SHVVLPLVWLF',       hint: 'Bearish on the future',      answer: 'pessimistic' },
  { cipher: 'OLTXLGDWLRQ',       hint: 'Forced position close',      answer: 'liquidation' },
  { cipher: 'VOLS',              hint: 'Price moved between click and fill', answer: 'slip' },
  { cipher: 'JDV',               hint: 'Transaction fee unit',       answer: 'gas' },
  { cipher: 'QRGH',              hint: 'Network participant',        answer: 'node' },
  { cipher: 'HQFUBSW',           hint: 'Scramble the data',          answer: 'encrypt' },
];

const SR_FIRST  = 1000;
const SR_OTHERS = 200;

Deno.serve(async (req: Request) => {
  const corsH = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsH });
  }

  try {
    const { wallet_address, answer, date } = await req.json();

    if (!wallet_address || !answer || !date) {
      return new Response(
        JSON.stringify({ error: 'wallet_address, answer and date are required' }),
        { status: 400, headers: { ...corsH, 'Content-Type': 'application/json' } },
      );
    }

    // Derive today's puzzle by day index
    const dayIndex = Math.floor(new Date(date + 'T00:00:00Z').getTime() / 86_400_000);
    const puzzle   = PUZZLES[dayIndex % PUZZLES.length];

    // Normalise answer
    const normalised = String(answer).toLowerCase().trim().replace(/\s+/g, ' ');

    if (normalised !== puzzle.answer) {
      // Wrong answer — no info leakage about what the correct answer is
      return new Response(
        JSON.stringify({ correct: false }),
        { status: 200, headers: { ...corsH, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Check if wallet already claimed today
    const { data: existing } = await supabase
      .from('briefing_claims')
      .select('id')
      .eq('wallet_address', wallet_address)
      .eq('date', date)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ error: 'Already claimed today', code: 'ALREADY_CLAIMED' }),
        { status: 409, headers: { ...corsH, 'Content-Type': 'application/json' } },
      );
    }

    // Check if today already has a winner (to decide first vs others)
    const { data: briefing } = await supabase
      .from('daily_briefings')
      .select('winner_wallet')
      .eq('date', date)
      .maybeSingle();

    const isFirst = !briefing?.winner_wallet;
    const rewardSR = isFirst ? SR_FIRST : SR_OTHERS;

    // Credit SR to profile — fetch current value then increment
    const { data: prof } = await supabase
      .from('profiles')
      .select('sr_points')
      .eq('wallet_address', wallet_address)
      .single();

    await supabase
      .from('profiles')
      .update({ sr_points: (prof?.sr_points ?? 0) + rewardSR })
      .eq('wallet_address', wallet_address);

    // Insert briefing_claims row (UNIQUE guard prevents double-claim race)
    const { error: claimErr } = await supabase
      .from('briefing_claims')
      .insert({ wallet_address, date, reward_sr: rewardSR });

    if (claimErr) {
      // Race condition — another request already claimed
      return new Response(
        JSON.stringify({ error: 'Already claimed today', code: 'ALREADY_CLAIMED' }),
        { status: 409, headers: { ...corsH, 'Content-Type': 'application/json' } },
      );
    }

    // Record winner if first solver
    if (isFirst) {
      await supabase
        .from('daily_briefings')
        .upsert({ date, winner_wallet: wallet_address, winner_at: new Date().toISOString() });
    }

    return new Response(
      JSON.stringify({ correct: true, reward_sr: rewardSR, isFirst }),
      { status: 200, headers: { ...corsH, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[check-briefing]', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsH, 'Content-Type': 'application/json' } },
    );
  }
});
