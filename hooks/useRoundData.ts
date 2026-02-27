import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { RaidTier, RAID_TIER_ALLOCATION } from '../types';

// ── Constants ────────────────────────────────────────────────────────────────
// POOL_PCT (0.90) is applied server-side in submit-raid-result via increment_round_pool RPC
/** @deprecated Use RAID_TIER_ALLOCATION from types.ts — kept for backwards compat */
export const ROUND_ALLOCATION = RAID_TIER_ALLOCATION[RaidTier.GRUNT];

export interface RoundTopEntry {
  rank: number;
  walletAddress: string;
  username: string;
  pointsScored: number;  // best single-raid points in the round window
  allocationSol: number; // their SOL share of the pool
}

export interface CurrentRoundInfo {
  roundNum: number;       // 1–4
  roundDate: string;      // YYYY-MM-DD (UTC)
  startTime: Date;
  endTime: Date;
  timeRemainingMs: number;
  isActive: boolean;           // true while round is still running
  isFinalized: boolean;        // true once finalize-round has locked in winners
  isRefunded: boolean;         // true if round was cancelled due to insufficient participants
  poolSol: number;             // 90% of all entry fees this window
  entrantCount: number;        // unique wallets that entered this round/tier
  currentLeaders: RoundTopEntry[];   // live top-5 during active round (from raid_history)
  finalWinners: RoundTopEntry[];     // locked top-5 after finalization (from round_winners)
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Compute UTC round boundaries from an arbitrary Date. */
export function getRoundBounds(now: Date): {
  roundNum: number;
  start: Date;
  end: Date;
  dateStr: string;
} {
  const utcHour = now.getUTCHours();
  const roundNum = Math.floor(utcHour / 6) + 1; // 1-4
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();
  const start = new Date(Date.UTC(y, m, d, (roundNum - 1) * 6));
  const end   = new Date(Date.UTC(y, m, d, roundNum * 6));
  const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return { roundNum, start, end, dateStr };
}

/** Get boundaries for a specific round number + date string (YYYY-MM-DD). */
export function getRoundBoundsFor(roundNum: number, dateStr: string): { start: Date; end: Date } {
  const [y, m, d] = dateStr.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, d, (roundNum - 1) * 6));
  const end   = new Date(Date.UTC(y, m - 1, d, roundNum * 6));
  return { start, end };
}

/** Format a round's UTC time window as a readable label. */
export function formatRoundWindow(roundNum: number): string {
  const s = String((roundNum - 1) * 6).padStart(2, '0');
  const e = String(roundNum * 6 === 24 ? 24 : roundNum * 6).padStart(2, '0');
  return `${s}:00 – ${e}:00 UTC`;
}

