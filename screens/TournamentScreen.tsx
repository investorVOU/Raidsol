
import React from 'react';
import { ENTRY_FEES, Mode } from '../types';
import { useLeaderboard } from '../hooks/useLeaderboard';

interface TournamentScreenProps {
  onEnter: () => void;
}

const TournamentScreen: React.FC<TournamentScreenProps> = ({ onEnter }) => {
  const { entries, loading } = useLeaderboard();

  return (
    <div className="h-full flex flex-col p-6 animate-in slide-in-from-right duration-300 overflow-y-auto scrollbar-hide pb-24">
      {/* Header */}
      <div className="bg-black border-2 border-purple-500/40 tech-border p-8 relative overflow-hidden mb-10">
        <div className="absolute -top-4 -right-4 opacity-5 mono text-8xl font-black italic">[RAID]</div>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-xs font-black uppercase tracking-[0.2em] italic border border-purple-400/30 px-3 py-1 text-purple-400 bg-purple-400/10">
            Mega Raid Series #14
          </span>
        </div>
        <h2 className="text-6xl font-black italic uppercase tracking-tighter leading-tight mb-6">
          100 <span className="text-purple-400">SOL</span> POOL
        </h2>
        <div className="flex flex-wrap items-center gap-8">
          <div className="flex items-center gap-2">
            <span className="mono text-xs font-black text-purple-400 uppercase tracking-widest italic">
              [FEE] {ENTRY_FEES[Mode.TOURNAMENT]} SOL
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-pulse" />
            <span className="mono text-xs font-black text-white/40 uppercase tracking-widest italic">LIVE_SCORES</span>
          </div>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="flex-1">
        <div className="flex justify-between items-center mb-6 px-1">
          <h3 className="text-xs font-black uppercase tracking-[0.3em] text-white/30 italic">__LEADERBOARD_LIVE</h3>
          <span className="text-[10px] font-black text-cyan-400 uppercase italic tracking-widest">[SYNC_ON]</span>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-black border-2 border-white/5 p-6 tech-border animate-pulse">
                <div className="h-4 bg-white/5 rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-white/20 font-black uppercase tracking-widest text-sm">NO OPERATORS YET</p>
            <p className="text-white/10 font-bold uppercase tracking-widest text-xs mt-2">Be the first to raid and claim the top spot.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {entries.map((entry, idx) => {
              const place = idx + 1;
              const placeColor =
                place === 1 ? 'text-yellow-500' : place === 2 ? 'text-white/60' : place === 3 ? 'text-orange-400' : 'text-white/20';
              return (
                <div
                  key={entry.wallet_address}
                  className="group bg-black border-2 border-white/5 p-6 tech-border flex items-center justify-between hover:border-purple-500/30 transition-all"
                >
                  <div className="flex items-center gap-6">
                    <div className={`w-12 flex justify-center mono font-black italic text-2xl ${placeColor}`}>
                      #{place}
                    </div>
                    <div>
                      <p className="text-lg font-black tracking-tight uppercase italic">{entry.username}</p>
                      <div className="flex items-center gap-2">
                        <p className="mono text-xs uppercase tracking-widest" style={{ color: entry.rank_color }}>
                          {entry.rank_title}
                        </p>
                        <span className="text-white/10">·</span>
                        <p className="mono text-xs text-white/20 uppercase tracking-widest">
                          {entry.sr_points.toLocaleString()} SR
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="mono text-lg font-black text-purple-400 italic">L.{entry.rank_level}</p>
                    <p className="text-[10px] text-white/10 font-black uppercase tracking-[0.3em]">RANK</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="py-8">
        <button
          onClick={onEnter}
          className="w-full bg-purple-600 text-white py-6 tech-border font-black uppercase tracking-tight text-2xl shadow-[0_0_30px_rgba(168,85,247,0.2)] active:scale-95 transition-transform flex items-center justify-center gap-3 italic"
        >
          Enter Tournament
        </button>
        <p className="text-center text-[10px] text-white/10 font-black uppercase mt-5 tracking-[0.5em] italic">
          * ULTRA HIGH RISK_TERMINAL *
        </p>
      </div>
    </div>
  );
};

export default TournamentScreen;
