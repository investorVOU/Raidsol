
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RaidEvent, LootDrop } from '../types';
import type { CurrentRoundInfo } from '../hooks/useRoundData';
import { formatCountdown } from '../hooks/useRoundData';

interface ResultScreenProps {
  result: {
    success: boolean;
    solAmount: number;
    points: number;
    srEarned: number;
    raidId: string;
    serverSeedHash: string;
    userWallet: string;
    txSignature: string;
    peakMult?: number;
    nearWinCount?: number;
    dailyStreak?: number;
    bankedYield?: number;
    lootDrops?: LootDrop[];
  };
  entryFee: number;
  raidEvents?: RaidEvent[];
  onPlayAgain: () => void;
  onRedeploy?: () => void;
  onClaim: () => void;
  isRoundEntry?: boolean;
  roundInfo?: CurrentRoundInfo | null;
  equippedGearCount?: number;
  onNavigateStore?: () => void;
}

const SEVERITY_STYLES: Record<RaidEvent['severity'], { border: string; dot: string; text: string; badge: string }> = {
  danger:  { border: 'border-red-500/30',    dot: 'bg-red-500',    text: 'text-red-400',    badge: 'bg-red-500/10 text-red-400' },
  warning: { border: 'border-orange-500/30', dot: 'bg-orange-400', text: 'text-orange-400', badge: 'bg-orange-500/10 text-orange-400' },
  bonus:   { border: 'border-amber-500/30',  dot: 'bg-[#FFB800]',  text: 'text-[#FFB800]',  badge: 'bg-amber-500/10 text-[#FFB800]' },
  info:    { border: 'border-white/10',      dot: 'bg-white/40',   text: 'text-white/70',   badge: 'bg-white/5 text-white/60' },
};

const TYPE_LABELS: Record<string, string> = {
  NETWORK_SURGE:     'SURGE',
  AMBUSH:            'AMBUSH',
  JACKPOT:           'JACKPOT',
  FIREWALL:          'FIREWALL',
  GOLDEN_WINDOW:     'GOLDEN',
  GOLDEN_EXPIRED:    'MISSED',
  SHIELD_OVERLOAD:   'SHIELD',
  COMBO:             'COMBO',
  COUNTER:           'COUNTER',
  AGGRESSION:        'RAGE',
  CRITICAL:          'CRITICAL',
  BUST:              'BUST',
  CASHOUT:           'EXTRACT',
  PHASE_TRANSITION:  'PHASE',
  CHECKPOINT:        'BANKED',
  EVENT_CARD:        'EVENT',
  INTEL:             'INTEL',
  SKILL_CHECK:       'BREACH',
};

const ROUND_ALLOCATION = [0.40, 0.25, 0.18, 0.11, 0.06];
const ROUND_PCT_LABELS  = ['40%', '25%', '18%', '11%', '6%'];

