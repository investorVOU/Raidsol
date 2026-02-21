import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface Profile {
  wallet_address: string;
  username: string;
  sr_points: number;
  unclaimed_sol: number;
  equipped_avatar_id: string | null;
  equipped_gear_ids: string[];
  owned_item_ids: string[];
  referral_code: string | null;
  referred_by: string | null;
  referral_sr_earned: number;
  raid_tickets: number;
  last_free_ticket_date: string | null;  // "YYYY-MM-DD"
}

type ProfileUpdate = Partial<Omit<Profile, 'wallet_address'>>;

/** Deterministic referral code from wallet — 10 chars, always SR-prefixed */
function makeReferralCode(walletAddress: string): string {
  return 'SR' + walletAddress.slice(0, 4).toUpperCase() + walletAddress.slice(-4).toUpperCase();
}

/**
 * @param walletAddress  Connected wallet pubkey string or null
 * @param incomingRefCode  Optional referral code from URL (?ref=...)
 */
export function useProfile(walletAddress: string | null, incomingRefCode?: string | null) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!walletAddress) {
      setProfile(null);
      return;
    }

    let mounted = true;
    setLoading(true);

    const loadOrCreate = async () => {
      // Try to fetch existing profile
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('wallet_address', walletAddress)
        .single();

      if (!mounted) return;

      if (data && !error) {
        // Backfill referral_code for older profiles — silently skip if column missing (pre-migration)
        if (!data.referral_code) {
          const code = makeReferralCode(walletAddress);
          const { error: backfillErr } = await supabase
            .from('profiles')
            .update({ referral_code: code, updated_at: new Date().toISOString() })
            .eq('wallet_address', walletAddress);
          if (!backfillErr) data.referral_code = code;
          // If backfill fails (column not yet migrated), continue anyway
        }
        setProfile(data as Profile);
        setLoading(false);
        return;
      }

      // ── Profile not found — create one with defaults ────────────────
      const referralCode = makeReferralCode(walletAddress);
      const defaultUsername = 'USER_' + walletAddress.slice(-4).toUpperCase();

      // Resolve referrer if incoming code was provided
      let referredBy: string | null = null;
      if (incomingRefCode) {
        const { data: referrerProfile } = await supabase
          .from('profiles')
          .select('wallet_address, referral_sr_earned, sr_points')
          .eq('referral_code', incomingRefCode.toUpperCase())
          .single();

        if (referrerProfile && referrerProfile.wallet_address !== walletAddress) {
          referredBy = referrerProfile.wallet_address;
          // Award referrer 250 SR + track total referral SR earned
          await supabase
            .from('profiles')
            .update({
              sr_points: Number(referrerProfile.sr_points) + 250,
              referral_sr_earned: Number(referrerProfile.referral_sr_earned) + 250,
              updated_at: new Date().toISOString(),
            })
            .eq('wallet_address', referredBy);
        }
      }

      const newProfile = {
        wallet_address: walletAddress,
        username: defaultUsername,
        sr_points: 250,
        unclaimed_sol: 0,
        equipped_avatar_id: null,
        equipped_gear_ids: [],
        owned_item_ids: [],
        referral_code: referralCode,
        referred_by: referredBy,
        referral_sr_earned: 0,
      };

      const { data: inserted, error: insertError } = await supabase
        .from('profiles')
        .insert(newProfile)
        .select()
        .single();

      if (!mounted) return;

      if (inserted && !insertError) {
        setProfile(inserted as Profile);
      } else {
        console.error('Failed to create profile', insertError);
        setProfile(newProfile as Profile);
      }
      setLoading(false);
    };

    loadOrCreate();
    return () => { mounted = false; };
  }, [walletAddress, incomingRefCode]);

  const updateProfile = useCallback(async (partial: ProfileUpdate) => {
    if (!walletAddress) return;

    // Optimistic local update
    setProfile(prev => prev ? { ...prev, ...partial } : prev);

    const { error } = await supabase
      .from('profiles')
      .update({ ...partial, updated_at: new Date().toISOString() })
      .eq('wallet_address', walletAddress);

    if (error) {
      console.error('Failed to update profile', error);
    }
  }, [walletAddress]);

  return { profile, loading, updateProfile };
}
