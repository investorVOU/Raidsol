import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { getRoundBoundsFor, ROUND_ALLOCATION } from './useRoundData';

export interface HistoricalRoundEntry {
  rank: number;
  walletAddress: string;
  username: string;
  solExtracted: number;
  allocationSol: number;
}

export interface HistoricalRound {
  roundNum: number;
  roundDate: string;   // YYYY-MM-DD
  startTime: Date;
  endTime: Date;
  poolSol: number;
  entries: HistoricalRoundEntry[]; // top 5
}

const POOL_PCT = 0.70;

/** Build a list of the last N completed round descriptors (roundNum + roundDate). */
function getLastCompletedRounds(count: number): Array<{ roundNum: number; roundDate: string }> {
  const now = new Date();
  const utcHour = now.getUTCHours();
  const currentRound = Math.floor(utcHour / 6) + 1;

  const rounds: Array<{ roundNum: number; roundDate: string }> = [];
  let r = currentRound - 1;
  let d = new Date(now);

  while (rounds.length < count) {
    if (r <= 0) {
      // Go to previous day, start at round 4
      d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - 1));
      r = 4;
    }
    const dateStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    rounds.push({ roundNum: r, roundDate: dateStr });
    r--;
  }
  return rounds;
}

export function useRoundHistory(count = 8) {
  const [rounds, setRounds] = useState<HistoricalRound[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    const descriptors = getLastCompletedRounds(count);

    // Find widest time window to bulk-fetch raid_history
    const allStarts = descriptors.map(d => getRoundBoundsFor(d.roundNum, d.roundDate).start);
    const allEnds   = descriptors.map(d => getRoundBoundsFor(d.roundNum, d.roundDate).end);
    const minStart  = new Date(Math.min(...allStarts.map(t => t.getTime())));
    const maxEnd    = new Date(Math.max(...allEnds.map(t => t.getTime())));

    // Bulk fetch all raids in the combined window
    const [successRes, allRes] = await Promise.all([
      supabase
        .from('raid_history')
        .select('wallet_address, sol_amount, created_at')
        .eq('success', true)
        .gte('created_at', minStart.toISOString())
        .lt('created_at', maxEnd.toISOString())
        .order('sol_amount', { ascending: false })
        .limit(2000),
      supabase
        .from('raid_history')
        .select('entry_fee, created_at')
        .gte('created_at', minStart.toISOString())
        .lt('created_at', maxEnd.toISOString()),
    ]);

    const successRaids = successRes.data ?? [];
    const allRaids = allRes.data ?? [];

    // Collect all unique wallets for username lookup
    const walletSet = new Set(successRaids.map(r => r.wallet_address));
    let usernameMap: Record<string, string> = {};
    if (walletSet.size > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('wallet_address, username')
        .in('wallet_address', [...walletSet]);
      for (const p of profiles ?? []) {
        usernameMap[p.wallet_address] = p.username;
      }
    }

    // Build per-round data
    const result: HistoricalRound[] = [];
    for (const desc of descriptors) {
      const { start, end } = getRoundBoundsFor(desc.roundNum, desc.roundDate);

      // Pool = 8% of all entry fees in window
      const poolSol = allRaids
        .filter(r => {
          const t = new Date(r.created_at).getTime();
          return t >= start.getTime() && t < end.getTime();
        })
        .reduce((sum, r) => sum + Number(r.entry_fee), 0) * POOL_PCT;

      // Best sol per wallet in this window
      const bestByWallet = new Map<string, number>();
      for (const r of successRaids) {
        const t = new Date(r.created_at).getTime();
        if (t < start.getTime() || t >= end.getTime()) continue;
        const sol = Number(r.sol_amount);
        const best = bestByWallet.get(r.wallet_address) ?? 0;
        if (sol > best) bestByWallet.set(r.wallet_address, sol);
      }

      const sorted = [...bestByWallet.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      const entries: HistoricalRoundEntry[] = sorted.map(([wallet, sol], i) => ({
        rank: i + 1,
        walletAddress: wallet,
        username: usernameMap[wallet] ?? `${wallet.slice(0, 4)}…${wallet.slice(-4)}`,
        solExtracted: sol,
        allocationSol: poolSol * ROUND_ALLOCATION[i],
      }));

      result.push({
        roundNum: desc.roundNum,
        roundDate: desc.roundDate,
        startTime: start,
        endTime: end,
        poolSol,
        entries,
      });
    }

    setRounds(result);
    setLoading(false);
  }, [count]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  return { rounds, loading, refetch: fetchHistory };
}
