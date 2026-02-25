
import React, { useState } from 'react';
import { ENTRY_FEES, Mode, Difficulty, Currency } from '../types';
import type { LivePrices } from '../hooks/usePrices';
import { useLeaderboard, LeaderboardPeriod } from '../hooks/useLeaderboard';
import { useRoundHistory } from '../hooks/useRoundHistory';
import { formatRoundWindow } from '../hooks/useRoundData';

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
  { id: 'skr',     label: '✦ SKR',    srLabel: 'Total SR'     },
];
const ALLOC_PCT  = [40, 25, 18, 11, 6];
const RANK_MEDALS = ['🥇', '🥈', '🥉', '4th', '5th'];
const RANK_COLORS = ['text-yellow-400', 'text-slate-300', 'text-orange-400', 'text-white/50', 'text-white/40'];

function AvatarImg({ src, size }: { src: string | null; size: number }) {
  if (!src) return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
      style={{ width: size * 0.5, height: size * 0.5 }} className="text-white/25">
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
  rankLevel, rankTitle, srPoints, walletAddress, currencyRates,
}) => {
  const rates = currencyRates ?? { [Currency.SOL]: 1, [Currency.USDC]: 0, [Currency.SKR]: 0 };
  const [mainTab,   setMainTab]   = useState<'leaderboard' | 'rounds'>('leaderboard');
  const [period,    setPeriod]    = useState<LeaderboardPeriod>('alltime');
  const [showEntry, setShowEntry] = useState(false);
  const [currency,  setCurrency]  = useState<Currency>(Currency.SOL);

  const { entries, loading } = useLeaderboard(period);
  const { rounds: historicalRounds, loading: roundsLoading } = useRoundHistory(8);

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
            <div className="rounded-2xl bg-[#0f0f1a] border border-red-500/30 p-8 text-center shadow-2xl">
              <div className="text-5xl mb-4">🔒</div>
              <h3 className="text-xl font-black text-white mb-1">Locked</h3>
              <p className="text-white/50 text-sm mb-6">
                Tournament unlocks at <span className="text-[#FF2929] font-bold">Level {TOURNAMENT_MIN_LEVEL}</span>
              </p>
              <div className="bg-white/5 rounded-xl p-4 mb-6 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-white/40">Your rank</span><span className="text-white font-bold">Lv.{rankLevel} {rankTitle}</span></div>
                <div className="flex justify-between"><span className="text-white/40">Required</span><span className="text-[#FF2929] font-bold">Lv.{TOURNAMENT_MIN_LEVEL} Commander</span></div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden mt-2">
                  <div className="h-full bg-[#FF2929] rounded-full transition-all" style={{ width: `${Math.min(100, (srPoints / 7000) * 100)}%` }} />
                </div>
                <p className="text-xs text-white/30 text-right">{srPoints.toLocaleString()} / 7,000 SR</p>
              </div>
              <button onClick={() => setShowEntry(false)} className="w-full py-3 rounded-xl border border-white/10 text-white/50 font-bold hover:text-white/70 transition-colors">← Back</button>
            </div>
          ) : (
            <>
              <div className="text-center mb-5">
                <p className="text-xs text-[#FF2929]/70 font-bold uppercase tracking-widest mb-1">Mega Raid Series</p>
                <h3 className="text-2xl font-black text-white">Tournament Entry</h3>
              </div>
              <div className="rounded-2xl bg-[#0f0f1a] border border-[#FF2929]/30 p-5 space-y-4 shadow-2xl">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/50">Difficulty</span>
                  <span className="text-sm font-bold text-orange-400 bg-orange-500/10 border border-orange-500/30 rounded-lg px-3 py-1">⚡ Hardcore</span>
                </div>
                <div className="flex items-center justify-between border-t border-white/5 pt-3">
                  <span className="text-sm text-white/50">Entry Fee</span>
                  <span className="text-lg font-black text-white">{feeInCurrency % 1 === 0 ? feeInCurrency.toFixed(0) : feeInCurrency.toFixed(3)} <span className="text-white/50 text-sm">{CURRENCY_LABELS[currency]}</span></span>
                </div>
                <div>
                  <p className="text-xs text-white/40 font-bold uppercase mb-2">Pay with</p>
                  <div className="grid grid-cols-3 gap-2">
                    {([Currency.SOL, Currency.USDC, Currency.SKR] as Currency[]).map(c => {
                      const bal = balanceMap[c];
                      const cFee = TOURNAMENT_FEE * rates[c];
                      const cLoading = c !== Currency.SOL && rates[c] === 0;
                      const ok  = !cLoading && bal >= cFee;
                      return (
                        <button key={c} onClick={() => setCurrency(c)}
                          className={`py-2.5 rounded-xl font-bold text-xs border-2 transition-all flex flex-col items-center gap-0.5 ${currency === c ? 'bg-[#FF2929]/12 border-[#FF2929]/50 text-white' : 'bg-white/3 border-white/10 text-white/50 hover:border-white/25'}`}>
                          <span>{CURRENCY_LABELS[c]}</span>
                          <span className={`text-[9px] font-bold ${cLoading ? 'text-white/25 animate-pulse' : ok ? 'text-white/50' : 'text-red-400/60'}`}>{cLoading ? '…' : bal.toFixed(c === Currency.SOL ? 3 : 1)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="rounded-xl bg-white/3 border border-white/5 p-3 space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-white/40">Your balance</span><span className={currentBalance < feeInCurrency ? 'text-red-400 font-bold' : 'text-white/70'}>{currentBalance.toFixed(currency === Currency.SOL ? 4 : 2)} {CURRENCY_LABELS[currency]}</span></div>
                  <div className="flex justify-between"><span className="text-white/40">Entry cost</span><span className="text-[#FFB800] font-bold">{pricesLoading ? <span className="animate-pulse text-white/30">…</span> : <>{feeInCurrency.toFixed(3)} {CURRENCY_LABELS[currency]}</>}</span></div>
                  {!pricesLoading && !canAfford && <p className="text-xs text-red-400 font-bold text-right">Insufficient funds</p>}
                </div>
                <button onClick={handleConfirm} disabled={pricesLoading || !canAfford}
                  className={`w-full py-4 rounded-xl font-black text-base transition-all ${!pricesLoading && canAfford ? 'text-white active:scale-95' : 'bg-white/5 text-white/30 cursor-not-allowed'}`} style={!pricesLoading && canAfford ? { background: 'linear-gradient(135deg, #FF2929 0%, #CC0000 100%)', boxShadow: '0 0 25px rgba(255,41,41,0.30)' } : {}}>
                  {pricesLoading ? 'Fetching prices…' : canAfford ? 'Confirm Entry →' : 'Insufficient Funds'}
                </button>
              </div>
              <button onClick={() => setShowEntry(false)} className="w-full mt-3 py-3 text-white/40 font-bold text-sm hover:text-white/60 transition-colors">← Cancel</button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── MAIN VIEW ────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col animate-in slide-in-from-right duration-300 overflow-hidden bg-[#050508]">

      {/* HEADER */}
      <div className="shrink-0 px-4 pt-5 pb-3 bg-[#050508]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-black text-white leading-none">Rankings</h2>
            <p className="text-xs text-white/30 mt-0.5">Global player standings</p>
          </div>
          <div className="flex items-center gap-1.5 bg-[#FF2929]/10 rounded-full px-3 py-1.5">
            <div className="w-1.5 h-1.5 bg-[#FF2929] rounded-full animate-pulse" />
            <span className="text-[10px] font-bold text-[#FF2929]">Live</span>
          </div>
        </div>

        {/* Main tab switcher */}
        <div className="flex gap-2 p-1 bg-white/5 rounded-xl">
          {([
            { id: 'leaderboard', label: '🏆  Leaderboard' },
            { id: 'rounds',      label: '⚔️  Rounds'      },
          ] as const).map(tab => (
            <button key={tab.id} onClick={() => setMainTab(tab.id)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${mainTab === tab.id ? 'bg-white text-black shadow-sm' : 'text-white/50 hover:text-white/70'}`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Period sub-tabs — only shown inside leaderboard tab */}
        {mainTab === 'leaderboard' && (
          <div className="flex gap-1.5 mt-3">
            {PERIOD_LABELS.map(p => (
              <button key={p.id} onClick={() => setPeriod(p.id)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all border ${period === p.id ? 'bg-[#FF2929]/12 border-[#FF2929]/40 text-[#FF2929]' : 'border-white/8 text-white/40 hover:text-white/60 hover:border-white/15'}`}>
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
            <span className="text-xl shrink-0">✦</span>
            <div>
              <p className="text-xs font-black text-[#FFB800]">Seeker Domain Holders</p>
              <p className="text-[10px] text-white/40 mt-0.5">Raiders with a verified .skr domain — top 50 by SR</p>
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
            <p className="text-white/40 font-bold text-sm">No players yet</p>
            <p className="text-white/20 text-xs mt-1">{period === 'skr' ? 'No .skr domain holders yet.' : period === 'alltime' ? 'Be the first to raid.' : 'No raids this period.'}</p>
          </div>
        ) : (
          <>
            {/* TOP 3 */}
            {top3.map((entry, idx) => {
              const podiumStyles = [
                { border: 'border-yellow-500/50', bg: 'bg-gradient-to-r from-yellow-500/8 to-transparent', glow: 'shadow-[0_0_20px_rgba(234,179,8,0.08)]', ring: 'ring-2 ring-yellow-400/50', numColor: 'text-yellow-400' },
                { border: 'border-white/15',      bg: 'bg-white/[0.02]',                                   glow: '',                                        ring: 'ring-1 ring-white/15',           numColor: 'text-white/60'  },
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
                      {isMe && <span className="text-[9px] font-bold bg-[#FF2929]/15 text-[#FF2929] border border-[#FF2929]/25 rounded-full px-1.5 py-0.5 shrink-0">you</span>}
                      {entry.skr_domain && <span className="text-[8px] font-black text-[#FFB800] border border-[#FFB800]/30 bg-[#FFB800]/10 rounded-full px-1.5 py-0.5 shrink-0">{entry.skr_domain}</span>}
                    </div>
                    <p className="text-[10px] font-bold mt-0.5" style={{ color: entry.rank_color }}>Lv.{entry.rank_level} {entry.rank_title}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`font-black text-lg leading-none ${s.numColor}`}>{entry.sr_points.toLocaleString()}</p>
                    <p className="text-[9px] text-white/30 mt-0.5">{srLabel}</p>
                  </div>
                </div>
              );
            })}

            {/* ROWS 4-20 */}
            {rest.length > 0 && (
              <div className="rounded-2xl border border-white/8 overflow-hidden divide-y divide-white/5">
                {rest.map((entry, idx) => {
                  const place = idx + 4;
                  const isMe  = walletAddress === entry.wallet_address;
                  return (
                    <div key={entry.wallet_address} className={`flex items-center gap-3 px-4 py-3 hover:bg-white/3 transition-colors ${isMe ? 'bg-[#FF2929]/5' : ''}`}>
                      <span className="w-6 text-xs font-bold text-white/30 text-center shrink-0">#{place}</span>
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-white/5 shrink-0 flex items-center justify-center ring-1 ring-white/8">
                        <AvatarImg src={entry.avatarImage} size={32} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-bold text-sm text-white truncate">{entry.username}</p>
                          {isMe && <span className="text-[8px] font-bold bg-[#FF2929]/10 text-[#FF2929] rounded-full px-1.5 py-0.5 shrink-0">you</span>}
                          {entry.skr_domain && <span className="text-[8px] font-black text-[#FFB800] border border-[#FFB800]/25 bg-[#FFB800]/8 rounded-full px-1.5 py-0.5 shrink-0">{entry.skr_domain}</span>}
                        </div>
                        <p className="text-[9px] font-medium" style={{ color: entry.rank_color }}>Lv.{entry.rank_level} {entry.rank_title}</p>
                      </div>
                      <p className="font-bold text-sm text-white/60 shrink-0">{entry.sr_points.toLocaleString()}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ))}

        {/* ── ROUNDS TAB ──────────────────────────────────────── */}
        {mainTab === 'rounds' && (roundsLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="rounded-2xl bg-white/3 border border-white/5 p-5 animate-pulse">
                <div className="h-4 bg-white/5 rounded w-1/3 mb-3" />
                {[...Array(3)].map((_, j) => <div key={j} className="h-3 bg-white/5 rounded w-full mb-2" />)}
              </div>
            ))}
          </div>
        ) : historicalRounds.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="text-5xl mb-4">⏳</div>
            <p className="text-white/40 font-bold text-sm">No completed rounds yet</p>
            <p className="text-white/20 text-xs mt-1">Rounds complete every 6 hours.</p>
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
                'from-[#FF2929]/8 via-[#FF2929]/4 to-transparent border-[#FF2929]/25',
                'from-orange-500/8 via-orange-500/4 to-transparent border-orange-500/25',
              ];
              const roundBadgeColors = ['bg-yellow-500 text-black', 'bg-white/20 text-white', 'bg-[#FF2929] text-white', 'bg-orange-500 text-white'];

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
                        <p className="text-xs font-bold text-white/70">{dateLabel}</p>
                        <p className="text-[9px] text-white/30">{formatRoundWindow(round.roundNum)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] text-white/40 font-bold">Pool</p>
                      <p className="text-base font-black text-[#FFB800] leading-none">
                        {round.poolSol.toFixed(3)} <span className="text-[10px] text-[#FFB800]/60">SOL</span>
                      </p>
                    </div>
                  </div>

                  {/* Winners */}
                  <div className="divide-y divide-white/5">
                    {round.entries.length === 0 ? (
                      <div className="px-4 py-4 text-center">
                        <p className="text-xs text-white/25 italic">No extractions this round</p>
                      </div>
                    ) : round.entries.map(entry => {
                      const isMe = walletAddress === entry.walletAddress;
                      const r0 = entry.rank - 1;
                      return (
                        <div key={entry.walletAddress}
                          className={`flex items-center gap-3 px-4 py-2.5 ${isMe ? 'bg-[#FF2929]/5' : ''}`}>
                          <span className={`shrink-0 text-base w-6 text-center ${RANK_COLORS[r0]}`}>
                            {entry.rank <= 3 ? RANK_MEDALS[r0] : `#${entry.rank}`}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className={`font-bold text-sm truncate ${isMe ? 'text-white' : 'text-white'}`}>{entry.username}</p>
                              {isMe && <span className="text-[8px] font-bold text-[#FF2929] bg-[#FF2929]/10 rounded-full px-1.5 shrink-0">you</span>}
                            </div>
                            <p className="text-[9px] text-white/30">{ALLOC_PCT[r0]}% of pool</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs font-bold text-white">
                              {entry.pointsScored.toLocaleString()}
                              <span className="text-white/40 text-[9px] ml-0.5">pts</span>
                            </p>
                            <p className={`text-xs font-black ${RANK_COLORS[r0]}`}>
                              +{entry.allocationSol.toFixed(4)}
                              <span className="text-[9px] ml-0.5 opacity-60">SOL</span>
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* FOOTER */}
      <div className="shrink-0 px-4 py-4 border-t border-white/5 bg-[#050508]">
        <button onClick={() => setShowEntry(true)}
          className={`w-full py-4 rounded-2xl font-black text-base transition-all flex items-center justify-center gap-2 ${
            isLocked
              ? 'bg-white/5 border border-white/10 text-white/30'
              : 'text-white active:scale-[0.98]'
          }`}
          style={{ background: isLocked ? undefined : 'linear-gradient(135deg, #FF2929 0%, #CC0000 100%)', boxShadow: isLocked ? undefined : '0 0 25px rgba(255,41,41,0.25)' }}>
          {isLocked ? <>🔒 Locked — Lv.{TOURNAMENT_MIN_LEVEL} Required</> : <>⚔️ Enter Tournament</>}
        </button>
        <p className="text-center text-[10px] text-white/20 mt-2">
          {isLocked ? `Reach Level ${TOURNAMENT_MIN_LEVEL} to unlock` : `${TOURNAMENT_FEE} SOL entry · Hardcore difficulty`}
        </p>
      </div>
    </div>
  );
};

export default TournamentScreen;
