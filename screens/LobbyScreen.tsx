
import React, { useState, useRef, useEffect } from 'react';
import { Mode, ENTRY_FEES, Difficulty, DIFFICULTY_CONFIG, GEAR_ITEMS, RAID_BOOSTS, AVATAR_ITEMS, Currency } from '../types';
import type { LivePrices } from '../hooks/usePrices';
import type { CurrentRoundInfo } from '../hooks/useRoundData';
import { formatCountdown, formatRoundWindow } from '../hooks/useRoundData';

const INTER:  React.CSSProperties = { fontFamily: "'Inter', system-ui, sans-serif" };
const SG_H1:  React.CSSProperties = { fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, letterSpacing: '0.8px', lineHeight: 1.1 };
const SG_CTA: React.CSSProperties = { fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, letterSpacing: '0.3px' };
const SG_NUM: React.CSSProperties = { fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontVariantNumeric: 'tabular-nums' };
const SG:     React.CSSProperties = { fontFamily: "'Space Grotesk', sans-serif" };
const BC:     React.CSSProperties = { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontStyle: 'italic', letterSpacing: '-0.3px' };
const BN:     React.CSSProperties = { fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '1.5px' };

interface LobbyScreenProps {
  onEnterRaid: (mode: Mode, difficulty?: Difficulty, boosts?: string[], currency?: Currency, useTicket?: boolean) => Promise<void> | void;
  isConnected: boolean;
  onConnect: () => void;
  currentLevel: number;
  walletBalance: number;
  usdcBalance: number;
  skrBalance: number;
  equippedGearIds: string[];
  equippedAvatarId?: string;
  ownedItemIds: string[];
  onToggleGear: (gearId: string) => void;
  onEquipAvatar: (avatarId: string) => void;
  onNavigateTreasury: () => void;
  onNavigateStore?: (tab?: 'GEAR' | 'AVATAR' | 'PASS') => void;
  onEnterRound?: (difficulty: Difficulty, boosts: string[], currency: Currency) => Promise<void>;
  onRequestFullscreen?: () => void;
  raidTickets?: number;
  lastFreeRaidDate?: string | null;
  drillCount?: number;
  drillWindowStart?: number;
  currencyRates?: LivePrices['currencyRates'];
  currentRound?: CurrentRoundInfo | null;
}

const DIFF_CONFIG = {
  [Difficulty.EASY]:   { label: 'Easy',     emoji: '🔵', color: 'text-sky-400',    ring: 'border-sky-500/40',     bg: 'bg-sky-500/10',    mult: '0.8×' },
  [Difficulty.MEDIUM]: { label: 'Standard', emoji: '🔵', color: 'text-cyan-400',   ring: 'border-cyan-500/40',    bg: 'bg-cyan-500/10',   mult: '1.0×' },
  [Difficulty.HARD]:   { label: 'Hardcore', emoji: '🟠', color: 'text-orange-400', ring: 'border-orange-500/40',  bg: 'bg-orange-500/10', mult: '1.4×' },
  [Difficulty.DEGEN]:  { label: 'Degen',    emoji: '🔴', color: 'text-red-400',    ring: 'border-red-500/40',     bg: 'bg-red-500/10',    mult: '2.5×' },
};

