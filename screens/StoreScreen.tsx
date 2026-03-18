
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GEAR_ITEMS, AVATAR_ITEMS, RAID_PASSES, Currency, CURRENCY_RATES, Equipment } from '../types';
import type { LivePrices } from '../hooks/usePrices';

interface StoreScreenProps {
  walletBalance: number;
  usdcBalance: number;
  skrBalance: number;
  raidBalance: number;
  ownedItemIds: string[];
  onPurchase: (itemId: string, price: number, currency: Currency) => boolean | Promise<boolean>;
  currentLevel: number;
  raidTickets?: number;
  onBuyPass?: (passId: string, price: number, currency: Currency) => boolean | Promise<boolean>;
  onForgeGear?: (item1Id: string, item2Id: string) => Promise<string | null>;
  initialTab?: 'GEAR' | 'AVATAR' | 'PASS' | 'FORGE';
  currencyRates?: LivePrices['currencyRates'];
  passDiscountPct?: number;
}

interface PurchasePopup {
  id: number;
  val: number;
  x: number;
  y: number;
}

const CURRENCY_LABELS: Record<Currency, string> = {
  [Currency.SOL]: 'SOL',
  [Currency.USDC]: 'USDC',
  [Currency.SKR]: 'SKR',
  [Currency.RAID]: 'RAID',
};

