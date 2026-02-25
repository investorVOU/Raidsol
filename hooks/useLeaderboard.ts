import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { RANKS, AVATAR_ITEMS } from '../types';

export type LeaderboardPeriod = 'weekly' | 'monthly' | 'alltime' | 'skr';

export interface LeaderboardEntry {
  wallet_address: string;
  username: string;
  sr_points: number;       // period SR for weekly/monthly; total SR for alltime
  rank_level: number;
  rank_title: string;
  rank_color: string;
  avatarImage: string | null; // null = no avatar equipped
  skr_domain?: string | null; // .skr domain if resolved
}

function resolveRank(srPoints: number) {
  let best = RANKS[0];
  for (const r of RANKS) {
    if (srPoints >= r.minSR) best = r;
    else break;
  }
  return best;
}

function getAvatarImage(equippedAvatarId: string | null): string | null {
  if (equippedAvatarId) {
    const item = AVATAR_ITEMS.find(a => a.id === equippedAvatarId);
    if (item?.image) return item.image;
  }
  return null;
}

export function useLeaderboard(period: LeaderboardPeriod = 'alltime') {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setEntries([]);

    const load = async () => {
      if (period === 'skr') {
        // SKR tab: only profiles with a resolved .skr domain, top 50 by SR
        const { data, error } = await supabase
          .from('profiles')
          .select('wallet_address, username, sr_points, equipped_avatar_id, skr_domain')
          .not('skr_domain', 'is', null)
          .order('sr_points', { ascending: false })
          .limit(50);

        if (!mounted) return;
        if (!error && data) {
          setEntries(
            (data as { wallet_address: string; username: string; sr_points: number; equipped_avatar_id: string | null; skr_domain: string | null }[]).map(row => {
              const rank = resolveRank(row.sr_points);
              return {
                wallet_address: row.wallet_address,
                username: row.username,
                sr_points: row.sr_points,
                rank_level: rank.level,
                rank_title: rank.title,
                rank_color: rank.color,
                avatarImage: getAvatarImage(row.equipped_avatar_id),
                skr_domain: row.skr_domain,
              };
            }),
          );
        }
        if (mounted) setLoading(false);
        return;
      }

      if (period === 'alltime') {
        const { data, error } = await supabase
          .from('profiles')
          .select('wallet_address, username, sr_points, equipped_avatar_id, skr_domain')
          .order('sr_points', { ascending: false })
          .limit(20);

        if (!mounted) return;
        if (!error && data) {
          setEntries(
            (data as { wallet_address: string; username: string; sr_points: number; equipped_avatar_id: string | null; skr_domain: string | null }[]).map(row => {
              const rank = resolveRank(row.sr_points);
              return {
                wallet_address: row.wallet_address,
                username: row.username,
                sr_points: row.sr_points,
                rank_level: rank.level,
                rank_title: rank.title,
                rank_color: rank.color,
                avatarImage: getAvatarImage(row.equipped_avatar_id),
                skr_domain: row.skr_domain,
              };
            }),
          );
        }
      } else {
        // Weekly: 7 days, Monthly: 30 days — aggregate sr_earned from raid_history
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - (period === 'weekly' ? 7 : 30));

        const { data: raids, error } = await supabase
          .from('raid_history')
          .select('wallet_address, sr_earned')
          .gte('created_at', cutoff.toISOString())
          .limit(2000);

        if (!mounted || error || !raids) {
          if (mounted) setLoading(false);
          return;
        }

        // Aggregate sr_earned per wallet
        const map: Record<string, number> = {};
        for (const row of raids as { wallet_address: string; sr_earned: number }[]) {
          map[row.wallet_address] = (map[row.wallet_address] ?? 0) + row.sr_earned;
        }

        const top20 = Object.entries(map)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 20);

        if (top20.length === 0) {
          if (mounted) { setEntries([]); setLoading(false); }
          return;
        }

        const wallets = top20.map(([w]) => w);

        const { data: profiles, error: profErr } = await supabase
          .from('profiles')
          .select('wallet_address, username, sr_points, equipped_avatar_id')
          .in('wallet_address', wallets);

        if (!mounted) return;

        if (!profErr && profiles) {
          const profileMap: Record<string, { wallet_address: string; username: string; sr_points: number; equipped_avatar_id: string | null }> = {};
          for (const p of profiles as { wallet_address: string; username: string; sr_points: number; equipped_avatar_id: string | null }[]) {
            profileMap[p.wallet_address] = p;
          }

          setEntries(
            top20.map(([wallet, periodSr]) => {
              const p = profileMap[wallet];
              const rank = resolveRank(p?.sr_points ?? 0);
              return {
                wallet_address: wallet,
                username: p?.username ?? `USER_${wallet.slice(-4).toUpperCase()}`,
                sr_points: periodSr,
                rank_level: rank.level,
                rank_title: rank.title,
                rank_color: rank.color,
                avatarImage: getAvatarImage(p?.equipped_avatar_id ?? null),
              };
            }),
          );
        }
      }

      if (mounted) setLoading(false);
    };

    load();
    return () => { mounted = false; };
  }, [period]);

  return { entries, loading };
}
