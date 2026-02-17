
import React from 'react';
import { TournamentEntry, ENTRY_FEES, Mode } from '../types';

interface TournamentScreenProps {
  onEnter: () => void;
}

const TournamentScreen: React.FC<TournamentScreenProps> = ({ onEnter }) => {
  const leaderboard: TournamentEntry[] = [
    { rank: 1, name: 'Shark.sol', score: 142900, prize: '12.4 SOL' },
    { rank: 2, name: 'WhaleHunter', score: 128450, prize: '8.2 SOL' },
    { rank: 3, name: 'Degen_0x', score: 98100, prize: '4.5 SOL' },
    { rank: 4, name: 'RaidBoss', score: 87400, prize: '2.1 SOL' },
    { rank: 5, name: 'SolMaster', score: 76200, prize: '1.4 SOL' },
  ];

  return (
    <div className="h-full flex flex-col p-6 animate-in slide-in-from-right duration-300 overflow-y-auto scrollbar-hide pb-24">
      {/* Header Info */}
      <div className="bg-black border-2 border-purple-500/40 tech-border p-6 relative overflow-hidden mb-8">
        <div className="absolute -top-4 -right-4 opacity-5 mono text-6xl font-black italic">
            [RAID]
        </div>
        
        <div className="flex items-center gap-2 mb-4">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] italic border border-purple-400/30 px-2 py-0.5 text-purple-400 bg-purple-400/10">Mega Raid Series #14</span>
        </div>

        <h2 className="text-5xl font-black italic uppercase tracking-tighter leading-tight mb-4">
            100 <span className="text-purple-400">SOL</span> POOL
        </h2>
        
        <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-1.5">
                <span className="mono text-[10px] font-black text-white/40 uppercase tracking-widest italic">[TIME] 14:02:44</span>
            </div>
            <div className="flex items-center gap-1.5">
                <span className="mono text-[10px] font-black text-purple-400 uppercase tracking-widest italic">[FEE] {ENTRY_FEES[Mode.TOURNAMENT]} SOL</span>
            </div>
        </div>
      </div>

      <div className="flex-1">
        <div className="flex justify-between items-center mb-6 px-1">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30 italic">__LEADERBOARD_LIVE</h3>
            <span className="text-[9px] font-black text-cyan-400 uppercase italic tracking-widest">[SYNC_ON]</span>
        </div>

        <div className="space-y-3">
            {leaderboard.map((entry) => (
                <div 
                    key={entry.rank}
                    className="group bg-black border-2 border-white/5 p-5 tech-border flex items-center justify-between hover:border-purple-500/30 transition-all cursor-pointer"
                >
                    <div className="flex items-center gap-6">
                        <div className={`w-10 flex justify-center mono font-black italic text-lg ${
                            entry.rank === 1 ? 'text-yellow-500' : entry.rank === 2 ? 'text-white/60' : entry.rank === 3 ? 'text-orange-400' : 'text-white/20'
                        }`}>
                            #{entry.rank}
                        </div>
                        <div>
                            <p className="text-base font-black tracking-tight uppercase italic">{entry.name}</p>
                            <p className="mono text-[10px] text-white/20 uppercase tracking-widest">{entry.score.toLocaleString()} PTS</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="mono text-base font-black text-purple-400 italic">{entry.prize}</p>
                        <p className="text-[8px] text-white/10 font-black uppercase tracking-[0.3em]">BOUNTY</p>
                    </div>
                </div>
            ))}
        </div>
      </div>

      <div className="py-8">
        <button 
            onClick={onEnter}
            className="w-full bg-purple-600 text-white py-6 tech-border font-black uppercase tracking-tight text-xl shadow-[0_0_30px_rgba(168,85,247,0.2)] active:scale-95 transition-transform flex items-center justify-center gap-2 italic"
        >
            Enter Tournament
        </button>
        <p className="text-center text-[9px] text-white/10 font-black uppercase mt-4 tracking-[0.5em] italic">
            * ULTRA HIGH RISK_TERMINAL *
        </p>
      </div>
    </div>
  );
};

export default TournamentScreen;
