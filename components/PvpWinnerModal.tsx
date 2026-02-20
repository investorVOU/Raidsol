import React, { useEffect } from 'react';
import { useGameSounds } from '../hooks/useGameSounds';

export interface PvpWinnerResult {
  isWinner: boolean;
  winnerName: string;
  winnerWallet: string;
  potSol: number;
  currency: string;
}

interface PvpWinnerModalProps {
  result: PvpWinnerResult;
  onClose: () => void;
}

const PvpWinnerModal: React.FC<PvpWinnerModalProps> = ({ result, onClose }) => {
  const sounds = useGameSounds();

  useEffect(() => {
    if (result.isWinner) {
      sounds.playWinnerFanfare();
      sounds.vibrate([80, 40, 80, 40, 200]);
    } else {
      sounds.playBust();
      sounds.vibrate([200]);
    }
  }, []);  // eslint-disable-line

  const WinnerStyle = `
    @keyframes pvp-winner-pulse {
      0%,100% { box-shadow: 0 0 30px rgba(20,241,149,0.5), 0 0 60px rgba(20,241,149,0.2); }
      50%      { box-shadow: 0 0 60px rgba(20,241,149,0.9), 0 0 120px rgba(20,241,149,0.4); }
    }
    @keyframes pvp-loser-pulse {
      0%,100% { box-shadow: 0 0 30px rgba(239,68,68,0.5); }
      50%      { box-shadow: 0 0 60px rgba(239,68,68,0.8); }
    }
    @keyframes pvp-coins-fly {
      0%   { transform: translateY(0) rotate(0deg); opacity: 1; }
      100% { transform: translateY(-120px) rotate(720deg); opacity: 0; }
    }
    @keyframes pvp-zoom-in {
      0%   { transform: scale(0.3) rotate(-5deg); opacity: 0; }
      60%  { transform: scale(1.08) rotate(1deg); }
      100% { transform: scale(1) rotate(0deg); opacity: 1; }
    }
    .pvp-modal-enter { animation: pvp-zoom-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
    .pvp-winner-glow { animation: pvp-winner-pulse 1.5s ease-in-out infinite; }
    .pvp-loser-glow  { animation: pvp-loser-pulse  1.5s ease-in-out infinite; }
    .pvp-coin        { animation: pvp-coins-fly 0.8s ease-out forwards; }
  `;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
         style={{ background: result.isWinner ? 'rgba(0,0,0,0.88)' : 'rgba(0,0,0,0.92)' }}>
      <style>{WinnerStyle}</style>

      {/* Backdrop click to dismiss */}
      <div className="absolute inset-0" onClick={onClose} />

      <div
        className={`relative z-10 w-full max-w-sm pvp-modal-enter ${result.isWinner ? 'pvp-winner-glow' : 'pvp-loser-glow'}`}
        style={{
          background: result.isWinner
            ? 'linear-gradient(135deg, #020202 0%, #051a10 100%)'
            : 'linear-gradient(135deg, #020202 0%, #1a0505 100%)',
          border: `2px solid ${result.isWinner ? '#14F195' : '#EF4444'}`,
        }}
      >
        {/* Top accent line */}
        <div className="h-1 w-full" style={{ background: result.isWinner ? '#14F195' : '#EF4444' }} />

        <div className="p-8 flex flex-col items-center gap-6 text-center">

          {/* Status icon + coins for winner */}
          <div className="relative">
            {result.isWinner && (
              <>
                {[...Array(8)].map((_, i) => (
                  <div
                    key={i}
                    className="pvp-coin absolute text-2xl"
                    style={{
                      left: `${40 + Math.cos((i / 8) * Math.PI * 2) * 40}px`,
                      top:  `${40 + Math.sin((i / 8) * Math.PI * 2) * 40}px`,
                      animationDelay: `${i * 0.07}s`,
                    }}
                  >
                    ◈
                  </div>
                ))}
              </>
            )}
            <div
              className={`w-24 h-24 flex items-center justify-center border-4 ${
                result.isWinner ? 'border-[#14F195] text-[#14F195]' : 'border-red-500 text-red-500'
              }`}
              style={{ fontSize: '48px' }}
            >
              {result.isWinner ? '◈' : '✕'}
            </div>
          </div>

          {/* Result title */}
          <div>
            <h2
              className={`text-4xl font-black italic tracking-tighter leading-none glitch-text ${
                result.isWinner ? 'text-[#14F195]' : 'text-red-500'
              }`}
            >
              {result.isWinner ? 'WINNER!' : 'DEFEATED'}
            </h2>
            <p className={`text-xs font-black uppercase tracking-[0.4em] mt-2 ${
              result.isWinner ? 'text-white/50' : 'text-red-500/50'
            }`}>
              {result.isWinner ? 'YOU_EXTRACTED_THE_POT' : 'PROTOCOL_OVERRIDE'}
            </p>
          </div>

          {/* Winner name (shown to losers) */}
          {!result.isWinner && (
            <div className="w-full bg-white/5 border border-white/10 p-4">
              <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.4em] mb-1">WINNER</p>
              <p className="text-lg font-black text-white italic">{result.winnerName}</p>
            </div>
          )}

          {/* Pot size */}
          <div className={`w-full p-5 border ${
            result.isWinner ? 'bg-[#14F195]/10 border-[#14F195]/40' : 'bg-white/5 border-white/10'
          }`}>
            <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.4em] mb-1">
              {result.isWinner ? 'POT_CREDITED_TO_BALANCE' : 'POT_LOST'}
            </p>
            <p className={`text-3xl font-black mono ${result.isWinner ? 'text-[#14F195]' : 'text-white/40 line-through'}`}>
              {result.potSol.toFixed(4)} {result.currency}
            </p>
            {result.isWinner && (
              <p className="text-[9px] font-black text-white/30 uppercase tracking-widest mt-1">
                CLAIM_FROM_PROFILE → BALANCE
              </p>
            )}
          </div>

          {/* CTA */}
          <button
            onClick={onClose}
            className={`w-full py-5 font-black uppercase tracking-tight text-xl tech-border transition-all active:scale-95 ${
              result.isWinner
                ? 'bg-[#14F195] text-black shadow-[0_0_30px_rgba(20,241,149,0.4)] hover:bg-[#0fd880]'
                : 'bg-black border-2 border-white/20 text-white/60 hover:border-white hover:text-white'
            }`}
          >
            {result.isWinner ? 'CLAIM GLORY →' : 'RETURN TO BASE →'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PvpWinnerModal;