const ResultScreen: React.FC<ResultScreenProps> = ({ result, entryFee, raidEvents, onPlayAgain, onRedeploy, onClaim, isRoundEntry, roundInfo, equippedGearCount = 0, onNavigateStore }) => {
  const { t } = useTranslation();
  const [debriefOpen, setDebriefOpen] = useState(true);

  const handleShareToX = () => {
    const text = isRoundEntry
      ? `scored ${result.points.toLocaleString()} pts in round ${roundInfo?.roundNum ?? '?'} on @solraid_app\n\npeak mult: ${result.peakMult != null ? result.peakMult.toFixed(2) + 'x' : '--'}\n\n#Solana #SolRaid`
      : `just extracted ${result.solAmount.toFixed(4)} SOL on @solraid_app\n\npeak mult: ${result.peakMult != null ? result.peakMult.toFixed(2) + 'x' : '--'} · score: ${result.points.toLocaleString()}\n\n#Solana #SolRaid`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent('https://solraid.app')}`;
    window.open(url, '_blank');
  };

  const handleDownloadCard = () => {
    const W = 1200, H = 630;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d')!;

    const accent  = result.success ? '#FFB800' : '#EF4444';
    const accentD = result.success ? '#b88000' : '#b91c1c'; // darker shade

    // ── Background ──────────────────────────────────────────────────────────
    ctx.fillStyle = '#030303';
    ctx.fillRect(0, 0, W, H);

    // Subtle grid
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y <= H; y += 80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    // Left accent bar
    const barW = 8;
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, barW, H);

    // Top accent strip
    ctx.fillStyle = accentD;
    ctx.fillRect(barW, 0, W - barW, 3);

    // Bottom strip
    ctx.fillStyle = accent;
    ctx.fillRect(barW, H - 3, W - barW, 3);

    // ── SOLRAID brand (top-left) ─────────────────────────────────────────
    ctx.fillStyle = accent;
    ctx.font = 'bold 14px monospace';
    ctx.fillText('[ SOL_RAID ]', barW + 40, 46);

    // Website (top-right)
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '13px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('solraid.app', W - 40, 46);
    ctx.textAlign = 'left';

    // ── Status badge ────────────────────────────────────────────────────
    const badge = result.success ? '✓  EXTRACTED' : '✗  BUSTED';
    ctx.fillStyle = `${accent}22`;
    ctx.fillRect(barW + 40, 70, result.success ? 300 : 220, 52);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(barW + 40, 70, result.success ? 300 : 220, 52);
    ctx.fillStyle = accent;
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText(badge, barW + 60, 106);

    // Wallet address
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.font = '13px monospace';
    ctx.fillText(result.userWallet || '—', barW + 40, 155);

    // ── Main SOL figure ─────────────────────────────────────────────────
    if (result.success) {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 92px monospace';
      ctx.fillText(`+${result.solAmount.toFixed(4)}`, barW + 40, 310);
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.font = 'bold 22px monospace';
      ctx.fillText('SOL HARVESTED', barW + 40, 348);
    } else {
      ctx.fillStyle = '#EF4444';
      ctx.font = 'bold 92px monospace';
      ctx.fillText('BUSTED', barW + 40, 310);
      ctx.fillStyle = 'rgba(239,68,68,0.40)';
      ctx.font = 'bold 22px monospace';
      ctx.fillText('LINK COLLAPSED', barW + 40, 348);
    }

    // ── Stats row ───────────────────────────────────────────────────────
    const stats = [
      { label: 'PEAK_MULT',  value: result.peakMult != null ? `${result.peakMult.toFixed(2)}x` : '--' },
      { label: 'SCORE',      value: result.points.toLocaleString() },
      { label: 'SR_EARNED',  value: `+${result.srEarned}` },
      { label: 'RAID_ID',    value: result.raidId.slice(0, 14) },
    ];
    const cellW = 280, cellH = 108, cellY = 440, gutter = 14;
    const startX = barW + 40;

    stats.forEach((s, i) => {
      const cx = startX + i * (cellW + gutter);
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(cx, cellY, cellW, cellH);
      ctx.strokeStyle = `${accent}50`;
      ctx.lineWidth = 1;
      ctx.strokeRect(cx, cellY, cellW, cellH);

      ctx.fillStyle = `${accent}99`;
      ctx.font = 'bold 11px monospace';
      ctx.fillText(s.label, cx + 16, cellY + 26);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 34px monospace';
      ctx.fillText(s.value, cx + 16, cellY + 76);
    });

    // ── Watermark corner decoration ─────────────────────────────────────
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.font = 'bold 160px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('SR', W - 30, H - 20);
    ctx.textAlign = 'left';

    // ── Download ────────────────────────────────────────────────────────
    const a = document.createElement('a');
    a.download = `solraid-${result.success ? 'victory' : 'bust'}-${Date.now()}.png`;
    a.href = canvas.toDataURL('image/png');
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Keep max 10 most informative events (skip routine idle decays etc.)
  const debriefEvents = (raidEvents ?? [])
    .filter(e => e.type !== 'CASHOUT' || !result.success) // don't re-show cashout on win (already obvious)
    .slice(-10)
    .reverse();

  return (
    <div className="h-full flex flex-col p-6 animate-in zoom-in-95 duration-500 overflow-y-auto scrollbar-hide">
      <div className="flex-1 flex flex-col items-center justify-center py-6 sm:py-10">
        <div className={`mb-6 sm:mb-8 px-8 py-4 border-2 ${result.success ? 'bg-[#FFB800]/10 border-[#FFB800] text-[#FFB800]' : 'bg-red-500/10 border-red-500 text-red-500'} tech-border font-bold text-3xl sm:text-4xl uppercase tracking-wide`}>
          {result.success ? (isRoundEntry ? 'Scored' : 'Extracted') : 'Busted'}
        </div>

        <h2 className={`text-4xl sm:text-6xl font-black uppercase tracking-tight mb-3 leading-none text-center ${result.success ? 'text-white glitch-text' : 'text-red-500'}`}>
          {result.success ? (isRoundEntry ? 'Round Scored' : 'Mission Complete') : 'Raid Failed'}
        </h2>
        <p className="text-white/40 text-xs sm:text-sm font-bold mb-8 sm:mb-12 text-center">
          {result.success
            ? (isRoundEntry ? 'Score locked in · leaders updated after round ends.' : 'Operation complete · assets secured.')
            : 'Critical failure · entry fee lost.'}
        </p>

        <div className="w-full max-w-sm space-y-4">
          {/* Primary metric — SOL for normal raids, POINTS for round raids */}
          {isRoundEntry ? (
            <div className={`bg-black border-2 p-6 sm:p-8 tech-border relative overflow-hidden transition-colors ${result.success ? 'border-[#FF2929]/50' : 'border-red-500/40'}`}>
              <div className="absolute top-0 right-0 p-4 opacity-5 mono text-2xl font-black uppercase text-[#FF2929]">PTS</div>
              <p className="text-xs text-white/40 font-bold uppercase tracking-wide mb-3">Round score</p>
              <p className={`mono text-5xl sm:text-6xl font-black tracking-tight leading-none ${result.success ? 'text-white' : 'text-red-500/40'}`}>
                {result.success ? `+${result.points.toLocaleString()}` : '0'}
                <span className="text-sm sm:text-base font-normal opacity-30 ml-2">pts</span>
              </p>
              {result.success && result.peakMult != null && (
                <p className="text-xs text-[#FFB800]/60 font-bold mt-2">
                  Peak mult: {result.peakMult.toFixed(2)}x
                </p>
              )}
              {result.success && (
                <p className="text-[10px] text-white/30 font-bold mt-1">
                  SOL rewarded after round ends · claim from Profile
                </p>
              )}
            </div>
          ) : (
            <div className={`bg-black border-2 p-6 sm:p-8 tech-border relative overflow-hidden transition-colors ${result.success ? 'border-[#FFB800]/60' : 'border-red-500/40'}`}>
              <div className="absolute top-0 right-0 p-4 opacity-5 mono text-2xl font-black uppercase">SOL</div>
              <p className="text-xs text-white/40 font-bold uppercase tracking-wide mb-3">Harvest yield</p>
              <p className={`mono text-5xl sm:text-6xl font-black tracking-tight leading-none ${result.success ? 'text-white' : 'text-red-500/40'}`}>
                {result.success ? `+${result.solAmount.toFixed(4)}` : `-${entryFee.toFixed(3)}`}
                <span className="text-sm sm:text-base font-normal opacity-30 ml-2">SOL</span>
              </p>
              {result.success && result.peakMult != null && (
                <p className="text-xs text-[#FFB800]/60 font-bold mt-2">
                  Peak mult: {result.peakMult.toFixed(2)}x
                </p>
              )}
            </div>
          )}

          {/* SR Points */}
          <div className="bg-black border-2 border-yellow-500/20 p-6 sm:p-8 tech-border relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 mono text-2xl font-black text-yellow-500">$SR</div>
            <p className="text-xs text-yellow-500/40 font-bold uppercase tracking-wide mb-3">Reputation gain</p>
            <div className="flex items-baseline gap-2">
              <p className="mono text-5xl sm:text-6xl font-black tracking-tight leading-none text-yellow-500">+{result.srEarned}</p>
              <span className="text-sm sm:text-base font-black text-yellow-500/50">pts</span>
            </div>
            <div className="mt-4 flex gap-1">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-1.5 flex-1 bg-yellow-500/10 overflow-hidden">
                  <div className="h-full bg-yellow-500 animate-[shimmer_1s_infinite]" style={{ animationDelay: `${i * 0.2}s` }} />
                </div>
              ))}
            </div>
          </div>

          {/* ── BANKED YIELD (checkpoint SOL kept even on bust) ── */}
          {(result.bankedYield ?? 0) > 0 && (
            <div className="bg-black border-2 p-5 tech-border relative overflow-hidden" style={{ borderColor: 'rgba(255,184,0,0.50)' }}>
              <div className="absolute top-0 right-0 p-3 opacity-6 mono text-xl font-black text-[#FFB800]">BANK</div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#FFB800]" />
                <p className="text-xs font-bold uppercase tracking-wide text-[#FFB800]/70">Checkpoint Banked</p>
              </div>
              <div className="flex items-baseline gap-2">
                <p className="mono text-3xl font-black text-[#FFB800]">+{(result.bankedYield ?? 0).toFixed(4)}</p>
                <span className="text-sm font-bold text-[#FFB800]/50">SOL</span>
              </div>
              <p className="text-[9px] text-white/35 font-bold mt-1">Kept on bust · credited to unclaimed balance</p>
            </div>
          )}

          {/* ── LOOT DROPS ── */}
          {(result.lootDrops?.length ?? 0) > 0 && (
            <div className="bg-black border-2 border-white/10 p-5 tech-border">
              <p className="text-xs font-bold uppercase tracking-wide text-white/50 mb-3">Loot Collected</p>
              <div className="grid grid-cols-2 gap-3">
                {result.lootDrops!.filter(d => d.type === 'SKR_SHARD').map((d, i) => (
                  <div key={i} className="text-center p-3 rounded" style={{ background: 'rgba(255,184,0,0.08)', border: '1px solid rgba(255,184,0,0.25)' }}>
                    <p className="text-[8px] font-bold text-[#FFB800]/60 uppercase tracking-wider mb-1">SKR Shards</p>
                    <p className="mono text-2xl font-black text-[#FFB800]">{d.amount.toFixed(2)}</p>
                    <p className="text-[8px] text-white/30 mt-0.5">display-only</p>
                  </div>
                ))}
                {result.lootDrops!.filter(d => d.type === 'SR_BURST').map((d, i) => (
                  <div key={i} className="text-center p-3 rounded" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)' }}>
                    <p className="text-[8px] font-bold text-white/40 uppercase tracking-wider mb-1">SR Bonus</p>
                    <p className="mono text-2xl font-black text-white">+{Math.floor(d.amount)}</p>
                    <p className="text-[8px] text-white/30 mt-0.5">reputation pts</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── META-LOOP STATS (near-win + streak) ── */}
          {((result.nearWinCount ?? 0) > 0 || (result.dailyStreak ?? 0) >= 2) && (
            <div className="bg-black border-2 border-white/10 p-4 tech-border flex items-center justify-around gap-4">
              {(result.nearWinCount ?? 0) > 0 && (
                <div className="text-center">
                  <p className="text-[9px] font-bold text-white/40 uppercase tracking-wider mb-1">Near misses</p>
                  <p className="mono text-3xl font-black text-white">⚡ {result.nearWinCount}</p>
                  <p className="text-[8px] text-white/30 mt-0.5">Firewall saved you</p>
                </div>
              )}
              {(result.nearWinCount ?? 0) > 0 && (result.dailyStreak ?? 0) >= 2 && (
                <div className="w-px h-12 bg-white/10" />
              )}
              {(result.dailyStreak ?? 0) >= 2 && (
                <div className="text-center">
                  <p className="text-[9px] font-bold text-[#FFB800]/50 uppercase tracking-wider mb-1">Daily streak</p>
                  <p className="mono text-3xl font-black text-[#FFB800]">🔥 {result.dailyStreak}d</p>
                  <p className="text-[8px] text-[#FFB800]/40 mt-0.5">+{Math.min(14, (result.dailyStreak ?? 0) * 2)}% firewall bonus</p>
                </div>
              )}
            </div>
          )}

          {/* ── GEAR TIP ── */}
          {(() => {
            const gearCount = equippedGearCount;
            const isBust = !result.success;

            // Fully geared + won → no tip needed
            if (gearCount >= 4 && !isBust) return null;

            let title: string;
            let body: string;
            let borderCls: string;
            let titleCls: string;

            if (gearCount === 0) {
              title = 'No loadout detected';
              body = isBust
                ? 'Gear cuts drift, extends time and boosts your multiplier. Even one piece changes the raid.'
                : 'You won without gear — imagine the yield with a full loadout equipped.';
              borderCls = 'border-[#FFB800]/25';
              titleCls  = 'text-[#FFB800]';
            } else if (gearCount < 4) {
              const open = 4 - gearCount;
              title = `${gearCount}/4 gear slots loaded`;
              body = isBust
                ? `${open} slot${open > 1 ? 's' : ''} still open — fill them in the Market before your next raid.`
                : `${open} slot${open > 1 ? 's' : ''} still open. A full loadout would have pushed that yield higher.`;
              borderCls = 'border-white/12';
              titleCls  = 'text-white/70';
            } else {
              // 4 gear + bust
              title = 'Full loadout, still cracked';
              body  = 'A Raid Pass cuts entry 50% and adds a 10% win boost — pick one up in the Market.';
              borderCls = 'border-red-500/20';
              titleCls  = 'text-red-400/80';
            }

            return (
              <div
                onClick={onNavigateStore}
                className={`bg-black border p-4 tech-border flex items-start gap-3 ${borderCls} ${onNavigateStore ? 'cursor-pointer hover:bg-white/4 active:scale-[0.99] transition-all' : ''}`}
              >
                <i className={`fa-solid fa-microchip text-sm shrink-0 mt-0.5 ${titleCls}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-[11px] font-bold uppercase tracking-wide ${titleCls}`}>{title}</p>
                  <p className="text-[10px] text-white/40 mt-0.5 leading-relaxed">{body}</p>
                </div>
                {onNavigateStore && (
                  <span className={`text-[9px] font-bold uppercase shrink-0 whitespace-nowrap ${titleCls} opacity-70`}>
                    Market →
                  </span>
                )}
              </div>
            );
          })()}

          {/* ── ROUND STANDING ── */}
          {isRoundEntry && roundInfo && (() => {
            const myEntry = roundInfo.currentLeaders.find(e => e.walletAddress === result.userWallet);
            const roundClosed = roundInfo.timeRemainingMs <= 0;
            return (
              <div className="bg-black border-2 p-6 tech-border relative overflow-hidden" style={{ borderColor: 'rgba(255,41,41,0.40)' }}>
                <div className="absolute top-0 right-0 p-4 opacity-5 mono text-2xl font-black text-[#FF2929]">ROUND</div>

                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full animate-pulse bg-[#FF2929]" style={{ boxShadow: '0 0 6px rgba(255,41,41,0.7)' }} />
                    <h3 className="text-xs font-bold uppercase tracking-wide text-[#FF2929]">Round Standing</h3>
                  </div>
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,41,41,0.12)', color: '#FF2929', border: '1px solid rgba(255,41,41,0.30)' }}>
                    R{roundInfo.roundNum} / 4
                  </span>
                </div>

                {/* Player's score this raid */}
                <div className="mb-4">
                  <p className="text-[10px] text-white/40 font-bold uppercase tracking-wide mb-1">Your score</p>
                  <p className="mono text-4xl font-black text-white leading-none">
                    {result.success ? `+${result.points.toLocaleString()}` : '0'}
                    <span className="text-base font-normal text-white/30 ml-2">pts</span>
                  </p>
                </div>

                {/* Rank badge */}
                {result.success && myEntry ? (
                  <div className="rounded-lg p-4 mb-4" style={{ background: 'rgba(255,184,0,0.08)', border: '1px solid rgba(255,184,0,0.25)' }}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-black uppercase tracking-wide text-[#FFB800]">
                        #{myEntry.rank} — {ROUND_PCT_LABELS[myEntry.rank - 1]} of pool
                      </p>
                      <span className="text-[10px] font-bold text-white/40">{myEntry.rank === 1 ? '🥇' : myEntry.rank === 2 ? '🥈' : myEntry.rank === 3 ? '🥉' : `#${myEntry.rank}`}</span>
                    </div>
                    <p className="text-[11px] text-white/50">
                      Est. allocation:{' '}
                      <span className="font-bold text-white/75">
                        {(roundInfo.poolSol * ROUND_ALLOCATION[myEntry.rank - 1]).toFixed(4)} SOL
                      </span>
                    </p>
                  </div>
                ) : result.success ? (
                  <div className="rounded-lg p-3 mb-4 bg-white/3 border border-white/8">
                    <p className="text-xs font-bold text-white/40">Not in top 5 yet — score more points to qualify</p>
                  </div>
                ) : (
                  <div className="rounded-lg p-3 mb-4" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)' }}>
                    <p className="text-xs font-bold text-red-400/60">Raid failed — no score recorded for this round</p>
                  </div>
                )}

                {/* Top 3 leaderboard preview */}
                {roundInfo.currentLeaders.length > 0 && (
                  <div className="space-y-1 mb-4">
                    <p className="text-[9px] text-white/25 uppercase tracking-wider font-bold mb-2">Current leaders</p>
                    {roundInfo.currentLeaders.slice(0, 3).map(e => (
                      <div key={e.rank} className="flex items-center justify-between py-1.5 border-b border-white/5">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] w-5 text-white/30 font-bold">#{e.rank}</span>
                          <span className="text-[10px] text-white/55 font-medium truncate max-w-[120px]">{e.username}</span>
                          {e.walletAddress === result.userWallet && (
                            <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-[#FF2929]/15 text-[#FF2929]">YOU</span>
                          )}
                        </div>
                        <span className="mono text-[10px] font-bold text-[#FFB800]">{e.pointsScored.toLocaleString()} pts</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Pool + countdown */}
                <div className="flex items-center justify-between py-2 border-t border-white/5">
                  <span className="text-[10px] text-white/35 uppercase tracking-wide font-bold">Prize pool</span>
                  <span className="mono text-sm font-black text-[#FFB800]">{roundInfo.poolSol.toFixed(4)} SOL</span>
                </div>
                <div className="flex items-center justify-between py-2 border-t border-white/5">
                  <span className="text-[10px] text-white/35 uppercase tracking-wide font-bold">
                    {roundClosed ? 'Round status' : 'Closes in'}
                  </span>
                  {roundClosed ? (
                    <span className="text-[10px] font-bold text-[#FF2929]">Closed — claim in Profile</span>
                  ) : (
                    <span className="mono text-xs font-bold text-white/70">{formatCountdown(roundInfo.timeRemainingMs)}</span>
                  )}
                </div>

                {roundClosed && (
                  <div className="mt-3 text-center py-2 rounded-lg" style={{ background: 'rgba(255,41,41,0.06)', border: '1px solid rgba(255,41,41,0.18)' }}>
                    <p className="text-[10px] font-bold text-[#FF2929]/80">Go to Profile → Round Wins to claim your allocation</p>
                  </div>
                )}
              </div>
            );
          })()}

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-black border-2 border-white/5 p-4 sm:p-6 tech-border">
              <p className="text-[10px] sm:text-xs text-white/40 font-bold uppercase tracking-wide mb-1">Experience</p>
              <p className="mono text-2xl sm:text-3xl font-black">+{result.points.toLocaleString()}</p>
            </div>
            <div className="bg-black border-2 border-white/5 p-4 sm:p-6 tech-border">
              <p className="text-[10px] sm:text-xs text-white/40 font-bold uppercase tracking-wide mb-1">Rank power</p>
              <p className="mono text-2xl sm:text-3xl font-black text-cyan-400">+{Math.floor(result.points / 120)}</p>
            </div>
          </div>

          {/* ── RAID DEBRIEF ─────────────────────────────────────────── */}
          {debriefEvents.length > 0 && (
            <div className="bg-black border-2 border-white/8 tech-border overflow-hidden">
              <button
                onClick={() => setDebriefOpen(p => !p)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/3 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${result.success ? 'bg-[#FFB800]' : 'bg-red-500'}`} />
                  <span className="text-xs font-bold text-white/60">Raid debrief</span>
                  <span className="text-[9px] font-bold text-white/30">
                    {debriefEvents.length} event{debriefEvents.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <span className="text-white/40 text-sm">{debriefOpen ? '▲' : '▼'}</span>
              </button>

              {debriefOpen && (
                <div className="border-t border-white/5 divide-y divide-white/5">
                  {debriefEvents.map((ev, i) => {
                    const s = SEVERITY_STYLES[ev.severity];
                    const label = TYPE_LABELS[ev.type] ?? ev.type;
                    return (
                      <div key={i} className={`flex gap-3 px-4 py-3 border-l-2 ${s.border}`}>
                        <div className="flex flex-col items-center shrink-0 pt-0.5">
                          <div className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                          <span className="text-[8px] font-bold text-white/40 mono mt-1">{ev.tick}s</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`text-[8px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-sm ${s.badge}`}>{label}</span>
                            <span className={`text-[9px] font-bold ${s.text}`}>{ev.impact}</span>
                          </div>
                          <p className="text-[9px] text-white/60 font-bold leading-tight">{ev.reason}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Verifiable Proof */}
          <div className="mt-8 p-6 bg-black border-2 border-white/5 tech-border">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
              <h3 className="text-xs font-bold uppercase tracking-wide text-cyan-400">Verifiable proof</h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center pb-2 border-b border-white/5">
                <span className="text-[10px] font-bold text-white/40 uppercase tracking-wide">Raid ID</span>
                <span className="mono text-xs text-white/75">{result.raidId}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-white/5">
                <span className="text-[10px] font-bold text-white/40 uppercase tracking-wide">Server hash</span>
                <span className="mono text-xs text-white/75 truncate w-32 text-right">{result.serverSeedHash}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-white/5">
                <span className="text-[10px] font-bold text-white/40 uppercase tracking-wide">Wallet</span>
                <span className="mono text-xs text-white/75">{result.userWallet}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-white/40 uppercase tracking-wide">TX sig</span>
                <a
                  href={`https://solscan.io/tx/${result.txSignature}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mono text-xs text-cyan-400 underline hover:text-cyan-300 truncate w-32 text-right"
                >
                  {result.txSignature.substring(0, 16)}...
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="py-6 sm:py-8 space-y-3 shrink-0">
        {/* Round raid success: no instant harvest — scores tallied after round ends */}
        {isRoundEntry && result.success && (
          <div className="p-4 border border-[#FF2929]/20 bg-[#FF2929]/5 tech-border text-center">
            <p className="text-[11px] font-bold text-white/60">
              Winnings paid out after round ends · go to{' '}
              <span className="text-[#FF2929]">Profile → Round Wins</span> to claim
            </p>
          </div>
        )}

        {/* Normal raid success: instant collect harvest */}
        {!isRoundEntry && result.success && (
          <>
            <button
              onClick={onClaim}
              className="w-full bg-[#FF2929] text-white py-4 sm:py-5 tech-border font-bold uppercase tracking-tight text-lg sm:text-xl shadow-[0_0_30px_rgba(255,41,41,0.35)] active:scale-95 transition-all hover:bg-[#CC0000]"
            >
              {t('result.collect')}
            </button>
          </>
        )}

        {/* Bust: retry */}
        {!result.success && (
          <button
            onClick={onRedeploy ?? onPlayAgain}
            className="w-full bg-red-600 text-white py-4 sm:py-5 tech-border font-bold uppercase tracking-tight text-lg sm:text-xl active:scale-95 transition-all shadow-[0_0_20px_rgba(239,68,68,0.2)]"
          >
            {onRedeploy ? t('result.redeploy') : t('result.backToLobby')}
          </button>
        )}

        {/* Share / save — shown on success */}
        {result.success && (
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleShareToX}
              className="bg-black border-2 border-white/20 text-white py-3 tech-border font-bold uppercase tracking-wide text-sm active:scale-95 transition-all hover:bg-white hover:text-black hover:border-white flex items-center justify-center gap-2"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 shrink-0">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              Post on X
            </button>
            <button
              onClick={handleDownloadCard}
              className="bg-black border-2 border-[#FFB800]/30 text-[#FFB800] py-3 tech-border font-bold uppercase tracking-wide text-sm active:scale-95 transition-all hover:bg-[#FFB800] hover:text-black flex items-center justify-center gap-2"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4 shrink-0">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Save card
            </button>
          </div>
        )}

        <button
          onClick={onPlayAgain}
          className="w-full bg-[#050505] text-white/50 hover:text-white py-3 sm:py-4 tech-border font-bold uppercase tracking-wide text-sm active:scale-95 transition-all border border-white/10"
        >
          Back to lobby
        </button>
      </div>
    </div>
  );
};

export default ResultScreen;
