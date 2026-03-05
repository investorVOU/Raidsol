
import React, { useState } from 'react';
import { ENTRY_FEES, Mode, Difficulty, Currency } from '../types';
import type { LivePrices } from '../hooks/usePrices';
import { useLeaderboard, LeaderboardPeriod } from '../hooks/useLeaderboard';
import { useRoundHistory } from '../hooks/useRoundHistory';
import { formatRoundWindow, formatCountdown } from '../hooks/useRoundData';
import type { CurrentRoundInfo } from '../hooks/useRoundData';

type RoundsTier = 'GRUNT' | 'ELITE' | 'WHALE';

interface TournamentScreenProps {
  onEnterRaid: (mode: Mode, difficulty: Difficulty, boosts: string[], currency: Currency) => void;
  walletBalance: number;
  usdcBalance: number;
  skrBalance: number;
  rankLevel: number;
  rankTitle: string;
  srPoints: number;
  walletAddress?: string;
  currencyRates?: LivePrices['currencyRates'];
  currentRound?: CurrentRoundInfo | null;
}

const CURRENCY_LABELS: Record<Currency, string> = {
  [Currency.SOL]: 'SOL', [Currency.USDC]: 'USDC', [Currency.SKR]: 'SKR',
};
const TOURNAMENT_FEE = ENTRY_FEES[Mode.TOURNAMENT];
const TOURNAMENT_MIN_LEVEL = 15;
const PERIOD_LABELS: { id: LeaderboardPeriod; label: string; srLabel: string }[] = [
  { id: 'alltime', label: 'All Time', srLabel: 'Total SR' },
  { id: 'weekly',  label: 'Weekly',   srLabel: 'SR This Week' },
  { id: 'monthly', label: 'Monthly',  srLabel: 'SR This Month' },
  { id: 'skr',     label: 'SKR',       srLabel: 'Total SR'     },
];
const ALLOC_PCT  = [40, 25, 18, 11, 6];
const RANK_MEDALS = ['🥇', '🥈', '🥉', '4th', '5th'];
const RANK_COLORS = ['text-yellow-400', 'text-white', 'text-orange-400', 'text-white', 'text-white'];

function AvatarImg({ src, size }: { src: string | null; size: number }) {
  if (!src) return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
      style={{ width: size * 0.5, height: size * 0.5 }} className="text-white">
      <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
  const isEmoji = !src.startsWith('http');
  if (isEmoji) return (
    <span style={{ fontSize: size * 0.5 }} className="flex items-center justify-center w-full h-full leading-none select-none">
      {src}
    </span>
  );
  return <img src={src} alt="" style={{ width: size, height: size }} className="object-cover" loading="lazy" />;
}

