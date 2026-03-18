
// ── Post-Raid Breakdown Event ──────────────────────────────────────────────
export interface RaidEvent {
  tick: number;        // elapsed seconds when it happened
  type: string;        // machine identifier
  reason: string;      // why it happened (shown to player)
  impact: string;      // what it did (+15 RISK, -50% SOL, etc.)
  severity: 'danger' | 'warning' | 'bonus' | 'info';
}

export enum Screen {
  LOBBY = 'LOBBY',
  RAID = 'RAID',
  TEAM = 'TEAM',
  TOURNAMENT = 'TOURNAMENT',
  RESULT = 'RESULT',
  PRIVACY = 'PRIVACY',
  TERMS = 'TERMS',
  PROFILE = 'PROFILE',
  STORE = 'STORE',
  MULTIPLAYER_SETUP = 'MULTIPLAYER_SETUP', // New: Menu/Create/Join/Lobby
  MULTIPLAYER_GAME = 'MULTIPLAYER_GAME',    // New: The PvP Raid
  TREASURY = 'TREASURY', // New: Treasury Page
  BOUNTY = 'BOUNTY',     // Bounty Board
  ROAST = 'ROAST',       // Wallet Roast
  BRIEFING = 'BRIEFING', // Daily Briefing cipher puzzle
  ADMIN = 'ADMIN',       // Admin panel — /rushtik
}

export enum Mode {
  SOLO = 'SOLO',
  TEAM = 'TEAM',
  TOURNAMENT = 'TOURNAMENT',
  DRILL = 'DRILL',
  PVP = 'PVP' // New
}

export enum Difficulty {
  EASY = 'EASY',
  MEDIUM = 'MEDIUM',
  HARD = 'HARD',
  DEGEN = 'DEGEN'
}

export const DIFFICULTY_CONFIG: Record<Difficulty, { riskMod: number, driftMod: number, multMod: number, label: string, color: string }> = {
  [Difficulty.EASY]: { riskMod: -10, driftMod: 0.8, multMod: 0.85, label: 'SAFE_MODE', color: 'text-green-500' },
  [Difficulty.MEDIUM]: { riskMod: 0, driftMod: 1.0, multMod: 1.0, label: 'STANDARD', color: 'text-cyan-400' },
  [Difficulty.HARD]: { riskMod: 15, driftMod: 1.3, multMod: 1.4, label: 'HARDCORE', color: 'text-orange-500' },
  [Difficulty.DEGEN]: { riskMod: 30, driftMod: 1.8, multMod: 2.5, label: 'DEGEN_SUICIDE', color: 'text-[#8833ee]' }
};

/** Maximum SOL payout at 5,000 points (no bonuses, pre-platform-fee) — decoupled from entry fee */
export const DIFFICULTY_MAX_WIN: Record<Difficulty, number> = {
  [Difficulty.EASY]:   0.03,
  [Difficulty.MEDIUM]: 0.07,
  [Difficulty.HARD]:   0.20,
  [Difficulty.DEGEN]:  0.60,
};

export enum Currency {
  SOL = 'SOL',
  USDC = 'USDC',
  SKR = 'SKR',
  RAID = 'RAID'
}

// Currency rates are fetched live via usePrices hook — no hardcoded fallback
export const CURRENCY_RATES: Record<Currency, number> = {
  [Currency.SOL]:  1,
  [Currency.USDC]: 0,
  [Currency.SKR]:  0,
  [Currency.RAID]: 0,
};

// ── Raid Pass (ticket system) ─────────────────────────────────────────────────
export interface RaidPass {
  id: string;
  name: string;
  tickets: number;
  usdPrice: number;  // base price in USD — converted to SOL/USDC/SKR via live rates; SKR pays 50% off
  description: string;
  badge: string;
}

export const RAID_PASSES: RaidPass[] = [
  {
    id: 'pass_basic',
    name: 'BASIC PASS',
    tickets: 10,
    usdPrice: 10,
    description: '10 discounted entries. 50% off entry fee per ticket.',
    badge: 'I',
  },
  {
    id: 'pass_core',
    name: 'CORE PASS',
    tickets: 25,
    usdPrice: 20,
    description: '25 discounted entries + 10% win boost per ticket.',
    badge: 'II',
  },
  {
    id: 'pass_pro',
    name: 'PRO PASS',
    tickets: 60,
    usdPrice: 35,
    description: '60 entries. Max discount + max win boost. Degen tier.',
    badge: 'III',
  },
  {
    id: 'pass_elite',
    name: 'ELITE PASS',
    tickets: 120,
    usdPrice: 60,
    description: '120 entries. Elite-tier access with priority queue and double SR bonus.',
    badge: 'IV',
  },
  {
    id: 'pass_legend',
    name: 'LEGEND PASS',
    tickets: 250,
    usdPrice: 100,
    description: '250 entries. Full legend status, max perks, exclusive badge, priority everything.',
    badge: 'V',
  },
];

