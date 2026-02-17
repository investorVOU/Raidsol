
import React, { useState, useEffect } from 'react';
import { Player, ENTRY_FEES, Mode } from '../types';

interface TeamScreenProps {
  onStartRaid: () => void;
}

const TeamScreen: React.FC<TeamScreenProps> = ({ onStartRaid }) => {
  const [players, setPlayers] = useState<Player[]>([
    { id: '1', name: 'SolWarrior', status: 'ACTIVE', solEarned: 0.12 },
    { id: '2', name: 'DegenKing', status: 'ACTIVE', solEarned: 0.08 },
    { id: '3', name: 'PhantomX', status: 'EXITED', solEarned: 0.25 },
    { id: '4', name: 'You', status: 'ACTIVE', solEarned: 0.00 },
  ]);

  const [risk, setRisk] = useState(24);

  useEffect(() => {
    const interval = setInterval(() => {
      setRisk(r => Math.min(100, r + Math.random() * 2));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-full flex flex-col p-6 animate-in slide-in-from-right duration-300 overflow-y-auto scrollbar-hide pb-24">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-black italic uppercase tracking-tighter">Squad <span className="text-cyan-400">Gamma-9</span></h2>
          <div className="flex items-center gap-1.5 text-white/40 mt-1">
            <span className="text-[10px] font-black uppercase tracking-wider italic">[SQUAD_ACTIVE] 4/4 Members Ready</span>
          </div>
        </div>
        <div className="text-right">
            <p className="text-[10px] text-white/40 font-bold uppercase mb-1">Pool Share</p>
            <p className="mono font-bold text-lg text-purple-400">1.25x</p>
        </div>
      </div>

      {/* Shared Risk Meter */}
      <div className="bg-black border-2 border-white/5 p-6 mb-8 relative overflow-hidden tech-border">
        <div className="absolute top-0 right-0 p-4 opacity-5 mono text-2xl font-black italic">
            [SYNC]
        </div>
        
        <p className="text-[10px] text-white/40 font-black uppercase tracking-[0.2em] mb-4 italic">Collective Risk Profile</p>
        
        <div className="w-full h-3 bg-white/5 overflow-hidden border border-white/10">
          <div 
            className="h-full bg-cyan-500 transition-all duration-1000"
            style={{ width: `${risk}%` }}
          />
        </div>
        
        <div className="flex justify-between mt-3">
          <span className="mono text-2xl font-black italic">{Math.floor(risk)}%</span>
          <div className="flex items-center gap-1.5 text-green-400">
            <div className="w-1.5 h-1.5 bg-green-400 rounded-none animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-wider italic">SYNC_STABLE</span>
          </div>
        </div>
      </div>

      {/* Player List */}
      <div className="flex-1 space-y-3">
        {players.map(p => (
          <div key={p.id} className={`p-4 border-2 tech-border flex items-center justify-between ${
            p.name === 'You' ? 'bg-cyan-950/20 border-cyan-500/30' : 'bg-black border-white/5'
          }`}>
            <div className="flex items-center gap-4">
              <div className={`w-8 h-8 flex items-center justify-center font-black text-xs border ${
                p.status === 'EXITED' ? 'bg-green-500/20 text-green-500 border-green-500/30' : 'bg-white/10 text-white border-white/10'
              }`}>
                {p.name[0]}
              </div>
              <div>
                <p className="text-sm font-black tracking-tight uppercase italic">{p.name} {p.name === 'You' && '(Commander)'}</p>
                <p className={`text-[10px] font-black uppercase tracking-widest ${
                   p.status === 'EXITED' ? 'text-green-500' : 'text-cyan-400'
                }`}>{p.status}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="mono text-sm font-bold">{p.solEarned.toFixed(2)} SOL</p>
              <p className="text-[8px] text-white/40 font-black uppercase tracking-widest italic">YIELD</p>
            </div>
          </div>
        ))}
      </div>

      <div className="py-6 space-y-3">
        <div className="p-3 bg-red-500/10 border-2 border-red-500/20 tech-border">
            <p className="text-[9px] font-black text-red-500 uppercase tracking-widest italic">
              [!] Entry: {ENTRY_FEES[Mode.TEAM]} SOL. Team payout is shared. One bust reduces total rewards by 25%.
            </p>
        </div>
        <button 
            onClick={onStartRaid}
            className="w-full bg-cyan-500 text-black py-5 tech-border font-black uppercase tracking-tight text-xl active:scale-95 transition-transform italic"
        >
            Start Co-op Raid
        </button>
      </div>
    </div>
  );
};

export default TeamScreen;
