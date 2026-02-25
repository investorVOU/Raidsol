import React, { useState } from 'react';
import { Bounty, Difficulty, DIFFICULTY_CONFIG } from '../types';
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

// ── Preset daily SR challenges (platform-sponsored, hardcoded) ────────────────
const DAILY_CHALLENGES: Omit<Bounty, 'id' | 'poster_wallet' | 'poster_username' | 'claimed_by_wallet' | 'claimed_by_username' | 'claimed_raid_id' | 'claimed_at' | 'expires_at' | 'created_at'>[] = [
  { difficulty: Difficulty.EASY,   target_points: 800,  reward_type: 'SR', reward_amount: 120,  status: 'OPEN' },
  { difficulty: Difficulty.MEDIUM, target_points: 1800, reward_type: 'SR', reward_amount: 250,  status: 'OPEN' },
  { difficulty: Difficulty.HARD,   target_points: 3000, reward_type: 'SR', reward_amount: 500,  status: 'OPEN' },
  { difficulty: Difficulty.DEGEN,  target_points: 4200, reward_type: 'SR', reward_amount: 1200, status: 'OPEN' },
];

// ── Post Bounty Modal ─────────────────────────────────────────────────────────
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
      <div className="w-full max-w-sm bg-[#0d0d18] border border-white/10 rounded-2xl p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
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
            Min points to win <span className="text-white/60">(current: {targetPoints.toLocaleString()})</span>
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
          className="w-full py-3 rounded-xl bg-[#FF2929] text-white font-black text-sm uppercase tracking-wider disabled:opacity-50 active:scale-95 transition-transform">
          {posting ? 'Posting...' : `Lock & Post Bounty`}
        </button>
      </div>
    </div>
  );
};