/** Platform fee deducted from winners. 5% on raid wins, 10% on PvP pot. */
export const PLATFORM_FEE_RAID = 0.05;
export const PLATFORM_FEE_PVP  = 0.10;

// ── Achievements ──────────────────────────────────────────────────────────────
export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  icon: string; // emoji
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'FIRST_RAID',    name: 'First Boot',     description: 'Complete your first raid',           icon: '🎯' },
  { id: 'FIRST_EXTRACT', name: 'First Extract',  description: 'Win your first raid',                icon: '💰' },
  { id: 'RAIDS_10',      name: 'Operator',       description: 'Complete 10 raids',                  icon: '⚔️' },
  { id: 'RAIDS_50',      name: 'Veteran',        description: 'Complete 50 raids',                  icon: '🏆' },
  { id: 'RAIDS_100',     name: 'Legend',         description: 'Complete 100 raids',                 icon: '👑' },
  { id: 'WINS_10',       name: 'Extractor',      description: 'Win 10 raids',                       icon: '💎' },
  { id: 'WINS_50',       name: 'Vault Breaker',  description: 'Win 50 raids',                       icon: '🔓' },
  { id: 'DEGEN_SURVIVE', name: 'Degen Survivor', description: 'Survive a DEGEN difficulty raid',    icon: '🔥' },
  { id: 'STREAK_3',      name: 'On A Roll',      description: '3-day login streak',                 icon: '⚡' },
  { id: 'STREAK_7',      name: 'Relentless',     description: '7-day login streak',                 icon: '🌟' },
  { id: 'HIGH_SCORE',    name: 'High Roller',    description: 'Score 4000+ points in one raid',     icon: '📈' },
  { id: 'PVP_WIN',       name: 'Duelist',        description: 'Win a PvP duel',                     icon: '⚡' },
];

export const ENTRY_FEES: Record<Mode, number> = {
  [Mode.SOLO]: 0.026,
  [Mode.TEAM]: 0.1,
  [Mode.TOURNAMENT]: 0.2,
  [Mode.DRILL]: 0.00,
  [Mode.PVP]: 0.00 // Dynamic in PvP
};

// ── Raid Tier System (Round Competition) ─────────────────────────────────────
export enum RaidTier {
  GRUNT = 'GRUNT',
  ELITE = 'ELITE',
  WHALE = 'WHALE',
}

export const RAID_TIER_CONFIG: Record<RaidTier, {
  label: string;
  entryFee: number; // SOL
  color: string;
  description: string;
  emoji: string;
}> = {
  [RaidTier.GRUNT]: { label: 'GRUNT', entryFee: 0.026, color: '#94a3b8', description: 'Casual — small pool, anyone can enter.',       emoji: '🔧' },
  [RaidTier.ELITE]: { label: 'ELITE', entryFee: 0.05,  color: '#FFB800', description: 'Competitive — 5× bigger pool vs Grunt.',       emoji: '⚔️' },
  [RaidTier.WHALE]: { label: 'WHALE', entryFee: 0.25,  color: '#9945FF', description: 'Degens only — 25× pool vs Grunt. High risk.',   emoji: '🐋' },
};

/**
 * Prize pool allocation per tier — fractions of pool for ranks 1–5 (must sum to 1.0).
 * GRUNT: flatter split — casual players share more equally.
 * ELITE: standard competitive weighting.
 * WHALE: winner-takes-most for high-stakes degen play.
 */
export const RAID_TIER_ALLOCATION: Record<RaidTier, [number, number, number, number, number]> = {
  [RaidTier.GRUNT]: [0.35, 0.25, 0.20, 0.13, 0.07],
  [RaidTier.ELITE]: [0.40, 0.28, 0.18, 0.10, 0.04],
  [RaidTier.WHALE]: [0.50, 0.25, 0.15, 0.07, 0.03],
};

