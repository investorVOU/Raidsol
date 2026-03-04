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

const HINTS_WIN = [
  "Real raids: your score hits the leaderboard the second you extract.",
  "Hold longer for a bigger multiplier — but risk doesn't wait.",
  "Gear from the Store gives you more room before risk climbs.",
];
const HINTS_BUST = [
  "Half a second earlier and those points were yours.",
  "Defend drops risk fast. Use it when the bar starts moving.",
  "The multiplier peaks right before the bust. That's your window.",
];

const FreeResultScreen: React.FC<FreeResultScreenProps> = ({
  success, points, peakMult, onPlayAgain, onPlayForReal,
}) => {
  const hint = (success ? HINTS_WIN : HINTS_BUST)[Math.floor(Date.now() / 10000) % 3];

  const rating =
    points >= 3000 ? { label: 'ELITE',  color: '#FFB800' }
  : points >= 1500 ? { label: 'SOLID',  color: '#14F195' }
  : points >= 500  ? { label: 'DECENT', color: '#9945FF' }
  :                  { label: 'ROOKIE', color: 'rgba(255,255,255,0.30)' };

  return (
    <div className="h-full flex flex-col" style={{ ...SG, background: 'var(--app-bg)' }}>

      <div className="shrink-0 h-[3px] w-full"
        style={{ background: 'linear-gradient(90deg, #9945FF 0%, #14F195 100%)' }} />

      <div className="flex-1 overflow-y-auto scrollbar-hide">

        {/* ── HERO ── */}
        <div className="relative flex flex-col items-center px-5 pt-10 pb-6 text-center">

          <div className="absolute inset-0 pointer-events-none" style={{
            background: success
              ? 'radial-gradient(ellipse 100% 50% at 50% 0%, rgba(20,241,149,0.08) 0%, transparent 65%)'
              : 'radial-gradient(ellipse 100% 50% at 50% 0%, rgba(153,69,255,0.10) 0%, transparent 65%)',
          }} />

          {/* demo tag */}
          <div className="relative mb-6 inline-flex items-center gap-1.5 px-3 py-1 rounded-full"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}>
            <div className="w-1 h-1 rounded-full animate-pulse" style={{ background: '#14F195' }} />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em]"
              style={{ color: 'rgba(255,255,255,0.38)' }}>Demo</span>
          </div>

          {/* outcome */}
          <h1 className="relative leading-none mb-1" style={{
            ...BN,
            fontSize: 'clamp(60px, 17vw, 92px)',
            letterSpacing: '4px',
            color: success ? '#ffffff' : '#9945FF',
          }}>
            {success ? 'Extracted' : 'Busted'}
          </h1>
          <p className="relative text-[13px] mb-8" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {success ? 'Clean exit.' : 'Risk maxed out.'}
          </p>

          {/* ── SCORE CARD ── */}
          <div className="relative w-full max-w-[320px] rounded-2xl overflow-hidden" style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
          }}>
            <div className="px-6 py-6">
              <div className="flex items-end justify-between">
                <div className="flex items-end gap-2">
                  <span style={{
                    ...BN,
                    fontSize: 'clamp(58px, 18vw, 86px)',
                    lineHeight: 1,
                    color: success ? '#ffffff' : '#9945FF',
                    letterSpacing: '1px',
                  }}>
                    {points.toLocaleString()}
                  </span>
                  <span className="text-sm font-semibold mb-2"
                    style={{ color: 'rgba(255,255,255,0.20)' }}>pts</span>
                </div>

                <div className="flex flex-col items-end gap-1.5 mb-2">
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded"
                    style={{
                      color: rating.color,
                      background: `${rating.color}14`,
                      border: `1px solid ${rating.color}30`,
                    }}>
                    {rating.label}
                  </span>
                  {peakMult != null && (
                    <span className="text-[11px]" style={{ color: '#FFB800', ...MONO }}>
                      ×{peakMult.toFixed(2)} peak
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="px-6 py-2.5"
              style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <p className="text-[10px] text-left" style={{ color: 'rgba(255,255,255,0.20)' }}>
                No SOL used · simulation only
              </p>
            </div>
          </div>
        </div>

        {/* ── REAL RAID PROJECTION ── */}
        {(() => {
          const grossSol = (points / 5000) * 0.07;
          const netSol   = grossSol - 0.026;
          const profit   = netSol > 0;
          return (
            <div className="mx-5 mb-4 rounded-xl overflow-hidden" style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
            }}>
              <div className="px-5 py-3 flex items-center justify-between"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white">If this were real</p>
              </div>
              <div className="px-5 py-4 flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-[13px]" style={{ color: 'rgba(255,255,255,0.45)' }}>Estimated win</p>
                  <p className="text-[15px] font-black text-white" style={{ ...MONO }}>~{grossSol.toFixed(3)} SOL</p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-[13px]" style={{ color: 'rgba(255,255,255,0.45)' }}>Entry fee</p>
                  <p className="text-[13px] font-semibold text-white" style={{ ...MONO }}>0.026 SOL</p>
                </div>
                <div className="flex items-center justify-between pt-2.5"
                  style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <p className="text-[13px] font-bold text-white">{profit ? 'Net profit' : 'Net result'}</p>
                  <p className="text-[15px] font-black" style={{ color: profit ? '#14F195' : '#9945FF', ...MONO }}>
                    {profit ? '+' : ''}{netSol.toFixed(3)} SOL
                  </p>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── HINT ── */}
        <div className="mx-5 mb-5">
          <p className="text-[12px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.30)' }}>
            {hint}
          </p>
        </div>

      </div>

      {/* ── FOOTER ── */}
      <div className="shrink-0 px-5 pt-2 pb-2 space-y-1.5"
        style={{ borderTop: '1px solid rgba(255,255,255,0.05)', background: 'var(--app-bg)' }}>

        <button
          onClick={onPlayForReal}
          className="w-full py-2 rounded-xl active:scale-[0.98] transition-transform"
          style={{
            background: 'linear-gradient(135deg, #7733cc 0%, #3d0099 100%)',
            boxShadow: '0 3px 14px rgba(153,69,255,0.35)',
          }}>
          <p className="font-black text-white" style={{ ...BN, fontSize: '17px', letterSpacing: '2px' }}>
            Raid for Real
          </p>
          <p className="text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.50)' }}>
            0.026 SOL entry · real prizes
          </p>
        </button>

        <button
          onClick={onPlayAgain}
          className="w-full py-1.5 rounded-xl text-[11px] font-bold uppercase tracking-widest active:scale-[0.98] transition-transform"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            color: 'rgba(255,255,255,0.38)',
          }}>
          Practice Again
        </button>

      </div>
    </div>
  );
};

export default FreeResultScreen;
