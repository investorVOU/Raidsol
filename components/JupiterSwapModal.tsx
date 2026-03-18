import React, { useEffect, useRef, useState } from 'react';

const BAGS_URL = 'https://bags.fm/J8sMGxWB5kT8SqgmeTa3TfW6mpmucYK8xpMkmPCbBAGS';
const JUPITER_CONTAINER_ID = 'jupiter-integrated-terminal';

interface JupiterSwapModalProps {
  isOpen: boolean;
  onClose: () => void;
  outputMint: string;
}

type Step = 'choose' | 'jupiter';

const JupiterSwapModal: React.FC<JupiterSwapModalProps> = ({ isOpen, onClose, outputMint }) => {
  const [step, setStep] = useState<Step>('choose');
  const [error, setError] = useState<string | null>(null);
  const jupiterMounted = useRef(false);

  // Reset on open/close
  useEffect(() => {
    if (isOpen) {
      setStep('choose');
      setError(null);
      jupiterMounted.current = false;
    } else {
      window.Jupiter?.close?.();
      jupiterMounted.current = false;
    }
  }, [isOpen]);

  // Mount Jupiter integrated widget once the container div is in the DOM
  useEffect(() => {
    if (step !== 'jupiter' || jupiterMounted.current) return;

    // Wait a tick for the container div to render
    const t = setTimeout(() => {
      try {
        if (!window.Jupiter) {
          setError('Swap engine not loaded. Please refresh the page.');
          return;
        }
        const el = document.getElementById(JUPITER_CONTAINER_ID);
        if (!el) {
          setError('Swap container not found.');
          return;
        }
        setError(null);
        jupiterMounted.current = true;
        window.Jupiter.init({
          displayMode: 'integrated',
          integratedTargetId: JUPITER_CONTAINER_ID,
          formProps: {
            fixedOutputMint: true,
            initialOutputMint: outputMint,
          },
        });
      } catch (err) {
        console.error(err);
        setError('Swap failed to initialize.');
      }
    }, 50);

    return () => clearTimeout(t);
  }, [step, outputMint]);

  if (!isOpen) return null;

  const handleClose = () => {
    window.Jupiter?.close?.();
    jupiterMounted.current = false;
    onClose();
  };

  const handleBack = () => {
    window.Jupiter?.close?.();
    jupiterMounted.current = false;
    setStep('choose');
  };

  // ─────────────────────────────────────────
  // CHOOSE STEP
  // ─────────────────────────────────────────
  if (step === 'choose') {
    return (
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center px-4"
        style={{ background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(8px)' }}
        onClick={handleClose}
      >
        <div
          className="relative w-full max-w-[360px] rounded-2xl p-6"
          style={{
            background: 'linear-gradient(160deg, #0d0d2a 0%, #080820 100%)',
            border: '1.5px solid rgba(153,69,255,0.45)',
            boxShadow: '0 0 40px rgba(153,69,255,0.18), 0 24px 64px rgba(0,0,0,0.65)',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={handleClose}
            className="absolute top-3.5 right-3.5 w-7 h-7 rounded-full flex items-center justify-center transition-all hover:bg-white/10 active:scale-90"
            style={{ border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.5)' }}
          >
            <span className="text-[13px] leading-none">✕</span>
          </button>

          {/* Header */}
          <div className="mb-5 pr-6">
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-[0.2em] text-black"
                style={{ background: '#FFB800', boxShadow: '0 0 10px rgba(255,184,0,0.4)' }}
              >
                $RAID
              </span>
              <span
                className="text-[15px] font-black uppercase tracking-[0.12em] text-white"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                BUY NOW
              </span>
            </div>
            <p
              className="text-[11px] text-white/40"
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              Choose where you'd like to buy $RAID
            </p>
          </div>

          {/* Options */}
          <div className="flex flex-col gap-3">
            {/* BAGS.FM */}
            <button
              onClick={() => {
                window.open(BAGS_URL, '_blank', 'noopener,noreferrer');
                handleClose();
              }}
              className="w-full rounded-xl px-4 py-3.5 flex items-center justify-between transition-all active:scale-[0.97] group"
              style={{
                background: 'linear-gradient(135deg, rgba(255,184,0,0.14) 0%, rgba(255,122,0,0.08) 100%)',
                border: '1.5px solid rgba(255,184,0,0.40)',
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-black font-black text-[12px]"
                  style={{ background: '#FFB800', boxShadow: '0 0 14px rgba(255,184,0,0.5)' }}
                >
                  B
                </div>
                <div className="text-left">
                  <p
                    className="text-[13px] font-black text-white uppercase tracking-[0.06em]"
                    style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                  >
                    BAGS.FM
                  </p>
                  <p className="text-[10px] text-white/40 mt-0.5" style={{ fontFamily: "'Inter', sans-serif" }}>
                    Opens in new tab
                  </p>
                </div>
              </div>
              {/* arrow */}
              <svg
                className="w-4 h-4 shrink-0 transition-colors text-white/25 group-hover:text-[#FFB800]"
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </button>

            {/* JUPITER */}
            <button
              onClick={() => setStep('jupiter')}
              className="w-full rounded-xl px-4 py-3.5 flex items-center justify-between transition-all active:scale-[0.97] group"
              style={{
                background: 'linear-gradient(135deg, rgba(153,69,255,0.14) 0%, rgba(124,45,214,0.08) 100%)',
                border: '1.5px solid rgba(153,69,255,0.40)',
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white font-black text-[10px]"
                  style={{
                    background: 'linear-gradient(135deg, #9945FF 0%, #7c2dd6 100%)',
                    boxShadow: '0 0 14px rgba(153,69,255,0.5)',
                  }}
                >
                  JUP
                </div>
                <div className="text-left">
                  <p
                    className="text-[13px] font-black text-white uppercase tracking-[0.06em]"
                    style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                  >
                    JUPITER
                  </p>
                  <p className="text-[10px] text-white/40 mt-0.5" style={{ fontFamily: "'Inter', sans-serif" }}>
                    Swap in-app
                  </p>
                </div>
              </div>
              {/* arrow */}
              <svg
                className="w-4 h-4 shrink-0 transition-colors text-white/25 group-hover:text-[#9945FF]"
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────
  // JUPITER STEP — integrated widget inside our styled modal
  // ─────────────────────────────────────────
  return (
    <>
      {/* Always-on-top control bar — fixed so Jupiter can never bury it */}
      <div
        className="fixed top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-2 rounded-2xl"
        style={{
          zIndex: 2147483647, // max z-index
          background: 'rgba(8,8,32,0.96)',
          border: '1.5px solid rgba(153,69,255,0.55)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.6), 0 0 16px rgba(153,69,255,0.2)',
          backdropFilter: 'blur(12px)',
        }}
      >
        {/* Back */}
        <button
          onClick={handleBack}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-[0.12em] text-white/70 hover:text-white transition-colors active:scale-95"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        {/* Label */}
        <div className="flex items-center gap-1.5 px-2">
          <div
            className="w-4 h-4 rounded flex items-center justify-center text-white font-black text-[7px]"
            style={{ background: 'linear-gradient(135deg, #9945FF 0%, #7c2dd6 100%)' }}
          >
            JUP
          </div>
          <span
            className="text-[11px] font-black uppercase tracking-[0.10em] text-white/80"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Jupiter Swap
          </span>
        </div>

        {/* Close */}
        <button
          onClick={handleClose}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-[0.12em] transition-colors active:scale-95"
          style={{
            background: 'linear-gradient(135deg, rgba(153,69,255,0.25) 0%, rgba(124,45,214,0.18) 100%)',
            border: '1px solid rgba(153,69,255,0.45)',
            color: '#c084fc',
          }}
        >
          ✕ Close
        </button>
      </div>

      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[9998]"
        style={{ background: 'rgba(0,0,0,0.80)', backdropFilter: 'blur(8px)' }}
        onClick={handleClose}
      />

      {/* Jupiter container — sits above backdrop, below control bar */}
      <div
        className="fixed inset-x-4 z-[9999] rounded-2xl overflow-hidden"
        style={{
          top: 72, // clears the control bar
          bottom: 16,
          background: '#080820',
          border: '1.5px solid rgba(153,69,255,0.35)',
          boxShadow: '0 0 40px rgba(153,69,255,0.15), 0 24px 64px rgba(0,0,0,0.7)',
          maxWidth: 480,
          margin: '0 auto',
        }}
        onClick={e => e.stopPropagation()}
      >
        {error ? (
          <div className="flex items-center justify-center h-full p-6">
            <div
              className="w-full max-w-[340px] px-5 py-4 rounded-xl text-[12px] text-white/80 text-center"
              style={{ background: 'rgba(255,80,80,0.12)', border: '1px solid rgba(255,80,80,0.28)' }}
            >
              {error}
            </div>
          </div>
        ) : (
          <div id={JUPITER_CONTAINER_ID} className="w-full h-full" />
        )}
      </div>
    </>
  );
};

export default JupiterSwapModal;