/** Minimum unique wallets that must compete for a round to be finalised with winners.
 *  If fewer participate, all entry fees are refunded to participants' unclaimed_sol. */
export const ROUND_MIN_PARTICIPANTS = 3;

// --- MULTIPLAYER INTERFACES ---

export interface Opponent {
  id: string;
  name: string;
  status: 'WAITING' | 'RAIDING' | 'BUSTED' | 'EXTRACTED';
  score: number; // 0 if busted/raiding, final score if extracted
  solResult: number;
}

export interface Room {
  id: string;
  code: string; // The Invite Code
  hostId: string;
  stakePerPlayer: number;
  stakeCurrency: Currency; // SOL | USDC | SKR
  maxPlayers: number;
  players: Opponent[];
  status: 'LOBBY' | 'LOCKED' | 'ACTIVE' | 'FINISHED';
  poolTotal: number;
  seed: string; // Shared RNG seed
}

export interface Boost {
  id: string;
  name: string;
  description: string;
  cost: number;
  effectType: 'RISK' | 'MULTIPLIER';
  value: number;
  icon: string;
}

export const RAID_BOOSTS: Boost[] = [
  { 
    id: 'risk_shield', 
    name: 'RISK_SHIELD_V1', 
    description: '-15% Risk Drift Speed', 
    cost: 0.005, 
    effectType: 'RISK', 
    value: 0.85, // Multiplier for drift
    icon: '🛡️'
  },
  { 
    id: 'score_mult', 
    name: 'SCORE_OVERCLOCK', 
    description: '+0.5x Start Multiplier', 
    cost: 0.01, 
    effectType: 'MULTIPLIER', 
    value: 0.5, // Flat add
    icon: '⚡'
  }
];

export interface Rank {
  level: number;
  title: string;
  minSR: number;
  perks: string[];
  color: string;
}

export const RANKS: Rank[] = [
  { level: 1, title: 'RECRUIT', minSR: 0, perks: ['Basic Solo Access'], color: '#94a3b8' },
  { level: 5, title: 'RAIDER', minSR: 1000, perks: ['Unlocks TEAM_MODE', '5% Bonus SR'], color: '#FF6B35' },
  { level: 10, title: 'OPERATIVE', minSR: 3000, perks: ['Reduced RISK Drift', 'Store Discount 5%'], color: '#00FBFF' },
  { level: 15, title: 'COMMANDER', minSR: 7000, perks: ['Unlocks TOURNAMENT_MODE', '10% Yield Boost'], color: '#9945FF' },
  { level: 20, title: 'GHOST', minSR: 15000, perks: ['Exclusive GHOST Gear Access', '20% SR Bonus'], color: '#f59e0b' },
  { level: 50, title: 'PROTOCOL_GOD', minSR: 50000, perks: ['Admin Terminal Access', 'Zero Fee Thursdays'], color: '#9945FF' }
];

export interface Equipment {
  id: string;
  name: string;
  type: 'GEAR' | 'AVATAR';
  description: string;
  price: number;
  rarity?: 'STANDARD' | 'LIMITED' | 'EXCLUSIVE';
  effect?: 'MULT_BOOST' | 'RISK_REDUCTION' | 'TIME_BOOST';
  benefitValue?: number;
  image?: string;
  minLevel?: number;
}

