
import React, { useState, useEffect } from 'react';
import { Mode, ENTRY_FEES, Difficulty, DIFFICULTY_CONFIG, GEAR_ITEMS, RAID_BOOSTS, AVATAR_ITEMS } from '../types';

interface LobbyScreenProps {
  onEnterRaid: (mode: Mode, difficulty?: Difficulty, boosts?: string[]) => void;
  isConnected: boolean;
  onConnect: () => void;
  currentLevel: number;
  equippedGearIds: string[];
  equippedAvatarId?: string;
  ownedItemIds: string[];
  onToggleGear: (gearId: string) => void;
  onEquipAvatar: (avatarId: string) => void;
  onNavigateTreasury: () => void;
}

const LobbyScreen: React.FC<LobbyScreenProps> = ({ 
  onEnterRaid, 
  isConnected, 
  onConnect, 
  currentLevel, 
  equippedGearIds, 
  equippedAvatarId,
  ownedItemIds,
  onToggleGear,
  onNavigateTreasury
}) => {
  const [showModeModal, setShowModeModal] = useState(false);
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>(Difficulty.MEDIUM);
  const [selectedBoosts, setSelectedBoosts] = useState<string[]>([]);
  const [selectedMode, setSelectedMode] = useState<Mode>(Mode.SOLO);
  
  // Fake Live Feed Data
  const [feed, setFeed] = useState<string[]>([]);
  useEffect(() => {
    const actions = ['DEPLOYED', 'EXTRACTED', 'BUSTED', 'ATTACKED'];
    const users = ['Anon_92', 'Sol_God', 'DegenX', 'Whale_00', 'RaidBot', 'Phantom'];
    const amounts = ['0.5 SOL', '1.2 SOL', '100 $SR', 'RISK CRITICAL', '5.0 SOL'];
    
    // Fill initial feed
    setFeed(['System Initialized...', 'Market Open', 'Liquidity: High']);

    const interval = setInterval(() => {
        const action = actions[Math.floor(Math.random() * actions.length)];
        const user = users[Math.floor(Math.random() * users.length)];
        const amount = amounts[Math.floor(Math.random() * amounts.length)];
        const msg = `${user} // ${action} // ${amount}`;
        setFeed(prev => [msg, ...prev].slice(0, 4));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleOpenModal = () => {
    setSelectedBoosts([]); // Reset boosts on new open
    setShowModeModal(true);
  };

  const handleToggleBoost = (boostId: string) => {
    setSelectedBoosts(prev => prev.includes(boostId) 
      ? prev.filter(id => id !== boostId) 
      : [...prev, boostId]
    );
  };

  const handleDeploy = () => {
    setShowModeModal(false);
    onEnterRaid(selectedMode, selectedDifficulty, selectedBoosts);
  };

  const TREASURY_ADDRESS = "7Xw...92z";
  const TREASURY_LINK = "https://solscan.io";

  // Calculate Totals
  const entryFee = ENTRY_FEES[selectedMode];
  const boostCost = selectedBoosts.reduce((sum, id) => {
    const boost = RAID_BOOSTS.find(b => b.id === id);
    return sum + (boost ? boost.cost : 0);
  }, 0);
  const totalCost = entryFee + boostCost;

  // Get Equipment Objects
  const equippedGear = GEAR_ITEMS.filter(g => equippedGearIds.includes(g.id));
  const equippedAvatar = AVATAR_ITEMS.find(a => a.id === equippedAvatarId);
  const ownedGear = GEAR_ITEMS.filter(g => ownedItemIds.includes(g.id));

  return (
    <div className="w-full h-full flex flex-col relative bg-black overflow-hidden animate-in fade-in duration-500">
        
        {/* Background Layer */}
        <div className="absolute inset-0 pointer-events-none select-none">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20" />
            <div className="absolute inset-0 bg-gradient-to-b from-purple-900/10 via-black to-black" />
            <div className="scanline opacity-10" />
        </div>

        {/* 1. TOP SECTION: HERO & LIVE FEED */}
        <div className="shrink-0 p-4 sm:p-6 z-10">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-2">
                <div>
                    <h1 className="text-4xl sm:text-6xl font-black italic tracking-tighter text-white leading-none glitch-text">
                        SOL_RAID
                    </h1>
                    <div className="flex items-center gap-2 mt-1">
                        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-[#14F195] shadow-[0_0_10px_#14F195]' : 'bg-red-500 animate-pulse'}`} />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/50">
                            {isConnected ? 'NET_ONLINE' : 'NET_OFFLINE'} // V5.0.2
                        </span>
                    </div>
                </div>
                
                {/* Live Ticker Box */}
                <div className="w-full sm:w-64 bg-black/50 border border-white/10 p-2 tech-border">
                    <p className="text-[9px] font-black text-white/30 uppercase tracking-widest border-b border-white/5 mb-1 pb-1">LIVE_COMBAT_LOG</p>
                    <div className="space-y-1 h-16 overflow-hidden flex flex-col justify-end">
                        {feed.map((msg, i) => (
                            <p key={i} className={`text-[10px] font-bold mono truncate animate-in slide-in-from-right duration-300 ${msg.includes('BUSTED') ? 'text-red-500' : msg.includes('EXTRACTED') ? 'text-[#14F195]' : 'text-white/60'}`}>
                                {'>'} {msg}
                            </p>
                        ))}
                    </div>
                </div>
            </div>
        </div>

        {/* 2. SCROLLABLE MIDDLE SECTION: GAMEPLAY LOOP & ACTIONS */}
        <div className="flex-1 overflow-y-auto scrollbar-hide relative z-10 px-4 sm:px-6 pb-40">
            
            {/* Gameplay Loop Visualizer */}
            <div className="grid grid-cols-3 gap-2 mb-6 opacity-80">
                <div className="bg-white/5 border border-white/10 p-3 text-center tech-border">
                    <div className="text-xl sm:text-2xl mb-1 grayscale">💰</div>
                    <p className="text-[9px] sm:text-[10px] font-black uppercase text-white tracking-wider">1. STAKE SOL</p>
                </div>
                <div className="bg-white/5 border border-white/10 p-3 text-center tech-border">
                    <div className="text-xl sm:text-2xl mb-1 grayscale">⚔️</div>
                    <p className="text-[9px] sm:text-[10px] font-black uppercase text-white tracking-wider">2. BATTLE RISK</p>
                </div>
                <div className="bg-white/5 border border-white/10 p-3 text-center tech-border">
                    <div className="text-xl sm:text-2xl mb-1 grayscale">🏃</div>
                    <p className="text-[9px] sm:text-[10px] font-black uppercase text-white tracking-wider">3. EXTRACT $$</p>
                </div>
            </div>

            <div className="w-full max-w-lg mx-auto space-y-6">
                 {/* PRIMARY ACTION */}
                 <button 
                   onClick={() => isConnected ? handleOpenModal() : onConnect()}
                   className="w-full group relative bg-[#14F195] p-1 clip-corner transition-all hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_40px_rgba(20,241,149,0.2)]"
                 >
                    <div className="absolute inset-0 bg-white/40 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500 z-20" />
                    <div className="bg-black h-32 flex items-center justify-between px-6 relative z-10 clip-corner-inner group-hover:bg-[#0a0a0a] transition-colors">
                       <div>
                          <p className="text-[#14F195] font-black uppercase tracking-[0.2em] text-xs mb-1 animate-pulse">COMMAND_READY</p>
                          <h2 className="text-5xl font-black italic uppercase text-white leading-none tracking-tighter">ENTER RAID</h2>
                          <p className="text-white/40 font-bold uppercase text-[10px] mt-2">HIGH RISK // HIGH REWARD</p>
                       </div>
                       <div className="w-12 h-12 border-2 border-[#14F195] flex items-center justify-center group-hover:bg-[#14F195] group-hover:text-black transition-all">
                          <span className="text-2xl font-black">GO</span>
                       </div>
                    </div>
                 </button>

                 {/* SECONDARY MODES */}
                 <div className="grid grid-cols-2 gap-4">
                    <button 
                        onClick={() => isConnected ? onEnterRaid(Mode.PVP, Difficulty.MEDIUM, []) : onConnect()}
                        className="p-4 bg-[#9945FF]/10 border-2 border-[#9945FF]/40 tech-border hover:bg-[#9945FF]/20 hover:border-[#9945FF] transition-all text-left group"
                    >
                        <p className="text-[9px] font-black text-[#9945FF] uppercase tracking-widest mb-1">MULTIPLAYER</p>
                        <p className="text-xl font-black italic text-white group-hover:scale-105 transition-transform origin-left">PVP DUEL</p>
                    </button>
                    <button 
                        onClick={() => isConnected ? onEnterRaid(Mode.DRILL, Difficulty.MEDIUM, []) : onConnect()}
                        className="p-4 bg-white/5 border-2 border-white/10 tech-border hover:bg-white/10 hover:border-white/30 transition-all text-left group"
                    >
                        <p className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-1">TRAINING</p>
                        <p className="text-xl font-black italic text-white group-hover:scale-105 transition-transform origin-left">FREE DRILL</p>
                    </button>
                 </div>
            </div>
            
             {!isConnected && (
                <div className="mt-6 text-center">
                     <p className="text-red-500 text-xs font-black uppercase bg-red-950/30 p-2 border border-red-500/30 inline-block animate-pulse">
                        [!] UPLINK REQUIRED FOR DEPLOYMENT
                     </p>
                </div>
             )}
        </div>

        {/* 3. MARQUEE TREASURY BAR (THIN LINE CAROUSEL) */}
        <div 
          onClick={onNavigateTreasury}
          className="shrink-0 z-30 bg-[#080808] border-t border-white/10 py-2 overflow-hidden relative cursor-pointer hover:bg-white/5 transition-colors group md:mb-0 mb-16"
        >
            <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-black to-transparent z-10 pointer-events-none" />
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-black to-transparent z-10 pointer-events-none" />
            
            <div className="flex gap-8 whitespace-nowrap animate-[marquee_20s_linear_infinite] group-hover:[animation-play-state:paused] w-max">
                 {[...Array(3)].map((_, i) => (
                    <React.Fragment key={i}>
                        <div className="flex items-center gap-2">
                             <div className="w-1.5 h-1.5 bg-[#14F195] rounded-full animate-pulse" />
                             <span className="text-[10px] font-black uppercase text-white/50 tracking-widest">TREASURY_LIVE:</span>
                             <span className="text-sm font-black mono text-[#14F195]">12,450 SOL</span>
                        </div>
                        <div className="flex items-center gap-2">
                             <span className="text-[10px] font-black uppercase text-white/50 tracking-widest">24H_PAYOUTS:</span>
                             <span className="text-sm font-black mono text-white">482.5 SOL</span>
                        </div>
                        <div className="flex items-center gap-2">
                             <span className="text-[10px] font-black uppercase text-white/50 tracking-widest">STATUS:</span>
                             <span className="text-sm font-black mono text-[#14F195]">SOLVENT</span>
                        </div>
                        <div className="flex items-center gap-2">
                             <span className="text-[10px] font-black uppercase text-white/50 tracking-widest">LATEST_WIN:</span>
                             <span className="text-sm font-black mono text-yellow-500">Anon_x9 extracted 1.2 SOL</span>
                        </div>
                    </React.Fragment>
                 ))}
            </div>
        </div>

      {/* Deployment Modal Overlay */}
      {showModeModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/95 backdrop-blur-xl animate-in fade-in duration-200"
            onClick={() => setShowModeModal(false)}
          />
          <div className="relative w-full max-w-4xl bg-[#0a0a0a] border-2 border-white/10 tech-border shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[95vh]">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/[0.02]">
               <div className="flex items-center gap-3">
                  <div className="w-1.5 h-6 bg-[#14F195]" />
                  <h2 className="text-3xl font-black uppercase italic tracking-tighter text-white">MISSION_CONFIG</h2>
               </div>
               <button onClick={() => setShowModeModal(false)} className="text-white/20 hover:text-white px-2 text-2xl font-black">[X]</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 sm:p-8">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
                  
                  {/* Left Col: Settings */}
                  <div className="space-y-8">
                     {/* Mode Select */}
                     <div className="space-y-4">
                        <Label text="01 // OPERATION_MODE" />
                        <div className="space-y-2">
                           <ModeOption 
                              label="SOLO_RAID" 
                              fee={ENTRY_FEES[Mode.SOLO]} 
                              active={selectedMode === Mode.SOLO} 
                              onClick={() => setSelectedMode(Mode.SOLO)} 
                           />
                           <ModeOption 
                              label="SQUAD_LINK" 
                              fee={ENTRY_FEES[Mode.TEAM]} 
                              active={selectedMode === Mode.TEAM} 
                              onClick={() => setSelectedMode(Mode.TEAM)}
                              locked={currentLevel < 5}
                           />
                           <ModeOption 
                              label="TOURNAMENT" 
                              fee={ENTRY_FEES[Mode.TOURNAMENT]} 
                              active={selectedMode === Mode.TOURNAMENT} 
                              onClick={() => setSelectedMode(Mode.TOURNAMENT)}
                              locked={currentLevel < 15}
                           />
                        </div>
                     </div>

                     {/* Difficulty */}
                     <div className="space-y-4">
                        <Label text="02 // RISK_PARAMETERS" />
                        <div className="grid grid-cols-2 gap-2">
                           {Object.values(Difficulty).map((diff) => {
                             const config = DIFFICULTY_CONFIG[diff];
                             const active = selectedDifficulty === diff;
                             return (
                               <button
                                 key={diff}
                                 onClick={() => setSelectedDifficulty(diff)}
                                 className={`p-4 border tech-border text-left transition-all ${
                                   active
                                     ? `bg-white/10 border-white ${config.color}` 
                                     : 'bg-black border-white/10 text-white/20 hover:border-white/30'
                                 }`}
                               >
                                 <div className="flex justify-between items-start">
                                    <span className="text-sm font-black uppercase italic tracking-tight">{config.label}</span>
                                    {active && <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />}
                                 </div>
                                 <span className="block text-xs font-black uppercase tracking-widest opacity-60 mt-1">
                                   MULT: {diff === Difficulty.EASY ? '0.8X' : diff === Difficulty.MEDIUM ? '1.0X' : diff === Difficulty.HARD ? '1.4X' : '2.5X'}
                                 </span>
                               </button>
                             );
                           })}
                        </div>
                     </div>

                     {/* Boosts */}
                     <div className="space-y-4">
                        <Label text="03 // PROTOCOL_INJECTIONS" />
                        <div className="grid grid-cols-2 gap-2">
                           {RAID_BOOSTS.map(boost => {
                             const isActive = selectedBoosts.includes(boost.id);
                             return (
                               <button
                                 key={boost.id}
                                 onClick={() => handleToggleBoost(boost.id)}
                                 className={`p-4 border tech-border text-left transition-all ${
                                   isActive ? 'bg-yellow-500/10 border-yellow-500' : 'bg-black border-white/10 hover:border-white/30'
                                 }`}
                               >
                                  <div className="flex justify-between mb-1">
                                     <span className="text-xl">{boost.icon}</span>
                                     <span className={`text-sm mono font-black ${isActive ? 'text-yellow-500' : 'text-white/40'}`}>{boost.cost} S</span>
                                  </div>
                                  <p className={`text-xs font-black uppercase italic ${isActive ? 'text-white' : 'text-white/40'}`}>{boost.name}</p>
                               </button>
                             );
                           })}
                        </div>
                     </div>
                  </div>

                  {/* Right Col: Loadout & Confirm */}
                  <div className="flex flex-col h-full">
                     <div className="mb-6">
                        <div className="flex justify-between items-center mb-4">
                           <Label text="04 // ACTIVE_LOADOUT" />
                           <span className="text-xs font-black uppercase text-white/30">{equippedGear.length}/4 SLOTS</span>
                        </div>
                        
                        <div className="grid grid-cols-4 gap-2 mb-6">
                           {/* Avatar Slot */}
                           <div className="aspect-square bg-black border border-cyan-500/50 tech-border relative p-1">
                              {equippedAvatar?.image && (
                                <img src={equippedAvatar.image} className="w-full h-full object-cover" alt="Core" />
                              )}
                              <div className="absolute bottom-0 left-0 bg-cyan-500 text-[10px] text-black font-black px-1.5">CORE</div>
                           </div>
                           
                           {/* Gear Slots */}
                           {[...Array(4)].map((_, i) => {
                              const gear = equippedGear[i];
                              return (
                                 <div key={i} className={`aspect-square bg-black border tech-border relative p-1 ${gear ? 'border-purple-500' : 'border-white/10'}`}>
                                    {gear ? (
                                       <img src={gear.image} className="w-full h-full object-contain" alt={gear.name} style={{ imageRendering: 'pixelated' }} />
                                    ) : (
                                       <div className="w-full h-full flex items-center justify-center text-white/5 text-2xl">+</div>
                                    )}
                                 </div>
                              );
                           })}
                        </div>

                        {/* Owned Inventory Mini-Grid */}
                        <div className="p-4 bg-white/5 border border-white/5">
                           <p className="text-[10px] font-black uppercase text-white/30 mb-3">QUICK_SWAP_INVENTORY</p>
                           <div className="flex flex-wrap gap-2">
                              {ownedGear.map(gear => {
                                 const isEquipped = equippedGearIds.includes(gear.id);
                                 return (
                                    <button 
                                      key={gear.id}
                                      onClick={() => onToggleGear(gear.id)}
                                      className={`w-12 h-12 border tech-border p-1 ${isEquipped ? 'border-purple-500 bg-purple-500/20' : 'border-white/10 hover:bg-white/10'}`}
                                    >
                                       <img src={gear.image} className="w-full h-full object-contain" alt="gear" style={{ imageRendering: 'pixelated' }} />
                                    </button>
                                 )
                              })}
                           </div>
                        </div>
                     </div>

                     <div className="mt-auto pt-8 border-t border-white/10">
                        <div className="flex justify-between items-end mb-6">
                           <div>
                              <p className="text-xs text-white/30 font-black uppercase tracking-widest mb-1">ESTIMATED_COST</p>
                              <p className="text-4xl font-black mono text-white leading-none">{totalCost.toFixed(3)} SOL</p>
                           </div>
                           <div className="text-right">
                              <p className="text-xs text-white/30 font-black uppercase tracking-widest mb-1">POTENTIAL_YIELD</p>
                              <p className="text-2xl font-black mono text-[#14F195] leading-none">HIGH_VARIANCE</p>
                           </div>
                        </div>
                        <button 
                           onClick={handleDeploy}
                           className="w-full py-6 bg-[#14F195] text-black font-black uppercase tracking-tighter text-3xl tech-border hover:bg-[#10c479] active:translate-y-1 transition-all shadow-[0_0_30px_rgba(20,241,149,0.3)]"
                        >
                           CONFIRM_DEPLOYMENT
                        </button>
                     </div>
                  </div>

               </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

const Label = ({ text }: { text: string }) => (
   <p className="text-xs font-black text-white/30 uppercase tracking-[0.2em] italic">{text}</p>
);

const ModeOption = ({ label, fee, active, onClick, locked }: any) => (
   <button 
      onClick={onClick}
      disabled={locked}
      className={`w-full flex justify-between items-center p-5 border tech-border transition-all group ${
         locked ? 'opacity-40 cursor-not-allowed border-white/5 bg-transparent' : 
         active ? 'bg-cyan-500/10 border-cyan-500' : 'bg-black border-white/10 hover:border-white/30'
      }`}
   >
      <div className="text-left">
         <span className={`text-lg font-black uppercase italic ${active ? 'text-cyan-400' : 'text-white'}`}>
            {label}
         </span>
         {locked && <span className="ml-2 text-[10px] text-red-500 font-bold uppercase bg-red-950/30 px-1">LOCKED</span>}
      </div>
      <div className="flex flex-col items-end">
         <span className="mono text-sm font-black text-white/60">{fee} SOL</span>
         {active && <span className="text-[10px] text-cyan-500 font-black uppercase tracking-wider">SELECTED</span>}
      </div>
   </button>
);

export default LobbyScreen;
