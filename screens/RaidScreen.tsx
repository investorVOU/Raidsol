
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { GEAR_ITEMS } from '../types';

interface RaidScreenProps {
  onFinish: (success: boolean, solAmount: number, points: number) => void;
  equippedGearIds: string[];
  entryFee: number;
}

interface SRPopup {
  id: number;
  val: number;
  x: number;
  y: number;
}

const RaidScreen: React.FC<RaidScreenProps> = ({ onFinish, equippedGearIds, entryFee }) => {
  // Equipment Effects Calculation dynamically from the equippedGearIds
  const gearStats = useMemo(() => {
    let mult = 0;
    let riskReduc = 0;
    let timeBoost = 0;

    equippedGearIds.forEach(id => {
      const item = GEAR_ITEMS.find(g => g.id === id);
      if (item) {
        if (item.effect === 'MULT_BOOST') mult += item.benefitValue || 0;
        if (item.effect === 'RISK_REDUCTION') riskReduc += item.benefitValue || 0;
        if (item.effect === 'TIME_BOOST') timeBoost += item.benefitValue || 0;
      }
    });

    return { mult, riskReduc, timeBoost };
  }, [equippedGearIds]);

  const baseRisk = -gearStats.riskReduc;
  const initialMultiplier = 1.0 + gearStats.mult;
  const initialTime = 30 + gearStats.timeBoost;

  const [points, setPoints] = useState(0);
  const [risk, setRisk] = useState(baseRisk);
  const [timeLeft, setTimeLeft] = useState(initialTime);
  const [multiplier, setMultiplier] = useState(initialMultiplier);
  const [flash, setFlash] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [logs, setLogs] = useState<string[]>(['LINK_STABLE', 'RAID_ACTIVE']);
  const [isEnding, setIsEnding] = useState<'WIN' | 'LOSS' | null>(null);
  const [popups, setPopups] = useState<SRPopup[]>([]);
  
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const addSRPopup = (val: number) => {
    const id = Date.now() + Math.random();
    // Randomize position slightly around the center risk meter
    const x = Math.floor(Math.random() * 40) - 20; 
    const y = Math.floor(Math.random() * 20) - 10;
    setPopups(prev => [...prev, { id, val, x, y }]);
    setTimeout(() => {
      setPopups(prev => prev.filter(p => p.id !== id));
    }, 1000);
  };

  useEffect(() => {
    if (isEnding) return;

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 0) {
            handleBust();
            return 0;
        }
        return prev - 1;
      });

      setRisk(prev => {
        const drift = 1.2 + (Math.random() * 2.8);
        const next = prev + drift;
        
        if (next >= 100) {
          handleBust();
          return 100;
        }
        
        if (next > 75 && Math.random() > 0.6) {
          setShake(true);
          setTimeout(() => setShake(false), 100);
        }

        if (Math.random() > 0.9) {
           addLog('DATA_PKT: 0x' + Math.floor(Math.random() * 99).toString(16));
        }
        return next;
      });

      setPoints(prev => {
        const nextPoints = prev + Math.floor(15 * multiplier);
        // Bonus SR for every 500 points
        if (Math.floor(nextPoints / 500) > Math.floor(prev / 500)) {
           addSRPopup(5);
        }
        return nextPoints;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [multiplier, isEnding]);

  const addLog = (msg: string) => {
    setLogs(prev => [msg, ...prev].slice(0, 2));
  };

  const handleBust = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (isEnding) return;
    
    setIsEnding('LOSS');
    setShake(true);
    
    // Play "Failure" sequence
    setTimeout(() => {
      onFinish(false, 0, points);
    }, 1200);
  };

  const handleCashOut = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (isEnding) return;

    setIsEnding('WIN');
    const solReward = (points / 5000) * entryFee + entryFee;
    
    // Play "Extraction" sequence
    setTimeout(() => {
      onFinish(true, solReward, points);
    }, 1200);
  };

  const triggerActionVisuals = (color: string) => {
    if (isEnding) return;
    setFlash(color);
    setShake(true);
    setTimeout(() => {
      setFlash(null);
      setShake(false);
    }, 200);
  };

  const handleAttack = () => {
    triggerActionVisuals('rgba(239, 68, 68, 0.2)');
    setMultiplier(prev => prev + 0.35);
    setRisk(prev => Math.min(99.9, prev + 8 + Math.random() * 4));
    setPoints(prev => prev + 800);
    addLog('OVERCLOCK_ACTIVE');
    addSRPopup(15); // Bonus SR for aggression
  };

  const handleDefend = () => {
    triggerActionVisuals('rgba(0, 251, 255, 0.2)');
    setMultiplier(prev => Math.max(1, prev - 0.2));
    const reduction = 12 + Math.random() * 6;
    setRisk(prev => Math.max(baseRisk, prev - reduction));
    setTimeLeft(prev => prev + 2);
    addLog('SHIELD_STABLE');
    addSRPopup(8); // Bonus SR for strategic play
  };

  const currentYield = ((points / 5000) * entryFee + entryFee).toFixed(4);
  const isUrgent = timeLeft < 10;
  const isCritical = timeLeft < 5;
  const timerGlowClass = isCritical 
    ? 'shadow-[0_0_20px_rgba(239,68,68,0.6)] border-red-500 animate-pulse' 
    : isUrgent 
    ? 'shadow-[0_0_15px_rgba(239,68,68,0.3)] border-red-500/50' 
    : 'shadow-[0_0_10px_rgba(0,251,255,0.2)] border-[#00FBFF]/30';

  return (
    <div className={`h-full flex flex-col relative overflow-hidden transition-colors duration-200 ${shake ? 'animate-[pulse_0.1s_infinite]' : ''} ${isEnding === 'LOSS' ? 'bg-red-950/20' : ''}`} style={{ backgroundColor: flash || 'transparent' }}>
      
      {/* Background Pulse for High Risk or Low Time */}
      {(risk > 80 || isUrgent) && !isEnding && (
        <div className={`absolute inset-0 pointer-events-none z-0 ${isCritical ? 'bg-red-600/15' : 'bg-red-600/5'} animate-pulse`} />
      )}

      {/* SR Popups Overlay */}
      <div className="absolute inset-0 pointer-events-none z-[60] flex items-center justify-center">
        {popups.map(p => (
          <div 
            key={p.id} 
            className="absolute animate-sr-popup pointer-events-none flex items-center gap-1"
            style={{ transform: `translate(${p.x}px, ${p.y}px)` }}
          >
            <span className="text-2xl font-black text-yellow-500 italic drop-shadow-[0_0_10px_rgba(234,179,8,0.8)]">+{p.val}</span>
            <span className="text-[10px] font-black text-yellow-500/60 uppercase tracking-tighter">SR</span>
          </div>
        ))}
      </div>

      {/* WIN ANIMATION OVERLAY */}
      {isEnding === 'WIN' && (
        <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-[#14F195]/20 backdrop-blur-md animate-in fade-in duration-300">
           <div className="absolute inset-0 overflow-hidden pointer-events-none">
             {[...Array(10)].map((_, i) => (
               <div key={i} className="absolute bottom-0 w-1 bg-[#14F195] opacity-50 animate-[shimmer_1s_infinite]" style={{ left: `${i * 10}%`, height: `${Math.random() * 100}%`, animationDelay: `${i * 0.1}s` }} />
             ))}
           </div>
           <div className="relative z-10 flex flex-col items-center">
              <span className="text-4xl sm:text-6xl font-black text-[#14F195] glitch-text italic tracking-tighter uppercase">EXTRACTION_OK</span>
              <span className="text-[10px] text-white font-black uppercase tracking-[0.6em] mt-4 animate-pulse">UPLOADING_CREDITS_TO_WALLET</span>
           </div>
        </div>
      )}

      {/* LOSS ANIMATION OVERLAY */}
      {isEnding === 'LOSS' && (
        <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-red-950/40 backdrop-blur-lg animate-in fade-in duration-300">
           <div className="absolute inset-0 pixel-grid opacity-50" />
           <div className="relative z-10 flex flex-col items-center">
              <span className="text-4xl sm:text-6xl font-black text-red-500 glitch-text italic tracking-tighter uppercase">LINK_SEVERED</span>
              <span className="text-[10px] text-red-500/60 font-black uppercase tracking-[0.6em] mt-4 animate-pulse">PROTOCOL_CRITICAL_FAILURE</span>
           </div>
        </div>
      )}

      <div className={`w-full max-w-lg mx-auto flex-1 flex flex-col p-4 z-10 overflow-y-auto scrollbar-hide transition-opacity duration-300 ${isEnding ? 'opacity-0 scale-95' : 'opacity-100'}`}>
        
        {/* Compact HUD */}
        <div className="flex justify-between items-center gap-3 mb-4 shrink-0">
          <div className="flex-1 bg-black/80 p-3 border border-white/10 tech-border relative overflow-hidden">
            <p className="text-[7px] text-white/40 font-black uppercase tracking-widest leading-none mb-1">EXTRACT_VAL</p>
            <div className="flex items-baseline gap-1">
              <span className={`mono text-xl font-black italic tracking-tighter ${risk > 85 ? 'text-red-500' : 'text-white'}`}>
                {currentYield}
              </span>
              <span className="text-[10px] text-[#14F195] font-black italic">SOL</span>
            </div>
          </div>
          
          <div className={`relative w-28 px-3 py-3 bg-black/80 border tech-border transition-all duration-300 flex flex-col items-center ${timerGlowClass}`}>
            <span className={`text-[7px] font-black uppercase tracking-widest mb-0.5 ${isUrgent ? 'text-red-500' : 'text-white/30'}`}>
              STABILITY
            </span>
            <span className={`mono text-lg font-black leading-none ${isUrgent ? 'text-red-500' : 'text-[#00FBFF]'}`}>
              {timeLeft}S
            </span>
          </div>
        </div>

        {/* Scaled Risk Engine */}
        <div className="flex-1 flex flex-col justify-center items-center relative py-2 min-h-[180px]">
          <div className="absolute w-40 h-40 rounded-full border border-white/5 animate-[spin_10s_linear_infinite] opacity-10" />
          
          <div className="relative group">
            <div className={`w-44 h-44 sm:w-56 sm:h-56 flex flex-col items-center justify-center transition-all duration-300 ${risk > 85 ? 'scale-105 shadow-[0_0_30px_rgba(239,68,68,0.2)]' : ''}`}>
              
              <svg className="absolute inset-0 w-full h-full -rotate-90">
                <circle cx="50%" cy="50%" r="44%" className="stroke-white/5 fill-none" strokeWidth="8" />
                <circle 
                  cx="50%" cy="50%" r="44%" 
                  className={`fill-none transition-all duration-500 ${
                    risk > 85 ? 'stroke-red-500' : 
                    risk > 65 ? 'stroke-orange-500' : 
                    'stroke-[#9945FF]'
                  }`} 
                  strokeWidth="10" 
                  strokeDasharray="277%"
                  strokeDashoffset={`${277 * (1 - (risk - baseRisk) / (100 - baseRisk))}%`}
                  strokeLinecap="butt"
                />
              </svg>

              <div className="z-10 flex flex-col items-center text-center">
                <p className="text-[8px] font-black text-white/20 uppercase tracking-[0.3em] mb-1">RISK</p>
                <div className="flex items-baseline">
                  <span className={`mono text-4xl sm:text-5xl font-black tracking-tighter ${risk > 85 ? 'chromatic-aberration text-red-500' : 'text-white'}`}>
                    {Math.max(0, Math.floor(risk))}
                  </span>
                  <span className="text-sm font-black text-white/20 ml-0.5">%</span>
                </div>
                <div className="mt-2">
                   <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 bg-white/5 border border-white/10 ${risk > 85 ? 'text-red-500 border-red-500/50' : 'text-white/40'}`}>
                    {risk > 85 ? 'CRITICAL' : 'ACTIVE'}
                   </span>
                </div>
              </div>
            </div>
          </div>

          <div className="w-full max-w-[180px] mt-4 bg-black/40 border-l border-[#14F195]/30 pl-3 py-1 opacity-50">
            {logs.map((log, i) => (
              <div key={i} className={`text-[7px] mono font-bold uppercase tracking-widest ${i === 0 ? 'text-[#14F195]' : 'text-white/20'}`}>
                {'>'} {log}
              </div>
            ))}
          </div>
        </div>

        {/* Multiplier / Progress Stats */}
        <div className="mt-2 mb-4 space-y-2 shrink-0">
           <div className="flex justify-between items-end px-1">
              <div>
                <p className="text-[7px] text-white/30 font-black uppercase tracking-widest mb-0.5">YIELD_MULT</p>
                <p className={`mono text-2xl font-black italic ${multiplier > 3 ? 'text-[#9945FF] chromatic-aberration' : 'text-white'}`}>
                  {multiplier.toFixed(2)}x
                </p>
              </div>
              <div className="text-right">
                <p className="text-[7px] text-white/30 font-black uppercase tracking-widest mb-0.5">SCORE</p>
                <p className="mono text-lg font-black text-white/60">
                  {points.toLocaleString()}
                </p>
              </div>
           </div>
           <div className="h-1.5 w-full bg-white/5 tech-border overflow-hidden">
             <div 
               className="h-full bg-gradient-solana transition-all duration-700"
               style={{ width: `${Math.min(100, (multiplier / 6) * 100)}%` }}
             />
           </div>
        </div>

        {/* Action Panel - Responsive Grid */}
        <div className="grid grid-cols-2 gap-2 mt-auto shrink-0 pb-4">
          
          <button 
            onClick={handleAttack}
            disabled={!!isEnding}
            className="col-span-1 group relative overflow-hidden bg-black border border-red-600/50 p-3 tech-border active:translate-y-0.5 transition-all disabled:opacity-50"
          >
            <div className="relative z-10 flex flex-col items-center">
              <span className="text-sm font-black uppercase italic tracking-tighter text-red-500">ATTACK</span>
              <span className="text-[6px] font-bold text-red-500/40 uppercase tracking-widest">MULT++</span>
            </div>
          </button>

          <button 
            onClick={handleDefend}
            disabled={!!isEnding}
            className="col-span-1 group relative overflow-hidden bg-black border border-[#00FBFF]/50 p-3 tech-border active:translate-y-0.5 transition-all disabled:opacity-50"
          >
            <div className="relative z-10 flex flex-col items-center">
              <span className="text-sm font-black uppercase italic tracking-tighter text-[#00FBFF]">DEFEND</span>
              <span className="text-[6px] font-bold text-[#00FBFF]/40 uppercase tracking-widest">RISK--</span>
            </div>
          </button>

          <button 
            onClick={handleCashOut}
            disabled={!!isEnding}
            className="col-span-2 group relative overflow-hidden p-4 tech-border bg-[#14F195] text-black shadow-[0_0_20px_rgba(20,241,149,0.2)] active:translate-y-1 transition-all disabled:opacity-50"
          >
            <div className="relative z-10 flex flex-col items-center">
              <span className="text-xl font-black uppercase italic tracking-tighter leading-none">EXIT & CASH OUT</span>
              <span className="text-[7px] font-black uppercase mt-1 tracking-[0.3em] opacity-60 italic">FINALIZE_EXTRACT</span>
            </div>
          </button>

        </div>
        
      </div>
    </div>
  );
};

export default RaidScreen;
