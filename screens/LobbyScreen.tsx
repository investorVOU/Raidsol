
import React, { useState, useRef, useEffect } from 'react';
import { Mode, ENTRY_FEES, Difficulty, DIFFICULTY_CONFIG, GEAR_ITEMS, RAID_BOOSTS, AVATAR_ITEMS, Currency, CURRENCY_RATES } from '../types';
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
}) => {
  const [showModeModal, setShowModeModal] = useState(false);
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>(Difficulty.MEDIUM);
  const [selectedBoosts, setSelectedBoosts] = useState<string[]>([]);
  const [selectedMode, setSelectedMode] = useState<Mode>(Mode.SOLO);
  const [entryCurrency, setEntryCurrency] = useState<Currency>(Currency.SOL);
  const [isDeploying, setIsDeploying] = useState(false);
  const [useTicket, setUseTicket] = useState(false);

  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

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
  const currencyRate = CURRENCY_RATES[entryCurrency];
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
            <h1 className="text-4xl sm:text-6xl font-black italic tracking-tighter text-white leading-none glitch-text">
              SOL_RAID
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <div
                className={`w-2 h-2 rounded-full ${isConnected ? 'bg-[#14F195] shadow-[0_0_10px_#14F195]' : 'bg-red-500 animate-pulse'}`}
              />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/50">
                {isConnected ? 'NET_ONLINE' : 'NET_OFFLINE'} // V5.0.2
              </span>
            </div>
          </div>

          {/* Live Combat Log */}
          <div className="w-full sm:w-56 bg-black/50 border border-white/10 p-1.5 tech-border">
            <p className="text-[8px] font-black text-white/30 uppercase tracking-widest border-b border-white/5 mb-1 pb-1">
              LIVE_COMBAT_LOG
            </p>
            <div className="space-y-0.5 h-12 overflow-hidden flex flex-col justify-end">
              {feedLines.length === 0 ? (
                <p className="text-[9px] font-bold mono text-white/20">{'>'} AWAITING ACTIVITY...</p>
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
            <div className="bg-[#030303] h-28 sm:h-32 flex items-center justify-between px-5 sm:px-8 relative z-10 group-hover:bg-[#080808] transition-colors">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-[#14F195] font-black uppercase tracking-[0.2em] text-[10px]">
                    {isConnected ? 'COMMAND_READY' : 'CONNECT_WALLET'}
                  </p>
                  {raidTickets > 0 && (
                    <span className="bg-yellow-500 text-black text-[9px] font-black px-1.5 py-0.5 animate-pulse">
                      🎟️ {raidTickets}x
                    </span>
                  )}
                </div>
                <h2 className="text-4xl sm:text-5xl font-black italic uppercase text-white leading-none tracking-tighter">
                  ENTER RAID
                </h2>
                <p className="text-white/30 font-bold uppercase text-[9px] mt-1.5">HIGH RISK // HIGH REWARD</p>
              </div>
              <div className="flex flex-col items-center gap-1 shrink-0">
                <div className="w-11 h-11 border-2 border-[#14F195] flex items-center justify-center group-hover:bg-[#14F195] group-hover:text-black transition-all">
                  <span className="text-xl font-black">GO</span>
                </div>
                {raidTickets > 0 && (
                  <p className="text-[8px] text-yellow-500/60 font-black uppercase">50% OFF</p>
                )}
              </div>
            </div>
          </button>

          {/* ── SECONDARY MODES ─────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => (isConnected ? onEnterRaid(Mode.PVP, Difficulty.MEDIUM, []) : onConnect())}
              className="p-4 bg-[#9945FF]/10 border-2 border-[#9945FF]/40 tech-border hover:bg-[#9945FF]/20 hover:border-[#9945FF] transition-all text-left group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-8 h-8 bg-[#9945FF]/20 blur-xl" />
              <p className="text-[9px] font-black text-[#9945FF] uppercase tracking-widest mb-1">MULTIPLAYER</p>
              <p className="text-lg sm:text-xl font-black italic text-white leading-none">PVP DUEL</p>
              <p className="text-[8px] text-white/25 font-black mt-1 uppercase">STAKE vs PLAYERS</p>
            </button>
            <button
              onClick={() => (isConnected ? onEnterRaid(Mode.DRILL, Difficulty.MEDIUM, []) : onConnect())}
              className="p-4 bg-white/5 border-2 border-white/10 tech-border hover:bg-white/8 hover:border-white/25 transition-all text-left group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-8 h-8 bg-white/5 blur-xl" />
              <p className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-1">TRAINING</p>
              <p className="text-lg sm:text-xl font-black italic text-white leading-none">FREE DRILL</p>
              <p className="text-[8px] text-white/25 font-black mt-1 uppercase">NO ENTRY FEE</p>
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
                  <p className="text-[10px] font-black uppercase tracking-widest text-yellow-400">
                    {raidTickets}x RAID PASS READY
                  </p>
                  <p className="text-[9px] text-white/30 font-black uppercase">50% OFF ENTRY + 10% WIN BOOST — ACTIVE AT DEPLOYMENT</p>
                </>
              ) : (
                <>
                  <p className="text-[10px] font-black uppercase tracking-widest text-yellow-400">
                    RAID PASS — 50% OFF ENTRY FEE
                  </p>
                  <p className="text-[9px] text-white/30 font-black uppercase">BUY A PASS · PLAY MORE · WIN BIGGER</p>
                </>
              )}
            </div>

            <div className="shrink-0 flex items-center gap-1 text-yellow-500 group-hover:translate-x-0.5 transition-transform">
              <span className="text-[10px] font-black uppercase tracking-wider whitespace-nowrap">
                {raidTickets > 0 ? 'GET MORE' : 'GET PASS'}
              </span>
              <span className="font-black text-sm">→</span>
            </div>
          </button>

        {!isConnected && (
          <div className="mt-5 text-center">
            <p className="text-red-500 text-xs font-black uppercase bg-red-950/30 p-2 border border-red-500/30 inline-block animate-pulse">
              [!] UPLINK REQUIRED FOR DEPLOYMENT
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
                <span className="text-[10px] font-black uppercase text-white/50 tracking-widest">TREASURY_LIVE:</span>
                <span className="text-sm font-black mono text-[#14F195]">
                  {treasuryReserve !== null ? `${Number(treasuryReserve).toLocaleString()} SOL` : '—'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase text-white/50 tracking-widest">24H_PAYOUTS:</span>
                <span className="text-sm font-black mono text-white">
                  {treasury24h !== null ? `${Number(treasury24h).toFixed(2)} SOL` : '—'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase text-white/50 tracking-widest">STATUS:</span>
                <span className="text-sm font-black mono text-[#14F195]">SOLVENT</span>
              </div>
              {latestWin && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase text-white/50 tracking-widest">LATEST_WIN:</span>
                  <span className="text-sm font-black mono text-yellow-500">
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
              <span className="text-[#14F195] font-black text-xl italic">GO</span>
            </div>
          </div>

          <p className="text-[#14F195] font-black text-lg sm:text-2xl uppercase tracking-widest text-center animate-pulse mb-2">
            AWAITING_SIGNATURE
          </p>
          <p className="text-white/30 text-[10px] font-black uppercase tracking-[0.3em] text-center mb-8">
            APPROVE TRANSACTION IN YOUR WALLET
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

          <p className="mt-12 text-[9px] font-black uppercase tracking-[0.5em] text-white/10">
            DO_NOT_CLOSE_WINDOW
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
                <h2 className="text-base sm:text-2xl font-black uppercase italic tracking-tighter text-white">
                  MISSION_CONFIG
                </h2>
              </div>
              <button
                onClick={() => setShowModeModal(false)}
                className="text-white/20 hover:text-white px-2 text-xl font-black"
              >
                [X]
              </button>
            </div>

            {/* Scrollable body — min-h-0 is required for flex-1 overflow-y-auto to work correctly */}
            <div className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10">

                {/* ── Left Col: Settings ──────────────────────────────── */}
                <div className="space-y-5 sm:space-y-7">

                  {/* 01 Mode */}
                  <div className="space-y-2 sm:space-y-3">
                    <Label text="01 // OPERATION_MODE" />
                    <div className="space-y-1.5">
                      <ModeOption label="SOLO_RAID"   fee={ENTRY_FEES[Mode.SOLO]}       active={selectedMode === Mode.SOLO}       onClick={() => setSelectedMode(Mode.SOLO)} />
                      <ModeOption label="SQUAD_LINK"  fee={ENTRY_FEES[Mode.TEAM]}       active={selectedMode === Mode.TEAM}       onClick={() => setSelectedMode(Mode.TEAM)}       locked={currentLevel < 5} />
                      <ModeOption label="TOURNAMENT"  fee={ENTRY_FEES[Mode.TOURNAMENT]} active={selectedMode === Mode.TOURNAMENT} onClick={() => setSelectedMode(Mode.TOURNAMENT)} locked={currentLevel < 15} />
                    </div>
                  </div>

                  {/* 02 Difficulty */}
                  <div className="space-y-2 sm:space-y-3">
                    <Label text="02 // RISK_PARAMETERS" />
                    <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                      {Object.values(Difficulty).map((diff) => {
                        const config = DIFFICULTY_CONFIG[diff];
                        const active = selectedDifficulty === diff;
                        return (
                          <button
                            key={diff}
                            onClick={() => setSelectedDifficulty(diff)}
                            className={`p-2.5 sm:p-4 border tech-border text-left transition-all ${active ? `bg-white/10 border-white ${config.color}` : 'bg-black border-white/10 text-white/20 hover:border-white/30'}`}
                          >
                            <div className="flex justify-between items-start">
                              <span className="text-xs sm:text-sm font-black uppercase italic tracking-tight">{config.label}</span>
                              {active && <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />}
                            </div>
                            <span className="block text-[10px] sm:text-xs font-black uppercase tracking-widest opacity-60 mt-0.5 sm:mt-1">
                              MULT: {diff === Difficulty.EASY ? '0.8X' : diff === Difficulty.MEDIUM ? '1.0X' : diff === Difficulty.HARD ? '1.4X' : '2.5X'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 03 Boosts */}
                  <div className="space-y-2 sm:space-y-3">
                    <Label text="03 // PROTOCOL_INJECTIONS" />
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
                              <span className={`text-xs sm:text-sm mono font-black ${isActive ? 'text-yellow-500' : 'text-white/40'}`}>{boost.cost} S</span>
                            </div>
                            <p className={`text-[10px] sm:text-xs font-black uppercase italic leading-tight ${isActive ? 'text-white' : 'text-white/40'}`}>{boost.name}</p>
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
                    <Label text="04 // ACTIVE_LOADOUT" />
                    <span className="text-[10px] font-black uppercase text-white/30">{equippedGear.length}/4 SLOTS</span>
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
                      <p className="text-[10px] font-black uppercase text-white/30 mb-1.5 sm:mb-2">QUICK_SWAP</p>
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
                      <p className="text-[10px] font-black uppercase text-white/20">NO GEAR OWNED — VISIT STORE TO EQUIP</p>
                    </div>
                  )}

                  {/* Combat stats */}
                  <div className="p-3 sm:p-4 bg-black border border-white/10 tech-border mb-3">
                    <p className="text-[10px] font-black uppercase text-white/30 tracking-widest mb-2 sm:mb-3">COMBAT_ADVANTAGE</p>
                    <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-2 sm:mb-3">
                      <div className="text-center">
                        <p className="text-[9px] text-white/30 uppercase tracking-widest mb-1">MULTIPLIER</p>
                        <p className="font-black mono text-[#14F195] text-base sm:text-lg leading-none">{totalMult}x</p>
                      </div>
                      <div className="text-center border-x border-white/5">
                        <p className="text-[9px] text-white/30 uppercase tracking-widest mb-1">RISK_REDUC</p>
                        <p className="font-black mono text-cyan-400 text-base sm:text-lg leading-none">-{totalRiskReduc}%</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[9px] text-white/30 uppercase tracking-widest mb-1">RAID_TIME</p>
                        <p className="font-black mono text-purple-400 text-base sm:text-lg leading-none">{totalTime}s</p>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[9px] font-black uppercase text-white/30 mb-1">
                        <span>LOADOUT_POWER</span>
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
                <p className="text-[9px] text-white/30 font-black uppercase tracking-widest mb-1">PAY_WITH</p>
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
                        className={`py-2 px-1 border tech-border text-center transition-all ${active ? `${col} bg-white/5` : 'border-white/10 text-white/20 hover:border-white/30'}`}
                      >
                        <p className="text-[10px] font-black uppercase">{sym}</p>
                        <p className="text-[9px] mono text-white/40">{bal.toFixed(c === Currency.SKR ? 0 : 2)}</p>
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
                        <p className={`text-[10px] font-black uppercase tracking-wider ${applyTicket ? 'text-yellow-400' : 'text-white/50'}`}>USE TICKET</p>
                        <p className="text-[9px] text-white/30 font-black">50% OFF ENTRY + 10% WIN BOOST</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-white/40">{raidTickets}x LEFT</span>
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
                  <p className="text-[9px] text-white/30 font-black uppercase tracking-widest mb-0.5">ENTRY_COST</p>
                  <p className="text-xl font-black mono text-white leading-none">
                    {totalCostDisplay.toFixed(currencyDecimals)}{' '}
                    <span className={`text-sm ${entryCurrency === Currency.SOL ? 'text-[#14F195]' : entryCurrency === Currency.USDC ? 'text-blue-400' : 'text-orange-400'}`}>{currencySymbol}</span>
                  </p>
                  {applyTicket && (
                    <p className="text-[9px] text-yellow-500 font-black uppercase mt-0.5">🎟️ TICKET DISCOUNT ACTIVE</p>
                  )}
                  {currentBalance < totalCostDisplay && totalCostSol > 0 && (
                    <p className="text-[9px] text-red-500 font-black uppercase mt-0.5">INSUFFICIENT</p>
                  )}
                </div>
                <button
                  onClick={handleDeploy}
                  disabled={totalCostSol > 0 && currentBalance < totalCostDisplay}
                  className="flex-1 py-4 bg-[#14F195] text-black font-black uppercase tracking-tighter text-base sm:text-xl tech-border hover:bg-[#10c479] active:translate-y-0.5 transition-all shadow-[0_0_30px_rgba(20,241,149,0.3)] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:translate-y-0"
                >
                  CONFIRM_DEPLOYMENT
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
  <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] italic">{text}</p>
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
    className={`w-full flex justify-between items-center p-3 sm:p-4 border tech-border transition-all group ${
      locked
        ? 'opacity-40 cursor-not-allowed border-white/5 bg-transparent'
        : active
        ? 'bg-cyan-500/10 border-cyan-500'
        : 'bg-black border-white/10 hover:border-white/30'
    }`}
  >
    <div className="text-left">
      <span className={`text-sm sm:text-base font-black uppercase italic ${active ? 'text-cyan-400' : 'text-white'}`}>
        {label}
      </span>
      {locked && (
        <span className="ml-2 text-[9px] text-red-500 font-bold uppercase bg-red-950/30 px-1">LOCKED</span>
      )}
    </div>
    <div className="flex flex-col items-end shrink-0 ml-2">
      <span className="mono text-xs sm:text-sm font-black text-white/60">{fee} SOL</span>
      {active && <span className="text-[9px] text-cyan-500 font-black uppercase tracking-wider">SELECTED</span>}
    </div>
  </button>
);

export default LobbyScreen;
