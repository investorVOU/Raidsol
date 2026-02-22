
import React, { useState } from 'react';
import { GEAR_ITEMS, AVATAR_ITEMS, RAID_PASSES, Currency, CURRENCY_RATES } from '../types';

interface StoreScreenProps {
  walletBalance: number;
  usdcBalance: number;
  skrBalance: number;
  ownedItemIds: string[];
  onPurchase: (itemId: string, price: number, currency: Currency) => boolean | Promise<boolean>;
  currentLevel: number;
  raidTickets?: number;
  onBuyPass?: (passId: string, price: number, currency: Currency) => boolean | Promise<boolean>;
  initialTab?: 'GEAR' | 'AVATAR' | 'PASS';
}

interface PurchasePopup {
  id: number;
  val: number;
  x: number;
  y: number;
}

const StoreScreen: React.FC<StoreScreenProps> = ({ walletBalance, usdcBalance, skrBalance, ownedItemIds, onPurchase, currentLevel, raidTickets = 0, onBuyPass, initialTab }) => {
  const [activeTab, setActiveTab] = useState<'GEAR' | 'AVATAR' | 'PASS'>(initialTab ?? 'GEAR');
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>(Currency.SKR);
  const [popups, setPopups] = useState<PurchasePopup[]>([]);

  const filteredItems = activeTab === 'GEAR' ? GEAR_ITEMS : AVATAR_ITEMS;

  const handleBuy = async (itemId: string, solPrice: number, minLevel: number = 0) => {
    if (currentLevel < minLevel) return;

    // Calculate price in selected currency
    const finalPrice = solPrice * CURRENCY_RATES[selectedCurrency];
    const roundedPrice = selectedCurrency === Currency.SOL ? finalPrice : Math.ceil(finalPrice);

    const success = await onPurchase(itemId, roundedPrice, selectedCurrency);
    if (success) {
      const srReward = Math.max(50, Math.floor(solPrice * 1000));
      const id = Date.now();
      const x = Math.floor(Math.random() * 100) - 50;
      const y = Math.floor(Math.random() * 60) - 30;
      setPopups(prev => [...prev, { id, val: srReward, x, y }]);
      setTimeout(() => {
        setPopups(prev => prev.filter(p => p.id !== id));
      }, 1000);
    }
  };

  const handleBuyPass = async (passId: string, passSkrPrice: number, passSolPrice: number, passUsdcPrice: number) => {
    if (!onBuyPass) return;
    const price = selectedCurrency === Currency.SKR ? passSkrPrice
                : selectedCurrency === Currency.SOL ? passSolPrice
                : passUsdcPrice;
    const success = await onBuyPass(passId, price, selectedCurrency);
    if (success) {
      const id = Date.now();
      setPopups(prev => [...prev, { id, val: 0, x: 0, y: 0 }]);
      setTimeout(() => setPopups(prev => prev.filter(p => p.id !== id)), 1200);
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

  const currentBalance = selectedCurrency === Currency.SOL ? walletBalance : selectedCurrency === Currency.USDC ? usdcBalance : skrBalance;
  const currencyColor = selectedCurrency === Currency.SOL ? 'text-[#14F195]' : selectedCurrency === Currency.USDC ? 'text-blue-400' : 'text-orange-400';

  return (
    <div className="h-full flex flex-col p-3 sm:p-6 lg:p-12 animate-in slide-in-from-bottom-4 duration-300 overflow-y-auto scrollbar-hide pb-24 relative">
      
      {/* Popups Overlay */}
      <div className="fixed inset-0 pointer-events-none z-[100] flex items-center justify-center">
        {popups.map(p => (
          <div 
            key={p.id} 
            className="absolute animate-sr-popup pointer-events-none flex flex-col items-center"
            style={{ transform: `translate(${p.x}px, ${p.y}px)` }}
          >
            <span className="text-4xl sm:text-6xl font-black text-yellow-500 italic drop-shadow-[0_0_15px_rgba(234,179,8,1)] uppercase tracking-tighter">
              ITEM_SECURED
            </span>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-2xl sm:text-4xl font-black text-yellow-500 italic">+{p.val}</span>
              <span className="text-xs font-black text-yellow-500/60 uppercase tracking-[0.2em]">SR_REPUTATION</span>
            </div>
          </div>
        ))}
      </div>

      <div className="w-full max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-6 sm:mb-10 gap-3 sm:gap-6">
          <div>
            <h2 className="text-3xl sm:text-5xl lg:text-7xl font-black italic uppercase tracking-tighter text-white leading-none">
              BLACK_<span className="text-gradient-solana">MARKET</span>
            </h2>
            <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] mt-1 sm:mt-3">UNOFFICIAL_EQUIPMENT_DEPOT</p>
          </div>

          <div className="flex flex-col gap-2 w-full sm:w-72">
            <div className="bg-black/60 px-3 py-2 sm:p-6 border border-white/10 tech-border w-full">
              <p className="text-[9px] text-white/20 font-black uppercase mb-0.5 italic">CREDITS</p>
              <div className="flex items-baseline justify-between gap-2">
                <p className="mono text-lg sm:text-3xl font-black text-white">{selectedCurrency === Currency.SOL ? currentBalance.toFixed(3) : Math.floor(currentBalance).toLocaleString()}</p>
                <span className={`text-xs font-black italic ${currencyColor}`}>{selectedCurrency}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1 w-full">
              <p className="col-span-3 text-[9px] font-black text-white/60 uppercase tracking-widest mb-0.5">BUY WITH</p>
              {[Currency.SOL, Currency.USDC, Currency.SKR].map(curr => (
                <button
                  key={curr}
                  onClick={() => setSelectedCurrency(curr)}
                  className={`py-2 text-[10px] font-black uppercase tracking-wider border tech-border transition-all text-center ${selectedCurrency === curr ? 'bg-white/10 border-white/40 text-white' : 'bg-black border-white/5 text-white/20 hover:text-white'}`}
                >
                  {curr}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-1.5 mb-6 sm:mb-10">
          <button
            onClick={() => setActiveTab('GEAR')}
            className={`flex-1 py-3 sm:py-5 lg:py-6 border-2 tech-border font-black uppercase text-[9px] sm:text-xs tracking-[0.15em] sm:tracking-[0.3em] transition-all ${activeTab === 'GEAR' ? 'border-[#14F195] text-[#14F195] bg-[#14F195]/10' : 'border-white/20 text-white/50'}`}
          >
            <span className="hidden sm:inline">[ BATTLE_TOOLS ]</span>
            <span className="sm:hidden">GEAR</span>
          </button>
          <button
            onClick={() => setActiveTab('AVATAR')}
            className={`flex-1 py-3 sm:py-5 lg:py-6 border-2 tech-border font-black uppercase text-[9px] sm:text-xs tracking-[0.15em] sm:tracking-[0.3em] transition-all ${activeTab === 'AVATAR' ? 'border-[#9945FF] text-[#9945FF] bg-[#9945FF]/10' : 'border-white/20 text-white/50'}`}
          >
            <span className="hidden sm:inline">[ IDENTITY_CORES ]</span>
            <span className="sm:hidden">AVATAR</span>
          </button>
          <button
            onClick={() => setActiveTab('PASS')}
            className={`flex-1 py-3 sm:py-5 lg:py-6 border-2 tech-border font-black uppercase text-[9px] sm:text-xs tracking-[0.15em] sm:tracking-[0.3em] transition-all relative ${activeTab === 'PASS' ? 'border-yellow-500 text-yellow-400 bg-yellow-500/10' : 'border-white/20 text-white/50'}`}
          >
            <span className="hidden sm:inline">[ RAID_PASS ]</span>
            <span className="sm:hidden">PASS</span>
            {raidTickets > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-yellow-500 text-black text-[9px] font-black px-1.5 rounded-full min-w-[18px] text-center">
                {raidTickets}
              </span>
            )}
          </button>
        </div>

        {/* ── PASS TAB ─────────────────────────────────────────────────── */}
        {activeTab === 'PASS' && (
          <div className="mb-10">
            {/* Ticket balance banner */}
            <div className="mb-6 p-3 sm:p-4 bg-yellow-500/10 border border-yellow-500/30 tech-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
              <div>
                <p className="text-[9px] font-black text-yellow-500/60 uppercase tracking-widest">RAID_TICKETS_BALANCE</p>
                <p className="text-2xl sm:text-3xl font-black text-yellow-400 mono leading-none mt-0.5">{raidTickets}<span className="text-xs sm:text-sm text-yellow-500/50 ml-1">x TICKETS</span></p>
              </div>
              <div className="flex gap-4 sm:block sm:text-right">
                <div>
                  <p className="text-[9px] font-black text-white/30 uppercase tracking-widest hidden sm:block">PERKS_PER_TICKET</p>
                  <p className="text-[9px] text-yellow-500/70 font-black">🎟️ 50% OFF ENTRY</p>
                  <p className="text-[9px] text-yellow-500/70 font-black">🎟️ +10% WIN BOOST</p>
                </div>
                <div>
                  <p className="text-[9px] text-white/30 font-black mt-0 sm:mt-1">FREE TICKET FOR SEEKER HOLDERS</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:grid sm:grid-cols-3 gap-3">
              {RAID_PASSES.map(pass => {
                const price = selectedCurrency === Currency.SKR ? pass.skrPrice
                            : selectedCurrency === Currency.SOL ? pass.solPrice
                            : pass.usdcPrice;
                const displayPrice = selectedCurrency === Currency.SOL
                  ? price.toFixed(3)
                  : Math.ceil(price).toLocaleString();
                const canAfford = currentBalance >= price;
                const badgeColors = pass.id === 'pass_basic' ? 'border-yellow-500/30 bg-yellow-500/5'
                                  : pass.id === 'pass_core' ? 'border-blue-500/30 bg-blue-500/5'
                                  : 'border-red-500/30 bg-red-500/5';
                const btnColors = pass.id === 'pass_basic' ? 'bg-yellow-500 text-black'
                                : pass.id === 'pass_core' ? 'bg-blue-500 text-white'
                                : 'bg-red-500 text-white';

                return (
                  <div key={pass.id} className={`border-2 tech-border p-3 sm:p-5 ${badgeColors}`}>
                    {/* Mobile: single row layout — Desktop: stacked */}
                    <div className="flex sm:flex-col gap-3 sm:gap-0">
                      {/* Left / top: identity */}
                      <div className="flex items-center gap-2 sm:justify-between sm:mb-2 shrink-0">
                        <span className="text-lg">{pass.badge}</span>
                        <div>
                          <p className="text-xs font-black uppercase text-white leading-none">{pass.name}</p>
                          <p className="text-[9px] font-black text-white/30 uppercase"><span className="text-white font-black">{pass.tickets}</span> TICKETS</p>
                        </div>
                      </div>

                      {/* Right / bottom: perks + price + button */}
                      <div className="flex-1 flex flex-col sm:mt-2 gap-2 min-w-0">
                        <div className="flex gap-1.5 flex-wrap">
                          <span className="text-[8px] font-black text-yellow-500 bg-yellow-500/10 px-1.5 py-0.5 border border-yellow-500/20 whitespace-nowrap">50% OFF</span>
                          <span className="text-[8px] font-black text-yellow-500 bg-yellow-500/10 px-1.5 py-0.5 border border-yellow-500/20 whitespace-nowrap">+10% WIN</span>
                        </div>
                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/5">
                          <p className="text-sm font-black text-white mono leading-none shrink-0">
                            {displayPrice} <span className={`text-[9px] ${currencyColor}`}>{selectedCurrency}</span>
                          </p>
                          <button
                            onClick={() => handleBuyPass(pass.id, pass.skrPrice, pass.solPrice, pass.usdcPrice)}
                            disabled={!canAfford || !onBuyPass}
                            className={`shrink-0 px-3 py-2 font-black uppercase tracking-tighter text-[9px] tech-border transition-all ${
                              !canAfford || !onBuyPass
                                ? 'bg-white/5 text-white/10 border-white/5 cursor-not-allowed'
                                : `${btnColors} hover:opacity-90 active:translate-y-0.5`
                            }`}
                          >
                            GET PASS
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── GEAR / AVATAR GRIDS ──────────────────────────────────────── */}
        {activeTab !== 'PASS' && <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredItems.map(item => {
            const isOwned = ownedItemIds.includes(item.id);
            const levelLocked = currentLevel < (item.minLevel || 0);
            
            // Calculate price in selected currency
            const rawPrice = item.price * CURRENCY_RATES[selectedCurrency];
            const displayPrice = selectedCurrency === Currency.SOL ? rawPrice.toFixed(2) : Math.ceil(rawPrice).toLocaleString();
            const priceValue = selectedCurrency === Currency.SOL ? rawPrice : Math.ceil(rawPrice);
            
            const canAfford = currentBalance >= priceValue;
            const srReward = Math.max(50, Math.floor(item.price * 1000));
            const rarityStyle = getRarityStyles(item.rarity);

            return (
              <div 
                key={item.id} 
                className={`bg-[#050505] border-2 p-6 tech-border group transition-all flex flex-col 
                  ${isOwned ? 'border-green-500/20 bg-green-950/5' : levelLocked ? 'border-red-950/20 opacity-60 grayscale' : `border-white/5 ${rarityStyle.shadow}`}`}
              >
                <div className="flex gap-5 mb-5">
                  <div className={`relative w-24 h-24 md:w-28 md:h-28 bg-black border ${isOwned ? 'border-green-500/50' : rarityStyle.border} flex items-center justify-center shrink-0 overflow-hidden`}>
                    {/* Image with Fallback and Ownership Overlay */}
                    <div className="w-full h-full relative">
                        {item.image && !item.image.startsWith('http') ? (
                        // Emoji icon — render as text (no broken-image risk)
                        <div className="w-full h-full flex items-center justify-center select-none">
                          <span className="text-4xl leading-none">{item.image}</span>
                        </div>
                        ) : item.image ? (
                        // URL-based image (avatars use DiceBear SVGs)
                        <img
                            src={item.image}
                            alt={item.name}
                            className="w-full h-full object-cover transition-all duration-500"
                            style={{ imageRendering: 'pixelated' }}
                            onError={(e) => {
                                e.currentTarget.style.display = 'none';
                            }}
                        />
                        ) : (
                        <div className="w-full h-full flex items-center justify-center bg-white/5">
                            <span className="text-[10px] font-black text-white/20 uppercase tracking-widest text-center">NO_IMG</span>
                        </div>
                        )}
                        
                        {/* OWNED STAMP */}
                        {isOwned && (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-[1px]">
                                <span className="text-green-500 font-black uppercase -rotate-12 border-4 border-green-500 px-1 py-0.5 text-xs sm:text-sm tracking-widest opacity-90 shadow-[0_0_15px_rgba(34,197,94,0.5)]">
                                    OWNED
                                </span>
                            </div>
                        )}
                    </div>
                    
                    {!isOwned && (
                        <div className={`absolute top-0 left-0 px-1.5 py-0.5 ${rarityStyle.bg} border-b border-r ${rarityStyle.border}`}>
                        <span className={`text-[9px] font-black uppercase tracking-tighter ${rarityStyle.text}`}>{item.rarity}</span>
                        </div>
                    )}
                  </div>
                  
                  <div className="flex-1 flex flex-col">
                    <div className="flex justify-between items-start">
                      <h4 className={`font-black uppercase tracking-tight italic text-base leading-tight ${isOwned ? 'text-green-500' : 'text-white'}`}>
                        {item.name}
                      </h4>
                    </div>
                    <div className="mt-2 space-y-1.5">
                      {levelLocked ? (
                        <span className="block text-[10px] font-black text-red-500 uppercase tracking-tighter animate-pulse">LOCKED: LVL_{item.minLevel}</span>
                      ) : (
                        <>
                          {item.effect && (
                            <span className="block text-[10px] font-black text-[#14F195] uppercase tracking-tighter">_ MOD: {item.effect.replace('_', ' ')}</span>
                          )}
                          <span className="block text-[10px] font-black text-yellow-500 uppercase tracking-tighter">_ GAINS: +{srReward} $SR</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <p className="text-xs text-white/30 font-medium leading-tight mb-8 flex-1 italic">{item.description}</p>
                
                <div className="flex justify-between items-end mt-auto pt-5 border-t border-white/5">
                  <div className="mono flex flex-col">
                     <span className="text-[9px] font-black text-white/10 uppercase mb-1">COST</span>
                     <span className={`text-base font-black ${isOwned ? 'text-white/20 line-through' : 'text-white'}`}>
                        {displayPrice} <span className={`text-xs ${isOwned ? 'text-white/20' : currencyColor}`}>{selectedCurrency}</span>
                     </span>
                  </div>
                  
                  {isOwned ? (
                    <div className="px-8 py-3 font-black uppercase tracking-tighter text-xs tech-border bg-green-500/10 text-green-500 border-green-500/30 text-center cursor-default">
                      PURCHASED
                    </div>
                  ) : levelLocked ? (
                    <div className="px-8 py-3 font-black uppercase tracking-tighter text-xs tech-border bg-red-950/20 text-red-500/40 border-red-500/10 text-center cursor-default">
                      LOCKED
                    </div>
                  ) : (
                    <button 
                      onClick={() => handleBuy(item.id, item.price, item.minLevel)}
                      disabled={!canAfford}
                      className={`px-8 py-3 font-black uppercase tracking-tighter text-xs tech-border transition-all 
                        ${!canAfford 
                          ? 'bg-white/5 text-white/10 border-white/5 cursor-not-allowed' 
                          : `${rarityStyle.button} hover:opacity-90 active:translate-y-0.5 shadow-lg`}`}
                    >
                      BUY ITEM
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>}

        <div className="mt-16 p-8 bg-white/2 border-2 border-dashed border-white/5 tech-border text-center">
          <p className="text-xs font-black text-white/20 uppercase tracking-[0.5em] italic">__END_OF_CATALOGUE__</p>
        </div>
      </div>
    </div>
  );
};

export default StoreScreen;