export const GEAR_ITEMS: Equipment[] = [
  // --- STANDARD GEAR (10 items) ---
  { id: 'gear_std_1',  name: 'Scrap Dagger',      type: 'GEAR', rarity: 'STANDARD', description: 'Crude but effective for rapid extractions.',              price: 0.05, effect: 'MULT_BOOST',      benefitValue: 0.05, image: '🗡️' },
  { id: 'gear_std_2',  name: 'Logic Wrench',       type: 'GEAR', rarity: 'STANDARD', description: 'Adjusts protocol flows. -2% Risk.',                     price: 0.08, effect: 'RISK_REDUCTION',   benefitValue: 2,    image: '🔧' },
  { id: 'gear_std_3',  name: 'Data Pick',          type: 'GEAR', rarity: 'STANDARD', description: 'Precision tool for minor nodes. +2s Time.',              price: 0.10, effect: 'TIME_BOOST',      benefitValue: 2,    image: '⛏️' },
  { id: 'gear_std_4',  name: 'Work Hammer',        type: 'GEAR', rarity: 'STANDARD', description: 'Heavy-duty smashing tool for basic firewalls.',           price: 0.12, effect: 'MULT_BOOST',      benefitValue: 0.10, image: '🔨' },
  { id: 'gear_std_5',  name: 'Scrap Buckler',      type: 'GEAR', rarity: 'STANDARD', description: 'Improvisational shield for low-level raids. -4% Risk.',  price: 0.15, effect: 'RISK_REDUCTION',   benefitValue: 4,    image: '🛡️' },
  { id: 'gear_std_6',  name: 'Rusty Axe',          type: 'GEAR', rarity: 'STANDARD', description: 'Reliable for harvesting bulk data fragments.',           price: 0.18, effect: 'MULT_BOOST',      benefitValue: 0.12, image: '🪓' },
  { id: 'gear_std_7',  name: 'Short Sword',        type: 'GEAR', rarity: 'STANDARD', description: 'The basic choice for any aspiring raider.',              price: 0.22, effect: 'MULT_BOOST',      benefitValue: 0.15, image: '⚔️' },
  { id: 'gear_std_8',  name: 'Signal Blocker',     type: 'GEAR', rarity: 'STANDARD', description: 'Scrambles perimeter sensors. -3% Risk.',                 price: 0.20, effect: 'RISK_REDUCTION',   benefitValue: 3,    image: '📡' },
  { id: 'gear_std_9',  name: 'Clock Tap',          type: 'GEAR', rarity: 'STANDARD', description: 'Injects a small time delay into the protocol. +3s.',     price: 0.25, effect: 'TIME_BOOST',      benefitValue: 3,    image: '⏱️' },
  { id: 'gear_std_10', name: 'Breach Kit',         type: 'GEAR', rarity: 'STANDARD', description: 'Portable entry tool for basic encryption layers.',       price: 0.30, effect: 'MULT_BOOST',      benefitValue: 0.18, image: '🔓' },

  // --- LIMITED GEAR (10 items) ---
  { id: 'gear_lim_1',  name: 'Pulse Blade',        type: 'GEAR', rarity: 'LIMITED', description: 'Vibrating edge cuts through encryption faster.',          price: 0.45, effect: 'MULT_BOOST',      benefitValue: 0.30, image: '🔪',  minLevel: 5 },
  { id: 'gear_lim_2',  name: 'Nano Bow',           type: 'GEAR', rarity: 'LIMITED', description: 'Ranged extraction tether. +8s Raid Time.',               price: 0.60, effect: 'TIME_BOOST',      benefitValue: 8,    image: '🏹',  minLevel: 5 },
  { id: 'gear_lim_3',  name: 'Plasma Guard',       type: 'GEAR', rarity: 'LIMITED', description: 'Energy shield for mid-layer stability. -10% Risk.',       price: 0.75, effect: 'RISK_REDUCTION',   benefitValue: 10,   image: '🔰',  minLevel: 10 },
  { id: 'gear_lim_4',  name: 'Circuit Smasher',    type: 'GEAR', rarity: 'LIMITED', description: 'Massive impact destabilizes security nodes.',             price: 0.90, effect: 'MULT_BOOST',      benefitValue: 0.45, image: '💥',  minLevel: 10 },
  { id: 'gear_lim_5',  name: 'Void Katana',        type: 'GEAR', rarity: 'LIMITED', description: 'Shadow-tech blade for silent extractions.',               price: 1.20, effect: 'MULT_BOOST',      benefitValue: 0.50, image: '🌑',  minLevel: 12 },
  { id: 'gear_lim_6',  name: 'Flux Scythe',        type: 'GEAR', rarity: 'LIMITED', description: 'Sweeps through large data pools effortlessly.',           price: 1.50, effect: 'MULT_BOOST',      benefitValue: 0.65, image: '☄️',  minLevel: 12 },
  { id: 'gear_lim_7',  name: 'Plasma Trident',     type: 'GEAR', rarity: 'LIMITED', description: 'Triple extraction points for high efficiency.',           price: 1.80, effect: 'MULT_BOOST',      benefitValue: 0.70, image: '🔱',  minLevel: 15 },
  { id: 'gear_lim_8',  name: 'Heavy Barrier',      type: 'GEAR', rarity: 'LIMITED', description: 'Mobile firewall defense. -15% Risk.',                    price: 2.20, effect: 'RISK_REDUCTION',   benefitValue: 15,   image: '🧱',  minLevel: 15 },
  { id: 'gear_lim_9',  name: 'Ghost Protocol',     type: 'GEAR', rarity: 'LIMITED', description: 'Full stealth mode — near-invisible to scanners. -12% Risk.', price: 1.60, effect: 'RISK_REDUCTION', benefitValue: 12, image: '👻', minLevel: 12 },
  { id: 'gear_lim_10', name: 'Node Scanner',       type: 'GEAR', rarity: 'LIMITED', description: 'Maps hidden extraction routes. +10s Raid Time.',          price: 2.00, effect: 'TIME_BOOST',      benefitValue: 10,   image: '🔭',  minLevel: 15 },

  // --- EXCLUSIVE GEAR (7 items) ---
  { id: 'gear_exc_1',  name: 'Omega Railgun',      type: 'GEAR', rarity: 'EXCLUSIVE', description: 'Shatters the most advanced protocol walls.',            price: 5.0,  effect: 'MULT_BOOST',      benefitValue: 1.2,  image: '🔫',  minLevel: 20 },
  { id: 'gear_exc_2',  name: 'Quantum Saber',      type: 'GEAR', rarity: 'EXCLUSIVE', description: 'A blade made of pure Solana energy. -25% Risk.',        price: 8.5,  effect: 'RISK_REDUCTION',   benefitValue: 25,   image: '⚡',  minLevel: 25 },
  { id: 'gear_exc_3',  name: 'Chainsaw_0x',        type: 'GEAR', rarity: 'EXCLUSIVE', description: 'Brute force extraction. Extremely fast yield.',          price: 12.0, effect: 'MULT_BOOST',      benefitValue: 1.8,  image: '⚙️',  minLevel: 30 },
  { id: 'gear_exc_4',  name: 'Singularity Core',   type: 'GEAR', rarity: 'EXCLUSIVE', description: 'Bends the raid clock. +30s Raid Time.',                 price: 15.0, effect: 'TIME_BOOST',      benefitValue: 30,   image: '🌀',  minLevel: 40 },
  { id: 'gear_exc_5',  name: 'Protocol God Axe',   type: 'GEAR', rarity: 'EXCLUSIVE', description: 'Legendary tool of the chain creators.',                 price: 25.0, effect: 'MULT_BOOST',      benefitValue: 3.0,  image: '🪬',  minLevel: 50 },
  { id: 'gear_exc_6',  name: 'Neural Chip',        type: 'GEAR', rarity: 'EXCLUSIVE', description: 'Implant-grade upgrade. Amplifies every action by 2.2x.', price: 18.0, effect: 'MULT_BOOST',     benefitValue: 2.2,  image: '🧠',  minLevel: 35 },
  { id: 'gear_exc_7',  name: 'Blackout Charge',    type: 'GEAR', rarity: 'EXCLUSIVE', description: 'Drops all alarms for the duration. -30% Risk.',          price: 20.0, effect: 'RISK_REDUCTION',   benefitValue: 30,   image: '💣',  minLevel: 40 },
];

