import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface BriefingWinner {
  wallet: string;
  at: string; // ISO timestamp
}

export interface DailyBriefingState {
  todayDate: string;        // "YYYY-MM-DD"
  winner: BriefingWinner | null;
  alreadyClaimed: boolean;
  loading: boolean;
}

function getTodayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

export function useDailyBriefing(walletAddress: string | null): DailyBriefingState {
  const todayDate = getTodayUTC();
  const [winner, setWinner] = useState<BriefingWinner | null>(null);
  const [alreadyClaimed, setAlreadyClaimed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setWinner(null);
    setAlreadyClaimed(false);

    const load = async () => {
      // Fetch today's winner (public read)
      const { data: briefing } = await supabase
        .from('daily_briefings')
        .select('winner_wallet, winner_at')
        .eq('date', todayDate)
        .maybeSingle();

      if (!mounted) return;

      if (briefing?.winner_wallet) {
        setWinner({ wallet: briefing.winner_wallet, at: briefing.winner_at });
      }

      // Check if current wallet already claimed today
      if (walletAddress) {
        const { data: claim } = await supabase
          .from('briefing_claims')
          .select('id')
          .eq('wallet_address', walletAddress)
          .eq('date', todayDate)
          .maybeSingle();

        if (!mounted) return;
        setAlreadyClaimed(!!claim);
      }

      if (mounted) setLoading(false);
    };

    load();
    return () => { mounted = false; };
  }, [walletAddress, todayDate]);

  return { todayDate, winner, alreadyClaimed, loading };
}
