/**
 * create-tree.mjs — One-time: create a Bubblegum Merkle tree for cNFT minting.
 *
 * Prerequisites (run once):
 *   npm install -D @metaplex-foundation/umi-bundle-defaults \
 *                  @metaplex-foundation/mpl-bubblegum \
 *                  @metaplex-foundation/mpl-token-metadata
 *
 * Usage:
 *   CREATOR_KEYPAIR=./creator-keypair.json RPC_URL=https://... node scripts/create-tree.mjs
 *
 * CREATOR_KEYPAIR — path to a Solana JSON keypair file (64-byte array).
 *                   This wallet pays for the tree and becomes the tree creator.
 *                   Must have ~1.5–2 SOL on mainnet for the rent deposit.
 *
 * After running, set these Supabase secrets:
 *   MERKLE_TREE_ADDRESS = <printed below>
 *   TREE_CREATOR_KEYPAIR = <raw contents of your CREATOR_KEYPAIR file>
 *
 * Tree parameters (change before running if needed):
 *   maxDepth=20      → max 2^20 ≈ 1,048,576 NFTs in this tree
 *   maxBufferSize=64 → concurrent mint throughput (recommended)
 *   canopyDepth=11   → stores Merkle proof nodes on-chain (cheaper per-mint tx, costs ~0.5 SOL extra at creation)
 */

import { readFileSync } from 'fs';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { keypairIdentity, generateSigner } from '@metaplex-foundation/umi';
import { createTree, mplBubblegum } from '@metaplex-foundation/mpl-bubblegum';
import { mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata';

// ── Config ──────────────────────────────────────────────────────────────────
const KEYPAIR_PATH = process.env.CREATOR_KEYPAIR ?? './creator-keypair.json';
const RPC_URL     = process.env.RPC_URL ?? 'https://api.mainnet-beta.solana.com';

const MAX_DEPTH       = 20;   // 2^20 NFT slots  (~1M capacity)
const MAX_BUFFER_SIZE = 64;   // concurrent appends
const CANOPY_DEPTH    = 11;   // on-chain proof caching (reduces per-mint cost)

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
console.log(`\nCreator wallet : ${creatorAddress}`);
console.log(`RPC            : ${RPC_URL}`);
console.log(`Tree params    : maxDepth=${MAX_DEPTH}, maxBufferSize=${MAX_BUFFER_SIZE}, canopyDepth=${CANOPY_DEPTH}`);
console.log('\nEstimated cost : ~1.5–2 SOL (rent-exempt deposit for the tree account)\n');

// ── Check balance ────────────────────────────────────────────────────────────
const lamports = await umi.rpc.getBalance(creatorKeypair.publicKey);
const sol = Number(lamports.basisPoints) / 1e9;
console.log(`Wallet balance : ${sol.toFixed(4)} SOL`);
if (sol < 1.5) {
  console.error('\n[ERROR] Insufficient balance. Fund this wallet with at least 1.5 SOL and retry.\n');
  process.exit(1);
}

// ── Create tree ──────────────────────────────────────────────────────────────
console.log('\nCreating Merkle tree… (may take 15–30s on mainnet)\n');

const merkleTree = generateSigner(umi);

try {
  const { signature } = await createTree(umi, {
    merkleTree,
    maxDepth: MAX_DEPTH,
    maxBufferSize: MAX_BUFFER_SIZE,
    canopyDepth: CANOPY_DEPTH,
    public: false, // only tree creator (server) can authorize mints
  }).sendAndConfirm(umi, { confirm: { commitment: 'confirmed' } });

  const treeAddress = merkleTree.publicKey.toString();

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Merkle tree created successfully!');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Tx signature    : ${Buffer.from(signature).toString('base64')}`);
  console.log(`  Tree address    : ${treeAddress}`);
  console.log('───────────────────────────────────────────────────────────────');
  console.log('  Next: set these Supabase Edge Function secrets');
  console.log('');
  console.log(`  MERKLE_TREE_ADDRESS  = ${treeAddress}`);
  console.log(`  TREE_CREATOR_KEYPAIR = <paste contents of ${KEYPAIR_PATH}>`);
  console.log('═══════════════════════════════════════════════════════════════\n');
} catch (err) {
  console.error('\n[ERROR] Tree creation failed:', err);
  process.exit(1);
}
