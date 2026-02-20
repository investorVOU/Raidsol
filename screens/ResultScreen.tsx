
import React from 'react';

interface ResultScreenProps {
  result: {
    success: boolean;
    solAmount: number;
    points: number;
    srEarned: number;
    raidId: string;
    serverSeedHash: string;
    userWallet: string;
    txSignature: string;
  };
  entryFee: number;
  onPlayAgain: () => void;
  onRedeploy?: () => void;  // Re-run with exact same config — optional (falls back to lobby)
  onClaim: () => void;
}

const ResultScreen: React.FC<ResultScreenProps> = ({ result, entryFee, onPlayAgain, onRedeploy, onClaim }) => {
  
  const handleShareToX = () => {
    const text = `MISSION SUCCESS 🏴‍☠️\n\nI just extracted ${result.solAmount.toFixed(4)} $SOL from the Protocol.\n\nRisk: CRITICAL\nStatus: LEGEND\n\nCan you survive the drain?\n\n@solana @solanamobile #Solana #DegenRaid`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent('https://solanaraid.game')}`;
    window.open(url, '_blank');
  };

  return (
    <div className="h-full flex flex-col p-6 animate-in zoom-in-95 duration-500 overflow-y-auto scrollbar-hide">
      <div className="flex-1 flex flex-col items-center justify-center py-6 sm:py-10">
        <div className={`mb-6 sm:mb-10 px-10 py-5 border-4 italic ${result.success ? 'bg-green-500/10 border-green-500 text-green-500' : 'bg-red-500/10 border-red-500 text-red-500'} tech-border font-black text-4xl sm:text-5xl`}>
          {result.success ? 'EXTRACTED' : 'BUSTED'}
        </div>

        <h2 className={`text-5xl sm:text-7xl font-black italic uppercase tracking-tighter mb-4 leading-none text-center ${result.success ? 'text-white glitch-text' : 'text-red-500'}`}>
          {result.success ? 'MISSION_OK' : 'LINK_COLLAPSED'}
        </h2>
        <p className="text-white/30 text-xs sm:text-sm font-black uppercase tracking-[0.4em] mb-8 sm:mb-12 text-center italic">
            {result.success ? '___Operation success. Assets secured.' : '___Critical failure. Initial stake purged.'}
        </p>

        <div className="w-full max-w-sm space-y-4">
            {/* SOL Results */}
            <div className={`bg-black border-2 p-6 sm:p-8 tech-border relative overflow-hidden transition-colors ${result.success ? 'border-green-500' : 'border-red-500/40'}`}>
                <div className="absolute top-0 right-0 p-4 opacity-5 mono text-2xl font-black italic uppercase">
                    [SOL]
                </div>
                <p className="text-xs text-white/30 font-black uppercase tracking-widest mb-3 italic">__Harvest Yield</p>
                <p className={`mono text-5xl sm:text-6xl font-black italic tracking-tighter leading-none ${result.success ? 'text-white' : 'text-red-500/40'}`}>
                    {result.success ? `+${result.solAmount.toFixed(4)}` : `-${entryFee.toFixed(3)}`} <span className="text-sm sm:text-base font-normal not-italic opacity-30 ml-2">SOL</span>
                </p>
            </div>

            {/* SR Points Rewards */}
            <div className="bg-black border-2 border-yellow-500/20 p-6 sm:p-8 tech-border relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 mono text-2xl font-black italic uppercase text-yellow-500">
                    [$SR]
                </div>
                <p className="text-xs text-yellow-500/40 font-black uppercase tracking-widest mb-3 italic">__Reputation Gain</p>
                <div className="flex items-baseline gap-2">
                  <p className="mono text-5xl sm:text-6xl font-black italic tracking-tighter leading-none text-yellow-500">
                      +{result.srEarned}
                  </p>
                  <span className="text-sm sm:text-base font-black text-yellow-500/40 italic">PTS</span>
                </div>
                <div className="mt-4 flex gap-1">
                   {[...Array(6)].map((_, i) => (
                     <div key={i} className="h-1.5 flex-1 bg-yellow-500/10 overflow-hidden">
                       <div className="h-full bg-yellow-500 animate-[shimmer_1s_infinite]" style={{ animationDelay: `${i*0.2}s` }} />
                     </div>
                   ))}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="bg-black border-2 border-white/5 p-4 sm:p-6 tech-border">
                    <p className="text-[10px] sm:text-xs text-white/20 font-black uppercase mb-1 tracking-widest">Experience</p>
                    <p className="mono text-2xl sm:text-3xl font-black">+{result.points.toLocaleString()}</p>
                </div>
                <div className="bg-black border-2 border-white/5 p-4 sm:p-6 tech-border">
                    <p className="text-[10px] sm:text-xs text-white/20 font-black uppercase mb-1 tracking-widest">Rank Power</p>
                    <p className="mono text-2xl sm:text-3xl font-black text-cyan-400">+{Math.floor(result.points / 120)}</p>
                </div>
            </div>

            {/* Verifiable Proof Section */}
            <div className="mt-8 p-6 bg-black border-2 border-white/5 tech-border">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2.5 h-2.5 bg-cyan-400 rounded-full animate-pulse" />
                <h3 className="text-xs font-black uppercase tracking-[0.3em] text-cyan-400 italic">VERIFIABLE_PROOF</h3>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center pb-2 border-b border-white/5">
                   <span className="text-[10px] font-black text-white/30 uppercase tracking-widest">RAID_ID</span>
                   <span className="mono text-xs text-white/60">{result.raidId}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-white/5">
                   <span className="text-[10px] font-black text-white/30 uppercase tracking-widest">SERVER_HASH</span>
                   <span className="mono text-xs text-white/60 truncate w-32 text-right">{result.serverSeedHash}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-white/5">
                   <span className="text-[10px] font-black text-white/30 uppercase tracking-widest">USER_WALLET</span>
                   <span className="mono text-xs text-white/60">{result.userWallet}</span>
                </div>
                 <div className="flex justify-between items-center">
                   <span className="text-[10px] font-black text-white/30 uppercase tracking-widest">TX_SIG</span>
                   <a
                     href={`https://solscan.io/tx/${result.txSignature}?cluster=devnet`}
                     target="_blank"
                     rel="noopener noreferrer"
                     className="mono text-xs text-cyan-400 underline hover:text-cyan-300 truncate w-32 text-right"
                   >
                     {result.txSignature.substring(0, 16)}...
                   </a>
                </div>
              </div>
            </div>
        </div>
      </div>

      <div className="py-6 sm:py-8 space-y-4 shrink-0">
        {result.success ? (
          <>
             <button
               onClick={onClaim}
               className="w-full bg-green-500 text-black py-5 sm:py-6 tech-border font-black uppercase tracking-tight text-xl sm:text-2xl shadow-[0_0_30px_rgba(34,197,94,0.3)] active:scale-95 transition-all italic"
             >
               COLLECT_HARVEST →_PROFILE
             </button>
             
             {/* SHARE BUTTON */}
             <button 
               onClick={handleShareToX}
               className="w-full bg-black border-2 border-white/20 text-white py-4 sm:py-5 tech-border font-black uppercase tracking-tight text-lg sm:text-xl active:scale-95 transition-all italic hover:bg-white hover:text-black hover:border-white group flex items-center justify-center gap-3"
             >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                   <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                BROADCAST_VICTORY
             </button>
          </>
        ) : (
          <button
            onClick={onRedeploy ?? onPlayAgain}
            className="w-full bg-red-600 text-white py-5 sm:py-6 tech-border font-black uppercase tracking-tight text-xl sm:text-2xl active:scale-95 transition-all italic shadow-[0_0_20px_rgba(239,68,68,0.2)]"
          >
            {onRedeploy ? 'RETRY_SAME_CONFIG' : 'RETRY_REDEPLOY'}
          </button>
        )}
        <button 
          onClick={onPlayAgain}
          className="w-full bg-[#050505] text-white/40 hover:text-white py-4 sm:py-5 tech-border font-black uppercase tracking-tight text-sm sm:text-base active:scale-95 transition-all italic border border-white/10"
        >
          {result.success ? 'RETURN_TO_LOBBY' : 'ABORT_TO_LOBBY'}
        </button>
      </div>
    </div>
  );
};

export default ResultScreen;
