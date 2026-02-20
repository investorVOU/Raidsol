import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { RANKS } from '../types';

export interface LeaderboardEntry {
  wallet_address: string;
  username: string;
  sr_points: number;
  rank_level: number;
  rank_title: string;
  rank_color: string;
}

function resolveRank(srPoints: number) {
  let best = RANKS[0];
  for (const r of RANKS) {
    if (srPoints >= r.minSR) best = r;
    else break;
  }
  return best;
}

export function useLeaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    supabase
      .from('profiles')
      .select('wallet_address, username, sr_points')
      .order('sr_points', { ascending: false })
      .limit(20)
      .then(({ data, error }) => {
        if (!mounted) return;
        if (!error && data) {
          setEntries(
            data.map((row: { wallet_address: string; username: string; sr_points: number }) => {
              const rank = resolveRank(row.sr_points);
              return {
                wallet_address: row.wallet_address,
                username: row.username,
                sr_points: row.sr_points,
                rank_level: rank.level,
                rank_title: rank.title,
                rank_color: rank.color,
              };
            }),
          );
        }
        setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  return { entries, loading };
}
