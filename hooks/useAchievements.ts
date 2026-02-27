import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface EarnedAchievement {
  achievement_id: string;
  earned_at: string;
}

export function useAchievements(walletAddress: string | null) {
  const [earned, setEarned] = useState<Set<string>>(new Set());
  const [earnedDates, setEarnedDates] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!walletAddress) {
      setEarned(new Set());
      setEarnedDates({});
      return;
    }
    setLoading(true);
    supabase
      .from('achievements')
      .select('achievement_id, earned_at')
      .eq('wallet_address', walletAddress)
      .then(({ data }) => {
        if (data) {
          const ids = new Set(data.map((r: EarnedAchievement) => r.achievement_id));
          const dates: Record<string, string> = {};
          data.forEach((r: EarnedAchievement) => { dates[r.achievement_id] = r.earned_at; });
          setEarned(ids);
          setEarnedDates(dates);
        }
        setLoading(false);
      });
  }, [walletAddress]);

  return { earned, earnedDates, loading };
}
