import React, { useState, useEffect, useRef } from 'react';

// ── Scary red matrix rain — pure 2D canvas, zero network deps ─────────────
const RAIN_CHARS = '01アイウエオカキクケコ∑∫∂∇⊕⊗◉●♦ABCDEFX∞≠≡'.split('');
const FONT_SIZE  = 13;

const MatrixRain: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const cols = () => Math.floor(canvas.width / FONT_SIZE);
    let drops: number[] = Array.from({ length: cols() }, () => Math.random() * -50);

    let animId: number;
    const draw = () => {
      // Dim the previous frame — low alpha = long trails (scary afterglow)
      ctx.fillStyle = 'rgba(0,0,0,0.055)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.font = `bold ${FONT_SIZE}px "JetBrains Mono", monospace`;

      const currentCols = cols();
      if (drops.length !== currentCols) {
        drops = Array.from({ length: currentCols }, (_, i) => drops[i] ?? Math.random() * -50);
      }

      for (let i = 0; i < drops.length; i++) {
        const char = RAIN_CHARS[Math.floor(Math.random() * RAIN_CHARS.length)];
        const y = drops[i] * FONT_SIZE;

        // Lead char = bright white flash; rest = deep red
        if (Math.random() > 0.96) {
          ctx.shadowBlur  = 12;
          ctx.shadowColor = '#fff';
          ctx.fillStyle   = 'rgba(255,255,255,0.9)';
        } else {
          const intensity = 120 + Math.floor(Math.random() * 80);
          ctx.shadowBlur  = 6;
          ctx.shadowColor = `rgb(${intensity},0,0)`;
          ctx.fillStyle   = `rgba(${intensity},0,0,${0.5 + Math.random() * 0.5})`;
        }
        ctx.fillText(char, i * FONT_SIZE, y);

        // Reset column when it falls off screen
        if (y > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i] += 0.5;
      }

      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ pointerEvents: 'none', opacity: 0.55 }}
    />
  );
};

// ─────────────────────────────────────────────────────────────────────────────

interface IntroOverlayProps {
  onComplete: () => void;
}

