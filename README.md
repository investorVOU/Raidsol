
# ⚡ SOLANA RAID: DEGEN PROTOCOL

![Solana Raid](https://img.shields.io/badge/SOLANA-NETWORK-14F195?style=for-the-badge&logo=solana&logoColor=white)
![Degen Protocol](https://img.shields.io/badge/PROTOCOL-DEGEN-9945FF?style=for-the-badge)
![PvP Enabled](https://img.shields.io/badge/MODE-PVP_LIVE-EF4444?style=for-the-badge)

A high-stakes, mobile-first survival game built for the Solana ecosystem. Enter raids, harvest data packets, manage terminal risk, and extract before the protocol collapses. Now featuring a deep progression system, Black Market loadouts, and **Private PvP Lobbies**.

---

## 🛡️ TRUST & VERIFICATION

We operate on absolute transparency. The blockchain doesn't lie, and neither do we.

*   **PUBLIC TREASURY**: A live feed of the protocol's solvency. View the Treasury Balance and Total Payouts directly on-chain via Solscan. *"Funds are visible. No funny business."*
*   **VERIFIABLE ROUNDS**: Every raid generates a cryptographic proof.
    *   **Raid ID**: Unique session identifier.
    *   **Server Seed**: Hashed seed used for RNG.
    *   **TX Signature**: The on-chain record of your entry and exit.
    *   *Verify your round on the Result Screen immediately after extraction.*

---

## ⚔️ MULTIPLAYER: PRIVATE PVP ROOMS (NEW)

Compete directly against friends in high-stakes, winner-takes-all private lobbies.

*   **HOST & INVITE**: Create a custom room, set the entry stake (e.g., 0.1 - 1.0 SOL), and share the unique **RAID-CODE** with friends.
*   **SYNCED SEED**: All players in the room face the exact same RNG conditions. Same risk spikes, same tick timing. Pure skill differentiation.
*   **HIGHEST EXTRACT WINS**: Survival isn't enough. The player who extracts with the **highest score** takes the **ENTIRE POT**.
*   **LIVE OPPONENT FEED**: Track your opponents' status (Active, Busted, Extracted) in real-time. See their scores lock in as they exit.

---

## 🎮 CORE GAMEPLAY: THE RAID

The "Raid" is a high-pressure survival loop designed to test your greed against mathematical certainty.

1.  **ENTRY & DEPLOYMENT**:
    *   **Deploy Stake**: Choose your mode (Solo, Team, Tournament, PvP).
    *   **Tactical Boosts**: Purchase optional pre-raid advantages:
        *   🛡️ **Risk Shield**: Reduces risk drift speed by 15% (Cost: 0.005 SOL).
        *   ⚡ **Score Overclock**: Starts the raid with a +0.5x Multiplier (Cost: 0.01 SOL).
    *   **Active Loadout**: Verify your equipped Gear and Avatar before initialization.
2.  **HARVEST**: As you stay in the raid, your score and potential SOL payout increase via a dynamic multiplier.
3.  **RISK ENGINE**: A central "Risk Meter" drifts upwards. Reaching 100% risk results in a **PROTOCOL BUST**—total loss of stake.
4.  **ACTIONS**:
    *   **ATTACK**: Aggressively boost your multiplier and score at the cost of significantly increased risk.
    *   **DEFEND**: Slow down the harvest to stabilize the link and reduce current risk.
    *   **EXIT & CASH OUT**: The ultimate decision. Terminate the link and secure your harvested SOL before it's too late.

---

## 📈 PROGRESSION: THE $SR XP SYSTEM

**$SR (Social Reputation)** serves as your Experience Points (XP). Your total $SR determines your Level and Rank within the Degen Protocol.

*   **EARNING XP**:
    *   **Mission Success**: Large $SR payouts for successful extractions.
    *   **Aggression Bonus**: Using `ATTACK` or high-risk maneuvers triggers bonus $SR popups.
    *   **Participation**: Even on a **BUST**, users earn minimal $SR to ensure progression.
    *   **Spending**: Every 1 SOL spent in the Black Market yields 1,000 $SR.
*   **RANK UP**: Reaching specific $SR milestones triggers a **LEVEL UP** event, unlocking permanent protocol privileges.

---

## 🏆 PROTOCOL RANKS & PERKS

Progress through 6 distinct Ranks, each offering tangible gameplay advantages:

| Rank | Level | SR Milestone | Perks |
| :--- | :--- | :--- | :--- |
| **RECRUIT** | 1 | 0 | Basic Solo Access |
| **RAIDER** | 5 | 1,000 | **Unlocks TEAM_MODE**, 5% Bonus $SR |
| **OPERATIVE**| 10 | 3,000 | Reduced RISK Drift, 5% Store Discount |
| **COMMANDER**| 15 | 7,000 | **Unlocks TOURNAMENT_MODE**, 10% Yield Boost |
| **GHOST** | 20 | 15,000 | Exclusive GHOST Gear Access, 20% $SR Bonus |
| **GOD** | 50 | 50,000 | Admin Terminal Access, Zero Fee Thursdays |

---

## 🛠 THE BLACK MARKET

The depot for tactical hardware and identity masking.

*   **BATTLE TOOLS (Gear)**: 20 unique items across **STANDARD**, **LIMITED**, and **EXCLUSIVE** rarities. Items provide passive buffs to Multipliers, Risk Reduction, or Raid Time.
*   **IDENTITY CORES (Avatars)**: 20 high-fidelity pixel personas. Equip new cores to refresh your protocol signature (and earn a 50 $SR equipment bonus).
*   **LEVEL GATING**: High-tier gear and elite avatars are locked behind Level requirements to prevent "pay-to-win" dynamics at early stages.

---

## 📁 PROJECT STRUCTURE

```text
/
├── components/           # Reusable UI components
│   ├── Header.tsx        # HUD displaying SOL/SR balances & Rank
│   ├── Navigation.tsx    # Responsive side/bottom nav
│   ├── LevelUpModal.tsx  # High-impact rank-up celebration
│   └── Disclaimer.tsx    # Entry gate for first-time users
├── screens/              # Main application views
│   ├── LobbyScreen.tsx   # Deployment hub with mode gating & Treasury
│   ├── RaidScreen.tsx    # The core risk engine & XP popups
│   ├── ProfileScreen.tsx # Responsive user dashboard, progress & history
│   ├── StoreScreen.tsx   # Black Market (Gear/Avatars with Level locks)
│   ├── MultiplayerSetupScreen.tsx # PvP Lobby Creation & Joining
│   ├── MultiplayerRaidScreen.tsx  # PvP Game Interface with Live Feed
│   └── ...
├── types.ts              # TypeScript interfaces, Ranks, and Item database
└── App.tsx               # Root state management & Level-up logic
```

---

## ⚠️ PROTOCOL WARNING

**THIS IS A HIGH-STAKES SIMULATION.** 
1.  **NO REFUNDS**: Protocol initialization fees are final.
2.  **NETWORK LAG**: We are not responsible for MEV exploits or network latency affecting extraction speed.
3.  **AGE REQUIREMENT**: You must be 18+ to interact with the Degen Protocol.

---

*Built for the Solana Global Hackathon — May 2025*
*Terminal Status: [STABLE]*
