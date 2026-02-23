import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface PlayerRoundWin {
  id: string;
  roundNum: number;
  roundDate: string;   // YYYY-MM-DD
  rank: number;        // 1–5
  solExtracted: number;
  poolSol: number;
  solAllocation: number;
  claimed: boolean;
  claimedAt: string | null;
}

export function usePlayerRoundWins(walletAddress: string | null) {
  const [wins, setWins] = useState<PlayerRoundWin[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchWins = useCallback(async () => {
    if (!walletAddress) { setWins([]); return; }
    setLoading(true);
    const { data } = await supabase
      .from('round_winners')
      .select('*')
      .eq('wallet_address', walletAddress)
      .order('round_date', { ascending: false })
      .order('round_number', { ascending: false })
      .limit(30);

    setWins(
      (data ?? []).map(r => ({
        id: r.id,
        roundNum: r.round_number,
        roundDate: r.round_date,
        rank: r.rank,
        solExtracted: Number(r.sol_extracted),
        poolSol: Number(r.pool_sol),
        solAllocation: Number(r.sol_allocation),
        claimed: r.claimed,
        claimedAt: r.claimed_at ?? null,
      }))
    );
    setLoading(false);
  }, [walletAddress]);

  useEffect(() => { fetchWins(); }, [fetchWins]);

  return { wins, loading, refetch: fetchWins };
}
