import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Bounty } from '../types';

export function useBounties(walletAddress: string | null) {
  const [openBounties,    setOpenBounties]    = useState<Bounty[]>([]);
  const [myBounties,      setMyBounties]      = useState<Bounty[]>([]);
  const [claimedActions,  setClaimedActions]  = useState<string[]>([]);
  const [loading,         setLoading]         = useState(true);

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

    if (walletAddress) {
      // My posted + claimed bounties
      const { data: mine } = await supabase
        .from('bounties')
        .select('*')
        .or(`poster_wallet.eq.${walletAddress},claimed_by_wallet.eq.${walletAddress}`)
        .order('created_at', { ascending: false })
        .limit(30);
      setMyBounties((mine ?? []) as Bounty[]);

      // Already-claimed social/challenge actions
      const { data: claims } = await supabase
        .from('social_claims')
        .select('action_type')
        .eq('wallet_address', walletAddress);
      setClaimedActions((claims ?? []).map((c: { action_type: string }) => c.action_type));
    } else {
      setMyBounties([]);
      setClaimedActions([]);
    }

    setLoading(false);
  }, [walletAddress]);

  useEffect(() => {
    fetchBounties();

    const channel = supabase
      .channel('bounties-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bounties' }, () => { fetchBounties(); })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'social_claims' }, () => { fetchBounties(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchBounties]);

  return { openBounties, myBounties, claimedActions, loading, refresh: fetchBounties };
}
