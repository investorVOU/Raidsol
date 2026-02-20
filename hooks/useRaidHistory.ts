import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface RaidHistoryEntry {
  id: string;
  raid_id: string;
  mode: string;
  difficulty: string;
  success: boolean;
  sol_amount: number;
  entry_fee: number;
  sr_earned: number;
  points: number;
  server_seed_hash: string | null;
  tx_signature: string | null;
  created_at: string;
}

export function useRaidHistory(walletAddress: string | null) {
  const [history, setHistory] = useState<RaidHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!walletAddress) {
      setHistory([]);
      return;
    }
    let mounted = true;
    setLoading(true);
    supabase
      .from('raid_history')
      .select('*')
      .eq('wallet_address', walletAddress)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data, error }) => {
        if (!mounted) return;
        if (!error && data) setHistory(data as RaidHistoryEntry[]);
        setLoading(false);
      });
    return () => { mounted = false; };
  }, [walletAddress]);

  return { history, loading };
}
