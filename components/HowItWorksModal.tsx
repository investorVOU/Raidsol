
import React from 'react';
import { Screen } from '../types';

interface HowItWorksModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateLegal: (screen: Screen) => void;
}

const HowItWorksModal: React.FC<HowItWorksModalProps> = ({ isOpen, onClose, onNavigateLegal }) => {
  if (!isOpen) return null;

  const steps = [
    {
      label: "[AUTH]",
      title: "1. SECURE CONNECTION",
      desc: "Link your Solana wallet to the Raid Protocol. This allows you to sign transactions for entry and extractions."
    },
    {
      label: "[DEPL]",
      title: "2. DEPLOY ASSETS",
      desc: "Entry fee (e.g. 0.026 SOL) grants entry into a secure tunnel. This is the stake for protocol initialization."
    },
    {
      label: "[HRVST]",
      title: "3. DATA HARVEST",
      desc: "Once inside, harvest data packets. Higher risk increases your reward multiplier but makes system failure more likely."
    },
    {
      label: "[EXTR]",
      title: "4. EXTRACTION",
      desc: "Abort at any time to extract your harvested assets. If risk reaches 100%, connection is terminated and assets are purged."
    }
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/95 backdrop-blur-md animate-in fade-in duration-300"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative w-full max-w-md bg-[#050505] border-4 border-white/10 p-1 tech-border shadow-[0_0_100px_rgba(0,0,0,1)] animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-8 border-b border-white/5 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-3xl font-black uppercase italic tracking-tighter text-white leading-none">HOW_IT_WORKS</h2>
            <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.4em] mt-2">Protocol_Documentation_v4.2</p>
          </div>
          <button 
            onClick={onClose}
            className="text-white/20 hover:text-white transition-colors font-black text-lg"
          >
            [X]
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-10 scrollbar-hide">
          {steps.map((step, idx) => (
            <div key={idx} className="flex gap-6">
              <div className="shrink-0 w-14 h-14 bg-white/2 border-2 border-white/5 flex items-center justify-center font-black text-[9px] text-cyan-500 tracking-tighter italic tech-border">
                {step.label}
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-white mb-2">{step.title}</h3>
                <p className="text-[11px] text-white/30 leading-relaxed font-medium italic">{step.desc}</p>
              </div>
            </div>
          ))}

          {/* Warning Box */}
          <div className="p-6 bg-red-900/10 border-2 border-red-500/20 tech-border">
             <div className="flex items-center gap-2 mb-3">
               <span className="text-[10px] font-black text-red-500 uppercase tracking-[0.3em] italic">[!] DEGEN_WARNING</span>
             </div>
             <p className="text-[10px] text-red-500/60 leading-tight italic font-black">
               RAIDING IS HIGH RISK. THE PROTOCOL CAN BUST AT ANY MOMENT. ONLY STAKE WHAT YOU ARE PREPARED TO LOSE IN THE NETHER.
             </p>
          </div>
        </div>

        {/* Footer Legal Links */}
        <div className="p-8 border-t border-white/5 bg-black shrink-0">
          <div className="flex gap-3 mb-6">
             <button 
               onClick={() => { onClose(); onNavigateLegal(Screen.PRIVACY); }}
               className="flex-1 p-4 bg-white/2 border border-white/5 text-[10px] font-black uppercase tracking-widest hover:text-white transition-all italic text-white/30"
             >
               Privacy
             </button>
             <button 
               onClick={() => { onClose(); onNavigateLegal(Screen.TERMS); }}
               className="flex-1 p-4 bg-white/2 border border-white/5 text-[10px] font-black uppercase tracking-widest hover:text-white transition-all italic text-white/30"
             >
               Terms
             </button>
          </div>
          <p className="text-[9px] text-center text-white/10 font-black tracking-[0.5em] uppercase">© 2025 SOLANA RAID PROTOCOL</p>
        </div>
      </div>
    </div>
  );
};

export default HowItWorksModal;