const IntroOverlay: React.FC<IntroOverlayProps> = ({ onComplete }) => {
  const [step, setStep]                   = useState(0);
  const [showControls, setShowControls]   = useState(false);
  const [ageConfirmed, setAgeConfirmed]   = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const [decryptedText, setDecryptedText]       = useState('');
  const [decryptionStarted, setDecryptionStarted] = useState(false);

  const targetMessage =
    '>> SYSTEM_NOTE: ALL_LOST_SOL_&_MARKET_FEES_ARE_ROUTED_TO_THE_[VAULT]. FUNDS_ARE_USED_FOR_CONTESTS_//_TOURNAMENTS_//_PLATFORM_REDISTRIBUTION. >> TRANSPARENCY_MODE: USERS_CAN_CHECK_THE_VAULT_THEMSELVES.';

  // Sequence timing
  useEffect(() => {
    const seq = [
      { t: 800,  s: 1 },
      { t: 2000, s: 2 },
      { t: 3200, s: 3 },
      { t: 4400, s: 4 },
      { t: 5600, s: 5 },
      { t: 6800, s: 6 },
    ];
    const tms = seq.map(({ t, s }) => setTimeout(() => setStep(s), t));
    tms.push(setTimeout(() => setShowControls(true), 8000));
    return () => tms.forEach(clearTimeout);
  }, []);

  // Trigger decryption at step 4
  useEffect(() => {
    if (step >= 4 && !decryptionStarted) setDecryptionStarted(true);
  }, [step, decryptionStarted]);

  // Scatter decrypt effect
  useEffect(() => {
    if (!decryptionStarted) return;
    const len     = targetMessage.length;
    const randCh  = () => '01XYZ'[Math.floor(Math.random() * 5)];
    const resolved = new Array(len).fill(false);
    const id = setInterval(() => {
      let done = true;
      const next = targetMessage.split('').map((ch, i) => {
        if (resolved[i]) return ch;
        done = false;
        if (Math.random() > 0.95) { resolved[i] = true; return ch; }
        return randCh();
      }).join('');
      setDecryptedText(next);
      if (done) clearInterval(id);
    }, 50);
    return () => clearInterval(id);
  }, [decryptionStarted]);

  return (
    <div className="fixed inset-0 z-[999] bg-black flex flex-col items-center justify-center overflow-hidden">

      {/* Scary matrix rain background */}
      <MatrixRain />

      {/* Deep red vignette over the rain */}
      <div
        className="absolute inset-0 z-[1] pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 80% 70% at 50% 50%, transparent 20%, rgba(0,0,0,0.7) 100%)',
        }}
      />

      {/* CRT scanlines */}
      <div className="absolute inset-0 z-[2] pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.3)_50%),linear-gradient(90deg,rgba(255,0,0,0.04),rgba(0,255,0,0.01),rgba(0,0,255,0.04))] bg-[length:100%_2px,3px_100%]" />

      {/* Text sequence */}
      <div className="relative z-[10] w-full max-w-4xl px-4 sm:px-6 md:px-8 py-6 flex flex-col items-center gap-2 sm:gap-3 text-center">

        {step >= 1 && (
          <div className="flex items-center gap-2 text-red-500/70 font-black tracking-widest text-[10px] sm:text-xs md:text-sm animate-in fade-in slide-in-from-bottom-2 duration-500">
            <span className="animate-pulse">[ █▓▒▒░░ ]</span>
            <span>INITIALIZING RAID PROTOCOL</span>
          </div>
        )}

        {step >= 2 && (
          <div className="flex items-center gap-2 text-[#14F195] font-black tracking-widest text-[10px] sm:text-xs md:text-sm animate-in fade-in slide-in-from-bottom-2 duration-500">
            <span className="animate-pulse">[ $$$ ]</span>
            <span>YOU CAN WIN REAL SOL</span>
          </div>
        )}

        {step >= 3 && (
          <div className="flex items-center gap-2 text-cyan-400 font-black tracking-widest text-[10px] sm:text-xs md:text-sm animate-in fade-in slide-in-from-bottom-2 duration-500">
            <span>( IT IS JUST A GAME )</span>
          </div>
        )}

        {step >= 4 && (
          <div className="flex items-center gap-2 text-red-500 font-black tracking-widest text-[10px] sm:text-xs md:text-sm animate-in fade-in slide-in-from-bottom-2 duration-500">
            <span className="animate-pulse">[ ░░ ]</span>
            <span>SOL IS NOT REFUNDABLE</span>
          </div>
        )}

        {step >= 5 && (
          <div className="flex items-center gap-2 font-black tracking-widest text-[10px] sm:text-xs md:text-sm animate-in fade-in slide-in-from-bottom-2 duration-500">
            <span className="animate-pulse text-white">[ ✓ ]</span>
            <span className="text-white border-b border-red-500">YOU MAY LOSE EVERYTHING</span>
          </div>
        )}

        {step >= 6 && (
          <div className="my-2 animate-in zoom-in-50 duration-300">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black italic uppercase tracking-tighter text-white glitch-text leading-tight">
              ONLY ENTER <br />
              <span className="text-red-600">WHAT YOU CAN LOSE</span>
            </h1>
          </div>
        )}

        {decryptionStarted && (
          <div className="mt-1 w-full px-4 sm:px-6 animate-in fade-in duration-500">
            <div className="bg-black/80 border border-[#14F195]/30 p-2 sm:p-3 tech-border relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-[#14F195]/50" />
              <p className="font-mono text-[7px] sm:text-[8px] md:text-[9px] text-[#14F195] tracking-widest leading-tight break-words opacity-90">
                <span className="text-[#14F195]/40 mr-2">{'>'}</span>
                {decryptedText}
                <span className="animate-pulse ml-1 inline-block w-1.5 h-3 bg-[#14F195]" />
              </p>
            </div>
          </div>
        )}

        {showControls && (
          <div className="flex flex-col items-center gap-3 w-full animate-in fade-in zoom-in-90 duration-500 mt-2">

            <label style={{ touchAction: 'manipulation' }} className="flex items-center gap-2 sm:gap-3 cursor-pointer group hover:opacity-100 opacity-80 transition-opacity max-w-2xl px-4">
              <input type="checkbox" className="hidden" checked={ageConfirmed} onChange={() => setAgeConfirmed(v => !v)} />
              <div className={`w-5 h-5 border-2 tech-border transition-colors flex items-center justify-center shrink-0 ${ageConfirmed ? 'bg-red-500 border-red-500' : 'border-white/20 group-hover:border-red-500/50'}`}>
                {ageConfirmed && <div className="w-2 h-2 bg-white" />}
              </div>
              <span className={`text-[10px] sm:text-xs md:text-sm font-black uppercase tracking-widest italic transition-colors ${ageConfirmed ? 'text-white' : 'text-white/40'}`}>
                I AM 18 YEARS OF AGE OR OLDER
              </span>
            </label>

            <label style={{ touchAction: 'manipulation' }} className="flex items-center gap-2 sm:gap-3 cursor-pointer group hover:opacity-100 opacity-80 transition-opacity max-w-2xl px-4">
              <input type="checkbox" className="hidden" checked={dontShowAgain} onChange={() => setDontShowAgain(v => !v)} />
              <div className={`w-5 h-5 border-2 tech-border transition-colors flex items-center justify-center shrink-0 ${dontShowAgain ? 'bg-white/20 border-white/40' : 'border-white/10 group-hover:border-white/30'}`}>
                {dontShowAgain && <div className="w-2 h-2 bg-white" />}
              </div>
              <span className={`text-[10px] sm:text-xs md:text-sm font-black uppercase tracking-widest italic transition-colors ${dontShowAgain ? 'text-white/60' : 'text-white/20'}`}>
                DON'T SHOW THIS AGAIN
              </span>
            </label>

            <button
              onClick={() => {
                if (dontShowAgain) localStorage.setItem('solraid-intro-dismissed', 'true');
                onComplete();
              }}
              disabled={!ageConfirmed}
              style={{ touchAction: 'manipulation' }}
              className={`group relative px-6 sm:px-10 py-2 sm:py-3 border font-black uppercase tracking-[0.15em] transition-all duration-300 tech-border text-[10px] sm:text-xs md:text-sm ${
                ageConfirmed
                  ? 'bg-red-600/10 border-red-600 text-red-500 hover:bg-red-600 hover:text-black cursor-pointer'
                  : 'bg-transparent border-white/10 text-white/10 cursor-not-allowed'
              }`}
            >
              <span className={`absolute inset-0 bg-red-600/20 blur-xl opacity-0 transition-opacity ${ageConfirmed ? 'group-hover:opacity-100' : ''}`} />
              <span className="relative">I ACCEPT THE RISK</span>
            </button>
          </div>
        )}

        <div className="absolute bottom-6 text-[10px] text-red-900/50 font-black uppercase tracking-[0.5em] z-20 pointer-events-none">
          PROTOCOL_V5.0.2 // SECURE_CONNECTION
        </div>
      </div>
    </div>
  );
};

export default IntroOverlay;
