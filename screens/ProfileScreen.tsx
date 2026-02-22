
import React, { useMemo, useState, useEffect } from 'react';
import { AVATAR_ITEMS, GEAR_ITEMS, RANKS, Equipment } from '../types';
import { Edit, Check, X, Lock, Wallet, ExternalLink } from 'lucide-react';
import { useRaidHistory } from '../hooks/useRaidHistory';
import { useWithdrawalHistory } from '../hooks/useWithdrawalHistory';
import { supabase } from '../lib/supabase';

interface ProfileScreenProps {
  balance: number;
  unclaimedBalance: number;
  srPoints: number;
  onClaim: () => Promise<string | null>;
  ownedItemIds: string[];
  equippedAvatarId?: string;
  equippedGearIds: string[];
  onEquipAvatar: (avatarId: string) => void;
  onToggleGear: (gearId: string) => void;
  username: string;
  onUpdateUsername: (name: string) => void;
  isConnected: boolean;
  onConnect: () => void;
  walletAddress?: string | null;
  domainName?: string | null;
  referralCode?: string | null;
  referralSREarned?: number;
  onNavigateStore?: (tab?: 'GEAR' | 'AVATAR' | 'PASS') => void;
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
  onToggleGear,
  username,
  onUpdateUsername,
  isConnected,
  onConnect,
  walletAddress,
  domainName,
  referralCode,
  referralSREarned = 0,
  onNavigateStore,
}) => {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(username);
  const [showNotification, setShowNotification] = useState(false);
  const [rightTab, setRightTab] = useState<'RAIDS' | 'WITHDRAWALS'>('RAIDS');
  const [lastWithdrawTx, setLastWithdrawTx] = useState<string | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);
  const [showLockTip, setShowLockTip] = useState(false);

  // Real raid history from Supabase
  const { history: raidHistory, loading: historyLoading } = useRaidHistory(walletAddress ?? null);

  // Withdrawal history from Supabase
  const { history: withdrawals, loading: withdrawLoading, refetch: refetchWithdrawals } = useWithdrawalHistory(walletAddress ?? null);

  const handleWithdraw = async () => {
    if (isClaiming) return;
    setIsClaiming(true);
    try {
      const txSig = await onClaim();
      if (txSig) {
        setLastWithdrawTx(txSig);
        setRightTab('WITHDRAWALS');
        // Give Supabase a moment then re-fetch
        setTimeout(() => refetchWithdrawals(), 1500);
      }
    } finally {
      setIsClaiming(false);
    }
  };

  const solscanTx = (sig: string | null) =>
    sig ? `https://solscan.io/tx/${sig}?cluster=devnet` : '#';

  // Domain name is resolved in App.tsx (once) and passed as prop
  const domain = domainName ?? null;
  const shortAddress = walletAddress
    ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`
    : null;
  const nodeId = domain ?? shortAddress ?? 'UNKNOWN';

  // Referral link — uses the DB-stored referral_code (e.g. SR4F3A9B2E)
  const displayRefCode = referralCode ?? (walletAddress ? `RAID_${walletAddress.slice(-8).toUpperCase()}` : 'CONNECT_WALLET');
  const referralLink = `https://solraid.app/ref/${displayRefCode}`;

  // Count of users who used this referral link
  const [referralCount, setReferralCount] = useState(0);
  useEffect(() => {
    if (!walletAddress) return;
    supabase
      .from('profiles')
      .select('wallet_address', { count: 'exact', head: true })
      .eq('referred_by', walletAddress)
      .then(({ count }) => setReferralCount(count ?? 0));
  }, [walletAddress]);

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

  const canEditName = currentRank.level >= 5;

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

  const saveName = () => {
    if (editName.trim().length > 0) {
      onUpdateUsername(editName);
      setIsEditing(false);
      setShowNotification(true);
      setTimeout(() => setShowNotification(false), 3000);
    }
  };

  if (!isConnected) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
        <div className="border-2 border-white/10 tech-border p-10 sm:p-14 text-center space-y-6 max-w-sm w-full">
          <div className="flex justify-center">
            <div className="w-16 h-16 border-2 border-white/10 tech-border flex items-center justify-center">
              <Wallet size={28} className="text-white/20" />
            </div>
          </div>
          <div>
            <h2 className="text-xl font-black uppercase tracking-widest text-white/60 mb-2">
              WALLET_REQUIRED
            </h2>
            <p className="text-[10px] font-black text-white/20 uppercase tracking-widest leading-relaxed">
              Connect your wallet to access your operator profile, inventory, and mission logs.
            </p>
          </div>
          <button
            onClick={onConnect}
            className="w-full px-8 py-4 bg-cyan-500 text-black font-black uppercase tracking-tighter tech-border shadow-[0_0_20px_rgba(6,182,212,0.2)] hover:bg-cyan-400 active:scale-95 transition-all"
          >
            CONNECT_WALLET
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4 sm:p-6 lg:p-12 animate-in slide-in-from-right duration-300 overflow-y-auto scrollbar-hide pb-28 md:pb-12 relative">
      
      {/* Name Change Notification */}
      {showNotification && (
        <div className="fixed top-24 right-6 z-[200] animate-in slide-in-from-right duration-500">
            <div className="bg-cyan-500/10 border border-cyan-500 text-cyan-500 px-6 py-4 tech-border shadow-[0_0_20px_rgba(6,182,212,0.2)]">
                <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse" />
                    <div>
                        <h4 className="font-black uppercase tracking-widest text-sm">CALLSIGN_UPDATED</h4>
                        <p className="text-[10px] text-cyan-500/60 font-bold uppercase">Identity Layer Re-Synced</p>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Withdrawal Success Toast */}
      {lastWithdrawTx && (
        <div className="fixed top-24 right-6 z-[200] animate-in slide-in-from-right duration-500 max-w-xs">
          <div className="bg-green-500/10 border border-green-500 px-5 py-4 tech-border shadow-[0_0_20px_rgba(34,197,94,0.2)]">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mt-1 shrink-0" />
              <div className="min-w-0">
                <h4 className="font-black uppercase tracking-widest text-sm text-green-500">WITHDRAWAL_CONFIRMED</h4>
                <p className="text-[9px] text-green-500/60 font-bold uppercase mb-2">SOL transferred to wallet</p>
                <a
                  href={solscanTx(lastWithdrawTx)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[9px] font-black text-green-400 hover:text-green-300 uppercase tracking-wider"
                >
                  <span className="truncate mono">{lastWithdrawTx.slice(0, 12)}...{lastWithdrawTx.slice(-6)}</span>
                  <ExternalLink size={10} className="shrink-0" />
                </a>
              </div>
              <button onClick={() => setLastWithdrawTx(null)} className="text-white/20 hover:text-white text-xs ml-1 shrink-0">×</button>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-7xl mx-auto space-y-8 lg:space-y-12">
        
        {/* Header Profile Section */}
        <div className="flex flex-col md:flex-row items-center md:items-start gap-6 lg:gap-10">
          {/* Avatar Container */}
          <div className="shrink-0 flex flex-col items-center gap-2">
            <div
              className="w-36 h-36 sm:w-44 sm:h-44 lg:w-52 lg:h-52 bg-black border-4 tech-border flex items-center justify-center relative overflow-hidden transition-all duration-500"
              style={{ borderColor: equippedAvatar ? currentRank.color : '#333', boxShadow: equippedAvatar ? `0 0 30px ${currentRank.color}20` : 'none' }}
            >
              {equippedAvatar?.image ? (
                <img
                  src={equippedAvatar.image}
                  alt={equippedAvatar.name}
                  className="w-full h-full object-cover transition-all duration-700"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 px-3">
                  <div className="text-3xl font-black text-white/10 italic">?</div>
                  <span className="text-[9px] font-black text-white/20 uppercase tracking-widest text-center leading-tight">NO AVATAR</span>
                </div>
              )}
              <div className="absolute bottom-0 left-0 w-full h-1 bg-cyan-500 shadow-[0_0_15px_#06b6d4]" />
            </div>
            {/* Purchase prompt when no avatar equipped */}
            {!equippedAvatar && onNavigateStore && (
              <button
                onClick={() => onNavigateStore('AVATAR')}
                className="px-3 py-1.5 bg-cyan-500/10 border border-cyan-500/40 text-cyan-400 text-[9px] font-black uppercase tracking-widest hover:bg-cyan-500/20 active:scale-95 transition-all"
              >
                BUY AVATAR →_STORE
              </button>
            )}
            {equippedAvatar && (
              <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">{equippedAvatar.name}</span>
            )}
          </div>

          {/* User Info & Progress */}
          <div className="flex-1 w-full text-center md:text-left space-y-5">
            <div className="flex flex-col md:flex-row items-center md:items-end gap-3 md:gap-5 min-h-[60px]">
              {isEditing ? (
                  <div className="flex items-center gap-2 w-full max-w-md">
                      <input 
                          type="text" 
                          value={editName}
                          onChange={(e) => setEditName(e.target.value.toUpperCase())}
                          className="text-4xl sm:text-5xl lg:text-6xl font-black uppercase italic tracking-tighter text-white bg-transparent border-b-2 border-cyan-500 focus:outline-none w-full"
                          autoFocus
                          maxLength={12}
                      />
                      <button onClick={saveName} className="p-2 bg-green-500 text-black rounded hover:bg-green-400"><Check size={24} /></button>
                      <button onClick={() => setIsEditing(false)} className="p-2 bg-red-500 text-white rounded hover:bg-red-400"><X size={24} /></button>
                  </div>
              ) : (
                  <div className="flex flex-col gap-1.5 items-center md:items-start">
                    <div className="flex items-center gap-4 group justify-center md:justify-start">
                      <h2 className="text-4xl sm:text-5xl lg:text-7xl font-black uppercase italic tracking-tighter text-white leading-none">
                          {username}
                      </h2>
                      <button
                          onClick={() => {
                              if (canEditName) {
                                  setEditName(username);
                                  setIsEditing(true);
                              } else {
                                  setShowLockTip(prev => !prev);
                              }
                          }}
                          className={`p-2 transition-all rounded-full border ${canEditName ? 'text-white/20 hover:text-cyan-400 border-transparent hover:border-cyan-500/30 cursor-pointer hover:bg-white/5' : 'text-orange-400/70 hover:text-orange-400 border-orange-500/20 hover:border-orange-500/50 cursor-pointer hover:bg-orange-500/5'}`}
                          title={canEditName ? 'Edit Callsign' : 'Locked — click for info'}
                      >
                          {canEditName ? <Edit size={20} /> : <Lock size={20} />}
                      </button>
                    </div>
                    {showLockTip && !canEditName && (
                      <div className="flex items-start gap-2 px-3 py-2 bg-orange-500/10 border border-orange-500/30 text-left max-w-xs animate-in fade-in slide-in-from-top-1 duration-200">
                        <Lock size={11} className="text-orange-400 shrink-0 mt-0.5" />
                        <p className="text-[10px] font-black text-orange-300/80 uppercase tracking-wider leading-relaxed">
                          CALLSIGN LOCKED — Reach <span className="text-orange-400">Level 5 (RAIDER)</span> to set a custom name. Keep raiding to rank up.
                        </p>
                      </div>
                    )}
                  </div>
              )}
              
              <div className="px-4 py-1.5 bg-white/5 border border-white/10 tech-border mb-1 shrink-0">
                <span className="text-xs sm:text-sm font-black italic uppercase" style={{ color: currentRank.color }}>L.{currentRank.level}</span>
              </div>
            </div>
            
            <p className="text-xs sm:text-sm font-black uppercase tracking-[0.3em] italic leading-tight" style={{ color: currentRank.color }}>
              {currentRank.title} // PROTOCOL_ACCESS_GRANTED
            </p>

            {/* NODE_ID — shows .skr domain if owned, else truncated address */}
            <div className="flex items-center gap-2 justify-center md:justify-start">
              <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">NODE_ID:</span>
              <span
                className="text-[10px] font-mono font-bold px-2 py-0.5 border"
                style={{
                  color: domain ? '#14F195' : 'rgba(6,182,212,0.7)',
                  borderColor: domain ? 'rgba(20,241,149,0.3)' : 'rgba(6,182,212,0.2)',
                  background: domain ? 'rgba(20,241,149,0.05)' : 'transparent',
                }}
              >
                {nodeId}
              </span>
            </div>

            {/* Progress Bar Container */}
            <div className="w-full max-w-lg mx-auto md:mx-0 pt-3">
              <div className="flex justify-between items-end mb-2">
                <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">RANK_PROGRESS</span>
                <span className="mono text-[10px] sm:text-xs text-white/60 font-black italic">
                  {Math.floor(progress)}% TO {nextRank?.title || 'MAX_CAP'}
                </span>
              </div>
              <div className="h-3 w-full bg-white/5 tech-border overflow-hidden">
                 <div 
                   className="h-full transition-all duration-1000 ease-out" 
                   style={{ width: `${progress}%`, backgroundColor: currentRank.color, boxShadow: `0 0 10px ${currentRank.color}` }}
                 />
              </div>
            </div>

            {/* Perks Listing */}
            <div className="flex flex-wrap justify-center md:justify-start gap-3 pt-2">
              {currentRank.perks.map((perk, i) => (
                <div key={i} className="px-3 py-1.5 bg-white/2 border border-white/5 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-[#14F195] shrink-0" />
                  <span className="text-[8px] sm:text-[9px] font-black text-white/50 uppercase italic tracking-tighter">{perk}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Combined Gear Stats Section */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="bg-[#050505] border-2 border-white/5 p-5 tech-border">
            <p className="text-[10px] text-white/20 font-black uppercase tracking-widest mb-1 italic">EXTRACTION_BOOST</p>
            <p className="text-2xl font-black mono text-purple-400">+{gearStats.mult.toFixed(2)}x</p>
          </div>
          <div className="bg-[#050505] border-2 border-white/5 p-5 tech-border">
            <p className="text-[10px] text-white/20 font-black uppercase tracking-widest mb-1 italic">RISK_SHIELDING</p>
            <p className="text-2xl font-black mono text-[#14F195]">-{gearStats.riskReduc}%</p>
          </div>
          <div className="bg-[#050505] border-2 border-white/5 p-5 tech-border">
            <p className="text-[10px] text-white/20 font-black uppercase tracking-widest mb-1 italic">CORE_STABILITY</p>
            <p className="text-2xl font-black mono text-cyan-400">+{gearStats.timeBoost}s</p>
          </div>
        </div>

        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          
          {/* Left Column: Wealth, Inventory & Referral */}
          <div className="lg:col-span-7 space-y-8 lg:space-y-12">
            
            {/* Unclaimed Balance Card */}
            <div className="bg-[#050505] border-2 border-green-500/20 p-6 sm:p-10 tech-border relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-5 opacity-5 mono text-2xl sm:text-4xl font-black italic uppercase pointer-events-none group-hover:opacity-10 transition-opacity">
                [STORAGE]
              </div>
              <div className="relative z-10">
                <p className="text-[10px] text-green-500/50 font-black uppercase tracking-[0.3em] mb-4">UNCLAIMED_HARVEST</p>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                  <div className="flex items-baseline gap-2">
                    <p className="mono text-5xl sm:text-6xl lg:text-7xl font-black text-white tracking-tighter leading-none">
                      {unclaimedBalance.toFixed(4)}
                    </p>
                    <span className="text-sm sm:text-xl text-green-500 font-black italic">SOL</span>
                  </div>
                  <button
                    onClick={handleWithdraw}
                    disabled={unclaimedBalance <= 0 || isClaiming}
                    className={`w-full sm:w-auto px-10 py-5 font-black uppercase tracking-tighter text-sm tech-border transition-all ${unclaimedBalance > 0 && !isClaiming ? 'bg-green-500 text-black hover:bg-green-400 active:translate-y-1' : 'bg-white/5 text-white/10 border-white/5 cursor-not-allowed opacity-50'}`}
                  >
                    {isClaiming ? 'PROCESSING...' : 'WITHDRAW_ASSETS'}
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="bg-black border-2 border-white/5 p-6 tech-border hover:border-yellow-500/20 transition-all">
                <p className="text-[9px] text-white/20 font-black uppercase tracking-[0.2em] mb-1">REPUTATION_PTS</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl sm:text-3xl font-black mono text-yellow-500">{srPoints.toLocaleString()}</p>
                  <span className="text-xs font-black text-yellow-500/40 italic">$SR</span>
                </div>
              </div>
              <div className="bg-black border-2 border-white/5 p-6 tech-border hover:border-purple-500/20 transition-all">
                <p className="text-[9px] text-white/20 font-black uppercase tracking-[0.2em] mb-1">DRIVE_CAPACITY</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl sm:text-3xl font-black mono text-white">{ownedItemIds.length}</p>
                  <span className="text-xs font-black text-purple-400/60 italic">/ 24 UNITS</span>
                </div>
              </div>
            </div>

            {/* Referral Protocol Card */}
            <div className="bg-[#050505] border-2 border-cyan-500/20 p-6 sm:p-8 tech-border relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-5 opacity-5 mono text-2xl sm:text-4xl font-black italic uppercase pointer-events-none group-hover:opacity-10 transition-opacity">
                [LINK]
              </div>
              <div className="relative z-10">
                <p className="text-[10px] text-cyan-500/50 font-black uppercase tracking-[0.3em] mb-4">REFERRAL_PROTOCOL</p>

                {/* Stats row */}
                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div className="bg-black/60 border border-white/5 p-3 text-center">
                    <p className="text-[9px] text-white/30 font-black uppercase tracking-widest mb-1">RECRUITS</p>
                    <p className="text-2xl font-black mono text-cyan-400">{referralCount}</p>
                  </div>
                  <div className="bg-black/60 border border-white/5 p-3 text-center">
                    <p className="text-[9px] text-white/30 font-black uppercase tracking-widest mb-1">SR_EARNED</p>
                    <p className="text-2xl font-black mono text-yellow-500">{referralSREarned.toLocaleString()}</p>
                  </div>
                </div>

                <div className="flex flex-col space-y-4">
                  {/* Code display */}
                  <div className="bg-black border border-cyan-500/20 p-3 tech-border">
                    <p className="text-[9px] text-white/30 font-black uppercase tracking-widest mb-1">YOUR_CODE</p>
                    <p className="mono text-lg font-black text-cyan-400 tracking-widest">{displayRefCode}</p>
                  </div>

                  {/* Link + copy */}
                  <div className="bg-black border border-white/10 p-4 tech-border flex flex-col sm:flex-row items-center justify-between gap-3">
                    <span className="mono text-xs text-white/50 truncate w-full sm:w-auto text-center sm:text-left">
                      {referralLink}
                    </span>
                    <button
                      onClick={handleCopyLink}
                      className={`w-full sm:w-auto px-6 py-2.5 font-black uppercase tracking-tighter text-xs tech-border transition-all whitespace-nowrap ${copied ? 'bg-cyan-500 text-black border-cyan-500' : 'bg-white/5 text-cyan-500 border-cyan-500/30 hover:bg-cyan-500/10'}`}
                    >
                      {copied ? 'LINK_COPIED' : 'COPY_LINK'}
                    </button>
                  </div>

                  <div className="flex items-center gap-3 bg-cyan-950/20 border-l-2 border-cyan-500 px-4 py-3">
                    <div className="w-2 h-2 bg-cyan-500 animate-pulse shrink-0" />
                    <p className="text-[10px] font-black text-white/40 uppercase tracking-widest leading-relaxed italic">
                      EARN <span className="text-yellow-500">+250 $SR</span> INSTANTLY WHEN A NEW RECRUIT JOINS VIA YOUR LINK
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Inventory Grid */}
            <div className="bg-black/40 border-2 border-white/5 p-6 sm:p-10 tech-border">
               <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-8">
                 <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 italic leading-none">__INVENTORY_DRIVES</h3>
                 <span className="text-[9px] font-black text-cyan-500/50 uppercase tracking-widest hidden sm:block">SELECT_CORE_TO_EQUIP</span>
               </div>
              
              <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-6 gap-4 sm:gap-5">
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
                      {item.image && !item.image.startsWith('http') ? (
                        // Emoji icon for gear
                        <span className="text-2xl leading-none select-none">{item.image}</span>
                      ) : item.image ? (
                        // URL image for avatars
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-full h-full object-cover transition-all duration-300"
                          style={{ imageRendering: 'pixelated' }}
                        />
                      ) : (
                        <span className="text-[9px] font-black text-white/20">{item.type === 'GEAR' ? 'GR' : 'AV'}</span>
                      )}
                      
                      {!isEquipped && (
                        <div className={`absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity ${isAvatar ? 'bg-cyan-500/10' : 'bg-purple-500/10'}`}>
                          <span className={`text-[8px] font-black px-1.5 py-0.5 uppercase tracking-tighter ${isAvatar ? 'bg-cyan-500 text-black' : 'bg-purple-500 text-white'}`}>
                            {isAvatar ? 'EQUIP' : 'ACTIVATE'}
                          </span>
                        </div>
                      )}

                      {isEquipped && (
                        <>
                          <div className={`absolute top-0 right-0 w-2 h-2 ${isAvatar ? 'bg-cyan-500' : 'bg-purple-500'}`} />
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

          {/* Right Column: Tabbed logs */}
          <div className="lg:col-span-5 space-y-5">

            {/* Tab bar */}
            <div className="flex gap-1">
              {(['RAIDS', 'WITHDRAWALS'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setRightTab(tab)}
                  className={`px-4 py-2 text-[9px] font-black uppercase tracking-widest transition-all tech-border ${rightTab === tab ? 'bg-white/10 text-white border-white/20' : 'text-white/20 border-white/5 hover:text-white/40'}`}
                >
                  {tab === 'RAIDS' ? `__MISSION_LOGS` : `__WITHDRAWALS`}
                  {tab === 'WITHDRAWALS' && withdrawals.length > 0 && (
                    <span className="ml-1.5 px-1 bg-green-500 text-black text-[8px] rounded-sm">{withdrawals.length}</span>
                  )}
                </button>
              ))}
            </div>

            {/* ── RAID HISTORY ──────────────────────────────────── */}
            {rightTab === 'RAIDS' && (
              <div className="space-y-3">
                {historyLoading ? (
                  [...Array(3)].map((_, i) => (
                    <div key={i} className="bg-black border-2 border-white/5 p-5 tech-border animate-pulse">
                      <div className="h-4 bg-white/5 rounded w-1/2" />
                    </div>
                  ))
                ) : raidHistory.length === 0 ? (
                  <div className="py-12 text-center">
                    <p className="text-white/20 font-black uppercase tracking-widest text-xs">NO MISSIONS YET</p>
                    <p className="text-white/10 text-[10px] uppercase tracking-widest mt-1">Deploy into a raid to begin your record.</p>
                  </div>
                ) : (
                  raidHistory.map((h) => {
                    const date = new Date(h.created_at).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' });
                    const resultLabel = h.success ? 'EXTRACTED' : 'BUSTED';
                    const amountStr = h.success
                      ? `+${Number(h.sol_amount).toFixed(4)} SOL`
                      : `-${Number(h.entry_fee).toFixed(4)} SOL`;
                    const txShort = h.server_seed_hash
                      ? `${h.server_seed_hash.slice(0, 4)}...${h.server_seed_hash.slice(-3)}`
                      : h.raid_id.slice(-6);
                    return (
                      <div
                        key={h.id}
                        className="bg-black border-2 border-white/5 p-4 sm:p-5 tech-border flex items-center justify-between group hover:bg-white/2 transition-colors"
                      >
                        <div className="flex flex-col gap-1">
                          <span className={`text-xs font-black uppercase tracking-widest ${!h.success ? 'text-red-500' : 'text-green-500'}`}>
                            {resultLabel}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] mono text-white/20 font-black uppercase tracking-tighter italic">{date}</span>
                            <span className="text-[9px] text-white/10">|</span>
                            <span className="text-[9px] mono text-white/20 font-black uppercase tracking-tighter">{h.difficulty}</span>
                          </div>
                        </div>
                        <div className="text-right flex flex-col items-end gap-0.5">
                          <p className={`mono text-sm sm:text-base font-black ${!h.success ? 'text-red-500/50' : 'text-white'}`}>
                            {amountStr}
                          </p>
                          <span className="text-[9px] text-cyan-500/30 font-black uppercase tracking-widest italic">
                            SEED: {txShort}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* ── WITHDRAWAL HISTORY ───────────────────────────── */}
            {rightTab === 'WITHDRAWALS' && (
              <div className="space-y-3">
                {withdrawLoading ? (
                  [...Array(3)].map((_, i) => (
                    <div key={i} className="bg-black border-2 border-white/5 p-5 tech-border animate-pulse">
                      <div className="h-4 bg-white/5 rounded w-1/2" />
                    </div>
                  ))
                ) : withdrawals.length === 0 ? (
                  <div className="py-12 text-center">
                    <p className="text-white/20 font-black uppercase tracking-widest text-xs">NO WITHDRAWALS YET</p>
                    <p className="text-white/10 text-[10px] uppercase tracking-widest mt-1">Withdraw your unclaimed SOL to see records here.</p>
                  </div>
                ) : (
                  withdrawals.map((w) => {
                    const date = new Date(w.created_at).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' });
                    const time = new Date(w.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                    const sig = w.tx_signature ?? '';
                    const sigShort = sig ? `${sig.slice(0, 8)}...${sig.slice(-6)}` : 'PENDING';
                    return (
                      <div
                        key={w.id}
                        className="bg-black border-2 border-green-500/10 p-4 sm:p-5 tech-border hover:border-green-500/20 transition-colors group"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex flex-col gap-1 min-w-0">
                            <span className="text-xs font-black uppercase tracking-widest text-green-500">WITHDRAWN</span>
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] mono text-white/20 font-black italic">{date} {time}</span>
                              <span className={`text-[8px] font-black uppercase px-1 py-0.5 ${w.status === 'CONFIRMED' ? 'bg-green-500/10 text-green-500' : 'bg-yellow-500/10 text-yellow-500'}`}>
                                {w.status}
                              </span>
                            </div>
                            {sig ? (
                              <a
                                href={solscanTx(sig)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-[9px] font-black text-cyan-500/50 hover:text-cyan-400 uppercase tracking-wider group/link"
                              >
                                <span className="mono">{sigShort}</span>
                                <ExternalLink size={9} className="shrink-0 group-hover/link:text-cyan-400" />
                              </a>
                            ) : (
                              <span className="text-[9px] font-black text-white/20 uppercase tracking-wider">{sigShort}</span>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="mono text-base sm:text-lg font-black text-white">
                              +{Number(w.amount_sol).toFixed(4)}
                            </p>
                            <p className="text-[9px] text-green-500/50 font-black uppercase">SOL</p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileScreen;
