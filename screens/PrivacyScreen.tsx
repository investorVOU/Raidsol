
import React from 'react';

interface PrivacyScreenProps {
  onBack: () => void;
}

const PrivacyScreen: React.FC<PrivacyScreenProps> = ({ onBack }) => {
  return (
    <div className="h-full flex flex-col bg-[#000000] animate-in slide-in-from-right duration-300">
      <div className="p-8 shrink-0 border-b border-white/5 flex items-center gap-6">
        <button 
          onClick={onBack}
          className="px-5 py-3 border-2 border-white/5 tech-border text-xs font-black uppercase text-cyan-400 italic hover:text-white hover:border-white/20 transition-all"
        >
          [BACK]
        </button>
        <div>
          <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white">PRIVACY_<span className="text-cyan-400">LOG</span></h2>
          <p className="text-xs font-black text-white/20 uppercase tracking-[0.4em] mt-2">Data_Handling_Policy_v4.2</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 space-y-12 scrollbar-hide">
        <section>
          <div className="flex items-center gap-4 mb-4">
             <div className="px-4 py-1.5 bg-cyan-500/10 border border-cyan-500/20 text-xs font-black text-cyan-400 uppercase italic">_01</div>
             <h3 className="text-sm font-black uppercase tracking-widest text-white">DATA_COLLECTION</h3>
          </div>
          <p className="text-sm text-white/30 leading-relaxed italic font-medium">
            The Solana Raid Protocol only sees your public wallet address and on-chain raiding history. We do not collect cookies, IP addresses, or personal identity markers. You are an anonymous node in our net.
          </p>
        </section>

        <section>
          <div className="flex items-center gap-4 mb-4">
             <div className="px-4 py-1.5 bg-purple-500/10 border border-purple-500/20 text-xs font-black text-purple-400 uppercase italic">_02</div>
             <h3 className="text-sm font-black uppercase tracking-widest text-white">BLOCKCHAIN_RECORDS</h3>
          </div>
          <p className="text-sm text-white/30 leading-relaxed italic font-medium">
            Every raid entry, attack, and extraction is recorded on the Solana blockchain. This data is permanent and public by nature. The Raid Protocol interface simply visualizes this data for your tactical advantage.
          </p>
        </section>

        <section>
          <div className="flex items-center gap-4 mb-4">
             <div className="px-4 py-1.5 bg-orange-500/10 border border-orange-500/20 text-xs font-black text-orange-400 uppercase italic">_03</div>
             <h3 className="text-sm font-black uppercase tracking-widest text-white">THIRD_PARTY_NODES</h3>
          </div>
          <p className="text-sm text-white/30 leading-relaxed italic font-medium">
            We may link to community tools or market data providers. These external nodes have their own encryption protocols. Engage with them at your own risk.
          </p>
        </section>

        <div className="p-8 border-2 border-dashed border-white/5 tech-border text-center">
          <p className="text-xs font-black uppercase tracking-[0.5em] text-white/10 italic">__END_OF_DISCLOSURE__</p>
        </div>
      </div>
    </div>
  );
};

export default PrivacyScreen;
