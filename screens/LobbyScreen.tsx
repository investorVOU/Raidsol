
import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../components/ThemeContext';
import { Mode, Difficulty, GEAR_ITEMS, RAID_BOOSTS, AVATAR_ITEMS, Currency, RaidTier, RAID_TIER_CONFIG, RAID_TIER_ALLOCATION, ROUND_MIN_PARTICIPANTS, DailyBountyDef } from '../types';
import type { LivePrices } from '../hooks/usePrices';
import type { CurrentRoundInfo } from '../hooks/useRoundData';
import { formatCountdown, formatRoundWindow } from '../hooks/useRoundData';
import { useActivityFeed } from '../hooks/useActivityFeed';

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
  onOpenSuggestions?: () => void;
  onEnterRound?: (difficulty: Difficulty, boosts: string[], currency: Currency, tier: RaidTier, useTicket?: boolean) => Promise<void>;
  onRequestFullscreen?: () => void;
  raidTickets?: number;
  lastFreeRaidDate?: string | null;
  drillCount?: number;
  drillWindowStart?: number;
  currencyRates?: LivePrices['currencyRates'];
  pricesFailed?: boolean;
  currentRound?: CurrentRoundInfo | null;
  dailyStreak?: number;
  todayBounty?: DailyBountyDef | null;
  bountyClaimed?: boolean;
}

const DIFF_CONFIG = {
  [Difficulty.EASY]:   { label: 'Easy',     emoji: '🔵', color: 'text-sky-400',    ring: 'border-sky-500/40',     bg: 'bg-sky-500/10',    mult: '0.8×' },
  [Difficulty.MEDIUM]: { label: 'Standard', emoji: '🔵', color: 'text-cyan-400',   ring: 'border-cyan-500/40',    bg: 'bg-cyan-500/10',   mult: '1.0×' },
  [Difficulty.HARD]:   { label: 'Hardcore', emoji: '🟠', color: 'text-orange-400', ring: 'border-orange-500/40',  bg: 'bg-orange-500/10', mult: '1.4×' },
  [Difficulty.DEGEN]:  { label: 'Degen',    emoji: '🔴', color: 'text-[#9945FF]',    ring: 'border-[#9945FF]/40',     bg: 'bg-[#9945FF]/10',    mult: '2.5×' },
};

