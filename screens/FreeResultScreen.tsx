import React from 'react';

const BN: React.CSSProperties = { fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '2px' };
const INTER: React.CSSProperties = { fontFamily: "'Inter', system-ui, sans-serif" };

interface FreeResultScreenProps {
  success: boolean;
  points: number;
  peakMult?: number;
  onPlayAgain: () => void;   // retry demo
  onPlayForReal: () => void; // go to lobby to connect + pay
}

const FreeResultScreen: React.FC<FreeResultScreenProps> = ({
  success,
  points,
  peakMult,
  onPlayAgain,
  onPlayForReal,
}) => {
  const tips = success
    ? [
        'You extracted at the right time — that\'s the key skill.',
        'In a real raid your points go straight to the live leaderboard.',
        'Gear from the Store reduces risk drift — try it with RISK_REDUCTION.',
      ]
    : [
        'Risk climbs every second — extract before it hits 100%.',
        'Defending lowers risk. Attacking pushes your multiplier but spikes risk.',
        'Watch for the GOLDEN WINDOW — it gives a +5% score bonus.',
      ];

  return (
    <div className="h-full flex flex-col overflow-y-auto scrollbar-hide" style={{ ...INTER, background: 'var(--app-bg)' }}>

      {/* ── TOP BAND ── */}
      <div className="shrink-0 h-1 w-full" style={{ background: 'linear-gradient(90deg, #9945FF, #14F195)' }} />

      {/* ── HERO ── */}
      <div className="flex flex-col items-center px-6 pt-8 pb-6 text-center">
        {/* Demo pill */}
        <div className="mb-4 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.3em]"
          style={{ background: 'rgba(20,241,149,0.10)', border: '1px solid rgba(20,241,149,0.30)', color: '#14F195' }}>
          Free Demo · Simulation
        </div>

        {/* Outcome badge */}
        <div className={`px-8 py-3 border-2 tech-border font-black uppercase tracking-wide mb-4`}
          style={{
            ...BN, fontSize: '28px',
            background: success ? 'rgba(255,184,0,0.08)' : 'rgba(153,69,255,0.08)',
            borderColor: success ? '#FFB800' : '#9945FF',
            color:       success ? '#FFB800' : '#9945FF',
          }}>
          {success ? 'Extracted' : 'Busted'}
        </div>

        {/* Headline */}
        <h2 className="font-black uppercase leading-none mb-2 text-white"
          style={{ ...BN, fontSize: 'clamp(40px, 10vw, 64px)' }}>
          {success ? 'Nice Run!' : 'Got Caught'}
        </h2>
        <p className="text-[13px] text-white mb-6" style={{ opacity: 0.65 }}>
          {success
            ? 'You extracted before risk got too high — that\'s exactly how it works.'
            : 'Risk hit 100% before you extracted — try extracting a little earlier next time.'}
        </p>

        {/* Score card */}
        <div className="w-full max-w-xs rounded-2xl p-6 mb-6"
          style={{ background: '#080820', border: '2px solid rgba(153,69,255,0.30)' }}>
          <p className="text-[10px] font-black uppercase tracking-widest text-white mb-1" style={{ opacity: 0.5 }}>Points scored</p>
          <p className="font-black text-white leading-none mb-1"
            style={{ ...BN, fontSize: 'clamp(52px, 14vw, 80px)', color: success ? '#ffffff' : '#9945FF' }}>
            {points.toLocaleString()}
            <span className="text-xl ml-1" style={{ opacity: 0.4 }}>pts</span>
          </p>
          {peakMult != null && (
            <p className="text-[11px] font-bold mt-1" style={{ color: '#FFB800', opacity: 0.8 }}>
              Peak multiplier: {peakMult.toFixed(2)}x
            </p>
          )}
          <div className="mt-3 pt-3 border-t border-white" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <p className="text-[10px] text-white" style={{ opacity: 0.45 }}>
              No SOL earned · no fees charged · this was a simulation
            </p>
          </div>
        </div>

        {/* Tip */}
        <div className="w-full max-w-xs rounded-xl px-4 py-3 mb-6 text-left"
          style={{ background: 'rgba(153,69,255,0.07)', border: '1px solid rgba(153,69,255,0.20)' }}>
          <p className="text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: '#9945FF' }}>Tip</p>
          <p className="text-[12px] text-white" style={{ opacity: 0.8 }}>
            {tips[Math.floor(Date.now() / 1000) % tips.length]}
          </p>
        </div>
      </div>

      {/* ── CTA BUTTONS ── */}
      <div className="shrink-0 px-6 pb-8 space-y-3 max-w-xs mx-auto w-full">
        {/* Primary — play for real */}
        <button
          onClick={onPlayForReal}
          className="w-full py-4 rounded-xl active:scale-[0.98] transition-all"
          style={{ background: 'linear-gradient(135deg, #6622BB, #3d0099)', color: '#fff', ...BN, fontSize: '18px' }}>
          Raid for Real · 0.026 SOL
        </button>

        {/* Secondary — try again */}
        <button
          onClick={onPlayAgain}
          className="w-full py-3 rounded-xl font-bold text-sm uppercase tracking-wide active:scale-[0.98] transition-all"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: '#ffffff' }}>
          Try Demo Again
        </button>
      </div>

    </div>
  );
};

export default FreeResultScreen;
