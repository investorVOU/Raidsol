import React from 'react';

const BN:   React.CSSProperties = { fontFamily: "'Bebas Neue', sans-serif" };
const SG:   React.CSSProperties = { fontFamily: "'Space Grotesk', sans-serif" };
const MONO: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" };

interface FreeResultScreenProps {
  success: boolean;
  points: number;
  peakMult?: number;
  onPlayAgain: () => void;
  onPlayForReal: () => void;
}

const TIPS_WIN = [
  'In a real raid, that score goes live on the round leaderboard instantly.',
  'Equip Risk Reduction gear from the Store to extend your safe window.',
  'The longer you hold, the higher the multiplier — but risk climbs with it.',
];
const TIPS_BUST = [
  'Extract a few seconds earlier and those points would have locked in.',
  'Use Defend to knock risk down when it spikes fast.',
  "Watch for the golden window — that's your moment to lock in a bonus.",
];

const FreeResultScreen: React.FC<FreeResultScreenProps> = ({
  success, points, peakMult, onPlayAgain, onPlayForReal,
}) => {
  const tip = (success ? TIPS_WIN : TIPS_BUST)[Math.floor(Date.now() / 10000) % 3];

  const rating =
    points >= 3000 ? { label: 'Elite',   color: '#FFB800', nextLabel: null,              bar: 100 }
  : points >= 1500 ? { label: 'Solid',   color: '#14F195', nextLabel: 'Elite at 3,000',  bar: Math.round(((points - 1500) / 1500) * 100) }
  : points >= 500  ? { label: 'Good',    color: '#9945FF', nextLabel: 'Solid at 1,500',  bar: Math.round(((points - 500)  / 1000) * 100) }
  :                  { label: 'Starter', color: 'rgba(255,255,255,0.38)', nextLabel: 'Good at 500', bar: Math.round((points / 500) * 100) };

  // Estimated SOL based on medium difficulty (0.07 SOL max at 5,000 pts)
  const grossSol  = (points / 5000) * 0.07;
  const netSol    = grossSol - 0.026;
  const inProfit  = netSol > 0;

  return (
    <div className="h-full flex flex-col" style={{ ...SG, background: 'var(--app-bg)' }}>

      {/* gradient bar */}
      <div className="shrink-0 h-[3px] w-full"
        style={{ background: 'linear-gradient(90deg, #9945FF 0%, #14F195 100%)' }} />

      {/* ── SCROLLABLE BODY ── */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">

        {/* HERO */}
        <div className="relative flex flex-col items-center px-5 pt-8 pb-5 text-center overflow-hidden">

          {/* atmospheric glow */}
          <div className="absolute inset-0 pointer-events-none" style={{
            background: success
              ? 'radial-gradient(ellipse 110% 55% at 50% 0%, rgba(20,241,149,0.11) 0%, transparent 70%)'
              : 'radial-gradient(ellipse 110% 55% at 50% 0%, rgba(153,69,255,0.13) 0%, transparent 70%)',
          }} />

          {/* demo pill */}
          <div className="relative mb-5 inline-flex items-center gap-2 px-3 py-1 rounded-full"
            style={{ background: 'rgba(20,241,149,0.07)', border: '1px solid rgba(20,241,149,0.20)' }}>
            <div className="w-1.5 h-1.5 rounded-full bg-[#14F195] animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#14F195]">Free Demo</span>
          </div>

          {/* outcome */}
          <p className="text-[42px] leading-none mb-2">{success ? '🎉' : '💥'}</p>
          <h1 className="leading-none mb-2" style={{
            ...BN,
            fontSize: 'clamp(50px, 14vw, 78px)',
            letterSpacing: '3px',
            color: success ? '#ffffff' : '#9945FF',
            textShadow: success
              ? '0 0 40px rgba(20,241,149,0.20)'
              : '0 0 40px rgba(153,69,255,0.30)',
          }}>
            {success ? 'Extracted!' : 'Got Busted'}
          </h1>
          <p className="text-[13px] mb-6 max-w-[240px]" style={{ color: 'rgba(255,255,255,0.50)', lineHeight: 1.55 }}>
            {success
              ? 'You read the moment perfectly — that instinct is the whole game.'
              : "Risk maxed before you escaped. A few seconds earlier and you'd have nailed it."}
          </p>

          {/* ── SCORE CARD ── */}
          <div className="relative w-full max-w-[340px] rounded-2xl overflow-hidden" style={{
            background: 'rgba(255,255,255,0.025)',
            border: `1px solid ${success ? 'rgba(255,184,0,0.18)' : 'rgba(153,69,255,0.22)'}`,
          }}>
            <div className="h-[2px] w-full" style={{
              background: success
                ? 'linear-gradient(90deg, #FFB800 0%, transparent 80%)'
                : 'linear-gradient(90deg, #9945FF 0%, transparent 80%)',
            }} />

            <div className="px-5 pt-5 pb-4">
              <p className="text-[9px] font-bold uppercase tracking-[0.32em] mb-2"
                style={{ color: 'rgba(255,255,255,0.30)' }}>Demo score</p>

              {/* score + badge side by side */}
              <div className="flex items-end justify-between mb-3">
                <div className="flex items-end gap-2">
                  <span style={{
                    ...BN,
                    fontSize: 'clamp(54px, 17vw, 80px)',
                    lineHeight: 1,
                    color: success ? '#ffffff' : '#9945FF',
                    letterSpacing: '1px',
                  }}>
                    {points.toLocaleString()}
                  </span>
                  <span className="text-sm font-bold mb-1.5" style={{ color: 'rgba(255,255,255,0.28)' }}>pts</span>
                </div>

                <div className="flex flex-col items-end gap-1.5 mb-1">
                  <span className="text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full" style={{
                    background: `${rating.color}1a`,
                    border: `1px solid ${rating.color}55`,
                    color: rating.color,
                  }}>
                    {rating.label}
                  </span>
                  {peakMult != null && (
                    <span className="text-[11px] font-bold" style={{ color: '#FFB800', ...MONO }}>
                      {peakMult.toFixed(2)}× peak
                    </span>
                  )}
                </div>
              </div>

              {/* tier progress bar */}
              {rating.nextLabel && (
                <div className="mb-1">
                  <div className="w-full rounded-full overflow-hidden mb-1"
                    style={{ height: '3px', background: 'rgba(255,255,255,0.07)' }}>
                    <div className="h-full rounded-full" style={{ width: `${rating.bar}%`, background: rating.color }} />
                  </div>
                  <p className="text-[9px] text-left" style={{ color: 'rgba(255,255,255,0.28)' }}>
                    {rating.nextLabel} pts to unlock next tier
                  </p>
                </div>
              )}
            </div>

            {/* disclaimer footer */}
            <div className="px-5 py-2.5 flex items-center gap-2"
              style={{ borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.18)' }}>
              <span className="text-[11px]">🔒</span>
              <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.28)' }}>
                Simulation only · no SOL charged or earned
              </p>
            </div>
          </div>
        </div>

        {/* ── REAL RAID PROJECTION ── */}
        <div className="mx-5 mb-4 rounded-2xl overflow-hidden" style={{
          background: 'linear-gradient(155deg, rgba(153,69,255,0.09) 0%, rgba(20,241,149,0.04) 100%)',
          border: '1px solid rgba(153,69,255,0.18)',
        }}>
          <div className="px-5 pt-4 pb-4">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-[15px]">⚡</span>
              <p className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: '#14F195' }}>
                If this were a real raid
              </p>
            </div>

            {/* gross win */}
            <div className="flex items-center justify-between mb-2">
              <p className="text-[13px]" style={{ color: 'rgba(255,255,255,0.50)' }}>Estimated win</p>
              <p className="text-[18px] font-black text-white" style={{ ...MONO }}>
                ~{grossSol.toFixed(3)} SOL
              </p>
            </div>

            {/* entry */}
            <div className="flex items-center justify-between mb-3 pb-3"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-[13px]" style={{ color: 'rgba(255,255,255,0.50)' }}>Entry fee</p>
              <p className="text-[13px] font-bold text-white" style={{ ...MONO }}>0.026 SOL</p>
            </div>

            {/* net */}
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-bold" style={{ color: inProfit ? '#14F195' : 'rgba(255,255,255,0.50)' }}>
                {inProfit ? 'Net profit' : 'Net result'}
              </p>
              <p className="text-[16px] font-black" style={{ color: inProfit ? '#14F195' : '#9945FF', ...MONO }}>
                {inProfit ? '+' : ''}{netSol.toFixed(3)} SOL
              </p>
            </div>
          </div>

          <div className="px-5 py-3"
            style={{ borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.18)' }}>
            <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.38)', lineHeight: 1.6 }}>
              Top 5 players split the prize pool each round. Your score goes live the moment you extract.
            </p>
          </div>
        </div>

        {/* ── TIP ── */}
        <div className="mx-5 mb-6 rounded-xl px-4 py-3"
          style={{ background: 'rgba(153,69,255,0.05)', border: '1px solid rgba(153,69,255,0.13)' }}>
          <div className="flex items-start gap-2.5">
            <span className="text-[13px] mt-0.5 shrink-0">💡</span>
            <p className="text-[12px] font-medium leading-relaxed text-white" style={{ opacity: 0.65 }}>
              {tip}
            </p>
          </div>
        </div>

      </div>{/* end scroll */}

      {/* ── STICKY FOOTER ── */}
      <div className="shrink-0 px-5 pt-3 pb-7 space-y-2.5"
        style={{ borderTop: '1px solid rgba(255,255,255,0.05)', background: 'var(--app-bg)' }}>

        <button
          onClick={onPlayForReal}
          className="w-full py-4 rounded-2xl active:scale-[0.98] transition-transform"
          style={{
            background: 'linear-gradient(135deg, #7733cc 0%, #3d0099 100%)',
            boxShadow: '0 4px 30px rgba(153,69,255,0.42)',
          }}>
          <p className="font-black text-white" style={{ ...BN, fontSize: '22px', letterSpacing: '2.5px' }}>
            Raid for Real
          </p>
          <p className="text-[11px] font-semibold mt-0.5" style={{ color: 'rgba(255,255,255,0.58)' }}>
            0.026 SOL entry · real prizes · live leaderboard
          </p>
        </button>

        <button
          onClick={onPlayAgain}
          className="w-full py-3 rounded-2xl text-[12px] font-bold uppercase tracking-widest active:scale-[0.98] transition-transform"
          style={{
            background: 'rgba(255,255,255,0.035)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: 'rgba(255,255,255,0.45)',
          }}>
          Practice Again
        </button>

      </div>
    </div>
  );
};

export default FreeResultScreen;
