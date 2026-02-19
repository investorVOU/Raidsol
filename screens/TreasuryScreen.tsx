
import React from 'react';

interface TreasuryScreenProps {
  onBack: () => void;
}

const TreasuryScreen: React.FC<TreasuryScreenProps> = ({ onBack }) => {
  const TREASURY_ADDRESS = "7XwPZ...92zXk"; // Mock truncated address

  return (
    <div className="h-full flex flex-col p-6 animate-in slide-in-from-right duration-300 overflow-y-auto scrollbar-hide">
        {/* Header */}
        <div className="shrink-0 flex items-center gap-4 mb-8">
            <button onClick={onBack} className="text-white/40 hover:text-white font-black text-2xl">{'<'}</button>
            <div>
                <h2 className="text-4xl font-black italic uppercase tracking-tighter text-white">PROTOCOL_<span className="text-[#14F195]">TREASURY</span></h2>
                <p className="text-xs font-black text-white/30 uppercase tracking-[0.4em]">Solvency_Check_v5.0</p>
            </div>
        </div>

        {/* Main Content */}
        <div className="space-y-6 max-w-4xl">
            {/* Big Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#050505] border-2 border-[#14F195]/30 p-8 tech-border relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <span className="text-6xl font-black text-[#14F195]">SOL</span>
                    </div>
                    <p className="text-sm font-black text-white/40 uppercase tracking-widest mb-2">TOTAL_RESERVE</p>
                    <p className="text-5xl font-black text-white mono tracking-tighter">12,450.42</p>
                    <p className="text-xs font-black text-[#14F195] mt-2 uppercase tracking-wider">STATUS: OVER-COLLATERALIZED</p>
                </div>

                <div className="bg-[#050505] border-2 border-white/10 p-8 tech-border">
                    <p className="text-sm font-black text-white/40 uppercase tracking-widest mb-2">24H_PAYOUTS</p>
                    <p className="text-5xl font-black text-white mono tracking-tighter">482.50</p>
                     <p className="text-xs font-black text-white/20 mt-2 uppercase tracking-wider">VIA 1,402 TRANSACTIONS</p>
                </div>
            </div>

            {/* Verification Link */}
            <div className="p-6 bg-[#14F195]/5 border border-[#14F195]/20 tech-border flex flex-col md:flex-row justify-between items-center gap-6">
                <div>
                    <h3 className="text-lg font-black uppercase text-[#14F195] italic">VERIFY ON CHAIN</h3>
                    <div className="flex items-center gap-2 mt-1 mb-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-white/40">TREASURY_ADDR:</span>
                        <span className="mono text-xs text-white bg-black/50 px-2 py-1 border border-white/10">{TREASURY_ADDRESS}</span>
                    </div>
                    <p className="text-xs text-white/60 font-medium max-w-md">
                        The treasury wallet is public. You can audit all inflows (fees) and outflows (payouts) directly on the ledger.
                    </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                    <a 
                        href="https://explorer.solana.com/" 
                        target="_blank" 
                        rel="noreferrer"
                        className="px-5 py-3 bg-black border border-purple-500/30 text-purple-400 font-black uppercase tracking-tight text-xs hover:bg-purple-500/10 transition-colors tech-border text-center"
                    >
                        SOLANA EXPLORER
                    </a>
                    <a 
                        href="https://solscan.io/" 
                        target="_blank" 
                        rel="noreferrer"
                        className="px-6 py-3 bg-[#14F195] text-black font-black uppercase tracking-tight text-xs hover:bg-[#10c479] transition-colors tech-border text-center shadow-[0_0_15px_rgba(20,241,149,0.2)]"
                    >
                        VIEW ON SOLSCAN
                    </a>
                </div>
            </div>

            {/* Recent Transactions List (Fake) */}
            <div className="border-t border-white/10 pt-6">
                <h3 className="text-sm font-black text-white/40 uppercase tracking-widest mb-4">RECENT_PROTOCOLS</h3>
                <div className="space-y-2 font-mono text-xs">
                    {[...Array(8)].map((_, i) => (
                        <div key={i} className="flex justify-between items-center p-3 bg-white/2 border border-white/5 hover:bg-white/5 transition-colors">
                            <span className="text-white/40">TX_{Math.random().toString(16).substr(2, 8).toUpperCase()}</span>
                            <span className={i % 3 === 0 ? "text-red-500" : "text-[#14F195]"}>
                                {i % 3 === 0 ? "INFLOW (FEE)" : "OUTFLOW (WIN)"}
                            </span>
                            <span className="text-white font-bold">{i % 3 === 0 ? "+0.025" : "-1.250"} SOL</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    </div>
  );
};

export default TreasuryScreen;