const TournamentScreen: React.FC<TournamentScreenProps> = ({
  onEnterRaid, walletBalance, usdcBalance, skrBalance,
  rankLevel, rankTitle, srPoints, walletAddress, currencyRates, currentRound,
}) => {
  const rates = currencyRates ?? { [Currency.SOL]: 1, [Currency.USDC]: 0, [Currency.SKR]: 0 };
  const [mainTab,    setMainTab]   = useState<'leaderboard' | 'rounds'>('leaderboard');
  const [period,     setPeriod]    = useState<LeaderboardPeriod>('alltime');
  const [showEntry,  setShowEntry] = useState(false);
  const [currency,   setCurrency]  = useState<Currency>(Currency.SOL);
  const [lbPage,     setLbPage]    = useState(0);
  const [roundsPage, setRoundsPage] = useState(0);
  const [roundsTier, setRoundsTier] = useState<RoundsTier>('GRUNT');

  const handleSetPeriod = (p: LeaderboardPeriod) => { setPeriod(p); setLbPage(0); };
  const handleSetRoundsTier = (t: RoundsTier) => { setRoundsTier(t); setRoundsPage(0); };

  const { entries, loading, hasMore: lbHasMore } = useLeaderboard(period, lbPage);
  const { rounds: historicalRounds, loading: roundsLoading, hasMore: roundsHasMore } = useRoundHistory(roundsTier, roundsPage);

  const top3 = entries.slice(0, 3);
  const rest  = entries.slice(3);
  const srLabel = PERIOD_LABELS.find(p => p.id === period)?.srLabel ?? 'Total SR';

  const feeInCurrency  = TOURNAMENT_FEE * rates[currency];
  const pricesLoading  = currency !== Currency.SOL && rates[currency] === 0;
  const balanceMap: Record<Currency, number> = {
    [Currency.SOL]: walletBalance, [Currency.USDC]: usdcBalance, [Currency.SKR]: skrBalance,
  };
  const currentBalance = balanceMap[currency];
  const canAfford      = !pricesLoading && currentBalance >= feeInCurrency;
  const isLocked       = rankLevel < TOURNAMENT_MIN_LEVEL;

  const handleConfirm = () => { setShowEntry(false); onEnterRaid(Mode.TOURNAMENT, Difficulty.HARD, [], currency); };

  // ── ENTRY MODAL ──────────────────────────────────────────────────────────
  if (showEntry) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-5 animate-in zoom-in-95 duration-200">
        <div className="w-full max-w-sm">
          {isLocked ? (
            <div className="rounded-2xl bg-[#0a0a1a] border border-[#9945FF]/30 p-8 text-center shadow-2xl">
              <div className="text-5xl mb-4">🔒</div>
              <h3 className="text-xl font-black text-white mb-1">Locked</h3>
              <p className="text-white text-sm mb-6">
                Tournament unlocks at <span className="text-[#9945FF] font-bold">Level {TOURNAMENT_MIN_LEVEL}</span>
              </p>
              <div className="bg-white/5 rounded-xl p-4 mb-6 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-white">Your rank</span><span className="text-white font-bold">Lv.{rankLevel} {rankTitle}</span></div>
                <div className="flex justify-between"><span className="text-white">Required</span><span className="text-[#9945FF] font-bold">Lv.{TOURNAMENT_MIN_LEVEL} Commander</span></div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden mt-2">
                  <div className="h-full bg-[#9945FF] rounded-full transition-all" style={{ width: `${Math.min(100, (srPoints / 7000) * 100)}%` }} />
                </div>
                <p className="text-xs text-white text-right">{srPoints.toLocaleString()} / 7,000 SR</p>
              </div>
              <button onClick={() => setShowEntry(false)} className="w-full py-3 rounded-xl border border-white/10 text-white font-bold hover:text-white transition-colors">← Back</button>
            </div>
          ) : (
            <>
              <div className="text-center mb-5">
                <p className="text-xs text-[#9945FF]/70 font-bold uppercase tracking-widest mb-1">Mega Raid Series</p>
                <h3 className="text-2xl font-black text-white">Tournament Entry</h3>
              </div>
              <div className="rounded-2xl bg-[#0a0a1a] border border-[#9945FF]/30 p-5 space-y-4 shadow-2xl">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white">Difficulty</span>
                  <span className="text-sm font-bold text-orange-400 bg-orange-500/10 border border-orange-500/30 rounded-lg px-3 py-1">⚡ Hardcore</span>
                </div>
                <div className="flex items-center justify-between border-t border-white/5 pt-3">
                  <span className="text-sm text-white">Entry Fee</span>
                  <span className="text-lg font-black text-white">{feeInCurrency % 1 === 0 ? feeInCurrency.toFixed(0) : feeInCurrency.toFixed(3)} <span className="text-white text-sm">{CURRENCY_LABELS[currency]}</span></span>
                </div>
                <div>
                  <p className="text-xs text-white font-bold uppercase mb-2">Pay with</p>
                  <div className="grid grid-cols-3 gap-2">
                    {([Currency.SOL, Currency.USDC, Currency.SKR] as Currency[]).map(c => {
                      const bal = balanceMap[c];
                      const cFee = TOURNAMENT_FEE * rates[c];
                      const cLoading = c !== Currency.SOL && rates[c] === 0;
                      const ok  = !cLoading && bal >= cFee;
                      return (
                        <button key={c} onClick={() => setCurrency(c)}
                          className={`py-2.5 rounded-xl font-bold text-xs border-2 transition-all flex flex-col items-center gap-0.5 ${currency === c ? 'bg-[#9945FF]/12 border-[#9945FF]/50 text-white' : 'bg-white/3 border-white/10 text-white hover:border-white/25'}`}>
                          <span>{CURRENCY_LABELS[c]}</span>
                          <span className={`text-[9px] font-bold ${cLoading ? 'text-white animate-pulse' : ok ? 'text-white' : 'text-[#9945FF]/60'}`}>{cLoading ? '…' : bal.toFixed(c === Currency.SOL ? 3 : 1)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="rounded-xl bg-white/3 border border-white/5 p-3 space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-white">Your balance</span><span className={currentBalance < feeInCurrency ? 'text-[#9945FF] font-bold' : 'text-white'}>{currentBalance.toFixed(currency === Currency.SOL ? 4 : 2)} {CURRENCY_LABELS[currency]}</span></div>
                  <div className="flex justify-between"><span className="text-white">Entry cost</span><span className="text-[#FFB800] font-bold">{pricesLoading ? <span className="animate-pulse text-white">…</span> : <>{feeInCurrency.toFixed(3)} {CURRENCY_LABELS[currency]}</>}</span></div>
                  {!pricesLoading && !canAfford && <p className="text-xs text-[#9945FF] font-bold text-right">Insufficient funds</p>}
                </div>
                <button onClick={handleConfirm} disabled={pricesLoading || !canAfford}
                  className={`w-full py-4 rounded-xl font-black text-base transition-all ${!pricesLoading && canAfford ? 'text-white active:scale-95' : 'bg-white/5 text-white cursor-not-allowed'}`} style={!pricesLoading && canAfford ? { background: 'linear-gradient(135deg, #9945FF 0%, #7c2dd6 100%)', boxShadow: '0 0 25px rgba(153,69,255,0.30)' } : {}}>
                  {pricesLoading ? 'Fetching prices…' : canAfford ? 'Confirm Entry →' : 'Insufficient Funds'}
                </button>
              </div>
              <button onClick={() => setShowEntry(false)} className="w-full mt-3 py-3 text-white font-bold text-sm hover:text-white transition-colors">← Cancel</button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── MAIN VIEW ────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col animate-in slide-in-from-right duration-300 overflow-hidden" style={{ backgroundColor: 'var(--app-bg)' }}>

      {/* HEADER */}
      <div className="shrink-0 px-4 pt-5 pb-3" style={{ backgroundColor: 'var(--app-bg)' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-black text-white leading-none">Rankings</h2>
            <p className="text-xs text-white mt-0.5">Global player standings</p>
          </div>
          <div className="flex items-center gap-1.5 bg-[#9945FF]/10 rounded-full px-3 py-1.5">
            <div className="w-1.5 h-1.5 bg-[#9945FF] rounded-full animate-pulse" />
            <span className="text-[10px] font-bold text-[#9945FF]">Live</span>
          </div>
        </div>

        {/* Main tab switcher */}
        <div className="flex gap-2 p-1 bg-white/5 rounded-xl">
          {([
            { id: 'leaderboard', label: '🏆  Leaderboard' },
            { id: 'rounds',      label: '⚔️  Rounds'      },
          ] as const).map(tab => (
            <button key={tab.id} onClick={() => setMainTab(tab.id)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${mainTab === tab.id ? 'bg-white text-black shadow-sm' : 'text-white hover:text-white'}`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Period sub-tabs — only shown inside leaderboard tab */}
        {mainTab === 'leaderboard' && (
          <div className="flex gap-1.5 mt-3">
            {PERIOD_LABELS.map(p => (
              <button key={p.id} onClick={() => handleSetPeriod(p.id)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all border ${period === p.id ? 'bg-[#9945FF]/12 border-[#9945FF]/40 text-[#9945FF]' : 'border-white/8 text-white hover:text-white hover:border-white/15'}`}>
                {p.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* SCROLL BODY */}
      <div className="flex-1 overflow-y-auto scrollbar-hide px-4 py-3 pb-36 space-y-3">

        {/* SKR holders banner */}
        {mainTab === 'leaderboard' && period === 'skr' && (
          <div className="rounded-xl p-3 flex items-center gap-3" style={{ background: 'rgba(255,184,0,0.06)', border: '1px solid rgba(255,184,0,0.20)' }}>
            <span className="text-xl shrink-0"></span>
            <div>
              <p className="text-xs font-black text-[#FFB800]">Seeker Domain Holders</p>
              <p className="text-[10px] text-white mt-0.5">Raiders with a verified .skr domain — top 50 by SR</p>
            </div>
          </div>
        )}

        {/* ── LEADERBOARD TAB ─────────────────────────────────── */}
        {mainTab === 'leaderboard' && (loading ? (
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="rounded-xl bg-white/3 border border-white/5 p-4 animate-pulse flex items-center gap-3">
                <div className="w-7 h-4 bg-white/5 rounded shrink-0" />
                <div className="w-10 h-10 rounded-full bg-white/5 shrink-0" />
                <div className="flex-1 space-y-1.5"><div className="h-3 bg-white/5 rounded w-2/5" /><div className="h-2 bg-white/5 rounded w-1/4" /></div>
                <div className="w-14 h-4 bg-white/5 rounded shrink-0" />
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="text-5xl mb-4">🏴</div>
            <p className="text-white font-bold text-sm">No players yet</p>
            <p className="text-white text-xs mt-1">{period === 'skr' ? 'No .skr domain holders yet.' : period === 'alltime' ? 'Be the first to raid.' : 'No raids this period.'}</p>
          </div>
        ) : (
          <>
            {/* TOP 3 podium — only on first page */}
            {lbPage === 0 && top3.map((entry, idx) => {
              const podiumStyles = [
                { border: 'border-yellow-500/50', bg: 'bg-gradient-to-r from-yellow-500/8 to-transparent', glow: 'shadow-[0_0_20px_rgba(234,179,8,0.08)]', ring: 'ring-2 ring-yellow-400/50', numColor: 'text-yellow-400' },
                { border: 'border-white/15',      bg: 'bg-white/[0.02]',                                   glow: '',                                        ring: 'ring-1 ring-white/15',           numColor: 'text-white'  },
                { border: 'border-orange-500/35', bg: 'bg-gradient-to-r from-orange-500/6 to-transparent', glow: 'shadow-[0_0_15px_rgba(249,115,22,0.06)]', ring: 'ring-2 ring-orange-400/35',      numColor: 'text-orange-400'},
              ];
              const s = podiumStyles[idx];
              const isMe = walletAddress === entry.wallet_address;
              const medals = ['🥇', '🥈', '🥉'];
              return (
                <div key={entry.wallet_address} className={`rounded-2xl border-2 ${s.border} ${s.bg} ${s.glow} p-4 flex items-center gap-3`}>
                  <div className={`shrink-0 w-7 text-center font-black text-xl ${s.numColor}`}>{medals[idx]}</div>
                  <div className={`shrink-0 w-12 h-12 rounded-full overflow-hidden bg-white/5 flex items-center justify-center ${s.ring}`}>
                    <AvatarImg src={entry.avatarImage} size={48} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-black text-sm text-white leading-none truncate">{entry.username}</p>
                      {isMe && <span className="text-[9px] font-bold bg-[#9945FF]/15 text-[#9945FF] border border-[#9945FF]/25 rounded-full px-1.5 py-0.5 shrink-0">you</span>}
                      {entry.skr_domain && <span className="text-[8px] font-black text-[#FFB800] border border-[#FFB800]/30 bg-[#FFB800]/10 rounded-full px-1.5 py-0.5 shrink-0">{entry.skr_domain}</span>}
                    </div>
                    <p className="text-[10px] font-bold mt-0.5" style={{ color: entry.rank_color }}>Lv.{entry.rank_level} {entry.rank_title}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`font-black text-lg leading-none ${s.numColor}`}>{entry.sr_points.toLocaleString()}</p>
                    <p className="text-[9px] text-white mt-0.5">{srLabel}</p>
                  </div>
                </div>
              );
            })}

            {/* Remaining rows (4+ on page 0, all on subsequent pages) */}
            {(lbPage === 0 ? rest : entries).length > 0 && (
              <div className="rounded-2xl border border-white/8 overflow-hidden divide-y divide-white/5">
                {(lbPage === 0 ? rest : entries).map((entry, idx) => {
                  const place = lbPage === 0 ? idx + 4 : lbPage * 20 + idx + 1;
                  const isMe  = walletAddress === entry.wallet_address;
                  return (
                    <div key={entry.wallet_address} className={`flex items-center gap-3 px-4 py-3 hover:bg-white/3 transition-colors ${isMe ? 'bg-[#9945FF]/5' : ''}`}>
                      <span className="w-6 text-xs font-bold text-white text-center shrink-0">#{place}</span>
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-white/5 shrink-0 flex items-center justify-center ring-1 ring-white/8">
                        <AvatarImg src={entry.avatarImage} size={32} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-bold text-sm text-white truncate">{entry.username}</p>
                          {isMe && <span className="text-[8px] font-bold bg-[#9945FF]/10 text-[#9945FF] rounded-full px-1.5 py-0.5 shrink-0">you</span>}
                          {entry.skr_domain && <span className="text-[8px] font-black text-[#FFB800] border border-[#FFB800]/25 bg-[#FFB800]/8 rounded-full px-1.5 py-0.5 shrink-0">{entry.skr_domain}</span>}
                        </div>
                        <p className="text-[9px] font-medium" style={{ color: entry.rank_color }}>Lv.{entry.rank_level} {entry.rank_title}</p>
                      </div>
                      <p className="font-bold text-sm text-white shrink-0">{entry.sr_points.toLocaleString()}</p>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Leaderboard pagination */}
            {(lbPage > 0 || lbHasMore) && (
              <div className="flex items-center justify-between gap-3 pt-1">
                <button
                  onClick={() => setLbPage(p => p - 1)}
                  disabled={lbPage === 0}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all border border-white/10 text-white disabled:opacity-30 disabled:cursor-not-allowed hover:enabled:border-white/25 hover:enabled:text-white active:enabled:scale-95"
                >
                  ← Prev
                </button>
                <span className="text-xs text-white font-bold shrink-0">Page {lbPage + 1}</span>
                <button
                  onClick={() => setLbPage(p => p + 1)}
                  disabled={!lbHasMore}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all border border-white/10 text-white disabled:opacity-30 disabled:cursor-not-allowed hover:enabled:border-white/25 hover:enabled:text-white active:enabled:scale-95"
                >
                  Next →
                </button>
              </div>
            )}
          </>
        ))}

        {/* ── ROUNDS TAB ──────────────────────────────────────── */}
        {mainTab === 'rounds' && (
          <>
            {/* Tier selector */}
            <div className="flex gap-2">
              {(['GRUNT', 'ELITE', 'WHALE'] as const).map(t => (
                <button key={t} onClick={() => handleSetRoundsTier(t)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${roundsTier === t ? 'bg-[#9945FF]/12 border-[#9945FF]/40 text-[#9945FF]' : 'border-white/8 text-white hover:text-white hover:border-white/15'}`}>
                  {t}
                </button>
              ))}
            </div>

            {/* Live current round — always shown first */}
            {currentRound && currentRound.isActive && (
              <div className="rounded-2xl border-2 overflow-hidden" style={{ borderColor: 'rgba(153,69,255,0.40)', background: 'rgba(153,69,255,0.04)' }}>
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#9945FF]/15">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#9945FF] animate-pulse" style={{ boxShadow: '0 0 6px rgba(153,69,255,0.7)' }} />
                    <span className="text-xs font-black text-[#9945FF] uppercase tracking-wide">Live — Round {currentRound.roundNum}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] text-white font-bold">Closes in</p>
                    <p className="mono text-xs font-black text-white">{formatCountdown(currentRound.timeRemainingMs)}</p>
                  </div>
                </div>

                {currentRound.currentLeaders.length === 0 ? (
                  <div className="px-4 py-5 text-center">
                    <p className="text-xs text-white/50">No entries yet — be first to raid</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {currentRound.currentLeaders.map(e => {
                      const isMe = walletAddress === e.walletAddress;
                      const r0 = e.rank - 1;
                      return (
                        <div key={e.walletAddress} className={`flex items-center gap-3 px-4 py-2.5 ${isMe ? 'bg-[#9945FF]/8' : ''}`}>
                          <span className={`shrink-0 text-base w-6 text-center ${RANK_COLORS[r0] ?? 'text-white'}`}>
                            {e.rank <= 3 ? RANK_MEDALS[r0] : `#${e.rank}`}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="font-bold text-sm text-white truncate">{e.username}</p>
                              {isMe && <span className="text-[8px] font-bold text-[#9945FF] bg-[#9945FF]/10 rounded-full px-1.5 shrink-0">you</span>}
                            </div>
                            <p className="text-[9px] text-white/50">{ALLOC_PCT[r0] ?? 0}% of pool</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs font-bold text-white">{e.pointsScored.toLocaleString()} <span className="text-[9px] text-white/50">pts</span></p>
                            <p className="text-xs font-black text-[#FFB800]">{e.allocationSol.toFixed(4)} <span className="text-[9px] text-[#FFB800]/60">SOL</span></p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="flex items-center justify-between px-4 py-2 border-t border-[#9945FF]/10">
                  <span className="text-[9px] text-white/50 font-bold">Prize pool</span>
                  <span className="mono text-sm font-black text-[#FFB800]">{currentRound.poolSol.toFixed(4)} SOL</span>
                </div>
              </div>
            )}

            {roundsLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="rounded-2xl bg-white/3 border border-white/5 p-5 animate-pulse">
                    <div className="h-4 bg-white/5 rounded w-1/3 mb-3" />
                    {[...Array(3)].map((_, j) => <div key={j} className="h-3 bg-white/5 rounded w-full mb-2" />)}
                  </div>
                ))}
              </div>
            ) : historicalRounds.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="text-5xl mb-4">⏳</div>
                <p className="text-white font-bold text-sm">No completed rounds yet</p>
                <p className="text-white text-xs mt-1">{roundsPage > 0 ? 'No more rounds on this page.' : `${roundsTier} rounds complete every 6 hours.`}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {historicalRounds.map((round, ri) => {
                  const dateLabel = round.startTime.toLocaleDateString('en-US', {
                    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
                  });
                  const roundGradients = [
                    'from-yellow-500/10 via-yellow-500/5 to-transparent border-yellow-500/35',
                    'from-white/8 via-white/4 to-transparent border-white/18',
                    'from-[#9945FF]/8 via-[#9945FF]/4 to-transparent border-[#9945FF]/25',
                    'from-orange-500/8 via-orange-500/4 to-transparent border-orange-500/25',
                  ];
                  const roundBadgeColors = ['bg-yellow-500 text-black', 'bg-white/20 text-white', 'bg-[#9945FF] text-white', 'bg-orange-500 text-white'];

                  return (
                    <div key={`${round.roundNum}-${round.roundDate}`}
                      className={`rounded-2xl bg-gradient-to-br ${roundGradients[ri % 4]} border overflow-hidden`}>

                      {/* Round header */}
                      <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
                        <div className="flex items-center gap-3">
                          <span className={`text-xs font-black px-2.5 py-1 rounded-full ${roundBadgeColors[ri % 4]}`}>
                            Round {round.roundNum}
                          </span>
                          <div>
                            <p className="text-xs font-bold text-white">{dateLabel}</p>
                            <p className="text-[9px] text-white">{formatRoundWindow(round.roundNum)}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          {round.refunded ? (
                            <span className="text-[9px] font-bold text-white bg-white/5 border border-white/10 rounded-full px-2 py-0.5">Cancelled</span>
                          ) : (
                            <>
                              <p className="text-[9px] text-white font-bold">Pool</p>
                              <p className="text-base font-black text-[#FFB800] leading-none">
                                {round.poolSol.toFixed(3)} <span className="text-[10px] text-[#FFB800]/60">SOL</span>
                              </p>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Winners */}
                      <div className="divide-y divide-white/5">
                        {round.refunded ? (
                          <div className="px-4 py-4 text-center">
                            <p className="text-xs text-white italic">Not enough entrants — entry fees refunded</p>
                          </div>
                        ) : round.entries.length === 0 ? (
                          <div className="px-4 py-4 text-center">
                            <p className="text-xs text-white italic">No extractions this round</p>
                          </div>
                        ) : round.entries.map(entry => {
                          const isMe = walletAddress === entry.walletAddress;
                          const r0 = entry.rank - 1;
                          return (
                            <div key={entry.walletAddress}
                              className={`flex items-center gap-3 px-4 py-2.5 ${isMe ? 'bg-[#9945FF]/5' : ''}`}>
                              <span className={`shrink-0 text-base w-6 text-center ${RANK_COLORS[r0]}`}>
                                {entry.rank <= 3 ? RANK_MEDALS[r0] : `#${entry.rank}`}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <p className="font-bold text-sm text-white truncate">{entry.username}</p>
                                  {isMe && <span className="text-[8px] font-bold text-[#9945FF] bg-[#9945FF]/10 rounded-full px-1.5 shrink-0">you</span>}
                                </div>
                                <p className="text-[9px] text-white">{ALLOC_PCT[r0]}% of pool</p>
                              </div>
                              <div className="text-right shrink-0 flex flex-col items-end gap-0.5">
                                <p className="text-xs font-bold text-white">
                                  {entry.pointsScored.toLocaleString()}
                                  <span className="text-white text-[9px] ml-0.5">pts</span>
                                </p>
                                <p className={`text-xs font-black ${RANK_COLORS[r0]}`}>
                                  +{entry.allocationSol.toFixed(4)}
                                  <span className="text-[9px] ml-0.5 opacity-60">SOL</span>
                                </p>
                                <span className={`text-[7px] font-bold rounded-full px-1.5 py-0.5 leading-tight ${entry.claimed ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-[#FFB800]/10 text-[#FFB800] border border-[#FFB800]/20'}`}>
                                  {entry.claimed ? 'claimed' : 'unclaimed'}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {/* Rounds pagination */}
                {(roundsPage > 0 || roundsHasMore) && (
                  <div className="flex items-center justify-between gap-3 pt-1">
                    <button
                      onClick={() => setRoundsPage(p => p - 1)}
                      disabled={roundsPage === 0}
                      className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all border border-white/10 text-white disabled:opacity-30 disabled:cursor-not-allowed hover:enabled:border-white/25 hover:enabled:text-white active:enabled:scale-95"
                    >
                      ← Prev
                    </button>
                    <span className="text-xs text-white font-bold shrink-0">Page {roundsPage + 1}</span>
                    <button
                      onClick={() => setRoundsPage(p => p + 1)}
                      disabled={!roundsHasMore}
                      className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all border border-white/10 text-white disabled:opacity-30 disabled:cursor-not-allowed hover:enabled:border-white/25 hover:enabled:text-white active:enabled:scale-95"
                    >
                      Next →
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* FOOTER */}
      <div className="shrink-0 px-4 py-4 border-t border-white/5" style={{ backgroundColor: 'var(--app-bg)' }}>
        <button onClick={() => setShowEntry(true)}
          className={`w-full py-4 rounded-2xl font-black text-base transition-all flex items-center justify-center gap-2 ${
            isLocked
              ? 'bg-white/5 border border-white/10 text-white'
              : 'text-white active:scale-[0.98]'
          }`}
          style={{ background: isLocked ? undefined : 'linear-gradient(135deg, #9945FF 0%, #7c2dd6 100%)', boxShadow: isLocked ? undefined : '0 0 25px rgba(153,69,255,0.25)' }}>
          {isLocked ? <>🔒 Locked — Lv.{TOURNAMENT_MIN_LEVEL} Required</> : <>⚔️ Enter Tournament</>}
        </button>
        <p className="text-center text-[10px] text-white mt-2">
          {isLocked ? `Reach Level ${TOURNAMENT_MIN_LEVEL} to unlock` : `${TOURNAMENT_FEE} SOL entry · Hardcore difficulty`}
        </p>
      </div>
    </div>
  );
};

export default TournamentScreen;
