import React, { useState } from 'react';

const BN:   React.CSSProperties = { fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '2px' };
const SG:   React.CSSProperties = { fontFamily: "'Space Grotesk', sans-serif" };
const MONO: React.CSSProperties = { fontFamily: "'JetBrains Mono', 'Courier New', monospace" };

const LINES = [
  { tag: '01', head: 'COMPETE',   body: 'Enter a raid, score points, and extract at the right moment to earn SOL.' },
  { tag: '02', head: 'WIN SOL',   body: 'Top performers earn SOL paid directly to their connected wallet.' },
  { tag: '03', head: 'ON-CHAIN',  body: 'Every payout is settled on Solana. Fully transparent, no middlemen.' },
];

interface DisclaimerModalProps {
  onComplete: () => void;
}

const DisclaimerModal: React.FC<DisclaimerModalProps> = ({ onComplete }) => {
  const [confirmed, setConfirmed]       = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const handleEnter = () => {
    if (!confirmed) return;
    if (dontShowAgain) localStorage.setItem('solraid-intro-dismissed', 'true');
    onComplete();
  };

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.96)' }}
    >
      <div
        className="w-full max-w-md tech-border relative overflow-hidden"
        style={{ background: '#0a0a1a', border: '1px solid rgba(255,255,255,0.15)' }}
      >
        {/* Top red accent */}
        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: '#9945FF', boxShadow: '0 0 12px rgba(153,69,255,0.5)' }} />

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-white/[0.07]">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-white mb-1" style={MONO}>
                // EXTRACTION_GAME
              </p>
              <h1 style={{ ...BN, fontSize: '32px', color: '#9945FF', lineHeight: 1 }}>
                SOL RAID
              </h1>
            </div>
            <span
              className="text-[9px] font-bold px-2 py-1"
              style={{ ...MONO, color: '#9945FF', border: '1px solid rgba(153,69,255,0.3)', background: 'rgba(153,69,255,0.06)' }}
            >
              V1
            </span>
          </div>
        </div>

        {/* What it is */}
        <div className="px-6 py-5 space-y-4">
          {LINES.map(({ tag, head, body }) => (
            <div key={tag} className="flex items-start gap-4">
              <span
                className="shrink-0 text-[11px] font-black px-1.5 py-px"
                style={{ ...MONO, color: '#9945FF', border: '1px solid rgba(153,69,255,0.35)', background: 'rgba(153,69,255,0.06)', minWidth: '28px', textAlign: 'center' }}
              >
                {tag}
              </span>
              <div>
                <p className="text-[11px] font-black uppercase tracking-widest text-white mb-0.5" style={SG}>
                  {head}
                </p>
                <p className="text-[12px] text-white leading-snug" style={SG}>
                  {body}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="mx-6 border-t border-white/[0.07]" />

        {/* Confirm */}
        <div className="px-6 py-5 space-y-3">
          <div
            className="flex items-center gap-3 cursor-pointer select-none"
            style={{ touchAction: 'manipulation' }}
            onClick={() => setConfirmed(v => !v)}
          >
            <div
              className="shrink-0 flex items-center justify-center transition-all"
              style={{
                width: '18px',
                height: '18px',
                border: confirmed ? '2px solid #9945FF' : '2px solid rgba(255,255,255,0.15)',
                background: confirmed ? '#9945FF' : 'transparent',
              }}
            >
              {confirmed && <div style={{ width: '6px', height: '6px', background: '#fff' }} />}
            </div>
            <span
              className="text-[12px] uppercase tracking-wide transition-colors"
              style={{ ...SG, fontWeight: 700, color: confirmed ? '#fff' :'#ffffff'}}
            >
              I understand how the game works
            </span>
          </div>

          <div
            className="flex items-center gap-3 cursor-pointer select-none"
            style={{ touchAction: 'manipulation' }}
            onClick={() => setDontShowAgain(v => !v)}
          >
            <div
              className="shrink-0 flex items-center justify-center transition-all"
              style={{
                width: '18px',
                height: '18px',
                border: dontShowAgain ? '2px solid rgba(255,255,255,0.15)' : '2px solid rgba(255,255,255,0.15)',
                background: dontShowAgain ?'#ffffff': 'transparent',
              }}
            >
              {dontShowAgain && <div style={{ width: '6px', height: '6px', background: 'rgba(255,255,255,0.06)' }} />}
            </div>
            <span className="text-[11px] uppercase tracking-wide text-white" style={{ ...SG, fontWeight: 600 }}>
              Don't show again
            </span>
          </div>
        </div>

        {/* Enter button */}
        <div className="px-6 pb-6">
          <button
            onClick={handleEnter}
            disabled={!confirmed}
            style={{
              touchAction: 'manipulation',
              ...BN,
              width: '100%',
              padding: '14px 0',
              fontSize: '18px',
              letterSpacing: '3px',
              background: confirmed ? '#9945FF' : 'transparent',
              color: confirmed ? '#fff' : '#ffffff',
              border: confirmed ? 'none' : '1px solid rgba(255,255,255,0.15)',
              cursor: confirmed ? 'pointer' : 'not-allowed',
              transition: 'all 0.15s',
            }}
          >
            ENTER SOL RAID
          </button>
          {!confirmed && (
            <p className="text-center text-[9px] text-white mt-2 uppercase tracking-widest" style={MONO}>
              confirm above to unlock
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default DisclaimerModal;
