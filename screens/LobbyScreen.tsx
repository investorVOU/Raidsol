
import React, { useState, useRef, useEffect } from 'react';
import { Mode, ENTRY_FEES, Difficulty, DIFFICULTY_CONFIG, GEAR_ITEMS, RAID_BOOSTS, AVATAR_ITEMS, Currency, CURRENCY_RATES } from '../types';
import type { LivePrices } from '../hooks/usePrices';
import { useActivityFeed } from '../hooks/useActivityFeed';
import { useTreasuryStats } from '../hooks/useTreasuryStats';

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
  raidTickets?: number;
  lastFreeRaidDate?: string | null;
  drillCount?: number;
  drillWindowStart?: number;
  currencyRates?: LivePrices['currencyRates'];
}

const LobbyScreen: React.FC<LobbyScreenProps> = ({
  onEnterRaid,
  isConnected,
  onConnect,
  currentLevel,
  walletBalance,
  usdcBalance,
  skrBalance,
  equippedGearIds,
  equippedAvatarId,
  ownedItemIds,
  onToggleGear,
  onNavigateTreasury,
  onNavigateStore,
  raidTickets = 0,
  lastFreeRaidDate = null,
  drillCount = 0,
  drillWindowStart = 0,
  currencyRates,
}) => {
  const rates = currencyRates ?? { [Currency.SOL]: 1, [Currency.USDC]: 0, [Currency.SKR]: 0 };
  const [showModeModal, setShowModeModal] = useState(false);
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>(Difficulty.MEDIUM);
  const [selectedBoosts, setSelectedBoosts] = useState<string[]>([]);
  const [selectedMode, setSelectedMode] = useState<Mode>(Mode.SOLO);
  const [entryCurrency, setEntryCurrency] = useState<Currency>(Currency.SOL);
  const [isDeploying, setIsDeploying] = useState(false);
  const [useTicket, setUseTicket] = useState(false);

  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  // ── Drill cap: 3 per 6 hours ──────────────────────────────────────────────
  const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
  const drillWindowExpired = (Date.now() - drillWindowStart) >= SIX_HOURS_MS;
  const drillsUsed = drillWindowExpired ? 0 : drillCount;
  const drillsRemaining = Math.max(0, 3 - drillsUsed);
  const drillCapHit = isConnected && drillsRemaining === 0;

  const { feed } = useActivityFeed();
  const { stats } = useTreasuryStats();

  const handleOpenModal = () => {
    setSelectedBoosts([]);
    setUseTicket(false);
    setShowModeModal(true);
  };

  const handleToggleBoost = (boostId: string) => {
    setSelectedBoosts((prev) =>
      prev.includes(boostId) ? prev.filter((id) => id !== boostId) : [...prev, boostId],
    );
  };

  const handleDeploy = async () => {
    setShowModeModal(false);
    setIsDeploying(true);
    try {
      await onEnterRaid(selectedMode, selectedDifficulty, selectedBoosts, entryCurrency, useTicket && raidTickets > 0);
    } finally {
      if (mountedRef.current) setIsDeploying(false);
    }
  };

  // Calculate totals
  const entryFeeBase = ENTRY_FEES[selectedMode]; // in SOL
  const applyTicket  = useTicket && raidTickets > 0;
  const entryFee     = applyTicket ? entryFeeBase * 0.5 : entryFeeBase;
  const boostCost = selectedBoosts.reduce((sum, id) => {
    const boost = RAID_BOOSTS.find((b) => b.id === id);
    return sum + (boost ? boost.cost : 0);
  }, 0);
  const totalCostSol = entryFee + boostCost;
  const currencyRate = rates[entryCurrency];
  const pricesLoading = entryCurrency !== Currency.SOL && currencyRate === 0;
  const totalCostDisplay = totalCostSol * currencyRate;
  const currencySymbol = entryCurrency === Currency.SOL ? 'SOL' : entryCurrency === Currency.USDC ? 'USDC' : 'SKR';
  const currencyDecimals = entryCurrency === Currency.SOL ? 3 : entryCurrency === Currency.USDC ? 2 : 0;
  const currentBalance = entryCurrency === Currency.SOL ? walletBalance : entryCurrency === Currency.USDC ? usdcBalance : skrBalance;

  const equippedGear = GEAR_ITEMS.filter((g) => equippedGearIds.includes(g.id));
  const equippedAvatar = AVATAR_ITEMS.find((a) => a.id === equippedAvatarId);
  const ownedGear = GEAR_ITEMS.filter((g) => ownedItemIds.includes(g.id));

  // Aggregate gear + boost stats for the deployment preview
  const gearStats = equippedGear.reduce(
    (acc, g) => {
      if (g.effect === 'MULT_BOOST') acc.mult += g.benefitValue ?? 0;
      if (g.effect === 'RISK_REDUCTION') acc.riskReduc += g.benefitValue ?? 0;
      if (g.effect === 'TIME_BOOST') acc.timeBoost += g.benefitValue ?? 0;
      return acc;
    },
    { mult: 0, riskReduc: 0, timeBoost: 0 },
  );
  const boostDriftReduc = selectedBoosts.includes('risk_shield') ? 15 : 0;
  const boostMultBonus = selectedBoosts.includes('score_mult') ? 0.5 : 0;
  const totalMult = (1.0 + gearStats.mult + boostMultBonus).toFixed(2);
  const totalRiskReduc = gearStats.riskReduc + boostDriftReduc;
  const totalTime = 30 + gearStats.timeBoost;
  const advantageScore = Math.min(100, Math.round(gearStats.mult * 20 + gearStats.riskReduc * 1.5 + gearStats.timeBoost * 1.2 + boostDriftReduc + boostMultBonus * 15));

  // Format activity feed entries for display
  const feedLines = feed.map((e) => {
    if (e.event_type === 'EXTRACTED') {
      return { text: `${e.username} // EXTRACTED // ${Number(e.amount_sol).toFixed(3)} SOL`, type: 'EXTRACTED' };
    }
    return { text: `${e.username} // BUSTED`, type: 'BUSTED' };
  });

  // Treasury marquee values
  const treasuryReserve = stats?.total_reserve_sol ?? null;
  const treasury24h = stats?.payouts_24h_sol ?? null;
  const latestWin = feed.find((e) => e.event_type === 'EXTRACTED');

  const treasuryAddr = stats?.treasury_address || '';
  const solscanUrl = treasuryAddr
    ? `https://solscan.io/account/${treasuryAddr}`
    : 'https://solscan.io';

  return (
    <div className="w-full h-full flex flex-col relative bg-black overflow-hidden animate-in fade-in duration-500">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none select-none">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-b from-purple-900/10 via-black to-black" />
        <div className="scanline opacity-10" />
      </div>

      {/* TOP SECTION */}
      <div className="shrink-0 p-4 sm:p-6 z-10">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-2">
          <div>
            <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white leading-none glitch-text">
              SOL RAID
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <div
                className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-[#14F195] shadow-[0_0_8px_#14F195]' : 'bg-red-500 animate-pulse'}`}
              />
              <span className="text-[10px] font-bold tracking-wider text-white/50">
                {isConnected ? 'online' : 'offline'} · v5.0
              </span>
            </div>
          </div>

          {/* Live Combat Log */}
          <div className="w-full sm:w-56 bg-black/50 border border-white/10 p-1.5 tech-border">
            <p className="text-[8px] font-bold text-white/40 uppercase tracking-wider border-b border-white/5 mb-1 pb-1">
              live feed
            </p>
            <div className="space-y-0.5 h-12 overflow-hidden flex flex-col justify-end">
              {feedLines.length === 0 ? (
                <p className="text-[9px] font-bold mono text-white/40">{'>'} Awaiting activity...</p>
              ) : (
                feedLines.slice(0, 3).map((entry, i) => (
                  <p
                    key={i}
                    className={`text-[9px] font-bold mono truncate animate-in slide-in-from-right duration-300 ${
                      entry.type === 'BUSTED' ? 'text-red-500' : 'text-[#14F195]'
                    }`}
                  >
                    {'>'} {entry.text}
                  </p>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SCROLLABLE MIDDLE */}
      <div className="flex-1 overflow-y-auto scrollbar-hide relative z-10 px-4 sm:px-6 pb-40">

        <div className="w-full max-w-lg mx-auto space-y-4">
          {/* ── PRIMARY ACTION ─────────────────────────────────────────── */}
          <button
            onClick={() => (isConnected ? handleOpenModal() : onConnect())}
            className="w-full group relative bg-[#14F195] p-[2px] transition-all hover:scale-[1.01] active:scale-[0.99] shadow-[0_0_40px_rgba(20,241,149,0.15)]"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500 z-20" />
            <div className="bg-[#030303] h-20 sm:h-24 flex items-center justify-between px-5 sm:px-7 relative z-10 group-hover:bg-[#080808] transition-colors">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-[#14F195] font-bold tracking-wide text-[10px]">
                    {isConnected ? 'Ready to deploy' : 'Connect wallet'}
                  </p>
                  {raidTickets > 0 && (
                    <span className="bg-yellow-500 text-black text-[9px] font-black px-1.5 py-0.5">
                      🎟️ {raidTickets}x
                    </span>
                  )}
                </div>
                <h2 className="text-3xl sm:text-4xl font-black italic uppercase text-white leading-none tracking-tight">
                  Enter Raid
                </h2>
                <p className="text-white/40 font-bold text-[9px] mt-1">High risk · high reward</p>
              </div>
              <div className="flex flex-col items-center gap-1 shrink-0">
                <div className="w-10 h-10 border-2 border-[#14F195] flex items-center justify-center group-hover:bg-[#14F195] group-hover:text-black transition-all">
                  <span className="text-base font-black">GO</span>
                </div>
                {raidTickets > 0 && (
                  <p className="text-[8px] text-yellow-500/60 font-bold">50% off</p>
                )}
              </div>
            </div>
          </button>

          {/* ── SECONDARY MODES ─────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => (isConnected ? onEnterRaid(Mode.PVP, Difficulty.MEDIUM, []) : onConnect())}
              className="p-3 bg-[#9945FF]/10 border-2 border-[#9945FF]/40 tech-border hover:bg-[#9945FF]/20 hover:border-[#9945FF] transition-all text-left group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-8 h-8 bg-[#9945FF]/20 blur-xl" />
              <p className="text-[9px] font-bold text-[#9945FF] tracking-wide mb-1">Multiplayer</p>
              <p className="text-base sm:text-lg font-black text-white leading-none">PvP Duel</p>
              <p className="text-[8px] text-white/40 font-bold mt-1">stake vs players</p>
            </button>
            <button
              onClick={() => {
                if (!isConnected) { onConnect(); return; }
                if (drillCapHit) return;
                onEnterRaid(Mode.DRILL, Difficulty.MEDIUM, []);
              }}
              disabled={drillCapHit}
              className={`p-4 border-2 tech-border text-left relative overflow-hidden transition-all ${
                drillCapHit
                  ? 'bg-white/3 border-white/5 opacity-50 cursor-not-allowed'
                  : 'bg-white/5 border-white/10 hover:bg-white/8 hover:border-white/25'
              }`}
            >
              <div className="absolute top-0 right-0 w-8 h-8 bg-white/5 blur-xl" />
              <p className="text-[9px] font-bold text-white/50 tracking-wide mb-1">Training</p>
              <p className="text-base sm:text-lg font-black text-white leading-none">Free Drill</p>
              <p className={`text-[8px] font-bold mt-1 ${drillCapHit ? 'text-red-400/60' : 'text-white/40'}`}>
                {isConnected ? (drillCapHit ? 'limit reached' : `${drillsRemaining}/3 left`) : 'no entry fee'}
              </p>
            </button>
          </div>

        </div>

          {/* ── RAID PASS BANNER ─────────────────────────────────────── */}
          <button
            onClick={() => onNavigateStore?.('PASS')}
            className="w-full group relative overflow-hidden border border-yellow-500/30 bg-yellow-500/5 hover:bg-yellow-500/10 hover:border-yellow-500/60 transition-all tech-border flex items-center gap-3 px-4 py-3"
          >
            {/* Sweep shimmer */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-yellow-500/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 pointer-events-none" />

            <div className="text-2xl shrink-0">🎟️</div>

            <div className="flex-1 text-left min-w-0">
              {raidTickets > 0 ? (
                <>
                  <p className="text-[10px] font-bold text-yellow-400">
                    {raidTickets}x Raid Pass ready
                  </p>
                  <p className="text-[9px] text-white/50">50% off entry · 10% win boost · active on deploy</p>
                </>
              ) : (
                <>
                  <p className="text-[10px] font-bold text-yellow-400">
                    Raid Pass — 50% off entry fee
                  </p>
                  <p className="text-[9px] text-white/50">Buy a pass · play more · win bigger</p>
                  <p className="text-[9px] text-orange-400 mt-0.5">SKR holders get 50% off pass price</p>
                </>
              )}
            </div>

            <div className="shrink-0 flex items-center gap-1 text-yellow-500 group-hover:translate-x-0.5 transition-transform">
              <span className="text-[10px] font-bold whitespace-nowrap">
                {raidTickets > 0 ? 'Get more' : 'Get pass'}
              </span>
              <span className="font-black text-sm">→</span>
            </div>
          </button>


        {!isConnected && (
          <div className="mt-4 text-center">
            <p className="text-red-400/80 text-[10px] font-bold bg-red-950/20 px-3 py-1.5 border border-red-500/20 inline-block">
              Connect your wallet to deploy
            </p>
          </div>
        )}
      </div>

      {/* TREASURY MARQUEE */}
      <div
        onClick={onNavigateTreasury}
        className="hidden md:block shrink-0 z-30 bg-[#080808] border-t border-white/10 py-2 overflow-hidden relative cursor-pointer hover:bg-white/5 transition-colors group"
      >
        <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-black to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-black to-transparent z-10 pointer-events-none" />
        <div className="flex gap-8 whitespace-nowrap animate-[marquee_20s_linear_infinite] group-hover:[animation-play-state:paused] w-max">
          {[...Array(3)].map((_, i) => (
            <React.Fragment key={i}>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-[#14F195] rounded-full animate-pulse" />
                <span className="text-[10px] font-bold text-white/50">Treasury:</span>
                <span className="text-sm font-bold mono text-[#14F195]">
                  {treasuryReserve !== null ? `${Number(treasuryReserve).toLocaleString()} SOL` : '—'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-white/50">24h payouts:</span>
                <span className="text-sm font-bold mono text-white">
                  {treasury24h !== null ? `${Number(treasury24h).toFixed(2)} SOL` : '—'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-white/50">Status:</span>
                <span className="text-sm font-bold mono text-[#14F195]">Solvent</span>
              </div>
              {latestWin && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-white/50">Latest win:</span>
                  <span className="text-sm font-bold mono text-yellow-500">
                    {latestWin.username} extracted {Number(latestWin.amount_sol).toFixed(3)} SOL
                  </span>
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ── LOADING OVERLAY ─────────────────────────────────────────────── */}
      {isDeploying && (
        <div className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center p-8">
          <div className="scanline opacity-10 pointer-events-none" />

          {/* Pulsing ring */}
          <div className="relative w-28 h-28 mb-8">
            <div className="absolute inset-0 border-2 border-[#14F195] animate-ping opacity-20" />
            <div
              className="absolute inset-3 border-2 border-[#14F195] animate-ping opacity-40"
              style={{ animationDelay: '0.4s' }}
            />
            <div className="absolute inset-6 border border-[#14F195]/60 animate-pulse" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[#14F195] font-black text-xl">GO</span>
            </div>
          </div>

          <p className="text-[#14F195] font-black text-lg sm:text-xl uppercase tracking-wider text-center animate-pulse mb-2">
            Awaiting signature
          </p>
          <p className="text-white/50 text-[10px] font-bold text-center mb-8">
            Approve the transaction in your wallet
          </p>

          {/* Bouncing dots */}
          <div className="flex gap-2">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="w-2 h-2 bg-[#14F195] animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>

          <p className="mt-12 text-[9px] font-bold text-white/20">
            Don't close this window
          </p>
        </div>
      )}

      {/* ── DEPLOYMENT MODAL ─────────────────────────────────────────────── */}
      {/* bottom-16 on mobile: leave room above the fixed nav bar */}
      {showModeModal && (
        <div className="fixed inset-x-0 top-0 bottom-16 sm:bottom-0 sm:inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/95 backdrop-blur-xl animate-in fade-in duration-200"
            onClick={() => setShowModeModal(false)}
          />

          {/* Modal card — slides up on mobile (fixed height), zooms in on desktop */}
          <div className="relative w-full sm:max-w-4xl bg-[#0a0a0a] border-t-2 sm:border-2 border-white/10 tech-border shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 flex flex-col h-[88svh] sm:h-auto sm:max-h-[95vh]">

            {/* Header */}
            <div className="shrink-0 px-4 py-3 sm:p-5 border-b border-white/10 flex justify-between items-center bg-white/[0.02]">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-1 sm:w-1.5 h-5 sm:h-6 bg-[#14F195]" />
                <h2 className="text-base sm:text-xl font-black uppercase tracking-tight text-white">
                  Configure Raid
                </h2>
              </div>
              <button
                onClick={() => setShowModeModal(false)}
                className="text-white/40 hover:text-white w-8 h-8 flex items-center justify-center text-lg font-bold"
              >
                ×
              </button>
            </div>

            {/* Scrollable body — min-h-0 is required for flex-1 overflow-y-auto to work correctly */}
            <div className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10">

                {/* ── Left Col: Settings ──────────────────────────────── */}
                <div className="space-y-5 sm:space-y-7">

                  {/* 01 Mode */}
                  <div className="space-y-2 sm:space-y-3">
                    <Label text="Mode" />
                    <div className="space-y-1.5">
                      <ModeOption label="Solo"        fee={ENTRY_FEES[Mode.SOLO]}       active={selectedMode === Mode.SOLO}       onClick={() => setSelectedMode(Mode.SOLO)} />
                      <ModeOption label="Squad"       fee={ENTRY_FEES[Mode.TEAM]}       active={selectedMode === Mode.TEAM}       onClick={() => setSelectedMode(Mode.TEAM)}       locked={currentLevel < 5} />
                      <ModeOption label="Tournament"  fee={ENTRY_FEES[Mode.TOURNAMENT]} active={selectedMode === Mode.TOURNAMENT} onClick={() => setSelectedMode(Mode.TOURNAMENT)} locked={currentLevel < 15} />
                    </div>
                  </div>

                  {/* 02 Difficulty */}
                  <div className="space-y-2 sm:space-y-3">
                    <Label text="Difficulty" />
                    <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                      {Object.values(Difficulty).map((diff) => {
                        const config = DIFFICULTY_CONFIG[diff];
                        const active = selectedDifficulty === diff;
                        return (
                          <button
                            key={diff}
                            onClick={() => setSelectedDifficulty(diff)}
                            className={`p-2.5 sm:p-4 border tech-border text-left transition-all ${active ? `bg-white/10 border-white ${config.color}` : 'bg-black border-white/10 text-white/40 hover:border-white/30'}`}
                          >
                            <div className="flex justify-between items-start">
                              <span className="text-xs sm:text-sm font-bold uppercase tracking-tight">{config.label}</span>
                              {active && <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />}
                            </div>
                            <span className="block text-[10px] sm:text-xs font-bold opacity-60 mt-0.5 sm:mt-1">
                              mult: {diff === Difficulty.EASY ? '0.8×' : diff === Difficulty.MEDIUM ? '1.0×' : diff === Difficulty.HARD ? '1.4×' : '2.5×'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 03 Boosts */}
                  <div className="space-y-2 sm:space-y-3">
                    <Label text="Boosts" />
                    <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                      {RAID_BOOSTS.map((boost) => {
                        const isActive = selectedBoosts.includes(boost.id);
                        return (
                          <button
                            key={boost.id}
                            onClick={() => handleToggleBoost(boost.id)}
                            className={`p-2.5 sm:p-4 border tech-border text-left transition-all ${isActive ? 'bg-yellow-500/10 border-yellow-500' : 'bg-black border-white/10 hover:border-white/30'}`}
                          >
                            <div className="flex justify-between mb-0.5 sm:mb-1">
                              <span className="text-lg">{boost.icon}</span>
                              <span className={`text-xs sm:text-sm mono font-black ${isActive ? 'text-yellow-500' : 'text-white/60'}`}>{boost.cost} S</span>
                            </div>
                            <p className={`text-[10px] sm:text-xs font-bold uppercase leading-tight ${isActive ? 'text-white' : 'text-white/60'}`}>{boost.name}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* ── Right Col: Loadout ──────────────────────── */}
                <div className="space-y-3">

                  {/* Loadout header */}
                  <div className="flex justify-between items-center mb-2">
                    <Label text="Loadout" />
                    <span className="text-[10px] font-bold text-white/50">{equippedGear.length}/4 slots</span>
                  </div>

                  {/* Gear slots */}
                  <div className="grid grid-cols-5 gap-1.5 sm:gap-2 mb-3">
                    <div className="aspect-square bg-black border border-cyan-500/50 tech-border relative p-1">
                      {equippedAvatar?.image && (
                        <img src={equippedAvatar.image} className="w-full h-full object-cover" alt="Core" />
                      )}
                      <div className="absolute bottom-0 left-0 bg-cyan-500 text-[8px] sm:text-[10px] text-black font-black px-0.5 sm:px-1">CORE</div>
                    </div>
                    {[...Array(4)].map((_, i) => {
                      const gear = equippedGear[i];
                      return (
                        <div
                          key={i}
                          className={`aspect-square bg-black border tech-border relative p-1 ${gear ? 'border-purple-500' : 'border-white/10'}`}
                          title={gear ? `${gear.name}: ${gear.description}` : 'Empty slot'}
                        >
                          {gear ? (
                            gear.image && !gear.image.startsWith('http')
                              ? <div className="w-full h-full flex items-center justify-center text-xl leading-none select-none">{gear.image}</div>
                              : <img src={gear.image} className="w-full h-full object-contain" alt={gear.name} style={{ imageRendering: 'pixelated' }} />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-white/5 text-xl">+</div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Quick-swap inventory */}
                  {ownedGear.length > 0 ? (
                    <div className="p-2.5 sm:p-3 bg-white/5 border border-white/5 mb-3">
                      <p className="text-[10px] font-bold uppercase text-white/40 mb-1.5 sm:mb-2">Quick swap</p>
                      <div className="flex flex-wrap gap-1.5 sm:gap-2">
                        {ownedGear.map((gear) => {
                          const isEquipped = equippedGearIds.includes(gear.id);
                          return (
                            <button
                              key={gear.id}
                              onClick={() => onToggleGear(gear.id)}
                              title={`${gear.name} — ${gear.description}`}
                              className={`w-9 h-9 sm:w-10 sm:h-10 border tech-border p-0.5 transition-all ${isEquipped ? 'border-purple-500 bg-purple-500/20' : 'border-white/10 hover:border-white/40 hover:bg-white/10'}`}
                            >
                              {gear.image && !gear.image.startsWith('http')
                                ? <span className="text-lg leading-none select-none">{gear.image}</span>
                                : <img src={gear.image} className="w-full h-full object-contain" alt="gear" style={{ imageRendering: 'pixelated' }} />
                              }
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="p-2.5 sm:p-3 bg-white/5 border border-white/5 mb-3 text-center">
                      <p className="text-[10px] font-bold text-white/40">No gear — visit the market to equip</p>
                    </div>
                  )}

                  {/* Combat stats */}
                  <div className="p-3 sm:p-4 bg-black border border-white/10 tech-border mb-3">
                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-wide mb-2 sm:mb-3">Stats</p>
                    <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-2 sm:mb-3">
                      <div className="text-center">
                        <p className="text-[9px] text-white/40 uppercase tracking-wide mb-1">Mult</p>
                        <p className="font-black mono text-[#14F195] text-base sm:text-lg leading-none">{totalMult}x</p>
                      </div>
                      <div className="text-center border-x border-white/5">
                        <p className="text-[9px] text-white/40 uppercase tracking-wide mb-1">Risk</p>
                        <p className="font-black mono text-cyan-400 text-base sm:text-lg leading-none">-{totalRiskReduc}%</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[9px] text-white/40 uppercase tracking-wide mb-1">Time</p>
                        <p className="font-black mono text-purple-400 text-base sm:text-lg leading-none">{totalTime}s</p>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[9px] font-bold uppercase text-white/50 mb-1">
                        <span>Power</span>
                        <span className={advantageScore >= 50 ? 'text-[#14F195]' : advantageScore >= 25 ? 'text-yellow-500' : 'text-red-500'}>
                          {advantageScore >= 50 ? 'STRONG' : advantageScore >= 25 ? 'MODERATE' : 'WEAK'} +{advantageScore}
                        </span>
                      </div>
                      <div className="w-full h-1.5 sm:h-2 bg-white/5 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${advantageScore >= 50 ? 'bg-[#14F195]' : advantageScore >= 25 ? 'bg-yellow-500' : 'bg-red-500'}`}
                          style={{ width: `${advantageScore}%` }}
                        />
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </div>

            {/* ── Footer: always-visible deploy bar ──────────────────────── */}
            <div className="shrink-0 border-t-2 border-white/10 p-3 sm:p-5 bg-[#050505]">
              {/* Currency selector */}
              <div className="mb-2 sm:mb-3">
                <p className="text-[9px] text-white/40 font-bold uppercase tracking-wide mb-1">Pay with</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {([Currency.SOL, Currency.USDC, Currency.SKR] as Currency[]).map((c) => {
                    const bal = c === Currency.SOL ? walletBalance : c === Currency.USDC ? usdcBalance : skrBalance;
                    const sym = c === Currency.SOL ? 'SOL' : c === Currency.USDC ? 'USDC' : 'SKR';
                    const col = c === Currency.SOL ? 'border-[#14F195] text-[#14F195]' : c === Currency.USDC ? 'border-blue-400 text-blue-400' : 'border-orange-400 text-orange-400';
                    const active = entryCurrency === c;
                    return (
                      <button
                        key={c}
                        onClick={() => setEntryCurrency(c)}
                        className={`py-2 px-1 border tech-border text-center transition-all ${active ? `${col} bg-white/5` : 'border-white/10 text-white/40 hover:border-white/30'}`}
                      >
                        <p className="text-[10px] font-bold uppercase">{sym}</p>
                        <p className="text-[9px] mono text-white/60">{bal.toFixed(c === Currency.SKR ? 0 : 2)}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Ticket toggle — only shown when player has tickets */}
              {raidTickets > 0 && (
                <div className="mb-2 sm:mb-3">
                  <button
                    onClick={() => setUseTicket(prev => !prev)}
                    className={`w-full flex items-center justify-between p-2.5 border tech-border transition-all ${applyTicket ? 'border-yellow-500/60 bg-yellow-500/10' : 'border-white/10 bg-black/30 hover:border-white/20'}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">🎟️</span>
                      <div className="text-left">
                        <p className={`text-[10px] font-bold ${applyTicket ? 'text-yellow-400' : 'text-white/60'}`}>Use ticket</p>
                        <p className="text-[9px] text-white/40 font-bold">50% off entry · +10% win boost</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-white/50">{raidTickets}x left</span>
                      <div className={`w-8 h-4 rounded-full transition-all relative ${applyTicket ? 'bg-yellow-500' : 'bg-white/10'}`}>
                        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${applyTicket ? 'left-4.5 left-[18px]' : 'left-0.5'}`} />
                      </div>
                    </div>
                  </button>
                </div>
              )}

              {/* Cost + Deploy row */}
              <div className="flex items-center gap-3">
                <div className="min-w-0 shrink-0">
                  <p className="text-[9px] text-white/40 font-bold uppercase tracking-wide mb-0.5">Entry cost</p>
                  <p className="text-xl font-black mono text-white leading-none">
                    {pricesLoading ? <span className="text-white/40 text-sm animate-pulse">Fetching…</span> : <>{totalCostDisplay.toFixed(currencyDecimals)}{' '}<span className={`text-sm ${entryCurrency === Currency.SOL ? 'text-[#14F195]' : entryCurrency === Currency.USDC ? 'text-blue-400' : 'text-orange-400'}`}>{currencySymbol}</span></>}
                  </p>
                  {applyTicket && (
                    <p className="text-[9px] text-yellow-500 font-bold mt-0.5">🎟️ ticket discount active</p>
                  )}
                  {!pricesLoading && currentBalance < totalCostDisplay && totalCostSol > 0 && (
                    <p className="text-[9px] text-red-500 font-bold mt-0.5">Insufficient funds</p>
                  )}
                </div>
                <button
                  onClick={handleDeploy}
                  disabled={pricesLoading || (totalCostSol > 0 && currentBalance < totalCostDisplay)}
                  className="flex-1 py-3 bg-[#14F195] text-black font-black uppercase tracking-tight text-sm sm:text-base tech-border hover:bg-[#10c479] active:translate-y-0.5 transition-all shadow-[0_0_20px_rgba(20,241,149,0.2)] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:translate-y-0"
                >
                  Deploy
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Label = ({ text }: { text: string }) => (
  <p className="text-[11px] font-bold text-white/50 tracking-wide">{text}</p>
);

const ModeOption = ({
  label,
  fee,
  active,
  onClick,
  locked,
}: {
  label: string;
  fee: number;
  active: boolean;
  onClick: () => void;
  locked?: boolean;
}) => (
  <button
    onClick={onClick}
    disabled={locked}
    className={`w-full flex justify-between items-center p-2.5 sm:p-3 border tech-border transition-all group ${
      locked
        ? 'opacity-40 cursor-not-allowed border-white/5 bg-transparent'
        : active
        ? 'bg-cyan-500/10 border-cyan-500'
        : 'bg-black border-white/10 hover:border-white/30'
    }`}
  >
    <div className="text-left flex items-center gap-2">
      {active && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />}
      <span className={`text-sm font-black uppercase ${active ? 'text-cyan-400' : 'text-white'}`}>
        {label}
      </span>
      {locked && (
        <span className="text-[9px] text-red-500/70 font-bold bg-red-950/30 px-1">locked</span>
      )}
    </div>
    <span className="mono text-xs font-black text-white/60">{fee} SOL</span>
  </button>
);

export default LobbyScreen;
