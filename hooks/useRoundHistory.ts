import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { getRoundBoundsFor } from './useRoundData';
import { RAID_TIER_ALLOCATION, RaidTier } from '../types';

export const ROUNDS_PAGE_SIZE = 8;

export interface HistoricalRoundEntry {
  rank: number;
  walletAddress: string;
  username: string;
  pointsScored: number;
  allocationSol: number;
  claimed: boolean;
}

export interface HistoricalRound {
  roundNum: number;
  roundDate: string;   // YYYY-MM-DD
  raidTier: string;
  startTime: Date;
  endTime: Date;
  poolSol: number;
  finalized: boolean;
  refunded: boolean;
  entries: HistoricalRoundEntry[]; // top 5 winners (empty if refunded or no entries)
}

export function useRoundHistory(tier = 'GRUNT', page = 0) {
  const [rounds, setRounds] = useState<HistoricalRound[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);

  const fetchHistory = useCallback(async () => {
    setLoading(true);

    const offset = page * ROUNDS_PAGE_SIZE;

    // 1. Fetch paginated finalizations for this tier, newest first.
    //    Fetch one extra row to detect whether a next page exists.
    const { data: finalizations } = await supabase
      .from('round_finalizations')
      .select('round_number, round_date, raid_tier, pool_sol, refunded')
      .eq('raid_tier', tier)
      .order('round_date', { ascending: false })
      .order('round_number', { ascending: false })
      .range(offset, offset + ROUNDS_PAGE_SIZE); // one extra

    if (!finalizations || finalizations.length === 0) {
      setRounds([]);
      setHasMore(false);
      setLoading(false);
      return;
    }

    const hasMoreData = finalizations.length > ROUNDS_PAGE_SIZE;
    const pageData    = finalizations.slice(0, ROUNDS_PAGE_SIZE);
    setHasMore(hasMoreData);

    // 2. Fetch winners for each finalization concurrently
    const winnerPromises = pageData.map(f =>
      supabase
        .from('round_winners')
        .select('rank, wallet_address, points_scored, sol_allocation, claimed')
        .eq('round_number', f.round_number)
        .eq('round_date',   f.round_date)
        .eq('raid_tier',    tier)
        .order('rank'),
    );
    const winnerResults = await Promise.all(winnerPromises);

    // 3. Batch username lookup from profiles
    const allWallets = [
      ...new Set(
        winnerResults.flatMap(r => (r.data ?? []).map(w => w.wallet_address)),
      ),
    ];
    let usernameMap: Record<string, string> = {};
    if (allWallets.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('wallet_address, username')
        .in('wallet_address', allWallets);
      for (const p of profiles ?? []) {
        usernameMap[p.wallet_address] = p.username;
      }
    }

    // 4. Build HistoricalRound objects
    const tierKey = (tier.toUpperCase() as RaidTier) in RAID_TIER_ALLOCATION
      ? (tier.toUpperCase() as RaidTier)
      : RaidTier.GRUNT;

    const result: HistoricalRound[] = pageData.map((f, i) => {
      const dateStr = typeof f.round_date === 'string'
        ? f.round_date.slice(0, 10)
        : f.round_date;
      const { start, end } = getRoundBoundsFor(f.round_number, dateStr);
      const poolSol = Number(f.pool_sol ?? 0);
      const winners = winnerResults[i].data ?? [];

      const entries: HistoricalRoundEntry[] = winners.map(w => ({
        rank:         w.rank,
        walletAddress: w.wallet_address,
        username:     usernameMap[w.wallet_address] ?? `${w.wallet_address.slice(0, 4)}…${w.wallet_address.slice(-4)}`,
        pointsScored: Number(w.points_scored ?? 0),
        allocationSol: Number(w.sol_allocation ?? 0),
        claimed:      !!w.claimed,
      }));

      return {
        roundNum:  f.round_number,
        roundDate: dateStr,
        raidTier:  tier,
        startTime: start,
        endTime:   end,
        poolSol,
        finalized: true,
        refunded:  !!f.refunded,
        entries,
      };
    });

    setRounds(result);
    setLoading(false);
  }, [tier, page]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  return { rounds, loading, hasMore, refetch: fetchHistory };
}
