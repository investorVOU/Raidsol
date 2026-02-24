import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// ── Constants ────────────────────────────────────────────────────────────────
const POOL_PCT = 0.70; // 70% of all entry fees → round pool
export const ROUND_ALLOCATION = [0.40, 0.25, 0.18, 0.11, 0.06]; // top 1-5 share of pool

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
  poolSol: number;             // 70% of all entry fees this window
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

export function useRoundData() {
  const [info, setInfo] = useState<CurrentRoundInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRound = useCallback(async () => {
    const now = new Date();
    const { roundNum, start, end, dateStr } = getRoundBounds(now);
    const roundEnded = end <= now;
    const isActive   = !roundEnded;

    // ── Always fetch live leaders from raid_history ──────────────────────────
    const [successRes, allRes] = await Promise.all([
      supabase
        .from('raid_history')
        .select('wallet_address, points')
        .eq('success', true)
        .gte('created_at', start.toISOString())
        .lt('created_at', end.toISOString())
        .order('points', { ascending: false })
        .limit(200),
      supabase
        .from('raid_history')
        .select('entry_fee')
        .gte('created_at', start.toISOString())
        .lt('created_at', end.toISOString()),
    ]);

    const poolSol = ((allRes.data ?? []).reduce((sum, r) => sum + Number(r.entry_fee), 0)) * POOL_PCT;

    // Deduplicate: keep best points per wallet
    const bestByWallet = new Map<string, number>();
    for (const r of successRes.data ?? []) {
      const pts = Number(r.points);
      if (pts > (bestByWallet.get(r.wallet_address) ?? 0)) {
        bestByWallet.set(r.wallet_address, pts);
      }
    }

    const sorted = [...bestByWallet.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // Fetch usernames for live leaders
    let usernameMap: Record<string, string> = {};
    if (sorted.length > 0) {
      const wallets = sorted.map(([w]) => w);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('wallet_address, username')
        .in('wallet_address', wallets);
      for (const p of profiles ?? []) {
        usernameMap[p.wallet_address] = p.username;
      }
    }

    const currentLeaders: RoundTopEntry[] = sorted.map(([wallet, pts], i) => ({
      rank: i + 1,
      walletAddress: wallet,
      username: usernameMap[wallet] ?? `${wallet.slice(0, 4)}…${wallet.slice(-4)}`,
      pointsScored: pts,
      allocationSol: poolSol * ROUND_ALLOCATION[i],
    }));

    // ── If round has ended, check for finalization ───────────────────────────
    let isFinalized = false;
    let finalWinners: RoundTopEntry[] = [];

    if (roundEnded) {
      const { data: finalizationRow } = await supabase
        .from('round_finalizations')
        .select('pool_sol')
        .eq('round_number', roundNum)
        .eq('round_date', dateStr)
        .maybeSingle();

      if (finalizationRow) {
        isFinalized = true;

        const { data: winnersData } = await supabase
          .from('round_winners')
          .select('rank, wallet_address, points_scored, sol_allocation')
          .eq('round_number', roundNum)
          .eq('round_date', dateStr)
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

    setInfo({
      roundNum,
      roundDate: dateStr,
      startTime: start,
      endTime: end,
      timeRemainingMs: Math.max(0, end.getTime() - now.getTime()),
      isActive,
      isFinalized,
      poolSol,
      currentLeaders,
      finalWinners,
    });
    setLoading(false);
  }, []);

  // Fetch on mount + every 30s
  useEffect(() => {
    fetchRound();
    const interval = setInterval(fetchRound, 30_000);
    return () => clearInterval(interval);
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
