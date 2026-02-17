
import React, { useMemo, useState } from 'react';
import { AVATAR_ITEMS, GEAR_ITEMS, RANKS, Equipment } from '../types';

interface ProfileScreenProps {
  balance: number;
  unclaimedBalance: number;
  srPoints: number;
  onClaim: () => void;
  ownedItemIds: string[];
  equippedAvatarId?: string;
  equippedGearIds: string[];
  onEquipAvatar: (avatarId: string) => void;
  onToggleGear: (gearId: string) => void;
}

const ProfileScreen: React.FC<ProfileScreenProps> = ({ 
  balance, 
  unclaimedBalance, 
  srPoints,
  onClaim, 
  ownedItemIds,
  equippedAvatarId,
  equippedGearIds,
  onEquipAvatar,
  onToggleGear
}) => {
  const [copied, setCopied] = useState(false);
  const referralCode = "NODE_RAID_X42";
  const referralLink = `https://raid.sol/ref/${referralCode}`;

  const history = [
    { date: '2025-05-12', result: 'EXTRACTED', amount: '+0.124 SOL', risk: '82%', sr: '+142' },
    { date: '2025-05-12', result: 'BUSTED', amount: '-0.026 SOL', risk: '100%', sr: '+35' },
    { date: '2025-05-11', result: 'EXTRACTED', amount: '+0.045 SOL', risk: '44%', sr: '+88' },
  ];

  const currentRank = useMemo(() => {
    let best = RANKS[0];
    for (const r of RANKS) {
      if (srPoints >= r.minSR) {
        best = r;
      } else {
        break;
      }
    }
    return best;
  }, [srPoints]);

  const nextRank = useMemo(() => {
    return RANKS.find(r => r.minSR > srPoints) || null;
  }, [srPoints]);

  const progress = useMemo(() => {
    if (!nextRank) return 100;
    const currentMin = currentRank.minSR;
    const nextMin = nextRank.minSR;
    return ((srPoints - currentMin) / (nextMin - currentMin)) * 100;
  }, [srPoints, currentRank, nextRank]);

  const equippedAvatar = AVATAR_ITEMS.find(a => a.id === equippedAvatarId);

  // Calculate combined stats from equipped gear
  const gearStats = useMemo(() => {
    let mult = 0;
    let riskReduc = 0;
    let timeBoost = 0;

    equippedGearIds.forEach(id => {
      const item = GEAR_ITEMS.find(g => g.id === id);
      if (item) {
        if (item.effect === 'MULT_BOOST') mult += item.benefitValue || 0;
        if (item.effect === 'RISK_REDUCTION') riskReduc += item.benefitValue || 0;
        if (item.effect === 'TIME_BOOST') timeBoost += item.benefitValue || 0;
      }
    });

    return { mult, riskReduc, timeBoost };
  }, [equippedGearIds]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleItemClick = (item: Equipment) => {
    if (item.type === 'AVATAR') {
      onEquipAvatar(item.id);
    } else {
      onToggleGear(item.id);
    }
  };

  return (
    <div className="h-full flex flex-col p-4 sm:p-6 lg:p-12 animate-in slide-in-from-right duration-300 overflow-y-auto scrollbar-hide pb-28 md:pb-12">
      <div className="w-full max-w-7xl mx-auto space-y-8 lg:space-y-12">
        
        {/* Header Profile Section */}
        <div className="flex flex-col md:flex-row items-center md:items-start gap-6 lg:gap-10">
          {/* Avatar Container */}
          <div className="shrink-0">
            <div 
              className="w-32 h-32 sm:w-40 sm:h-40 lg:w-48 lg:h-48 bg-black border-4 tech-border flex items-center justify-center relative overflow-hidden transition-all duration-500" 
              style={{ borderColor: currentRank.color, boxShadow: `0 0 30px ${currentRank.color}20` }}
            >
              {equippedAvatar?.image ? (
                <img 
                  src={equippedAvatar.image} 
                  alt={equippedAvatar.name} 
                  className="w-full h-full object-cover grayscale brightness-75 hover:grayscale-0 transition-all duration-700"
                />
              ) : (
                <div className="text-3xl font-black text-white/10 italic">NULL</div>
              )}
              <div className="absolute bottom-0 left-0 w-full h-1 bg-cyan-500 shadow-[0_0_15px_#06b6d4]"></div>
            </div>
          </div>

          {/* User Info & Progress */}
          <div className="flex-1 w-full text-center md:text-left space-y-4">
            <div className="flex flex-col md:flex-row items-center md:items-end gap-2 md:gap-4">
              <h2 className="text-3xl sm:text-4xl lg:text-6xl font-black uppercase italic tracking-tighter text-white leading-none">
                {equippedAvatar ? equippedAvatar.name.replace(' ', '_').toUpperCase() : 'USER_42'}
              </h2>
              <div className="px-3 py-1 bg-white/5 border border-white/10 tech-border mb-0.5">
                <span className="text-[10px] sm:text-xs font-black italic uppercase" style={{ color: currentRank.color }}>L.{currentRank.level}</span>
              </div>
            </div>
            
            <p className="text-[10px] sm:text-xs font-black uppercase tracking-[0.3em] italic leading-tight" style={{ color: currentRank.color }}>
              {currentRank.title} // PROTOCOL_ACCESS_GRANTED
            </p>

            {/* Progress Bar Container */}
            <div className="w-full max-w-lg mx-auto md:mx-0 pt-2">
              <div className="flex justify-between items-end mb-1.5">
                <span className="text-[8px] font-black text-white/30 uppercase tracking-[0.2em]">RANK_PROGRESS</span>
                <span className="mono text-[9px] sm:text-[10px] text-white/60 font-black italic">
                  {Math.floor(progress)}% TO {nextRank?.title || 'MAX_CAP'}
                </span>
              </div>
              <div className="h-2.5 w-full bg-white/5 tech-border overflow-hidden">
                 <div 
                   className="h-full transition-all duration-1000 ease-out" 
                   style={{ width: `${progress}%`, backgroundColor: currentRank.color, boxShadow: `0 0 10px ${currentRank.color}` }}
                 />
              </div>
            </div>

            {/* Perks Listing */}
            <div className="flex flex-wrap justify-center md:justify-start gap-2 pt-2">
              {currentRank.perks.map((perk, i) => (
                <div key={i} className="px-2 py-1 bg-white/2 border border-white/5 flex items-center gap-1.5">
                  <div className="w-1 h-1 bg-[#14F195] shrink-0" />
                  <span className="text-[7px] sm:text-[8px] font-black text-white/50 uppercase italic tracking-tighter">{perk}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Combined Gear Stats Section */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-[#050505] border-2 border-white/5 p-4 tech-border">
            <p className="text-[8px] text-white/20 font-black uppercase tracking-widest mb-1 italic">EXTRACTION_BOOST</p>
            <p className="text-xl font-black mono text-purple-400">+{gearStats.mult.toFixed(2)}x</p>
          </div>
          <div className="bg-[#050505] border-2 border-white/5 p-4 tech-border">
            <p className="text-[8px] text-white/20 font-black uppercase tracking-widest mb-1 italic">RISK_SHIELDING</p>
            <p className="text-xl font-black mono text-[#14F195]">-{gearStats.riskReduc}%</p>
          </div>
          <div className="bg-[#050505] border-2 border-white/5 p-4 tech-border">
            <p className="text-[8px] text-white/20 font-black uppercase tracking-widest mb-1 italic">CORE_STABILITY</p>
            <p className="text-xl font-black mono text-cyan-400">+{gearStats.timeBoost}s</p>
          </div>
        </div>

        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10">
          
          {/* Left Column: Wealth, Inventory & Referral */}
          <div className="lg:col-span-7 space-y-6 lg:space-y-10">
            
            {/* Unclaimed Balance Card */}
            <div className="bg-[#050505] border-2 border-green-500/20 p-5 sm:p-8 tech-border relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-5 mono text-xl sm:text-3xl font-black italic uppercase pointer-events-none group-hover:opacity-10 transition-opacity">
                [STORAGE]
              </div>
              <div className="relative z-10">
                <p className="text-[9px] text-green-500/50 font-black uppercase tracking-[0.3em] mb-4">UNCLAIMED_HARVEST</p>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                  <div className="flex items-baseline gap-2">
                    <p className="mono text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tighter leading-none">
                      {unclaimedBalance.toFixed(4)}
                    </p>
                    <span className="text-xs sm:text-lg text-green-500 font-black italic">SOL</span>
                  </div>
                  <button 
                    onClick={onClaim}
                    disabled={unclaimedBalance <= 0}
                    className={`w-full sm:w-auto px-8 py-4 font-black uppercase tracking-tighter text-xs sm:text-sm tech-border transition-all ${unclaimedBalance > 0 ? 'bg-green-500 text-black hover:bg-green-400 active:translate-y-1' : 'bg-white/5 text-white/10 border-white/5 cursor-not-allowed opacity-50'}`}
                  >
                    WITHDRAW_ASSETS
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-black border-2 border-white/5 p-5 tech-border hover:border-yellow-500/20 transition-all">
                <p className="text-[8px] text-white/20 font-black uppercase tracking-[0.2em] mb-1">REPUTATION_PTS</p>
                <div className="flex items-baseline gap-1.5">
                  <p className="text-xl sm:text-2xl font-black mono text-yellow-500">{srPoints.toLocaleString()}</p>
                  <span className="text-[10px] font-black text-yellow-500/40 italic">$SR</span>
                </div>
              </div>
              <div className="bg-black border-2 border-white/5 p-5 tech-border hover:border-purple-500/20 transition-all">
                <p className="text-[8px] text-white/20 font-black uppercase tracking-[0.2em] mb-1">DRIVE_CAPACITY</p>
                <div className="flex items-baseline gap-1.5">
                  <p className="text-xl sm:text-2xl font-black mono text-white">{ownedItemIds.length}</p>
                  <span className="text-[10px] font-black text-purple-400/60 italic">/ 24 UNITS</span>
                </div>
              </div>
            </div>

            {/* Referral Protocol Card */}
            <div className="bg-[#050505] border-2 border-cyan-500/20 p-5 sm:p-8 tech-border relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-5 mono text-xl sm:text-3xl font-black italic uppercase pointer-events-none group-hover:opacity-10 transition-opacity">
                [LINK]
              </div>
              <div className="relative z-10">
                <p className="text-[9px] text-cyan-500/50 font-black uppercase tracking-[0.3em] mb-4">REFERRAL_PROTOCOL</p>
                <div className="flex flex-col space-y-6">
                  <div className="bg-black border border-white/10 p-4 tech-border flex flex-col sm:flex-row items-center justify-between gap-4">
                    <span className="mono text-xs sm:text-sm text-white/60 truncate w-full sm:w-auto text-center sm:text-left">
                      {referralLink}
                    </span>
                    <button 
                      onClick={handleCopyLink}
                      className={`w-full sm:w-auto px-6 py-2 font-black uppercase tracking-tighter text-[10px] tech-border transition-all whitespace-nowrap ${copied ? 'bg-cyan-500 text-black border-cyan-500' : 'bg-white/5 text-cyan-500 border-cyan-500/30 hover:bg-cyan-500/10'}`}
                    >
                      {copied ? 'LINK_COPIED' : 'COPY_LINK'}
                    </button>
                  </div>
                  <div className="flex items-center gap-3 bg-cyan-950/20 border-l-2 border-cyan-500 p-3">
                    <div className="w-1.5 h-1.5 bg-cyan-500 animate-pulse shrink-0" />
                    <p className="text-[10px] font-black text-white/40 uppercase tracking-widest leading-relaxed italic">
                      EARN <span className="text-yellow-500">250 $SR</span> PER VERIFIED EXTRACTION BY RECRUITED NODES.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Inventory Grid */}
            <div className="bg-black/40 border-2 border-white/5 p-5 sm:p-8 tech-border">
               <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6 sm:mb-8">
                 <h3 className="text-[9px] font-black uppercase tracking-[0.3em] text-white/40 italic leading-none">__INVENTORY_DRIVES</h3>
                 <span className="text-[7px] font-black text-cyan-500/50 uppercase tracking-widest hidden sm:block">SELECT_CORE_TO_EQUIP</span>
               </div>
              
              <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-6 gap-3 sm:gap-4">
                {ownedItemIds.map(id => {
                  const item = [...AVATAR_ITEMS, ...GEAR_ITEMS].find(i => i.id === id);
                  if (!item) return null;
                  const isAvatar = item.type === 'AVATAR';
                  const isEquipped = isAvatar ? equippedAvatarId === id : equippedGearIds.includes(id);
                  const equipColor = isAvatar ? 'border-cyan-500' : 'border-[#9945FF]';

                  return (
                    <button 
                      key={id} 
                      onClick={() => handleItemClick(item)}
                      className={`aspect-square bg-black border-2 tech-border flex items-center justify-center relative transition-all group overflow-hidden ${isEquipped ? equipColor : 'border-white/5 hover:border-white/20'}`}
                    >
                      {item.image ? (
                        <img 
                          src={item.image} 
                          alt={item.name} 
                          className={`w-full h-full object-cover grayscale brightness-50 transition-all duration-300 ${isEquipped ? 'grayscale-0 brightness-100' : 'group-hover:brightness-90 group-hover:grayscale-0'}`} 
                          style={{ imageRendering: 'pixelated' }}
                        />
                      ) : (
                        <span className="text-[8px] font-black text-white/20">{item.type === 'GEAR' ? 'GR' : 'AV'}</span>
                      )}
                      
                      {!isEquipped && (
                        <div className={`absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity ${isAvatar ? 'bg-cyan-500/10' : 'bg-purple-500/10'}`}>
                          <span className={`text-[6px] font-black px-1 uppercase tracking-tighter ${isAvatar ? 'bg-cyan-500 text-black' : 'bg-purple-500 text-white'}`}>
                            {isAvatar ? 'EQUIP' : 'ACTIVATE'}
                          </span>
                        </div>
                      )}

                      {isEquipped && (
                        <>
                          <div className={`absolute top-0 right-0 w-1.5 h-1.5 ${isAvatar ? 'bg-cyan-500' : 'bg-purple-500'}`} />
                          <div className={`absolute bottom-0 left-0 w-full h-0.5 opacity-80 ${isAvatar ? 'bg-cyan-500' : 'bg-purple-500'}`} />
                        </>
                      )}
                    </button>
                  );
                })}
                {/* Empty Slots Filler */}
                {[...Array(Math.max(0, 12 - ownedItemIds.length))].map((_, i) => (
                  <div key={i} className="aspect-square bg-white/[0.02] border-2 border-dashed border-white/5 tech-border opacity-20" />
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Mission Logs */}
          <div className="lg:col-span-5 space-y-6">
            <div className="flex items-center gap-3 px-2">
              <div className="w-1.5 h-1.5 bg-white/20" />
              <h3 className="text-[9px] font-black uppercase tracking-[0.3em] text-white/30 italic">__MISSION_LOGS</h3>
            </div>
            
            <div className="space-y-3">
              {history.map((h, i) => (
                <div 
                  key={i} 
                  className="bg-black border-2 border-white/5 p-4 sm:p-5 tech-border flex items-center justify-between group hover:bg-white/2 transition-colors"
                >
                  <div className="flex flex-col gap-1">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${h.result === 'BUSTED' ? 'text-red-500' : 'text-green-500'}`}>
                      {h.result}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[7px] mono text-white/20 font-black uppercase tracking-tighter italic">{h.date}</span>
                      <span className="text-[7px] text-white/10">|</span>
                      <span className="text-[7px] mono text-white/20 font-black uppercase tracking-tighter">RISK_{h.risk}</span>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end">
                    <p className={`mono text-xs sm:text-sm font-black ${h.result === 'BUSTED' ? 'text-red-500/50' : 'text-white'}`}>
                      {h.amount}
                    </p>
                    <p className="text-[8px] text-yellow-500 font-black uppercase tracking-widest italic opacity-70">
                      {h.sr} $SR
                    </p>
                  </div>
                </div>
              ))}
              
              <button className="w-full py-3 border border-dashed border-white/5 text-[8px] font-black uppercase text-white/10 hover:text-white/30 hover:border-white/20 transition-all tracking-[0.4em]">
                VIEW_ALL_LOGS_ON_CHAIN
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileScreen;
