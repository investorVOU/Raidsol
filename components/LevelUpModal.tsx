
import React from 'react';
import { Rank } from '../types';

interface LevelUpModalProps {
  rank: Rank;
  onClose: () => void;
}

const LevelUpModal: React.FC<LevelUpModalProps> = ({ rank, onClose }) => {
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-3xl animate-in fade-in duration-500"
        onClick={onClose}
      />

      {/* Particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-cyan-400 animate-ping"
            style={{
              left: `${(i * 8.3) % 100}%`,
              top: `${(i * 13.7) % 100}%`,
              animationDelay: `${i * 0.1}s`,
              animationDuration: '1.5s',
            }}
          />
        ))}
      </div>

      {/* Modal card — constrained to viewport height */}
      <div
        className="relative w-full max-w-md flex flex-col animate-in zoom-in-110 duration-500
                   bg-[#050505] border-4 tech-border shadow-[0_0_80px_rgba(20,241,149,0.2)]
                   max-h-[90vh] overflow-y-auto"
        style={{ borderColor: rank.color }}
      >
        <div className="flex flex-col items-center text-center p-5 sm:p-7">

          {/* Badge */}
          <div
            className="mb-3 px-4 py-1.5 border-2 italic font-black text-lg sm:text-xl animate-bounce tech-border"
            style={{ color: rank.color, borderColor: rank.color, backgroundColor: `${rank.color}10` }}
          >
            LEVEL_UP!
          </div>

          {/* Rank title */}
          <h2
            className="text-5xl sm:text-7xl font-black italic uppercase tracking-tighter text-white leading-none glitch-text"
          >
            {rank.title}
          </h2>

          <div className="mt-2 flex items-center gap-3">
            <div className="h-px w-10 bg-white/20" />
            <span className="text-[9px] font-black uppercase tracking-[0.35em] text-white/40 italic">
              PROTOCOL_ADVANCEMENT
            </span>
            <div className="h-px w-10 bg-white/20" />
          </div>

          {/* Perks */}
          <div className="mt-5 w-full space-y-2">
            <p className="text-[9px] font-black text-white/30 uppercase tracking-widest mb-2 italic">
              __NEW_PRIVILEGES_UNLOCKED
            </p>
            {rank.perks.map((perk, i) => (
              <div
                key={i}
                className="bg-white/2 border border-white/10 p-3 tech-border flex items-center gap-3 hover:bg-white/5 transition-all"
              >
                <div
                  className="w-8 h-8 shrink-0 flex items-center justify-center border-2 tech-border"
                  style={{ borderColor: rank.color, color: rank.color }}
                >
                  <span className="text-[10px] font-black">#0{i + 1}</span>
                </div>
                <div className="text-left">
                  <p className="text-xs font-black text-white italic tracking-tight uppercase">{perk}</p>
                  <p className="text-[8px] font-black text-white/20 uppercase tracking-widest">ACTIVE_ON_LINK_SYNC</p>
                </div>
              </div>
            ))}
          </div>

          {/* Confirm button */}
          <button
            onClick={onClose}
            className="mt-5 w-full py-4 font-black uppercase tracking-tighter text-lg tech-border transition-all active:scale-95 animate-pulse"
            style={{ backgroundColor: rank.color, color: '#000' }}
          >
            ACKNOWLEDGE_RANK
          </button>

          <p className="mt-3 text-[7px] font-black uppercase tracking-[0.5em] text-white/10 italic">
            AUTHORIZED_BY_GENESIS_BLOCK_PROTOCOL
          </p>
        </div>
      </div>
    </div>
  );
};

export default LevelUpModal;
