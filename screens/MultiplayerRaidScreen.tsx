
import React, { useState, useEffect, useRef } from 'react';
import { Room, Opponent } from '../types';

interface MultiplayerRaidScreenProps {
  room: Room;
  equippedGearIds: string[];
  walletAddress?: string | null;
  onFinish: (success: boolean, solAmount: number, points: number) => void;
}

const MultiplayerRaidScreen: React.FC<MultiplayerRaidScreenProps> = ({ room, equippedGearIds, walletAddress, onFinish }) => {
  // Game State
  const [points, setPoints] = useState(0);
  const [risk, setRisk] = useState(0);
  const [multiplier, setMultiplier] = useState(1.0);
  const [isEnding, setIsEnding] = useState<'WIN' | 'LOSS' | 'EXTRACTED' | null>(null);
  const [finalScore, setFinalScore] = useState(0);
  
  // Opponent Simulation State (all players except self)
  const [opponents, setOpponents] = useState<Opponent[]>(
    room.players.filter(p => p.id !== walletAddress)
  );
  const [logs, setLogs] = useState<string[]>(['LINK_ESTABLISHED', 'PVP_PROTOCOL_ACTIVE']);
  
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // --- GAME LOOP ---
  useEffect(() => {
    if (isEnding) return;

    timerRef.current = setInterval(() => {
      // 1. Update Player State
      setRisk(prev => {
        const next = prev + 1.5 + (Math.random() * 2);
        if (next >= 100) {
           handleBust();
           return 100;
        }
        return next;
      });

      setPoints(prev => prev + Math.floor(15 * multiplier));

      // 2. Simulate Opponents
      setOpponents(prev => prev.map(opp => {
         if (opp.status !== 'RAIDING' && opp.status !== 'WAITING') return opp;
         
         // Randomly decide fate based on risk progression logic simulation
         const roll = Math.random();
         const currentOppRisk = risk + (Math.random() * 10 - 5); // Slight variance
         
         // Logic for bot behavior
         if (opp.status === 'WAITING') return { ...opp, status: 'RAIDING' };

         if (currentOppRisk > 95) {
             addLog(`${opp.name} BUSTED!`);
             return { ...opp, status: 'BUSTED', score: 0 };
         }

         // Bots tend to extract between 50-90 risk
         if (currentOppRisk > 60 && roll > 0.95) {
             const finalScore = Math.floor(points * (0.8 + Math.random() * 0.4)); // Variance in score
             addLog(`${opp.name} EXTRACTED: ${finalScore}`);
             return { ...opp, status: 'EXTRACTED', score: finalScore };
         }

         return { ...opp, score: Math.floor(points * 0.9) }; // Rough sync
      }));

    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [multiplier, isEnding, points, risk]);


  const addLog = (msg: string) => {
    setLogs(prev => [msg, ...prev].slice(0, 3));
  };

  const handleBust = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsEnding('LOSS');
    setTimeout(() => {
        finalizeGame('LOSS', 0);
    }, 2000);
  };

  const handleExtract = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsEnding('EXTRACTED');
    setFinalScore(points);
    // Determine winner after a delay to show "Calculating"
    setTimeout(() => {
        finalizeGame('EXTRACTED', points);
    }, 2000);
  };

  const finalizeGame = (result: 'LOSS' | 'EXTRACTED', myScore: number) => {
    // 1. Calculate Winner
    const myId = walletAddress ?? 'self';
    const allScores = [
        { id: myId, score: result === 'LOSS' ? 0 : myScore },
        ...opponents.map(o => ({ id: o.id, score: o.status === 'BUSTED' ? 0 : o.score }))
    ];

    // Sort by score descending
    allScores.sort((a, b) => b.score - a.score);

    const winner = allScores[0];
    const userWon = winner.id === myId && winner.score > 0;
    
    // Total pot calculation
    const totalPot = room.stakePerPlayer * room.maxPlayers;
    
    onFinish(userWon, userWon ? totalPot : 0, myScore);
  };

  const handleAttack = () => {
    if (isEnding) return;
    setMultiplier(prev => prev + 0.5);
    setRisk(prev => Math.min(99, prev + 10));
    setPoints(prev => prev + 500);
  };

  return (
    <div className="h-full flex flex-col relative bg-black text-white">
      {/* HEADER HUD */}
      <div className="p-4 border-b border-white/10 flex justify-between items-center bg-[#050505]">
         <div>
            <span className="text-xs font-black text-white/40 uppercase tracking-widest">TOTAL_POT</span>
            <p className="text-3xl font-black text-yellow-500 mono leading-none">{(room.stakePerPlayer * room.maxPlayers).toFixed(2)} SOL</p>
         </div>
         <div className="text-right">
            <span className="text-xs font-black text-white/40 uppercase tracking-widest">LIVE_SCORE</span>
            <p className="text-3xl font-black text-white mono leading-none">{points.toLocaleString()}</p>
         </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row">
         {/* LEFT: RAID CONTROLS (Main Game) */}
         <div className="flex-1 p-6 flex flex-col items-center justify-center relative border-r border-white/5">
            {/* Risk Meter */}
            <div className="w-56 h-56 relative flex items-center justify-center mb-8">
               <svg className="absolute inset-0 w-full h-full -rotate-90">
                <circle cx="50%" cy="50%" r="45%" className="stroke-white/10 fill-none" strokeWidth="12" />
                <circle 
                  cx="50%" cy="50%" r="45%" 
                  className={`fill-none transition-all duration-300 ${risk > 80 ? 'stroke-red-500' : 'stroke-[#9945FF]'}`}
                  strokeWidth="12" 
                  strokeDasharray="283%"
                  strokeDashoffset={`${283 * (1 - risk / 100)}%`}
                />
               </svg>
               <div className="text-center z-10">
                  <span className="text-xs font-black text-white/30 uppercase tracking-widest">RISK</span>
                  <p className={`text-6xl font-black mono leading-none ${risk > 80 ? 'text-red-500' : 'text-white'}`}>{Math.floor(risk)}%</p>
               </div>
            </div>

            {isEnding ? (
               <div className="text-center animate-pulse">
                  <p className="text-3xl font-black italic uppercase text-white">
                      {isEnding === 'LOSS' ? 'PROTOCOL_SEVERED' : 'AWAITING_NETWORK_CONSENSUS...'}
                  </p>
               </div>
            ) : (
               <div className="flex gap-4 w-full max-w-sm">
                  <button 
                     onClick={handleAttack}
                     className="flex-1 py-5 bg-red-500/10 border border-red-500 text-red-500 font-black uppercase tracking-tight hover:bg-red-500 hover:text-white transition-all tech-border text-lg"
                  >
                     ATTACK (+RISK)
                  </button>
                  <button 
                     onClick={handleExtract}
                     className="flex-1 py-5 bg-[#14F195] text-black font-black uppercase tracking-tight hover:brightness-110 transition-all tech-border shadow-[0_0_20px_rgba(20,241,149,0.3)] text-lg"
                  >
                     EXTRACT NOW
                  </button>
               </div>
            )}
         </div>

         {/* RIGHT: OPPONENT FEED */}
         <div className="w-full md:w-80 bg-[#050505] border-t md:border-t-0 border-white/5 flex flex-col">
            <div className="p-4 bg-white/5 border-b border-white/5">
               <span className="text-xs font-black uppercase tracking-widest text-white/60">OPPONENT_UPLINK</span>
            </div>
            
            <div className="flex-1 p-4 space-y-4 overflow-y-auto">
               {/* User Card */}
               <div className="bg-white/5 border border-[#14F195]/30 p-4 tech-border">
                  <div className="flex justify-between items-center mb-2">
                     <span className="text-sm font-black text-[#14F195] italic">YOU</span>
                     <span className="text-xs font-black">{isEnding === 'LOSS' ? 'BUSTED' : isEnding === 'EXTRACTED' ? 'HOLDING' : 'ACTIVE'}</span>
                  </div>
                  <div className="w-full bg-black h-2 rounded-full overflow-hidden">
                     <div className="h-full bg-[#14F195]" style={{ width: `${Math.min(100, risk)}%` }} />
                  </div>
               </div>

               {/* Bots */}
               {opponents.map(opp => (
                  <div key={opp.id} className={`p-4 border tech-border ${
                     opp.status === 'BUSTED' ? 'bg-red-950/20 border-red-500/20 opacity-60' :
                     opp.status === 'EXTRACTED' ? 'bg-yellow-500/10 border-yellow-500/30' :
                     'bg-black border-white/10'
                  }`}>
                     <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-black text-white italic">{opp.name}</span>
                        <span className={`text-[10px] font-black px-2 py-0.5 ${
                           opp.status === 'BUSTED' ? 'bg-red-500 text-black' :
                           opp.status === 'EXTRACTED' ? 'bg-yellow-500 text-black' :
                           'text-white/40'
                        }`}>
                           {opp.status}
                        </span>
                     </div>
                     {opp.status === 'EXTRACTED' && (
                        <p className="text-xs font-black text-yellow-500 text-right">LOCKED: {opp.score}</p>
                     )}
                  </div>
               ))}
            </div>

            <div className="p-4 border-t border-white/10 h-40 bg-black font-mono text-xs text-white/40 overflow-hidden">
               {logs.map((log, i) => (
                  <div key={i} className="mb-1">
                     <span className="text-[#14F195] mr-2">{'>'}</span>{log}
                  </div>
               ))}
            </div>
         </div>
      </div>
    </div>
  );
};

export default MultiplayerRaidScreen;