/** Format ms remaining as HH:MM:SS. */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00:00';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useRoundData(tier = 'GRUNT') {
  const [info, setInfo] = useState<CurrentRoundInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRound = useCallback(async () => {
    const now = new Date();
    const { roundNum, start, end, dateStr } = getRoundBounds(now);
    const roundEnded = end <= now;
    const isActive   = !roundEnded;

    // ── Fetch live leaders, pool, and entrant count from round_entries ────────
    // round_entries has one row per wallet per round/tier, populated for ALL
    // paid raids (success or bust), so every entrant appears immediately.
    const [entriesRes, poolRes, countRes] = await Promise.all([
      supabase
        .from('round_entries')
        .select('wallet_address, username, best_points')
        .eq('round_number', roundNum)
        .eq('round_date', dateStr)
        .eq('raid_tier', tier)
        .order('best_points', { ascending: false })
        .limit(5),
      supabase
        .from('round_pools')
        .select('pool_sol')
        .eq('round_number', roundNum)
        .eq('round_date', dateStr)
        .eq('raid_tier', tier)
        .maybeSingle(),
      supabase
        .from('round_entries')
        .select('*', { count: 'exact', head: true })
        .eq('round_number', roundNum)
        .eq('round_date', dateStr)
        .eq('raid_tier', tier),
    ]);

    const poolSol      = Number(poolRes.data?.pool_sol ?? 0);
    const entrantCount = countRes.count ?? 0;

    const tierKey = (tier.toUpperCase() as RaidTier) in RAID_TIER_ALLOCATION
      ? (tier.toUpperCase() as RaidTier)
      : RaidTier.GRUNT;
    const tierAlloc = RAID_TIER_ALLOCATION[tierKey];

    // username is denormalized into round_entries — no separate profile lookup needed
    const currentLeaders: RoundTopEntry[] = (entriesRes.data ?? []).map((row, i) => ({
      rank: i + 1,
      walletAddress: row.wallet_address,
      username: row.username || `${row.wallet_address.slice(0, 4)}…${row.wallet_address.slice(-4)}`,
      pointsScored: Number(row.best_points),
      allocationSol: poolSol * (tierAlloc[i] ?? 0),
    }));

    // ── If round has ended, check for finalization ───────────────────────────
    let isFinalized = false;
    let isRefunded  = false;
    let finalWinners: RoundTopEntry[] = [];

    if (roundEnded) {
      const { data: finalizationRow } = await supabase
        .from('round_finalizations')
        .select('pool_sol, refunded')
        .eq('round_number', roundNum)
        .eq('round_date', dateStr)
        .eq('raid_tier', tier)
        .maybeSingle();

      if (finalizationRow) {
        isFinalized = true;
        isRefunded  = !!finalizationRow.refunded;

        if (!isRefunded) {
          const { data: winnersData } = await supabase
            .from('round_winners')
            .select('rank, wallet_address, points_scored, sol_allocation')
            .eq('round_number', roundNum)
            .eq('round_date', dateStr)
            .eq('raid_tier', tier)
            .order('rank');

          // Fetch usernames for final winners
          const winnerWallets = (winnersData ?? []).map(w => w.wallet_address);
          let winnerUsernameMap: Record<string, string> = {};
          if (winnerWallets.length > 0) {
            const { data: wProfiles } = await supabase
              .from('profiles')
              .select('wallet_address, username')
              .in('wallet_address', winnerWallets);
            for (const p of wProfiles ?? []) {
              winnerUsernameMap[p.wallet_address] = p.username;
            }
          }

          finalWinners = (winnersData ?? []).map(w => ({
            rank: w.rank,
            walletAddress: w.wallet_address,
            username: winnerUsernameMap[w.wallet_address] ?? `${w.wallet_address.slice(0, 4)}…${w.wallet_address.slice(-4)}`,
            pointsScored: Number(w.points_scored),
            allocationSol: Number(w.sol_allocation),
          }));
        }
      }
    }

    setInfo({
      roundNum,
      roundDate: dateStr,
      startTime: start,
      endTime: end,
      timeRemainingMs: Math.max(0, end.getTime() - now.getTime()),
      isActive,
      isFinalized,
      isRefunded,
      poolSol,
      entrantCount,
      currentLeaders,
      finalWinners,
    });
    setLoading(false);
  }, [tier]);

  // Fetch on mount + every 30s
  useEffect(() => {
    fetchRound();
    const interval = setInterval(fetchRound, 30_000);
    return () => clearInterval(interval);
  }, [fetchRound]);

  // Realtime: re-fetch when round_entries or round_pools change
  useEffect(() => {
    const channel = supabase
      .channel('round_live_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'round_entries' }, () => {
        fetchRound();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'round_pools' }, () => {
        fetchRound();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchRound]);

  // Live countdown (every second)
  useEffect(() => {
    const timer = setInterval(() => {
      setInfo(prev => {
        if (!prev) return prev;
        const remaining = prev.endTime.getTime() - Date.now();
        if (remaining <= 0) {
          // Round just ended — trigger a refetch to check finalization
          setTimeout(fetchRound, 500);
          return { ...prev, timeRemainingMs: 0, isActive: false };
        }
        return { ...prev, timeRemainingMs: remaining };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [fetchRound]);

  return { info, loading, refetch: fetchRound };
}
