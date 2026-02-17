
import React from 'react';
import { Rank } from '../types';

interface LevelUpModalProps {
  rank: Rank;
  onClose: () => void;
}

const LevelUpModal: React.FC<LevelUpModalProps> = ({ rank, onClose }) => {
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      {/* Heavy Blur Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-3xl animate-in fade-in duration-500"
        onClick={onClose}
      />
      
      {/* Celebration Content */}
      <div className="relative w-full max-w-lg flex flex-col items-center">
        
        {/* Animated Particles (CSS only simulation) */}
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(12)].map((_, i) => (
            <div 
              key={i} 
              className="absolute w-1 h-1 bg-cyan-400 animate-ping"
              style={{ 
                left: `${Math.random() * 100}%`, 
                top: `${Math.random() * 100}%`,
                animationDelay: `${i * 0.1}s`,
                animationDuration: '1.5s'
              }}
            />
          ))}
        </div>

        <div className="bg-[#050505] border-4 p-8 tech-border shadow-[0_0_100px_rgba(20,241,149,0.2)] animate-in zoom-in-110 duration-500 flex flex-col items-center text-center w-full" style={{ borderColor: rank.color }}>
          
          <div className="mb-6 px-4 py-2 border-2 italic font-black text-2xl animate-bounce tech-border" style={{ color: rank.color, borderColor: rank.color, backgroundColor: `${rank.color}10` }}>
            LEVEL_UP!
          </div>

          <h2 className="text-6xl sm:text-8xl font-black italic uppercase tracking-tighter text-white leading-none glitch-text mb-2">
            {rank.title}
          </h2>
          
          <div className="mt-2 flex items-center gap-4">
             <div className="h-[1px] w-12 bg-white/20" />
             <span className="text-xs font-black uppercase tracking-[0.4em] text-white/40 italic">PROTOCOL_ADVANCEMENT</span>
             <div className="h-[1px] w-12 bg-white/20" />
          </div>

          <div className="mt-12 w-full space-y-3">
             <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-4 italic">__NEW_PRIVILEGES_UNLOCKED</p>
             {rank.perks.map((perk, i) => (
               <div key={i} className="bg-white/2 border border-white/10 p-4 tech-border flex items-center gap-4 transition-all hover:bg-white/5">
                 <div className="w-10 h-10 flex items-center justify-center border-2 tech-border" style={{ borderColor: rank.color, color: rank.color }}>
                   <span className="text-xs font-black">#0{i+1}</span>
                 </div>
                 <div className="text-left">
                   <p className="text-sm font-black text-white italic tracking-tighter uppercase">{perk}</p>
                   <p className="text-[8px] font-black text-white/20 uppercase tracking-widest">ACTIVE_ON_LINK_SYNC</p>
                 </div>
               </div>
             ))}
          </div>

          <button 
            onClick={onClose}
            className="mt-12 w-full py-6 font-black uppercase tracking-tighter text-xl tech-border transition-all animate-pulse"
            style={{ backgroundColor: rank.color, color: '#000' }}
          >
            ACKNOWLEDGE_RANK
          </button>

          <p className="mt-6 text-[7px] font-black uppercase tracking-[0.5em] text-white/10 italic">
            AUTHORIZED_BY_GENESIS_BLOCK_PROTOCOL
          </p>
        </div>
      </div>
    </div>
  );
};

export default LevelUpModal;
