/**
 * mint-avatar-nft
 *
 * Mints a player's equipped avatar as a compressed NFT (cNFT) using
 * Metaplex Bubblegum / Merkle tree.  Architecture: partially-signed tx.
 *
 * Required Supabase secrets:
 *   MERKLE_TREE_ADDRESS    — base58 tree address
 *   TREE_CREATOR_KEYPAIR   — JSON array of 64 bytes (same format as TREASURY_WALLET_KEYPAIR)
 *   COLLECTION_MINT        — base58 collection NFT mint address
 *   SOLANA_RPC_URL         — mainnet RPC endpoint
 *
 * action='prepare' → verify ownership, build partially-signed tx, return base64
 * action='record'  → persist tx_signature + kick off async asset_id resolution
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

// ── Metaplex UMI stack (Deno npm: imports) ─────────────────────────────────
import { createUmi } from 'npm:@metaplex-foundation/umi-bundle-defaults@0.8.10';
import {
  keypairIdentity,
  publicKey as umiPubkey,
  createNoopSigner,
  some,
  none,
} from 'npm:@metaplex-foundation/umi@0.8.10';
import {
  mplBubblegum,
  mintToCollectionV1,
} from 'npm:@metaplex-foundation/mpl-bubblegum@1.0.1';
import { mplTokenMetadata } from 'npm:@metaplex-foundation/mpl-token-metadata@3.2.1';

// ── Avatar metadata (mirrors types.ts AVATAR_ITEMS) ────────────────────────
interface AvatarMeta {
  name: string;
  rarity: string;
  image: string;
  description: string;
}

const AVATAR_META: Record<string, AvatarMeta> = {
  // STANDARD (7)
  av_std_1: { name: 'Script Kiddie',  rarity: 'STANDARD', image: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=kiddie&backgroundColor=475569',   description: 'Just here for the ride.' },
  av_std_2: { name: 'Data Scout',     rarity: 'STANDARD', image: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=scout&backgroundColor=334155',    description: 'Looking for scraps.' },
  av_std_3: { name: 'Node Runner',    rarity: 'STANDARD', image: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=terminal&backgroundColor=1e293b', description: 'Steady hand, small gains.' },
  av_std_4: { name: 'Binary Nomad',   rarity: 'STANDARD', image: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=nomad&backgroundColor=64748b',    description: 'Wandering the layers.' },
  av_std_5: { name: 'Neon Glitch',    rarity: 'STANDARD', image: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=glitch&backgroundColor=a855f7',   description: 'Part of the noise.' },
  av_std_6: { name: 'The Shark',      rarity: 'STANDARD', image: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=shark&backgroundColor=06b6d4',    description: 'Small whale in training.' },
  av_std_7: { name: 'Mage_0x',        rarity: 'STANDARD', image: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=wizard&backgroundColor=3b82f6',   description: 'Seer of blocks.' },
  // LIMITED (8)
  av_lim_1: { name: 'Void Walker',    rarity: 'LIMITED',  image: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=void&backgroundColor=111111',    description: 'Invisible to basic scanners.' },
  av_lim_2: { name: 'Shadow Agent',   rarity: 'LIMITED',  image: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=agent&backgroundColor=1e293b',   description: 'Corporate infiltrator.' },
  av_lim_3: { name: 'Circuit Ronin',  rarity: 'LIMITED',  image: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=ronin&backgroundColor=ff00c1',   description: 'Masterless blade of the net.' },
  av_lim_4: { name: 'Pulse Striker',  rarity: 'LIMITED',  image: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=striker&backgroundColor=ef4444', description: 'Aggressive risk taker.' },
  av_lim_5: { name: 'Cyber Whale',    rarity: 'LIMITED',  image: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=whale&backgroundColor=22c55e',   description: 'Moving huge liquidity.' },
  av_lim_6: { name: 'Ghost Node',     rarity: 'LIMITED',  image: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=ghost&backgroundColor=cbd5e1',   description: 'Resistant to busts.' },
  av_lim_7: { name: 'Solar Flare',    rarity: 'LIMITED',  image: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=flare&backgroundColor=f97316',   description: 'Radiating pure alpha.' },
  av_lim_8: { name: 'Alpha Hunter',   rarity: 'LIMITED',  image: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=hunter&backgroundColor=020617',  description: 'Only seeks the biggest raids.' },
  // EXCLUSIVE (5)
  av_exc_1: { name: 'Protocol King',  rarity: 'EXCLUSIVE', image: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=king&backgroundColor=f59e0b',   description: 'He who rules the nodes.' },
  av_exc_2: { name: 'Sol Lord',       rarity: 'EXCLUSIVE', image: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=lord&backgroundColor=14f195',   description: 'The absolute unit of the chain.' },
  av_exc_3: { name: 'Quantum God',    rarity: 'EXCLUSIVE', image: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=god&backgroundColor=9945ff',    description: 'Transcending the blocks.' },
  av_exc_4: { name: 'Genesis Block',  rarity: 'EXCLUSIVE', image: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=genesis&backgroundColor=00fbff', description: 'The original protocol source.' },
  av_exc_5: { name: 'Satoshi Phantom',rarity: 'EXCLUSIVE', image: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=phantom&backgroundColor=ffffff', description: 'The ghost of the first chain.' },
};

// ── DAS asset_id resolution (best-effort, fire-and-forget) ─────────────────
async function resolveAssetId(
  supabase: ReturnType<typeof createClient>,
  walletAddress: string,
  avatarId: string,
  txSignature: string,
  rpcUrl: string,
): Promise<void> {
  // Wait 4 seconds for the cNFT to be indexed
  await new Promise(r => setTimeout(r, 4000));

  try {
    // Helius / any DAS-compatible RPC: getAssetsByOwner
    const resp = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'asset-resolve',
        method: 'getAssetsByOwner',
        params: {
          ownerAddress: walletAddress,
          page: 1,
          limit: 50,
          displayOptions: { showCollectionMetadata: false },
        },
      }),
    });

    const json = await resp.json();
    const assets: Array<{ id: string; compression?: { compressed: boolean }; content?: { json_uri: string } }> =
      json?.result?.items ?? [];

    // Find the newly minted cNFT — match by our metadata URI pattern
    const collectionMint = Deno.env.get('COLLECTION_MINT') ?? '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const expectedUriFragment = `nft-metadata/${walletAddress}/${avatarId}.json`;

    const match = assets.find(a =>
      a.compression?.compressed === true &&
      (a.content?.json_uri ?? '').includes(expectedUriFragment)
    );

    if (match) {
      await supabase
        .from('minted_nfts')
        .update({ asset_id: match.id })
        .eq('wallet_address', walletAddress)
        .eq('avatar_id', avatarId);
    } else {
      // Fallback: store tx_signature in asset_id so the UI can at least link to Solscan
      console.warn('[mint-avatar-nft] Could not resolve asset_id for', txSignature);
    }
  } catch (err) {
    console.error('[mint-avatar-nft] resolveAssetId failed:', err);
  }
}

// ── Main handler ────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  const corsH = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsH });
  }

  try {
    const body = await req.json();
    const { wallet_address, avatar_id, action, tx_signature } = body as {
      wallet_address: string;
      avatar_id: string;
      action: 'prepare' | 'record';
      tx_signature?: string;
    };

    if (!wallet_address || !avatar_id || !action) {
      return new Response(
        JSON.stringify({ error: 'wallet_address, avatar_id, and action are required' }),
        { status: 400, headers: { ...corsH, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ── record action ───────────────────────────────────────────────────────
    if (action === 'record') {
      if (!tx_signature) {
        return new Response(
          JSON.stringify({ error: 'tx_signature required for record action' }),
          { status: 400, headers: { ...corsH, 'Content-Type': 'application/json' } },
        );
      }

      await supabase
        .from('minted_nfts')
        .update({ tx_signature })
        .eq('wallet_address', wallet_address)
        .eq('avatar_id', avatar_id);

      // Fire-and-forget asset_id resolution
      const rpcUrl = Deno.env.get('SOLANA_RPC_URL') ?? 'https://api.mainnet-beta.solana.com';
      resolveAssetId(supabase, wallet_address, avatar_id, tx_signature, rpcUrl).catch(() => {});

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsH, 'Content-Type': 'application/json' } },
      );
    }

    // ── prepare action ──────────────────────────────────────────────────────
    if (action !== 'prepare') {
      return new Response(
        JSON.stringify({ error: 'action must be prepare or record' }),
        { status: 400, headers: { ...corsH, 'Content-Type': 'application/json' } },
      );
    }

    // 1. Validate avatar_id
    const meta = AVATAR_META[avatar_id];
    if (!meta) {
      return new Response(
        JSON.stringify({ error: 'unknown_avatar' }),
        { status: 400, headers: { ...corsH, 'Content-Type': 'application/json' } },
      );
    }

    // 2. Verify avatar ownership
    const { data: profile } = await supabase
      .from('profiles')
      .select('owned_item_ids, username')
      .eq('wallet_address', wallet_address)
      .single();

    if (!profile || !(profile.owned_item_ids ?? []).includes(avatar_id)) {
      return new Response(
        JSON.stringify({ error: 'not_owned' }),
        { status: 403, headers: { ...corsH, 'Content-Type': 'application/json' } },
      );
    }

    // 3. Double-mint check
    const { data: existing } = await supabase
      .from('minted_nfts')
      .select('id, asset_id, tx_signature')
      .eq('wallet_address', wallet_address)
      .eq('avatar_id', avatar_id)
      .maybeSingle();

    if (existing && existing.tx_signature) {
      return new Response(
        JSON.stringify({ error: 'already_minted', asset_id: existing.asset_id, tx_signature: existing.tx_signature }),
        { status: 409, headers: { ...corsH, 'Content-Type': 'application/json' } },
      );
    }

    // 4. Read required env vars
    const MERKLE_TREE_ADDRESS = Deno.env.get('MERKLE_TREE_ADDRESS');
    const TREE_CREATOR_KEYPAIR_JSON = Deno.env.get('TREE_CREATOR_KEYPAIR');
    const COLLECTION_MINT = Deno.env.get('COLLECTION_MINT');
    const SOLANA_RPC_URL = Deno.env.get('SOLANA_RPC_URL') ?? 'https://api.mainnet-beta.solana.com';

    if (!MERKLE_TREE_ADDRESS || !TREE_CREATOR_KEYPAIR_JSON || !COLLECTION_MINT) {
      return new Response(
        JSON.stringify({ error: 'Tree not configured — set MERKLE_TREE_ADDRESS, TREE_CREATOR_KEYPAIR, and COLLECTION_MINT secrets' }),
        { status: 500, headers: { ...corsH, 'Content-Type': 'application/json' } },
      );
    }

    // 5. Upload NFT metadata JSON to Supabase Storage (public bucket: nft-metadata)
    const username = profile.username ?? 'Raider';
    const metadataJson = JSON.stringify({
      name: `SolRaid — ${meta.name}`,
      symbol: 'RAID',
      description: meta.description,
      image: meta.image,
      external_url: 'https://solraid.app',
      attributes: [
        { trait_type: 'Rarity', value: meta.rarity },
        { trait_type: 'Raider', value: username },
        { trait_type: 'Avatar', value: meta.name },
      ],
    });

    const storagePath = `${wallet_address}/${avatar_id}.json`;
    await supabase.storage
      .from('nft-metadata')
      .upload(storagePath, metadataJson, { contentType: 'application/json', upsert: true });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const metadataUri = `${supabaseUrl}/storage/v1/object/public/nft-metadata/${storagePath}`;

    // 6. Insert pending minted_nfts row (no tx_signature yet)
    if (!existing) {
      await supabase.from('minted_nfts').insert({
        wallet_address,
        avatar_id,
        asset_id: null,
        tx_signature: null,
      });
    }

    // 7. Build Bubblegum mintToCollectionV1 transaction via UMI
    const creatorSecretKey = new Uint8Array(JSON.parse(TREE_CREATOR_KEYPAIR_JSON));

    const umi = createUmi(SOLANA_RPC_URL)
      .use(mplTokenMetadata())
      .use(mplBubblegum());

    // Tree creator signs as authority; keypairIdentity also sets them as payer by default
    const creatorUmiKeypair = umi.eddsa.createKeypairFromSecretKey(creatorSecretKey);
    umi.use(keypairIdentity(creatorUmiKeypair));

    // Override payer with a NoopSigner for the user's wallet — they sign client-side
    const userPubkey = umiPubkey(wallet_address);
    const noopUser = createNoopSigner(userPubkey);
    umi.payer = noopUser;

    const tx = await mintToCollectionV1(umi, {
      leafOwner: userPubkey,
      merkleTree: umiPubkey(MERKLE_TREE_ADDRESS),
      collectionMint: umiPubkey(COLLECTION_MINT),
      metadata: {
        name: `SolRaid — ${meta.name}`,
        symbol: 'RAID',
        uri: metadataUri,
        sellerFeeBasisPoints: 500, // 5% royalty
        collection: some({ key: umiPubkey(COLLECTION_MINT), verified: false }),
        creators: [{ address: creatorUmiKeypair.publicKey, verified: true, share: 100 }],
        isMutable: true,
        primarySaleHappened: false,
        editionNonce: none(),
        tokenStandard: none(),
        uses: none(),
        tokenProgramVersion: { __kind: 'Original' },
      },
    }).buildWithLatestBlockhash(umi);

    // 8. Server signs as tree creator (user's noop signature slot stays empty)
    const signedTx = await umi.identity.signTransaction(tx);

    // 9. Serialize and base64-encode for the client
    const serializedBytes = umi.transactions.serialize(signedTx);
    const base64Tx = btoa(String.fromCharCode(...serializedBytes));

    return new Response(
      JSON.stringify({ serializedTx: base64Tx }),
      { headers: { ...corsH, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[mint-avatar-nft]', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsH, 'Content-Type': 'application/json' } },
    );
  }
});
