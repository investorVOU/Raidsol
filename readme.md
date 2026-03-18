# Solana Raid — Mobile-First On-Chain Game

![Solana](https://img.shields.io/badge/Solana-Mainnet-9945FF?style=for-the-badge&logo=solana&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Edge-3ECF8E?style=for-the-badge&logo=supabase&logoColor=black)

> High-stakes, skill-based raiding game on Solana. Connect your wallet, enter a raid, extract your yield before risk spikes — or lose it all. Real SOL in, real SOL out.

**Live:** [solraid.app](https://solraid.app) · **Token:** [$RAID on Bags.fm](https://bags.fm/J8sMGxWB5kT8SqgmeTa3TfW6mpmucYK8xpMkmPCbBAGS) · **X:** [@solraid_app](https://x.com/solraid_app)

---

## What is Solana Raid?

Solana Raid is a **mobile-first browser game** where players connect a Solana wallet and compete in real-time raids for on-chain SOL rewards. Every raid is a tension-filled extraction — a rising multiplier, a creeping risk meter, and a cashout window that rewards conviction and punishes greed.

No fake tokens. No simulated rewards. Real SOL in, real SOL out.

---

## Gameplay Loop

```
Connect wallet
  → Choose difficulty (EASY / MEDIUM / HARD / DEGEN)
  → Pay entry fee (SOL / USDC / $RAID)
  → 90-second raid begins
  → Multiplier rises as risk drifts upward
  → Cash out before risk hits 100% → earn SOL
  → Bust at 100% → lose your stake
```

- **20-second cashout lock** — no instant exits, builds real tension
- **Gear loadout** — TIME_BOOST, MULT_BOOST, RISK_REDUCTION items change your odds
- **Raid passes** — buy ticket bundles with $RAID for 50% entry fee discount + 1.1× reward boost
- **Daily streak** — play consecutive days for up to +40% SR point bonus
- **Provably fair** — SHA-256 server seed committed before raid, revealed on exit

### Max Winnings per Raid

| Difficulty | Max Win | Entry |
|---|---|---|
| EASY | 0.03 SOL | Low |
| MEDIUM | 0.07 SOL | Mid |
| HARD | 0.20 SOL | High |
| DEGEN | 0.60 SOL | Degen |

---

## Multiplayer PvP

- Create or join rooms with SOL / USDC / $RAID stakes
- Head-to-head raids — highest score takes the pot
- Real-time room state via Supabase Realtime channels
- Share invite link: `solraid.app?join=RAID-XXXX`
- PvP tournament rounds tracked on leaderboard

---

## Features

| Feature | Detail |
|---|---|
| **Wallets** | Phantom, Solflare, Backpack, Coinbase, Trust, Nightly, Ledger, Mobile (Seeker) |
| **Currencies** | SOL, USDC, $RAID for entry fees and store purchases |
| **In-App Swap** | Buy $RAID with SOL or USDC via Jupiter Ultra API, no redirect |
| **3D Arena** | Two robot characters face off using React Three Fiber |
| **Leaderboard** | Top players by SR points, live ranks, .skr domain badges |
| **Achievements** | 20+ milestone badges, granted via edge function after raids |
| **Daily Briefing** | Caesar-cipher puzzle — 1000 SR first solve, resets every day |
| **Wallet Roast** | On-chain analysis of your wallet history, shareable card |
| **Referral System** | Unique referral codes, SR points for successful referrals |
| **Anti-cheat** | Server validates elapsed time, max possible points, and sol_amount |

---

## Tech Stack

**Frontend**
- React 18 + Vite + TypeScript
- Tailwind CSS — mobile-first, `bottom-16` nav clearance on iOS
- React Three Fiber + Three.js — 3D raid arena with robot animations
- `@solana/wallet-adapter-react` — 9+ wallet adapters
- `i18next` — multi-language support

**Backend**
- Supabase — PostgreSQL, Realtime subscriptions, Edge Functions (Deno)
- Solana mainnet-beta RPC — on-chain SOL/SPL transfers
- Jupiter Ultra API — in-app token swaps (`lite-api.jup.ag/ultra/v1`)

**On-chain**
- Native SOL transfers for entry fees and payouts
- SPL token transfers for USDC and $RAID
- Treasury keypair signs payouts server-side with double-spend protection

---

## Screens

| Screen | Description |
|---|---|
| `LOBBY` | Entry hub — gear loadout, difficulty picker, daily cards |
| `RAID` | Live game — 3D arena, multiplier, risk meter, cashout button |
| `RESULT` | Payout summary — SR earned, streak, achievements, redeploy |
| `STORE` | Gear + raid pass shop (SOL / USDC / $RAID) |
| `PROFILE` | Stats, badges, referral code, raid history |
| `TOURNAMENT` | Leaderboard, .skr domain rankings, PvP rounds |
| `TEAM` | Squad view — 4-player slots, matchmaking |
| `MULTIPLAYER_SETUP` | Create or join PvP room with stake preview |
| `MULTIPLAYER_GAME` | Live PvP raid with opponent score feed |
| `BRIEFING` | Daily cipher puzzle with SR reward |
| `ROAST` | Wallet analysis + shareable card |

---

## Edge Functions

| Function | Purpose |
|---|---|
| `raid-seed` | SHA-256 server seed commitment before raid |
| `submit-raid-result` | Records result, updates profile + treasury, reveals seed |
| `process-payout` | Signs and sends on-chain SOL from treasury (rate-limited) |
| `verify-payment` | Confirms on-chain tx for store purchases, retries 8× |
| `check-briefing` | Validates daily cipher answer server-side |
| `jup-proxy` | Proxies Jupiter Ultra API (quote + execute) to bypass CORS |

---

## Database Schema

```
profiles          — wallet stats, gear, tickets, streaks, referrals
raid_history      — every raid result with provably-fair seed pair
raid_seeds        — server seed commitments
treasury_stats    — single-row treasury balance tracker
activity_feed     — real-time global activity stream
rooms             — multiplayer room state + stake currency
room_players      — per-room player records
withdrawals       — payout audit trail (double-spend guard)
store_purchases   — purchase audit trail (tx replay protection)
daily_briefings   — cipher puzzle definitions (30-puzzle rotation)
briefing_claims   — who solved today's puzzle
achievements      — milestone badge grants
```

---

## Local Setup

```bash
# Clone
git clone https://github.com/investorVOU/Raidsol.git
cd Raidsol

# Install
npm install

# Create .env
cp .env.example .env
# Fill in your Supabase URL, anon key, RPC URL, and mint addresses

# Run
npm run dev
```

**.env variables**

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
VITE_USDC_MINT=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
VITE_SKR_MINT=SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3
VITE_RAID_MINT=J8sMGxWB5kT8SqgmeTa3TfW6mpmucYK8xpMkmPCbBAGS
```

**Deploy edge functions**

```bash
npx supabase functions deploy raid-seed
npx supabase functions deploy submit-raid-result
npx supabase functions deploy process-payout
npx supabase functions deploy verify-payment
npx supabase functions deploy check-briefing
npx supabase functions deploy jup-proxy

# Secrets
npx supabase secrets set TREASURY_ADDRESS=your_pubkey
npx supabase secrets set TREASURY_WALLET_KEYPAIR='[1,2,3,...]'
npx supabase secrets set SOLANA_RPC_URL=https://your-rpc.com
npx supabase secrets set JUPITER_API_KEY=your_jup_key
```

---

## Game Math

- **Base time:** 90s + gear bonus
- **House edge:** 1.85×
- **Win rate:** ~18–22% base, up to ~36% with full gear
- **Reward:** `(points / 5000) × DIFFICULTY_MAX_WIN × bonuses × (1 − fee)`
- **Risk drift:** escalates after 30s flat zone, random spikes 12%, firewall save 4%
- **Greed factor:** 2.1× above mult 1.5, 2.8× above mult 2.0

---

## Security

- **On-chain verification** — fee payer must match wallet, tx age ≤ 5 min, replay protection via tx signature dedup
- **Payout limits** — max 5 SOL single / 20 SOL per rolling 24h window
- **Wallet signature** — `signMessage` required before payout invoke
- **Anti-cheat** — `submit-raid-result` rejects impossible point/time/difficulty combos
- **CORS** — restricted to `solraid.app` in production edge functions

---

## $RAID Token

| Field | Value |
|---|---|
| Mint | `J8sMGxWB5kT8SqgmeTa3TfW6mpmucYK8xpMkmPCbBAGS` |
| Supply | 1,000,000,000 |
| Decimals | 9 |
| Launchpad | [Bags.fm](https://bags.fm/J8sMGxWB5kT8SqgmeTa3TfW6mpmucYK8xpMkmPCbBAGS) |

Use $RAID to pay entry fees, buy raid passes, and reduce fees by 50% with ticket boosts.

---

## License

MIT © 2026 Solana Raid
