
import React, { useState } from 'react';
import { Screen } from '../types';

interface HowItWorksModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateLegal: (screen: Screen) => void;
}

const HowItWorksModal: React.FC<HowItWorksModalProps> = ({ isOpen, onClose, onNavigateLegal }) => {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'GUIDE' | 'PVP' | 'LOSS'>('GUIDE');

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/95 backdrop-blur-md animate-in fade-in duration-300"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative w-full max-w-lg bg-[#050505] border-4 border-white/10 p-1 tech-border shadow-[0_0_100px_rgba(0,0,0,1)] animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-3xl font-black uppercase italic tracking-tighter text-white leading-none">MANUAL_OVERRIDE</h2>
            <p className="text-xs font-black text-white/30 uppercase tracking-[0.4em] mt-2">Protocol_Mechanics_v5.2</p>
          </div>
          <button 
            onClick={onClose}
            className="text-white/20 hover:text-white transition-colors font-black text-xl"
          >
            [X]
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/5 bg-black/50 overflow-x-auto scrollbar-hide">
          <button 
            onClick={() => setActiveTab('GUIDE')}
            className={`flex-1 min-w-[100px] py-5 text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'GUIDE' ? 'bg-cyan-500/10 text-cyan-400 border-b-2 border-cyan-500' : 'text-white/20 hover:text-white'}`}
          >
            GAME_LOOP
          </button>
          <button 
            onClick={() => setActiveTab('PVP')}
            className={`flex-1 min-w-[100px] py-5 text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'PVP' ? 'bg-purple-500/10 text-purple-400 border-b-2 border-purple-500' : 'text-white/20 hover:text-white'}`}
          >
            MULTIPLAYER
          </button>
          <button 
            onClick={() => setActiveTab('LOSS')}
            className={`flex-1 min-w-[100px] py-5 text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'LOSS' ? 'bg-red-500/10 text-red-500 border-b-2 border-red-500' : 'text-white/20 hover:text-white'}`}
          >
            FAIL_STATES
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-hide bg-black/40">
          
          {activeTab === 'GUIDE' && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
               <div className="bg-white/5 border border-white/10 p-4">
                  <h3 className="text-sm font-black text-cyan-400 uppercase italic mb-2">OBJECTIVE</h3>
                  <p className="text-xs text-white/50 leading-relaxed font-medium">
                      Enter the Raid. Watch your Multiplier grow. Extract your SOL before the Risk hits 100%. If you bust, you lose your stake.
                  </p>
               </div>

               {/* RISK */}
               <div className="flex gap-4 p-5 border border-white/5 bg-white/2">
                 <div className="w-14 h-14 border-2 border-red-500 rounded-full flex items-center justify-center shrink-0">
                    <span className="text-red-500 font-black text-sm">99%</span>
                 </div>
                 <div>
                    <h3 className="text-sm font-black uppercase text-red-500 mb-2">RISK (THE ENEMY)</h3>
                    <p className="text-xs text-white/40 leading-relaxed font-medium">
                      Risk increases constantly. <br/>
                      <span className="text-green-500">ATTACK</span> adds instant Risk but boosts Multiplier.<br/>
                      <span className="text-cyan-400">DEFEND</span> reduces Risk but slows earnings.<br/>
                      At 100%, the link severs.
                    </p>
                 </div>
               </div>

               {/* CONTROLS */}
               <div className="space-y-3">
                  <h3 className="text-xs font-black uppercase text-white/20 tracking-widest mb-2">ACTIONS</h3>
                  <div className="grid grid-cols-3 gap-3">
                     <div className="p-3 border border-red-500/30 bg-red-950/10 text-center">
                        <span className="text-xs font-black text-red-500 block">ATTACK</span>
                        <span className="text-[10px] text-white/30">Aggressive Yield</span>
                     </div>
                     <div className="p-3 border border-cyan-500/30 bg-cyan-950/10 text-center">
                        <span className="text-xs font-black text-cyan-500 block">DEFEND</span>
                        <span className="text-[10px] text-white/30">Stabilize Link</span>
                     </div>
                     <div className="p-3 border border-green-500/30 bg-green-950/10 text-center">
                        <span className="text-xs font-black text-green-500 block">EXIT</span>
                        <span className="text-[10px] text-white/30">Keep Profits</span>
                     </div>
                  </div>
               </div>
            </div>
          )}

          {activeTab === 'PVP' && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                <div className="bg-[#9945FF]/10 border border-[#9945FF]/40 p-5 tech-border">
                    <h3 className="text-lg font-black text-[#9945FF] uppercase italic mb-2">WINNER TAKES ALL</h3>
                    <p className="text-xs text-white/60 leading-relaxed font-medium">
                        In PvP, you aren't just fighting the Risk. You are fighting other players. 
                        The player who extracts with the <span className="text-white">HIGHEST SCORE</span> takes the entire pot.
                    </p>
                </div>

                <div className="space-y-4">
                    <div className="flex gap-4 items-start">
                        <div className="w-8 h-8 flex items-center justify-center bg-white/10 text-white font-black text-xs shrink-0">1</div>
                        <div>
                            <h4 className="text-sm font-black uppercase text-white">CREATE OR JOIN</h4>
                            <p className="text-xs text-white/40 mt-1">
                                Host a lobby and set the stake. Or join via Code/QR.
                            </p>
                        </div>
                    </div>
                    
                    <div className="flex gap-4 items-start">
                        <div className="w-8 h-8 flex items-center justify-center bg-white/10 text-white font-black text-xs shrink-0">2</div>
                        <div>
                            <h4 className="text-sm font-black uppercase text-white">SCAN TO CONNECT</h4>
                            <p className="text-xs text-white/40 mt-1">
                                Use the new <span className="text-[#14F195]">QR SCANNER</span> in the Join menu to instantly link with a friend's lobby.
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-4 items-start">
                        <div className="w-8 h-8 flex items-center justify-center bg-white/10 text-white font-black text-xs shrink-0">3</div>
                        <div>
                            <h4 className="text-sm font-black uppercase text-white">SYNCED CHAOS</h4>
                            <p className="text-xs text-white/40 mt-1">
                                All players share the same RNG seed. If risk spikes for you, it spikes for them.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
          )}

          {activeTab === 'LOSS' && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
               <div className="p-5 bg-red-900/10 border-l-2 border-red-500">
                 <div className="flex justify-between items-start mb-2">
                    <h3 className="text-sm font-black uppercase text-red-500">TYPE 1: GREED (COMMON)</h3>
                    <span className="text-[10px] font-black bg-red-500 text-black px-1.5 py-0.5">PLAYER_ERROR</span>
                 </div>
                 <p className="text-xs text-white/40 leading-relaxed font-medium mb-2">
                   Your Risk is at <span className="text-red-500">99%</span>. You have a massive profit waiting. instead of clicking EXIT, you wait or ATTACK.
                 </p>
               </div>

               <div className="p-5 bg-orange-900/10 border-l-2 border-orange-500">
                 <div className="flex justify-between items-start mb-2">
                    <h3 className="text-sm font-black uppercase text-orange-500">TYPE 2: TIMEOUT</h3>
                    <span className="text-[10px] font-black bg-orange-500 text-black px-1.5 py-0.5">AUTO_FAIL</span>
                 </div>
                 <p className="text-xs text-white/40 leading-relaxed font-medium">
                   The "Time till Bust" timer hits 0. Risk automatically jumps to 100%. If you haven't exited, the protocol severs the link.
                 </p>
               </div>

               <div className="p-5 bg-purple-900/10 border-l-2 border-purple-500">
                 <div className="flex justify-between items-start mb-2">
                    <h3 className="text-sm font-black uppercase text-purple-500">TYPE 3: BAD RNG</h3>
                    <span className="text-[10px] font-black bg-purple-500 text-white px-1.5 py-0.5">UNLUCKY</span>
                 </div>
                 <p className="text-xs text-white/40 leading-relaxed font-medium">
                   You ATTACK while Risk is already high. The random spike pushes you instantly to 100% before you can react.
                 </p>
               </div>
            </div>
          )}
        </div>

        {/* Footer Legal Links */}
        <div className="p-6 border-t border-white/5 bg-black shrink-0">
          <div className="flex gap-4 mb-5">
             <button 
               onClick={() => { onClose(); onNavigateLegal(Screen.PRIVACY); }}
               className="flex-1 p-4 bg-white/2 border border-white/5 text-xs font-black uppercase tracking-widest hover:text-white transition-all italic text-white/30"
             >
               Privacy
             </button>
             <button 
               onClick={() => { onClose(); onNavigateLegal(Screen.TERMS); }}
               className="flex-1 p-4 bg-white/2 border border-white/5 text-xs font-black uppercase tracking-widest hover:text-white transition-all italic text-white/30"
             >
               Terms
             </button>
             <a 
               href="https://x.com/SolanaRaid" 
               target="_blank"
               rel="noreferrer"
               className="flex-1 p-4 bg-white text-black border border-white text-xs font-black uppercase tracking-widest hover:bg-gray-200 transition-all italic flex items-center justify-center group shadow-[0_0_15px_rgba(255,255,255,0.3)]"
             >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 group-hover:scale-110 transition-transform">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
             </a>
          </div>
          <p className="text-[10px] text-center text-white/10 font-black tracking-[0.3em] uppercase">
            PROTOCOL_DATA_READ_ONLY // NO_FINANCIAL_ADVICE
          </p>
        </div>
      </div>
    </div>
  );
};

export default HowItWorksModal;
