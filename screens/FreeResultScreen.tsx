import React from 'react';

const BN:    React.CSSProperties = { fontFamily: "'Bebas Neue', sans-serif" };
const SG:    React.CSSProperties = { fontFamily: "'Space Grotesk', sans-serif" };
const MONO:  React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" };

interface FreeResultScreenProps {
  success: boolean;
  points: number;
  peakMult?: number;
  onPlayAgain: () => void;
  onPlayForReal: () => void;
}

const TIPS_WIN = [
  'You timed the extract perfectly — that instinct is exactly what separates winners.',
  'In a real raid, those points go live on the round leaderboard immediately.',
  'Equip Risk Reduction gear from the Store to give yourself more breathing room.',
];
const TIPS_BUST = [
  'You were close! Extract a few seconds earlier and those points would have counted.',
  'Use Defend to bring risk down when it starts climbing fast.',
  'Watch for the golden glow — that\'s your window to lock in a bonus.',
];

const FreeResultScreen: React.FC<FreeResultScreenProps> = ({
  success, points, peakMult, onPlayAgain, onPlayForReal,
}) => {
  const tip = (success ? TIPS_WIN : TIPS_BUST)[Math.floor(Date.now() / 10000) % 3];

  /* score rating based on points */
  const rating = points >= 3000 ? { label: 'Elite', color: '#FFB800' }
               : points >= 1500 ? { label: 'Solid',  color: '#14F195' }
               : points >= 500  ? { label: 'Good',   color: '#9945FF' }
               :                  { label: 'Starter', color: 'rgba(255,255,255,0.5)' };

  return (
    <div className="h-full flex flex-col overflow-y-auto scrollbar-hide" style={{ ...SG, background: 'var(--app-bg)' }}>

      {/* gradient top bar */}
      <div className="shrink-0 h-[3px] w-full" style={{ background: 'linear-gradient(90deg, #9945FF 0%, #14F195 100%)' }} />

      {/* ── HERO SECTION ── */}
      <div className="relative flex flex-col items-center px-6 pt-10 pb-6 text-center overflow-hidden">

        {/* Subtle radial bg glow */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: success
            ? 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(20,241,149,0.07) 0%, transparent 70%)'
            : 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(153,69,255,0.08) 0%, transparent 70%)',
        }} />

        {/* Demo label */}
        <div className="relative mb-5 flex items-center gap-2 px-4 py-1.5 rounded-full"
          style={{ background: 'rgba(20,241,149,0.08)', border: '1px solid rgba(20,241,149,0.22)' }}>
          <div className="w-1.5 h-1.5 rounded-full bg-[#14F195] animate-pulse" />
          <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#14F195]">Free Demo</span>
        </div>

        {/* Main outcome */}
        {success ? (
          <>
            <p className="text-5xl mb-1">🎉</p>
            <h1 className="text-white mb-1 leading-none"
              style={{ ...BN, fontSize: 'clamp(52px,13vw,80px)', letterSpacing: '3px',
                textShadow: '0 0 30px rgba(255,255,255,0.15)' }}>
              You extracted!
            </h1>
            <p className="text-[14px] font-medium mb-7 max-w-[260px]"
              style={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 }}>
              You got out at the right moment — that timing is the whole game.
            </p>
          </>
        ) : (
          <>
            <p className="text-5xl mb-1">💥</p>
            <h1 className="leading-none mb-1"
              style={{ ...BN, fontSize: 'clamp(52px,13vw,80px)', letterSpacing: '3px', color: '#9945FF' }}>
              Got busted
            </h1>
            <p className="text-[14px] font-medium mb-7 max-w-[260px]"
              style={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 }}>
              Risk hit 100% before you extracted — extract a bit earlier next time and you'll nail it.
            </p>
          </>
        )}

        {/* ── SCORE CARD ── */}
        <div className="relative w-full max-w-[300px] rounded-2xl overflow-hidden mb-5"
          style={{ background: '#0d0d22', border: `2px solid ${success ? 'rgba(255,184,0,0.25)' : 'rgba(153,69,255,0.25)'}` }}>

          {/* card top accent */}
          <div className="h-[2px] w-full" style={{
            background: success
              ? 'linear-gradient(90deg, #FFB800, rgba(255,184,0,0.2))'
              : 'linear-gradient(90deg, #9945FF, rgba(153,69,255,0.2))',
          }} />

          <div className="px-6 py-5">
            {/* Points */}
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] mb-1"
              style={{ color: 'rgba(255,255,255,0.45)' }}>Points scored</p>
            <div className="flex items-end gap-2 mb-3">
              <span className="font-black leading-none text-white"
                style={{ ...BN, fontSize: 'clamp(48px,14vw,72px)', letterSpacing: '1px',
                  color: success ? '#ffffff' : '#9945FF' }}>
                {points.toLocaleString()}
              </span>
              <span className="text-base font-bold mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>pts</span>
            </div>

            {/* Rating + peak mult row */}
            <div className="flex items-center justify-between pt-3"
              style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full"
                  style={{ background: `${rating.color}18`, border: `1px solid ${rating.color}44`, color: rating.color }}>
                  {rating.label}
                </span>
              </div>
              {peakMult != null && (
                <span className="text-[11px] font-bold" style={{ color: '#FFB800', ...MONO }}>
                  Peak {peakMult.toFixed(2)}×
                </span>
              )}
            </div>
          </div>

          {/* no real money note */}
          <div className="px-6 py-2.5 flex items-center gap-2"
            style={{ background: 'rgba(255,255,255,0.03)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <span style={{ fontSize: '11px' }}>ℹ️</span>
            <p className="text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.38)' }}>
              No SOL earned · no fees charged · simulation only
            </p>
          </div>
        </div>

        {/* ── TIP ── */}
        <div className="w-full max-w-[300px] rounded-xl px-4 py-3 text-left"
          style={{ background: 'rgba(153,69,255,0.06)', border: '1px solid rgba(153,69,255,0.16)' }}>
          <div className="flex items-center gap-1.5 mb-1">
            <span style={{ fontSize: '11px' }}>💡</span>
            <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: '#9945FF' }}>Quick tip</p>
          </div>
          <p className="text-[12px] font-medium leading-relaxed text-white" style={{ opacity: 0.75 }}>{tip}</p>
        </div>
      </div>

      {/* ── WHAT YOU'D WIN FOR REAL ── */}
      <div className="mx-6 mb-5 rounded-2xl overflow-hidden"
        style={{ background: 'linear-gradient(135deg, rgba(153,69,255,0.12), rgba(20,241,149,0.06))', border: '1px solid rgba(153,69,255,0.22)' }}>
        <div className="px-5 py-4">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] mb-3" style={{ color: '#14F195' }}>
            What you'd earn in a real raid
          </p>
          <div className="grid grid-cols-3 gap-3 mb-3">
            {[
              { label: 'Entry fee', value: '0.026 SOL' },
              { label: 'Top 1 prize', value: '40% pool' },
              { label: 'Your points', value: `${points.toLocaleString()} pts` },
            ].map(s => (
              <div key={s.label} className="text-center">
                <p className="text-[10px] font-black text-white mb-0.5" style={{ ...MONO }}>{s.value}</p>
                <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.4)' }}>{s.label}</p>
              </div>
            ))}
          </div>
          <p className="text-[11px] font-medium text-white" style={{ opacity: 0.55, lineHeight: 1.5 }}>
            Connect a wallet, pay the entry fee, and your score competes live on the round leaderboard. Top 5 split the prize pool.
          </p>
        </div>
      </div>

      {/* ── BUTTONS ── */}
      <div className="shrink-0 px-6 pb-8 space-y-3">
        <button
          onClick={onPlayForReal}
          className="w-full py-4 rounded-2xl active:scale-[0.98] transition-all relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #7733cc 0%, #3d0099 100%)',
            boxShadow: '0 4px 24px rgba(153,69,255,0.35)', color: '#fff' }}>
          <span className="relative z-10 font-black uppercase tracking-wider"
            style={{ ...BN, fontSize: '20px', letterSpacing: '2.5px' }}>
            Raid for Real
          </span>
          <span className="relative z-10 block text-[11px] font-bold mt-0.5"
            style={{ color: 'rgba(255,255,255,0.65)' }}>
            0.026 SOL entry · win real prizes
          </span>
        </button>

        <button
          onClick={onPlayAgain}
          className="w-full py-3.5 rounded-2xl font-bold text-sm uppercase tracking-wide active:scale-[0.98] transition-all"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.7)' }}>
          Practice Again
        </button>
      </div>

    </div>
  );
};

export default FreeResultScreen;