const StoreScreen: React.FC<StoreScreenProps> = ({ walletBalance, usdcBalance, skrBalance, raidBalance, ownedItemIds, onPurchase, currentLevel, raidTickets = 0, onBuyPass, onForgeGear, initialTab, currencyRates, passDiscountPct = 0 }) => {
  const { t } = useTranslation();
  const rates = currencyRates ?? { [Currency.SOL]: 1, [Currency.USDC]: 0, [Currency.SKR]: 0, [Currency.RAID]: 0 };
  const [activeTab, setActiveTab] = useState<'GEAR' | 'AVATAR' | 'PASS' | 'FORGE'>(initialTab ?? 'GEAR');
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>(Currency.SKR);
  const pricesLoading = selectedCurrency !== Currency.SOL && rates[selectedCurrency] === 0;
  const [popups, setPopups] = useState<PurchasePopup[]>([]);
  const [loadingItemId, setLoadingItemId] = useState<string | null>(null);

  // FORGE state
  const [forgeSelected, setForgeSelected] = useState<string[]>([]);
  const [forgeResult, setForgeResult] = useState<Equipment | null>(null);
  const [forging, setForging] = useState(false);

  const filteredItems = activeTab === 'GEAR' ? GEAR_ITEMS : AVATAR_ITEMS;

  const handleBuy = async (itemId: string, solPrice: number, minLevel: number = 0) => {
    if (currentLevel < minLevel) return;
    if (loadingItemId) return;
    if (pricesLoading) return;

    const finalPrice = solPrice * rates[selectedCurrency];
    const roundedPrice = selectedCurrency === Currency.SOL ? finalPrice : Math.ceil(finalPrice);

    setLoadingItemId(itemId);
    try {
      const success = await onPurchase(itemId, roundedPrice, selectedCurrency);
      if (success) {
        const srReward = Math.max(50, Math.floor(solPrice * 1000));
        const id = Date.now();
        const x = Math.floor(Math.random() * 100) - 50;
        const y = Math.floor(Math.random() * 60) - 30;
        setPopups(prev => [...prev, { id, val: srReward, x, y }]);
        setTimeout(() => setPopups(prev => prev.filter(p => p.id !== id)), 1000);
      } else {
        alert('PURCHASE FAILED\n\nTransaction did not complete. Check your balance and try again.');
      }
    } catch {
      alert('PURCHASE FAILED\n\nAn error occurred. Please try again.');
    } finally {
      setLoadingItemId(null);
    }
  };

  const handleBuyPass = async (passId: string, passUsdPrice: number) => {
    if (!onBuyPass) return;
    if (loadingItemId) return;
    const solUsd = rates[Currency.USDC];
    if (solUsd === 0) return; // prices not loaded yet
    const bountyMult = 1 - passDiscountPct / 100;
    let price: number;
    if (selectedCurrency === Currency.USDC) {
      price = passUsdPrice * bountyMult;
    } else if (selectedCurrency === Currency.SOL) {
      price = (passUsdPrice / solUsd) * bountyMult;
    } else {
      // SKR: 50% off for Seeker holders, then bounty discount on top
      const skrPerUsd = rates[Currency.SKR] / solUsd;
      price = Math.ceil(passUsdPrice * skrPerUsd * 0.5 * bountyMult);
    }
    setLoadingItemId(passId);
    try {
      const success = await onBuyPass(passId, price, selectedCurrency);
      if (success) {
        const id = Date.now();
        setPopups(prev => [...prev, { id, val: 0, x: 0, y: 0 }]);
        setTimeout(() => setPopups(prev => prev.filter(p => p.id !== id)), 1200);
      } else {
        alert('PURCHASE FAILED\n\nTransaction did not complete. Check your balance and try again.');
      }
    } catch {
      alert('PURCHASE FAILED\n\nAn error occurred. Please try again.');
    } finally {
      setLoadingItemId(null);
    }
  };

  const ownedStandardGear = GEAR_ITEMS.filter(g => g.rarity === 'STANDARD' && ownedItemIds.includes(g.id));

  const toggleForgeSelect = (id: string) => {
    setForgeSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 2 ? [...prev, id] : prev,
    );
    setForgeResult(null);
  };

  const handleForge = async () => {
    if (forgeSelected.length !== 2 || !onForgeGear || forging) return;
    setForging(true);
    setForgeResult(null);
    try {
      const resultId = await onForgeGear(forgeSelected[0], forgeSelected[1]);
      if (resultId) {
        const item = GEAR_ITEMS.find(g => g.id === resultId) ?? null;
        setForgeResult(item);
        setForgeSelected([]);
      } else {
        alert('FORGE FAILED\n\nNo available LIMITED gear to mint. You may already own all of them.');
      }
    } catch {
      alert('FORGE FAILED\n\nAn error occurred. Please try again.');
    } finally {
      setForging(false);
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
          text: 'text-orange-400',
          border: 'border-orange-400/30',
          bg: 'bg-orange-400/10',
          button: 'bg-orange-500 text-white',
          shadow: 'hover:shadow-[0_0_20px_rgba(249,115,22,0.2)]'
        };
      default:
        return {
          text: 'text-white',
          border: 'border-white/10',
          bg: 'bg-white/5',
          button: 'bg-[#9945FF] text-white',
          shadow: 'hover:shadow-[0_0_20px_rgba(153,69,255,0.1)]'
        };
    }
  };

  const currentBalance = selectedCurrency === Currency.SOL
    ? walletBalance
    : selectedCurrency === Currency.USDC
      ? usdcBalance
      : selectedCurrency === Currency.SKR
        ? skrBalance
        : raidBalance;
  const currencyColor = selectedCurrency === Currency.SOL
    ? 'text-white'
    : selectedCurrency === Currency.USDC
      ? 'text-blue-400'
      : selectedCurrency === Currency.SKR
        ? 'text-orange-400'
        : 'text-[#00E5FF]';

  return (
    <div className="h-full flex flex-col p-3 sm:p-6 lg:p-12 animate-in slide-in-from-bottom-4 duration-300 overflow-y-auto scrollbar-hide pb-24 relative" style={{ backgroundColor: 'var(--app-bg)' }}>
      
      {/* Popups Overlay */}
      <div className="fixed inset-0 pointer-events-none z-[100] flex items-center justify-center">
        {popups.map(p => (
          <div 
            key={p.id} 
            className="absolute animate-sr-popup pointer-events-none flex flex-col items-center"
            style={{ transform: `translate(${p.x}px, ${p.y}px)` }}
          >
            <span className="text-4xl sm:text-6xl font-black text-yellow-500 drop-shadow-[0_0_15px_rgba(234,179,8,1)] uppercase tracking-tight">
              Item secured
            </span>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-2xl sm:text-4xl font-black text-yellow-500">+{p.val}</span>
              <span className="text-xs font-black text-yellow-500/60 uppercase tracking-wide">$SR</span>
            </div>
          </div>
        ))}
      </div>

      <div className="w-full max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-6 sm:mb-10 gap-3 sm:gap-6">
          <div>
            <h2 className="text-3xl sm:text-5xl lg:text-7xl font-black uppercase tracking-tight text-white leading-none">
              Black <span className="text-[#9945FF]">Market</span>
            </h2>
            <p className="text-[10px] font-bold text-white mt-1 sm:mt-3">Equipment depot</p>
          </div>

          <div className="flex flex-col gap-2 w-full sm:w-72">
            <div className="bg-[var(--modal-bg)]/60 px-3 py-2 sm:p-6 border border-white/10 tech-border w-full">
              <p className="text-[9px] text-white font-bold uppercase tracking-wide mb-0.5">Balance</p>
              <div className="flex items-baseline justify-between gap-2">
                <p className="mono text-lg sm:text-3xl font-black text-white">{selectedCurrency === Currency.SOL ? currentBalance.toFixed(3) : Math.floor(currentBalance).toLocaleString()}</p>
                <span className={`text-xs font-black ${currencyColor}`}>{CURRENCY_LABELS[selectedCurrency]}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1 w-full">
              <p className="col-span-3 text-[9px] font-bold text-white uppercase tracking-wide mb-0.5">Buy with</p>
              {[Currency.SOL, Currency.SKR].map(curr => (
                <button
                  key={curr}
                  onClick={() => setSelectedCurrency(curr)}
                  className={`py-2 text-[10px] font-bold uppercase tracking-wide border tech-border transition-all text-center ${selectedCurrency === curr ? 'bg-white/10 border-white/40 text-white' : 'bg-[var(--modal-bg)] border-white/20 text-white hover:text-white hover:border-white/40'}`}
                >
                  {CURRENCY_LABELS[curr]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-1.5 mb-6 sm:mb-10">
          <button
            onClick={() => setActiveTab('GEAR')}
            className={`flex-1 py-3 sm:py-4 border-2 tech-border font-bold uppercase text-[10px] tracking-wide transition-all ${activeTab === 'GEAR' ? 'border-[#9945FF] text-[#9945FF] bg-[#9945FF]/10' : 'border-white/20 text-white hover:text-white'}`}
          >
            {t('store.gear')}
          </button>
          <button
            onClick={() => setActiveTab('AVATAR')}
            className={`flex-1 py-3 sm:py-4 border-2 tech-border font-bold uppercase text-[10px] tracking-wide transition-all ${activeTab === 'AVATAR' ? 'border-white text-white bg-white/10' : 'border-white/20 text-white hover:text-white'}`}
          >
            {t('store.avatar')}
          </button>
          <button
            onClick={() => setActiveTab('PASS')}
            className={`flex-1 py-3 sm:py-4 border-2 tech-border font-bold uppercase text-[10px] tracking-wide transition-all relative ${activeTab === 'PASS' ? 'border-yellow-500 text-yellow-400 bg-yellow-500/10' : 'border-white/20 text-white hover:text-white'}`}
          >
            {t('store.pass')}
            {raidTickets > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-yellow-500 text-black text-[9px] font-black px-1.5 rounded-full min-w-[18px] text-center">
                {raidTickets}
              </span>
            )}
          </button>
          <button
            onClick={() => { setActiveTab('FORGE'); setForgeSelected([]); setForgeResult(null); }}
            className={`flex-1 py-3 sm:py-4 border-2 tech-border font-bold uppercase text-[10px] tracking-wide transition-all ${activeTab === 'FORGE' ? 'border-orange-500 text-orange-400 bg-orange-500/10' : 'border-white/20 text-white hover:text-white'}`}
          >
            Forge
          </button>
        </div>

        {/* ── PASS TAB ─────────────────────────────────────────────────── */}
        {activeTab === 'PASS' && (
          <div className="mb-10">
            {/* Bounty discount banner */}
            {passDiscountPct > 0 && (
              <div className="mb-4 px-3 py-2.5 flex items-center gap-2.5 rounded-xl"
                style={{ background: 'rgba(255,184,0,0.10)', border: '1px dashed rgba(255,184,0,0.50)' }}>
                <i className="fa-solid fa-ticket text-[#FFB800] text-sm shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-black text-[#FFB800] leading-none">{passDiscountPct}% PASS DISCOUNT ACTIVE</p>
                  <p className="text-[9px] text-white mt-0.5">Earned via Bounty Board · applied to all passes below</p>
                </div>
              </div>
            )}
            {/* Ticket balance banner */}
            <div className="mb-6 p-3 sm:p-4 bg-yellow-500/10 border border-yellow-500/30 tech-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
              <div>
                <p className="text-[9px] font-bold text-yellow-500/60 uppercase tracking-wide">Raid tickets</p>
                <p className="text-2xl sm:text-3xl font-black text-yellow-400 mono leading-none mt-0.5">{raidTickets}<span className="text-xs sm:text-sm text-yellow-500/50 ml-1">tickets</span></p>
              </div>
              <div className="flex gap-4 sm:block sm:text-right">
                <div>
                  <p className="text-[9px] font-bold text-white uppercase tracking-wide hidden sm:block">Per ticket</p>
                  <p className="text-[9px] text-yellow-500/70 font-bold">🎟️ 50% off entry fee</p>
                  <p className="text-[9px] text-yellow-500/70 font-bold">🎟️ +10% win boost</p>
                </div>
                <div className="mt-0 sm:mt-2 flex items-center gap-1">
                  <span className="text-orange-400 text-[10px]">🟠</span>
                  <p className="text-[9px] text-orange-400 font-bold">Pay with SKR = 50% off pass price</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {RAID_PASSES.map(pass => {
                // Passes are USD-denominated — convert via live rates
                // rates[USDC] = solUsd, rates[SKR] = solUsd/skrUsd
                const solUsd = rates[Currency.USDC];
                const passesLoading = solUsd === 0; // need live price for ALL currencies

                const skrDiscount = selectedCurrency === Currency.SKR;
                let finalPrice: number;
                let fullPrice: number | null = null; // pre-discount price for strikethrough
                if (passesLoading) {
                  finalPrice = 0;
                } else if (selectedCurrency === Currency.USDC) {
                  finalPrice = pass.usdPrice;
                } else if (selectedCurrency === Currency.SOL) {
                  finalPrice = pass.usdPrice / solUsd;
                } else {
                  // SKR: usdPrice / skrUsd, then 50% off for Seeker holders
                  const skrPerUsd = rates[Currency.SKR] / solUsd; // SKR per $1
                  fullPrice = pass.usdPrice * skrPerUsd;
                  finalPrice = fullPrice * 0.5;
                }
                // Apply earned bounty discount on top
                if (!passesLoading && passDiscountPct > 0) {
                  if (fullPrice === null) fullPrice = finalPrice;
                  finalPrice = finalPrice * (1 - passDiscountPct / 100);
                }

                const displayPrice = passesLoading ? '---'
                  : selectedCurrency === Currency.SOL ? finalPrice.toFixed(4)
                  : Math.ceil(finalPrice).toLocaleString();
                const displayFull = fullPrice && !passesLoading
                  ? selectedCurrency === Currency.SOL ? fullPrice.toFixed(4) : Math.ceil(fullPrice).toLocaleString()
                  : null;
                const priceValue = passesLoading ? Infinity : (selectedCurrency === Currency.SOL ? finalPrice : Math.ceil(finalPrice));
                const canAfford = !passesLoading && currentBalance >= priceValue;
                const isLoading = passesLoading;
                // tier accent: game palette — red / cyan / orange / gold
                const tierColor = pass.id === 'pass_basic'  ? '#9945FF'
                                : pass.id === 'pass_core'   ? '#22d3ee'
                                : pass.id === 'pass_pro'    ? '#fb923c'
                                : pass.id === 'pass_elite'  ? '#FFB800'
                                : '#eab308';
                const badgeColors = 'border-white/10 bg-white/[0.02]';
                const btnColors = pass.id === 'pass_basic'  ? 'bg-[#9945FF] text-white'
                                : pass.id === 'pass_core'   ? 'bg-cyan-400 text-black'
                                : pass.id === 'pass_pro'    ? 'bg-orange-500 text-black'
                                : pass.id === 'pass_elite'  ? 'bg-[#FFB800] text-black'
                                : 'bg-yellow-400 text-black';

                return (
                  <div
                    key={pass.id}
                    className={`border tech-border p-3 sm:p-5 relative overflow-hidden ${badgeColors}`}
                    style={{ borderLeftColor: tierColor, borderLeftWidth: 3 }}
                  >
                    {/* Mobile: single row layout — Desktop: stacked */}
                    <div className="flex sm:flex-col gap-3 sm:gap-0">
                      {/* Left / top: identity */}
                      <div className="flex items-center gap-3 sm:justify-between sm:mb-3 shrink-0">
                        {/* Tier badge */}
                        <div
                          className="w-10 h-10 shrink-0 border-2 flex items-center justify-center"
                          style={{ borderColor: tierColor, boxShadow: `0 0 12px ${tierColor}30` }}
                        >
                          <span className="text-sm font-black mono" style={{ color: tierColor }}>{pass.badge}</span>
                        </div>
                        <div>
                          <p className="text-sm font-black uppercase text-white leading-none">{pass.name}</p>
                          <p className="text-xs font-bold text-white mt-0.5"><span className="text-white font-black">{pass.tickets}</span> tickets · <span className="text-white">${pass.usdPrice}</span></p>
                        </div>
                      </div>

                      {/* Right / bottom: perks + price + button */}
                      <div className="flex-1 flex flex-col sm:mt-2 gap-2 min-w-0">
                        <div className="flex gap-1.5 flex-wrap">
                          <span className="text-[10px] font-bold text-yellow-500 bg-yellow-500/10 px-1.5 py-0.5 border border-yellow-500/20 whitespace-nowrap">50% off entry</span>
                          <span className="text-[10px] font-bold text-yellow-500 bg-yellow-500/10 px-1.5 py-0.5 border border-yellow-500/20 whitespace-nowrap">+10% win</span>
                          {skrDiscount && (
                            <span className="text-[10px] font-bold text-orange-400 bg-orange-500/10 px-1.5 py-0.5 border border-orange-400/30 whitespace-nowrap animate-pulse">SKR −50%</span>
                          )}
                          {passDiscountPct > 0 && (
                            <span className="text-[10px] font-bold text-[#FFB800] bg-[#FFB800]/10 px-1.5 py-0.5 border border-[#FFB800]/30 whitespace-nowrap animate-pulse">COUPON −{passDiscountPct}%</span>
                          )}
                        </div>
                        <div className="flex flex-col gap-1.5 pt-2 border-t border-white/5">
                          <div>
                            {displayFull && (
                              <p className="text-xs font-black text-white mono line-through leading-none">
                                {displayFull} <span className="text-[9px]">{CURRENCY_LABELS[selectedCurrency]}</span>
                              </p>
                            )}
                            <p className={`text-base font-black mono leading-none ${isLoading ? 'text-white animate-pulse' : skrDiscount ? 'text-orange-400' : 'text-white'}`}>
                              {displayPrice} <span className={`text-xs ${skrDiscount ? 'text-orange-400' : currencyColor}`}>{CURRENCY_LABELS[selectedCurrency]}</span>
                            </p>
                          </div>
                          <button
                            onClick={() => handleBuyPass(pass.id, pass.usdPrice)}
                            disabled={!canAfford || !onBuyPass || loadingItemId !== null}
                            className={`w-full py-2 font-bold uppercase tracking-wide text-[10px] tech-border transition-all flex items-center justify-center gap-1 ${
                              !canAfford || !onBuyPass || (loadingItemId !== null && loadingItemId !== pass.id)
                                ? 'bg-white/5 text-white border-white/5 cursor-not-allowed'
                                : loadingItemId === pass.id
                                ? 'bg-white/10 text-white border-white/10 cursor-wait'
                                : `${btnColors} hover:opacity-90 active:translate-y-0.5`
                            }`}
                          >
                            {loadingItemId === pass.id ? (
                              <>
                                <svg className="animate-spin w-2.5 h-2.5 shrink-0" viewBox="0 0 24 24" fill="none">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                                </svg>
                                Buying…
                              </>
                            ) : 'Get pass'}
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

        {/* ── FORGE TAB ──────────────────────────────────────────────── */}
        {activeTab === 'FORGE' && (
          <div className="mb-10 space-y-6">
            {/* Header */}
            <div className="p-4 sm:p-6 bg-orange-500/5 border border-orange-500/20 tech-border">
              <h3 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-orange-400">Gear Forge</h3>
              <p className="text-[10px] font-bold text-white mt-1">
                Salvage 2 standard gear → receive 1 random limited gear. Both items are destroyed.
              </p>
            </div>

            {/* Selection grid */}
            {ownedStandardGear.length < 2 ? (
              <div className="p-8 border-2 border-dashed border-white/10 tech-border text-center">
                <p className="text-white font-bold text-sm">Not enough gear</p>
                <p className="text-white text-xs font-bold mt-2">You need at least 2 standard gear items to forge.</p>
              </div>
            ) : (
              <>
                <p className="text-[10px] font-bold text-orange-400/60 uppercase tracking-wide">
                  Select 2 items to destroy ({forgeSelected.length}/2)
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {ownedStandardGear.map(gear => {
                    const isSelected = forgeSelected.includes(gear.id);
                    return (
                      <button
                        key={gear.id}
                        onClick={() => toggleForgeSelect(gear.id)}
                        disabled={forging}
                        className={`relative border-2 p-3 tech-border transition-all flex flex-col items-center gap-2 text-center ${
                          isSelected
                            ? 'border-orange-500 bg-orange-500/10 shadow-[0_0_15px_rgba(249,115,22,0.2)]'
                            : forgeSelected.length >= 2
                            ? 'border-white/5 opacity-40 cursor-not-allowed'
                            : 'border-white/10 hover:border-orange-500/40 hover:bg-orange-500/5'
                        }`}
                      >
                        {isSelected && (
                          <div className="absolute top-1 right-1 w-4 h-4 bg-orange-500 rounded-full flex items-center justify-center">
                            <span className="text-black text-[8px] font-black">✓</span>
                          </div>
                        )}
                        <span className="text-3xl leading-none">{gear.image}</span>
                        <span className="text-[9px] font-bold uppercase tracking-wide text-white leading-tight">{gear.name}</span>
                        <span className="text-[8px] text-white font-bold">{gear.effect?.replace('_', ' ')}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Forge action area */}
                <div className="border-2 border-orange-500/20 bg-orange-500/5 tech-border p-5 sm:p-8 flex flex-col sm:flex-row items-center gap-6">
                  {/* Input side */}
                  <div className="flex items-center gap-3 shrink-0">
                    {forgeSelected.map((id, i) => {
                      const g = GEAR_ITEMS.find(x => x.id === id);
                      return (
                        <React.Fragment key={id}>
                          <div className="w-14 h-14 border border-orange-500/40 bg-[var(--modal-bg)] flex items-center justify-center">
                            <span className="text-3xl">{g?.image ?? '?'}</span>
                          </div>
                          {i === 0 && <span className="text-orange-500 font-black text-xl">+</span>}
                        </React.Fragment>
                      );
                    })}
                    {forgeSelected.length < 2 && (
                      [...Array(2 - forgeSelected.length)].map((_, i) => (
                        <React.Fragment key={i}>
                          {forgeSelected.length + i > 0 && <span className="text-white font-black text-xl">+</span>}
                          <div className="w-14 h-14 border-2 border-dashed border-white/15 bg-[var(--modal-bg)]/50 flex items-center justify-center">
                            <span className="text-white text-xs font-black">?</span>
                          </div>
                        </React.Fragment>
                      ))
                    )}
                  </div>

                  <div className="text-orange-400 font-black text-2xl hidden sm:block">→</div>

                  {/* Output side */}
                  <div className="flex flex-col items-center gap-2">
                    {forgeResult ? (
                      <div className="flex flex-col items-center gap-1 animate-in zoom-in-75 duration-500">
                        <div className="w-16 h-16 border-2 border-orange-400 bg-orange-400/10 flex items-center justify-center shadow-[0_0_20px_rgba(249,115,22,0.4)]">
                          <span className="text-4xl">{forgeResult.image}</span>
                        </div>
                        <span className="text-orange-400 font-black uppercase text-xs tracking-wide">{forgeResult.name}</span>
                        <span className="text-[8px] text-orange-400/60 font-bold">Limited · forged</span>
                      </div>
                    ) : (
                      <div className="w-16 h-16 border-2 border-dashed border-orange-400/30 bg-orange-400/5 flex items-center justify-center">
                        <span className="text-orange-400/40 text-2xl font-black">?</span>
                      </div>
                    )}
                    <span className="text-[8px] text-white font-bold">Random limited</span>
                  </div>

                  {/* Forge button */}
                  <button
                    onClick={handleForge}
                    disabled={forgeSelected.length !== 2 || !onForgeGear || forging}
                    className={`ml-auto shrink-0 px-6 py-4 font-black uppercase tracking-tight tech-border transition-all text-sm flex items-center gap-2 ${
                      forgeSelected.length !== 2 || !onForgeGear
                        ? 'bg-white/5 text-white border-white/5 cursor-not-allowed'
                        : forging
                        ? 'bg-orange-500/20 text-orange-400/50 border-orange-500/20 cursor-wait'
                        : 'bg-orange-500 text-black hover:bg-orange-400 active:scale-95 shadow-[0_0_20px_rgba(249,115,22,0.3)]'
                    }`}
                  >
                    {forging ? (
                      <>
                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                        </svg>
                        Forging…
                      </>
                    ) : 'Forge'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── GEAR / AVATAR GRIDS ──────────────────────────────────────── */}
        {activeTab !== 'PASS' && activeTab !== 'FORGE' && <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredItems.map(item => {
            const isOwned = ownedItemIds.includes(item.id);
            const levelLocked = currentLevel < (item.minLevel || 0);
            
            // Calculate price in selected currency
            const rawPrice = item.price * rates[selectedCurrency];
            const displayPrice = pricesLoading ? '---'
              : selectedCurrency === Currency.SOL ? rawPrice.toFixed(2)
              : Math.ceil(rawPrice).toLocaleString();
            const priceValue = pricesLoading ? Infinity : (selectedCurrency === Currency.SOL ? rawPrice : Math.ceil(rawPrice));

            const canAfford = !pricesLoading && currentBalance >= priceValue;
            const srReward = Math.max(50, Math.floor(item.price * 1000));
            const rarityStyle = getRarityStyles(item.rarity);

            return (
              <div 
                key={item.id} 
                className={`bg-[var(--modal-bg)] border-2 p-6 tech-border group transition-all flex flex-col 
                  ${isOwned ? 'border-amber-500/20 bg-amber-950/5' : levelLocked ? 'border-[#9945FF]/20 opacity-60 grayscale' : `border-white/5 ${rarityStyle.shadow}`}`}
              >
                <div className="flex gap-5 mb-5">
                  <div className={`relative w-24 h-24 md:w-28 md:h-28 bg-[var(--modal-bg)] border ${isOwned ? 'border-amber-500/50' : rarityStyle.border} flex items-center justify-center shrink-0 overflow-hidden`}>
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
                            <span className="text-[10px] font-bold text-white text-center">?</span>
                        </div>
                        )}
                        
                        {/* OWNED STAMP */}
                        {isOwned && (
                            <div className="absolute inset-0 bg-[var(--modal-bg)]/60 flex items-center justify-center backdrop-blur-[1px]">
                                <span className="text-amber-400 font-black uppercase -rotate-12 border-4 border-amber-400 px-1 py-0.5 text-xs sm:text-sm tracking-widest opacity-90 shadow-[0_0_15px_rgba(255,184,0,0.4)]">
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
                      <h4 className={`font-black uppercase tracking-tight text-base leading-tight ${isOwned ? 'text-amber-400' : 'text-white'}`}>
                        {item.name}
                      </h4>
                    </div>
                    <div className="mt-2 space-y-1.5">
                      {levelLocked ? (
                        <span className="block text-[10px] font-bold text-[#9945FF] animate-pulse">Locked · Lv.{item.minLevel}</span>
                      ) : (
                        <>
                          {item.effect && (
                            <span className="block text-[10px] font-bold text-[#FFB800]">{item.effect.replace('_', ' ')}</span>
                          )}
                          <span className="block text-[10px] font-bold text-yellow-500">+{srReward} $SR</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <p className="text-xs text-white font-medium leading-tight mb-8 flex-1">{item.description}</p>
                
                <div className="flex justify-between items-end mt-auto pt-5 border-t border-white/5">
                  <div className="mono flex flex-col">
                     <span className="text-[9px] font-bold text-white uppercase tracking-wide mb-1">Cost</span>
                     <span className={`text-base font-black ${isOwned ? 'text-white line-through' : 'text-white'}`}>
                        {displayPrice} <span className={`text-xs ${isOwned ? 'text-white' : currencyColor}`}>{CURRENCY_LABELS[selectedCurrency]}</span>
                     </span>
                  </div>
                  
                  {isOwned ? (
                    <div className="px-8 py-3 font-bold uppercase tracking-wide text-xs tech-border bg-amber-500/10 text-amber-400 border-amber-500/30 text-center cursor-default">
                      Owned
                    </div>
                  ) : levelLocked ? (
                    <div className="px-8 py-3 font-bold uppercase tracking-wide text-xs tech-border bg-[#9945FF]/10 text-[#9945FF]/40 border-[#9945FF]/10 text-center cursor-default">
                      Locked
                    </div>
                  ) : (
                    <button
                      onClick={() => handleBuy(item.id, item.price, item.minLevel)}
                      disabled={!canAfford || loadingItemId !== null}
                      className={`px-8 py-3 font-bold uppercase tracking-wide text-xs tech-border transition-all min-w-[90px] flex items-center justify-center gap-1.5
                        ${!canAfford || (loadingItemId !== null && loadingItemId !== item.id)
                          ? 'bg-white/5 text-white border-white/5 cursor-not-allowed'
                          : loadingItemId === item.id
                          ? 'bg-white/10 text-white border-white/10 cursor-wait'
                          : `${rarityStyle.button} hover:opacity-90 active:translate-y-0.5 shadow-lg`}`}
                    >
                      {loadingItemId === item.id ? (
                        <>
                          <svg className="animate-spin w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                          </svg>
                          Buying…
                        </>
                      ) : 'Buy'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>}

        <div className="mt-16 p-8 bg-white/2 border-2 border-dashed border-white/5 tech-border text-center">
          <p className="text-xs font-bold text-white">End of catalogue</p>
        </div>
      </div>
    </div>
  );
};

export default StoreScreen;
