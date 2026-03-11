import React, { useState } from 'react';

const BN:   React.CSSProperties = { fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '2px' };
const SG:   React.CSSProperties = { fontFamily: "'Space Grotesk', sans-serif" };
const MONO: React.CSSProperties = { fontFamily: "'JetBrains Mono', 'Courier New', monospace" };

const SLIDES = [
  {
    num: '01',
    tag: 'BRIEFING_01',
    title: 'WHAT IS A RAID?',
    body: 'Every raid is a round-based competition. Pay an entry fee, score points, and your best result for the round competes on the leaderboard. The top 5 wallets split the prize pool based on the selected tier when the round closes.',
  },
  {
    num: '02',
    tag: 'BRIEFING_02',
    title: 'THE RISK METER',
    body: 'Every raid has a live risk meter. Extract before it hits 100% to lock in your score. If it busts, the entry fee is lost. If there are fewer than 3 entrants, the round is cancelled and everyone gets a full refund.',
  },
  {
    num: '03',
    tag: 'BRIEFING_03',
    title: 'PRIZE POOL SPLIT',
    body: '100% of entry fees go into the prize pool. Top 5 splits vary by tier. Rounds run 4x daily. Claim from Profile -> Round Wins after each round closes.',
  },
  {
    num: '04',
    tag: 'BRIEFING_04',
    title: 'COLLECTING YOUR SOL',
    body: 'Winnings appear as Unclaimed Balance on your Profile. Hit HARVEST anytime to send SOL straight to your wallet. On-chain, instant, no platform custody.',
  },
];

interface OnboardingFlowProps {
  onComplete: () => void;
}

const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onComplete }) => {
  const [slide, setSlide] = useState(0);
  const current = SLIDES[slide];
  const isLast  = slide === SLIDES.length - 1;

  return (
    <div
      className="fixed inset-0 z-[998] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.97)' }}
    >
      {/* Skip */}
      <button
        onClick={onComplete}
        className="absolute top-5 right-5 text-white hover:text-white transition-colors uppercase text-[10px] font-bold"
        style={{ ...MONO, letterSpacing: '0.2em' }}
      >
        SKIP ›
      </button>

      <div
        className="w-full max-w-sm tech-border relative overflow-hidden"
        style={{ background: '#0a0a1a', border: '1px solid rgba(255,255,255,0.15)' }}
      >
        {/* Progress bar */}
        <div className="flex" style={{ height: '3px' }}>
          {SLIDES.map((_, i) => (
            <div
              key={i}
              className="flex-1 transition-all duration-300"
              style={{
                background: i <= slide ? '#9945FF' : '#ffffff',
                marginRight: i < SLIDES.length - 1 ? '2px' : 0,
              }}
            />
          ))}
        </div>

        {/* Step tag */}
        <div className="px-6 pt-5 pb-1">
          <p className="text-[9px] text-white font-bold uppercase tracking-[0.3em]" style={MONO}>
            {current.tag} &nbsp;·&nbsp; {slide + 1} OF {SLIDES.length}
          </p>
        </div>

        {/* Large step number */}
        <div className="px-6 pt-1 pb-3 border-b border-white/[0.07]">
          <span
            style={{
              ...BN,
              fontSize: '72px',
              lineHeight: 0.9,
              color: 'transparent',
              WebkitTextStroke: '1.5px rgba(153,69,255,0.5)',
              display: 'block',
            }}
          >
            {current.num}
          </span>
          <h2 style={{ ...BN, fontSize: '26px', color: '#fff', lineHeight: 1, marginTop: '6px' }}>
            {current.title}
          </h2>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <p className="text-[13px] text-white leading-relaxed" style={SG}>
            {current.body}
          </p>
        </div>

        {/* Navigation */}
        <div className="px-6 pb-6 flex gap-2">
          {slide > 0 && (
            <button
              onClick={() => setSlide(s => s - 1)}
              className="transition-colors"
              style={{
                ...SG,
                fontWeight: 700,
                fontSize: '12px',
                letterSpacing: '0.1em',
                padding: '12px 20px',
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'transparent',
                color: '#ffffff',
                cursor: 'pointer',
                textTransform: 'uppercase',
              }}
            >
              ‹ BACK
            </button>
          )}
          <button
            onClick={() => isLast ? onComplete() : setSlide(s => s + 1)}
            className="flex-1 transition-all"
            style={{
              ...BN,
              fontSize: '17px',
              letterSpacing: '2.5px',
              padding: '13px 0',
              background: '#9945FF',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {isLast ? 'ENTER THE PROTOCOL' : 'NEXT'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingFlow;



