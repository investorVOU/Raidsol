import React, { useState, useEffect } from 'react';

interface RaidLoadingScreenProps {
  onComplete: () => void;
  mode?: 'SOLO' | 'PVP';
}

const SOLO_STATUSES = [
  'ESTABLISHING_SECURE_LINK...',
  'LOADING_FIGHTER_ASSETS...',
  'CALIBRATING_RISK_ENGINE...',
  'SYNCING_SERVER_SEED...',
  'INITIALIZING_3D_ARENA...',
  'PROTOCOL_READY',
];

const PVP_STATUSES = [
  'ESTABLISHING_SECURE_LINK...',
  'LOADING_FIGHTER_ASSETS...',
  'SYNCHRONIZING_OPPONENTS...',
  'CALIBRATING_SHARED_SEED...',
  'LOCKING_ARENA...',
  'ALL_OPERATIVES_READY',
];

const DURATION_MS = 2500;
const TICK_MS = 50;

const RaidLoadingScreen: React.FC<RaidLoadingScreenProps> = ({ onComplete, mode = 'SOLO' }) => {
  const [progress, setProgress] = useState(0);
  const statuses = mode === 'PVP' ? PVP_STATUSES : SOLO_STATUSES;
  const statusIdx = Math.min(
    statuses.length - 1,
    Math.floor((progress / 100) * statuses.length),
  );

  useEffect(() => {
    let elapsed = 0;
    const timer = setInterval(() => {
      elapsed += TICK_MS;
      const p = Math.min(100, (elapsed / DURATION_MS) * 100);
      setProgress(p);
      if (elapsed >= DURATION_MS) {
        clearInterval(timer);
        onComplete();
      }
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [onComplete]);

  // Risk-bar gradient colour mirrors the actual risk meter
  const barColor =
    progress > 80 ? '#14F195' : progress > 50 ? '#00FBFF' : progress > 25 ? '#9945FF' : '#EF4444';

  return (
    <div className="fixed inset-0 z-[500] bg-black flex flex-col items-center justify-center overflow-hidden">

      {/* CRT scanline */}
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.18)_50%)] bg-[length:100%_4px] opacity-40" />

      {/* Corner brackets */}
      {[['top-4 left-4','border-t border-l'],['top-4 right-4','border-t border-r'],['bottom-4 left-4','border-b border-l'],['bottom-4 right-4','border-b border-r']].map(([pos, border]) => (
        <div key={pos} className={`absolute ${pos} w-8 h-8 ${border} border-white/20`} />
      ))}

      <div className="relative z-10 flex flex-col items-center w-full max-w-sm px-8 gap-8">

        {/* Mode badge */}
        <div className={`px-4 py-1 border text-[10px] font-black uppercase tracking-[0.4em] ${mode === 'PVP' ? 'border-[#9945FF]/60 text-[#9945FF]' : 'border-cyan-500/60 text-cyan-400'}`}>
          {mode === 'PVP' ? 'PVP_PROTOCOL' : 'SOLO_PROTOCOL'}
        </div>

        {/* Title */}
        <div className="text-center">
          <h1 className="text-3xl sm:text-4xl font-black italic uppercase tracking-tighter text-white glitch-text leading-none">
            INITIALIZING
          </h1>
          <p className="text-xs font-black text-white/20 uppercase tracking-[0.4em] mt-2">
            RAID_ENGINE_v6.0
          </p>
        </div>

        {/* Progress bar */}
        <div className="w-full space-y-2">
          <div className="w-full h-1 bg-white/5 overflow-hidden">
            <div
              className="h-full transition-all duration-75"
              style={{ width: `${progress}%`, backgroundColor: barColor, boxShadow: `0 0 10px ${barColor}` }}
            />
          </div>
          <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-white/20">
            <span>{Math.floor(progress)}%</span>
            <span className="text-white/40 animate-pulse">{statuses[statusIdx]}</span>
          </div>
        </div>

        {/* Hex grid decoration */}
        <div className="flex gap-1.5 flex-wrap justify-center opacity-20">
          {[...Array(24)].map((_, i) => (
            <div
              key={i}
              className="w-3 h-3 border border-white/40 rotate-45 transition-colors duration-200"
              style={{ backgroundColor: i < Math.floor((progress / 100) * 24) ? barColor : 'transparent' }}
            />
          ))}
        </div>

        {/* Bottom note */}
        <p className="text-[9px] font-black uppercase tracking-[0.3em] text-white/10 text-center">
          PROTOCOL_INITIALIZING // STANDBY
        </p>
      </div>
    </div>
  );
};

export default RaidLoadingScreen;
