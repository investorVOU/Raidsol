
import React, { useState, useEffect } from 'react';
import { ENTRY_FEES, Mode } from '../types';

interface TeamScreenProps {
  onStartRaid: () => void;
  username?: string;
  walletAddress?: string | null;
}

const TeamScreen: React.FC<TeamScreenProps> = ({ onStartRaid, username, walletAddress }) => {
  const [risk, setRisk] = useState(24);

  useEffect(() => {
    const interval = setInterval(() => {
      setRisk((r) => Math.min(100, r + Math.random() * 2));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const shortAddr = walletAddress
    ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`
    : null;

  // Squad slot layout: 1 real user + 3 waiting slots
  const slots = [
    { filled: !!walletAddress, name: username || 'YOU', addr: shortAddr, isYou: true },
    { filled: false },
    { filled: false },
    { filled: false },
  ];

  return (
    <div className="h-full flex flex-col p-6 animate-in slide-in-from-right duration-300 overflow-y-auto scrollbar-hide pb-24">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-black italic uppercase tracking-tighter">
            Squad <span className="text-cyan-400">Protocol</span>
          </h2>
          <div className="flex items-center gap-1.5 text-white/40 mt-1">
            <span className="text-xs font-black uppercase tracking-wider italic">
              {walletAddress ? '[SQUAD_FORMING] 1/4 Members' : '[CONNECT_WALLET_TO_JOIN]'}
            </span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-white/40 font-bold uppercase mb-1">Pool Share</p>
          <p className="mono font-bold text-xl text-purple-400">1.25x</p>
        </div>
      </div>

      {/* Shared Risk Meter */}
      <div className="bg-black border-2 border-white/5 p-8 mb-10 relative overflow-hidden tech-border">
        <div className="absolute top-0 right-0 p-5 opacity-5 mono text-3xl font-black italic">[SYNC]</div>
        <p className="text-xs text-white/40 font-black uppercase tracking-[0.2em] mb-4 italic">Collective Risk Profile</p>
        <div className="w-full h-4 bg-white/5 overflow-hidden border border-white/10">
          <div className="h-full bg-cyan-500 transition-all duration-1000" style={{ width: `${risk}%` }} />
        </div>
        <div className="flex justify-between mt-4">
          <span className="mono text-3xl font-black italic">{Math.floor(risk)}%</span>
          <div className="flex items-center gap-2 text-green-400">
            <div className="w-2 h-2 bg-green-400 animate-pulse" />
            <span className="text-xs font-black uppercase tracking-wider italic">SYNC_STABLE</span>
          </div>
        </div>
      </div>

      {/* Player Slots */}
      <div className="flex-1 space-y-4">
        {slots.map((slot, i) => (
          <div
            key={i}
            className={`p-5 border-2 tech-border flex items-center justify-between ${
              slot.filled && slot.isYou
                ? 'bg-cyan-950/20 border-cyan-500/30'
                : 'bg-black border-white/5 opacity-40'
            }`}
          >
            <div className="flex items-center gap-5">
              <div
                className={`w-10 h-10 flex items-center justify-center font-black text-sm border ${
                  slot.filled ? 'bg-white/10 text-white border-white/10' : 'border-dashed border-white/10 text-white/10'
                }`}
              >
                {slot.filled ? (slot.name?.[0] ?? '?') : '+'}
              </div>
              <div>
                {slot.filled ? (
                  <>
                    <p className="text-base font-black tracking-tight uppercase italic">
                      {slot.name} {slot.isYou && '(Commander)'}
                    </p>
                    {slot.addr && (
                      <p className="text-xs font-mono text-cyan-400/50 tracking-widest">{slot.addr}</p>
                    )}
                  </>
                ) : (
                  <p className="text-xs font-black uppercase tracking-widest text-white/20 italic">
                    AWAITING OPERATOR...
                  </p>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className={`text-xs font-black uppercase tracking-widest ${slot.filled ? 'text-cyan-400' : 'text-white/10'}`}>
                {slot.filled ? 'READY' : 'OPEN'}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="py-8 space-y-4">
        <div className="p-4 bg-red-500/10 border-2 border-red-500/20 tech-border">
          <p className="text-[10px] font-black text-red-500 uppercase tracking-widest italic">
            [!] Entry: {ENTRY_FEES[Mode.TEAM]} SOL. Team payout is shared. One bust reduces total rewards by 25%.
          </p>
        </div>
        <button
          onClick={onStartRaid}
          className="w-full bg-cyan-500 text-black py-6 tech-border font-black uppercase tracking-tight text-2xl active:scale-95 transition-transform italic"
        >
          Start Co-op Raid
        </button>
      </div>
    </div>
  );
};

export default TeamScreen;
