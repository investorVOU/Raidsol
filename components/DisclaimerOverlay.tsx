
import React, { useState } from 'react';

interface DisclaimerOverlayProps {
  onAccept: () => void;
}

const DisclaimerOverlay: React.FC<DisclaimerOverlayProps> = ({ onAccept }) => {
  const [ageConfirmed, setAgeConfirmed] = useState(false);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-2 sm:p-4 bg-black/98 backdrop-blur-2xl animate-in fade-in duration-500 overflow-y-auto">
      <div className="relative w-full max-w-lg my-auto bg-[#0c0c20] border-2 sm:border-4 border-[#9945FF]/40 p-0.5 tech-border shadow-[0_0_60px_rgba(153,69,255,0.15)] animate-in zoom-in-95 duration-300">
        <div className="p-6 sm:p-10 space-y-6 sm:space-y-8 flex flex-col items-center text-center">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-[#9945FF]/10 border-2 border-[#9945FF]/40 flex items-center justify-center tech-border mb-2 animate-pulse shrink-0">
            <span className="text-3xl sm:text-4xl font-black text-[#9945FF]">!</span>
          </div>

          <div>
            <h2 className="text-3xl sm:text-5xl font-black uppercase tracking-tight text-white leading-none">
              Entry <span className="text-[#9945FF]">Warning</span>
            </h2>
            <p className="text-xs text-[#9945FF]/40 mt-3">Risk assessment</p>
          </div>

          <div className="space-y-4 sm:space-y-5 text-left w-full bg-[#9945FF]/5 p-5 sm:p-8 border-l-2 border-[#9945FF]/20 max-h-[35vh] sm:max-h-none overflow-y-auto">
            <div className="flex gap-4">
              <span className="text-[#9945FF] mono font-bold text-xs sm:text-sm shrink-0">[01]</span>
              <p className="text-xs sm:text-sm text-white leading-relaxed">
                High-stakes degen protocol. 100% risk of loss is possible at any moment during a raid.
              </p>
            </div>
            <div className="flex gap-4">
              <span className="text-[#9945FF] mono font-bold text-xs sm:text-sm shrink-0">[02]</span>
              <p className="text-xs sm:text-sm text-white leading-relaxed">
                Not financial advice. We are not responsible for busted connections or network lag.
              </p>
            </div>
            <div className="flex gap-4">
              <span className="text-[#9945FF] mono font-bold text-xs sm:text-sm shrink-0">[03]</span>
              <p className="text-xs sm:text-sm text-white leading-relaxed">
                All on-chain interactions are final and non-refundable.
              </p>
            </div>
          </div>

          <div className="w-full space-y-5">
            <label className="flex items-center gap-4 cursor-pointer group justify-center sm:justify-start">
              <input
                type="checkbox"
                className="hidden"
                checked={ageConfirmed}
                onChange={() => setAgeConfirmed(!ageConfirmed)}
              />
              <div className={`w-6 h-6 border-2 tech-border transition-colors flex items-center justify-center shrink-0 ${ageConfirmed ? 'bg-[#9945FF] border-[#9945FF]' : 'border-white/10 group-hover:border-[#9945FF]/50'}`}>
                {ageConfirmed && <div className="w-2.5 h-2.5 bg-white" />}
              </div>
              <span className={`text-xs sm:text-sm font-bold transition-colors ${ageConfirmed ? 'text-white' : 'text-white'}`}>
                I am 18 years of age or older
              </span>
            </label>

            <div className="space-y-3">
              <button
                onClick={() => ageConfirmed && onAccept()}
                disabled={!ageConfirmed}
                className={`w-full py-5 sm:py-6 tech-border font-bold uppercase tracking-tight text-xl sm:text-2xl transition-all shadow-lg
                  ${ageConfirmed
                    ? 'bg-[#8833ee] text-white shadow-[0_0_30px_rgba(153,69,255,0.3)] hover:bg-[#9945FF] active:scale-95'
                    : 'bg-white/5 text-white border-white/5 cursor-not-allowed'}`}
              >
                I understand the risk
              </button>
              <button
                className="w-full bg-black border-2 border-white/5 text-white py-4 sm:py-5 tech-border font-bold tracking-wide text-[10px] sm:text-xs hover:text-white transition-colors"
                onClick={() => window.location.href = 'https://solana.com'}
              >
                Leave
              </button>
            </div>
          </div>

          <p className="text-[9px] sm:text-[10px] text-white mt-3 shrink-0">
            Solana Raid · for entertainment only
          </p>
        </div>
      </div>
    </div>
  );
};

export default DisclaimerOverlay;
