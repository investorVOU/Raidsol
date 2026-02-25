import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Bounty } from '../types';

export function useBounties(walletAddress: string | null) {
  const [openBounties, setOpenBounties] = useState<Bounty[]>([]);
  const [myBounties,   setMyBounties]   = useState<Bounty[]>([]);
  const [loading,      setLoading]      = useState(true);

  const fetchBounties = useCallback(async () => {
    setLoading(true);

    // Open bounties (not expired, not claimed)
    const { data: open } = await supabase
      .from('bounties')
      .select('*')
      .eq('status', 'OPEN')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(50);

    setOpenBounties((open ?? []) as Bounty[]);

    // My bounties (posted or claimed by me)
    if (walletAddress) {
      const { data: mine } = await supabase
        .from('bounties')
        .select('*')
        .or(`poster_wallet.eq.${walletAddress},claimed_by_wallet.eq.${walletAddress}`)
        .order('created_at', { ascending: false })
        .limit(30);
      setMyBounties((mine ?? []) as Bounty[]);
    } else {
      setMyBounties([]);
    }

    setLoading(false);
  }, [walletAddress]);

  useEffect(() => {
    fetchBounties();

    // Real-time updates
    const channel = supabase
      .channel('bounties-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bounties' }, () => {
        fetchBounties();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchBounties]);

  return { openBounties, myBounties, loading, refresh: fetchBounties };
}