// ── Bounty Card ───────────────────────────────────────────────────────────────
const BountyCard: React.FC<{
  bounty: Bounty;
  walletAddress: string | null;
  onClaim: (id: string) => void;
  claiming: string | null;
  isChallenge?: boolean;
}> = ({ bounty, walletAddress, onClaim, claiming, isChallenge }) => {
  const isMine   = bounty.poster_wallet === walletAddress;
  const isClaimed = bounty.status === 'CLAIMED';
  const expired  = new Date(bounty.expires_at) < new Date();

  return (
    <div className={`rounded-xl border p-3.5 flex flex-col gap-2 ${
      isClaimed ? 'border-white/5 bg-white/[0.02] opacity-60' :
      isChallenge ? 'border-[#FFB800]/20 bg-[#FFB800]/[0.04]' :
      'border-white/10 bg-white/[0.03]'
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {isChallenge && (
            <span className="text-[9px] font-black text-[#FFB800] uppercase tracking-widest border border-[#FFB800]/40 rounded-full px-2 py-0.5">
              Daily Challenge
            </span>
          )}
          <span className={`text-[9px] font-black uppercase tracking-widest border rounded-full px-2 py-0.5 ${DIFF_COLORS[bounty.difficulty]}`}>
            {bounty.difficulty}
          </span>
        </div>
        {isClaimed ? (
          <span className="text-[9px] font-bold text-white/30 uppercase">Claimed</span>
        ) : expired ? (
          <span className="text-[9px] font-bold text-white/30 uppercase">Expired</span>
        ) : !isChallenge && (
          <span className="text-[9px] text-white/40">{timeLeft(bounty.expires_at)} left</span>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-black text-white leading-tight">
            Score {bounty.target_points.toLocaleString()}+ pts
          </p>
          <p className="text-[10px] text-white/40 mt-0.5">
            {isChallenge ? 'Platform challenge' : `by ${bounty.poster_username || bounty.poster_wallet.slice(0, 8)}`}
          </p>
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
        <p className="text-[9px] text-white/40">
          Won by <span className="text-white/60 font-bold">{bounty.claimed_by_username}</span>
        </p>
      )}

      {!isClaimed && !expired && !isMine && walletAddress && (
        <button
          onClick={() => onClaim(bounty.id)}
          disabled={claiming === bounty.id}
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

// ── Main Screen ───────────────────────────────────────────────────────────────
const BountyScreen: React.FC<BountyScreenProps> = ({
  walletAddress, unclaimedSol, srPoints, onPostBounty, onClaimBounty, onBack,
}) => {
  const { openBounties, myBounties, loading, refresh } = useBounties(walletAddress);
  const [tab,          setTab]          = useState<'OPEN' | 'MINE'>('OPEN');
  const [showPost,     setShowPost]     = useState(false);
  const [claiming,     setClaiming]     = useState<string | null>(null);
  const [claimResult,  setClaimResult]  = useState<{ type: string; amount: number } | null>(null);
  const [diffFilter,   setDiffFilter]   = useState<Difficulty | 'ALL'>('ALL');

  const handleClaim = async (bountyId: string) => {
    if (!walletAddress) return;
    setClaiming(bountyId);
    try {
      const result = await onClaimBounty(bountyId);
      if (result) {
        setClaimResult({ type: result.reward_type, amount: result.reward_amount });
        refresh();
        setTimeout(() => setClaimResult(null), 4000);
      }
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to claim bounty');
    } finally {
      setClaiming(null);
    }
  };

  const filtered = openBounties.filter(b =>
    diffFilter === 'ALL' || b.difficulty === diffFilter
  );

  return (
    <div className="flex flex-col h-full bg-[#07070f] text-white overflow-hidden">

      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 pt-4 pb-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-white/40 hover:text-white transition-colors">
            <i className="fa-solid fa-arrow-left text-sm" />
          </button>
          <div>
            <h1 className="text-base font-black uppercase tracking-wider text-white leading-tight">
              Bounty Board
            </h1>
            <p className="text-[10px] text-white/35">Raid targets. Win rewards.</p>
          </div>
        </div>
        {walletAddress && (
          <button onClick={() => setShowPost(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FF2929]/90 text-white text-[11px] font-black uppercase tracking-wider active:scale-95 transition-all">
            <i className="fa-solid fa-plus text-[10px]" />
            Post
          </button>
        )}
      </div>

      {/* Claim success toast */}
      {claimResult && (
        <div className="shrink-0 mx-4 mt-3 px-4 py-2.5 rounded-xl bg-[#14F195]/15 border border-[#14F195]/30 flex items-center gap-2">
          <i className="fa-solid fa-check-circle text-[#14F195] text-sm" />
          <span className="text-[12px] font-black text-[#14F195]">
            Bounty claimed! +{claimResult.type === 'SOL'
              ? `${claimResult.amount.toFixed(4)} SOL`
              : `${Math.floor(claimResult.amount).toLocaleString()} SR`}
          </span>
        </div>
      )}

      {/* Tabs */}
      <div className="shrink-0 flex gap-1 px-4 pt-3">
        {(['OPEN', 'MINE'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all ${
              tab === t ? 'bg-[#FF2929]/20 text-[#FF2929] border border-[#FF2929]/40' : 'text-white/30 border border-transparent'
            }`}>
            {t === 'OPEN' ? `Open (${openBounties.length})` : 'Mine'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">

        {tab === 'OPEN' && (
          <>
            {/* Daily Challenges */}
            <div>
              <p className="text-[9px] text-[#FFB800]/70 uppercase tracking-widest font-bold mb-2">
                <i className="fa-solid fa-bolt mr-1" />Daily Challenges — SR Rewards
              </p>
              <div className="flex flex-col gap-2">
                {DAILY_CHALLENGES.map((c, i) => (
                  <BountyCard
                    key={`challenge-${i}`}
                    bounty={{
                      ...c,
                      id: `challenge-${i}`,
                      poster_wallet: 'platform',
                      poster_username: 'SolRaid',
                      expires_at: new Date(Date.now() + 86400000).toISOString(),
                      created_at: new Date().toISOString(),
                    } as Bounty}
                    walletAddress={walletAddress}
                    onClaim={() => {}}
                    claiming={null}
                    isChallenge
                  />
                ))}
              </div>
            </div>

            {/* Diff filter */}
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

            {/* User-posted bounties */}
            <div>
              <p className="text-[9px] text-white/40 uppercase tracking-widest font-bold mb-2">
                <i className="fa-solid fa-crosshairs mr-1" />Player Bounties
              </p>
              {loading ? (
                <p className="text-white/30 text-xs text-center py-8">Loading...</p>
              ) : filtered.length === 0 ? (
                <div className="text-center py-10">
                  <i className="fa-solid fa-crosshairs text-white/10 text-3xl mb-3" />
                  <p className="text-white/30 text-xs">No open bounties yet.</p>
                  {walletAddress && (
                    <button onClick={() => setShowPost(true)} className="mt-3 text-[#FF2929] text-xs font-bold underline">
                      Be the first to post one
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {filtered.map(b => (
                    <BountyCard key={b.id} bounty={b} walletAddress={walletAddress}
                      onClaim={handleClaim} claiming={claiming} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}

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
                <button onClick={() => setShowPost(true)} className="mt-3 text-[#FF2929] text-xs font-bold underline">
                  Post a bounty
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {myBounties.map(b => (
                  <BountyCard key={b.id} bounty={b} walletAddress={walletAddress}
                    onClaim={handleClaim} claiming={claiming} />
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
    </div>
  );
};

export default BountyScreen;
