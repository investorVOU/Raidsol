import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface WithdrawalRecord {
  id: string;
  wallet_address: string;
  amount_sol: number;
  tx_signature: string | null;
  status: string;
  created_at: string;
}

export function useWithdrawalHistory(walletAddress: string | null) {
  const [history, setHistory] = useState<WithdrawalRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchHistory = useCallback(async () => {
    if (!walletAddress) { setHistory([]); return; }
    setLoading(true);
    const { data } = await supabase
      .from('withdrawals')
      .select('*')
      .eq('wallet_address', walletAddress)
      .order('created_at', { ascending: false })
      .limit(20);
    setHistory(data ?? []);
    setLoading(false);
  }, [walletAddress]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  return { history, loading, refetch: fetchHistory };
}
