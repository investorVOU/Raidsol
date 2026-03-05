import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { DAILY_BOUNTIES, DailyBountyDef } from '../types';

export function getTodayBounty(): DailyBountyDef {
  const dayIndex = Math.floor(Date.now() / 86_400_000);
  return DAILY_BOUNTIES[dayIndex % DAILY_BOUNTIES.length];
}

export function getTodayDayIndex(): number {
  return Math.floor(Date.now() / 86_400_000);
}

export function useDailyBounty(walletAddress: string | null) {
  const bounty = getTodayBounty();
  const dayIndex = getTodayDayIndex();
  const [claimed, setClaimed] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkClaim = useCallback(async () => {
    if (!walletAddress) { setLoading(false); return; }
    const { data } = await supabase
      .from('daily_bounty_claims')
      .select('id')
      .eq('wallet_address', walletAddress)
      .eq('day_index', dayIndex)
      .maybeSingle();
    setClaimed(!!data);
    setLoading(false);
  }, [walletAddress, dayIndex]);

  useEffect(() => { checkClaim(); }, [checkClaim]);

  return { bounty, claimed, loading, refresh: checkClaim };
}
