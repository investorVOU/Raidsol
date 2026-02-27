
import React, { useState, useEffect } from 'react';
import { useDailyBriefing } from '../hooks/useDailyBriefing';

const DECODER_COST = 75; // SR cost to unlock the full cipher key

interface BriefingScreenProps {
  walletAddress: string | null;
  srPoints: number;
  onCheckBriefing: (answer: string, date: string) => Promise<{ correct: boolean; reward_sr?: number; isFirst?: boolean }>;
  onSpendSR: (amount: number) => void;
  onBack: () => void;
}

// Caesar +3 encoder — spaces preserved, numbers/symbols pass through unchanged
function caesarEncode(text: string): string {
  return text.toUpperCase().split('').map(c => {
    if (c >= 'A' && c <= 'Z') return String.fromCharCode(((c.charCodeAt(0) - 65 + 3) % 26) + 65);
    return c;
  }).join('');
}

// 366 puzzles stored as plain text — cipher computed automatically, no manual errors
const PUZZLE_BANK: { plain: string; hint: string }[] = [
  // Solana Core
  { plain: 'SOLANA',           hint: 'Fastest L1 blockchain' },
  { plain: 'LAMPORT',          hint: 'Smallest SOL unit' },
  { plain: 'VALIDATOR',        hint: 'Secures the network' },
  { plain: 'KEYPAIR',          hint: 'Public and private keys' },
  { plain: 'PROGRAM',          hint: 'Solana smart contract' },
  { plain: 'ACCOUNT',          hint: 'On-chain data store' },
  { plain: 'DEVNET',           hint: 'Test environment' },
  { plain: 'MAINNET',          hint: 'Live network' },
  { plain: 'TESTNET',          hint: 'Staging network' },
  { plain: 'CLUSTER',          hint: 'Validator group' },
  { plain: 'SEALEVEL',         hint: 'Parallel runtime' },
  { plain: 'TURBINE',          hint: 'Block propagation protocol' },
  { plain: 'GOSSIP',           hint: 'P2P node messaging' },
  { plain: 'LEADER',           hint: 'Current block producer' },
  { plain: 'SLOT',             hint: 'Solana time unit' },
  { plain: 'EPOCH',            hint: 'Validator rotation period' },
  { plain: 'RENT',             hint: 'Account storage cost' },
  { plain: 'ANCHOR',           hint: 'Solana dev framework' },
  { plain: 'PHANTOM',          hint: 'Popular Solana wallet' },
  { plain: 'DEPLOY',           hint: 'Launch on-chain' },
  { plain: 'SOLFLARE',         hint: 'Browser-based Solana wallet' },
  { plain: 'METAPLEX',         hint: 'Solana NFT standard' },
  { plain: 'JUPITER',          hint: 'Solana swap aggregator' },
  { plain: 'ORCA',             hint: 'Solana DEX' },
  { plain: 'RAYDIUM',          hint: 'Solana AMM' },
  { plain: 'MARINADE',         hint: 'Liquid staking on Solana' },
  { plain: 'JITO',             hint: 'MEV-protected staking' },
  { plain: 'PYTH',             hint: 'Solana oracle network' },
  { plain: 'HELIUS',           hint: 'Solana RPC and APIs' },
  { plain: 'TENSOR',           hint: 'Solana NFT marketplace' },
  // Blockchain Fundamentals
  { plain: 'BLOCKCHAIN',       hint: 'Chain of blocks' },
  { plain: 'CONSENSUS',        hint: 'Agreement mechanism' },
  { plain: 'PROTOCOL',         hint: 'Set of rules' },
  { plain: 'NODE',             hint: 'Network participant' },
  { plain: 'BLOCK',            hint: 'Group of transactions' },
  { plain: 'HASH',             hint: 'One-way fingerprint' },
  { plain: 'FORK',             hint: 'Chain split' },
  { plain: 'FINALITY',         hint: 'Permanent confirmation' },
  { plain: 'THROUGHPUT',       hint: 'Transactions per second' },
  { plain: 'SHARD',            hint: 'Chain partition' },
  { plain: 'ROLLUP',           hint: 'Layer two scaling' },
  { plain: 'BRIDGE',           hint: 'Cross-chain connector' },
  { plain: 'NONCE',            hint: 'Used-once value' },
  { plain: 'GENESIS',          hint: 'First block ever' },
  { plain: 'IMMUTABLE',        hint: 'Cannot be changed' },
  { plain: 'PERMISSIONLESS',   hint: 'Open to anyone' },
  { plain: 'TRUSTLESS',        hint: 'No middleman needed' },
  { plain: 'TRANSPARENT',      hint: 'Publicly visible on-chain' },
  { plain: 'COMPOSABLE',       hint: 'Lego-like building blocks' },
  { plain: 'ATOMIC',           hint: 'All or nothing transaction' },
  { plain: 'DETERMINISTIC',    hint: 'Same input same output' },
  { plain: 'INTEROPERABLE',    hint: 'Works across chains' },
  { plain: 'FUNGIBLE',         hint: 'Each unit identical' },
  { plain: 'MEMPOOL',          hint: 'Transaction waiting room' },
  { plain: 'SEQUENCER',        hint: 'Orders L2 transactions' },
  { plain: 'AGGREGATOR',       hint: 'Combines multiple sources' },
  { plain: 'RELAY',            hint: 'Passes messages between chains' },
  { plain: 'MERKLE',           hint: 'Tree data structure' },
  { plain: 'PROOF',            hint: 'Cryptographic evidence' },
  { plain: 'COMMITMENT',       hint: 'Locked-in value' },
  // Wallet & Keys
  { plain: 'WALLET',           hint: 'Holds your keys' },
  { plain: 'SEED PHRASE',      hint: 'Wallet backup words' },
  { plain: 'PRIVATE KEY',      hint: 'Secret access code' },
  { plain: 'PUBLIC KEY',       hint: 'Shareable address' },
  { plain: 'SIGNATURE',        hint: 'Proves you signed it' },
  { plain: 'ENCRYPT',          hint: 'Scramble the data' },
  { plain: 'DECRYPT',          hint: 'Unscramble the data' },
  { plain: 'MNEMONIC',         hint: 'Memory aid for keys' },
  { plain: 'PASSPHRASE',       hint: 'Extra seed protection' },
  { plain: 'HARDWARE WALLET',  hint: 'Physical key storage device' },
  { plain: 'HOT WALLET',       hint: 'Internet-connected wallet' },
  { plain: 'COLD WALLET',      hint: 'Offline key storage' },
  { plain: 'CUSTODIAL',        hint: 'Exchange holds your keys' },
  { plain: 'SELF CUSTODY',     hint: 'You hold your own keys' },
  { plain: 'MULTISIG',         hint: 'Multiple approvals needed' },
  { plain: 'REVOKE',           hint: 'Cancel permission' },
  { plain: 'APPROVE',          hint: 'Grant token permission' },
  { plain: 'ALLOWANCE',        hint: 'Spending limit set' },
  // Crypto Economics
  { plain: 'TOKEN',            hint: 'Digital asset unit' },
  { plain: 'COIN',             hint: 'Native chain currency' },
  { plain: 'SUPPLY',           hint: 'Total tokens in existence' },
  { plain: 'INFLATION',        hint: 'Token supply grows' },
  { plain: 'DEFLATION',        hint: 'Token supply shrinks' },
  { plain: 'VESTING',          hint: 'Gradual token unlock' },
  { plain: 'LOCKUP',           hint: 'Restricted sale period' },
  { plain: 'EMISSION',         hint: 'New token release rate' },
  { plain: 'REWARD',           hint: 'Earned tokens' },
  { plain: 'SLASH',            hint: 'Validator punishment' },
  { plain: 'YIELD',            hint: 'Return on investment' },
  { plain: 'TREASURY',         hint: 'Protocol fund' },
  { plain: 'GRANT',            hint: 'Funded project' },
  { plain: 'BOUNTY',           hint: 'Task reward' },
  { plain: 'TOKENOMICS',       hint: 'Token economy design' },
  { plain: 'DISTRIBUTION',     hint: 'Token allocation plan' },
  { plain: 'SNAPSHOT',         hint: 'Point-in-time balance' },
  { plain: 'AIRDROP',          hint: 'Free token gift' },
  { plain: 'BUYBACK',          hint: 'Protocol repurchases tokens' },
  { plain: 'BURN RATE',        hint: 'Speed of supply removal' },
  { plain: 'CIRCULATING',      hint: 'Tokens currently in market' },
  { plain: 'MAX SUPPLY',       hint: 'Hard cap on tokens ever' },
  { plain: 'HARD CAP',         hint: 'Maximum raise limit' },
  { plain: 'FAIR LAUNCH',      hint: 'No presale advantage' },
  { plain: 'PREMINE',          hint: 'Tokens created before launch' },
  // DeFi
  { plain: 'DEFI',             hint: 'Decentralised finance' },
  { plain: 'POOL',             hint: 'Liquidity reservoir' },
  { plain: 'SWAP',             hint: 'Token exchange' },
  { plain: 'STAKE',            hint: 'Lock tokens for rewards' },
  { plain: 'UNSTAKE',          hint: 'Unlock staked tokens' },
  { plain: 'FARM',             hint: 'Earn yield as LP' },
  { plain: 'HARVEST',          hint: 'Collect farming rewards' },
  { plain: 'COMPOUND',         hint: 'Reinvest returns' },
  { plain: 'COLLATERAL',       hint: 'Loan backing asset' },
  { plain: 'ORACLE',           hint: 'Off-chain data feed' },
  { plain: 'ESCROW',           hint: 'Held by third party' },
  { plain: 'VAULT',            hint: 'Secure token storage' },
  { plain: 'LIQUIDITY',        hint: 'Ease of buying or selling' },
  { plain: 'SLIPPAGE',         hint: 'Price shift on trade' },
  { plain: 'IMPERMANENT LOSS', hint: 'LP provider risk' },
  { plain: 'FLASH LOAN',       hint: 'Borrow and repay in one tx' },
  { plain: 'ARBITRAGE',        hint: 'Profit from price gap' },
  { plain: 'REBALANCE',        hint: 'Restore target weights' },
  { plain: 'SYNTHETIC',        hint: 'Derivative asset' },
  { plain: 'PERP',             hint: 'Perpetual contract' },
  { plain: 'FUNDING',          hint: 'Perp rate payment' },
  { plain: 'HEDGE',            hint: 'Risk offset position' },
  { plain: 'LEVERAGE',         hint: 'Borrowed position size' },
  { plain: 'MARGIN',           hint: 'Collateral for trade' },
  { plain: 'LIQUIDATION',      hint: 'Forced position close' },
  { plain: 'HEALTH FACTOR',    hint: 'Loan safety ratio' },
  { plain: 'UTILIZATION',      hint: 'Pool borrow percentage' },
  { plain: 'FLYWHEEL',         hint: 'Self-reinforcing incentive loop' },
  { plain: 'VETOKEN',          hint: 'Vote-escrowed governance token' },
  { plain: 'GAUGE',            hint: 'Reward weight setting' },
  { plain: 'BRIBE',            hint: 'Buy governance votes' },
  { plain: 'REBASE',           hint: 'Supply adjustment mechanism' },
  // Trading
  { plain: 'HODL',             hint: 'Hold on for dear life' },
  { plain: 'PUMP',             hint: 'Price surge' },
  { plain: 'DUMP',             hint: 'Mass sell off' },
  { plain: 'DEGEN',            hint: 'Risk-loving trader' },
  { plain: 'ALPHA',            hint: 'Market edge info' },
  { plain: 'WHALE',            hint: 'Large token holder' },
  { plain: 'BEAR',             hint: 'Falling market' },
  { plain: 'BULL',             hint: 'Rising market' },
  { plain: 'LONG',             hint: 'Bet on price rise' },
  { plain: 'SHORT',            hint: 'Bet on price fall' },
  { plain: 'SPREAD',           hint: 'Buy-sell price gap' },
  { plain: 'VOLATILITY',       hint: 'Price swing magnitude' },
  { plain: 'SUPPORT',          hint: 'Price floor level' },
  { plain: 'RESISTANCE',       hint: 'Price ceiling level' },
  { plain: 'BREAKOUT',         hint: 'Price escapes range' },
  { plain: 'REVERSAL',         hint: 'Trend direction change' },
  { plain: 'VOLUME',           hint: 'Trade amount' },
  { plain: 'FLOOR',            hint: 'Minimum price' },
  { plain: 'CANDLE',           hint: 'Price chart bar' },
  { plain: 'MOMENTUM',         hint: 'Trend strength' },
  { plain: 'STOP LOSS',        hint: 'Auto exit on drop' },
  { plain: 'TAKE PROFIT',      hint: 'Auto exit on gain' },
  { plain: 'LIMIT ORDER',      hint: 'Buy or sell at set price' },
  { plain: 'MARKET ORDER',     hint: 'Instant fill at best price' },
  { plain: 'FRONTRUN',         hint: 'Copy trade before target' },
  { plain: 'SANDWICH',         hint: 'MEV attack pattern' },
  { plain: 'MEV',              hint: 'Miner extractable value' },
  { plain: 'MEAN REVERSION',   hint: 'Price returns to average' },
  { plain: 'BACKTEST',         hint: 'Test strategy on history' },
  // NFTs
  { plain: 'NFT',              hint: 'Non-fungible token' },
  { plain: 'MINT',             hint: 'Create an NFT' },
  { plain: 'BURN',             hint: 'Destroy a token' },
  { plain: 'RARITY',           hint: 'Uniqueness score' },
  { plain: 'TRAIT',            hint: 'NFT attribute' },
  { plain: 'METADATA',         hint: 'Token description data' },
  { plain: 'ROYALTY',          hint: 'Creator resale fee' },
  { plain: 'COLLECTION',       hint: 'Set of related NFTs' },
  { plain: 'SWEEP',            hint: 'Buy multiple floor items' },
  { plain: 'ALLOWLIST',        hint: 'Pre-approved minters' },
  { plain: 'REVEAL',           hint: 'Unveil NFT artwork' },
  { plain: 'AUCTION',          hint: 'Competitive sale' },
  { plain: 'HOLDER',           hint: 'Token owner' },
  { plain: 'SOULBOUND',        hint: 'Non-transferable token' },
  { plain: 'GENERATIVE',       hint: 'Algorithmically created art' },
  { plain: 'FRACTIONALIZE',    hint: 'Split NFT into shares' },
  { plain: 'DERIVATIVE',       hint: 'Inspired by another collection' },
  { plain: 'FLOOR PRICE',      hint: 'Cheapest listed NFT' },
  { plain: 'PAPER HAND',       hint: 'Sell at first drop' },
  { plain: 'DIAMOND HAND',     hint: 'Hold through all losses' },
  // Security
  { plain: 'AUDIT',            hint: 'Security code review' },
  { plain: 'EXPLOIT',          hint: 'Use a vulnerability' },
  { plain: 'RUGPULL',          hint: 'Exit scam' },
  { plain: 'PHISH',            hint: 'Trick for credentials' },
  { plain: 'TIMELOCK',         hint: 'Delayed execution' },
  { plain: 'REENTRANCY',       hint: 'Smart contract attack pattern' },
  { plain: 'OVERFLOW',         hint: 'Number wraps around bug' },
  { plain: 'SOCIAL ENGINEERING', hint: 'Hack via human manipulation' },
  // Smart Contracts
  { plain: 'SMART CONTRACT',   hint: 'Self-executing code' },
  { plain: 'GAS',              hint: 'Transaction fee unit' },
  { plain: 'CALLDATA',         hint: 'Input data for a contract' },
  { plain: 'STORAGE',          hint: 'Persistent on-chain data' },
  { plain: 'PROXY',            hint: 'Upgradeable contract pattern' },
  { plain: 'UPGRADE',          hint: 'Improve on-chain code' },
  { plain: 'MIGRATION',        hint: 'Move to new contract' },
  { plain: 'INTERFACE',        hint: 'Contract interaction spec' },
  { plain: 'LIBRARY',          hint: 'Reusable contract code' },
  { plain: 'BYTECODE',         hint: 'Compiled contract binary' },
  { plain: 'OPCODE',           hint: 'VM instruction unit' },
  { plain: 'EMIT',             hint: 'Trigger a log event' },
  { plain: 'INSTRUCTION',      hint: 'Single on-chain command' },
  { plain: 'INVOKE',           hint: 'Call another program' },
  { plain: 'COMPUTE UNIT',     hint: 'Solana processing cost unit' },
  { plain: 'PRIORITY FEE',     hint: 'Pay more to go first' },
  { plain: 'BLOCKHASH',        hint: 'Recent block identifier' },
  { plain: 'DURABLE NONCE',    hint: 'Offline signing technique' },
  // Governance
  { plain: 'DAO',              hint: 'Decentralised organisation' },
  { plain: 'PROPOSAL',         hint: 'Governance vote item' },
  { plain: 'QUORUM',           hint: 'Minimum participation needed' },
  { plain: 'DELEGATE',         hint: 'Assign vote power' },
  { plain: 'VETO',             hint: 'Block a decision' },
  { plain: 'REFERENDUM',       hint: 'Community-wide vote' },
  { plain: 'AMENDMENT',        hint: 'Change to rules' },
  { plain: 'RATIFY',           hint: 'Formally approve' },
  { plain: 'COUNCIL',          hint: 'Governing body' },
  { plain: 'MANDATE',          hint: 'Approved directive' },
  // Stablecoins
  { plain: 'STABLECOIN',       hint: 'Pegged digital dollar' },
  { plain: 'DEPEG',            hint: 'Lose the dollar link' },
  { plain: 'ALGORITHMIC',      hint: 'Formula-based peg' },
  { plain: 'OVERCOLLATERAL',   hint: 'Extra backing safety' },
  // ZK / Cryptography
  { plain: 'CIRCUIT',          hint: 'ZK computation building block' },
  { plain: 'WITNESS',          hint: 'Private input data' },
  { plain: 'VERIFIER',         hint: 'Checks the proof' },
  { plain: 'PROVER',           hint: 'Creates the proof' },
  { plain: 'NULLIFIER',        hint: 'Spend marker' },
  { plain: 'POSEIDON',         hint: 'ZK-friendly hash function' },
  { plain: 'RECURSION',        hint: 'Proof of proofs' },
  { plain: 'FOLDING',          hint: 'Proof aggregation method' },
  { plain: 'PEDERSEN',         hint: 'Hash commitment scheme' },
  // Infrastructure
  { plain: 'RPC',              hint: 'Remote procedure call' },
  { plain: 'API',              hint: 'Application interface' },
  { plain: 'SDK',              hint: 'Developer toolkit' },
  { plain: 'CLI',              hint: 'Command line tool' },
  { plain: 'LATENCY',          hint: 'Network delay' },
  { plain: 'UPTIME',           hint: 'System availability' },
  { plain: 'INDEXER',          hint: 'Parses blockchain data' },
  { plain: 'WEBHOOK',          hint: 'Event notification URL' },
  { plain: 'MONITOR',          hint: 'Track system health' },
  { plain: 'ROLLBACK',         hint: 'Revert to prior state' },
  { plain: 'PATCH',            hint: 'Fix a vulnerability' },
  { plain: 'CANARY',           hint: 'Staged rollout method' },
  // Other Chains
  { plain: 'ETHEREUM',         hint: 'Second largest blockchain' },
  { plain: 'BITCOIN',          hint: 'Original cryptocurrency' },
  { plain: 'AVALANCHE',        hint: 'Fast L1 with subnets' },
  { plain: 'COSMOS',           hint: 'Internet of blockchains' },
  { plain: 'POLKADOT',         hint: 'Parachain network' },
  { plain: 'NEAR',             hint: 'Developer friendly L1' },
  { plain: 'APTOS',            hint: 'Move-based L1' },
  { plain: 'SUI',              hint: 'Object-based L1' },
  { plain: 'BASE',             hint: 'Coinbase L2' },
  { plain: 'OPTIMISM',         hint: 'Optimistic rollup L2' },
  { plain: 'ARBITRUM',         hint: 'Popular Ethereum L2' },
  { plain: 'POLYGON',          hint: 'Ethereum scaling network' },
  // Fundraising
  { plain: 'ICO',              hint: 'Initial coin offering' },
  { plain: 'IDO',              hint: 'Initial DEX offering' },
  { plain: 'PRESALE',          hint: 'Pre-launch token sale' },
  { plain: 'LAUNCHPAD',        hint: 'Token launch platform' },
  { plain: 'VENTURE',          hint: 'Risk investment capital' },
  { plain: 'VALUATION',        hint: 'Company worth estimate' },
  { plain: 'DILUTION',         hint: 'Ownership percentage drop' },
  { plain: 'CLIFF',            hint: 'Vesting start point' },
  { plain: 'SEED ROUND',       hint: 'First funding stage' },
  { plain: 'SERIES A',         hint: 'Second funding round' },
  // Web3 Culture
  { plain: 'WAGMI',            hint: 'We all gonna make it' },
  { plain: 'NGMI',             hint: 'Not gonna make it' },
  { plain: 'FOMO',             hint: 'Fear of missing out' },
  { plain: 'FUD',              hint: 'Fear uncertainty doubt' },
  { plain: 'SHILL',            hint: 'Promote aggressively' },
  { plain: 'REKT',             hint: 'Lost everything' },
  { plain: 'MOON',             hint: 'Massive price increase' },
  { plain: 'BUIDL',            hint: 'Build useful things' },
  { plain: 'DYOR',             hint: 'Do your own research' },
  { plain: 'ANON',             hint: 'Anonymous contributor' },
  { plain: 'MAXI',             hint: 'Single-chain believer' },
  { plain: 'BAGHOLDER',        hint: 'Stuck holding losses' },
  { plain: 'COPE',             hint: 'Denial after a loss' },
  { plain: 'BASED',            hint: 'Admirable in crypto' },
  { plain: 'FREN',             hint: 'Friend in crypto' },
  { plain: 'VIBES',            hint: 'Community energy' },
  { plain: 'PLEB',             hint: 'Regular person' },
  { plain: 'APE',              hint: 'Buy without research' },
  { plain: 'WHITEPAPER',       hint: 'Project document' },
  { plain: 'ROADMAP',          hint: 'Development plan' },
  { plain: 'ALPHA LEAK',       hint: 'Early inside information' },
  { plain: 'EXIT LIQUIDITY',   hint: 'Buyers for others dump' },
  { plain: 'PONZI',            hint: 'Unsustainable scheme' },
  // Decentralized Social & Storage
  { plain: 'FARCASTER',        hint: 'Decentralised social network' },
  { plain: 'IPFS',             hint: 'Distributed file storage' },
  { plain: 'ARWEAVE',          hint: 'Permanent storage chain' },
  { plain: 'ENS',              hint: 'Ethereum name service' },
  { plain: 'SEEKER',           hint: 'Solana mobile ecosystem' },
  { plain: 'REALMS',           hint: 'Solana governance app' },
  { plain: 'ALLDOMAINS',       hint: 'Multi-chain naming service' },
  // More Solana Technical
  { plain: 'MINT AUTHORITY',   hint: 'Who can create tokens' },
  { plain: 'FREEZE AUTHORITY', hint: 'Who can freeze accounts' },
  { plain: 'SPL TOKEN',        hint: 'Solana token standard' },
  { plain: 'WRAPPED SOL',      hint: 'SOL as a token account' },
  { plain: 'PDA',              hint: 'Program derived address' },
  { plain: 'BUMP SEED',        hint: 'PDA canonical nonce' },
  { plain: 'CPI',              hint: 'Cross program invocation' },
  { plain: 'COMPRESSED NFT',   hint: 'Low cost Solana NFT' },
  { plain: 'LOOKUP TABLE',     hint: 'Address compression trick' },
  { plain: 'VERSIONED TRANSACTION', hint: 'Newer Solana tx format' },
  // Extra Terms
  { plain: 'TRANSFER',         hint: 'Move tokens between wallets' },
  { plain: 'MINTING',          hint: 'Creating new tokens' },
  { plain: 'BURNING',          hint: 'Destroying tokens' },
  { plain: 'WHITELIST',        hint: 'Approved addresses only' },
  { plain: 'DECENTRALIZED',    hint: 'No single point of control' },
  { plain: 'CONSENSUS LAYER',  hint: 'Agreement part of blockchain' },
  { plain: 'EXECUTION LAYER',  hint: 'Processes transactions' },
  { plain: 'DATA LAYER',       hint: 'Stores blockchain history' },
  { plain: 'VALIDATOR SET',    hint: 'Active network operators' },
  { plain: 'SUPERMAJORITY',    hint: 'Two thirds agreement' },
  { plain: 'BYZANTINE',        hint: 'Faulty node problem' },
  { plain: 'NAKAMOTO',         hint: 'Bitcoin creator pseudonym' },
  { plain: 'SATOSHI',          hint: 'Smallest Bitcoin unit' },
  { plain: 'GWEI',             hint: 'Smallest Ethereum fee unit' },
  { plain: 'WEI',              hint: 'Smallest ETH denomination' },
  { plain: 'SECP256K1',        hint: 'Bitcoin elliptic curve' },
  { plain: 'ED25519',          hint: 'Solana signature curve' },
  { plain: 'KECCAK',           hint: 'Ethereum hash function' },
  { plain: 'SHA256',           hint: 'Bitcoin hash function' },
  { plain: 'BLS',              hint: 'Aggregate signature scheme' },
  { plain: 'ECDSA',            hint: 'Elliptic curve signing' },
  { plain: 'P2P',              hint: 'Peer to peer network' },
  { plain: 'LIBP2P',           hint: 'P2P networking library' },
  { plain: 'LIGHT CLIENT',     hint: 'Minimal verification node' },
  { plain: 'FULL NODE',        hint: 'Stores entire blockchain' },
  { plain: 'ARCHIVE NODE',     hint: 'Stores all historical states' },
  { plain: 'SNAPSHOT',         hint: 'State captured at a moment' },
  { plain: 'STATE ROOT',       hint: 'Hash of all account states' },
  { plain: 'RECEIPT',          hint: 'Transaction result log' },
  { plain: 'LOG',              hint: 'On-chain event record' },
  { plain: 'BLOCK EXPLORER',   hint: 'View on-chain activity' },
  { plain: 'SOLSCAN',          hint: 'Solana block explorer' },
  { plain: 'ETHERSCAN',        hint: 'Ethereum block explorer' },
  { plain: 'DAPP',             hint: 'Decentralised application' },
  { plain: 'GAME FI',          hint: 'Blockchain gaming finance' },
  { plain: 'SOCIAL FI',        hint: 'Tokenised social media' },
  { plain: 'REAL WORLD ASSET', hint: 'Tokenised physical asset' },
  { plain: 'TOKENIZE',         hint: 'Put asset on-chain' },
  { plain: 'PERMAWEB',         hint: 'Permanent decentralised web' },
  { plain: 'HOTSPOT',          hint: 'Wireless mining node' },
  { plain: 'HELIUM',           hint: 'Decentralised wireless network' },
  { plain: 'RENDER',           hint: 'GPU compute network' },
  { plain: 'FILECOIN',         hint: 'Storage marketplace chain' },
  { plain: 'CERAMIC',          hint: 'Decentralised data protocol' },
  { plain: 'LENS',             hint: 'Web3 social graph' },
  { plain: 'PUSH PROTOCOL',    hint: 'Web3 notifications' },
  { plain: 'CHAINLINK',        hint: 'Decentralised oracle network' },
  { plain: 'UNISWAP',          hint: 'Ethereum DEX pioneer' },
  { plain: 'AAVE',             hint: 'Lending protocol' },
  { plain: 'COMPOUND',         hint: 'Algorithmic money market' },
  { plain: 'CURVE',            hint: 'Stablecoin exchange' },
  { plain: 'CONVEX',           hint: 'Curve yield booster' },
  { plain: 'YEARN',            hint: 'Yield optimiser vault' },
  { plain: 'PENDLE',           hint: 'Yield trading protocol' },
  { plain: 'DRIFT',            hint: 'Solana perps DEX' },
  { plain: 'ZETA',             hint: 'Solana options DEX' },
  { plain: 'MARGINFI',         hint: 'Solana lending protocol' },
  { plain: 'KAMINO',           hint: 'Solana liquidity protocol' },
  { plain: 'SQUADS',           hint: 'Solana multisig protocol' },
  { plain: 'STREAMFLOW',       hint: 'Solana token vesting' },
  { plain: 'DIALECT',          hint: 'Solana messaging protocol' },
  { plain: 'BACKPACK',         hint: 'xNFT Solana wallet' },
  { plain: 'GOKI',             hint: 'Solana smart wallet' },
  { plain: 'TRIBECA',          hint: 'Solana governance protocol' },
  { plain: 'VOTE ESCROW',      hint: 'Lock tokens for governance power' },
  { plain: 'REBATE',           hint: 'Fee returned to user' },
  { plain: 'SUBSIDY',          hint: 'Incentive payment' },
  { plain: 'POINTS',           hint: 'Pre-token reward system' },
  { plain: 'SEASON',           hint: 'Reward campaign period' },
  { plain: 'RETROACTIVE',      hint: 'Reward for past actions' },
  { plain: 'REFERRAL',         hint: 'Bring a friend reward' },
  { plain: 'STREAK',           hint: 'Consecutive day bonus' },
  { plain: 'LEADERBOARD',      hint: 'Top players ranking' },
  { plain: 'MULTIPLIER',       hint: 'Score boost factor' },
  { plain: 'COOLDOWN',         hint: 'Wait period between actions' },
  { plain: 'RESPAWN',          hint: 'Try again after loss' },
  { plain: 'RAID',             hint: 'High risk extraction mission' },
  { plain: 'EXTRACTION',       hint: 'Escape with the yield' },
  { plain: 'BUST',             hint: 'Caught and lost everything' },
  { plain: 'DEPLOY PHASE',     hint: 'Entry into the mission' },
  { plain: 'EXTRACT PHASE',    hint: 'Safe withdrawal window' },
  { plain: 'RISK METER',       hint: 'Danger level indicator' },
  { plain: 'YIELD METER',      hint: 'Rewards earned so far' },
  { plain: 'CASHOUT',          hint: 'Take winnings and leave' },
];

function getTodayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function getTodayPuzzle() {
  const dayIndex = Math.floor(Date.now() / 86_400_000);
  const entry = PUZZLE_BANK[dayIndex % PUZZLE_BANK.length];
  return { cipher: caesarEncode(entry.plain), hint: entry.hint };
}

function formatCountdown(): string {
  const now = new Date();
  const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const diff = tomorrow.getTime() - now.getTime();
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1_000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const BriefingScreen: React.FC<BriefingScreenProps> = ({
  walletAddress,
  srPoints,
  onCheckBriefing,
  onSpendSR,
  onBack,
}) => {
  const todayDate = getTodayUTC();
  const puzzle = getTodayPuzzle();
  const { winner, alreadyClaimed, loading } = useDailyBriefing(walletAddress);

  const [answer, setAnswer] = useState('');
  const [showHint, setShowHint] = useState(false);
  const [decoderUnlocked, setDecoderUnlocked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ correct: boolean; reward_sr?: number; isFirst?: boolean } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [countdown, setCountdown] = useState(formatCountdown());

  const canAffordDecoder = srPoints >= DECODER_COST;

  const handleUnlockDecoder = () => {
    if (!canAffordDecoder || decoderUnlocked) return;
    onSpendSR(DECODER_COST);
    setDecoderUnlocked(true);
  };

  // Live countdown to next briefing
  useEffect(() => {
    const interval = setInterval(() => setCountdown(formatCountdown()), 1_000);
    return () => clearInterval(interval);
  }, []);

  const shortWallet = (w: string) => `${w.slice(0, 4)}...${w.slice(-4)}`;

  const handleSubmit = async () => {
    if (!walletAddress) return;
    if (!answer.trim()) return;
    setSubmitting(true);
    setErrorMsg('');
    try {
      const res = await onCheckBriefing(answer.trim(), todayDate);
      setResult(res);
      if (!res.correct) {
        setErrorMsg('Wrong answer. Try again.');
      }
    } catch (err: any) {
      const msg = err?.message ?? 'Something went wrong';
      if (msg.includes('ALREADY_CLAIMED') || msg.includes('Already claimed')) {
        setErrorMsg('You already claimed today\'s briefing.');
      } else {
        setErrorMsg(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const claimed = alreadyClaimed || (result?.correct === true);

  return (
    <div className="h-full flex flex-col overflow-y-auto scrollbar-hide pb-28 md:pb-8" style={{ backgroundColor: 'var(--app-bg)' }}>
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 pt-5 pb-4 border-b border-white/6">
        <button onClick={onBack} className="text-white/40 hover:text-white transition-colors p-1">
          <i className="fa-solid fa-arrow-left text-sm" />
        </button>
        <div className="text-center">
          <h1
            className="text-lg font-black text-white uppercase tracking-widest"
            style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '3px' }}
          >
            The Briefing
          </h1>
          <p className="text-[10px] text-white/30 font-bold">Daily Cipher · {todayDate}</p>
        </div>
        <div className="text-right">
          <p className="text-[9px] text-white/30 font-bold uppercase tracking-widest">Next in</p>
          <p className="text-xs font-black text-[#FFB800] font-mono">{countdown}</p>
        </div>
      </div>

      <div className="flex-1 px-4 py-6 max-w-md mx-auto w-full space-y-5">

        {/* SR Tiers */}
        <div className="flex gap-2">
          <div
            className="flex-1 rounded-xl p-3 text-center"
            style={{ background: 'rgba(255,184,0,0.06)', border: '1px solid rgba(255,184,0,0.20)' }}
          >
            <p className="text-base font-black text-[#FFB800]">🥇 +1,000 SR</p>
            <p className="text-[9px] text-white/40 mt-0.5 font-bold uppercase tracking-wide">First solve</p>
          </div>
          <div
            className="flex-1 rounded-xl p-3 text-center"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <p className="text-base font-black text-white">+200 SR</p>
            <p className="text-[9px] text-white/40 mt-0.5 font-bold uppercase tracking-wide">All others</p>
          </div>
        </div>

        {/* Winner banner */}
        {winner && (
          <div
            className="rounded-xl p-3 flex items-center gap-3"
            style={{ background: 'rgba(255,184,0,0.08)', border: '1px solid rgba(255,184,0,0.25)' }}
          >
            <span className="text-xl shrink-0">🥇</span>
            <div>
              <p className="text-xs font-black text-[#FFB800]">First solve: {shortWallet(winner.wallet)}</p>
              <p className="text-[10px] text-white/40">
                {new Date(winner.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} UTC
              </p>
            </div>
          </div>
        )}

        {/* Cipher display */}
        <div
          className="rounded-2xl p-5 space-y-3"
          style={{ background: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.10)' }}
        >
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1.5 h-1.5 bg-[#FF2929] rounded-full animate-pulse" />
            <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Today's cipher</p>
          </div>
          <p
            className="text-3xl font-black text-white tracking-widest text-center py-3 select-all"
            style={{ fontFamily: "'Courier New', monospace", letterSpacing: '5px', lineHeight: 1.3 }}
          >
            {puzzle.cipher}
          </p>
          {/* Hint toggle */}
          <button
            onClick={() => setShowHint(v => !v)}
            className="text-[10px] font-bold text-white/30 hover:text-white/60 transition-colors uppercase tracking-widest flex items-center gap-1.5"
          >
            <i className={`fa-solid fa-chevron-${showHint ? 'up' : 'down'} text-[8px]`} />
            {showHint ? 'Hide hint' : 'Show hint'}
          </button>
          {showHint && (
            <div className="space-y-2 animate-in fade-in duration-200">
              <p className="text-xs text-[#FFB800]/80 font-bold">💡 {puzzle.hint}</p>
              {/* Letter-count slots derived from cipher (spaces preserved) */}
              <div className="flex items-center gap-2 flex-wrap">
                {puzzle.cipher.split(' ').map((word, wi) => (
                  <div key={wi} className="flex items-center gap-1">
                    {wi > 0 && <span className="text-white/20 text-xs mx-1">·</span>}
                    {Array.from(word).map((_, li) => (
                      <div
                        key={li}
                        className="w-4 h-0.5 bg-[#FFB800]/50 rounded-full"
                      />
                    ))}
                    <span className="text-[9px] text-white/25 font-bold ml-0.5">{word.length}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── CIPHER KEY (locked behind SR) ── */}
        {!decoderUnlocked ? (
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: '1px solid rgba(255,255,255,0.08)' }}
          >
            {/* Blurred preview of the table */}
            <div className="relative px-4 py-3 select-none" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <div className="blur-sm pointer-events-none font-mono text-[10px] text-white/40 leading-5 space-y-0.5">
                <p>Plain&nbsp;&nbsp;A B C D E F G H I J K L M</p>
                <p>Cipher D E F G H I J K L M N O P</p>
              </div>
              {/* Lock overlay */}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                <i className="fa-solid fa-lock text-white/30 text-base" />
                <p className="text-[10px] font-black text-white/50 uppercase tracking-widest">Cipher Key</p>
              </div>
            </div>
            {/* Unlock button */}
            <button
              onClick={handleUnlockDecoder}
              disabled={!canAffordDecoder || !walletAddress}
              className="w-full py-2.5 text-xs font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={
                canAffordDecoder && walletAddress
                  ? { background: 'rgba(255,184,0,0.10)', borderTop: '1px solid rgba(255,184,0,0.20)', color: '#FFB800' }
                  : { background: 'rgba(255,255,255,0.03)', borderTop: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.25)' }
              }
            >
              <i className="fa-solid fa-unlock text-[10px]" />
              {!walletAddress
                ? 'Connect wallet'
                : !canAffordDecoder
                ? `Need ${DECODER_COST} SR to unlock`
                : `Unlock full key · ${DECODER_COST} SR`}
            </button>
          </div>
        ) : (
          <div
            className="rounded-xl p-4 space-y-2 animate-in fade-in duration-300"
            style={{ background: 'rgba(255,184,0,0.05)', border: '1px solid rgba(255,184,0,0.20)' }}
          >
            <div className="flex items-center gap-2 mb-1">
              <i className="fa-solid fa-key text-[#FFB800] text-[10px]" />
              <p className="text-[10px] font-black text-[#FFB800] uppercase tracking-widest">Cipher Key — Caesar +3</p>
            </div>
            <div className="font-mono text-[10px] leading-6 overflow-x-auto scrollbar-hide">
              <div className="flex gap-0 min-w-max">
                <span className="text-white/40 w-14 shrink-0">Plain</span>
                {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(c => (
                  <span key={c} className="w-[18px] text-center text-white/60">{c}</span>
                ))}
              </div>
              <div className="flex gap-0 min-w-max">
                <span className="text-[#FFB800]/60 w-14 shrink-0">Cipher</span>
                {'DEFGHIJKLMNOPQRSTUVWXYZABC'.split('').map((c, i) => (
                  <span key={i} className="w-[18px] text-center font-black text-[#FFB800]">{c}</span>
                ))}
              </div>
            </div>
            <p className="text-[9px] text-white/25 pt-1">
              To decode: find the Cipher letter → read the Plain letter above it.
            </p>
          </div>
        )}

        {/* Already claimed state */}
        {claimed ? (
          <div
            className="rounded-xl p-5 text-center space-y-2"
            style={{ background: 'rgba(255,184,0,0.06)', border: '1px solid rgba(255,184,0,0.25)' }}
          >
            <p className="text-2xl">✅</p>
            {result?.correct ? (
              <>
                <p className="text-base font-black text-[#FFB800]">
                  {result.isFirst ? '🥇 First solve!' : 'Correct!'}
                </p>
                <p className="text-sm text-white/70">+{result.reward_sr?.toLocaleString()} SR awarded</p>
                {result.isFirst && <p className="text-xs text-white/40">You were the first to crack today's cipher</p>}
              </>
            ) : (
              <>
                <p className="text-base font-black text-white/60">Already claimed today</p>
                <p className="text-xs text-white/30">Come back tomorrow for a new cipher</p>
              </>
            )}
          </div>
        ) : (
          <>
            {/* Input */}
            {!walletAddress ? (
              <div className="rounded-xl bg-white/3 border border-white/10 p-4 text-center">
                <p className="text-white/40 text-sm font-bold">Connect wallet to claim SR</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative">
                  <input
                    type="text"
                    value={answer}
                    onChange={e => setAnswer(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !submitting && handleSubmit()}
                    placeholder="Decode the cipher..."
                    maxLength={40}
                    disabled={submitting}
                    className="w-full rounded-xl px-4 py-3.5 text-sm font-bold text-white placeholder-white/20 focus:outline-none transition-all"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', fontFamily: "'Inter', sans-serif" }}
                  />
                </div>

                {errorMsg && (
                  <p className="text-xs font-bold text-[#FF2929] animate-in fade-in duration-200">{errorMsg}</p>
                )}

                <button
                  onClick={handleSubmit}
                  disabled={submitting || !answer.trim()}
                  className="w-full py-4 rounded-xl font-black text-base transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={
                    !submitting && answer.trim()
                      ? { background: 'linear-gradient(135deg, #FF2929 0%, #CC0000 100%)', color: '#fff', boxShadow: '0 0 25px rgba(255,41,41,0.25)', fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '2px', fontSize: '18px' }
                      : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.3)', fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '2px', fontSize: '18px' }
                  }
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <i className="fa-solid fa-circle-notch fa-spin text-base" />
                      DECODING...
                    </span>
                  ) : 'DECODE & CLAIM'}
                </button>
              </div>
            )}
          </>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="rounded-xl bg-white/3 border border-white/5 p-4 animate-pulse text-center">
            <p className="text-white/20 text-xs font-bold">Checking claim status...</p>
          </div>
        )}

        {/* Info footer */}
        <div className="pt-2 border-t border-white/5 space-y-1.5">
          <p className="text-[10px] text-white/25 font-bold uppercase tracking-widest">How it works</p>
          <p className="text-[11px] text-white/35 leading-relaxed">
            Each day a new cipher rotates. Decode it and claim SR. First solver earns 1,000 SR, all others earn 200 SR. One claim per wallet per day.
          </p>
        </div>

      </div>
    </div>
  );
};

export default BriefingScreen;
