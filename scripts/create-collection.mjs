/**
 * create-collection.mjs — One-time: create the SolRaid Avatars collection NFT.
 *
 * Prerequisites (run once):
 *   npm install -D @metaplex-foundation/umi-bundle-defaults \
 *                  @metaplex-foundation/mpl-bubblegum \
 *                  @metaplex-foundation/mpl-token-metadata
 *
 * Usage:
 *   CREATOR_KEYPAIR=./creator-keypair.json RPC_URL=https://... node scripts/create-collection.mjs
 *
 * Run AFTER create-tree.mjs (uses the same creator wallet).
 * The collection NFT gives cNFTs better discoverability on Tensor / MagicEden.
 *
 * After running, set this Supabase secret:
 *   COLLECTION_MINT = <printed below>
 *
 * You should also upload a collection metadata JSON + image to the URI below,
 * or update COLLECTION_URI before running.
 */

import { readFileSync } from 'fs';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import {
  keypairIdentity,
  generateSigner,
  percentAmount,
  some,
  none,
} from '@metaplex-foundation/umi';
import {
  createNft,
  mplTokenMetadata,
  TokenStandard,
} from '@metaplex-foundation/mpl-token-metadata';
import { mplBubblegum } from '@metaplex-foundation/mpl-bubblegum';

// ── Config ──────────────────────────────────────────────────────────────────
const KEYPAIR_PATH   = process.env.CREATOR_KEYPAIR ?? './creator-keypair.json';
const RPC_URL        = process.env.RPC_URL ?? 'https://api.mainnet-beta.solana.com';

// Update COLLECTION_URI to point to your hosted collection metadata JSON.
// The JSON must follow the Metaplex NFT metadata standard.
// See the template printed at the end of this script.
const COLLECTION_URI = process.env.COLLECTION_URI ?? 'https://solraid.app/nft/collection.json';

const COLLECTION_NAME   = 'SolRaid Avatars';
const COLLECTION_SYMBOL = 'RAID';
const SELLER_FEE_BPS    = 500; // 5% royalty (500 basis points)

// ── Load keypair ────────────────────────────────────────────────────────────
let rawKeypair;
try {
  rawKeypair = JSON.parse(readFileSync(KEYPAIR_PATH, 'utf-8'));
} catch {
  console.error(`\n[ERROR] Could not read keypair file at: ${KEYPAIR_PATH}`);
  console.error('Set CREATOR_KEYPAIR=/path/to/wallet.json\n');
  process.exit(1);
}

const secretKey = new Uint8Array(rawKeypair);

// ── UMI setup ───────────────────────────────────────────────────────────────
const umi = createUmi(RPC_URL)
  .use(mplTokenMetadata())
  .use(mplBubblegum());

const creatorKeypair = umi.eddsa.createKeypairFromSecretKey(secretKey);
umi.use(keypairIdentity(creatorKeypair));

const creatorAddress = creatorKeypair.publicKey.toString();
console.log(`\nCreator wallet   : ${creatorAddress}`);
console.log(`RPC              : ${RPC_URL}`);
console.log(`Collection name  : ${COLLECTION_NAME}`);
console.log(`Collection URI   : ${COLLECTION_URI}`);
console.log('\nEstimated cost   : ~0.01 SOL (standard NFT mint)\n');

// ── Check balance ────────────────────────────────────────────────────────────
const lamports = await umi.rpc.getBalance(creatorKeypair.publicKey);
const sol = Number(lamports.basisPoints) / 1e9;
console.log(`Wallet balance   : ${sol.toFixed(4)} SOL`);
if (sol < 0.05) {
  console.error('\n[ERROR] Insufficient balance. Fund this wallet with at least 0.05 SOL.\n');
  process.exit(1);
}

// ── Create collection NFT ────────────────────────────────────────────────────
console.log('\nCreating collection NFT…\n');

const collectionMint = generateSigner(umi);

try {
  const { signature } = await createNft(umi, {
    mint: collectionMint,
    name: COLLECTION_NAME,
    symbol: COLLECTION_SYMBOL,
    uri: COLLECTION_URI,
    sellerFeeBasisPoints: percentAmount(SELLER_FEE_BPS / 100, 2),
    creators: [{ address: creatorKeypair.publicKey, verified: true, share: 100 }],
    isMutable: true,
    primarySaleHappened: false,
    // Mark as a collection NFT (required for Bubblegum mintToCollectionV1)
    collectionDetails: some({ __kind: 'V1', size: 0n }),
    tokenStandard: TokenStandard.NonFungible,
  }).sendAndConfirm(umi, { confirm: { commitment: 'confirmed' } });

  const mintAddress = collectionMint.publicKey.toString();

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Collection NFT created successfully!');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Tx signature    : ${Buffer.from(signature).toString('base64')}`);
  console.log(`  Collection mint : ${mintAddress}`);
  console.log('───────────────────────────────────────────────────────────────');
  console.log('  Next: set this Supabase Edge Function secret');
  console.log('');
  console.log(`  COLLECTION_MINT = ${mintAddress}`);
  console.log('───────────────────────────────────────────────────────────────');
  console.log('  Collection metadata JSON template (host at your COLLECTION_URI):');
  console.log('');
  console.log(JSON.stringify({
    name: COLLECTION_NAME,
    symbol: COLLECTION_SYMBOL,
    description: 'On-chain proof of ownership for SolRaid avatar cosmetics. Tradeable on Tensor and Magic Eden.',
    image: 'https://solraid.app/nft/collection-image.png',
    external_url: 'https://solraid.app',
    seller_fee_basis_points: SELLER_FEE_BPS,
    properties: {
      files: [{ uri: 'https://solraid.app/nft/collection-image.png', type: 'image/png' }],
      category: 'image',
      creators: [{ address: creatorAddress, share: 100 }],
    },
  }, null, 2));
  console.log('═══════════════════════════════════════════════════════════════\n');
} catch (err) {
  console.error('\n[ERROR] Collection creation failed:', err);
  process.exit(1);
}
