import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export type RoundEntryStatus = 'WIN' | 'REFUND' | 'PENDING';

export interface RoundEntry {
  // composite key
  key: string;
  roundNum: number;
  roundDate: string;
  raidTier: string;
  points: number;
  entryCount: number;
  // from round_winners (if finalized)
  winnerId: string | null;
  rank: number | null;
  poolSol: number | null;
  solAllocation: number | null;
  claimed: boolean;
  claimedAt: string | null;
  status: RoundEntryStatus;
}

export function useRoundEntries(walletAddress: string | null) {
  const [entries, setEntries] = useState<RoundEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchEntries = useCallback(async () => {
    if (!walletAddress) { setEntries([]); return; }
    setLoading(true);

    const [entriesRes, winsRes, refundsRes] = await Promise.all([
      supabase
        .from('round_entries')
        .select('round_number, round_date, raid_tier, best_points, entry_count')
        .eq('wallet_address', walletAddress)
        .order('round_date', { ascending: false })
        .order('round_number', { ascending: false })
        .limit(50),
      supabase
        .from('round_winners')
        .select('id, round_number, round_date, raid_tier, rank, pool_sol, sol_allocation, claimed, claimed_at')
        .eq('wallet_address', walletAddress)
        .limit(50),
      supabase
        .from('round_refund_logs')
        .select('round_number, round_date, raid_tier, amount_sol, created_at')
        .eq('wallet_address', walletAddress)
        .limit(200),
    ]);

    const rawEntries = entriesRes.data ?? [];
    const rawWins = winsRes.data ?? [];
    const rawRefunds = refundsRes.data ?? [];

    if (entriesRes.error) console.error('[useRoundEntries] entries error:', entriesRes.error.message);
    if (winsRes.error) console.error('[useRoundEntries] wins error:', winsRes.error.message);
    if (refundsRes.error) console.error('[useRoundEntries] refunds error:', refundsRes.error.message);

    const normalizeDate = (d: string) => d.length > 10 ? d.slice(0, 10) : d;
    const normalizedEntries = rawEntries.map(e => ({
      ...e,
      round_date: normalizeDate(String(e.round_date)),
      raid_tier: e.raid_tier ?? 'GRUNT',
    }));
    const normalizedWins = rawWins.map(w => ({
      ...w,
      round_date: normalizeDate(String(w.round_date)),
      raid_tier: w.raid_tier ?? 'GRUNT',
    }));
    const normalizedRefunds = rawRefunds.map(r => ({
      ...r,
      round_date: normalizeDate(String(r.round_date)),
      raid_tier: r.raid_tier ?? 'GRUNT',
    }));

    const rawRounds = normalizedEntries.map(e => ({
      round_number: e.round_number,
      round_date: e.round_date,
      raid_tier: e.raid_tier ?? 'GRUNT',
    }));

    // Fetch finalizations for any rounds the wallet entered to detect refunds.
    // Supabase doesn't support composite IN, so we IN each field (may overfetch).
    const roundNums = [...new Set(rawRounds.map(r => r.round_number))];
    const roundDates = [...new Set(rawRounds.map(r => r.round_date))];
    const tiers = [...new Set(rawRounds.map(r => r.raid_tier))];

    let finalizations: Array<{ round_number: number; round_date: string; raid_tier: string; refunded: boolean }> = [];
    if (roundNums.length && roundDates.length && tiers.length) {
      const { data: finalsRes, error: finalsErr } = await supabase
        .from('round_finalizations')
        .select('round_number, round_date, raid_tier, refunded')
        .in('round_number', roundNums)
        .in('round_date', roundDates)
        .in('raid_tier', tiers)
        .limit(200);
      if (finalsErr) console.error('[useRoundEntries] finalizations error:', finalsErr.message);
      finalizations = finalsRes ?? [];
    }

    // round_winners keyed by "roundNum:roundDate:raidTier"
    const winMap = new Map<string, typeof rawWins[0]>();
    for (const w of normalizedWins) {
      const tier = (w.raid_tier ?? 'GRUNT') as string;
      winMap.set(`${w.round_number}:${w.round_date}:${tier}`, w);
    }

    // round_finalizations keyed by "roundNum:roundDate:raidTier"
    const finalMap = new Map<string, typeof finalizations[0]>();
    for (const f of finalizations) {
      const dateStr = normalizeDate(String(f.round_date));
      finalMap.set(`${f.round_number}:${dateStr}:${f.raid_tier}`, { ...f, round_date: dateStr });
    }

    // round_refund_logs keyed by "roundNum:roundDate:raidTier"
    const refundMap = new Map<string, typeof normalizedRefunds[0]>();
    for (const r of normalizedRefunds) {
      refundMap.set(`${r.round_number}:${r.round_date}:${r.raid_tier}`, r);
    }

    const result: RoundEntry[] = normalizedEntries.map(e => {
      const tier = e.raid_tier ?? 'GRUNT';
      const winKey = `${e.round_number}:${e.round_date}:${tier}`;
      const win = winMap.get(winKey);
      const fin = finalMap.get(winKey);
      const refund = refundMap.get(winKey);
      const entryKey = `${e.round_number}:${e.round_date}:${e.raid_tier}`;

      let status: RoundEntryStatus = 'PENDING';
      if (win) status = win.rank === 0 ? 'REFUND' : 'WIN';
      else if (fin?.refunded) status = 'REFUND';

      const isRefund = status === 'REFUND';
      const claimed = isRefund ? !!refund : (win?.claimed ?? false);
      const claimedAt = isRefund ? (refund?.created_at ?? null) : (win?.claimed_at ?? null);

      return {
        key: entryKey,
        roundNum: e.round_number,
        roundDate: e.round_date,
        raidTier: tier,
        points: Number(e.best_points ?? 0),
        entryCount: Number(e.entry_count ?? 1),
        winnerId: win?.id ?? null,
        rank: win ? win.rank : null,
        poolSol: win ? Number(win.pool_sol) : null,
        solAllocation: win ? Number(win.sol_allocation) : null,
        claimed,
        claimedAt,
        status,
      };
    });

    setEntries(result);
    setLoading(false);
  }, [walletAddress]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  return { entries, loading, refetch: fetchEntries };
}
