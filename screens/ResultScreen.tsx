
import React from 'react';

interface ResultScreenProps {
  result: {
    success: boolean;
    solAmount: number;
    points: number;
    srEarned: number;
  };
  entryFee: number;
  onPlayAgain: () => void;
  onClaim: () => void;
}

const ResultScreen: React.FC<ResultScreenProps> = ({ result, entryFee, onPlayAgain, onClaim }) => {
  return (
    <div className="h-full flex flex-col p-6 animate-in zoom-in-95 duration-500 overflow-y-auto scrollbar-hide">
      <div className="flex-1 flex flex-col items-center justify-center py-6 sm:py-10">
        <div className={`mb-6 sm:mb-10 px-8 py-4 border-4 italic ${result.success ? 'bg-green-500/10 border-green-500 text-green-500' : 'bg-red-500/10 border-red-500 text-red-500'} tech-border font-black text-3xl sm:text-4xl`}>
          {result.success ? 'EXTRACTED' : 'BUSTED'}
        </div>

        <h2 className={`text-4xl sm:text-6xl font-black italic uppercase tracking-tighter mb-2 sm:mb-4 leading-none text-center ${result.success ? 'text-white glitch-text' : 'text-red-500'}`}>
          {result.success ? 'MISSION_OK' : 'LINK_COLLAPSED'}
        </h2>
        <p className="text-white/30 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.4em] mb-8 sm:mb-12 text-center italic">
            {result.success ? '___Operation success. Assets secured.' : '___Critical failure. Initial stake purged.'}
        </p>

        <div className="w-full max-w-sm space-y-4">
            {/* SOL Results */}
            <div className={`bg-black border-2 p-6 sm:p-8 tech-border relative overflow-hidden transition-colors ${result.success ? 'border-green-500' : 'border-red-500/40'}`}>
                <div className="absolute top-0 right-0 p-4 opacity-5 mono text-2xl font-black italic uppercase">
                    [SOL]
                </div>
                <p className="text-[10px] text-white/30 font-black uppercase tracking-widest mb-3 italic">__Harvest Yield</p>
                <p className={`mono text-4xl sm:text-5xl font-black italic tracking-tighter leading-none ${result.success ? 'text-white' : 'text-red-500/40'}`}>
                    {result.success ? `+${result.solAmount.toFixed(4)}` : `-${entryFee.toFixed(3)}`} <span className="text-xs sm:text-sm font-normal not-italic opacity-30 ml-2">SOL</span>
                </p>
            </div>

            {/* SR Points Rewards */}
            <div className="bg-black border-2 border-yellow-500/20 p-6 sm:p-8 tech-border relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 mono text-2xl font-black italic uppercase text-yellow-500">
                    [$SR]
                </div>
                <p className="text-[10px] text-yellow-500/40 font-black uppercase tracking-widest mb-3 italic">__Reputation Gain</p>
                <div className="flex items-baseline gap-2">
                  <p className="mono text-4xl sm:text-5xl font-black italic tracking-tighter leading-none text-yellow-500">
                      +{result.srEarned}
                  </p>
                  <span className="text-xs sm:text-sm font-black text-yellow-500/40 italic">PTS</span>
                </div>
                <div className="mt-4 flex gap-1">
                   {[...Array(6)].map((_, i) => (
                     <div key={i} className="h-1 flex-1 bg-yellow-500/10 overflow-hidden">
                       <div className="h-full bg-yellow-500 animate-[shimmer_1s_infinite]" style={{ animationDelay: `${i*0.2}s` }} />
                     </div>
                   ))}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="bg-black border-2 border-white/5 p-4 sm:p-6 tech-border">
                    <p className="text-[8px] sm:text-[9px] text-white/20 font-black uppercase mb-1 tracking-widest">Experience</p>
                    <p className="mono text-xl sm:text-2xl font-black">+{result.points.toLocaleString()}</p>
                </div>
                <div className="bg-black border-2 border-white/5 p-4 sm:p-6 tech-border">
                    <p className="text-[8px] sm:text-[9px] text-white/20 font-black uppercase mb-1 tracking-widest">Rank Power</p>
                    <p className="mono text-xl sm:text-2xl font-black text-cyan-400">+{Math.floor(result.points / 120)}</p>
                </div>
            </div>
        </div>
      </div>

      <div className="py-6 sm:py-8 space-y-3 shrink-0">
        {result.success ? (
          <button 
            onClick={onClaim}
            className="w-full bg-green-500 text-black py-5 sm:py-6 tech-border font-black uppercase tracking-tight text-lg sm:text-xl shadow-[0_0_30px_rgba(34,197,94,0.3)] active:scale-95 transition-all italic"
          >
            CLAIM_HARVEST
          </button>
        ) : (
          <button 
            onClick={onPlayAgain}
            className="w-full bg-red-600 text-white py-5 sm:py-6 tech-border font-black uppercase tracking-tight text-lg sm:text-xl active:scale-95 transition-all italic shadow-[0_0_20px_rgba(239,68,68,0.2)]"
          >
            RETRY_REDEPLOY
          </button>
        )}
        <button 
          onClick={onPlayAgain}
          className="w-full bg-white text-black py-4 sm:py-5 tech-border font-black uppercase tracking-tight text-lg active:scale-95 transition-all italic"
        >
          {result.success ? 'RAID_AGAIN' : 'LOBBY_REENTRY'}
        </button>
      </div>
    </div>
  );
};

export default ResultScreen;
