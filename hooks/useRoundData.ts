import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// ── Constants ────────────────────────────────────────────────────────────────
const POOL_PCT = 0.70; // 70% of all entry fees → round pool
export const ROUND_ALLOCATION = [0.40, 0.25, 0.18, 0.11, 0.06]; // top 1-5 share

export interface RoundTopEntry {
  rank: number;
  walletAddress: string;
  username: string;
  solExtracted: number;
  allocationSol: number; // their share of the pool
}

export interface CurrentRoundInfo {
  roundNum: number;       // 1–4
  roundDate: string;      // YYYY-MM-DD (UTC)
  startTime: Date;
  endTime: Date;
  timeRemainingMs: number;
  poolSol: number;        // 8% of all entry fees this window
  topExtractors: RoundTopEntry[];
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

    // Fetch successful raids in this round window (ordered by sol desc for dedup)
    const [successRes, allRes] = await Promise.all([
      supabase
        .from('raid_history')
        .select('wallet_address, sol_amount')
        .eq('success', true)
        .gte('created_at', start.toISOString())
        .lt('created_at', end.toISOString())
        .order('sol_amount', { ascending: false })
        .limit(200),
      supabase
        .from('raid_history')
        .select('entry_fee')
        .gte('created_at', start.toISOString())
        .lt('created_at', end.toISOString()),
    ]);

    const poolSol = ((allRes.data ?? []).reduce((sum, r) => sum + Number(r.entry_fee), 0)) * POOL_PCT;

    // Deduplicate: keep best sol per wallet
    const bestByWallet = new Map<string, number>();
    for (const r of successRes.data ?? []) {
      const sol = Number(r.sol_amount);
      const best = bestByWallet.get(r.wallet_address) ?? 0;
      if (sol > best) bestByWallet.set(r.wallet_address, sol);
    }

    // Sort descending, take top 5
    const sorted = [...bestByWallet.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // Fetch usernames for top wallets
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

    const topExtractors: RoundTopEntry[] = sorted.map(([wallet, sol], i) => ({
      rank: i + 1,
      walletAddress: wallet,
      username: usernameMap[wallet] ?? `${wallet.slice(0, 4)}…${wallet.slice(-4)}`,
      solExtracted: sol,
      allocationSol: poolSol * ROUND_ALLOCATION[i],
    }));

    setInfo({
      roundNum,
      roundDate: dateStr,
      startTime: start,
      endTime: end,
      timeRemainingMs: Math.max(0, end.getTime() - now.getTime()),
      poolSol,
      topExtractors,
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
          // Round just ended — trigger a refetch on next tick
          setTimeout(fetchRound, 500);
          return { ...prev, timeRemainingMs: 0 };
        }
        return { ...prev, timeRemainingMs: remaining };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [fetchRound]);

  return { info, loading, refetch: fetchRound };
}
