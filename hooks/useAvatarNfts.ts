import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface MintedNft {
  id: string;
  avatarId: string;
  assetId: string | null;
  txSignature: string | null;
  mintedAt: string;
}

/** Returns all minted NFT records for a wallet, keyed by avatarId. */
export function useAvatarNfts(walletAddress: string | null) {
  const [mintedAvatars, setMintedAvatars] = useState<Record<string, MintedNft>>({});
  const [loading, setLoading] = useState(false);

  const fetchMints = useCallback(async () => {
    if (!walletAddress) {
      setMintedAvatars({});
      return;
    }
    setLoading(true);

    const { data } = await supabase
      .from('minted_nfts')
      .select('*')
      .eq('wallet_address', walletAddress);

    const map: Record<string, MintedNft> = {};
    for (const row of data ?? []) {
      map[row.avatar_id] = {
        id: row.id,
        avatarId: row.avatar_id,
        assetId: row.asset_id ?? null,
        txSignature: row.tx_signature ?? null,
        mintedAt: row.minted_at,
      };
    }
    setMintedAvatars(map);
    setLoading(false);
  }, [walletAddress]);

  useEffect(() => { fetchMints(); }, [fetchMints]);

  return { mintedAvatars, loading, refetch: fetchMints };
}
