
import React, { useState } from 'react';
import { ENTRY_FEES, Mode, Difficulty, Currency, CURRENCY_RATES } from '../types';
import { useLeaderboard, LeaderboardPeriod } from '../hooks/useLeaderboard';

interface TournamentScreenProps {
  onEnterRaid: (mode: Mode, difficulty: Difficulty, boosts: string[], currency: Currency) => void;
  walletBalance: number;
  usdcBalance: number;
  skrBalance: number;
  rankLevel: number;
  rankTitle: string;
  srPoints: number;
  walletAddress?: string;
}

const PERIOD_TABS: { id: LeaderboardPeriod; label: string; srLabel: string }[] = [
  { id: 'alltime', label: 'ALL-TIME', srLabel: 'TOTAL SR'      },
  { id: 'weekly',  label: 'WEEKLY',   srLabel: 'SR THIS WEEK'  },
  { id: 'monthly', label: 'MONTHLY',  srLabel: 'SR THIS MONTH' },
];

function getPeriodSubtitle(period: LeaderboardPeriod): string {
  const now   = new Date();
  const month = now.toLocaleString('en-US', { month: 'long' }).toUpperCase();
  const year  = now.getFullYear();
  if (period === 'weekly')  return `LAST 7 DAYS · ${month} ${year}`;
  if (period === 'monthly') return `${month} ${year}`;
  return 'ALL-TIME RANKINGS';
}

const PODIUM = [
  { numColor: 'text-yellow-400', border: 'border-yellow-500/50', bg: 'bg-yellow-500/5',  glow: 'shadow-[0_0_30px_rgba(234,179,8,0.10)]',        avatarRing: 'ring-2 ring-yellow-400/60', medal: '🥇' },
  { numColor: 'text-white/60',   border: 'border-white/15',      bg: 'bg-white/[0.02]', glow: '',                                               avatarRing: 'ring-2 ring-white/20',      medal: '🥈' },
  { numColor: 'text-orange-400', border: 'border-orange-500/30', bg: 'bg-orange-500/5', glow: 'shadow-[0_0_20px_rgba(249,115,22,0.08)]',        avatarRing: 'ring-2 ring-orange-400/40', medal: '🥉' },
];

const CURRENCY_LABELS: Record<Currency, string> = {
  [Currency.SOL]:  'SOL',
  [Currency.USDC]: 'USDC',
  [Currency.SKR]:  'SKR',
};

const TOURNAMENT_FEE = ENTRY_FEES[Mode.TOURNAMENT]; // 0.2 SOL
const TOURNAMENT_MIN_LEVEL = 15;

function AvatarImg({ src, size }: { src: string | null; size: number }) {
  if (!src) {
    // No avatar equipped — show empty silhouette
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"
        style={{ width: size * 0.55, height: size * 0.55 }}
        className="text-white/10"
      >
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
      </svg>
    );
  }
  const isEmoji = !src.startsWith('http');
  if (isEmoji) {
    return (
      <span style={{ fontSize: size * 0.55 }} className="flex items-center justify-center w-full h-full leading-none select-none">
        {src}
      </span>
    );
  }
  return <img src={src} alt="" style={{ width: size, height: size }} className="object-cover" loading="lazy" />;
}