const LobbyScreen: React.FC<LobbyScreenProps> = ({
  onEnterRaid, isConnected, onConnect, currentLevel,
  walletBalance, usdcBalance, skrBalance,
  equippedGearIds, equippedAvatarId, ownedItemIds,
  onToggleGear, onNavigateTreasury, onNavigateStore, onEnterRound, onRequestFullscreen,
  raidTickets = 0, lastFreeRaidDate = null,
  drillCount = 0, drillWindowStart = 0,
  currencyRates, currentRound,
}) => {
  const rates = currencyRates ?? { [Currency.SOL]: 1, [Currency.USDC]: 0, [Currency.SKR]: 0 };
  // Normal raid modal
  const [showModal, setShowModal]           = useState(false);
  const [selectedDifficulty, setDifficulty] = useState<Difficulty>(Difficulty.MEDIUM);
  const [selectedBoosts, setBoosts]         = useState<string[]>([]);
  const [selectedMode, setMode]             = useState<Mode>(Mode.SOLO);
  const [entryCurrency, setCurrency]        = useState<Currency>(Currency.SOL);
  const [isDeploying, setIsDeploying]       = useState(false);
  const [useTicket, setUseTicket]           = useState(false);

  // Round raid modal
  const [showRoundModal, setShowRoundModal]     = useState(false);
  const [roundDifficulty, setRoundDifficulty]   = useState<Difficulty>(Difficulty.MEDIUM);
  const [roundCurrency, setRoundCurrency]       = useState<Currency>(Currency.SOL);
  const [roundBoosts, setRoundBoosts]           = useState<string[]>([]);

  // FAQ
  const [showFaq, setShowFaq]                   = useState(false);

  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  // Nav Raid button fires this event — opens the raid modal even when already on LOBBY
  useEffect(() => {
    const handler = () => handleOpenModal();
    window.addEventListener('solraid:openRaidModal', handler);
    return () => window.removeEventListener('solraid:openRaidModal', handler);
  }, []);

  // Drill cap
  const drillWindowExpired = (Date.now() - drillWindowStart) >= 6 * 60 * 60 * 1000;
  const drillsRemaining    = Math.max(0, 3 - (drillWindowExpired ? 0 : drillCount));
  const drillCapHit        = isConnected && drillsRemaining === 0;


  const handleOpenModal = () => { setBoosts([]); setUseTicket(false); setShowModal(true); };

  const handleDeploy = async () => {
    onRequestFullscreen?.(); // must be called synchronously before any await
    setShowModal(false);
    setIsDeploying(true);
    try {
      await onEnterRaid(selectedMode, selectedDifficulty, selectedBoosts, entryCurrency, useTicket && raidTickets > 0);
    } finally {
      if (mountedRef.current) setIsDeploying(false);
    }
  };

  const handleEnterRound = async () => {
    onRequestFullscreen?.(); // must be called synchronously before any await
    setShowRoundModal(false);
    setIsDeploying(true);
    try {
      if (onEnterRound) {
        await onEnterRound(roundDifficulty, roundBoosts, roundCurrency);
      } else {
        await onEnterRaid(Mode.SOLO, roundDifficulty, roundBoosts, roundCurrency, false);
      }
    } finally {
      if (mountedRef.current) setIsDeploying(false);
    }
  };

  // Cost calc
  const entryFeeBase   = ENTRY_FEES[selectedMode];
  const applyTicket    = useTicket && raidTickets > 0;
  const entryFee       = applyTicket ? entryFeeBase * 0.5 : entryFeeBase;
  const boostCost      = selectedBoosts.reduce((s, id) => s + (RAID_BOOSTS.find(b => b.id === id)?.cost ?? 0), 0);
  const totalCostSol   = entryFee + boostCost;
  const currencyRate   = rates[entryCurrency];
  const pricesLoading  = entryCurrency !== Currency.SOL && currencyRate === 0;
  const totalDisplay   = totalCostSol * currencyRate;
  const curSymbol      = entryCurrency === Currency.SOL ? 'SOL' : entryCurrency === Currency.USDC ? 'USDC' : 'SKR';
  const curDecimals    = entryCurrency === Currency.SOL ? 3 : entryCurrency === Currency.USDC ? 2 : 0;
  const currentBalance = entryCurrency === Currency.SOL ? walletBalance : entryCurrency === Currency.USDC ? usdcBalance : skrBalance;

  // Round cost calc (always SOLO, no boosts)
  const roundFeeBase       = ENTRY_FEES[Mode.SOLO];
  const roundRate          = rates[roundCurrency];
  const roundPricesLoading = roundCurrency !== Currency.SOL && roundRate === 0;
  const roundTotalDisplay  = roundFeeBase * roundRate;
  const roundCurSymbol     = roundCurrency === Currency.SOL ? 'SOL' : roundCurrency === Currency.USDC ? 'USDC' : 'SKR';
  const roundCurDecimals   = roundCurrency === Currency.SOL ? 3 : roundCurrency === Currency.USDC ? 2 : 0;
  const roundBalance       = roundCurrency === Currency.SOL ? walletBalance : roundCurrency === Currency.USDC ? usdcBalance : skrBalance;

  // Gear stats
  const equippedGear   = GEAR_ITEMS.filter(g => equippedGearIds.includes(g.id));
  const equippedAvatar = AVATAR_ITEMS.find(a => a.id === equippedAvatarId);
  const ownedGear      = GEAR_ITEMS.filter(g => ownedItemIds.includes(g.id));
  const gearStats      = equippedGear.reduce((a, g) => {
    if (g.effect === 'MULT_BOOST')     a.mult += g.benefitValue ?? 0;
    if (g.effect === 'RISK_REDUCTION') a.riskReduc += g.benefitValue ?? 0;
    if (g.effect === 'TIME_BOOST')     a.timeBoost += g.benefitValue ?? 0;
    return a;
  }, { mult: 0, riskReduc: 0, timeBoost: 0 });

  const boostDrift  = selectedBoosts.includes('risk_shield') ? 15 : 0;
  const boostMult   = selectedBoosts.includes('score_mult')  ? 0.5 : 0;
  const totalMult   = (1.0 + gearStats.mult + boostMult).toFixed(2);
  const totalRisk   = gearStats.riskReduc + boostDrift;
  const totalTime   = 30 + gearStats.timeBoost;
  const powerScore  = Math.min(100, Math.round(gearStats.mult * 20 + gearStats.riskReduc * 1.5 + gearStats.timeBoost * 1.2 + boostDrift + boostMult * 15));


  // Day label for round banner
  const dayLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  return (
    <div className="w-full h-full flex flex-col relative bg-[#05050f] overflow-hidden" style={INTER}>


      {/* ── HEADER ── */}
      <div className="relative z-10 shrink-0 px-4 pt-2 pb-1">
        <div className="flex items-center justify-between">
          <div>
            <p style={{ ...BN, fontSize: '28px', color: '#FF2929', letterSpacing: '2.5px', lineHeight: 1 }}>
              SOL RAID
            </p>
            <p className="text-[11px] text-white/38 mt-0.5" style={{ ...INTER, fontWeight: 400 }}>
              Win SOL. Don't get caught.
            </p>
          </div>
          {/* FAQ button */}
          <button
            onClick={() => setShowFaq(true)}
            className="w-9 h-9 rounded-full bg-white/6 border border-white/[0.14] flex items-center justify-center text-white/45 hover:text-white hover:bg-white/10 active:scale-95 transition-all shrink-0 ml-3"
          >
            <i className="fa-solid fa-question text-sm" />
          </button>
        </div>
      </div>

      {/* ── SCROLLABLE CONTENT ── */}
      <div className="relative z-10 flex-1 overflow-y-auto scrollbar-hide px-4 pt-1 pb-44 md:pb-6 space-y-2">

        {/* ── ENTER RAID ── */}
        <button
          onClick={() => isConnected ? handleOpenModal() : onConnect()}
          className="w-full relative overflow-hidden rounded-2xl group active:scale-[0.98] transition-all duration-150"
          style={{
            background: 'linear-gradient(135deg, #FF2929 0%, #CC0000 100%)',
            boxShadow: '0 2px 18px rgba(255,41,41,0.30)',
          }}
        >
          <div className="relative z-10 flex items-center justify-between px-5 py-2 sm:py-2.5">
            <div>
              <p className="text-white/55 mb-0.5 text-[11px]" style={INTER}>
                {isConnected ? 'Ready to deploy' : 'Connect wallet to start'}
              </p>
              <p className="text-white leading-none" style={{ ...BC, fontSize: '32px', letterSpacing: '-0.5px' }}>ENTER RAID</p>
              <p className="text-white/50 mt-0.5 text-[11px]" style={INTER}>Win SOL · don't get caught</p>
            </div>
            <div className="flex flex-col items-center gap-1.5 shrink-0">
              <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center group-hover:bg-white/18 transition-colors">
                <i className="fa-solid fa-person-running" style={{ fontSize: '24px', color: 'rgba(255,255,255,0.85)' }} />
              </div>
              {raidTickets > 0 && (
                <span className="text-[9px] font-medium bg-white/15 text-white/75 rounded-full px-2 py-0.5" style={INTER}>
                  🎟️ {raidTickets}x
                </span>
              )}
            </div>
          </div>
        </button>

        {/* ── RAID ROUND CARD ── */}
        {currentRound && (
          <button
            onClick={() => isConnected ? setShowRoundModal(true) : onConnect()}
            className="w-full relative overflow-hidden rounded-2xl text-left active:scale-[0.98] transition-all duration-150 group"
            style={{ background: 'rgba(255,41,41,0.04)', border: '1px solid rgba(255,41,41,0.20)' }}
          >
            {/* Faint red glow strip at top */}
            <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,41,41,0.5), transparent)' }} />

            <div className="px-4 py-3">
              {/* Top row: title + pool */}
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[9px] px-2 py-0.5 rounded-full text-[#FF2929]/80 uppercase tracking-wider"
                      style={{ background: 'rgba(255,41,41,0.12)', border: '1px solid rgba(255,41,41,0.20)', ...INTER, fontWeight: 500 }}>
                      Round {currentRound.roundNum} / 4
                    </span>
                    <span className="text-[9px] text-white/35" style={INTER}>{dayLabel}</span>
                  </div>
                  <p className="leading-none" style={{ ...BN, fontSize: '22px', color: '#fff', letterSpacing: '1.5px' }}>RAID ROUND</p>
                  <p className="text-[10px] text-white/40 mt-0.5" style={{ ...INTER, fontWeight: 400 }}>
                    Top 5 after round ends share the pool
                  </p>
                </div>
                {/* Pool */}
                <div className="text-right shrink-0 ml-4">
                  <p className="text-[9px] text-white/40 mb-0.5 uppercase tracking-wider" style={INTER}>Prize pool</p>
                  <p className="text-2xl leading-none text-[#FFB800]" style={{ ...BN, letterSpacing: '1px' }}>
                    {currentRound.poolSol < 0.001 ? '0.000' : currentRound.poolSol.toFixed(3)}
                  </p>
                  <p className="text-[9px] text-white/40 mt-0.5" style={INTER}>SOL</p>
                </div>
              </div>

              {/* Bottom row: countdown + CTA */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#FF2929] animate-pulse shrink-0" />
                  <span className="text-[10px] text-white/45" style={INTER}>Closes in</span>
                  <span className="text-[10px] font-semibold text-white/70" style={SG_NUM}>
                    {formatCountdown(currentRound.timeRemainingMs)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all group-hover:opacity-90"
                  style={{ background: 'rgba(255,41,41,0.12)', border: '1px solid rgba(255,41,41,0.30)', ...BN, fontSize: '13px', color: '#FF4444', letterSpacing: '1.5px' }}>
                  <i className="fa-solid fa-trophy text-[10px]" />
                  COMPETE
                </div>
              </div>
            </div>
          </button>
        )}

        {/* ── SECONDARY MODES ── */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => isConnected ? onEnterRaid(Mode.PVP, Difficulty.MEDIUM, []) : onConnect()}
            className="relative overflow-hidden rounded-xl p-3 text-left active:scale-[0.97] transition-all group"
            style={{ background: 'rgba(255,41,41,0.05)', border: '1px solid rgba(255,41,41,0.22)' }}
          >
            <div className="absolute top-2.5 right-2.5">
              <i className="fa-solid fa-swords text-[#FF2929]/60 text-lg" />
            </div>
            <p className="text-[9px] text-white/40 mb-1 uppercase tracking-wider" style={INTER}>Multiplayer</p>
            <p className="leading-none mb-1" style={{ ...BN, fontSize: '22px', color: '#FF2929', letterSpacing: '1.5px' }}>PVP DUEL</p>
            <p className="text-[10px] text-white/45" style={{ ...INTER, fontWeight: 400 }}>Stake vs players</p>
          </button>

          <button
            onClick={() => {
              if (!isConnected) { onConnect(); return; }
              if (drillCapHit) return;
              onEnterRaid(Mode.DRILL, Difficulty.MEDIUM, []);
            }}
            disabled={drillCapHit}
            className={`relative overflow-hidden rounded-xl p-3 text-left transition-all group ${
              drillCapHit ? 'opacity-35 cursor-not-allowed' : 'active:scale-[0.97]'
            }`}
            style={{
              background: drillCapHit ? 'rgba(255,255,255,0.02)' : 'rgba(77,166,255,0.05)',
              border: `1px solid ${drillCapHit ? 'rgba(255,255,255,0.06)' : 'rgba(77,166,255,0.22)'}`,
            }}
          >
            <div className="absolute top-2.5 right-2.5">
              <i className="fa-solid fa-dumbbell text-[#4da6ff]/60 text-base" />
            </div>
            <p className="text-[9px] text-white/40 mb-1 uppercase tracking-wider" style={INTER}>Training</p>
            <p className="leading-none mb-1" style={{ ...BN, fontSize: '22px', color: '#4da6ff', letterSpacing: '1.5px' }}>FREE DRILL</p>
            <p className={`text-[10px] ${drillCapHit ? 'text-white/25' : 'text-white/45'}`} style={{ ...INTER, fontWeight: 400 }}>
              {isConnected ? (drillCapHit ? 'Limit reached' : `${drillsRemaining}/3 left`) : 'No entry fee'}
            </p>
          </button>
        </div>

        {/* ── RAID PASS ── */}
        <button
          onClick={() => onNavigateStore?.('PASS')}
          className="w-full rounded-xl p-3 text-left active:scale-[0.98] transition-all group"
          style={{ background: 'rgba(255,184,0,0.05)', border: '1px solid rgba(255,184,0,0.22)' }}
        >
          <div className="flex items-center gap-3">
            <div className="text-xl shrink-0">🎟️</div>
            <div className="flex-1 min-w-0">
              {raidTickets > 0 ? (
                <>
                  <p className="leading-none" style={{ ...BN, fontSize: '16px', color: '#FFB800', letterSpacing: '1.5px' }}>{raidTickets}× RAID PASS ACTIVE</p>
                  <p className="text-[10px] text-white/45 mt-0.5" style={{ ...INTER, fontWeight: 400 }}>50% off entry · 10% win boost</p>
                </>
              ) : (
                <>
                  <p className="leading-none" style={{ ...BN, fontSize: '16px', color: '#FFB800', letterSpacing: '1.5px' }}>RAID PASS</p>
                  <p className="text-[10px] text-white/45 mt-0.5" style={{ ...INTER, fontWeight: 400 }}>50% off entry · SKR holders get extra 50% off</p>
                </>
              )}
            </div>
            <i className="fa-solid fa-chevron-right text-[#FFB800]/50 text-xs shrink-0" />
          </div>
        </button>


        {!isConnected && (
          <div className="rounded-xl bg-white/3 border border-white/7 px-4 py-3 text-center">
            <p className="text-xs text-white/35 font-medium">Connect your wallet to start raiding</p>
          </div>
        )}
      </div>

      {/* ── LOADING OVERLAY ── */}
      {isDeploying && (
        <div className="fixed inset-0 z-[200] bg-black/90 flex flex-col items-center justify-center p-8" style={INTER}>
          <i className="fa-solid fa-person-running text-[#FF2929] text-3xl mb-5" />
          <p className="text-white text-base font-medium mb-1">Waiting for signature</p>
          <p className="text-white/35 text-sm">Approve in your wallet</p>
        </div>
      )}

      {/* ── FAQ MODAL ── */}
      {showFaq && (
        <div className="fixed inset-x-0 top-0 bottom-[76px] sm:bottom-0 sm:inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4">
          <div className="absolute inset-0 bg-black/85 backdrop-blur-xl animate-in fade-in duration-200" onClick={() => setShowFaq(false)} />
          <div className="relative w-full sm:max-w-lg bg-[#080814] border-t sm:border border-white/[0.14] rounded-t-3xl sm:rounded-2xl shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 flex flex-col max-h-[90svh]" style={SG}>

            <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-white/15" />
            </div>

            <div className="shrink-0 px-5 py-4 flex items-center justify-between border-b border-white/6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-white/8 flex items-center justify-center">
                  <i className="fa-solid fa-question text-white/60 text-sm" />
                </div>
                <h2 className="text-base font-semibold text-white">FAQ</h2>
              </div>
              <button onClick={() => setShowFaq(false)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all">
                <i className="fa-solid fa-xmark text-sm" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 px-5 py-4 space-y-3">
              {[
                {
                  q: 'What is Sol Raid?',
                  a: 'Sol Raid is an on-chain extraction game on Solana. You enter with a stake, choose your difficulty, and try to score as many points as possible before getting busted. Cash out at the right moment to convert your score into SOL. The longer you hold, the higher the reward — but risk rises every second.',
                },
                {
                  q: 'What is the difference between a normal raid and a round-based raid?',
                  a: 'Normal raids pay out SOL immediately when you succeed — your reward is based on your score and entry fee. Round-based raids score points instead of paying instant SOL. Your best score in a 6-hour window competes on the round leaderboard, and prizes are claimed after the round ends.',
                },
                {
                  q: 'How do Raid Rounds work?',
                  a: 'There are 4 rounds per day (UTC), each lasting 6 hours. Your highest score in a round goes on the leaderboard. After the round closes, 8% of all entry fees from that window are split among the top 5 wallets by score: 1st 40% · 2nd 25% · 3rd 18% · 4th 11% · 5th 6%.',
                },
                {
                  q: 'How do I claim my round winnings?',
                  a: 'After a round closes, go to Profile → Round Wins tab. Eligible rounds show a Claim button. Claiming credits SOL to your unclaimed balance — then use the Withdraw button to send it on-chain to your wallet.',
                },
                {
                  q: 'Is the game provably fair?',
                  a: 'Yes. Before each raid a SHA-256 server seed hash is committed. After the raid the full seed is revealed so you can verify the RNG was never manipulated. Seed history is visible in your profile.',
                },
                {
                  q: 'What is the house edge?',
                  a: 'Base win rate is roughly 25–30% with no gear. Gear and boosts can push this toward 45%. The house margin comes from risk drift mechanics — the longer you stay, the harder it gets.',
                },
                {
                  q: 'What are Raid Passes?',
                  a: 'Raid Passes give 50% off the entry fee plus a 10% boost to your SOL winnings. You earn 1 free ticket per day (max 3 stockpiled). Additional passes are purchased with SKR in the Store. Toggle the ticket at deployment if you own one.',
                },
                {
                  q: 'What is the SKR token?',
                  a: 'SKR (Seeker) is the in-game utility token on Solana. It is used to buy Raid Passes, gear, and avatars in the Store. SKR is also accepted as payment for raid entry fees alongside SOL and USDC.',
                },
                {
                  q: 'What is PvP Arena?',
                  a: 'PvP lets you stake against other players in a shared room. All players raid the same RNG seed simultaneously — pure skill decides the outcome. The player with the highest score when they extract wins the full pot. Stake any amount in SOL, USDC, or SKR.',
                },
              ].map(({ q, a }, i) => (
                <div key={i} className="rounded-xl bg-white/[0.025] border border-white/[0.12] p-4">
                  <p className="text-sm font-semibold text-white mb-1.5">{q}</p>
                  <p className="text-[11px] text-white/45 font-medium leading-relaxed">{a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── ROUND MODAL ── */}
      {showRoundModal && currentRound && (
        <div className="fixed inset-x-0 top-0 bottom-[76px] sm:bottom-0 sm:inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4">
          <div className="absolute inset-0 bg-black/85 backdrop-blur-xl animate-in fade-in duration-200" onClick={() => setShowRoundModal(false)} />

          <div
            className="relative w-full sm:max-w-lg bg-[#08060f] border-t sm:border rounded-t-3xl sm:rounded-2xl shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 flex flex-col max-h-[90svh] sm:max-h-[85vh]"
            style={{ borderColor: 'rgba(153,69,255,0.25)', ...SG }}
          >
            {/* Drag handle */}
            <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-white/15" />
            </div>

            {/* Header */}
            <div className="shrink-0 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(153,69,255,0.18)', border: '1px solid rgba(153,69,255,0.30)' }}>
                  <i className="fa-solid fa-trophy" style={{ color: '#b77aff', fontSize: '15px' }} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-black text-white">Raid Round</h2>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(153,69,255,0.18)', color: '#b77aff', border: '1px solid rgba(153,69,255,0.25)' }}>
                      Round {currentRound.roundNum} / 4
                    </span>
                  </div>
                  <p className="text-[10px] text-white/32 font-medium">{dayLabel}</p>
                </div>
              </div>
              <button onClick={() => setShowRoundModal(false)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all">
                <i className="fa-solid fa-xmark text-sm" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto min-h-0 px-5 pb-2 space-y-4">

              {/* Prize pool banner */}
              <div className="rounded-xl p-4" style={{ background: 'linear-gradient(135deg, rgba(255,41,41,0.10) 0%, rgba(255,184,0,0.06) 100%)', border: '1px solid rgba(255,41,41,0.22)' }}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-[9px] text-white/35 font-medium uppercase tracking-wider mb-0.5">Prize Pool</p>
                    <p className="text-2xl font-black leading-none" style={{ background: 'linear-gradient(90deg, #FF2929, #FFB800)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                      {currentRound.poolSol < 0.001 ? '0.000' : currentRound.poolSol.toFixed(3)}
                      <span className="text-sm ml-1 text-white/40" style={{ WebkitTextFillColor: 'rgba(255,255,255,0.4)' }}>SOL</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] text-white/35 font-medium mb-0.5">Closes in</p>
                    <div className="flex items-center gap-1.5 justify-end">
                      <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#FF2929' }} />
                      <p className="text-sm font-bold tabular-nums text-white/80">{formatCountdown(currentRound.timeRemainingMs)}</p>
                    </div>
                  </div>
                </div>

                {/* Prize breakdown */}
                <div className="space-y-1.5">
                  {[
                    { rank: 1, pct: 40, medal: '🥇' },
                    { rank: 2, pct: 25, medal: '🥈' },
                    { rank: 3, pct: 18, medal: '🥉' },
                    { rank: 4, pct: 11, medal: '4th' },
                    { rank: 5, pct:  6, medal: '5th' },
                  ].map(({ rank, pct, medal }) => {
                    const allocation = currentRound.poolSol * (pct / 100);
                    const topEntry   = currentRound.currentLeaders.find(e => e.rank === rank);
                    return (
                      <div key={rank} className="flex items-center gap-2">
                        <span className="text-xs w-7 shrink-0 text-center">{medal}</span>
                        <div className="flex-1 h-1 rounded-full bg-white/8 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: rank === 1 ? '#FFD700' : rank === 2 ? '#C0C0C0' : rank === 3 ? '#CD7F32' : 'rgba(255,255,255,0.25)' }} />
                        </div>
                        <span className="text-[9px] text-white/40 font-medium w-7 text-right shrink-0">{pct}%</span>
                        <span className="text-[9px] font-bold text-white/60 w-16 text-right shrink-0 tabular-nums">
                          {allocation < 0.001 ? '—' : `${allocation.toFixed(3)} SOL`}
                        </span>
                        {topEntry && (
                          <span className="text-[9px] text-white/30 truncate max-w-[80px]">
                            {topEntry.username} · {topEntry.pointsScored.toLocaleString()}pts
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* How it works */}
              <div className="rounded-xl bg-white/3 border border-white/7 px-4 py-3 space-y-1">
                <p className="text-[9px] text-white/30 uppercase tracking-wider font-medium mb-2">How it works</p>
                {[
                  'Enter this round with any difficulty',
                  'Win as much SOL as possible in your raid',
                  'Your best result is tracked on the leaderboard',
                  'Top 5 wallets at round close share the prize pool',
                ].map((t, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-[9px] text-white/20 font-bold shrink-0 mt-0.5">{i + 1}.</span>
                    <p className="text-[10px] text-white/45 font-medium leading-snug">{t}</p>
                  </div>
                ))}
              </div>

              {/* ── Battle Tools (gear + boosts) ── */}
              <section>
                <p className="text-[9px] text-white/30 uppercase tracking-wider mb-2" style={{ ...INTER, fontWeight: 600 }}>Battle Tools</p>
                {/* Gear quick-swap */}
                <div className="rounded-xl p-3 mb-2" style={{ background: 'rgba(153,69,255,0.06)', border: '1px solid rgba(153,69,255,0.14)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[9px] text-white/28 uppercase tracking-wider" style={{ ...INTER, fontWeight: 500 }}>Gear loadout</p>
                    <span className="text-[9px] text-white/22" style={INTER}>{equippedGear.length}/4 slots</span>
                  </div>
                  {ownedGear.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {ownedGear.map(gear => {
                        const isEquipped = equippedGearIds.includes(gear.id);
                        return (
                          <button key={gear.id} onClick={() => onToggleGear(gear.id)}
                            title={`${gear.name} — ${gear.description}`}
                            className={`w-10 h-10 rounded-xl border-2 transition-all flex items-center justify-center active:scale-95 ${isEquipped ? 'border-purple-500/50 bg-purple-500/12' : 'border-white/[0.12] hover:border-white/22 bg-white/3'}`}>
                            {gear.image && !gear.image.startsWith('http')
                              ? <span className="text-lg leading-none">{gear.image}</span>
                              : <img src={gear.image} className="w-full h-full object-contain rounded-xl" alt="gear" />
                            }
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[10px] text-white/22 text-center py-1" style={INTER}>No gear — visit the store</p>
                  )}
                </div>

                {/* Boosts */}
                {RAID_BOOSTS.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {RAID_BOOSTS.map(boost => {
                      const active = roundBoosts.includes(boost.id);
                      return (
                        <button key={boost.id}
                          onClick={() => setRoundBoosts(p => p.includes(boost.id) ? p.filter(i => i !== boost.id) : [...p, boost.id])}
                          className={`p-3 rounded-xl border transition-all text-left active:scale-[0.97] ${active ? 'bg-amber-500/10 border-amber-500/35' : 'bg-white/3 border-white/[0.12] hover:border-white/18'}`}>
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-lg">{boost.icon}</span>
                            <span className={`text-[9px] font-semibold ${active ? 'text-amber-400' : 'text-white/30'}`} style={SG_NUM}>{boost.cost} S</span>
                          </div>
                          <p className={`text-[10px] leading-tight ${active ? 'text-white' : 'text-white/40'}`} style={{ ...INTER, fontWeight: 500 }}>{boost.name}</p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Difficulty */}
              <section>
                <p className="text-[9px] text-white/30 uppercase tracking-wider mb-2" style={{ ...INTER, fontWeight: 600 }}>Difficulty</p>
                <div className="grid grid-cols-4 gap-2">
                  {Object.values(Difficulty).map(diff => {
                    const cfg    = DIFF_CONFIG[diff];
                    const active = roundDifficulty === diff;
                    return (
                      <button key={diff} onClick={() => setRoundDifficulty(diff)}
                        className={`p-2.5 rounded-xl border transition-all text-center active:scale-[0.97] ${active ? `${cfg.ring} ${cfg.bg}` : 'border-white/[0.12] bg-white/3 hover:border-white/18'}`}>
                        <span className="text-lg block mb-1">{cfg.emoji}</span>
                        <p className={`text-[9px] font-semibold ${active ? cfg.color : 'text-white/45'}`}>{cfg.label}</p>
                        <p className="text-[8px] text-white/70 mt-0.5">{cfg.mult}</p>
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>

            {/* Footer */}
            <div className="shrink-0 border-t border-white/5 p-4 bg-[#060612] rounded-b-3xl sm:rounded-b-2xl space-y-3">
              {/* Currency */}
              <div className="grid grid-cols-3 gap-2">
                {([Currency.SOL, Currency.USDC, Currency.SKR] as Currency[]).map(c => {
                  const bal = c === Currency.SOL ? walletBalance : c === Currency.USDC ? usdcBalance : skrBalance;
                  const sym = c === Currency.SOL ? 'SOL' : c === Currency.USDC ? 'USDC' : 'SKR';
                  const colActive = c === Currency.SOL ? 'border-white/40 bg-white/8 text-white'
                    : c === Currency.USDC ? 'border-blue-400/45 bg-blue-400/8 text-blue-400'
                    : 'border-orange-400/45 bg-orange-400/8 text-orange-400';
                  const active = roundCurrency === c;
                  return (
                    <button key={c} onClick={() => setRoundCurrency(c)}
                      className={`py-2.5 rounded-xl border-2 transition-all text-center ${active ? colActive : 'border-white/7 text-white/35 bg-white/3 hover:border-white/18'}`}>
                      <p className="text-[10px] font-semibold">{sym}</p>
                      <p className="text-[9px] text-white/40 mt-0.5">{bal.toFixed(c === Currency.SKR ? 0 : 2)}</p>
                    </button>
                  );
                })}
              </div>

              {/* Cost + enter */}
              <div className="flex items-center gap-3">
                <div className="shrink-0">
                  <p className="text-[9px] text-white/28 font-semibold uppercase mb-0.5">Entry cost</p>
                  <p className="text-xl font-bold text-white leading-none">
                    {roundPricesLoading
                      ? <span className="text-white/28 text-sm animate-pulse">…</span>
                      : <>{roundTotalDisplay.toFixed(roundCurDecimals)}<span className={`text-sm ml-1 font-semibold ${roundCurrency === Currency.SOL ? 'text-white/60' : roundCurrency === Currency.USDC ? 'text-blue-400' : 'text-orange-400'}`}>{roundCurSymbol}</span></>
                    }
                  </p>
                  {!roundPricesLoading && roundBalance < roundTotalDisplay && (
                    <p className="text-[9px] text-red-400 font-semibold mt-0.5">Insufficient funds</p>
                  )}
                </div>
                <button
                  onClick={handleEnterRound}
                  disabled={roundPricesLoading || roundBalance < roundTotalDisplay}
                  className="flex-1 py-3.5 rounded-xl font-bold text-sm active:scale-[0.98] transition-all disabled:opacity-35 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg, #FF2929 0%, #CC0000 100%)', color: '#fff', boxShadow: '0 0 20px rgba(255,41,41,0.25)', ...BN, fontSize: '15px' }}
                >
                  ENTER ROUND
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── DEPLOY MODAL ── */}
      {showModal && (
        <div className="fixed inset-x-0 top-0 bottom-[76px] sm:bottom-0 sm:inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4">
          <div className="absolute inset-0 bg-black/85 backdrop-blur-xl animate-in fade-in duration-200" onClick={() => setShowModal(false)} />

          <div className="relative w-full sm:max-w-4xl bg-[#080814] border-t sm:border border-white/[0.14] rounded-t-3xl sm:rounded-2xl shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 flex flex-col h-[90svh] sm:h-auto sm:max-h-[95vh]" style={SG}>

            {/* Drag handle */}
            <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-white/15" />
            </div>

            {/* Modal header */}
            <div className="shrink-0 px-5 py-4 flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="w-1 h-6 rounded-full bg-[#FF2929]" />
                <h2 className="text-base font-semibold text-white">Configure Raid</h2>
              </div>
              <button onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all">
                <i className="fa-solid fa-xmark text-sm" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto min-h-0 p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">

                {/* ── Left col: settings ── */}
                <div className="space-y-5">

                  {/* Mode */}
                  <section>
                    <p className="text-[10px] font-semibold text-white/35 uppercase tracking-wider mb-2">Mode</p>
                    <div className="space-y-2">
                      {[
                        { mode: Mode.SOLO,       label: 'Solo',       desc: 'Play alone',        icon: 'fa-user',   locked: false             },
                        { mode: Mode.TEAM,       label: 'Squad',      desc: '4-player team',     icon: 'fa-users',  locked: currentLevel < 5  },
                        { mode: Mode.TOURNAMENT, label: 'Tournament', desc: 'Compete for glory', icon: 'fa-trophy', locked: currentLevel < 15 },
                      ].map(({ mode, label, desc, icon, locked }) => (
                        <button key={mode} onClick={() => !locked && setMode(mode)} disabled={locked}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                            locked            ? 'opacity-35 cursor-not-allowed border-white/5 bg-transparent'
                            : selectedMode === mode ? 'bg-[#FF2929]/8 border-[#FF2929]/35'
                            : 'bg-white/3 border-white/[0.12] hover:border-white/18 active:scale-[0.98]'
                          }`}>
                          <i className={`fa-solid ${icon} text-sm shrink-0 ${selectedMode === mode && !locked ? 'text-[#FF2929]' : 'text-white/40'}`} />
                          <div className="flex-1 text-left">
                            <p className={`text-sm font-semibold ${selectedMode === mode ? 'text-white' : 'text-white/70'}`}>{label}</p>
                            <p className="text-[10px] text-white/28 font-medium">{desc}</p>
                          </div>
                          <div className="shrink-0 flex items-center gap-2">
                            {locked && <span className="text-[9px] bg-red-500/18 text-red-400 rounded-full px-2 py-0.5 font-semibold">Locked</span>}
                            <span className="text-xs text-white/35 font-medium">{ENTRY_FEES[mode]} SOL</span>
                            {selectedMode === mode && !locked && <div className="w-1.5 h-1.5 rounded-full bg-[#FF2929]" />}
                          </div>
                        </button>
                      ))}
                    </div>
                  </section>

                  {/* Difficulty */}
                  <section>
                    <p className="text-[10px] font-semibold text-white/35 uppercase tracking-wider mb-2">Difficulty</p>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.values(Difficulty).map(diff => {
                        const cfg = DIFF_CONFIG[diff];
                        const active = selectedDifficulty === diff;
                        return (
                          <button key={diff} onClick={() => setDifficulty(diff)}
                            className={`p-3 rounded-xl border transition-all text-left active:scale-[0.97] ${active ? `${cfg.ring} ${cfg.bg}` : 'border-white/[0.12] bg-white/3 hover:border-white/18'}`}>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-base">{cfg.emoji}</span>
                              {active && <div className="w-1.5 h-1.5 rounded-full bg-white/60 animate-pulse" />}
                            </div>
                            <p className={`text-xs font-semibold ${active ? cfg.color : 'text-white/55'}`}>{cfg.label}</p>
                            <p className="text-[9px] text-white/70 mt-0.5 font-medium">{cfg.mult}</p>
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  {/* Boosts */}
                  <section>
                    <p className="text-[10px] font-semibold text-white/35 uppercase tracking-wider mb-2">Boosts</p>
                    <div className="grid grid-cols-2 gap-2">
                      {RAID_BOOSTS.map(boost => {
                        const active = selectedBoosts.includes(boost.id);
                        return (
                          <button key={boost.id} onClick={() => setBoosts(p => p.includes(boost.id) ? p.filter(i => i !== boost.id) : [...p, boost.id])}
                            className={`p-3 rounded-xl border transition-all text-left active:scale-[0.97] ${active ? 'bg-amber-500/10 border-amber-500/35' : 'bg-white/3 border-white/[0.12] hover:border-white/18'}`}>
                            <div className="flex justify-between items-start mb-1.5">
                              <span className="text-lg">{boost.icon}</span>
                              <span className={`text-xs font-semibold ${active ? 'text-amber-400' : 'text-white/35'}`}>{boost.cost} S</span>
                            </div>
                            <p className={`text-[10px] font-semibold leading-tight ${active ? 'text-white' : 'text-white/45'}`}>{boost.name}</p>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                </div>

                {/* ── Right col: loadout ── */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <p className="text-[10px] font-semibold text-white/35 uppercase tracking-wider">Loadout</p>
                    <span className="text-[10px] text-white/25 font-medium">{equippedGear.length}/4 slots</span>
                  </div>

                  {/* Gear slots */}
                  <div className="grid grid-cols-5 gap-2">
                    <div className="aspect-square rounded-xl bg-black border-2 border-cyan-500/45 relative overflow-hidden">
                      {equippedAvatar?.image && <img src={equippedAvatar.image} className="w-full h-full object-cover" alt="Core" />}
                      <div className="absolute bottom-0 left-0 right-0 bg-cyan-500/80 text-[7px] text-black font-bold text-center py-0.5">CORE</div>
                    </div>
                    {[...Array(4)].map((_, i) => {
                      const gear = equippedGear[i];
                      return (
                        <div key={i} className={`aspect-square rounded-xl bg-black/60 border-2 relative overflow-hidden ${gear ? 'border-purple-500/50' : 'border-white/[0.12]'}`}
                          title={gear ? `${gear.name}: ${gear.description}` : 'Empty slot'}>
                          {gear ? (
                            gear.image && !gear.image.startsWith('http')
                              ? <div className="w-full h-full flex items-center justify-center text-xl">{gear.image}</div>
                              : <img src={gear.image} className="w-full h-full object-contain" alt={gear.name} />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-white/12 text-lg font-light">+</div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Quick-swap */}
                  {ownedGear.length > 0 ? (
                    <div className="rounded-xl bg-white/3 border border-white/[0.12] p-3">
                      <p className="text-[10px] font-semibold text-white/25 uppercase mb-2">Quick swap</p>
                      <div className="flex flex-wrap gap-2">
                        {ownedGear.map(gear => {
                          const isEquipped = equippedGearIds.includes(gear.id);
                          return (
                            <button key={gear.id} onClick={() => onToggleGear(gear.id)} title={`${gear.name} — ${gear.description}`}
                              className={`w-10 h-10 rounded-xl border-2 transition-all flex items-center justify-center ${isEquipped ? 'border-purple-500/50 bg-purple-500/12' : 'border-white/[0.12] hover:border-white/22 bg-white/3'}`}>
                              {gear.image && !gear.image.startsWith('http')
                                ? <span className="text-lg leading-none">{gear.image}</span>
                                : <img src={gear.image} className="w-full h-full object-contain rounded-xl" alt="gear" />
                              }
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl bg-white/3 border border-white/[0.12] p-3 text-center">
                      <p className="text-[10px] text-white/22 font-medium">No gear — visit the shop</p>
                    </div>
                  )}

                  {/* Stats card */}
                  <div className="rounded-xl bg-black/50 border border-white/[0.12] p-4">
                    <p className="text-[10px] font-semibold text-white/25 uppercase mb-3">Raid Stats</p>
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <div className="text-center">
                        <p className="text-[9px] text-white/28 mb-1 font-medium">Mult</p>
                        <p className="font-bold text-[#FFB800] text-lg leading-none">{totalMult}×</p>
                      </div>
                      <div className="text-center border-x border-white/5">
                        <p className="text-[9px] text-white/28 mb-1 font-medium">Risk</p>
                        <p className="font-bold text-cyan-400 text-lg leading-none">-{totalRisk}%</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[9px] text-white/28 mb-1 font-medium">Time</p>
                        <p className="font-bold text-purple-400 text-lg leading-none">{totalTime}s</p>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[9px] font-semibold mb-1.5">
                        <span className="text-white/28">Power</span>
                        <span className={powerScore >= 50 ? 'text-[#FFB800]' : powerScore >= 25 ? 'text-amber-400' : 'text-red-400'}>
                          {powerScore >= 50 ? 'Strong' : powerScore >= 25 ? 'Moderate' : 'Weak'} · {powerScore}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-500 ${powerScore >= 50 ? 'bg-[#FFB800]' : powerScore >= 25 ? 'bg-amber-400' : 'bg-red-400'}`}
                          style={{ width: `${powerScore}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Modal footer ── */}
            <div className="shrink-0 border-t border-white/5 p-4 sm:p-5 bg-[#060612] rounded-b-3xl sm:rounded-b-2xl space-y-3">

              {/* Currency selector */}
              <div>
                <p className="text-[10px] font-semibold text-white/28 uppercase tracking-wider mb-2">Pay with</p>
                <div className="grid grid-cols-3 gap-2">
                  {([Currency.SOL, Currency.USDC, Currency.SKR] as Currency[]).map(c => {
                    const bal = c === Currency.SOL ? walletBalance : c === Currency.USDC ? usdcBalance : skrBalance;
                    const sym = c === Currency.SOL ? 'SOL' : c === Currency.USDC ? 'USDC' : 'SKR';
                    const colActive = c === Currency.SOL
                      ? 'border-[#FFB800]/45 bg-[#FFB800]/8 text-[#FFB800]'
                      : c === Currency.USDC
                      ? 'border-blue-400/45 bg-blue-400/8 text-blue-400'
                      : 'border-orange-400/45 bg-orange-400/8 text-orange-400';
                    const active = entryCurrency === c;
                    return (
                      <button key={c} onClick={() => setCurrency(c)}
                        className={`py-2.5 rounded-xl border-2 transition-all text-center ${active ? colActive : 'border-white/7 text-white/35 bg-white/3 hover:border-white/18'}`}>
                        <p className="text-[10px] font-semibold">{sym}</p>
                        <p className="text-[9px] text-white/40 mt-0.5 font-medium">{bal.toFixed(c === Currency.SKR ? 0 : 2)}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Ticket toggle */}
              {raidTickets > 0 && (
                <button onClick={() => setUseTicket(p => !p)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${applyTicket ? 'border-amber-500/40 bg-amber-500/8' : 'border-white/[0.12] bg-white/3'}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-base">🎟️</span>
                    <div>
                      <p className={`text-xs font-semibold ${applyTicket ? 'text-amber-400' : 'text-white/45'}`}>Use ticket — 50% off</p>
                      <p className="text-[9px] text-white/25 font-medium">{raidTickets}x left</p>
                    </div>
                  </div>
                  <div className={`w-9 h-5 rounded-full transition-all relative ${applyTicket ? 'bg-amber-500' : 'bg-white/15'}`}>
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all shadow ${applyTicket ? 'left-[18px]' : 'left-0.5'}`} />
                  </div>
                </button>
              )}

              {/* Cost + deploy */}
              <div className="flex items-center gap-3">
                <div className="shrink-0">
                  <p className="text-[9px] text-white/28 font-semibold uppercase mb-0.5">Entry cost</p>
                  <p className="text-xl font-bold text-white leading-none">
                    {pricesLoading
                      ? <span className="text-white/28 text-sm animate-pulse">…</span>
                      : <>{totalDisplay.toFixed(curDecimals)}<span className={`text-sm ml-1 font-semibold ${entryCurrency === Currency.SOL ? 'text-white/60' : entryCurrency === Currency.USDC ? 'text-blue-400' : 'text-orange-400'}`}>{curSymbol}</span></>
                    }
                  </p>
                  {applyTicket && <p className="text-[9px] text-amber-400 font-semibold mt-0.5">Ticket applied</p>}
                  {!pricesLoading && currentBalance < totalDisplay && totalCostSol > 0 && (
                    <p className="text-[9px] text-red-400 font-semibold mt-0.5">Insufficient funds</p>
                  )}
                </div>
                <button onClick={handleDeploy}
                  disabled={pricesLoading || (totalCostSol > 0 && currentBalance < totalDisplay)}
                  className="flex-1 py-3.5 rounded-xl font-bold text-sm active:scale-[0.98] transition-all disabled:opacity-35 disabled:cursor-not-allowed disabled:active:scale-100"
                  style={{
                    background: 'linear-gradient(135deg, #FF2929 0%, #CC0000 100%)',
                    color: '#fff',
                    boxShadow: '0 0 20px rgba(255,41,41,0.30)',
                    ...BN,
                    fontSize: '15px',
                  }}
                >
                  DEPLOY
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LobbyScreen;
