import React, { useState } from 'react';
import { Bounty, Difficulty } from '../types';
import { useBounties } from '../hooks/useBounties';

interface BountyScreenProps {
  walletAddress: string | null;
  unclaimedSol: number;
  srPoints: number;
  onPostBounty: (
    difficulty: Difficulty,
    targetPoints: number,
    rewardType: 'SOL' | 'SR',
    rewardAmount: number,
    durationHours: number,
  ) => Promise<void>;
  onClaimBounty: (bountyId: string) => Promise<{ reward_type: string; reward_amount: number } | null>;
  onClaimSocialBounty: (actionType: string, twitterHandle?: string) => Promise<{ reward_sr: number } | null>;
  onBack: () => void;
}

const DIFF_COLORS: Record<string, string> = {
  EASY:   'text-green-400 border-green-500/40 bg-green-500/10',
  MEDIUM: 'text-cyan-400  border-cyan-500/40  bg-cyan-500/10',
  HARD:   'text-orange-400 border-orange-500/40 bg-orange-500/10',
  DEGEN:  'text-red-400   border-red-500/40   bg-red-500/10',
};

function timeLeft(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// ── Hardcoded daily challenges ─────────────────────────────────────────────────
const DAILY_CHALLENGES = [
  { actionType: 'CHALLENGE_EASY',   difficulty: 'EASY',   minPoints: 800,  rewardSR: 120  },
  { actionType: 'CHALLENGE_MEDIUM', difficulty: 'MEDIUM', minPoints: 1800, rewardSR: 250  },
  { actionType: 'CHALLENGE_HARD',   difficulty: 'HARD',   minPoints: 3000, rewardSR: 500  },
  { actionType: 'CHALLENGE_DEGEN',  difficulty: 'DEGEN',  minPoints: 4200, rewardSR: 1200 },
];

// ── Social tasks ───────────────────────────────────────────────────────────────
const SOCIAL_TASKS = [
  {
    actionType: 'FOLLOW',
    icon: 'fa-brands fa-x-twitter',
    label: 'Follow @solraid_app',
    sub: 'Follow the official X account',
    rewardSR: 300,
    needsHandle: true,
    verifiable: false,
  },
  {
    actionType: 'RETWEET',
    icon: 'fa-solid fa-retweet',
    label: 'Retweet our pinned post',
    sub: 'RT the pinned post on @solraid_app',
    rewardSR: 150,
    needsHandle: true,
    verifiable: true,
  },
  {
    actionType: 'LIKE',
    icon: 'fa-solid fa-heart',
    label: 'Like our pinned post',
    sub: 'Like the pinned post on @solraid_app',
    rewardSR: 100,
    needsHandle: true,
    verifiable: false,
  },
];

// ── Post Bounty Modal ──────────────────────────────────────────────────────────
const PostBountyModal: React.FC<{
  unclaimedSol: number;
  srPoints: number;
  onPost: BountyScreenProps['onPostBounty'];
  onClose: () => void;
}> = ({ unclaimedSol, srPoints, onPost, onClose }) => {
  const [difficulty,    setDifficulty]    = useState<Difficulty>(Difficulty.MEDIUM);
  const [targetPoints,  setTargetPoints]  = useState(2000);
  const [rewardType,    setRewardType]    = useState<'SOL' | 'SR'>('SOL');
  const [rewardAmount,  setRewardAmount]  = useState('');
  const [durationHours, setDurationHours] = useState(48);
  const [posting,       setPosting]       = useState(false);
  const [err,           setErr]           = useState<string | null>(null);

  const maxReward = rewardType === 'SOL' ? unclaimedSol : srPoints;

  const handleSubmit = async () => {
    const amount = parseFloat(rewardAmount);
    if (!amount || amount <= 0) { setErr('Enter a valid reward amount'); return; }
    if (amount > maxReward) { setErr(`Insufficient ${rewardType} balance`); return; }
    setErr(null);
    setPosting(true);
    try {
      await onPost(difficulty, targetPoints, rewardType, amount, durationHours);
      onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed to post bounty');
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-[#0d0d18] border border-white/10 rounded-2xl p-5 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between shrink-0">
          <span className="font-black text-white text-base uppercase tracking-wider">Post Bounty</span>
          <button onClick={onClose} className="text-white/40 hover:text-white text-xl leading-none">×</button>
        </div>

        {/* Difficulty */}
        <div>
          <p className="text-[10px] text-white/40 uppercase tracking-widest mb-1.5">Difficulty required</p>
          <div className="grid grid-cols-4 gap-1.5">
            {Object.values(Difficulty).map(d => (
              <button key={d}
                onClick={() => setDifficulty(d)}
                className={`py-1.5 rounded-lg text-[10px] font-black uppercase border transition-all ${difficulty === d ? DIFF_COLORS[d] : 'border-white/10 text-white/30'}`}>
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* Target points */}
        <div>
          <p className="text-[10px] text-white/40 uppercase tracking-widest mb-1.5">
            Min points to win — <span className="text-white/60">{targetPoints.toLocaleString()} pts</span>
          </p>
          <input type="range" min={100} max={5000} step={100}
            value={targetPoints} onChange={e => setTargetPoints(Number(e.target.value))}
            className="w-full accent-[#FF2929]" />
          <div className="flex justify-between text-[9px] text-white/30 mt-0.5">
            <span>100</span><span>5,000</span>
          </div>
        </div>

        {/* Reward type */}
        <div>
          <p className="text-[10px] text-white/40 uppercase tracking-widest mb-1.5">Reward currency</p>
          <div className="grid grid-cols-2 gap-2">
            {(['SOL', 'SR'] as const).map(t => (
              <button key={t} onClick={() => { setRewardType(t); setRewardAmount(''); }}
                className={`py-2 rounded-xl text-sm font-black uppercase border transition-all ${rewardType === t ? 'bg-[#FF2929]/20 border-[#FF2929]/60 text-[#FF2929]' : 'border-white/10 text-white/30'}`}>
                {t === 'SOL' ? '◎ SOL' : '⭐ SR'}
              </button>
            ))}
          </div>
          <p className="text-[9px] text-white/30 mt-1">
            Available: {rewardType === 'SOL' ? `${unclaimedSol.toFixed(4)} SOL (unclaimed)` : `${srPoints.toLocaleString()} SR`}
          </p>
        </div>

        {/* Reward amount */}
        <div>
          <p className="text-[10px] text-white/40 uppercase tracking-widest mb-1.5">Reward amount</p>
          <input type="number"
            value={rewardAmount}
            onChange={e => setRewardAmount(e.target.value)}
            placeholder={rewardType === 'SOL' ? '0.010' : '500'}
            step={rewardType === 'SOL' ? '0.001' : '50'}
            min={rewardType === 'SOL' ? '0.001' : '50'}
            max={maxReward}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm font-mono focus:outline-none focus:border-[#FF2929]/50"
          />
        </div>

        {/* Duration */}
        <div>
          <p className="text-[10px] text-white/40 uppercase tracking-widest mb-1.5">Expires in</p>
          <div className="grid grid-cols-3 gap-1.5">
            {[24, 48, 168].map(h => (
              <button key={h} onClick={() => setDurationHours(h)}
                className={`py-1.5 rounded-lg text-[10px] font-bold border transition-all ${durationHours === h ? 'bg-white/10 border-white/30 text-white' : 'border-white/10 text-white/30'}`}>
                {h === 168 ? '7 days' : `${h}h`}
              </button>
            ))}
          </div>
        </div>

        {err && <p className="text-[11px] text-red-400 font-bold">{err}</p>}

        <button onClick={handleSubmit} disabled={posting}
          className="w-full py-3 rounded-xl bg-[#FF2929] text-white font-black text-sm uppercase tracking-wider disabled:opacity-50 active:scale-95 transition-transform shrink-0">
          {posting ? 'Posting...' : 'Lock & Post Bounty'}
        </button>
      </div>
    </div>
  );
};

// ── Social Task Claim Modal ────────────────────────────────────────────────────
const SocialClaimModal: React.FC<{
  task: typeof SOCIAL_TASKS[0];
  onClaim: (handle: string) => Promise<void>;
  onClose: () => void;
}> = ({ task, onClaim, onClose }) => {
  const [handle,   setHandle]   = useState('');
  const [claiming, setClaiming] = useState(false);
  const [err,      setErr]      = useState<string | null>(null);

  const handleClaim = async () => {
    const h = handle.replace(/^@/, '').trim();
    if (!h) { setErr('Enter your X username'); return; }
    setErr(null);
    setClaiming(true);
    try {
      await onClaim(h);
      onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed to verify');
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-[#0d0d18] border border-white/10 rounded-2xl p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <i className={`${task.icon} text-white text-base`} />
            <span className="font-black text-white text-sm uppercase tracking-wider">{task.label}</span>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white text-xl leading-none">×</button>
        </div>

        <div className="bg-[#14F195]/10 border border-[#14F195]/20 rounded-xl px-3 py-2.5">
          <p className="text-[#14F195] text-sm font-black text-center">+{task.rewardSR.toLocaleString()} SR</p>
        </div>

        <div>
          <p className="text-[10px] text-white/40 uppercase tracking-widest mb-1.5">Your X / Twitter username</p>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm">@</span>
            <input
              value={handle}
              onChange={e => setHandle(e.target.value.replace(/^@/, ''))}
              placeholder="yourhandle"
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-7 pr-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#FF2929]/50"
            />
          </div>
          {task.verifiable && (
            <p className="text-[9px] text-white/30 mt-1.5">
              <i className="fa-solid fa-circle-check text-[#14F195] mr-1" />
              Retweet is verified via X API — make sure the action is completed first.
            </p>
          )}
          {!task.verifiable && (
            <p className="text-[9px] text-white/30 mt-1.5">
              Complete the action on X before claiming. Honour system — one-time per wallet.
            </p>
          )}
        </div>

        {err && <p className="text-[11px] text-red-400 font-bold">{err}</p>}

        <button onClick={handleClaim} disabled={claiming}
          className="w-full py-3 rounded-xl bg-[#FF2929] text-white font-black text-sm uppercase tracking-wider disabled:opacity-50 active:scale-95 transition-transform">
          {claiming ? 'Verifying...' : 'Claim SR Reward'}
        </button>
      </div>
    </div>
  );
};

// ── Bounty Card ────────────────────────────────────────────────────────────────
const BountyCard: React.FC<{
  bounty: Bounty;
  walletAddress: string | null;
  onClaim: (id: string) => void;
  claiming: string | null;
}> = ({ bounty, walletAddress, onClaim, claiming }) => {
  const isMine    = bounty.poster_wallet === walletAddress;
  const isClaimed = bounty.status === 'CLAIMED';
  const expired   = new Date(bounty.expires_at) < new Date();

  return (
    <div className={`rounded-xl border p-3.5 flex flex-col gap-2 ${isClaimed ? 'border-white/5 bg-white/[0.02] opacity-50' : 'border-white/10 bg-white/[0.03]'}`}>
      <div className="flex items-start justify-between gap-2">
        <span className={`text-[9px] font-black uppercase tracking-widest border rounded-full px-2 py-0.5 ${DIFF_COLORS[bounty.difficulty]}`}>
          {bounty.difficulty}
        </span>
        {isClaimed ? (
          <span className="text-[9px] font-bold text-white/30 uppercase">Claimed</span>
        ) : expired ? (
          <span className="text-[9px] font-bold text-white/30 uppercase">Expired</span>
        ) : (
          <span className="text-[9px] text-white/40">{timeLeft(bounty.expires_at)} left</span>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-black text-white leading-tight">Score {bounty.target_points.toLocaleString()}+ pts</p>
          <p className="text-[10px] text-white/40 mt-0.5">by {bounty.poster_username || bounty.poster_wallet.slice(0, 8)}</p>
        </div>
        <div className="text-right">
          <p className={`text-base font-black ${bounty.reward_type === 'SOL' ? 'text-[#FFB800]' : 'text-[#14F195]'}`}>
            {bounty.reward_type === 'SOL'
              ? `${Number(bounty.reward_amount).toFixed(4)} SOL`
              : `${Math.floor(bounty.reward_amount).toLocaleString()} SR`}
          </p>
          <p className="text-[9px] text-white/30">reward</p>
        </div>
      </div>

      {isClaimed && bounty.claimed_by_username && (
        <p className="text-[9px] text-white/40">Won by <span className="text-white/60 font-bold">{bounty.claimed_by_username}</span></p>
      )}

      {!isClaimed && !expired && !isMine && walletAddress && (
        <button onClick={() => onClaim(bounty.id)} disabled={claiming === bounty.id}
          className="w-full py-2 rounded-lg bg-[#FF2929]/90 text-white text-[11px] font-black uppercase tracking-wider active:scale-95 transition-all disabled:opacity-50">
          {claiming === bounty.id ? 'Claiming...' : 'Claim Reward'}
        </button>
      )}
      {!isClaimed && !expired && isMine && (
        <p className="text-[9px] text-white/30 text-center">Your bounty — waiting for a raider</p>
      )}
    </div>
  );
};

// ── Main Screen ────────────────────────────────────────────────────────────────
const BountyScreen: React.FC<BountyScreenProps> = ({
  walletAddress, unclaimedSol, srPoints, onPostBounty, onClaimBounty, onClaimSocialBounty, onBack,
}) => {
  const { openBounties, myBounties, claimedActions, loading, refresh } = useBounties(walletAddress);
  const [tab,          setTab]          = useState<'OPEN' | 'SOCIAL' | 'MINE'>('SOCIAL');
  const [showPost,     setShowPost]     = useState(false);
  const [socialModal,  setSocialModal]  = useState<typeof SOCIAL_TASKS[0] | null>(null);
  const [claiming,     setClaiming]     = useState<string | null>(null);
  const [claimResult,  setClaimResult]  = useState<string | null>(null);
  const [diffFilter,   setDiffFilter]   = useState<Difficulty | 'ALL'>('ALL');

  const showToast = (msg: string) => {
    setClaimResult(msg);
    setTimeout(() => setClaimResult(null), 4000);
  };

  const handleClaimBounty = async (bountyId: string) => {
    if (!walletAddress) return;
    setClaiming(bountyId);
    try {
      const result = await onClaimBounty(bountyId);
      if (result) {
        showToast(`+${result.reward_type === 'SOL'
          ? `${result.reward_amount.toFixed(4)} SOL`
          : `${Math.floor(result.reward_amount).toLocaleString()} SR`} claimed!`);
        refresh();
      }
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to claim bounty');
    } finally {
      setClaiming(null);
    }
  };

  const handleClaimChallenge = async (actionType: string) => {
    if (!walletAddress) return;
    setClaiming(actionType);
    try {
      const result = await onClaimSocialBounty(actionType);
      if (result) {
        showToast(`+${result.reward_sr.toLocaleString()} SR claimed!`);
        refresh();
      }
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Not qualified yet');
    } finally {
      setClaiming(null);
    }
  };

  const handleSocialClaim = async (actionType: string, handle: string) => {
    const result = await onClaimSocialBounty(actionType, handle);
    if (result) {
      showToast(`+${result.reward_sr.toLocaleString()} SR claimed!`);
      refresh();
    }
  };

  const filtered = openBounties.filter(b => diffFilter === 'ALL' || b.difficulty === diffFilter);

  return (
    <div className="flex flex-col h-full bg-[#07070f] text-white overflow-hidden">

      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 pt-4 pb-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-white/40 hover:text-white transition-colors">
            <i className="fa-solid fa-arrow-left text-sm" />
          </button>
          <div>
            <h1 className="text-base font-black uppercase tracking-wider text-white leading-tight">Bounty Board</h1>
            <p className="text-[10px] text-white/35">Raid targets · Social rewards · Post challenges</p>
          </div>
        </div>
        {walletAddress && tab === 'OPEN' && (
          <button onClick={() => setShowPost(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FF2929]/90 text-white text-[11px] font-black uppercase tracking-wider active:scale-95 transition-all">
            <i className="fa-solid fa-plus text-[10px]" />
            Post
          </button>
        )}
      </div>

      {/* Toast */}
      {claimResult && (
        <div className="shrink-0 mx-4 mt-3 px-4 py-2.5 rounded-xl bg-[#14F195]/15 border border-[#14F195]/30 flex items-center gap-2">
          <i className="fa-solid fa-check-circle text-[#14F195] text-sm" />
          <span className="text-[12px] font-black text-[#14F195]">{claimResult}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="shrink-0 flex gap-1 px-4 pt-3">
        {(['SOCIAL', 'OPEN', 'MINE'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all ${
              tab === t ? 'bg-[#FF2929]/20 text-[#FF2929] border border-[#FF2929]/40' : 'text-white/30 border border-transparent'
            }`}>
            {t === 'OPEN' ? `Board (${openBounties.length})` : t === 'SOCIAL' ? 'Tasks' : 'Mine'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-4">

        {/* ── SOCIAL TASKS TAB ── */}
        {tab === 'SOCIAL' && (
          <>
            {/* Daily score challenges */}
            <div>
              <p className="text-[9px] text-[#FFB800]/70 uppercase tracking-widest font-bold mb-2">
Score Challenges — one-time SR
              </p>
              <div className="flex flex-col gap-2">
                {DAILY_CHALLENGES.map(c => {
                  const done = claimedActions.includes(c.actionType);
                  return (
                    <div key={c.actionType}
                      className={`rounded-xl border p-3 flex items-center gap-3 ${done ? 'border-white/5 opacity-50' : 'border-[#FFB800]/20 bg-[#FFB800]/[0.04]'}`}>
                      <span className={`text-[9px] font-black uppercase tracking-widest border rounded-full px-2 py-0.5 shrink-0 ${DIFF_COLORS[c.difficulty]}`}>
                        {c.difficulty}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-white leading-tight">Score {c.minPoints.toLocaleString()}+ pts</p>
                        <p className="text-[10px] text-white/40">+{c.rewardSR} SR reward</p>
                      </div>
                      {done ? (
                        <span className="text-[10px] text-[#14F195] font-bold shrink-0">
                          <i className="fa-solid fa-check mr-1" />Done
                        </span>
                      ) : (
                        <button onClick={() => handleClaimChallenge(c.actionType)}
                          disabled={!walletAddress || claiming === c.actionType}
                          className="shrink-0 px-3 py-1.5 rounded-lg bg-[#FF2929]/90 text-white text-[10px] font-black uppercase disabled:opacity-40 active:scale-95 transition-all">
                          {claiming === c.actionType ? '...' : 'Claim'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* X / Twitter social tasks */}
            <div>
              <p className="text-[9px] text-white/40 uppercase tracking-widest font-bold mb-2">
                <i className="fa-brands fa-x-twitter mr-1" />X / Twitter — @solraid_app
              </p>
              <div className="flex flex-col gap-2">
                {SOCIAL_TASKS.map(task => {
                  const done = claimedActions.includes(task.actionType);
                  return (
                    <div key={task.actionType}
                      className={`rounded-xl border p-3 flex items-center gap-3 ${done ? 'border-white/5 opacity-50' : 'border-white/10 bg-white/[0.03]'}`}>
                      <div className="w-8 h-8 rounded-lg bg-white/8 flex items-center justify-center shrink-0">
                        <i className={`${task.icon} text-white text-sm`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-white leading-tight">{task.label}</p>
                        <p className="text-[10px] text-white/40">{task.sub} · +{task.rewardSR} SR</p>
                      </div>
                      {done ? (
                        <span className="text-[10px] text-[#14F195] font-bold shrink-0">
                          <i className="fa-solid fa-check mr-1" />Done
                        </span>
                      ) : (
                        <button onClick={() => setSocialModal(task)}
                          disabled={!walletAddress}
                          className="shrink-0 px-3 py-1.5 rounded-lg bg-[#FF2929]/90 text-white text-[10px] font-black uppercase disabled:opacity-40 active:scale-95 transition-all">
                          Claim
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-[9px] text-white/20 mt-2 text-center">
                Retweets verified via X API · Follow/Like honour system · One-time per wallet
              </p>
            </div>
          </>
        )}

        {/* ── OPEN BOUNTIES TAB ── */}
        {tab === 'OPEN' && (
          <>
            <div className="flex gap-1.5 flex-wrap">
              {(['ALL', ...Object.values(Difficulty)] as const).map(d => (
                <button key={d} onClick={() => setDiffFilter(d)}
                  className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase border transition-all ${
                    diffFilter === d
                      ? d === 'ALL' ? 'bg-white/15 border-white/30 text-white' : DIFF_COLORS[d]
                      : 'border-white/10 text-white/30'
                  }`}>
                  {d}
                </button>
              ))}
            </div>

            {loading ? (
              <p className="text-white/30 text-xs text-center py-8">Loading...</p>
            ) : filtered.length === 0 ? (
              <div className="text-center py-10">
                <i className="fa-solid fa-crosshairs text-white/10 text-3xl mb-3" />
                <p className="text-white/30 text-xs">No open bounties.</p>
                {walletAddress && (
                  <button onClick={() => setShowPost(true)} className="mt-3 text-[#FF2929] text-xs font-bold underline">
                    Post the first one
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {filtered.map(b => (
                  <BountyCard key={b.id} bounty={b} walletAddress={walletAddress}
                    onClaim={handleClaimBounty} claiming={claiming} />
                ))}
              </div>
            )}
          </>
        )}

        {/* ── MY BOUNTIES TAB ── */}
        {tab === 'MINE' && (
          <>
            {!walletAddress ? (
              <p className="text-white/30 text-xs text-center py-10">Connect wallet to view your bounties</p>
            ) : loading ? (
              <p className="text-white/30 text-xs text-center py-8">Loading...</p>
            ) : myBounties.length === 0 ? (
              <div className="text-center py-10">
                <i className="fa-solid fa-crosshairs text-white/10 text-3xl mb-3" />
                <p className="text-white/30 text-xs">No bounties posted or claimed yet.</p>
                <button onClick={() => { setTab('OPEN'); setShowPost(true); }}
                  className="mt-3 text-[#FF2929] text-xs font-bold underline">
                  Post a bounty
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {myBounties.map(b => (
                  <BountyCard key={b.id} bounty={b} walletAddress={walletAddress}
                    onClaim={handleClaimBounty} claiming={claiming} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {showPost && (
        <PostBountyModal
          unclaimedSol={unclaimedSol}
          srPoints={srPoints}
          onPost={onPostBounty}
          onClose={() => setShowPost(false)}
        />
      )}

      {socialModal && (
        <SocialClaimModal
          task={socialModal}
          onClaim={(handle) => handleSocialClaim(socialModal.actionType, handle)}
          onClose={() => setSocialModal(null)}
        />
      )}
    </div>
  );
};

export default BountyScreen;
