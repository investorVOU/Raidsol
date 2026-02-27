
import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
  onEnterRaid: (mode: Mode, difficulty?: Difficulty, boosts?: string[], currency?: Currency, useTicket?: boolean, customFeeOverride?: number) => Promise<void> | void;
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
  onNavigateBounty?: () => void;
  onNavigateRoast?: () => void;
  onNavigateBriefing?: () => void;
  onEnterRound?: (difficulty: Difficulty, boosts: string[], currency: Currency) => Promise<void>;
  onRequestFullscreen?: () => void;
  raidTickets?: number;
  lastFreeRaidDate?: string | null;
  drillCount?: number;
  drillWindowStart?: number;
  currencyRates?: LivePrices['currencyRates'];
  pricesFailed?: boolean;
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
  onToggleGear, onNavigateTreasury, onNavigateStore, onNavigateBounty, onNavigateRoast, onNavigateBriefing, onEnterRound, onRequestFullscreen,
  raidTickets = 0, lastFreeRaidDate = null,
  drillCount = 0, drillWindowStart = 0,
  currencyRates, pricesFailed = false, currentRound,
}) => {
  const { t } = useTranslation();
  const rates = currencyRates ?? { [Currency.SOL]: 1, [Currency.USDC]: 0, [Currency.SKR]: 0 };
  // Normal raid modal
  const [showModal, setShowModal]           = useState(false);
  const [selectedDifficulty, setDifficulty] = useState<Difficulty>(Difficulty.MEDIUM);
  const [selectedBoosts, setBoosts]         = useState<string[]>([]);
  const [selectedMode, setMode]             = useState<Mode>(Mode.SOLO);
  const [entryCurrency, setCurrency]        = useState<Currency>(Currency.SOL);
  const [isDeploying, setIsDeploying]       = useState(false);
  const [useTicket, setUseTicket]           = useState(false);
  const [customFee, setCustomFee]           = useState<number | null>(null);

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

  // customFee is in the display currency — reset when currency changes so stale values don't carry over
  useEffect(() => { setCustomFee(null); }, [entryCurrency]);


  // Drill cap
  const drillWindowExpired = (Date.now() - drillWindowStart) >= 6 * 60 * 60 * 1000;
  const drillsRemaining    = Math.max(0, 3 - (drillWindowExpired ? 0 : drillCount));
  const drillCapHit        = isConnected && drillsRemaining === 0;


  const handleOpenModal = () => { setBoosts([]); setUseTicket(false); setCustomFee(null); setShowModal(true); };

  const handleDeploy = async () => {
    onRequestFullscreen?.(); // must be called synchronously before any await
    setShowModal(false);
    setIsDeploying(true);
    try {
      await onEnterRaid(selectedMode, selectedDifficulty, selectedBoosts, entryCurrency, useTicket && raidTickets > 0, effectiveBase > minEntryFee ? effectiveBase : undefined);
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

  // Cost calc — customFee is typed in the selected currency; converted to SOL for internal math
  const minEntryFee    = ENTRY_FEES[selectedMode];
  const currencyRate   = rates[entryCurrency];
  const curSymbol      = entryCurrency === Currency.SOL ? 'SOL' : entryCurrency === Currency.USDC ? 'USDC' : 'SKR';
  const curDecimals    = entryCurrency === Currency.SOL ? 3 : entryCurrency === Currency.USDC ? 2 : 0;
  const currentBalance = entryCurrency === Currency.SOL ? walletBalance : entryCurrency === Currency.USDC ? usdcBalance : skrBalance;
  const rateReady      = entryCurrency === Currency.SOL || currencyRate > 0;
  const displayRate    = currencyRate > 0 ? currencyRate : 1;
  const minEntryDisplay = minEntryFee * displayRate;
  // customFee stored in display currency → convert back to SOL for game math
  const customFeeSol   = customFee !== null && rateReady ? customFee / displayRate : null;
  const effectiveBase  = customFeeSol !== null && customFeeSol >= minEntryFee ? customFeeSol : minEntryFee;
  const applyTicket    = useTicket && raidTickets > 0;
  const entryFee       = applyTicket ? effectiveBase * 0.5 : effectiveBase;
  const boostCost      = selectedBoosts.reduce((s, id) => s + (RAID_BOOSTS.find(b => b.id === id)?.cost ?? 0), 0);
  const totalCostSol   = entryFee + boostCost;
  const totalDisplay   = totalCostSol * displayRate;
  const insufficientBal = rateReady && totalCostSol > 0 && currentBalance < totalDisplay;

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
              {t('lobby.tagline')}
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
                {isConnected ? t('lobby.readyToDeploy') : t('lobby.connectToStart')}
              </p>
              <p className="text-white leading-none" style={{ ...BC, fontSize: '32px', letterSpacing: '-0.5px' }}>{t('lobby.enterRaid')}</p>
              <p className="text-white/50 mt-0.5 text-[11px]" style={INTER}>{t('lobby.winSol')}</p>
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
              {/* Top row: title + live standings */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[9px] px-2 py-0.5 rounded-full text-[#FF2929]/80 uppercase tracking-wider"
                      style={{ background: 'rgba(255,41,41,0.12)', border: '1px solid rgba(255,41,41,0.20)', ...INTER, fontWeight: 500 }}>
                      Round {currentRound.roundNum} / 4
                    </span>
                    <span className="text-[9px] text-white/35" style={INTER}>{dayLabel}</span>
                  </div>
                  <p className="leading-none" style={{ ...BN, fontSize: '22px', color: '#fff', letterSpacing: '1.5px' }}>RAID ROUND</p>
                  <p className="text-[10px] text-white/40 mt-0.5" style={{ ...INTER, fontWeight: 400 }}>
                    Top 5 earn prizes — fight for your rank
                  </p>
                </div>
                {/* Live mini-leaderboard */}
                <div className="shrink-0 ml-4 min-w-[96px]">
                  <div className="flex items-center justify-end gap-1 mb-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#FF2929] animate-pulse" />
                    <span className="text-[8px] font-bold text-[#FF2929]/80 uppercase tracking-wider" style={INTER}>Live</span>
                  </div>
                  {currentRound.currentLeaders.slice(0, 3).map((leader, i) => (
                    <div key={i} className="flex items-center gap-1.5 justify-end mb-0.5">
                      <span className="text-[8px] text-white/25 shrink-0" style={INTER}>{['1st','2nd','3rd'][i]}</span>
                      <span className="text-[9px] font-semibold text-white/50 truncate max-w-[52px]" style={INTER}>{leader.username}</span>
                      <span className="text-[9px] font-black tabular-nums shrink-0" style={{ ...SG_NUM, color: i === 0 ? '#FFB800' : i === 1 ? '#C0C0C0' : '#CD7F32' }}>
                        {leader.pointsScored.toLocaleString()}
                      </span>
                    </div>
                  ))}
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
            onClick={() => onNavigateBounty?.()}
            className="relative overflow-hidden rounded-xl p-3 text-left transition-all active:scale-[0.97]"
            style={{ background: 'rgba(255,41,41,0.06)', border: '1px solid rgba(255,41,41,0.22)' }}
          >
            <div className="absolute top-2.5 right-2.5">
              <i className="fa-solid fa-crosshairs text-[#FF2929]/50 text-base" />
            </div>
            <p className="text-[9px] text-white/40 mb-1 uppercase tracking-wider" style={INTER}>Earn SR</p>
            <p className="leading-none mb-1" style={{ ...BN, fontSize: '22px', color: '#FF2929', letterSpacing: '1.5px' }}>BOUNTIES</p>
            <p className="text-[10px] text-white/45" style={{ ...INTER, fontWeight: 400 }}>Tasks · Challenges</p>
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

        {/* ── FREE DRILL — temporarily disabled ── */}
        <button
          disabled
          className="w-full rounded-xl p-3 text-left opacity-40 cursor-not-allowed"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)' }}
        >
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="leading-none" style={{ ...BN, fontSize: '16px', color: 'rgba(255,255,255,0.35)', letterSpacing: '1.5px' }}>FREE DRILL</p>
              <p className="text-[10px] text-white/35 mt-0.5" style={{ ...INTER, fontWeight: 400 }}>Temporarily unavailable</p>
            </div>
            <i className="fa-solid fa-chevron-right text-white/25 text-xs shrink-0" />
          </div>
        </button>

        {/* ── WALLET ROAST + DAILY BRIEFING ── */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onNavigateRoast?.()}
            className="relative overflow-hidden rounded-xl p-3 text-left active:scale-[0.97] transition-all"
            style={{ background: 'rgba(255,41,41,0.05)', border: '1px solid rgba(255,41,41,0.22)' }}
          >
            <p className="text-[9px] text-white/40 mb-1 uppercase tracking-wider" style={INTER}>On-chain</p>
            <p className="leading-none mb-1" style={{ ...BN, fontSize: '20px', color: '#FF2929', letterSpacing: '1.5px' }}>WALLET ROAST</p>
            <p className="text-[10px] text-white/45" style={{ ...INTER, fontWeight: 400 }}>Share the burn</p>
          </button>

          <button
            onClick={() => onNavigateBriefing?.()}
            className="relative overflow-hidden rounded-xl p-3 text-left active:scale-[0.97] transition-all"
            style={{ background: 'rgba(255,184,0,0.05)', border: '1px solid rgba(255,184,0,0.20)' }}
          >
            <p className="text-[9px] text-white/40 mb-1 uppercase tracking-wider" style={INTER}>Daily</p>
            <p className="leading-none mb-1" style={{ ...BN, fontSize: '20px', color: '#FFB800', letterSpacing: '1.5px' }}>THE BRIEFING</p>
            <p className="text-[10px] text-white/45" style={{ ...INTER, fontWeight: 400 }}>Cipher · +SR reward</p>
          </button>
        </div>

        {/* ── X (Twitter) follow button ── */}
        <a
          href="https://x.com/solraid_app"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl active:scale-[0.98] transition-all duration-150"
          style={{ background: 'rgba(255,255,255,0.07)', border: '1.5px solid rgba(255,255,255,0.15)' }}
        >
          <i className="fa-brands fa-x-twitter text-[15px] text-white" />
          <span className="text-[12px] font-semibold text-white" style={INTER}>Follow us on X</span>
        </a>

        {!isConnected && (
          <div className="rounded-xl bg-white/3 border border-white/7 px-4 py-3 text-center">
            <p className="text-xs text-white/35 font-medium">{t('lobby.connectWalletStart')}</p>
          </div>
        )}
      </div>

      {/* ── LOADING OVERLAY ── */}
      {isDeploying && (
        <div className="fixed inset-0 z-[200] bg-black/90 flex flex-col items-center justify-center p-8" style={INTER}>
          <i className="fa-solid fa-person-running text-[#FF2929] text-3xl mb-5" />
          <p className="text-white text-base font-medium mb-1">{t('lobby.waitingSignature')}</p>
          <p className="text-white/35 text-sm">{t('lobby.approveWallet')}</p>
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
                <h2 className="text-base font-semibold text-white">{t('lobby.faq.title')}</h2>
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
            style={{ borderColor: 'rgba(255,41,41,0.25)', ...SG }}
          >
            {/* Drag handle */}
            <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-white/15" />
            </div>

            {/* Header */}
            <div className="shrink-0 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,41,41,0.18)', border: '1px solid rgba(255,41,41,0.30)' }}>
                  <i className="fa-solid fa-trophy" style={{ color: '#FF2929', fontSize: '15px' }} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-black text-white">Raid Round</h2>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,41,41,0.18)', color: '#FF4444', border: '1px solid rgba(255,41,41,0.25)' }}>
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

              {/* Battle standings banner */}
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,41,41,0.22)' }}>
                {/* Header row */}
                <div className="flex items-center justify-between px-4 pt-3 pb-2"
                  style={{ background: 'linear-gradient(135deg, rgba(255,41,41,0.12) 0%, rgba(20,20,40,0.0) 100%)' }}>
                  <div className="flex items-center gap-2">
                    <i className="fa-solid fa-ranking-star text-[#FF2929]/70 text-sm" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/70" style={SG}>Battle Standings</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#FF2929' }} />
                    <p className="text-[10px] font-bold tabular-nums text-white/55" style={SG_NUM}>{formatCountdown(currentRound.timeRemainingMs)}</p>
                  </div>
                </div>

                {/* Rank rows */}
                <div className="px-3 pb-3 space-y-1.5">
                  {[
                    { rank: 1, pct: 40, color: '#FFD700',           label: '1st' },
                    { rank: 2, pct: 25, color: '#C0C0C0',           label: '2nd' },
                    { rank: 3, pct: 18, color: '#CD7F32',           label: '3rd' },
                    { rank: 4, pct: 11, color: 'rgba(255,255,255,0.35)', label: '4th' },
                    { rank: 5, pct:  6, color: 'rgba(255,255,255,0.20)', label: '5th' },
                  ].map(({ rank, pct, color, label }) => {
                    const entry = currentRound.currentLeaders.find(e => e.rank === rank);
                    const topScore = currentRound.currentLeaders[0]?.pointsScored ?? 0;
                    const barWidth = entry && topScore > 0 ? Math.max(6, Math.round((entry.pointsScored / topScore) * 100)) : 0;
                    return (
                      <div key={rank} className="flex items-center gap-2.5">
                        {/* Rank badge */}
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-black"
                          style={{ background: entry ? `${color}18` : 'rgba(255,255,255,0.04)', border: `1px solid ${entry ? `${color}40` : 'rgba(255,255,255,0.08)'}`, color: entry ? color : 'rgba(255,255,255,0.2)' }}>
                          {label}
                        </div>
                        {/* Name + score bar */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[10px] font-semibold truncate" style={{ ...INTER, color: entry ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.18)' }}>
                              {entry ? entry.username : '— open slot —'}
                            </span>
                            <span className="text-[9px] font-black tabular-nums ml-2 shrink-0" style={{ color: entry ? color : 'rgba(255,255,255,0.15)', fontFamily: "'Space Grotesk', sans-serif" }}>
                              {entry ? entry.pointsScored.toLocaleString() + ' pts' : ''}
                            </span>
                          </div>
                          <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-700"
                              style={{ width: entry ? `${barWidth}%` : '0%', background: color, opacity: 0.7 }} />
                          </div>
                        </div>
                        {/* Prize pct */}
                        <span className="text-[9px] font-bold shrink-0 w-8 text-right tabular-nums" style={{ color: entry ? color : 'rgba(255,255,255,0.18)', fontFamily: "'Space Grotesk', sans-serif" }}>
                          {pct}%
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Footer note */}
                <div className="px-4 py-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.2)' }}>
                  <p className="text-[8px] text-white/25 text-center" style={INTER}>
                    Top 5 scores share the prize pool · Winners announced after round closes
                  </p>
                </div>
              </div>

              {/* How it works */}
              <div className="rounded-xl bg-white/3 border border-white/7 px-4 py-3 space-y-1">
                <p className="text-[9px] text-white/30 uppercase tracking-wider font-medium mb-2">How it works</p>
                {[
                  'Pay an entry fee to compete — 70% goes straight into the prize pool',
                  'Score as many points as possible during your raid',
                  'Your highest score this round is tracked on the live leaderboard',
                  'Round closes every 6 hours — top 5 scores split the pool',
                  'Prizes: 1st 40% · 2nd 25% · 3rd 18% · 4th 11% · 5th 6%',
                ].map((line, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-[9px] font-bold shrink-0 mt-0.5" style={{ color: '#FF2929' }}>{i + 1}.</span>
                    <p className="text-[10px] text-white/45 font-medium leading-snug">{line}</p>
                  </div>
                ))}
              </div>

              {/* ── Battle Tools (gear + boosts) ── */}
              <section>
                <p className="text-[9px] text-white/30 uppercase tracking-wider mb-2" style={{ ...INTER, fontWeight: 600 }}>Battle Tools</p>
                {/* Gear quick-swap */}
                <div className="rounded-xl p-3 mb-2" style={{ background: 'rgba(255,41,41,0.04)', border: '1px solid rgba(255,41,41,0.14)' }}>
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
                            className={`w-10 h-10 rounded-xl border-2 transition-all flex items-center justify-center active:scale-95 ${isEquipped ? 'border-[#FF2929]/50 bg-[#FF2929]/10' : 'border-white/[0.12] hover:border-white/22 bg-white/3'}`}>
                            {gear.image && !gear.image.startsWith('http')
                              ? <span className="text-lg leading-none">{gear.image}</span>
                              : <img src={gear.image} className="w-full h-full object-contain rounded-xl" alt="gear" />
                            }
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[10px] text-white/22 text-center py-1" style={INTER}>{t('lobby.noGearStore')}</p>
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
                  <p className="text-[9px] text-white/28 font-semibold uppercase mb-0.5">{t('lobby.entryTotal')}</p>
                  <p className="text-xl font-bold text-white leading-none">
                    {roundPricesLoading
                      ? <span className="text-white/28 text-sm animate-pulse">{t('common.loading')}</span>
                      : <>{roundTotalDisplay.toFixed(roundCurDecimals)}<span className={`text-sm ml-1 font-semibold ${roundCurrency === Currency.SOL ? 'text-white/60' : roundCurrency === Currency.USDC ? 'text-blue-400' : 'text-orange-400'}`}>{roundCurSymbol}</span></>
                    }
                  </p>
                  {!roundPricesLoading && roundBalance < roundTotalDisplay && (
                    <p className="text-[9px] text-red-400 font-semibold mt-0.5">{t('common.insufficient')}</p>
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
                <h2 className="text-base font-semibold text-white">{t('lobby.configureRaid')}</h2>
              </div>
              <button onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all">
                <i className="fa-solid fa-xmark text-sm" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="relative flex-1 min-h-0">
            {/* Gradient fade — mobile scroll hint */}
            <div className="sm:hidden pointer-events-none absolute bottom-0 left-0 right-0 h-10 z-10"
              style={{ background: 'linear-gradient(to top, #080814 0%, transparent 100%)' }} />
            <div className="h-full overflow-y-auto p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">

                {/* ── Left col: settings ── */}
                <div className="space-y-5">

                  {/* Mode */}
                  <section>
                    <p className="text-[10px] font-semibold text-white/35 uppercase tracking-wider mb-2">{t('lobby.mode')}</p>
                    <div className="space-y-2">
                      {[
                        { mode: Mode.SOLO,       label: 'Solo',       desc: 'Play alone',        icon: 'fa-user',   locked: false             },
                        { mode: Mode.TEAM,       label: 'Squad',      desc: '4-player team',     icon: 'fa-users',  locked: currentLevel < 5  },
                        { mode: Mode.TOURNAMENT, label: 'Tournament', desc: 'Compete for glory', icon: 'fa-trophy', locked: currentLevel < 15 },
                      ].map(({ mode, label, desc, icon, locked }) => (
                        <button key={mode} onClick={() => { if (!locked) { setMode(mode); setCustomFee(null); } }} disabled={locked}
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
                    <p className="text-[10px] font-semibold text-white/35 uppercase tracking-wider mb-2">{t('lobby.difficulty')}</p>
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
                    <p className="text-[10px] font-semibold text-white/35 uppercase tracking-wider mb-2">{t('lobby.boosts')}</p>
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
                    <p className="text-[10px] font-semibold text-white/35 uppercase tracking-wider">{t('lobby.loadout')}</p>
                    <span className="text-[10px] text-white/25 font-medium">{t('lobby.gearSlots', { count: equippedGear.length })}</span>
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
                      <p className="text-[10px] font-semibold text-white/25 uppercase mb-2">{t('lobby.quickSwap')}</p>
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
                      <p className="text-[10px] text-white/22 font-medium">{t('lobby.noGearShop')}</p>
                    </div>
                  )}

                  {/* Stats card */}
                  <div className="rounded-xl bg-black/50 border border-white/[0.12] p-4">
                    <p className="text-[10px] font-semibold text-white/25 uppercase mb-3">{t('lobby.raidStats')}</p>
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <div className="text-center">
                        <p className="text-[9px] text-white/28 mb-1 font-medium">{t('lobby.mult')}</p>
                        <p className="font-bold text-[#FFB800] text-lg leading-none">{totalMult}×</p>
                      </div>
                      <div className="text-center border-x border-white/5">
                        <p className="text-[9px] text-white/28 mb-1 font-medium">{t('lobby.risk')}</p>
                        <p className="font-bold text-cyan-400 text-lg leading-none">-{totalRisk}%</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[9px] text-white/28 mb-1 font-medium">{t('lobby.time')}</p>
                        <p className="font-bold text-purple-400 text-lg leading-none">{totalTime}s</p>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[9px] font-semibold mb-1.5">
                        <span className="text-white/28">{t('lobby.power')}</span>
                        <span className={powerScore >= 50 ? 'text-[#FFB800]' : powerScore >= 25 ? 'text-amber-400' : 'text-red-400'}>
                          {powerScore >= 50 ? t('lobby.strong') : powerScore >= 25 ? t('lobby.moderate') : t('lobby.weak')} · {powerScore}
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
            </div>{/* end scroll wrapper */}

            {/* ── Modal footer ── */}
            <div className="shrink-0 border-t border-white/5 p-3 sm:p-4 bg-[#060612] rounded-b-3xl sm:rounded-b-2xl space-y-2">

              {/* ── Pay With — each pill shows currency, your cost, and balance ── */}
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-semibold text-white/28 uppercase tracking-wider shrink-0">{t('lobby.payWith')}</span>
                <div className="flex gap-1.5 flex-1">
                  {([Currency.SOL, Currency.USDC, Currency.SKR] as Currency[]).map(c => {
                    const cBal    = c === Currency.SOL ? walletBalance : c === Currency.USDC ? usdcBalance : skrBalance;
                    const cSym    = c === Currency.SOL ? 'SOL' : c === Currency.USDC ? 'USDC' : 'SKR';
                    const cRate   = rates[c];
                    const cDec    = c === Currency.SOL ? 3 : c === Currency.USDC ? 2 : 0;
                    const cCost   = cRate > 0 ? totalCostSol * cRate : null;
                    const isLoading  = c !== Currency.SOL && cRate === 0 && !pricesFailed;
                    const isFailed   = c !== Currency.SOL && cRate === 0 && pricesFailed;
                    const isActive   = entryCurrency === c;
                    const colActive  = c === Currency.SOL
                      ? 'border-[#FFB800]/50 bg-[#FFB800]/10 text-[#FFB800]'
                      : c === Currency.USDC ? 'border-blue-400/50 bg-blue-400/10 text-blue-400'
                      : 'border-orange-400/50 bg-orange-400/10 text-orange-400';
                    return (
                      <button key={c}
                        onClick={() => !isFailed && setCurrency(c)}
                        disabled={isFailed}
                        className={`flex-1 flex flex-col items-center gap-0.5 py-2 rounded-lg border transition-all ${
                          isFailed   ? 'opacity-25 cursor-not-allowed border-white/5 bg-white/[0.02]'
                          : isActive ? colActive
                          : 'border-white/7 text-white/30 bg-white/3 hover:border-white/18'
                        }`}>
                        <span className="text-[10px] font-bold leading-none">{cSym}</span>
                        <span className={`text-[9px] font-semibold leading-none tabular-nums ${isLoading ? 'animate-pulse text-white/25' : ''}`}>
                          {isLoading ? '···' : isFailed ? 'N/A' : cCost !== null ? cCost.toFixed(cDec) : '—'}
                        </span>
                        <span className="text-[8px] text-white/22 leading-none tabular-nums">{cBal.toFixed(cDec)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── Stake Amount card — prominent, clearly editable ── */}
              {selectedMode === Mode.SOLO && (
                <div className="rounded-lg border border-white/[0.12] bg-white/[0.03] overflow-hidden">
                  {/* Header row */}
                  <div className="flex items-center justify-between px-3 pt-2 pb-1">
                    <div className="flex items-center gap-1.5">
                      <i className="fa-solid fa-fire-flame-curved text-[#FF2929]/70 text-[10px]" />
                      <span className="text-[9px] font-bold text-white/50 uppercase tracking-wider">Stake Amount</span>
                    </div>
                    <span className="text-[8px] text-white/25 font-medium">higher stake = bigger win</span>
                  </div>
                  {/* Input row */}
                  {rateReady ? (
                    <div className="flex items-center gap-2 px-3 pb-2">
                      <input
                        type="number"
                        min={minEntryDisplay}
                        step={curDecimals === 0 ? 1 : curDecimals === 2 ? 0.01 : 0.001}
                        value={customFee !== null ? customFee : ''}
                        placeholder={minEntryDisplay.toFixed(curDecimals)}
                        onChange={e => {
                          const v = parseFloat(e.target.value);
                          setCustomFee(isNaN(v) ? null : v);
                        }}
                        className="flex-1 bg-transparent text-white text-xl font-bold outline-none placeholder-white/20 tabular-nums min-w-0"
                        style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                      />
                      <span className={`text-sm font-bold shrink-0 ${entryCurrency === Currency.SOL ? 'text-white/50' : entryCurrency === Currency.USDC ? 'text-blue-400/70' : 'text-orange-400/70'}`}>
                        {curSymbol}
                      </span>
                      <i className="fa-solid fa-pen text-white/20 text-[9px] shrink-0" />
                    </div>
                  ) : (
                    <div className="px-3 pb-2">
                      <span className="text-[10px] text-white/20 animate-pulse">fetching {curSymbol} rate…</span>
                    </div>
                  )}
                  {/* Hints */}
                  {rateReady && (
                    <div className="flex items-center justify-between px-3 pb-2">
                      {customFee !== null && customFee < minEntryDisplay
                        ? <span className="text-[8px] text-red-400 font-semibold">min {minEntryDisplay.toFixed(curDecimals)} {curSymbol}</span>
                        : <span className="text-[8px] text-white/20">min {minEntryDisplay.toFixed(curDecimals)} {curSymbol}</span>
                      }
                      {customFee !== null && customFee >= minEntryDisplay && (
                        <span className="text-[8px] text-[#FFB800]/50 font-semibold">
                          max win ~{(effectiveBase * 5.7 * displayRate).toFixed(curDecimals)} {curSymbol}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Ticket toggle — compact */}
              {raidTickets > 0 && (
                <button onClick={() => setUseTicket(p => !p)}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg border transition-all ${applyTicket ? 'border-amber-500/40 bg-amber-500/8' : 'border-white/[0.10] bg-white/3'}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">🎟️</span>
                    <div>
                      <p className={`text-[10px] font-semibold ${applyTicket ? 'text-amber-400' : 'text-white/45'}`}>{t('lobby.useTicket')}</p>
                      <p className="text-[8px] text-white/25 font-medium">{t('lobby.ticketsLeft', { count: raidTickets })}</p>
                    </div>
                  </div>
                  <div className={`w-8 h-4 rounded-full transition-all relative ${applyTicket ? 'bg-amber-500' : 'bg-white/15'}`}>
                    <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all shadow ${applyTicket ? 'left-[18px]' : 'left-0.5'}`} />
                  </div>
                </button>
              )}

              {/* Cost + deploy */}
              <div className="flex items-center gap-3">
                <div className="shrink-0">
                  <p className="text-[9px] text-white/28 font-semibold uppercase mb-0.5">{t('lobby.entryTotal')}</p>
                  <p className="text-xl font-bold text-white leading-none">
                    {rateReady
                      ? <>{totalDisplay.toFixed(curDecimals)}<span className={`text-sm ml-1 font-semibold ${entryCurrency === Currency.SOL ? 'text-white/60' : entryCurrency === Currency.USDC ? 'text-blue-400' : 'text-orange-400'}`}>{curSymbol}</span></>
                      : <span className="text-white/25 text-sm animate-pulse">···</span>
                    }
                  </p>
                  {applyTicket && <p className="text-[9px] text-amber-400 font-semibold mt-0.5">{t('lobby.ticketApplied')}</p>}
                  {insufficientBal && (
                    <p className="text-[9px] text-red-400 font-semibold mt-0.5">{t('common.insufficient')}</p>
                  )}
                </div>
                <button onClick={handleDeploy}
                  disabled={!rateReady || insufficientBal || (customFee !== null && customFee < minEntryFee)}
                  className="flex-1 py-3 rounded-xl font-bold text-sm active:scale-[0.98] transition-all disabled:opacity-35 disabled:cursor-not-allowed disabled:active:scale-100"
                  style={{
                    background: 'linear-gradient(135deg, #FF2929 0%, #CC0000 100%)',
                    color: '#fff',
                    boxShadow: '0 0 20px rgba(255,41,41,0.30)',
                    ...BN,
                    fontSize: '15px',
                  }}
                >
                  {t('lobby.deploy')}
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
