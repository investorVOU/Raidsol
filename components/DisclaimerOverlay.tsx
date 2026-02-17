
import React, { useState } from 'react';

interface DisclaimerOverlayProps {
  onAccept: () => void;
}

const DisclaimerOverlay: React.FC<DisclaimerOverlayProps> = ({ onAccept }) => {
  const [ageConfirmed, setAgeConfirmed] = useState(false);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-2 sm:p-4 bg-black/98 backdrop-blur-2xl animate-in fade-in duration-500 overflow-y-auto">
      <div className="relative w-full max-w-lg my-auto bg-[#050505] border-2 sm:border-4 border-red-500/40 p-0.5 tech-border shadow-[0_0_60px_rgba(239,68,68,0.15)] animate-in zoom-in-95 duration-300">
        <div className="p-4 sm:p-8 space-y-4 sm:space-y-6 flex flex-col items-center text-center">
          <div className="w-12 h-12 sm:w-16 sm:h-16 bg-red-500/10 border-2 border-red-500/40 flex items-center justify-center tech-border mb-1 animate-pulse shrink-0">
            <span className="text-xl sm:text-2xl font-black text-red-500 italic">!</span>
          </div>

          <div>
            <h2 className="text-2xl sm:text-4xl font-black uppercase italic tracking-tighter text-white leading-none">
              ENTRY_<span className="text-red-500">WARNING</span>
            </h2>
            <p className="text-[8px] sm:text-[10px] font-black text-red-500/40 uppercase tracking-[0.4em] mt-2 italic">PROTOCOL_RISK_ASSESSMENT</p>
          </div>

          <div className="space-y-3 sm:space-y-4 text-left w-full bg-red-950/5 p-4 sm:p-6 border-l-2 border-red-500/20 max-h-[30vh] sm:max-h-none overflow-y-auto">
            <div className="flex gap-3">
              <span className="text-red-500 mono font-black text-[10px] sm:text-xs shrink-0">[01]</span>
              <p className="text-[10px] sm:text-[11px] text-white/40 leading-relaxed italic font-medium">
                HIGH-STAKES DEGEN PROTOCOL. 100% RISK OF LOSS IS POSSIBLE AT ANY MOMENT DURING A RAID.
              </p>
            </div>
            <div className="flex gap-3">
              <span className="text-red-500 mono font-black text-[10px] sm:text-xs shrink-0">[02]</span>
              <p className="text-[10px] sm:text-[11px] text-white/40 leading-relaxed italic font-medium">
                NOT FINANCIAL ADVICE. WE ARE NOT RESPONSIBLE FOR BUSTED CONNECTIONS OR NETWORK LAG.
              </p>
            </div>
            <div className="flex gap-3">
              <span className="text-red-500 mono font-black text-[10px] sm:text-xs shrink-0">[03]</span>
              <p className="text-[10px] sm:text-[11px] text-white/40 leading-relaxed italic font-medium">
                CODE IS LAW. ALL SMART CONTRACT INTERACTIONS ARE FINAL AND NON-REFUNDABLE.
              </p>
            </div>
          </div>

          <div className="w-full space-y-4">
            <label className="flex items-center gap-3 cursor-pointer group justify-center sm:justify-start">
              <input 
                type="checkbox" 
                className="hidden" 
                checked={ageConfirmed}
                onChange={() => setAgeConfirmed(!ageConfirmed)}
              />
              <div className={`w-5 h-5 border-2 tech-border transition-colors flex items-center justify-center shrink-0 ${ageConfirmed ? 'bg-red-500 border-red-500' : 'border-white/10 group-hover:border-red-500/50'}`}>
                {ageConfirmed && <div className="w-2 h-2 bg-white" />}
              </div>
              <span className={`text-[10px] sm:text-xs font-black uppercase tracking-widest italic transition-colors ${ageConfirmed ? 'text-white' : 'text-white/20'}`}>
                I AM 18 YEARS OF AGE OR OLDER
              </span>
            </label>

            <div className="space-y-2">
              <button 
                onClick={() => ageConfirmed && onAccept()}
                disabled={!ageConfirmed}
                className={`w-full py-4 sm:py-6 tech-border font-black uppercase tracking-tight text-lg sm:text-xl transition-all italic shadow-lg
                  ${ageConfirmed 
                    ? 'bg-red-600 text-white shadow-[0_0_30px_rgba(239,68,68,0.3)] hover:bg-red-500 active:scale-95' 
                    : 'bg-white/5 text-white/10 border-white/5 cursor-not-allowed'}`}
              >
                I UNDERSTAND THE RISK
              </button>
              <button 
                className="w-full bg-black border-2 border-white/5 text-white/10 py-3 sm:py-4 tech-border font-black uppercase tracking-[0.3em] text-[8px] sm:text-[10px] hover:text-white transition-colors italic"
                onClick={() => window.location.href = 'https://solana.com'}
              >
                ABORT_LINK
              </button>
            </div>
          </div>

          <p className="text-[7px] sm:text-[8px] text-white/5 font-black uppercase tracking-[0.8em] mt-2 shrink-0">
            SOLANA_RAID_V5_SECURED_NET
          </p>
        </div>
      </div>
    </div>
  );
};

export default DisclaimerOverlay;