export const AVATAR_ITEMS: Equipment[] = [
  // --- STANDARD AVATARS (7 items) ---
  { id: 'av_std_1', name: 'Script Kiddie', type: 'AVATAR', rarity: 'STANDARD', price: 0.05, image: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=kiddie&backgroundColor=475569', description: 'Just here for the ride.' },
  { id: 'av_std_2', name: 'Data Scout', type: 'AVATAR', rarity: 'STANDARD', price: 0.1, image: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=scout&backgroundColor=334155', description: 'Looking for scraps.' },
  { id: 'av_std_3', name: 'Node Runner', type: 'AVATAR', rarity: 'STANDARD', price: 0.2, image: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=terminal&backgroundColor=1e293b', description: 'Steady hand, small gains.' },
  { id: 'av_std_4', name: 'Binary Nomad', type: 'AVATAR', rarity: 'STANDARD', price: 0.35, image: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=nomad&backgroundColor=64748b', description: 'Wandering the layers.' },
  { id: 'av_std_5', name: 'Neon Glitch', type: 'AVATAR', rarity: 'STANDARD', price: 0.5, image: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=glitch&backgroundColor=a855f7', description: 'Part of the noise.' },
  { id: 'av_std_6', name: 'The Shark', type: 'AVATAR', rarity: 'STANDARD', price: 0.75, image: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=shark&backgroundColor=06b6d4', description: 'Small whale in training.' },
  { id: 'av_std_7', name: 'Mage_0x', type: 'AVATAR', rarity: 'STANDARD', price: 0.9, image: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=wizard&backgroundColor=3b82f6', description: 'Seer of blocks.' },

  // --- LIMITED AVATARS (8 items) ---
  { id: 'av_lim_1', name: 'Void Walker', type: 'AVATAR', rarity: 'LIMITED', price: 1.5, image: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=void&backgroundColor=111111', description: 'Invisible to basic scanners.', minLevel: 5 },
  { id: 'av_lim_2', name: 'Shadow Agent', type: 'AVATAR', rarity: 'LIMITED', price: 2.0, image: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=agent&backgroundColor=1e293b', description: 'Corporate infiltrator.', minLevel: 5 },
  { id: 'av_lim_3', name: 'Circuit Ronin', type: 'AVATAR', rarity: 'LIMITED', price: 2.5, image: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=ronin&backgroundColor=ff00c1', description: 'Masterless blade of the net.', minLevel: 10 },
  { id: 'av_lim_4', name: 'Pulse Striker', type: 'AVATAR', rarity: 'LIMITED', price: 3.0, image: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=striker&backgroundColor=ef4444', description: 'Aggressive risk taker.', minLevel: 10 },
  { id: 'av_lim_5', name: 'Cyber Whale', type: 'AVATAR', rarity: 'LIMITED', price: 4.5, image: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=whale&backgroundColor=22c55e', description: 'Moving huge liquidity.', minLevel: 15 },
  { id: 'av_lim_6', name: 'Ghost Node', type: 'AVATAR', rarity: 'LIMITED', price: 6.0, image: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=ghost&backgroundColor=cbd5e1', description: 'Resistant to busts.', minLevel: 15 },
  { id: 'av_lim_7', name: 'Solar Flare', type: 'AVATAR', rarity: 'LIMITED', price: 7.5, image: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=flare&backgroundColor=f97316', description: 'Radiating pure alpha.', minLevel: 20 },
  { id: 'av_lim_8', name: 'Alpha Hunter', type: 'AVATAR', rarity: 'LIMITED', price: 10.0, image: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=hunter&backgroundColor=020617', description: 'Only seeks the biggest raids.', minLevel: 25 },

  // --- EXCLUSIVE AVATARS (5 items) ---
  { id: 'av_exc_1', name: 'Protocol King', type: 'AVATAR', rarity: 'EXCLUSIVE', price: 20.0, image: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=king&backgroundColor=f59e0b', description: 'He who rules the nodes.', minLevel: 30 },
  { id: 'av_exc_2', name: 'Sol Lord', type: 'AVATAR', rarity: 'EXCLUSIVE', price: 35.0, image: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=lord&backgroundColor=14f195', description: 'The absolute unit of the chain.', minLevel: 35 },
  { id: 'av_exc_3', name: 'Quantum God', type: 'AVATAR', rarity: 'EXCLUSIVE', price: 50.0, image: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=god&backgroundColor=9945ff', description: 'Transcending the blocks.', minLevel: 40 },
  { id: 'av_exc_4', name: 'Genesis Block', type: 'AVATAR', rarity: 'EXCLUSIVE', price: 75.0, image: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=genesis&backgroundColor=00fbff', description: 'The original protocol source.', minLevel: 50 },
  { id: 'av_exc_5', name: 'Satoshi Phantom', type: 'AVATAR', rarity: 'EXCLUSIVE', price: 100.0, image: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=phantom&backgroundColor=ffffff', description: 'The ghost of the first chain.', minLevel: 60 }
];

export interface Player {
  id: string;
  name: string;
  status: 'ACTIVE' | 'EXITED' | 'BUSTED';
  solEarned: number;
}

export interface TournamentEntry {
  rank: number;
  name: string;
  score: number;
  prize: string;
}

export interface GameState {
  currentScreen: Screen;
  walletBalance: number;
  usdcBalance: number;
  skrBalance: number;
  raidBalance: number;
  unclaimedBalance: number;
  srPoints: number;
  isConnected: boolean;
  username: string; // User's custom callsign
  ownedItemIds: string[];
  equippedAvatarId?: string;
  equippedGearIds: string[];
  activeRaidFee: number;
  activeRaidDifficulty: Difficulty;
  activeRaidBoosts: string[];
  activeRaidIsRound: boolean;       // true when raid was entered as round competition
  activeRaidTier: RaidTier;         // which competition tier this raid was entered at
  activeRoom?: Room;
  activeSeedId?: string;          // provably-fair: seed DB row id
  activeServerSeedHash?: string;  // provably-fair: shown to player pre-raid
  activeEntryTxSig?: string;      // on-chain tx sig for entry fee — verified server-side
  lastResult?: {
    success: boolean;
    solAmount: number;
    points: number;
    srEarned: number;
    raidId: string;
    serverSeedHash: string;
    userWallet: string;
    txSignature: string;
    peakMult?: number;
    nearWinCount?: number;
    dailyStreak?: number;
    bankedYield?: number;
    lootDrops?: LootDrop[];
  };
  isRaidLoading?: boolean;          // true while 2.5s pre-raid loading screen shows
  pvpWinnerResult?: {               // set when all PvP players have finished
    isWinner: boolean;
    winnerName: string;
    winnerWallet: string;
    potSol: number;
    currency: string;
  } | null;
  pvpWaiting?: boolean;             // true while waiting for other PvP players
  // Remembered for the "Redeploy" button on ResultScreen
  lastRaidConfig?: {
    mode: Mode;
    difficulty: Difficulty;
    boosts: string[];
    currency: Currency;
    isRoundEntry?: boolean;
    tier?: RaidTier;
  };
  // RaidCore Pass ticket system
  raidTickets: number;
  lastFreeTicketDate: string | null;  // ISO date string "YYYY-MM-DD"
  ticketBoostActive: boolean;          // true when current raid was entered with a ticket
  activeRaidInsurance: boolean;        // true when player paid +0.01 SOL insurance for this raid
  // Meta-game progression
  raidStreak: number;                  // consecutive successful raids
  bustTimestamps: number[];            // epoch ms of recent busts (rage-quit protection)
  lastFreeRaidDate: string | null;     // ISO date — daily free raid at EASY
  activeStreakBonus: number;           // +0.15 per 3-win streak, applied as starting mult bonus
  lastRaidEvents?: RaidEvent[];        // populated after each raid for post-raid breakdown
  storeInitialTab?: 'GEAR' | 'AVATAR' | 'PASS' | 'FORGE'; // deep-link into store tab
  // Drill cap: 3 free drills per 6-hour rolling window
  drillCount: number;                  // drills used in current 6h window
  drillWindowStart: number;            // epoch ms when current 6h window started
  // Meta-loop hooks
  dailyStreak: number;                 // consecutive calendar days played
  lastPlayedDate: string | null;       // ISO date "YYYY-MM-DD" of last play
  personalBestPoints: number;          // highest points scored in a single raid
}

// ── Bounty Board ─────────────────────────────────────────────────────────────
export interface Bounty {
  id: string;
  poster_wallet: string;
  poster_username: string;
  difficulty: Difficulty;
  target_points: number;
  reward_type: 'SOL' | 'SR';
  reward_amount: number;
  status: 'OPEN' | 'CLAIMED' | 'CANCELLED';
  claimed_by_wallet?: string;
  claimed_by_username?: string;
  claimed_raid_id?: string;
  claimed_at?: string;
  expires_at: string;
  created_at: string;
}

// ── Extended Raid Experience Types ────────────────────────────────────────────

export type RaidPhase = 'BREACH' | 'DEEP_RUN' | 'CORE';

export const RAID_PHASE_CONFIG: Record<RaidPhase, {
  label: string; driftMod: number; riskResetOnEntry: number; color: string;
}> = {
  BREACH:   { label: 'BREACH',   driftMod: 1.00, riskResetOnEntry:  0, color: '#9945FF' },
  DEEP_RUN: { label: 'DEEP RUN', driftMod: 1.08, riskResetOnEntry: 12, color: '#FFB800' },
  CORE:     { label: 'CORE',     driftMod: 1.18, riskResetOnEntry: 12, color: '#9945FF' },
};

export type EventCardType = 'DATA_CACHE' | 'FIREWALL_SURGE' | 'GHOST_SIGNAL' | 'CORP_SWEEP';

export interface EventCard {
  id: number; type: EventCardType; startTime: number; duration: number; resolved: boolean;
}

export const EVENT_CARD_META: Record<EventCardType, {
  label: string; sub: string; actionLabel?: string; duration: number; color: string;
}> = {
  DATA_CACHE:     { label: 'DATA CACHE',     sub: 'Auto-collecting node data...',            duration: 3000, color: '#FFB800' },
  FIREWALL_SURGE: { label: 'FIREWALL SURGE', sub: 'Absorb the surge to reduce risk',         actionLabel: 'ABSORB',  duration: 3000, color: '#9945FF' },
  GHOST_SIGNAL:   { label: 'GHOST SIGNAL',   sub: 'Lure detected — ignore or tap EXTRACT',  actionLabel: 'EXTRACT', duration: 4000, color: '#ffffff' },
  CORP_SWEEP:     { label: 'CORP SWEEP',     sub: 'Corp is sweeping — going dark for 4s',    duration: 4000, color: '#ffffff' },
};

export interface ScoutNode {
  id: 'NODE_A' | 'NODE_B' | 'NODE_C';
  label: string; threat: 'LOW' | 'MEDIUM' | 'HIGH';
  riskMod: number; lootBias: 'SKR' | 'SR' | 'SOL';
  checkpointBankBonus: number; description: string; color: string;
}

export const SCOUT_NODES: ScoutNode[] = [
  { id: 'NODE_A', label: 'LOW THREAT',   threat: 'LOW',    riskMod: -5, lootBias: 'SKR', checkpointBankBonus: 1.0, description: 'Lightly guarded sector. Stable entry, SKR-dense data nodes.', color: '#4ade80' },
  { id: 'NODE_B', label: 'STANDARD',     threat: 'MEDIUM', riskMod:  0, lootBias: 'SR',  checkpointBankBonus: 1.0, description: 'Balanced risk. Reputation-dense. No entry modifier.',         color: '#FFB800' },
  { id: 'NODE_C', label: 'HIGH THREAT',  threat: 'HIGH',   riskMod:  8, lootBias: 'SOL', checkpointBankBonus: 1.3, description: 'Heavy corp presence. +8 starting risk. Checkpoint banks 30% more.', color: '#9945FF' },
];

export interface LootDrop {
  type: 'SKR_SHARD' | 'SR_BURST'; amount: number;
}

// ── Daily Bounties ────────────────────────────────────────────────────────────
export type BountyCondition =
  | 'extracted'           // any successful extract on a real raid
  | 'points_gte'          // score >= conditionValue
  | 'difficulty_eq'       // extracted on difficulty === conditionLabel
  | 'elapsed_lte'         // extracted in <= conditionValue seconds
  | 'peak_mult_gte';      // peak multiplier >= conditionValue

export interface DailyBountyDef {
  id: number;
  label: string;          // short name shown in UI
  task: string;           // "Extract at 2.0× or higher"
  reward: number;         // SR awarded on completion
  condition: BountyCondition;
  conditionValue?: number;   // numeric threshold
  conditionLabel?: string;   // difficulty string e.g. 'HARD'
}

export const DAILY_BOUNTIES: DailyBountyDef[] = [
  { id: 0, label: 'Clean Exit',    task: 'Extract on any real raid',              reward: 300,  condition: 'extracted' },
  { id: 1, label: 'High Roller',   task: 'Extract at 2.0× multiplier or higher',  reward: 500,  condition: 'peak_mult_gte', conditionValue: 2.0 },
  { id: 2, label: 'Elite Score',   task: 'Score 3,000+ points on a real raid',    reward: 600,  condition: 'points_gte',    conditionValue: 3000 },
  { id: 3, label: 'Speed Run',     task: 'Extract in under 35 seconds',           reward: 400,  condition: 'elapsed_lte',   conditionValue: 35 },
  { id: 4, label: 'Hard Target',   task: 'Extract on Hard difficulty',            reward: 700,  condition: 'difficulty_eq', conditionLabel: 'HARD' },
  { id: 5, label: 'Peak Hunter',   task: 'Extract at 3.0× multiplier or higher',  reward: 800,  condition: 'peak_mult_gte', conditionValue: 3.0 },
  { id: 6, label: 'Degen Run',     task: 'Extract on Degen difficulty',           reward: 1200, condition: 'difficulty_eq', conditionLabel: 'DEGEN' },
  { id: 7, label: 'Score Padder',  task: 'Score 1,500+ points on a real raid',    reward: 350,  condition: 'points_gte',    conditionValue: 1500 },
  { id: 8, label: 'Quick Hands',   task: 'Extract in under 50 seconds',           reward: 300,  condition: 'elapsed_lte',   conditionValue: 50 },
  { id: 9, label: 'Multiplier+',   task: 'Extract at 1.5× multiplier or higher',  reward: 250,  condition: 'peak_mult_gte', conditionValue: 1.5 },
];
