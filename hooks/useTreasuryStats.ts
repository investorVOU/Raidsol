import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface TreasuryStats {
  treasury_address: string;
  total_reserve_sol: number;
  payouts_24h_sol: number;
  total_transactions: number;
  updated_at: string;
}

export function useTreasuryStats() {
  const [stats, setStats] = useState<TreasuryStats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    supabase
      .from('treasury_stats')
      .select('*')
      .eq('id', 1)
      .single()
      .then(({ data, error }) => {
        if (!mounted) return;
        if (!error && data) setStats(data as TreasuryStats);
        setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  return { stats, loading };
}
