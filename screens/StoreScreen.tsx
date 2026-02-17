
import React, { useState } from 'react';
import { GEAR_ITEMS, AVATAR_ITEMS } from '../types';

interface StoreScreenProps {
  walletBalance: number;
  ownedItemIds: string[];
  onPurchase: (itemId: string, price: number) => boolean;
  currentLevel: number;
}

interface PurchasePopup {
  id: number;
  val: number;
  x: number;
  y: number;
}

const StoreScreen: React.FC<StoreScreenProps> = ({ walletBalance, ownedItemIds, onPurchase, currentLevel }) => {
  const [activeTab, setActiveTab] = useState<'GEAR' | 'AVATAR'>('GEAR');
  const [popups, setPopups] = useState<PurchasePopup[]>([]);

  const filteredItems = activeTab === 'GEAR' ? GEAR_ITEMS : AVATAR_ITEMS;

  const handleBuy = (itemId: string, price: number, minLevel: number = 0) => {
    if (currentLevel < minLevel) return;
    const success = onPurchase(itemId, price);
    if (success) {
      const srReward = Math.max(50, Math.floor(price * 1000));
      const id = Date.now();
      
      const x = Math.floor(Math.random() * 100) - 50; 
      const y = Math.floor(Math.random() * 60) - 30;
      
      setPopups(prev => [...prev, { id, val: srReward, x, y }]);
      setTimeout(() => {
        setPopups(prev => prev.filter(p => p.id !== id));
      }, 1000);
    }
  };

  const getRarityStyles = (rarity?: string) => {
    switch (rarity) {
      case 'EXCLUSIVE':
        return {
          text: 'text-yellow-500',
          border: 'border-yellow-500/30',
          bg: 'bg-yellow-500/10',
          button: 'bg-yellow-500 text-black',
          shadow: 'hover:shadow-[0_0_25px_rgba(234,179,8,0.2)]'
        };
      case 'LIMITED':
        return {
          text: 'text-purple-500',
          border: 'border-purple-500/30',
          bg: 'bg-purple-500/10',
          button: 'bg-purple-600 text-white',
          shadow: 'hover:shadow-[0_0_20px_rgba(153,69,255,0.2)]'
        };
      default:
        return {
          text: 'text-white/40',
          border: 'border-white/10',
          bg: 'bg-white/5',
          button: 'bg-[#14F195] text-black',
          shadow: 'hover:shadow-[0_0_20px_rgba(20,241,149,0.1)]'
        };
    }
  };

  return (
    <div className="h-full flex flex-col p-6 lg:p-12 animate-in slide-in-from-bottom-4 duration-300 overflow-y-auto scrollbar-hide pb-24 relative">
      
      <div className="fixed inset-0 pointer-events-none z-[100] flex items-center justify-center">
        {popups.map(p => (
          <div 
            key={p.id} 
            className="absolute animate-sr-popup pointer-events-none flex flex-col items-center"
            style={{ transform: `translate(${p.x}px, ${p.y}px)` }}
          >
            <span className="text-2xl sm:text-4xl font-black text-yellow-500 italic drop-shadow-[0_0_15px_rgba(234,179,8,1)] uppercase tracking-tighter">
              ITEM_SECURED
            </span>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xl sm:text-2xl font-black text-yellow-500 italic">+{p.val}</span>
              <span className="text-[10px] font-black text-yellow-500/60 uppercase tracking-[0.2em]">SR_REPUTATION</span>
            </div>
          </div>
        ))}
      </div>

      <div className="w-full max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-4">
          <div>
            <h2 className="text-4xl lg:text-6xl font-black italic uppercase tracking-tighter text-white leading-none">
              BLACK_<span className="text-gradient-solana">MARKET</span>
            </h2>
            <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em] mt-3">UNOFFICIAL_EQUIPMENT_DEPOT</p>
          </div>
          <div className="bg-black/60 p-5 border border-white/10 tech-border">
            <p className="text-[8px] text-white/20 font-black uppercase mb-1 italic">AVAILABLE_CREDITS</p>
            <div className="flex items-baseline gap-2">
              <p className="mono text-2xl font-black text-white">{walletBalance.toFixed(3)}</p>
              <span className="text-xs text-[#14F195] font-black italic">SOL</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mb-10">
          <button 
            onClick={() => setActiveTab('GEAR')}
            className={`flex-1 py-4 lg:py-6 border-2 tech-border font-black uppercase tracking-[0.3em] text-[10px] transition-all ${activeTab === 'GEAR' ? 'border-[#14F195] text-[#14F195] bg-[#14F195]/10' : 'border-white/5 text-white/10'}`}
          >
            [ BATTLE_TOOLS ]
          </button>
          <button 
            onClick={() => setActiveTab('AVATAR')}
            className={`flex-1 py-4 lg:py-6 border-2 tech-border font-black uppercase tracking-[0.3em] text-[10px] transition-all ${activeTab === 'AVATAR' ? 'border-[#9945FF] text-[#9945FF] bg-[#9945FF]/10' : 'border-white/5 text-white/10'}`}
          >
            [ IDENTITY_CORES ]
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredItems.map(item => {
            const isOwned = ownedItemIds.includes(item.id);
            const levelLocked = currentLevel < (item.minLevel || 0);
            const canAfford = walletBalance >= item.price;
            const srReward = Math.max(50, Math.floor(item.price * 1000));
            const rarityStyle = getRarityStyles(item.rarity);

            return (
              <div 
                key={item.id} 
                className={`bg-[#050505] border-2 p-5 tech-border group transition-all flex flex-col 
                  ${isOwned ? 'border-white/10 opacity-60' : levelLocked ? 'border-red-950/20 opacity-40 grayscale' : `border-white/5 ${rarityStyle.shadow}`}`}
              >
                <div className="flex gap-4 mb-5">
                  <div className={`relative w-20 h-20 md:w-24 md:h-24 bg-black border ${rarityStyle.border} flex items-center justify-center shrink-0 overflow-hidden`}>
                    {item.image ? (
                      <img 
                        src={item.image} 
                        alt={item.name} 
                        className={`w-full h-full p-2 transition-all ${activeTab === 'GEAR' ? 'object-contain' : 'object-cover grayscale brightness-75 group-hover:grayscale-0 group-hover:brightness-100'}`} 
                        style={{ imageRendering: 'pixelated' }}
                      />
                    ) : (
                      <span className="text-[10px] font-black text-white/10">DATA_DRIVE</span>
                    )}
                    
                    <div className={`absolute top-0 left-0 px-1 py-0.5 ${rarityStyle.bg} border-b border-r ${rarityStyle.border}`}>
                      <span className={`text-[6px] font-black uppercase tracking-tighter ${rarityStyle.text}`}>{item.rarity}</span>
                    </div>
                  </div>
                  
                  <div className="flex-1 flex flex-col">
                    <div className="flex justify-between items-start">
                      <h4 className="font-black uppercase tracking-tight text-white italic text-sm leading-tight">{item.name}</h4>
                    </div>
                    <div className="mt-2 space-y-1">
                      {levelLocked ? (
                        <span className="block text-[8px] font-black text-red-500 uppercase tracking-tighter animate-pulse">LOCKED: LVL_{item.minLevel}</span>
                      ) : (
                        <>
                          {item.effect && (
                            <span className="block text-[8px] font-black text-[#14F195] uppercase tracking-tighter">_ MOD: {item.effect.replace('_', ' ')}</span>
                          )}
                          <span className="block text-[8px] font-black text-yellow-500 uppercase tracking-tighter">_ GAINS: +{srReward} $SR</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <p className="text-[10px] text-white/30 font-medium leading-tight mb-6 flex-1 italic">{item.description}</p>
                
                <div className="flex justify-between items-end mt-auto pt-4 border-t border-white/5">
                  <div className="mono flex flex-col">
                     <span className="text-[8px] font-black text-white/10 uppercase mb-1">COST</span>
                     <span className="text-sm font-black text-white">{item.price} <span className="text-[10px] text-[#14F195]">SOL</span></span>
                  </div>
                  
                  {isOwned ? (
                    <div className="px-6 py-2 font-black uppercase tracking-tighter text-[11px] tech-border bg-white/5 text-white/20 border-white/5 text-center cursor-default">
                      OWNED
                    </div>
                  ) : levelLocked ? (
                    <div className="px-6 py-2 font-black uppercase tracking-tighter text-[11px] tech-border bg-red-950/20 text-red-500/40 border-red-500/10 text-center cursor-default">
                      LOCKED
                    </div>
                  ) : (
                    <button 
                      onClick={() => handleBuy(item.id, item.price, item.minLevel)}
                      disabled={!canAfford}
                      className={`px-6 py-2 font-black uppercase tracking-tighter text-[11px] tech-border transition-all 
                        ${!canAfford 
                          ? 'bg-white/5 text-white/10 border-white/5 cursor-not-allowed' 
                          : `${rarityStyle.button} hover:opacity-90 active:translate-y-0.5`}`}
                    >
                      BUY
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-16 p-8 bg-white/2 border-2 border-dashed border-white/5 tech-border text-center">
          <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.5em] italic">__END_OF_CATALOGUE__</p>
        </div>
      </div>
    </div>
  );
};

export default StoreScreen;
