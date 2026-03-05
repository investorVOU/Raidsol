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

    const [entriesRes, winsRes] = await Promise.all([
      supabase
        .from('round_entries')
        .select('round_number, round_date, raid_tier, best_points, entry_count')
        .eq('wallet_address', walletAddress)
        .order('round_date', { ascending: false })
        .order('round_number', { ascending: false })
        .limit(50),
      supabase
        .from('round_winners')
        .select('id, round_number, round_date, rank, pool_sol, sol_allocation, claimed, claimed_at')
        .eq('wallet_address', walletAddress)
        .limit(50),
    ]);

    const rawEntries = entriesRes.data ?? [];
    const rawWins = winsRes.data ?? [];

    if (entriesRes.error) console.error('[useRoundEntries] entries error:', entriesRes.error.message);
    if (winsRes.error) console.error('[useRoundEntries] wins error:', winsRes.error.message);

    // round_winners keyed by "roundNum:roundDate" (no tier — winners table has no tier column)
    const winMap = new Map<string, typeof rawWins[0]>();
    for (const w of rawWins) {
      winMap.set(`${w.round_number}:${w.round_date}`, w);
    }

    const result: RoundEntry[] = rawEntries.map(e => {
      const winKey = `${e.round_number}:${e.round_date}`;
      const win = winMap.get(winKey);
      const entryKey = `${e.round_number}:${e.round_date}:${e.raid_tier}`;

      let status: RoundEntryStatus = 'PENDING';
      if (win) status = win.rank === 0 ? 'REFUND' : 'WIN';

      return {
        key: entryKey,
        roundNum: e.round_number,
        roundDate: e.round_date,
        raidTier: e.raid_tier ?? 'GRUNT',
        points: Number(e.best_points ?? 0),
        entryCount: Number(e.entry_count ?? 1),
        winnerId: win?.id ?? null,
        rank: win ? win.rank : null,
        poolSol: win ? Number(win.pool_sol) : null,
        solAllocation: win ? Number(win.sol_allocation) : null,
        claimed: win?.claimed ?? false,
        claimedAt: win?.claimed_at ?? null,
        status,
      };
    });

    setEntries(result);
    setLoading(false);
  }, [walletAddress]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  return { entries, loading, refetch: fetchEntries };
}
