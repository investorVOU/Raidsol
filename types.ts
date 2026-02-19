
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
  TREASURY = 'TREASURY' // New: Treasury Page
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
  [Difficulty.DEGEN]: { riskMod: 30, driftMod: 1.8, multMod: 2.5, label: 'DEGEN_SUICIDE', color: 'text-red-600' }
};

export enum Currency {
  SOL = 'SOL',
  USDC = 'USDC',
  SKR = 'SKR'
}

export const CURRENCY_RATES: Record<Currency, number> = {
  [Currency.SOL]: 1,
  [Currency.USDC]: 150, // 1 SOL = 150 USDC (approx for game)
  [Currency.SKR]: 1000 // 1 SOL = 1000 SKR
};

export const ENTRY_FEES: Record<Mode, number> = {
  [Mode.SOLO]: 0.026,
  [Mode.TEAM]: 0.1,
  [Mode.TOURNAMENT]: 0.2,
  [Mode.DRILL]: 0.00,
  [Mode.PVP]: 0.00 // Dynamic in PvP
};

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
  { level: 5, title: 'RAIDER', minSR: 1000, perks: ['Unlocks TEAM_MODE', '5% Bonus SR'], color: '#14F195' },
  { level: 10, title: 'OPERATIVE', minSR: 3000, perks: ['Reduced RISK Drift', 'Store Discount 5%'], color: '#00FBFF' },
  { level: 15, title: 'COMMANDER', minSR: 7000, perks: ['Unlocks TOURNAMENT_MODE', '10% Yield Boost'], color: '#9945FF' },
  { level: 20, title: 'GHOST', minSR: 15000, perks: ['Exclusive GHOST Gear Access', '20% SR Bonus'], color: '#f59e0b' },
  { level: 50, title: 'PROTOCOL_GOD', minSR: 50000, perks: ['Admin Terminal Access', 'Zero Fee Thursdays'], color: '#ef4444' }
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
  // --- STANDARD GEAR (7 items) ---
  { id: 'gear_std_1', name: 'Scrap Dagger', type: 'GEAR', rarity: 'STANDARD', description: 'Crude but effective for rapid extractions.', price: 0.05, effect: 'MULT_BOOST', benefitValue: 0.05, image: 'https://img.icons8.com/arcade/64/knife.png' },
  { id: 'gear_std_2', name: 'Logic Wrench', type: 'GEAR', rarity: 'STANDARD', description: 'Adjusts protocol flows. -2% Risk.', price: 0.08, effect: 'RISK_REDUCTION', benefitValue: 2, image: 'https://img.icons8.com/arcade/64/wrench.png' },
  { id: 'gear_std_3', name: 'Data Pick', type: 'GEAR', rarity: 'STANDARD', description: 'Precision tool for minor nodes. +2s Time.', price: 0.10, effect: 'TIME_BOOST', benefitValue: 2, image: 'https://img.icons8.com/arcade/64/pickaxe.png' },
  { id: 'gear_std_4', name: 'Work Hammer', type: 'GEAR', rarity: 'STANDARD', description: 'Heavy-duty smashing tool for basic firewalls.', price: 0.12, effect: 'MULT_BOOST', benefitValue: 0.1, image: 'https://img.icons8.com/arcade/64/hammer.png' },
  { id: 'gear_std_5', name: 'Scrap Buckler', type: 'GEAR', rarity: 'STANDARD', description: 'Improvisational shield for low-level raids.', price: 0.15, effect: 'RISK_REDUCTION', benefitValue: 4, image: 'https://img.icons8.com/arcade/64/shield.png' },
  { id: 'gear_std_6', name: 'Rusty Axe', type: 'GEAR', rarity: 'STANDARD', description: 'Reliable for harvesting bulk data fragments.', price: 0.18, effect: 'MULT_BOOST', benefitValue: 0.12, image: 'https://img.icons8.com/arcade/64/axe.png' },
  { id: 'gear_std_7', name: 'Short Sword', type: 'GEAR', rarity: 'STANDARD', description: 'The basic choice for any aspiring raider.', price: 0.22, effect: 'MULT_BOOST', benefitValue: 0.15, image: 'https://img.icons8.com/arcade/64/sword.png' },

  // --- LIMITED GEAR (8 items) ---
  { id: 'gear_lim_1', name: 'Pulse Blade', type: 'GEAR', rarity: 'LIMITED', description: 'Vibrating edge cuts through encryption faster.', price: 0.45, effect: 'MULT_BOOST', benefitValue: 0.3, image: 'https://img.icons8.com/arcade/64/dagger.png', minLevel: 5 },
  { id: 'gear_lim_2', name: 'Nano Bow', type: 'GEAR', rarity: 'LIMITED', description: 'Ranged extraction tether. +8s Raid Time.', price: 0.60, effect: 'TIME_BOOST', benefitValue: 8, image: 'https://img.icons8.com/arcade/64/bow.png', minLevel: 5 },
  { id: 'gear_lim_3', name: 'Plasma Guard', type: 'GEAR', rarity: 'LIMITED', description: 'Energy shield for mid-layer stability. -10% Risk.', price: 0.75, effect: 'RISK_REDUCTION', benefitValue: 10, image: 'https://img.icons8.com/arcade/64/antivirus-shield.png', minLevel: 10 },
  { id: 'gear_lim_4', name: 'Circuit Smasher', type: 'GEAR', rarity: 'LIMITED', description: 'Massive impact destabilizes security nodes.', price: 0.90, effect: 'MULT_BOOST', benefitValue: 0.45, image: 'https://img.icons8.com/arcade/64/croissant-hammer.png', minLevel: 10 },
  { id: 'gear_lim_5', name: 'Void Katana', type: 'GEAR', rarity: 'LIMITED', description: 'Shadow-tech blade for silent extractions.', price: 1.2, effect: 'MULT_BOOST', benefitValue: 0.5, image: 'https://img.icons8.com/arcade/64/katana.png', minLevel: 12 },
  { id: 'gear_lim_6', name: 'Flux Scythe', type: 'GEAR', rarity: 'LIMITED', description: 'Sweeps through large data pools effortlessly.', price: 1.5, effect: 'MULT_BOOST', benefitValue: 0.65, image: 'https://img.icons8.com/arcade/64/sickle.png', minLevel: 12 },
  { id: 'gear_lim_7', name: 'Plasma Trident', type: 'GEAR', rarity: 'LIMITED', description: 'Triple extraction points for high efficiency.', price: 1.8, effect: 'MULT_BOOST', benefitValue: 0.7, image: 'https://img.icons8.com/arcade/64/trident.png', minLevel: 15 },
  { id: 'gear_lim_8', name: 'Heavy Barrier', type: 'GEAR', rarity: 'LIMITED', description: 'Mobile firewall defense. -15% Risk.', price: 2.2, effect: 'RISK_REDUCTION', benefitValue: 15, image: 'https://img.icons8.com/arcade/64/wall.png', minLevel: 15 },

  // --- EXCLUSIVE GEAR (5 items) ---
  { id: 'gear_exc_1', name: 'Omega Railgun', type: 'GEAR', rarity: 'EXCLUSIVE', description: 'Shatters the most advanced protocol walls.', price: 5.0, effect: 'MULT_BOOST', benefitValue: 1.2, image: 'https://img.icons8.com/arcade/64/ray-gun.png', minLevel: 20 },
  { id: 'gear_exc_2', name: 'Quantum Saber', type: 'GEAR', rarity: 'EXCLUSIVE', description: 'A blade made of pure Solana energy.', price: 8.5, effect: 'RISK_REDUCTION', benefitValue: 25, image: 'https://img.icons8.com/arcade/64/lightsaber.png', minLevel: 25 },
  { id: 'gear_exc_3', name: 'Chainsaw_0x', type: 'GEAR', rarity: 'EXCLUSIVE', description: 'Brute force extraction. Extremely fast yield.', price: 12.0, effect: 'MULT_BOOST', benefitValue: 1.8, image: 'https://img.icons8.com/arcade/64/chainsaw.png', minLevel: 30 },
  { id: 'gear_exc_4', name: 'Singularity Core', type: 'GEAR', rarity: 'EXCLUSIVE', description: 'Bends the raid clock. +30s Raid Time.', price: 15.0, effect: 'TIME_BOOST', benefitValue: 30, image: 'https://img.icons8.com/arcade/64/atomic.png', minLevel: 40 },
  { id: 'gear_exc_5', name: 'Protocol God Axe', type: 'GEAR', rarity: 'EXCLUSIVE', description: 'Legendary tool of the chain creators.', price: 25.0, effect: 'MULT_BOOST', benefitValue: 3.0, image: 'https://img.icons8.com/arcade/64/battle-axe.png', minLevel: 50 }
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
  activeRoom?: Room; // New: For PvP
  lastResult?: {
    success: boolean;
    solAmount: number;
    points: number;
    srEarned: number;
    raidId: string;
    serverSeedHash: string;
    userWallet: string;
    txSignature: string;
  };
}