const TournamentScreen: React.FC<TournamentScreenProps> = ({
  onEnterRaid,
  walletBalance,
  usdcBalance,
  skrBalance,
  rankLevel,
  rankTitle,
  srPoints,
  walletAddress,
}) => {
  const [period,      setPeriod]      = useState<LeaderboardPeriod>('alltime');
  const [showEntry,   setShowEntry]   = useState(false);
  const [currency,    setCurrency]    = useState<Currency>(Currency.SOL);
  const { entries, loading } = useLeaderboard(period);

  const srLabel = PERIOD_TABS.find(t => t.id === period)!.srLabel;
  const top3    = entries.slice(0, 3);
  const rest    = entries.slice(3);

  // Entry fee in selected currency
  const feeInCurrency = TOURNAMENT_FEE * CURRENCY_RATES[currency];
  const balanceMap: Record<Currency, number> = {
    [Currency.SOL]:  walletBalance,
    [Currency.USDC]: usdcBalance,
    [Currency.SKR]:  skrBalance,
  };
  const currentBalance = balanceMap[currency];
  const canAfford       = currentBalance >= feeInCurrency;
  const isLocked        = rankLevel < TOURNAMENT_MIN_LEVEL;

  const handleConfirm = () => {
    setShowEntry(false);
    onEnterRaid(Mode.TOURNAMENT, Difficulty.HARD, [], currency);
  };

  // ── ENTRY MODAL ──────────────────────────────────────────────────────────
  if (showEntry) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 animate-in zoom-in-95 duration-200">
        <div className="w-full max-w-sm">

          {isLocked ? (
            /* LEVEL LOCK */
            <div className="bg-black border-2 border-red-500/30 tech-border p-8 text-center">
              <div className="text-5xl mb-4">🔒</div>
              <h3 className="text-2xl font-black italic uppercase tracking-tighter mb-2 text-red-400">
                ACCESS_DENIED
              </h3>
              <p className="text-white/40 text-xs font-black uppercase tracking-widest mb-6">
                Tournament unlocks at Level {TOURNAMENT_MIN_LEVEL} — COMMANDER
              </p>
              <div className="bg-white/5 p-4 mb-6 tech-border">
                <div className="flex justify-between text-xs font-black uppercase mb-2">
                  <span className="text-white/30">YOUR RANK</span>
                  <span className="text-white/60">L.{rankLevel} {rankTitle}</span>
                </div>
                <div className="flex justify-between text-xs font-black uppercase mb-3">
                  <span className="text-white/30">REQUIRED</span>
                  <span className="text-purple-400">L.{TOURNAMENT_MIN_LEVEL} COMMANDER</span>
                </div>
                {/* Progress bar toward 7000 SR (COMMANDER threshold) */}
                <div className="h-1.5 bg-white/5 overflow-hidden">
                  <div
                    className="h-full bg-purple-500 transition-all"
                    style={{ width: `${Math.min(100, (srPoints / 7000) * 100).toFixed(1)}%` }}
                  />
                </div>
                <p className="text-[9px] text-white/20 font-black uppercase tracking-widest mt-1.5 text-right">
                  {srPoints.toLocaleString()} / 7,000 SR
                </p>
              </div>
              <button
                onClick={() => setShowEntry(false)}
                className="w-full border border-white/10 text-white/40 py-3 font-black uppercase tracking-widest text-sm italic hover:text-white/70 transition-colors"
              >
                ← BACK
              </button>
            </div>

          ) : (
            /* ENTRY CONFIRMATION */
            <>
              <div className="text-center mb-6">
                <p className="text-[10px] font-black text-purple-400/60 uppercase tracking-[0.4em] italic mb-1">
                  __Mega Raid Series
                </p>
                <h3 className="text-3xl font-black italic uppercase tracking-tighter text-white">
                  TOURNAMENT_ENTRY
                </h3>
              </div>

              <div className="bg-black border-2 border-purple-500/40 tech-border p-6 space-y-5">

                {/* Difficulty (fixed) */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-white/30 uppercase tracking-widest">DIFFICULTY</span>
                  <span className="text-xs font-black italic text-orange-400 border border-orange-500/30 bg-orange-500/10 px-2 py-1 uppercase tracking-wide">
                    ⚡ HARDCORE
                  </span>
                </div>

                {/* Entry fee */}
                <div className="flex items-center justify-between border-t border-white/5 pt-4">
                  <span className="text-[10px] font-black text-white/30 uppercase tracking-widest">ENTRY FEE</span>
                  <span className="mono text-lg font-black text-white italic">
                    {feeInCurrency % 1 === 0
                      ? feeInCurrency.toFixed(0)
                      : feeInCurrency.toFixed(3)}{' '}
                    <span className="text-white/40 text-sm">{CURRENCY_LABELS[currency]}</span>
                  </span>
                </div>

                {/* Currency selector */}
                <div>
                  <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-2">PAY WITH</p>
                  <div className="grid grid-cols-3 gap-2">
                    {([Currency.SOL, Currency.USDC, Currency.SKR] as Currency[]).map(c => {
                      const bal = balanceMap[c];
                      const fee = TOURNAMENT_FEE * CURRENCY_RATES[c];
                      const ok  = bal >= fee;
                      return (
                        <button
                          key={c}
                          onClick={() => setCurrency(c)}
                          className={`py-2.5 px-2 tech-border font-black uppercase text-xs italic transition-all border-2 flex flex-col items-center gap-0.5 ${
                            currency === c
                              ? 'bg-purple-500/20 border-purple-400 text-white'
                              : 'bg-black border-white/10 text-white/40 hover:border-white/25 hover:text-white/60'
                          }`}
                        >
                          <span>{CURRENCY_LABELS[c]}</span>
                          <span className={`text-[8px] font-bold normal-case not-italic tracking-wide ${ok ? 'text-green-400/70' : 'text-red-400/60'}`}>
                            {bal.toFixed(c === Currency.SOL ? 3 : 1)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Balance vs cost */}
                <div className="bg-white/3 p-3 tech-border space-y-1.5 border border-white/5">
                  <div className="flex justify-between text-[10px] font-black uppercase">
                    <span className="text-white/30">YOUR BALANCE</span>
                    <span className={currentBalance < feeInCurrency ? 'text-red-400' : 'text-white/60'}>
                      {currentBalance.toFixed(currency === Currency.SOL ? 4 : 2)} {CURRENCY_LABELS[currency]}
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] font-black uppercase">
                    <span className="text-white/30">ENTRY COST</span>
                    <span className="text-purple-400">
                      {feeInCurrency % 1 === 0 ? feeInCurrency.toFixed(0) : feeInCurrency.toFixed(3)} {CURRENCY_LABELS[currency]}
                    </span>
                  </div>
                  {!canAfford && (
                    <p className="text-[9px] text-red-400 font-black uppercase tracking-widest text-right pt-0.5">
                      ✗ INSUFFICIENT FUNDS
                    </p>
                  )}
                </div>

                {/* Confirm */}
                <button
                  onClick={handleConfirm}
                  disabled={!canAfford}
                  className={`w-full py-5 tech-border font-black uppercase tracking-tight text-lg italic transition-all ${
                    canAfford
                      ? 'bg-purple-600 text-white shadow-[0_0_25px_rgba(168,85,247,0.3)] active:scale-95'
                      : 'bg-white/5 text-white/20 cursor-not-allowed border border-white/5'
                  }`}
                >
                  {canAfford ? 'CONFIRM_ENTRY →' : 'INSUFFICIENT FUNDS'}
                </button>
              </div>

              <button
                onClick={() => setShowEntry(false)}
                className="w-full mt-3 py-3 text-white/30 font-black uppercase tracking-widest text-xs italic hover:text-white/60 transition-colors"
              >
                ← CANCEL
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── MAIN LEADERBOARD VIEW ────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col animate-in slide-in-from-right duration-300 overflow-hidden">

      {/* HEADER */}
      <div className="shrink-0 px-5 pt-5 pb-3 border-b border-white/5 bg-black">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-2xl sm:text-3xl font-black italic uppercase tracking-tighter">
            GLOBAL_RANKS
          </h2>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />
            <span className="text-[10px] font-black text-cyan-400 uppercase tracking-widest italic">LIVE</span>
          </div>
        </div>
        <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] italic mb-4">
          _{getPeriodSubtitle(period)}
        </p>
        <div className="flex gap-2">
          {PERIOD_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setPeriod(tab.id)}
              className={`flex-1 py-2.5 font-black uppercase tracking-wider text-xs italic transition-all tech-border border-2 ${
                period === tab.id
                  ? 'bg-white text-black border-white'
                  : 'bg-black border-white/15 text-white/40 hover:text-white/60 hover:border-white/30'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* SCROLL BODY */}
      <div className="flex-1 overflow-y-auto scrollbar-hide px-5 py-4 pb-36">
        {loading ? (
          <div className="space-y-3 mt-1">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-black border border-white/5 p-5 tech-border animate-pulse flex items-center gap-4">
                <div className="w-8 h-4 bg-white/5 rounded shrink-0" />
                <div className="w-12 h-12 rounded-full bg-white/5 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-white/5 rounded w-2/5" />
                  <div className="h-2 bg-white/5 rounded w-1/4" />
                </div>
                <div className="w-16 h-5 bg-white/5 rounded shrink-0" />
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-28 text-center">
            <p className="text-5xl mb-4">🏴</p>
            <p className="text-white/20 font-black uppercase tracking-widest text-sm">NO OPERATORS YET</p>
            <p className="text-white/10 font-bold uppercase tracking-widest text-xs mt-2">
              {period === 'alltime' ? 'Be the first to raid.' : 'No raids this period. Be first.'}
            </p>
          </div>
        ) : (
          <>
            {/* TOP 3 PODIUM */}
            {top3.length > 0 && (
              <div className="space-y-3 mb-4">
                {top3.map((entry, idx) => {
                  const s    = PODIUM[idx];
                  const isMe = walletAddress === entry.wallet_address;
                  return (
                    <div
                      key={entry.wallet_address}
                      className={`relative bg-black border-2 ${s.border} ${s.bg} ${s.glow} p-4 sm:p-5 tech-border flex items-center gap-4`}
                    >
                      <div className={`shrink-0 w-8 text-center mono font-black italic text-2xl ${s.numColor}`}>
                        #{idx + 1}
                      </div>
                      <div className={`shrink-0 w-14 h-14 rounded-full overflow-hidden bg-white/5 flex items-center justify-center ${s.avatarRing}`}>
                        <AvatarImg src={entry.avatarImage} size={56} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <p className="font-black uppercase tracking-tight text-base sm:text-lg leading-none truncate">
                            {entry.username}
                          </p>
                          {isMe && (
                            <span className="text-[9px] font-black bg-cyan-400/15 text-cyan-400 border border-cyan-400/30 px-1.5 py-0.5 uppercase tracking-widest shrink-0">
                              YOU
                            </span>
                          )}
                          <span className="text-lg leading-none shrink-0">{s.medal}</span>
                        </div>
                        <p className="text-[10px] mono uppercase tracking-widest italic" style={{ color: entry.rank_color }}>
                          L.{entry.rank_level} {entry.rank_title}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className={`mono text-xl sm:text-2xl font-black italic leading-none ${s.numColor}`}>
                          {entry.sr_points.toLocaleString()}
                        </p>
                        <p className="text-[8px] font-black text-white/20 uppercase tracking-widest mt-0.5">{srLabel}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ROWS 4-20 */}
            {rest.length > 0 && (
              <div className="border border-white/5 tech-border overflow-hidden divide-y divide-white/5">
                {rest.map((entry, idx) => {
                  const place = idx + 4;
                  const isMe  = walletAddress === entry.wallet_address;
                  return (
                    <div
                      key={entry.wallet_address}
                      className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/3 ${isMe ? 'bg-cyan-500/5' : ''}`}
                    >
                      <span className="w-6 mono text-xs font-black text-white/20 text-center shrink-0">#{place}</span>
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-white/5 shrink-0 flex items-center justify-center ring-1 ring-white/10">
                        <AvatarImg src={entry.avatarImage} size={32} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-black uppercase text-sm tracking-tight truncate">{entry.username}</p>
                          {isMe && (
                            <span className="text-[8px] font-black bg-cyan-400/15 text-cyan-400 px-1 py-0.5 uppercase tracking-widest shrink-0">YOU</span>
                          )}
                        </div>
                        <p className="text-[9px] mono uppercase tracking-widest italic" style={{ color: entry.rank_color }}>
                          L.{entry.rank_level} {entry.rank_title}
                        </p>
                      </div>
                      <p className="mono text-sm font-black text-white/60 shrink-0">{entry.sr_points.toLocaleString()}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* FOOTER */}
      <div className="shrink-0 px-5 py-4 border-t border-white/5 bg-black">
        <button
          onClick={() => setShowEntry(true)}
          className={`w-full py-5 sm:py-6 tech-border font-black uppercase tracking-tight text-xl sm:text-2xl active:scale-95 transition-all italic flex items-center justify-center gap-3 ${
            isLocked
              ? 'bg-white/5 border border-white/10 text-white/25 cursor-pointer'
              : 'bg-purple-600 text-white shadow-[0_0_30px_rgba(168,85,247,0.2)]'
          }`}
        >
          {isLocked ? (
            <>🔒 TOURNAMENT_LOCKED</>
          ) : (
            <>⚔ ENTER_TOURNAMENT</>
          )}
        </button>
        <p className="text-center text-[10px] text-white/10 font-black uppercase mt-3 tracking-[0.5em] italic">
          {isLocked
            ? `* REQUIRES LEVEL ${TOURNAMENT_MIN_LEVEL} — COMMANDER *`
            : `* ULTRA HIGH RISK_TERMINAL · ${TOURNAMENT_FEE} SOL ENTRY *`}
        </p>
      </div>

    </div>
  );
};

export default TournamentScreen;
