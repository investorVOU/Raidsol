
import React, { useState } from 'react';
import { Mode, ENTRY_FEES } from '../types';

interface LobbyScreenProps {
  onEnterRaid: (mode: Mode) => void;
  isConnected: boolean;
  onConnect: () => void;
  currentLevel: number;
}

const LobbyScreen: React.FC<LobbyScreenProps> = ({ onEnterRaid, isConnected, onConnect, currentLevel }) => {
  const [showModeModal, setShowModeModal] = useState(false);

  const handleModeSelect = (mode: Mode) => {
    if (mode === Mode.TEAM && currentLevel < 5) return;
    if (mode === Mode.TOURNAMENT && currentLevel < 15) return;
    
    setShowModeModal(false);
    onEnterRaid(mode);
  };

  return (
    <div className="h-full flex flex-col overflow-y-auto scrollbar-hide pb-32 animate-in fade-in duration-300">
      <div className="flex flex-col p-6 lg:p-12 w-full max-w-6xl mx-auto">
        
        <div className="flex justify-between items-center mb-8 px-1">
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-[9px] font-black uppercase tracking-[0.3em] mono">[{isConnected ? 'ONLINE' : 'OFFLINE'}]</span>
          </div>
          <span className="text-[9px] text-white/10 font-black mono tracking-widest">SYNC_HASH: 0x42f..1a</span>
        </div>

        <div className="mb-16 lg:mb-24">
          <h1 className="text-6xl md:text-8xl font-black italic tracking-tighter uppercase leading-[0.8] mb-4 text-white">
            SOLANA <span className="text-cyan-400 block glitch-text">RAID</span>
          </h1>
          <div className="h-[2px] w-full bg-white/5 relative overflow-hidden">
             <div className="absolute top-0 left-0 h-full w-1/4 bg-cyan-500 animate-[shimmer_3s_infinite]" />
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center py-8">
          {isConnected ? (
            <div className="w-full max-w-xl space-y-4">
               <button 
                onClick={() => setShowModeModal(true)}
                className="w-full bg-green-500 text-black py-8 px-8 tech-border flex items-center justify-between group transition-all hover:bg-green-400 active:scale-[0.98]"
              >
                <div className="text-left">
                  <span className="block text-4xl font-black leading-none uppercase italic tracking-tighter">RAID FOR SOL</span>
                  <span className="block text-[10px] mono tracking-widest mt-2 text-black/60 font-black uppercase italic">INITIATE DEPLOYMENT [ SECURE ]</span>
                </div>
                <span className="text-4xl font-black opacity-20 group-hover:opacity-100 group-hover:translate-x-2 transition-all">{'>'}</span>
              </button>

              <button 
                onClick={() => onEnterRaid(Mode.DRILL)}
                className="w-full bg-black border-2 border-white/20 text-white py-6 px-8 tech-border flex items-center justify-between hover:bg-white/5 active:scale-[0.98] transition-all"
              >
                <div className="text-left">
                  <span className="block text-xl font-black leading-none uppercase italic tracking-tighter">FREE DRILL</span>
                  <span className="block text-[9px] mono tracking-widest mt-1 font-black uppercase italic text-cyan-500/60">PRACTICE_EXTRACTION_PROTOCOLS</span>
                </div>
                <span className="text-[9px] font-black uppercase tracking-widest px-3 py-1 border border-white/10">0.00 SOL</span>
              </button>
            </div>
          ) : (
            <div className="w-full max-w-sm flex flex-col items-center text-center">
              <div className="text-3xl font-black text-white/5 mb-8 tracking-tighter uppercase italic">[ ACCESS_RESTRICTED ]</div>
              <p className="text-[10px] text-white/30 mb-12 leading-tight font-black uppercase tracking-[0.3em]">Signature required for protocol entry. Verify wallet link.</p>
              <button 
                onClick={onConnect}
                className="w-full bg-white text-black py-5 font-black uppercase tracking-tighter text-xl tech-border hover:bg-cyan-500 transition-all active:scale-95"
              >
                AUTH_SIGNATURE
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-16">
          <StatBox label="NODES_LIVE" value="1,402" color="cyan" />
          <StatBox label="POOL_TOTAL" value="428.1 SOL" color="purple" />
          <StatBox label="EXTRACTIONS" value="84,210" color="green" />
          <StatBox label="VOL_24H" value="2,142 SOL" color="yellow" />
        </div>
      </div>

      {/* Mode Selection Modal */}
      {showModeModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/98 backdrop-blur-xl"
            onClick={() => setShowModeModal(false)}
          />
          <div className="relative w-full max-w-lg bg-[#050505] border-4 border-white/10 p-8 tech-border animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start mb-12">
              <div>
                <h2 className="text-4xl font-black uppercase italic tracking-tighter text-white leading-none">SELECT_MODE</h2>
                <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.4em] mt-2">LINK_PROTOCOL_PROFILE</p>
              </div>
              <button 
                onClick={() => setShowModeModal(false)}
                className="text-white/20 hover:text-white transition-colors font-black text-xl"
              >
                [X]
              </button>
            </div>

            <div className="space-y-3">
              <ModeOption 
                mode={Mode.SOLO} 
                label="SOLO_RAID" 
                desc="HIGH_STABILITY / 1.0X_BASE" 
                fee={ENTRY_FEES[Mode.SOLO]} 
                color="cyan"
                onSelect={handleModeSelect} 
                locked={false}
              />
              <ModeOption 
                mode={Mode.TEAM} 
                label="COOP_SQUAD" 
                desc="SHARED_POOL / 1.5X_BASE" 
                fee={ENTRY_FEES[Mode.TEAM]} 
                color="purple"
                onSelect={handleModeSelect} 
                locked={currentLevel < 5}
                lockLevel={5}
              />
              <ModeOption 
                mode={Mode.TOURNAMENT} 
                label="RANKED_EVENT" 
                desc="ULTRA_STAKE / 5.0X_POOL" 
                fee={ENTRY_FEES[Mode.TOURNAMENT]} 
                color="yellow"
                onSelect={handleModeSelect} 
                locked={currentLevel < 15}
                lockLevel={15}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const StatBox = ({ label, value, color }: { label: string; value: string; color: string }) => (
  <div className="bg-black border-2 border-white/5 p-5 tech-border">
    <p className="text-[8px] text-white/20 font-black uppercase tracking-[0.2em] mb-2">{label}</p>
    <p className={`mono text-xl lg:text-2xl font-black uppercase ${color === 'cyan' ? 'text-white' : color === 'purple' ? 'text-purple-400' : color === 'green' ? 'text-green-500' : 'text-yellow-500'}`}>
      {value}
    </p>
  </div>
);

const ModeOption = ({ mode, label, desc, fee, color, onSelect, locked, lockLevel }: any) => (
  <button 
    onClick={() => onSelect(mode)}
    disabled={locked}
    className={`w-full bg-black border-2 p-5 tech-border flex justify-between items-center group transition-all 
      ${locked ? 'border-white/5 opacity-50 cursor-not-allowed' : `border-white/10 hover:border-${color}-500/50`}`}
  >
    <div className="text-left">
      <p className="text-xl font-black uppercase italic text-white leading-none">{label}</p>
      {locked ? (
        <p className="text-[9px] text-red-500 font-black uppercase mt-1.5 tracking-widest">REQUIRES_LEVEL_{lockLevel}</p>
      ) : (
        <p className="text-[9px] text-white/20 font-black uppercase mt-1.5 tracking-widest">{desc}</p>
      )}
    </div>
    <div className="text-right">
      <p className={`mono text-lg font-black ${locked ? 'text-white/10' : `text-${color}-400`}`}>{fee} SOL</p>
      <p className="text-[8px] text-white/10 font-black uppercase tracking-widest">ENTRY</p>
    </div>
  </button>
);

export default LobbyScreen;
