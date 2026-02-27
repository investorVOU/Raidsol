
import React, { useMemo, useState, useEffect } from 'react';
import { AVATAR_ITEMS, GEAR_ITEMS, RANKS, Equipment } from '../types';
import { Edit, Check, X, Lock, Wallet, ExternalLink } from 'lucide-react';
import { useRaidHistory } from '../hooks/useRaidHistory';
import { useWithdrawalHistory } from '../hooks/useWithdrawalHistory';
import { usePlayerRoundWins } from '../hooks/usePlayerRoundWins';
import { useAvatarNfts } from '../hooks/useAvatarNfts';
import { getRoundBoundsFor, formatRoundWindow } from '../hooks/useRoundData';
import { supabase } from '../lib/supabase';

interface ProfileScreenProps {
  balance: number;
  unclaimedBalance: number;
  srPoints: number;
  onClaim: (amount?: number) => Promise<string | null>;
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
  onClaimRoundWin?: (roundNum: number, roundDate: string) => Promise<boolean>;
  onMintAvatar?: (avatarId: string) => Promise<boolean>;
  lastClaimAt?: string | null;
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
  onClaimRoundWin,
  onMintAvatar,
  lastClaimAt,
}) => {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(username);
  const [showNotification, setShowNotification] = useState(false);
  const [rightTab, setRightTab] = useState<'RAIDS' | 'WITHDRAWALS' | 'ROUNDS'>('RAIDS');
  const [lastWithdrawTx, setLastWithdrawTx] = useState<string | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [showLockTip, setShowLockTip] = useState(false);

  // Default withdraw amount to full balance whenever balance updates
  useEffect(() => {
    if (unclaimedBalance > 0) setWithdrawAmount(unclaimedBalance.toFixed(4));
  }, [unclaimedBalance]);
  const [isMinting, setIsMinting] = useState(false);

  // Minted NFT records for this wallet
  const { mintedAvatars, refetch: refetchMints } = useAvatarNfts(walletAddress ?? null);

  // Real raid history from Supabase
  const { history: raidHistory, loading: historyLoading } = useRaidHistory(walletAddress ?? null);

  // Fee decay preview — only paid raids count (DRILL excluded)
  const todayRaidCount = useMemo(() => {
    const cutoff = Date.now() - 86400000;
    return raidHistory.filter(r => new Date(r.created_at).getTime() > cutoff && r.mode !== 'DRILL').length;
  }, [raidHistory]);
  const feeRate = todayRaidCount >= 3 ? 0 : todayRaidCount === 2 ? 2 : todayRaidCount === 1 ? 5 : 8;
  const feePreview = parseFloat(withdrawAmount) > 0 ? parseFloat(withdrawAmount) * feeRate / 100 : 0;

  // Cooldown state
  const [, forceTickCooldown] = useState(0);
  useEffect(() => {
    const t = setInterval(() => forceTickCooldown(n => n + 1), 30000);
    return () => clearInterval(t);
  }, []);
  const COOLDOWN_MS = 6 * 60 * 60 * 1000;
  const claimLockedUntil = lastClaimAt ? new Date(lastClaimAt).getTime() + COOLDOWN_MS : null;
  const playedSinceClaim = lastClaimAt
    ? raidHistory.some(r => r.mode !== 'DRILL' && new Date(r.created_at).getTime() > new Date(lastClaimAt).getTime())
    : false;
  const cooldownActive = claimLockedUntil !== null
    && Date.now() < claimLockedUntil
    && !playedSinceClaim;
  const cooldownRemainingMs = cooldownActive ? (claimLockedUntil! - Date.now()) : 0;
  const cooldownH = Math.floor(cooldownRemainingMs / 3600000);
  const cooldownM = Math.floor((cooldownRemainingMs % 3600000) / 60000);

  // Avatar gate
  const hasAvatar = !!equippedAvatarId;

  // Round win history
  const { wins: roundWins, loading: roundWinsLoading, refetch: refetchRoundWins } = usePlayerRoundWins(walletAddress ?? null);
  const [claimingRound, setClaimingRound] = useState<string | null>(null); // "roundNum:roundDate" key

  const handleClaimRoundWinLocal = async (roundNum: number, roundDate: string) => {
    if (!onClaimRoundWin) return;
    const key = `${roundNum}:${roundDate}`;
    setClaimingRound(key);
    try {
      const ok = await onClaimRoundWin(roundNum, roundDate);
      if (ok) refetchRoundWins();
    } finally {
      setClaimingRound(null);
    }
  };

  // Withdrawal history from Supabase
  const { history: withdrawals, loading: withdrawLoading, refetch: refetchWithdrawals } = useWithdrawalHistory(walletAddress ?? null);

  const handleWithdraw = async () => {
    if (isClaiming) return;
    const parsed = parseFloat(withdrawAmount);
    if (isNaN(parsed) || parsed <= 0 || parsed > unclaimedBalance) return;
    setIsClaiming(true);
    try {
      const txSig = await onClaim(parsed);
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

  const handleMintClick = async () => {
    if (!equippedAvatarId || isMinting || !onMintAvatar) return;
    setIsMinting(true);
    try {
      const ok = await onMintAvatar(equippedAvatarId);
      if (ok) refetchMints();
    } finally {
      setIsMinting(false);
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
              <Wallet size={28} className="text-white/40" />
            </div>
          </div>
          <div>
            <h2 className="text-xl font-bold text-white/75 mb-2">
              Wallet required
            </h2>
            <p className="text-[10px] text-white/40 leading-relaxed">
              Connect your wallet to access your profile, inventory, and mission logs.
            </p>
          </div>
          <button
            onClick={onConnect}
            className="w-full px-8 py-4 font-black uppercase tracking-tight tech-border active:scale-95 transition-all"
            style={{ background: 'linear-gradient(135deg, #FF2929 0%, #CC0000 100%)', color: '#fff', fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '1.5px', boxShadow: '0 0 20px rgba(255,41,41,0.25)' }}
          >
            Connect wallet
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
            <div className="bg-[#FF2929]/10 border border-[#FF2929] text-[#FF2929] px-6 py-4 tech-border shadow-[0_0_20px_rgba(255,41,41,0.2)]">
                <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-[#FF2929] rounded-full animate-pulse" />
                    <div>
                        <h4 className="font-bold text-sm">Name updated</h4>
                        <p className="text-[10px] text-[#FF2929]/60">Saved successfully</p>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Withdrawal Success Toast */}
      {lastWithdrawTx && (
        <div className="fixed top-24 right-6 z-[200] animate-in slide-in-from-right duration-500 max-w-xs">
          <div className="bg-[#FFB800]/10 border border-[#FFB800]/40 px-5 py-4 tech-border shadow-[0_0_20px_rgba(255,184,0,0.2)]">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-[#FFB800] rounded-full animate-pulse mt-1 shrink-0" />
              <div className="min-w-0">
                <h4 className="font-bold text-sm text-[#FFB800]">Withdrawal confirmed</h4>
                <p className="text-[9px] text-[#FFB800]/60 font-bold mb-2">SOL transferred to wallet</p>
                <a
                  href={solscanTx(lastWithdrawTx)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[9px] font-black text-[#FFB800] hover:text-amber-300 uppercase tracking-wider"
                >
                  <span className="truncate mono">{lastWithdrawTx.slice(0, 12)}...{lastWithdrawTx.slice(-6)}</span>
                  <ExternalLink size={10} className="shrink-0" />
                </a>
              </div>
              <button onClick={() => setLastWithdrawTx(null)} className="text-white/40 hover:text-white text-xs ml-1 shrink-0">×</button>
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
                  <div className="text-3xl font-black text-white/20">?</div>
                  <span className="text-[9px] font-bold text-white/30 text-center leading-tight">No avatar</span>
                </div>
              )}
              <div className="absolute bottom-0 left-0 w-full h-1 bg-[#FF2929] shadow-[0_0_15px_#FF2929]" />
            </div>
            {/* Purchase prompt when no avatar equipped */}
            {!equippedAvatar && onNavigateStore && (
              <button
                onClick={() => onNavigateStore('AVATAR')}
                className="px-3 py-1.5 bg-[#FF2929]/10 border border-[#FF2929]/40 text-[#FF2929] text-[9px] font-bold hover:bg-[#FF2929]/20 active:scale-95 transition-all"
              >
                Get avatar →
              </button>
            )}
            {equippedAvatar && (
              <span className="text-[9px] font-bold text-white/40">{equippedAvatar.name}</span>
            )}
            {/* Mint — coming soon badge */}
            {equippedAvatar && isConnected && ownedItemIds.includes(equippedAvatarId ?? '') && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 border border-white/10 bg-white/3">
                <div className="w-1.5 h-1.5 bg-[#FFB800] rounded-full animate-pulse shrink-0" />
                <span className="text-[9px] font-black uppercase tracking-widest text-white/40">
                  NFT Mint — Coming Soon
                </span>
              </div>
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
                          className="text-4xl sm:text-5xl lg:text-6xl font-black uppercase italic tracking-tighter text-white bg-transparent border-b-2 border-[#FF2929] focus:outline-none w-full"
                          autoFocus
                          maxLength={12}
                      />
                      <button onClick={saveName} className="p-2 bg-[#FF2929] text-white rounded hover:bg-[#E60000]"><Check size={24} /></button>
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
                          className={`p-2 transition-all rounded-full border ${canEditName ? 'text-white/40 hover:text-[#FF2929] border-transparent hover:border-[#FF2929]/30 cursor-pointer hover:bg-white/5' : 'text-orange-400/70 hover:text-orange-400 border-orange-500/20 hover:border-orange-500/50 cursor-pointer hover:bg-orange-500/5'}`}
                          title={canEditName ? 'Edit Callsign' : 'Locked — click for info'}
                      >
                          {canEditName ? <Edit size={20} /> : <Lock size={20} />}
                      </button>
                    </div>
                    {showLockTip && !canEditName && (
                      <div className="flex items-start gap-2 px-3 py-2 bg-orange-500/10 border border-orange-500/30 text-left max-w-xs animate-in fade-in slide-in-from-top-1 duration-200">
                        <Lock size={11} className="text-orange-400 shrink-0 mt-0.5" />
                        <p className="text-[10px] font-bold text-orange-300/80 leading-relaxed">
                          Name locked — reach <span className="text-orange-400">Level 5 (Raider)</span> to set a custom name.
                        </p>
                      </div>
                    )}
                  </div>
              )}
              
              <div className="px-3 py-1 bg-white/5 border border-white/10 tech-border mb-1 shrink-0">
                <span className="text-xs font-bold uppercase" style={{ color: currentRank.color }}>Lv.{currentRank.level}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2 justify-center md:justify-start flex-wrap">
              <p className="text-xs sm:text-sm font-bold uppercase tracking-wider leading-tight" style={{ color: currentRank.color }}>
                {currentRank.title}
              </p>
              {domain && (
                <div
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full shrink-0"
                  style={{ border: '1px solid rgba(255,184,0,0.4)', background: 'rgba(255,184,0,0.10)' }}
                >
                  <i className="fa-solid fa-shield-halved text-[#FFB800]" style={{ fontSize: '9px' }} />
                  <span className="text-[10px] font-black text-[#FFB800]">{domain}</span>
                </div>
              )}
            </div>

            {/* Wallet — shows .skr domain if owned, else truncated address */}
            <div className="flex items-center gap-2 justify-center md:justify-start">
              <span className="text-[9px] font-bold text-white/40 uppercase tracking-wide">Wallet:</span>
              <span
                className="text-[10px] font-mono font-bold px-2 py-0.5 border"
                style={{
                  color: domain ? '#FFB800' : 'rgba(6,182,212,0.7)',
                  borderColor: domain ? 'rgba(255,184,0,0.3)' : 'rgba(6,182,212,0.2)',
                  background: domain ? 'rgba(255,184,0,0.05)' : 'transparent',
                }}
              >
                {nodeId}
              </span>
            </div>

            {/* Progress Bar Container */}
            <div className="w-full max-w-lg mx-auto md:mx-0 pt-3">
              <div className="flex justify-between items-end mb-2">
                <span className="text-[10px] font-bold text-white/50 uppercase tracking-wide">Rank progress</span>
                <span className="mono text-[10px] sm:text-xs text-white/60 font-bold">
                  {Math.floor(progress)}% to {nextRank?.title || 'Max'}
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
                  <div className="w-1.5 h-1.5 bg-[#FF2929] shrink-0" />
                  <span className="text-[8px] sm:text-[9px] font-bold text-white/60">{perk}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Combined Gear Stats Section */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="bg-[#050505] border-2 border-white/5 p-5 tech-border">
            <p className="text-[10px] text-white/40 font-bold uppercase tracking-wide mb-1">Mult boost</p>
            <p className="text-2xl font-black mono text-purple-400">+{gearStats.mult.toFixed(2)}x</p>
          </div>
          <div className="bg-[#050505] border-2 border-white/5 p-5 tech-border">
            <p className="text-[10px] text-white/40 font-bold uppercase tracking-wide mb-1">Risk shield</p>
            <p className="text-2xl font-black mono text-[#FF2929]">-{gearStats.riskReduc}%</p>
          </div>
          <div className="bg-[#050505] border-2 border-white/5 p-5 tech-border">
            <p className="text-[10px] text-white/40 font-bold uppercase tracking-wide mb-1">Time bonus</p>
            <p className="text-2xl font-black mono text-cyan-400">+{gearStats.timeBoost}s</p>
          </div>
        </div>

        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          
          {/* Left Column: Wealth, Inventory & Referral */}
          <div className="lg:col-span-7 space-y-8 lg:space-y-12">
            
            {/* Unclaimed Balance Card */}
            <div className="bg-[#050505] border-2 border-[#FFB800]/20 p-6 sm:p-10 tech-border relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-5 opacity-5 mono text-2xl sm:text-4xl font-black italic uppercase pointer-events-none group-hover:opacity-10 transition-opacity">
                [STORAGE]
              </div>
              <div className="relative z-10">
                <p className="text-[10px] text-[#FFB800]/60 font-bold uppercase tracking-wide mb-4">Unclaimed</p>
                {/* Balance display */}
                <div className="flex items-baseline gap-2 mb-6">
                  <p className="mono text-5xl sm:text-6xl lg:text-7xl font-black text-white tracking-tighter leading-none">
                    {unclaimedBalance.toFixed(4)}
                  </p>
                  <span className="text-sm sm:text-xl text-[#FFB800] font-black italic">SOL</span>
                </div>
                {/* Amount selector */}
                <div className="space-y-3">
                  {/* Preset chips */}
                  <div className="flex gap-2">
                    {([0.25, 0.5, 0.75, 1] as const).map((pct) => {
                      const label = pct === 1 ? 'MAX' : `${pct * 100}%`;
                      const val = (unclaimedBalance * pct).toFixed(4);
                      const active = withdrawAmount === val || (pct === 1 && withdrawAmount === unclaimedBalance.toFixed(4));
                      return (
                        <button
                          key={label}
                          onClick={() => setWithdrawAmount((unclaimedBalance * pct).toFixed(4))}
                          disabled={unclaimedBalance <= 0}
                          className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-widest tech-border transition-all disabled:opacity-30 disabled:cursor-not-allowed ${active ? 'border-[#FFB800]/60 text-[#FFB800] bg-[#FFB800]/10' : 'border-white/10 text-white/40 hover:border-white/30 hover:text-white/70'}`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  {/* Amount input + withdraw button */}
                  <div className="flex gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="number"
                        min="0"
                        max={unclaimedBalance}
                        step="0.0001"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        disabled={unclaimedBalance <= 0 || isClaiming}
                        className="w-full bg-black border-2 border-white/10 focus:border-[#FFB800]/40 outline-none px-4 py-3 mono text-sm font-black text-white placeholder-white/20 disabled:opacity-30 transition-colors"
                        placeholder="0.0000"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-[#FFB800]/60">SOL</span>
                    </div>
                    <button
                      onClick={handleWithdraw}
                      disabled={!hasAvatar || unclaimedBalance <= 0 || isClaiming || !withdrawAmount || parseFloat(withdrawAmount) <= 0 || parseFloat(withdrawAmount) > unclaimedBalance || cooldownActive}
                      className={`px-8 py-3 font-black uppercase tracking-tighter text-sm tech-border transition-all whitespace-nowrap ${hasAvatar && unclaimedBalance > 0 && !isClaiming && parseFloat(withdrawAmount) > 0 && parseFloat(withdrawAmount) <= unclaimedBalance && !cooldownActive ? 'active:translate-y-1' : 'bg-white/5 text-white/20 border-white/5 cursor-not-allowed opacity-50'}`}
                      style={hasAvatar && unclaimedBalance > 0 && !isClaiming && parseFloat(withdrawAmount) > 0 && parseFloat(withdrawAmount) <= unclaimedBalance && !cooldownActive ? { background: 'linear-gradient(135deg, #FF2929 0%, #CC0000 100%)', color: '#fff', fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '1.5px' } : undefined}
                    >
                      {isClaiming ? 'Processing...' : 'Withdraw'}
                    </button>
                  </div>

                  {/* Avatar gate */}
                  {!hasAvatar && (
                    <div className="bg-[#FF2929]/10 border border-[#FF2929]/40 p-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-[#FF2929]">Avatar required to withdraw</p>
                        <p className="text-[9px] text-white/40 mt-0.5 uppercase tracking-wide">Equip an avatar to unlock payouts</p>
                      </div>
                      <button
                        onClick={() => onNavigateStore?.('AVATAR')}
                        className="shrink-0 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest border border-[#FF2929]/60 text-[#FF2929] hover:bg-[#FF2929]/20 transition-colors"
                      >
                        Get Avatar
                      </button>
                    </div>
                  )}

                  {/* Fee info */}
                  {feeRate > 0 && unclaimedBalance > 0 && (
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest">
                      <span className="text-white/40">Withdrawal fee</span>
                      <span className="text-[#FF2929]">
                        {feeRate}%{feePreview > 0 ? ` (−${feePreview.toFixed(4)} SOL)` : ''}
                        {' · '}
                        <span className="text-white/30">
                          {todayRaidCount < 3 ? `Play ${3 - todayRaidCount} more to remove` : 'No fee'}
                        </span>
                      </span>
                    </div>
                  )}
                  {feeRate === 0 && unclaimedBalance > 0 && (
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#FFB800]/60">
                      ✓ No fee — 3+ raids today
                    </p>
                  )}

                  {/* Cooldown info */}
                  {cooldownActive && (
                    <div className="bg-[#FF2929]/10 border border-[#FF2929]/30 p-3 text-center">
                      <p className="text-[10px] font-black uppercase tracking-widest text-[#FF2929]">
                        Claim locked — {cooldownH}h {cooldownM}m remaining
                      </p>
                      <p className="text-[9px] text-white/40 mt-1 uppercase tracking-wide">
                        Play any raid to unlock immediately
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="bg-black border-2 border-white/5 p-6 tech-border hover:border-yellow-500/20 transition-all">
                <p className="text-[9px] text-white/40 font-bold uppercase tracking-wide mb-1">Reputation</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl sm:text-3xl font-black mono text-yellow-500">{srPoints.toLocaleString()}</p>
                  <span className="text-xs font-black text-yellow-500/70">$SR</span>
                </div>
              </div>
              <div className="bg-black border-2 border-white/5 p-6 tech-border hover:border-purple-500/20 transition-all">
                <p className="text-[9px] text-white/40 font-bold uppercase tracking-wide mb-1">Inventory</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl sm:text-3xl font-black mono text-white">{ownedItemIds.length}</p>
                  <span className="text-xs font-bold text-purple-400/60">/ 24</span>
                </div>
              </div>
            </div>

            {/* Referral Protocol Card */}
            <div className="bg-[#050505] border-2 border-[#FF2929]/20 p-6 sm:p-8 tech-border relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-5 opacity-5 mono text-2xl sm:text-4xl font-black italic uppercase pointer-events-none group-hover:opacity-10 transition-opacity">
                [LINK]
              </div>
              <div className="relative z-10">
                <p className="text-[10px] text-[#FF2929]/60 font-bold uppercase tracking-wide mb-4">Referral</p>

                {/* Stats row */}
                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div className="bg-black/60 border border-white/5 p-3 text-center">
                    <p className="text-[9px] text-white/40 font-bold uppercase tracking-wide mb-1">Recruits</p>
                    <p className="text-2xl font-black mono text-white">{referralCount}</p>
                  </div>
                  <div className="bg-black/60 border border-white/5 p-3 text-center">
                    <p className="text-[9px] text-white/40 font-bold uppercase tracking-wide mb-1">SR earned</p>
                    <p className="text-2xl font-black mono text-yellow-500">{referralSREarned.toLocaleString()}</p>
                  </div>
                </div>

                <div className="flex flex-col space-y-4">
                  {/* Code display */}
                  <div className="bg-black border border-[#FF2929]/20 p-3 tech-border">
                    <p className="text-[9px] text-white/40 font-bold uppercase tracking-wide mb-1">Your code</p>
                    <p className="mono text-lg font-black text-[#FF2929] tracking-widest">{displayRefCode}</p>
                  </div>

                  {/* Link + copy */}
                  <div className="bg-black border border-white/10 p-4 tech-border flex flex-col sm:flex-row items-center justify-between gap-3">
                    <span className="mono text-xs text-white/70 truncate w-full sm:w-auto text-center sm:text-left">
                      {referralLink}
                    </span>
                    <button
                      onClick={handleCopyLink}
                      className={`w-full sm:w-auto px-6 py-2.5 font-bold uppercase tracking-tight text-xs tech-border transition-all whitespace-nowrap ${copied ? 'bg-[#FF2929] text-white border-[#FF2929]' : 'bg-white/5 text-[#FF2929] border-[#FF2929]/30 hover:bg-[#FF2929]/10'}`}
                    >
                      {copied ? 'Copied!' : 'Copy link'}
                    </button>
                  </div>

                  <div className="flex items-center gap-3 bg-[#FF2929]/5 border-l-2 border-[#FF2929] px-4 py-3">
                    <div className="w-2 h-2 bg-[#FF2929] animate-pulse shrink-0" />
                    <p className="text-[10px] font-bold text-white/60 leading-relaxed">
                      Earn <span className="text-yellow-500">+250 $SR</span> instantly when someone joins via your link
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Inventory Grid */}
            <div className="bg-black/40 border-2 border-white/5 p-6 sm:p-10 tech-border">
               <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-8">
                 <h3 className="text-[10px] font-bold uppercase tracking-wide text-white/50 leading-none">Inventory</h3>
                 <span className="text-[9px] font-bold text-white/30 hidden sm:block">Click to equip</span>
               </div>
              
              <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-6 gap-4 sm:gap-5">
                {ownedItemIds.map(id => {
                  const item = [...AVATAR_ITEMS, ...GEAR_ITEMS].find(i => i.id === id);
                  if (!item) return null;
                  const isAvatar = item.type === 'AVATAR';
                  const isEquipped = isAvatar ? equippedAvatarId === id : equippedGearIds.includes(id);
                  const equipColor = isAvatar ? 'border-[#FF2929]' : 'border-[#FFB800]';

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
                        <span className="text-[9px] font-black text-white/40">{item.type === 'GEAR' ? 'GR' : 'AV'}</span>
                      )}
                      
                      {!isEquipped && (
                        <div className={`absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity ${isAvatar ? 'bg-[#FF2929]/10' : 'bg-purple-500/10'}`}>
                          <span className={`text-[8px] font-black px-1.5 py-0.5 uppercase tracking-tighter ${isAvatar ? 'bg-[#FF2929] text-white' : 'bg-purple-500 text-white'}`}>
                            {isAvatar ? 'EQUIP' : 'ACTIVATE'}
                          </span>
                        </div>
                      )}

                      {isEquipped && (
                        <>
                          <div className={`absolute top-0 right-0 w-2 h-2 ${isAvatar ? 'bg-[#FF2929]' : 'bg-purple-500'}`} />
                          <div className={`absolute bottom-0 left-0 w-full h-0.5 opacity-80 ${isAvatar ? 'bg-[#FF2929]' : 'bg-purple-500'}`} />
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
            <div className="flex gap-1 flex-wrap">
              {(['RAIDS', 'ROUNDS', 'WITHDRAWALS'] as const).map(tab => {
                const unclaimedCount = tab === 'ROUNDS' ? roundWins.filter(w => !w.claimed).length : 0;
                return (
                  <button
                    key={tab}
                    onClick={() => setRightTab(tab)}
                    className={`px-4 py-2 text-[9px] font-bold uppercase tracking-wide transition-all tech-border flex items-center gap-1.5 ${rightTab === tab ? 'bg-white/10 text-white border-white/20' : 'text-white/40 border-white/5 hover:text-white/60'}`}
                  >
                    {tab === 'RAIDS' ? 'Raids' : tab === 'ROUNDS' ? 'Round Wins' : 'Withdrawals'}
                    {tab === 'WITHDRAWALS' && withdrawals.length > 0 && (
                      <span className="px-1 bg-[#FFB800] text-black text-[8px] rounded-sm">{withdrawals.length}</span>
                    )}
                    {tab === 'ROUNDS' && unclaimedCount > 0 && (
                      <span className="px-1 bg-[#FF2929] text-white text-[8px] rounded-sm animate-pulse">{unclaimedCount}</span>
                    )}
                  </button>
                );
              })}
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
                    <p className="text-white/40 font-bold text-xs">No missions yet</p>
                    <p className="text-white/20 text-[10px] mt-1">Deploy into a raid to begin your record.</p>
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
                          <span className={`text-xs font-black uppercase tracking-widest ${!h.success ? 'text-red-500' : 'text-[#FFB800]'}`}>
                            {resultLabel}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] mono text-white/40 font-black uppercase tracking-tighter italic">{date}</span>
                            <span className="text-[9px] text-white/20">|</span>
                            <span className="text-[9px] mono text-white/40 font-black uppercase tracking-tighter">{h.difficulty}</span>
                          </div>
                        </div>
                        <div className="text-right flex flex-col items-end gap-0.5">
                          <p className={`mono text-sm sm:text-base font-black ${!h.success ? 'text-red-500/50' : 'text-white'}`}>
                            {amountStr}
                          </p>
                          <span className="text-[9px] text-white/25 font-bold">
                            seed: {txShort}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* ── ROUND WINS ───────────────────────────────────── */}
            {rightTab === 'ROUNDS' && (
              <div className="space-y-3">
                {roundWinsLoading ? (
                  [...Array(3)].map((_, i) => (
                    <div key={i} className="bg-black border-2 border-white/5 p-5 tech-border animate-pulse">
                      <div className="h-4 bg-white/5 rounded w-3/4" />
                    </div>
                  ))
                ) : roundWins.length === 0 ? (
                  <div className="py-12 text-center space-y-2">
                    <div className="text-4xl mb-3">🏆</div>
                    <p className="text-white/40 font-bold text-xs">No round wins yet</p>
                    <p className="text-white/20 text-[10px] leading-relaxed">
                      Top 5 extractors in each 6-hour round share the pool.<br />
                      Raid hard to claim your place.
                    </p>
                  </div>
                ) : (
                  roundWins.map((w) => {
                    const { start, end } = getRoundBoundsFor(w.roundNum, w.roundDate);
                    const dateLabel = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).toUpperCase();
                    const claimKey = `${w.roundNum}:${w.roundDate}`;
                    const isClaiming = claimingRound === claimKey;
                    const medals = ['🥇', '🥈', '🥉', '4th', '5th'];
                    const rankColors = ['text-yellow-400', 'text-white/75', 'text-orange-400', 'text-white/50', 'text-white/40'];
                    const borderColors = ['border-yellow-500/40', 'border-white/15', 'border-orange-500/30', 'border-white/10', 'border-white/8'];
                    const glowColors = ['shadow-[0_0_20px_rgba(234,179,8,0.08)]', '', 'shadow-[0_0_15px_rgba(249,115,22,0.06)]', '', ''];

                    return (
                      <div
                        key={w.id}
                        className={`relative bg-black border-2 ${borderColors[w.rank - 1]} ${glowColors[w.rank - 1]} tech-border overflow-hidden`}
                      >
                        {/* Top accent bar */}
                        <div className={`h-0.5 w-full ${w.rank === 1 ? 'bg-yellow-400' : w.rank === 2 ? 'bg-white/30' : w.rank === 3 ? 'bg-orange-400' : 'bg-white/15'}`} />

                        <div className="p-4">
                          {/* Round header */}
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-lg leading-none">{w.rank <= 3 ? medals[w.rank - 1] : ''}</span>
                                <span className={`text-xs font-black uppercase tracking-tight ${rankColors[w.rank - 1]}`}>
                                  #{w.rank} · Round {w.roundNum}
                                </span>
                              </div>
                              <p className="text-[9px] font-bold text-white/40 uppercase tracking-wider">
                                {dateLabel} · {formatRoundWindow(w.roundNum)}
                              </p>
                            </div>
                            <div className="text-right shrink-0 ml-3">
                              {w.claimed ? (
                                <span className="text-[8px] font-black uppercase px-2 py-0.5 bg-white/5 border border-white/15 text-white/45">
                                  Claimed
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleClaimRoundWinLocal(w.roundNum, w.roundDate)}
                                  disabled={isClaiming}
                                  className="text-[9px] font-black uppercase px-3 py-1.5 bg-[#FF2929] text-white hover:bg-[#E60000] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {isClaiming ? 'Claiming…' : 'Claim'}
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Stats row */}
                          <div className="grid grid-cols-3 gap-2 bg-white/3 border border-white/5 p-2.5">
                            <div>
                              <p className="text-[8px] text-white/40 font-bold uppercase mb-0.5">Score</p>
                              <p className="text-sm font-black mono text-white">{w.pointsScored.toLocaleString()}</p>
                              <p className="text-[8px] text-white/35 font-bold">pts</p>
                            </div>
                            <div className="border-x border-white/5 px-2">
                              <p className="text-[8px] text-white/40 font-bold uppercase mb-0.5">Pool</p>
                              <p className="text-sm font-black mono text-white">{w.poolSol.toFixed(3)}</p>
                              <p className="text-[8px] text-[#FFB800] font-bold">SOL</p>
                            </div>
                            <div>
                              <p className="text-[8px] text-white/40 font-bold uppercase mb-0.5">Allocated</p>
                              <p className="text-sm font-black mono text-yellow-400">{w.solAllocation.toFixed(4)}</p>
                              <p className="text-[8px] text-yellow-400/60 font-bold">SOL</p>
                            </div>
                          </div>

                          {w.claimed && w.claimedAt && (
                            <p className="text-[8px] text-white/25 font-bold mt-1.5 text-right">
                              Claimed {new Date(w.claimedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          )}
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
                    <p className="text-white/40 font-bold text-xs">No withdrawals yet</p>
                    <p className="text-white/20 text-[10px] mt-1">Withdraw your unclaimed SOL to see records here.</p>
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
                        className="bg-black border-2 border-[#FFB800]/10 p-4 sm:p-5 tech-border hover:border-[#FFB800]/20 transition-colors group"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex flex-col gap-1 min-w-0">
                            <span className="text-xs font-bold text-[#FFB800]">Withdrawn</span>
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] mono text-white/40 font-black italic">{date} {time}</span>
                              <span className={`text-[8px] font-black uppercase px-1 py-0.5 ${w.status === 'CONFIRMED' ? 'bg-[#FFB800]/10 text-[#FFB800]' : 'bg-yellow-500/10 text-yellow-500'}`}>
                                {w.status}
                              </span>
                            </div>
                            {sig ? (
                              <a
                                href={solscanTx(sig)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-[9px] font-black text-white/35 hover:text-white/65 uppercase tracking-wider group/link"
                              >
                                <span className="mono">{sigShort}</span>
                                <ExternalLink size={9} className="shrink-0" />
                              </a>
                            ) : (
                              <span className="text-[9px] font-black text-white/40 uppercase tracking-wider">{sigShort}</span>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="mono text-base sm:text-lg font-black text-white">
                              +{Number(w.amount_sol).toFixed(4)}
                            </p>
                            <p className="text-[9px] text-[#FFB800]/60 font-black uppercase">SOL</p>
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