const LobbyScreen: React.FC<LobbyScreenProps> = ({
  onEnterRaid, isConnected, onConnect, currentLevel,
  walletBalance, usdcBalance, skrBalance,
  equippedGearIds, equippedAvatarId, ownedItemIds,
  onToggleGear, onNavigateTreasury, onNavigateStore, onNavigateBounty, onNavigateRoast, onNavigateBriefing, onEnterRound, onRequestFullscreen, onOpenSuggestions,
  raidTickets = 0, lastFreeRaidDate = null,
  drillCount = 0, drillWindowStart = 0,
  currencyRates, pricesFailed = false, currentRound, dailyStreak = 0,
  todayBounty, bountyClaimed = false,
}) => {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const rates = currencyRates ?? { [Currency.SOL]: 1, [Currency.USDC]: 0, [Currency.SKR]: 0 };

  // Round raid modal
  const [showRoundModal, setShowRoundModal]     = useState(false);
  const [roundDifficulty, setRoundDifficulty]   = useState<Difficulty>(Difficulty.MEDIUM);
  const [roundCurrency, setRoundCurrency]       = useState<Currency>(Currency.SOL);
  const [roundBoosts, setRoundBoosts]           = useState<string[]>([]);
  const [roundTier, setRoundTier]               = useState<RaidTier>(RaidTier.GRUNT);
  const [roundUseTicket, setRoundUseTicket]     = useState(false);
  const [isDeploying, setIsDeploying]           = useState(false);
  const [toolsDisclaimerDismissed, setToolsDisclaimerDismissed] = useState(false);

  // FAQ
  const [showFaq, setShowFaq]                   = useState(false);
  // Recent wins ticker
  const { feed: activityFeed } = useActivityFeed();
  const winTicker = activityFeed.filter(e => e.event_type === 'EXTRACTED' && (e.amount_sol ?? 0) > 0);

  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);





  const handleEnterRound = async () => {
    onRequestFullscreen?.(); // must be called synchronously before any await
    setShowRoundModal(false);
    setIsDeploying(true);
    const applyRoundTicket = roundUseTicket && raidTickets > 0;
    try {
      if (onEnterRound) {
        await onEnterRound(roundDifficulty, roundBoosts, roundCurrency, roundTier, applyRoundTicket);
      } else {
        await onEnterRaid(Mode.SOLO, roundDifficulty, roundBoosts, roundCurrency, applyRoundTicket, RAID_TIER_CONFIG[roundTier].entryFee);
      }
    } finally {
      if (mountedRef.current) setIsDeploying(false);
    }
  };

  // Round cost calc — fee driven by selected tier; boost costs always in SOL; 50% ticket discount on entry only
  const applyRoundTicket   = roundUseTicket && raidTickets > 0;
  const roundFeeBase       = RAID_TIER_CONFIG[roundTier].entryFee;
  const roundBoostCostSol  = roundBoosts.reduce((s, id) => s + (RAID_BOOSTS.find(b => b.id === id)?.cost ?? 0), 0);
  const roundTotalSol      = (applyRoundTicket ? roundFeeBase * 0.5 : roundFeeBase) + roundBoostCostSol;
  const roundRate          = rates[roundCurrency];
  const roundPricesLoading = roundCurrency !== Currency.SOL && roundRate === 0;
  const roundTotalDisplay  = roundTotalSol * roundRate;
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

  const boostDrift  = roundBoosts.includes('risk_shield') ? 15 : 0;
  const boostMult   = roundBoosts.includes('score_mult')  ? 0.5 : 0;
  const totalMult   = (1.0 + gearStats.mult + boostMult).toFixed(2);
  const totalRisk   = gearStats.riskReduc + boostDrift;
  const totalTime   = 30 + gearStats.timeBoost;
  const powerScore  = Math.min(100, Math.round(gearStats.mult * 20 + gearStats.riskReduc * 1.5 + gearStats.timeBoost * 1.2 + boostDrift + boostMult * 15));


  // Day label for round banner
  const dayLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  return (
    <div className="w-full h-full flex flex-col relative overflow-hidden" style={{ ...INTER, backgroundColor: 'var(--app-bg)' }}>


      {/* ── HEADER ── */}
      <div className="relative z-10 shrink-0 px-4 pt-2 pb-1">
        <div className="flex items-center justify-between">
          <div>
            <p style={{ ...BN, fontSize: '28px', color: '#9945FF', letterSpacing: '2.5px', lineHeight: 1 }}>
              SOL RAID
            </p>
            <p className="text-[11px] text-white mt-0.5" style={{ ...INTER, fontWeight: 400 }}>
              Skill-based extraction · anyone can play
            </p>
          </div>
          {/* Suggestion box + FAQ buttons */}
          <div className="flex items-center gap-2 ml-3">
            {onOpenSuggestions && (
              <button
                onClick={onOpenSuggestions}
                title="Suggest a feature"
                className="flex items-center gap-1.5 px-3 h-9 rounded-full border active:scale-95 transition-all shrink-0"
                style={{
                  background: 'rgba(255,184,0,0.08)',
                  border: '1px solid rgba(255,184,0,0.35)',
                  touchAction: 'manipulation',
                }}
              >
                <i className="fa-solid fa-lightbulb" style={{ fontSize: '13px', color: '#FFB800' }} />
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '9px', fontWeight: 700, color: '#FFB800', letterSpacing: '1px', textTransform: 'uppercase' }}>
                  Suggest
                </span>
              </button>
            )}
            <button
              onClick={() => setShowFaq(true)}
              className="w-9 h-9 rounded-full bg-white/6 border border-white/[0.14] flex items-center justify-center text-white hover:text-white hover:bg-white/10 active:scale-95 transition-all shrink-0"
            >
              <i className="fa-solid fa-question text-sm" />
            </button>
          </div>
        </div>
      </div>

      {/* ── DAILY OPERATOR BONUS ── */}
      <div className="relative z-10 shrink-0 px-4 pb-1">
        <div className="flex items-center justify-between px-3 py-2 rounded-xl"
          style={{ background: 'rgba(255,184,0,0.08)', border: '1px solid rgba(255,184,0,0.22)' }}>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: '16px' }}>{dailyStreak >= 2 ? '🔥' : '⚡'}</span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider" style={{ color: '#FFB800' }}>
                Daily Operator Bonus
              </p>
              <p className="text-[10px] text-white mt-0.5">
                {dailyStreak >= 2
                  ? `${dailyStreak}-day streak · +${Math.min((dailyStreak - 1) * 10, 40)}% SR active`
                  : 'Come back tomorrow for +10% SR bonus'}
              </p>
            </div>
          </div>
          {dailyStreak >= 2 && (
            <span className="text-[11px] font-black px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,184,0,0.18)', color: '#FFB800' }}>
              +{Math.min((dailyStreak - 1) * 10, 40)}%
            </span>
          )}
        </div>
      </div>

      {/* ── DAILY BOUNTY ── */}
      {todayBounty && (
        <div className="relative z-10 shrink-0 px-4 pb-1">
          <div className="flex items-center justify-between px-3 py-2 rounded-xl"
            style={{ background: bountyClaimed ? 'rgba(20,241,149,0.06)' : 'rgba(153,69,255,0.08)', border: `1px solid ${bountyClaimed ? 'rgba(20,241,149,0.22)' : 'rgba(153,69,255,0.22)'}` }}>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded flex items-center justify-center shrink-0" style={{ background: bountyClaimed ? 'rgba(20,241,149,0.15)' : 'rgba(153,69,255,0.18)' }}>
                <i className={`fa-solid ${bountyClaimed ? 'fa-check' : 'fa-bolt'} text-[10px]`} style={{ color: bountyClaimed ? '#14F195' : '#9945FF' }} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider" style={{ color: bountyClaimed ? '#14F195' : '#9945FF' }}>
                  Daily Bounty · {todayBounty.label}
                </p>
                <p className="text-[10px] text-white mt-0.5" style={{ opacity: bountyClaimed ? 0.5 : 0.8 }}>
                  {bountyClaimed ? 'Completed — come back tomorrow' : todayBounty.task}
                </p>
              </div>
            </div>
            <span className="text-[11px] font-black px-2 py-0.5 rounded-full shrink-0" style={{
              background: bountyClaimed ? 'rgba(20,241,149,0.15)' : 'rgba(153,69,255,0.18)',
              color: bountyClaimed ? '#14F195' : '#9945FF',
            }}>
              {bountyClaimed ? '✓ DONE' : `+${todayBounty.reward} SR`}
            </span>
          </div>
        </div>
      )}

      {/* ── SCROLLABLE CONTENT ── */}
      {/* ── RECENT WINS TICKER ── */}
      {winTicker.length > 0 && (
        <div className="shrink-0 overflow-hidden border-y py-1" style={{ borderColor: 'rgba(20,241,149,0.12)', background: 'rgba(20,241,149,0.04)' }}>
          <div className="flex gap-6 whitespace-nowrap" style={{ animation: 'marquee 22s linear infinite' }}>
            {[...winTicker, ...winTicker].map((e, i) => {
              const ago = Math.round((Date.now() - new Date(e.created_at).getTime()) / 60000);
              const name = e.username?.length > 8 ? e.username.slice(0, 6) + '…' : (e.username || '???');
              return (
                <span key={i} className="text-[10px] font-bold" style={{ color: '#14F195' }}>
                  ⚡ {name} extracted {Number(e.amount_sol).toFixed(3)} SOL
                  <span className="text-white ml-1" style={{ opacity: 0.5 }}>{ago < 2 ? 'just now' : `${ago}m ago`}</span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      <div className="relative z-10 flex-1 overflow-y-auto scrollbar-hide px-4 pt-1 pb-44 md:pb-6 space-y-2">

        {/* ── RAID ROUND — Primary Hero CTA ── */}
        <button
          onClick={() => isConnected ? (setToolsDisclaimerDismissed(false), setRoundUseTicket(false), setShowRoundModal(true)) : onConnect()}
          className="w-full relative overflow-hidden rounded-2xl group active:scale-[0.97] transition-all duration-200"
          style={{
            background: 'linear-gradient(135deg, #6622BB 0%, #3d0099 50%, #6622BB 100%)',
            border: '1px solid rgba(160,21,21,0.50)',
            boxShadow: '0 2px 10px rgba(0,0,0,0.5)',
          }}
        >
          {/* Animated top scan-line — white on red */}
          <div className="absolute top-0 left-0 right-0 h-px pointer-events-none"
            style={{ background: 'linear-gradient(90deg,transparent 0%,rgba(255,255,255,0.8) 40%,rgba(255,255,255,0.8) 60%,transparent 100%)', animation: 'scanline 3s linear infinite', opacity: 0.5 }}
          />
          <style>{`@keyframes scanline{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}`}</style>

          <div className="relative z-10 px-5 pt-4 pb-3">
            {/* Top row */}
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-1.5 h-1.5 rounded-full bg-white" style={{ boxShadow: '0 0 6px rgba(255,255,255,0.8)', animation: 'pulse 1.5s ease-in-out infinite' }} />
                <p className="text-[10px] uppercase tracking-[3px] text-white" style={INTER}>
                  {isConnected
                    ? (currentRound ? `Round ${currentRound.roundNum} of 4 · ${dayLabel}` : `Active round · ${dayLabel}`)
                    : 'Connect to compete'}
                </p>
                {raidTickets > 0 && (
                  <span className="ml-auto text-[9px] font-bold bg-black/20 text-white rounded-full px-2 py-0.5 border border-white/25" style={INTER}>
                    🎟️ {raidTickets}×
                  </span>
                )}
              </div>
              <p className="leading-none" style={{ ...BN, fontSize: '36px', letterSpacing: '-0.5px', color: '#fff', textShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
                RAID ROUND
              </p>
              <p className="text-[10px] text-white mt-1" style={{ ...INTER, fontWeight: 400 }}>
                6h window · top 5 split the pot
              </p>
            </div>

            {/* Stats strip */}
            <div className="flex items-center gap-0 border-t border-white/20 pt-2.5">
              <>
                <div className="flex-1 text-center">
                  <p className="text-[8px] text-white uppercase tracking-wider mb-0.5" style={INTER}>Rounds/day</p>
                  <p className="text-[11px] font-black tabular-nums text-white" style={SG_NUM}>4</p>
                </div>
                <div className="flex-1 text-center">
                  <p className="text-[8px] text-white uppercase tracking-wider mb-0.5" style={INTER}>Prize pool</p>
                  <p className="text-[11px] font-black tabular-nums text-white" style={SG_NUM}>100%</p>
                </div>
                <div className="flex-1 text-center">
                  <p className="text-[8px] text-white uppercase tracking-wider mb-0.5" style={INTER}>
                    {currentRound ? 'Closes' : 'Window'}
                  </p>
                  <p className="text-[11px] font-black tabular-nums text-white" style={SG_NUM}>
                    {currentRound ? formatCountdown(currentRound.timeRemainingMs) : '6h'}
                  </p>
                </div>
              </>
              <div className="shrink-0 ml-2">
                <div className="rounded-lg px-3 py-1.5 flex items-center gap-1.5 group-hover:opacity-90 transition-opacity"
                  style={{ background: 'rgba(0,0,0,0.22)', border: '1px solid var(--border-col-str)' }}>
                  <i className="fa-solid fa-trophy text-white text-[10px]" />
                  <span style={{ ...BN, fontSize: '13px', color: '#fff', letterSpacing: '1.5px' }}>
                    {isConnected ? 'COMPETE' : 'CONNECT'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </button>
        {/* ── SECONDARY MODES ── */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => isConnected ? onEnterRaid(Mode.PVP, Difficulty.MEDIUM, []) : onConnect()}
            className="relative overflow-hidden rounded-xl p-3 text-left active:scale-[0.97] transition-all group"
            style={{ background: 'rgba(153,69,255,0.05)', border: '1px solid rgba(153,69,255,0.22)' }}
          >
            <div className="absolute top-2.5 right-2.5">
              <i className="fa-solid fa-swords text-[#9945FF]/60 text-lg" />
            </div>
            <p className="leading-none mb-1" style={{ ...BN, fontSize: '22px', color: '#9945FF', letterSpacing: '1.5px' }}>PVP DUEL</p>
            <p className="text-[10px] text-white" style={{ ...INTER, fontWeight: 400 }}>Stake · winner takes pot</p>
          </button>

          <button
            onClick={() => onNavigateBounty?.()}
            className="relative overflow-hidden rounded-xl p-3 text-left transition-all active:scale-[0.97]"
            style={{ background: 'rgba(153,69,255,0.06)', border: '1px solid rgba(153,69,255,0.22)' }}
          >
            <div className="absolute top-2.5 right-2.5">
              <i className="fa-solid fa-crosshairs text-[#9945FF]/50 text-base" />
            </div>
            <p className="leading-none mb-1" style={{ ...BN, fontSize: '22px', color: '#9945FF', letterSpacing: '1.5px' }}>BOUNTIES</p>
            <p className="text-[10px] text-white" style={{ ...INTER, fontWeight: 400 }}>Kill tasks · earn SR</p>
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
                  <p className="text-[10px] text-white mt-0.5" style={{ ...INTER, fontWeight: 400 }}>Half price entry · +10% winnings</p>
                </>
              ) : (
                <>
                  <p className="leading-none" style={{ ...BN, fontSize: '16px', color: '#FFB800', letterSpacing: '1.5px' }}>RAID PASS</p>
                  <p className="text-[10px] text-white mt-0.5" style={{ ...INTER, fontWeight: 400 }}>Half price entry · buy with SKR</p>
                </>
              )}
            </div>
            <i className="fa-solid fa-chevron-right text-[#FFB800]/50 text-xs shrink-0" />
          </div>
        </button>

        {/* ── FREE DEMO RAID — open to all, no wallet required ── */}
        <button
          onClick={() => onEnterRaid(Mode.DRILL, Difficulty.EASY, [], Currency.SOL, false, 0)}
          className="w-full rounded-xl p-3 text-left active:scale-[0.98] transition-all group"
          style={{ background: 'var(--card-bg)', border: '1px solid rgba(255,255,255,0.15)' }}
        >
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="leading-none" style={{ ...BN, fontSize: '16px', color: '#ffffff', letterSpacing: '1.5px' }}>
                FREE DEMO RAID
              </p>
              <p className="text-[10px] text-white mt-0.5" style={{ ...INTER, fontWeight: 400 }}>
                No wallet · no entry fee · see how it works
              </p>
            </div>
            <i className="fa-solid fa-chevron-right text-white text-xs shrink-0" />
          </div>
        </button>

        {/* ── WALLET ROAST + DAILY BRIEFING ── */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onNavigateRoast?.()}
            className="relative overflow-hidden rounded-xl p-3 text-left active:scale-[0.97] transition-all"
            style={{ background: 'rgba(153,69,255,0.05)', border: '1px solid rgba(153,69,255,0.22)' }}
          >
            <p className="leading-none mb-1" style={{ ...BN, fontSize: '20px', color: '#9945FF', letterSpacing: '1.5px' }}>WALLET ROAST</p>
            <p className="text-[10px] text-white" style={{ ...INTER, fontWeight: 400 }}>Get roasted · share it</p>
          </button>

          <button
            onClick={() => onNavigateBriefing?.()}
            className="relative overflow-hidden rounded-xl p-3 text-left active:scale-[0.97] transition-all"
            style={{ background: 'rgba(255,184,0,0.05)', border: '1px solid rgba(255,184,0,0.20)' }}
          >
            <p className="leading-none mb-1" style={{ ...BN, fontSize: '20px', color: '#FFB800', letterSpacing: '1.5px' }}>THE BRIEFING</p>
            <p className="text-[10px] text-white" style={{ ...INTER, fontWeight: 400 }}>Daily cipher · +SR</p>
          </button>
        </div>

        {/* ── X (Twitter) follow button ── */}
        <a
          href="https://x.com/solraid_app"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl active:scale-[0.98] transition-all duration-150"
          style={{ background: 'var(--card-bg-mid)', border: '1.5px solid var(--border-col-mid)' }}
        >
          <i className="fa-brands fa-x-twitter text-[15px] text-white" />
          <span className="text-[12px] font-semibold text-white" style={INTER}>@solraid_app</span>
        </a>

        {!isConnected && (
          <div className="rounded-xl bg-white/3 border border-white/7 px-4 py-3 text-center">
            <p className="text-xs text-white font-medium">{t('lobby.connectWalletStart')}</p>
          </div>
        )}
      </div>

      {/* ── LOADING OVERLAY ── */}
      {isDeploying && (
        <div className="fixed inset-0 z-[200] bg-black/90 flex flex-col items-center justify-center p-8" style={INTER}>
          <i className="fa-solid fa-person-running text-[#9945FF] text-3xl mb-5" />
          <p className="text-white text-base font-medium mb-1">{t('lobby.waitingSignature')}</p>
          <p className="text-white text-sm">{t('lobby.approveWallet')}</p>
        </div>
      )}

      {/* ── FAQ MODAL ── */}
      {showFaq && (
        <div className="fixed inset-x-0 top-0 bottom-[76px] sm:bottom-0 sm:inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4">
          <div className="absolute inset-0 bg-black/85 backdrop-blur-xl animate-in fade-in duration-200" onClick={() => setShowFaq(false)} />
          <div className="relative w-full sm:max-w-lg border-t sm:border rounded-t-3xl sm:rounded-2xl shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 flex flex-col max-h-[90svh]" style={{ ...SG, background: 'var(--modal-bg)', borderColor: 'var(--border-col-mid)' }}>

            <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-white/15" />
            </div>

            <div className="shrink-0 px-5 py-4 flex items-center justify-between border-b border-white/6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-white/8 flex items-center justify-center">
                  <i className="fa-solid fa-question text-white text-sm" />
                </div>
                <h2 className="text-base font-semibold text-white">{t('lobby.faq.title')}</h2>
              </div>
              <button onClick={() => setShowFaq(false)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white hover:text-white hover:bg-white/10 transition-all">
                <i className="fa-solid fa-xmark text-sm" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 px-5 py-4 space-y-3">
              {[
                {
                  q: 'What is Sol Raid?',
                  a: 'On-chain extraction game on Solana. Pay the entry fee, pick a difficulty, score as many points as you can before you get busted. Cash out at the right moment — risk escalates every second.',
                },
                {
                  q: 'How does scoring work?',
                  a: 'Your score is based on how long you hold and your active difficulty multiplier. The higher your multiplier when you extract, the more points you bank. Only your best score this round counts.',
                },
                {
                  q: 'How do Raid Rounds work?',
                  a: '4 rounds per day (UTC), 6 hours each. GRUNT = 0.026 SOL · ELITE = 0.05 SOL · WHALE = 0.25 SOL. Your top score this round competes. After close, 100% of all fees split across top 5. Under 3 entrants — full refund.',
                },
                {
                  q: 'How do I claim round winnings?',
                  a: 'Profile → Round Wins. Hit Claim on any eligible round. SOL lands in your unclaimed balance — withdraw to your wallet from there.',
                },
                {
                  q: 'Is it provably fair?',
                  a: 'Yes. SHA-256 server seed committed before each raid, revealed after. Verify the RNG yourself. Seed history in your profile.',
                },
                {
                  q: 'What is the house edge?',
                  a: 'Base win rate ~18–22% with no gear. Gear and boosts can push it toward 36%. Risk drift is the mechanic — the longer you hold, the harder it gets. There is also a 20s cashout lock at the start of each raid.',
                },
                {
                  q: 'What are Raid Passes?',
                  a: '50% off entry fee + 10% win boost. 1 free ticket per day, max 3 stockpiled. Buy more with SKR in the Store.',
                },
                {
                  q: 'What is SKR?',
                  a: 'Seeker token on Solana. Buy gear, passes, and avatars in the Store. Also accepted as raid entry payment alongside SOL and USDC.',
                },
                {
                  q: 'What is PvP Arena?',
                  a: 'Stake against real players in a shared room. Same RNG seed, same clock. Highest score on extract wins the pot. SOL, USDC, or SKR.',
                },
              ].map(({ q, a }, i) => (
                <div key={i} className="rounded-xl bg-white/[0.025] border border-white/[0.12] p-4">
                  <p className="text-sm font-semibold text-white mb-1.5">{q}</p>
                  <p className="text-[11px] text-white font-medium leading-relaxed">{a}</p>
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
            className="relative w-full sm:max-w-lg border-t sm:border rounded-t-3xl sm:rounded-2xl shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 flex flex-col max-h-[90svh] sm:max-h-[85vh]"
            style={{ background: 'var(--modal-bg-alt)', borderColor: 'rgba(153,69,255,0.25)', ...SG }}
          >
            {/* Drag handle */}
            <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-white/15" />
            </div>

            {/* Header */}
            <div className="shrink-0 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(153,69,255,0.18)', border: '1px solid rgba(153,69,255,0.30)' }}>
                  <i className="fa-solid fa-trophy" style={{ color: '#9945FF', fontSize: '15px' }} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-black text-white">Raid Round</h2>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(153,69,255,0.18)', color: '#9945FF', border: '1px solid rgba(153,69,255,0.25)' }}>
                      Round {currentRound.roundNum} / 4
                    </span>
                  </div>
                  <p className="text-[10px] text-white font-medium">{dayLabel}</p>
                </div>
              </div>
              <button onClick={() => setShowRoundModal(false)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white hover:text-white hover:bg-white/10 transition-all">
                <i className="fa-solid fa-xmark text-sm" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto min-h-0 px-5 pb-2 space-y-4">

              {/* How it works */}
              <div className="rounded-xl bg-white/3 border border-white/7 px-4 py-3 space-y-1">
                <p className="text-[9px] text-white uppercase tracking-wider font-medium mb-2">Rules</p>
                {[
                  'Entry fee goes 100% into the prize pool',
                  'Score points — your best raid counts',
                  'Top 5 wallets split the pool when the round closes',
                  `${roundTier} split: ${RAID_TIER_ALLOCATION[roundTier].map((a, i) => `${['1st','2nd','3rd','4th','5th'][i]} ${Math.round(a*100)}%`).join(' · ')}`,
                  `Under ${ROUND_MIN_PARTICIPANTS} entrants — round cancelled, full refund`,
                ].map((line, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-[9px] font-bold shrink-0 mt-0.5" style={{ color: i === 4 ? '#FFB800' : '#9945FF' }}>{i === 4 ? '!' : `${i + 1}.`}</span>
                    <p className="text-[10px] font-medium leading-snug" style={{ color: i === 4 ? 'rgba(255,184,0,0.65)' : 'var(--text-45)' }}>{line}</p>
                  </div>
                ))}
              </div>

              {/* ── Tier Selector ── */}
              <section>
                <p className="text-[9px] text-white uppercase tracking-wider mb-2" style={{ ...INTER, fontWeight: 600 }}>Tier</p>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.values(RaidTier) as RaidTier[]).map(t => {
                    const cfg = RAID_TIER_CONFIG[t];
                    const active = roundTier === t;
                    return (
                      <button key={t} onClick={() => setRoundTier(t)}
                        className={`p-3 rounded-xl border transition-all text-center active:scale-[0.97] ${active ? 'border-2' : 'border border-white/10 bg-white/3 hover:border-white/20'}`}
                        style={active ? { borderColor: cfg.color, background: `${cfg.color}14` } : {}}>
                        <span className="text-xl block mb-1">{cfg.emoji}</span>
                        <p className="text-[10px] font-black" style={{ color: active ? cfg.color : 'var(--text-50)' }}>{cfg.label}</p>
                        <p className="text-[9px] font-semibold mt-0.5 tabular-nums" style={{ color: active ? 'var(--text-75)' : 'var(--text-30)', fontFamily: "'Space Grotesk', sans-serif" }}>
                          {cfg.entryFee} SOL
                        </p>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[9px] text-white mt-2 leading-relaxed" style={INTER}>{RAID_TIER_CONFIG[roundTier].description}</p>
              </section>

              {/* ── Battle Tools Disclaimer (dismissable) ── */}
              {!toolsDisclaimerDismissed && equippedGear.length === 0 && (
                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,184,0,0.35)', background: 'rgba(255,184,0,0.06)' }}>
                  <div className="px-4 pt-3 pb-3 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 flex-1 min-w-0">
                      <span className="text-xl shrink-0 mt-0.5">⚔️</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-black uppercase tracking-widest text-[#FFB800]">
                          {ownedGear.length > 0 ? 'Gear not equipped' : 'No gear equipped'}
                        </p>
                        <p className="text-[10px] text-white mt-1 leading-relaxed">
                          {ownedGear.length > 0
                            ? `You own ${ownedGear.length} gear piece${ownedGear.length > 1 ? 's' : ''} — none equipped. Equip below for an edge.`
                            : 'Time Boost, Multiplier Boost, Risk Reduction — gear raises your score ceiling.'
                          }
                        </p>
                        <div className="flex items-center gap-2 mt-2.5">
                          {ownedGear.length === 0 && (
                            <button
                              onClick={() => { setShowRoundModal(false); onNavigateStore?.('GEAR'); }}
                              className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all active:scale-95"
                              style={{ background: 'rgba(255,184,0,0.18)', border: '1px solid rgba(255,184,0,0.40)', color: '#FFB800' }}
                            >
                              Get Gear
                            </button>
                          )}
                          <button
                            onClick={() => setToolsDisclaimerDismissed(true)}
                            className="px-3 py-1.5 text-[9px] font-semibold uppercase tracking-widest text-white hover:text-white transition-colors"
                          >
                            {ownedGear.length > 0 ? 'Dismiss' : 'Enter anyway'}
                          </button>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setToolsDisclaimerDismissed(true)}
                      className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-white hover:text-white hover:bg-white/8 transition-all"
                    >
                      <i className="fa-solid fa-xmark text-xs" />
                    </button>
                  </div>
                </div>
              )}

              {/* ── Battle Tools (gear + boosts) ── */}
              <section>
                <p className="text-[9px] text-white uppercase tracking-wider mb-2" style={{ ...INTER, fontWeight: 600 }}>Loadout</p>
                {/* Gear quick-swap */}
                <div className="rounded-xl p-3 mb-2" style={{ background: 'rgba(153,69,255,0.04)', border: '1px solid rgba(153,69,255,0.14)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[9px] text-white uppercase tracking-wider" style={{ ...INTER, fontWeight: 500 }}>Gear loadout</p>
                    <span className="text-[9px] text-white" style={INTER}>{equippedGear.length}/4 slots</span>
                  </div>
                  {ownedGear.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {ownedGear.map(gear => {
                        const isEquipped = equippedGearIds.includes(gear.id);
                        return (
                          <button key={gear.id} onClick={() => onToggleGear(gear.id)}
                            title={`${gear.name} — ${gear.description}`}
                            className={`w-10 h-10 rounded-xl border-2 transition-all flex items-center justify-center active:scale-95 ${isEquipped ? 'border-[#9945FF]/50 bg-[#9945FF]/10' : 'border-white/[0.12] hover:border-white/22 bg-white/3'}`}>
                            {gear.image && !gear.image.startsWith('http')
                              ? <span className="text-lg leading-none">{gear.image}</span>
                              : <img src={gear.image} className="w-full h-full object-contain rounded-xl" alt="gear" />
                            }
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[10px] text-white text-center py-1" style={INTER}>{t('lobby.noGearStore')}</p>
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
                            <span className={`text-[9px] font-semibold ${active ? 'text-amber-400' : 'text-white'}`} style={SG_NUM}>+{boost.cost} SOL</span>
                          </div>
                          <p className={`text-[10px] leading-tight ${active ? 'text-white' : 'text-white'}`} style={{ ...INTER, fontWeight: 500 }}>{boost.name}</p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Difficulty */}
              <section>
                <p className="text-[9px] text-white uppercase tracking-wider mb-2" style={{ ...INTER, fontWeight: 600 }}>Difficulty</p>
                <div className="grid grid-cols-4 gap-2">
                  {Object.values(Difficulty).map(diff => {
                    const cfg    = DIFF_CONFIG[diff];
                    const active = roundDifficulty === diff;
                    return (
                      <button key={diff} onClick={() => setRoundDifficulty(diff)}
                        className={`p-2.5 rounded-xl border transition-all text-center active:scale-[0.97] ${active ? `${cfg.ring} ${cfg.bg}` : 'border-white/[0.12] bg-white/3 hover:border-white/18'}`}>
                        <span className="text-lg block mb-1">{cfg.emoji}</span>
                        <p className={`text-[9px] font-semibold ${active ? cfg.color : 'text-white'}`}>{cfg.label}</p>
                        <p className="text-[8px] text-white mt-0.5">{cfg.mult}</p>
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>

            {/* Footer */}
            <div className="shrink-0 border-t border-white/5 p-4 bg-[var(--modal-bg)] rounded-b-3xl sm:rounded-b-2xl space-y-3">
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
                      className={`py-2.5 rounded-xl border-2 transition-all text-center ${active ? colActive : 'border-white/7 text-white bg-white/3 hover:border-white/18'}`}>
                      <p className="text-[10px] font-semibold">{sym}</p>
                      <p className="text-[9px] text-white mt-0.5">{bal.toFixed(c === Currency.SKR ? 0 : 2)}</p>
                    </button>
                  );
                })}
              </div>

              {/* Ticket toggle */}
              {raidTickets > 0 && (
                <button onClick={() => setRoundUseTicket(p => !p)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border transition-all ${applyRoundTicket ? 'border-amber-500/40 bg-amber-500/8' : 'border-white/[0.10] bg-white/3'}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">🎟️</span>
                    <div>
                      <p className={`text-[10px] font-semibold ${applyRoundTicket ? 'text-amber-400' : 'text-white'}`}>{t('lobby.useTicket')}</p>
                      <p className="text-[8px] text-white">{t('lobby.ticketsLeft', { count: raidTickets })}</p>
                    </div>
                  </div>
                  <div className={`w-8 h-4 rounded-full transition-all relative ${applyRoundTicket ? 'bg-amber-500' : 'bg-white/15'}`}>
                    <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all shadow ${applyRoundTicket ? 'left-[18px]' : 'left-0.5'}`} />
                  </div>
                </button>
              )}

              {/* Cost + enter */}
              <div className="flex items-center gap-3">
                <div className="shrink-0">
                  <p className="text-[9px] text-white font-semibold uppercase mb-0.5">{t('lobby.entryTotal')}</p>
                  <p className="text-xl font-bold text-white leading-none">
                    {roundPricesLoading
                      ? <span className="text-white text-sm animate-pulse">{t('common.loading')}</span>
                      : <>{roundTotalDisplay.toFixed(roundCurDecimals)}<span className={`text-sm ml-1 font-semibold ${roundCurrency === Currency.SOL ? 'text-white' : roundCurrency === Currency.USDC ? 'text-blue-400' : 'text-orange-400'}`}>{roundCurSymbol}</span></>
                    }
                  </p>
                  {applyRoundTicket && <p className="text-[9px] text-amber-400 font-semibold mt-0.5">{t('lobby.ticketApplied')}</p>}
                  {!roundPricesLoading && roundBalance < roundTotalDisplay && (
                    <p className="text-[9px] text-[#9945FF] font-semibold mt-0.5">{t('common.insufficient')}</p>
                  )}
                </div>
                <button
                  onClick={handleEnterRound}
                  disabled={roundPricesLoading || roundBalance < roundTotalDisplay}
                  className="flex-1 py-3.5 rounded-xl font-bold text-sm active:scale-[0.98] transition-all disabled:opacity-35 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg, #6622BB 0%, #3d0099 100%)', color: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.5)', ...BN, fontSize: '15px' }}
                >
                  ENTER ROUND
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
