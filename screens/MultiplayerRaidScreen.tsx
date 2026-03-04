
import React, { useState, useEffect, useRef } from 'react';
import { Room, Opponent } from '../types';

interface MultiplayerRaidScreenProps {
  room: Room;
  equippedGearIds: string[];
  walletAddress?: string | null;
  onFinish: (success: boolean, solAmount: number, points: number) => void;
}

const CURRENCY_LABELS: Record<string, string> = {
  SOL: 'SOL', USDC: 'USDC', SKR: 'SKR',
};

const MultiplayerRaidScreen: React.FC<MultiplayerRaidScreenProps> = ({ room, equippedGearIds, walletAddress, onFinish }) => {
  const [points, setPoints]       = useState(0);
  const [risk, setRisk]           = useState(0);
  const [multiplier, setMultiplier] = useState(1.0);
  const [isEnding, setIsEnding]   = useState<'WIN' | 'LOSS' | 'EXTRACTED' | null>(null);
  const [elapsed, setElapsed]     = useState(0);

  const [opponents, setOpponents] = useState<Opponent[]>(
    room.players.filter(p => p.id !== walletAddress),
  );
  const [logs, setLogs] = useState<string[]>(['Link established', 'PvP active']);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef(0);

  const ccy = (room as any).stakeCurrency ?? 'SOL';
  const totalPot = room.stakePerPlayer * room.maxPlayers;

  useEffect(() => {
    if (isEnding) return;

    timerRef.current = setInterval(() => {
      elapsedRef.current += 1;
      setElapsed(elapsedRef.current);

      setRisk(prev => {
        const next = prev + 1.5 + Math.random() * 2;
        if (next >= 100) { handleBust(); return 100; }
        return next;
      });

      setPoints(prev => prev + Math.floor(15 * multiplier));

      setOpponents(prev => prev.map(opp => {
        if (opp.status !== 'RAIDING' && opp.status !== 'WAITING') return opp;
        if (opp.status === 'WAITING') return { ...opp, status: 'RAIDING' };
        const oppRisk = risk + (Math.random() * 10 - 5);
        const roll = Math.random();
        if (oppRisk > 95) { addLog(`⚡ ${opp.name} BUSTED`); return { ...opp, status: 'BUSTED', score: 0 }; }
        if (oppRisk > 60 && roll > 0.95) {
          const s = Math.floor(points * (0.8 + Math.random() * 0.4));
          addLog(`✓ ${opp.name} EXTRACTED: ${s.toLocaleString()}`);
          return { ...opp, status: 'EXTRACTED', score: s };
        }
        return { ...opp, score: Math.floor(points * 0.9) };
      }));
    }, 1000);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [multiplier, isEnding, points, risk]);

  const addLog = (msg: string) => setLogs(prev => [msg, ...prev].slice(0, 6));

  const handleBust = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsEnding('LOSS');
    setTimeout(() => finalizeGame('LOSS', 0), 2000);
  };

  const handleExtract = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsEnding('EXTRACTED');
    setTimeout(() => finalizeGame('EXTRACTED', points), 2000);
  };

  const finalizeGame = (result: 'LOSS' | 'EXTRACTED', myScore: number) => {
    const myId = walletAddress ?? 'self';
    const allScores = [
      { id: myId, score: result === 'LOSS' ? 0 : myScore },
      ...opponents.map(o => ({ id: o.id, score: o.status === 'BUSTED' ? 0 : o.score })),
    ].sort((a, b) => b.score - a.score);
    const userWon = allScores[0].id === myId && allScores[0].score > 0;
    onFinish(userWon, userWon ? totalPot : 0, myScore);
  };

  const handleAttack = () => {
    if (isEnding) return;
    setMultiplier(prev => prev + 0.5);
    setRisk(prev => Math.min(99, prev + 10));
    setPoints(prev => prev + 500);
    addLog('⚔ ATTACK — risk elevated');
  };

  const riskColor = risk > 85 ? '#9945FF' : risk > 60 ? '#f97316' : '#ffffff';
  const riskBg    = risk > 85 ? 'bg-[#9945FF]' : risk > 60 ? 'bg-orange-400' : 'bg-white/30';

  // Leaderboard snapshot
  const myId = walletAddress ?? 'self';
  const allPlayers = [
    { id: myId, name: 'YOU', score: points, status: isEnding === 'LOSS' ? 'BUSTED' : isEnding === 'EXTRACTED' ? 'EXTRACTED' : 'RAIDING', risk },
    ...opponents.map(o => ({ id: o.id, name: o.name, score: o.score, status: o.status, risk: 0 })),
  ].sort((a, b) => b.score - a.score);

  const myRank = allPlayers.findIndex(p => p.id === myId) + 1;

  const fmtTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="h-full flex flex-col text-white relative overflow-hidden" style={{ backgroundColor: 'var(--app-bg)' }}>

      {/* ── BUST / EXTRACT OVERLAY ── */}
      {isEnding && (
        <div className={`absolute inset-0 z-50 flex flex-col items-center justify-center animate-in fade-in duration-500 ${isEnding === 'LOSS' ? 'bg-red-950/80' : 'bg-[#9945FF]/10'}`}>
          <div className={`text-5xl sm:text-7xl font-black uppercase mb-3 ${isEnding === 'LOSS' ? 'text-[#9945FF]' : 'text-white'}`}>
            {isEnding === 'LOSS' ? 'BUSTED' : 'EXTRACTED'}
          </div>
          <p className="text-white text-sm font-bold animate-pulse">
            {isEnding === 'LOSS' ? 'Calculating standings...' : 'Awaiting results...'}
          </p>
        </div>
      )}

      {/* ── TOP HUD ── */}
      <div className="shrink-0 grid grid-cols-4 border-b border-white/8 bg-[var(--modal-bg)] divide-x divide-white/8">
        <div className="px-3 py-2 sm:px-5 sm:py-3 text-center">
          <p className="text-[8px] sm:text-[9px] font-bold text-white">Risk</p>
          <p className="text-xl sm:text-2xl font-black mono leading-none" style={{ color: riskColor }}>
            {Math.floor(risk)}<span className="text-sm">%</span>
          </p>
        </div>
        <div className="px-3 py-2 sm:px-5 sm:py-3 text-center">
          <p className="text-[8px] sm:text-[9px] font-bold text-white">Score</p>
          <p className="text-xl sm:text-2xl font-black mono text-white leading-none">{points.toLocaleString()}</p>
        </div>
        <div className="px-3 py-2 sm:px-5 sm:py-3 text-center">
          <p className="text-[8px] sm:text-[9px] font-bold text-white">Pot</p>
          <p className="text-xl sm:text-2xl font-black mono text-yellow-500 leading-none">
            {totalPot.toFixed(ccy === 'SKR' ? 0 : 2)}<span className="text-xs ml-0.5 text-yellow-500/60">{CURRENCY_LABELS[ccy] ?? ccy}</span>
          </p>
        </div>
        <div className="px-3 py-2 sm:px-5 sm:py-3 text-center">
          <p className="text-[8px] sm:text-[9px] font-bold text-white">Rank</p>
          <p className="text-xl sm:text-2xl font-black mono text-[#9945FF] leading-none">
            #{myRank}<span className="text-xs text-white">/{allPlayers.length}</span>
          </p>
        </div>
      </div>

      {/* ── MAIN BODY ── */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">

        {/* ── LEFT: CONTROLS ── */}
        <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 lg:border-r lg:border-white/8 relative">

          {/* Risk ring */}
          <div className="relative mb-5 sm:mb-7" style={{ width: 'min(220px, 48vw)', height: 'min(220px, 48vw)' }}>
            {/* Outer danger pulse at high risk */}
            {risk > 80 && (
              <div className="absolute inset-0 rounded-full border-2 border-[#9945FF]/30 animate-ping" />
            )}
            <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
              {/* Track */}
              <circle cx="50" cy="50" r="42" fill="none" stroke="'#ffffff'" strokeWidth="8" />
              {/* Progress */}
              <circle
                cx="50" cy="50" r="42" fill="none"
                stroke={riskColor}
                strokeWidth="8"
                strokeLinecap="butt"
                strokeDasharray={`${2 * Math.PI * 42}`}
                strokeDashoffset={`${2 * Math.PI * 42 * (1 - risk / 100)}`}
                style={{ transition: 'stroke-dashoffset 0.5s ease, stroke 0.5s ease', filter: `drop-shadow(0 0 6px ${riskColor}80)` }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[10px] font-bold text-white mb-1">Risk</span>
              <p className="text-4xl sm:text-5xl font-black mono leading-none" style={{ color: riskColor }}>
                {Math.floor(risk)}
              </p>
              <span className="text-sm font-black" style={{ color: riskColor }}>%</span>
              <span className="text-[9px] font-black text-white uppercase tracking-widest mt-2">{fmtTime(elapsed)}</span>
            </div>
          </div>

          {/* Risk bar — thin strip */}
          <div className="w-full max-w-xs mb-5 sm:mb-7">
            <div className="h-1.5 bg-white/5 overflow-hidden rounded-full">
              <div
                className={`h-full rounded-full transition-all duration-500 ${riskBg}`}
                style={{ width: `${risk}%`, boxShadow: `0 0 8px ${riskColor}` }}
              />
            </div>
            {risk > 75 && (
              <p className="text-[9px] font-bold text-[#9945FF] text-center mt-1.5 animate-pulse">
                ⚠ Critical risk — extract now
              </p>
            )}
          </div>

          {/* Action buttons */}
          {isEnding ? (
            <div className="text-center">
              <p className="text-lg sm:text-2xl font-bold text-white animate-pulse">
                {isEnding === 'LOSS' ? 'Protocol severed' : 'Results pending...'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs sm:max-w-sm">
              <button
                onClick={handleAttack}
                className="flex-1 py-4 sm:py-5 bg-[#9945FF]/10 border-2 border-[#9945FF]/60 text-[#9945FF] font-black uppercase tracking-tight hover:bg-[#9945FF]/20 hover:border-[#9945FF] hover:text-[#b87fff] active:scale-95 transition-all tech-border text-sm sm:text-base"
              >
                <span className="block text-lg sm:text-xl">⚔</span>
                ATTACK
                <span className="block text-[9px] opacity-60 mt-0.5">+MULT / +RISK</span>
              </button>
              <button
                onClick={handleExtract}
                className="flex-1 py-4 sm:py-5 bg-[#9945FF] text-white font-black uppercase tracking-tight hover:bg-[#7c2dd6] active:scale-95 transition-all tech-border shadow-[0_0_25px_rgba(153,69,255,0.30)] text-sm sm:text-base"
              >
                <span className="block text-lg sm:text-xl">↑</span>
                EXTRACT
                <span className="block text-[9px] opacity-50 mt-0.5">CASH OUT NOW</span>
              </button>
            </div>
          )}

          {/* Multiplier */}
          <div className="mt-4 flex items-center gap-2">
            <span className="text-[9px] font-bold text-white">Mult</span>
            <span className="text-lg font-black text-[#FFB800] mono">{multiplier.toFixed(1)}x</span>
          </div>
        </div>

        {/* ── RIGHT: LEADERBOARD + LOG ── */}
        <div className="w-full lg:w-72 xl:w-80 flex flex-col bg-[var(--modal-bg)] border-t lg:border-t-0 border-white/8 min-h-0">

          {/* Leaderboard header */}
          <div className="shrink-0 px-4 py-2.5 border-b border-white/8 flex items-center justify-between">
            <span className="text-[9px] font-bold text-white">Live standings</span>
            <span className="text-[9px] font-bold text-white">{room.players.length} players</span>
          </div>

          {/* Player rows */}
          <div className="flex-1 overflow-y-auto scrollbar-hide divide-y divide-white/5 min-h-0">
            {allPlayers.map((p, i) => {
              const isMe = p.id === myId;
              const statusColor =
                p.status === 'BUSTED'    ? 'text-[#9945FF] bg-[#9945FF]/10 border-[#9945FF]/20' :
                p.status === 'EXTRACTED' ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' :
                                           'text-white bg-white/8 border-white/15';
              return (
                <div
                  key={p.id}
                  className={`px-4 py-3 transition-colors ${isMe ? 'bg-[#9945FF]/5 border-l-2 border-[#9945FF]' : 'border-l-2 border-transparent'}`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    {/* Rank badge */}
                    <span className={`text-[9px] font-black w-5 text-center shrink-0 ${i === 0 ? 'text-yellow-500' : 'text-white'}`}>
                      #{i + 1}
                    </span>
                    <span className={`flex-1 text-xs font-bold truncate ${isMe ? 'text-white' : 'text-white'}`}>
                      {p.name}{isMe && <span className="text-white text-[9px]"> (you)</span>}
                    </span>
                    <span className={`text-[8px] font-bold px-1.5 py-0.5 border tracking-wide shrink-0 ${statusColor}`}>
                      {p.status === 'RAIDING' ? 'LIVE' : p.status}
                    </span>
                  </div>

                  {/* Score */}
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[9px] font-black text-white uppercase tracking-widest">Score</span>
                    <span className={`text-sm font-black mono ${p.status === 'BUSTED' ? 'text-[#9945FF]/40' : 'text-white'}`}>
                      {p.score.toLocaleString()}
                    </span>
                  </div>

                  {/* Risk bar (only for active players) */}
                  {p.status === 'RAIDING' && (
                    <div className="h-1 bg-white/5 overflow-hidden rounded-full">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${isMe ? (risk > 80 ? 'bg-[#9945FF]' : 'bg-[#9945FF]') : 'bg-white/20'}`}
                        style={{ width: isMe ? `${risk}%` : `${40 + Math.random() * 30}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Event log */}
          <div className="shrink-0 border-t border-white/8 bg-[var(--modal-bg)]/60 p-3 h-28 overflow-hidden">
            <p className="text-[8px] font-bold text-white mb-2">Event log</p>
            <div className="space-y-1 overflow-hidden">
              {logs.map((log, i) => (
                <div key={i} className="flex items-center gap-2 animate-in slide-in-from-top-1 duration-200">
                  <span className="text-white text-[9px] shrink-0">{'>'}</span>
                  <span className="text-[9px] font-bold mono text-white truncate">{log}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default MultiplayerRaidScreen;
