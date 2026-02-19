
import React from 'react';

interface TermsScreenProps {
  onBack: () => void;
}

const TermsScreen: React.FC<TermsScreenProps> = ({ onBack }) => {
  return (
    <div className="h-full flex flex-col bg-[#000000] animate-in slide-in-from-right duration-300">
      <div className="p-8 shrink-0 border-b border-white/5 flex items-center gap-6">
        <button 
          onClick={onBack}
          className="px-5 py-3 border-2 border-white/5 tech-border text-xs font-black uppercase text-purple-400 italic hover:text-white hover:border-white/20 transition-all"
        >
          [BACK]
        </button>
        <div>
          <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white">PROTOCOL_<span className="text-purple-400">TERMS</span></h2>
          <p className="text-xs font-black text-white/20 uppercase tracking-[0.4em] mt-2">Rules_of_Engagement_v4.2</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 space-y-12 scrollbar-hide">
        <div className="p-6 bg-red-900/10 border-2 border-red-500/20 tech-border mb-4">
             <div className="flex items-center gap-2 mb-3">
               <span className="text-xs font-black text-red-500 uppercase tracking-[0.3em] italic">[!] LEGAL_DISCLAIMER</span>
             </div>
             <p className="text-xs text-red-500/70 leading-tight italic font-black uppercase">
               THIS IS NOT A FINANCIAL SERVICE. THIS IS A PROTOCOL-BASED GAME. ALL SOL TRANSFERS ARE FINAL.
             </p>
        </div>

        <section>
          <div className="flex items-center gap-4 mb-4">
             <div className="px-4 py-1.5 bg-purple-500/10 border border-purple-500/20 text-xs font-black text-purple-400 uppercase italic">_01</div>
             <h3 className="text-sm font-black uppercase tracking-widest text-white">NO_REFUNDS</h3>
          </div>
          <p className="text-sm text-white/30 leading-relaxed italic font-medium">
            The entry fee is used to initialize the protocol connection on the blockchain. Once the transaction is signed and broadcast, there are no reversals or refunds, even if your connection fails.
          </p>
        </section>

        <section>
          <div className="flex items-center gap-4 mb-4">
             <div className="px-4 py-1.5 bg-cyan-500/10 border border-cyan-500/20 text-xs font-black text-cyan-400 uppercase italic">_02</div>
             <h3 className="text-sm font-black uppercase tracking-widest text-white">BUST_CONDITIONS</h3>
          </div>
          <p className="text-sm text-white/30 leading-relaxed italic font-medium">
            Busting in a raid results in the total loss of the entry fee and any harvested assets. The risk algorithm is dynamic and potentially lethal. By entering, you accept this mathematical certainty.
          </p>
        </section>

        <section>
          <div className="flex items-center gap-4 mb-4">
             <div className="px-4 py-1.5 bg-white/5 border border-white/10 text-xs font-black text-white/40 uppercase italic">_03</div>
             <h3 className="text-sm font-black uppercase tracking-widest text-white">CODE_AS_LAW</h3>
          </div>
          <p className="text-sm text-white/30 leading-relaxed italic font-medium">
            The protocol code governs all distributions. Any exploits are part of the degen environment. We are not responsible for MEV bots or network congestion affecting extraction speed.
          </p>
        </section>

        <div className="py-12 text-center border-t border-white/5">
          <p className="text-xs font-black uppercase tracking-[0.5em] text-white/10 italic">__PROCEED_ONLY_WITH_ICE_IN_VEINS__</p>
        </div>
      </div>
    </div>
  );
};

export default TermsScreen;
