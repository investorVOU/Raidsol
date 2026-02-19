
import React, { useState, useEffect, useRef, useMemo, Suspense, useCallback } from 'react';
import { GEAR_ITEMS, AVATAR_ITEMS, Difficulty, DIFFICULTY_CONFIG, RAID_BOOSTS } from '../types';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations, OrbitControls, Environment, ContactShadows, SpotLight, Sparkles } from '@react-three/drei';
import * as THREE from 'three';

interface RaidScreenProps {
  onFinish: (success: boolean, solAmount: number, points: number) => void;
  equippedGearIds: string[];
  entryFee: number;
  difficulty: Difficulty;
  activeBoosts: string[];
  equippedAvatarId?: string;
}

interface SRPopup {
  id: number;
  val: number;
  x: number;
  y: number;
}

// --- 3D FIGHTER COMPONENT ---
const MODEL_URL = 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/models/gltf/RobotExpressive/RobotExpressive.glb';

// Define Shake Animation
const ShakeStyle = `
  @keyframes aggressive-shake {
    0% { transform: translate(1px, 1px) rotate(0deg); }
    10% { transform: translate(-1px, -2px) rotate(-1deg); }
    20% { transform: translate(-3px, 0px) rotate(1deg); }
    30% { transform: translate(3px, 2px) rotate(0deg); }
    40% { transform: translate(1px, -1px) rotate(1deg); }
    50% { transform: translate(-1px, 2px) rotate(-1deg); }
    60% { transform: translate(-3px, 1px) rotate(0deg); }
    70% { transform: translate(3px, 1px) rotate(-1deg); }
    80% { transform: translate(-1px, -1px) rotate(1deg); }
    90% { transform: translate(1px, 2px) rotate(0deg); }
    100% { transform: translate(1px, -2px) rotate(-1deg); }
  }
  .shake-anim {
    animation: aggressive-shake 0.3s cubic-bezier(.36,.07,.19,.97) both infinite;
  }
`;

// Helper to get color from avatar ID
const getAvatarColor = (id?: string) => {
  if (!id) return '#ffffff';
  if (id.includes('gold') || id.includes('god')) return '#FFD700';
  if (id.includes('void') || id.includes('ghost')) return '#A855F7';
  if (id.includes('red') || id.includes('striker')) return '#EF4444';
  if (id.includes('green') || id.includes('whale')) return '#22C55E';
  
  const item = AVATAR_ITEMS.find(a => a.id === id);
  if (item?.rarity === 'EXCLUSIVE') return '#FFD700'; 
  if (item?.rarity === 'LIMITED') return '#A855F7'; 
  
  return '#00FBFF'; 
};

// Helper to get weapon shape based on gear ID
const getWeaponType = (gearIds: string[]) => {
  const mainGear = GEAR_ITEMS.find(g => gearIds.includes(g.id));
  if (!mainGear) return 'NONE';
  
  const name = mainGear.name.toLowerCase();
  if (name.includes('blade') || name.includes('sword') || name.includes('katana') || name.includes('dagger')) return 'BLADE';
  if (name.includes('hammer') || name.includes('smasher') || name.includes('wrench')) return 'HAMMER';
  if (name.includes('gun') || name.includes('scythe') || name.includes('bow')) return 'RANGED';
  if (name.includes('shield') || name.includes('guard')) return 'SHIELD';
  return 'BLADE'; 
};

interface FighterProps {
  action: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale?: number;
  color?: string; 
  gearIds?: string[];
  isEnemy?: boolean;
}

const FighterModel: React.FC<FighterProps> = ({ action, position, rotation, scale = 0.5, color = '#ffffff', gearIds = [], isEnemy = false }) => {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(MODEL_URL);
  
  const clonedScene = useMemo(() => {
    const s = scene.clone();
    s.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const m = (child as THREE.Mesh);
        m.material = (m.material as THREE.Material).clone();
        (m.material as THREE.MeshStandardMaterial).emissive = new THREE.Color(color);
        (m.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.4;
        (m.material as THREE.MeshStandardMaterial).color = new THREE.Color(color);
      }
    });
    return s;
  }, [scene, color]);

  const { actions } = useAnimations(animations, group);
  const weaponType = useMemo(() => isEnemy ? 'BLADE' : getWeaponType(gearIds), [gearIds, isEnemy]);
  
  const rightHandBone = useMemo(() => {
    let bone: THREE.Object3D | undefined;
    clonedScene.traverse((child) => {
      if (child.name === 'HandR' || child.name === 'Hand_R') {
        bone = child;
      }
    });
    return bone;
  }, [clonedScene]);

  useEffect(() => {
    let animName = 'Idle';
    if (action === 'Punch') animName = 'Punch';
    if (action === 'Jump') animName = 'Jump';
    if (action === 'Death') animName = 'Death';
    if (action === 'Dance') animName = 'Dance';
    if (action === 'Walking') animName = 'Walking';

    const current = actions[animName];
    if (current) {
        const blendTime = animName === 'Punch' ? 0.05 : 0.2;
        current.reset().fadeIn(blendTime).play();
        if (animName === 'Death') {
            current.setLoop(THREE.LoopOnce, 1);
            current.clampWhenFinished = true;
        } else if (animName === 'Punch' || animName === 'Jump') {
            current.setLoop(THREE.LoopOnce, 1);
            if (animName === 'Punch') current.timeScale = 2.0;
        } else {
            current.setLoop(THREE.LoopRepeat, Infinity);
        }
        return () => {
            current.fadeOut(blendTime);
        };
    }
  }, [action, actions]);

  return (
    <group ref={group} dispose={null} position={position} rotation={rotation} scale={scale}>
      <primitive object={clonedScene} />
      
      {rightHandBone && (
        <primitive object={rightHandBone}>
            <group position={[0, 0.4, 0]} rotation={[Math.PI / 2, 0, 0]}>
                {weaponType === 'BLADE' && (
                    <mesh position={[0, 0.8, 0]}>
                        <boxGeometry args={[0.2, 2.5, 0.1]} />
                        <meshStandardMaterial color={isEnemy ? "#ef4444" : "#00fbff"} emissive={isEnemy ? "#ef4444" : "#00fbff"} emissiveIntensity={2} />
                        <Sparkles count={10} scale={2} size={2} speed={0.4} opacity={0.5} color={isEnemy ? "red" : "cyan"} />
                    </mesh>
                )}
                {weaponType === 'HAMMER' && (
                    <group position={[0, 1.5, 0]}>
                        <mesh>
                            <boxGeometry args={[1, 0.6, 0.6]} />
                            <meshStandardMaterial color="#888" metalness={0.8} roughness={0.2} />
                        </mesh>
                        <mesh position={[0, -1, 0]}>
                            <cylinderGeometry args={[0.1, 0.1, 2]} />
                            <meshStandardMaterial color="#333" />
                        </mesh>
                    </group>
                )}
                {weaponType === 'SHIELD' && (
                    <mesh position={[0, 0, 0.5]} rotation={[0, 0, 0]}>
                        <cylinderGeometry args={[1, 1, 0.1, 6]} />
                        <meshStandardMaterial color={color} transparent opacity={0.6} side={THREE.DoubleSide} />
                    </mesh>
                )}
                 {weaponType === 'RANGED' && (
                    <mesh position={[0, 0.5, 0.2]} rotation={[-Math.PI / 4, 0, 0]}>
                        <boxGeometry args={[0.3, 1.5, 0.3]} />
                        <meshStandardMaterial color="#333" />
                        <mesh position={[0, 0.8, 0]}>
                           <sphereGeometry args={[0.2]} />
                           <meshStandardMaterial color={color} emissive={color} emissiveIntensity={5} />
                        </mesh>
                    </mesh>
                )}
            </group>
        </primitive>
      )}
      <pointLight position={[0, 4, 0]} distance={3} intensity={5} color={color} />
    </group>
  );
};

useGLTF.preload(MODEL_URL);

const RaidScreen: React.FC<RaidScreenProps> = ({ onFinish, equippedGearIds, entryFee, difficulty, activeBoosts, equippedAvatarId }) => {
  const diffConfig = DIFFICULTY_CONFIG[difficulty];

  // Equipment Effects Calculation
  const gearStats = useMemo(() => {
    let mult = 0;
    let riskReduc = 0;

    equippedGearIds.forEach(id => {
      const item = GEAR_ITEMS.find(g => g.id === id);
      if (item) {
        if (item.effect === 'MULT_BOOST') mult += item.benefitValue || 0;
        if (item.effect === 'RISK_REDUCTION') riskReduc += item.benefitValue || 0;
      }
    });

    return { mult, riskReduc };
  }, [equippedGearIds]);

  // Boost Logic
  const boostStats = useMemo(() => {
    let driftMultiplier = 1.0;
    let startMultBonus = 0;

    activeBoosts.forEach(bId => {
      const boost = RAID_BOOSTS.find(b => b.id === bId);
      if (boost) {
        if (boost.effectType === 'RISK') driftMultiplier *= boost.value;
        if (boost.effectType === 'MULTIPLIER') startMultBonus += boost.value;
      }
    });
    return { driftMultiplier, startMultBonus };
  }, [activeBoosts]);

  const baseRisk = Math.max(0, -gearStats.riskReduc + diffConfig.riskMod);
  const initialMultiplier = 1.0 + gearStats.mult + boostStats.startMultBonus;
  
  // STRICT UNIVERSAL TIME
  const initialTime = 30; 

  const [points, setPoints] = useState(0);
  const [risk, setRisk] = useState(baseRisk);
  const [timeLeft, setTimeLeft] = useState(initialTime);
  const [multiplier, setMultiplier] = useState(initialMultiplier);
  const [flash, setFlash] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [logs, setLogs] = useState<string[]>(['LINK_STABLE', 'TIMER_SYNCED']);
  const [isEnding, setIsEnding] = useState<'WIN' | 'LOSS' | null>(null);
  const [popups, setPopups] = useState<SRPopup[]>([]);
  
  // Anti-Cheat / Farming Prevention
  const [hasInteracted, setHasInteracted] = useState(false);
  const [consecutiveDefends, setConsecutiveDefends] = useState(0);
  
  // Fighter Action States
  const [userAction, setUserAction] = useState('Idle');
  const [enemyAction, setEnemyAction] = useState('Idle');
  
  // -- REFS FOR LOOP STATE ACCESS --
  const stateRef = useRef({
    multiplier,
    risk,
    points,
    isEnding,
    enemyAction,
    timeLeft
  });

  // Keep refs synced with state
  useEffect(() => {
    stateRef.current = { multiplier, risk, points, isEnding, enemyAction, timeLeft };
  }, [multiplier, risk, points, isEnding, enemyAction, timeLeft]);

  // Determine User Visuals from Props
  const userColor = useMemo(() => getAvatarColor(equippedAvatarId), [equippedAvatarId]);

  const addSRPopup = (val: number) => {
    const id = Date.now() + Math.random();
    const x = Math.floor(Math.random() * 40) - 20; 
    const y = Math.floor(Math.random() * 20) - 10;
    setPopups(prev => [...prev, { id, val, x, y }]);
    setTimeout(() => {
      setPopups(prev => prev.filter(p => p.id !== id));
    }, 1000);
  };

  const addLog = (msg: string) => {
    setLogs(prev => [msg, ...prev].slice(0, 2));
  };

  // Define handleBust with useCallback to be stable, but we also put it in a Ref for the interval
  const handleBust = useCallback((reason: string = 'PROTOCOL_FAILURE') => {
    // If already ending, do nothing
    if (stateRef.current.isEnding) return;
    
    addLog(reason);
    setIsEnding('LOSS');
    setUserAction('Death');
    setEnemyAction('Dance');
    setShake(true);
    setTimeout(() => {
      onFinish(false, 0, stateRef.current.points);
    }, 2500);
  }, [onFinish]); // dependencies

  const handleBustRef = useRef(handleBust);
  useEffect(() => { handleBustRef.current = handleBust; }, [handleBust]);

  // --- MAIN GAME LOOP (Uninterrupted) ---
  useEffect(() => {
    const startTime = Date.now();
    
    const intervalId = setInterval(() => {
      const state = stateRef.current;
      
      // Stop logic if game is ending
      if (state.isEnding) return;

      // 1. STRICT TIME CALCULATION (System Clock Delta)
      const now = Date.now();
      const elapsedSeconds = Math.floor((now - startTime) / 1000);
      const newTimeLeft = Math.max(0, initialTime - elapsedSeconds);
      
      // Update visual time only if changed
      if (newTimeLeft !== state.timeLeft) {
         setTimeLeft(newTimeLeft);
      }

      // Check Timeout Condition
      if (newTimeLeft <= 0) {
         handleBustRef.current('TIMEOUT_EXPIRED');
         return; // Exit loop for this tick
      }

      // 2. RISK CALCULATION
      const ticks = elapsedSeconds; 
      const timePenalty = ticks * 0.1; 
      const greedFactor = state.multiplier > 2.0 ? 1.8 : 1.0; 
      const houseEdge = 1.25; 
      
      const baseDrift = (2.5 + (Math.random() * 3.5)) + timePenalty; 
      const totalDrift = baseDrift * diffConfig.driftMod * boostStats.driftMultiplier * greedFactor * houseEdge;
      
      const randomSpike = Math.random() > 0.95 ? 8 : 0; 
      if (randomSpike > 0 && !state.isEnding) addLog('NETWORK_LAG_DETECTED (+RISK)');

      const nextRisk = state.risk + totalDrift + randomSpike;
      
      if (nextRisk >= 100) {
        handleBustRef.current('RISK_OVERLOAD');
        setRisk(100);
        return;
      } else {
        setRisk(nextRisk);
      }
      
      // Visual Shake on High Risk
      if (nextRisk > 75 && Math.random() > 0.6) {
        setShake(true);
        setTimeout(() => setShake(false), 100);
      }
      
      // 3. POINTS CALCULATION
      const yieldGain = Math.floor(15 * state.multiplier * diffConfig.multMod);
      setPoints(prev => {
          const next = prev + yieldGain;
          if (Math.floor(next / 500) > Math.floor(prev / 500)) {
             addSRPopup(5);
          }
          return next;
      });

      // 4. ENEMY AMBIENT ANIMATION
      if (Math.random() > 0.7 && state.enemyAction === 'Idle') {
           setEnemyAction('Walking');
           setTimeout(() => { if(!stateRef.current.isEnding) setEnemyAction('Idle') }, 1000);
      }

    }, 1000);

    return () => clearInterval(intervalId);
  }, []); 

  const handleCashOut = () => {
    if (isEnding) return;
    if (!hasInteracted) return; // Guard clause just in case

    setIsEnding('WIN');
    setUserAction('Dance');
    setEnemyAction('Death');
    const solReward = (points / 5000) * entryFee + entryFee;
    setTimeout(() => {
      onFinish(true, solReward, points);
    }, 2500);
  };

  const triggerActionVisuals = (color: string) => {
    if (isEnding) return;
    setFlash(color);
    setShake(true);
    setTimeout(() => {
      setFlash(null);
      setShake(false);
    }, 300); 
  };

  const handleAttack = () => {
    if (isEnding) return;
    setHasInteracted(true); // Mark as interacted
    
    // Reset consecutive defend counter on attack
    setConsecutiveDefends(0);

    triggerActionVisuals('rgba(239, 68, 68, 0.4)');
    
    setMultiplier(prev => prev + 0.35);
    setRisk(prev => {
        const added = 15 + Math.random() * 10; 
        const next = Math.min(99.9, prev + added);
        
        if (next > 85 && Math.random() > 0.8) {
             addLog('CRITICAL_OVERLOAD');
             setTimeout(() => handleBust('RISK_CRITICAL'), 300);
             return 100;
        }
        return next;
    });
    setPoints(prev => prev + 800);
    
    addLog('ATTACK_INITIATED');
    addSRPopup(25); 
    
    setUserAction('Punch');
    setTimeout(() => {
       if (!stateRef.current.isEnding) setUserAction('Idle'); 
    }, 600);

    setTimeout(() => {
        if (!stateRef.current.isEnding) {
            setEnemyAction('Punch'); 
            setTimeout(() => triggerActionVisuals('rgba(255, 255, 255, 0.2)'), 200);
            setTimeout(() => { if (!stateRef.current.isEnding) setEnemyAction('Idle') }, 600);
        }
    }, 300);
  };

  const handleDefend = () => {
    if (isEnding) return;
    setHasInteracted(true); // Mark as interacted

    // Increment consecutive counter
    const newDefendCount = consecutiveDefends + 1;
    setConsecutiveDefends(newDefendCount);

    if (newDefendCount >= 4) {
        // PENALTY: Cowardice Detected
        addLog('COWARDICE_PENALTY');
        triggerActionVisuals('rgba(255, 0, 0, 0.6)'); // Red flash warning
        setRisk(prev => Math.min(100, prev + 5)); // Actually INCREASES risk
        setMultiplier(prev => Math.max(1, prev - 1.0)); // Crashes multiplier
        setUserAction('Death'); // Briefly trip
        setTimeout(() => {
           if (!stateRef.current.isEnding) setUserAction('Idle'); 
        }, 500);
        return;
    }

    if (newDefendCount === 3) {
        // WARNING: Shield Overheat
        addLog('SHIELD_OVERHEAT');
        triggerActionVisuals('rgba(255, 165, 0, 0.4)'); // Orange warning
        setRisk(prev => Math.max(0, prev - 2)); // Minimal reduction
        setMultiplier(prev => Math.max(1, prev - 0.5)); // Heavy mult penalty
    } else {
        // Normal Defend (1st or 2nd time)
        triggerActionVisuals('rgba(0, 251, 255, 0.3)');
        addLog('SHIELD_STABLE');
        const reduction = 8 + Math.random() * 4;
        setRisk(prev => Math.max(0, prev - reduction)); 
        setMultiplier(prev => Math.max(1, prev - 0.2));
    }
    
    addSRPopup(newDefendCount > 2 ? 0 : 8); 
    
    setUserAction('Jump');
    setTimeout(() => {
       if (!stateRef.current.isEnding) setUserAction('Idle'); 
    }, 800);
  };

  const currentYield = ((points / 5000) * entryFee + entryFee).toFixed(4);
  const isUrgent = timeLeft < 10;
  const isCritical = timeLeft < 5;
  const timerGlowClass = isCritical 
    ? 'shadow-[0_0_20px_rgba(239,68,68,0.6)] border-red-500 animate-pulse bg-red-950/40' 
    : isUrgent 
    ? 'shadow-[0_0_15px_rgba(239,68,68,0.3)] border-red-500/50 bg-red-950/20' 
    : 'shadow-[0_0_10px_rgba(0,251,255,0.2)] border-[#00FBFF]/30';

  return (
    <div className={`h-full w-full flex flex-col relative overflow-hidden transition-colors duration-100 ${shake ? 'shake-anim' : ''} ${isEnding === 'LOSS' ? 'bg-red-950/20' : ''}`} style={{ backgroundColor: flash || 'transparent' }}>
      <style>{ShakeStyle}</style>
      
      {/* Background Pulse */}
      {(risk > 80 || isUrgent) && !isEnding && (
        <div className={`absolute inset-0 pointer-events-none z-0 ${isCritical ? 'bg-red-600/15' : 'bg-red-600/5'} animate-pulse`} />
      )}

      {/* Popups */}
      <div className="absolute inset-0 pointer-events-none z-[60] flex items-center justify-center">
        {popups.map(p => (
          <div 
            key={p.id} 
            className="absolute animate-sr-popup pointer-events-none flex items-center gap-1"
            style={{ transform: `translate(${p.x}px, ${p.y}px)` }}
          >
            <span className="text-4xl font-black text-yellow-500 italic drop-shadow-[0_0_10px_rgba(234,179,8,0.8)]">+{p.val}</span>
          </div>
        ))}
      </div>

      {/* WIN OVERLAY */}
      {isEnding === 'WIN' && (
        <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-[#14F195]/20 backdrop-blur-sm animate-in fade-in duration-300">
           <div className="relative z-10 flex flex-col items-center">
              <span className="text-5xl font-black text-[#14F195] glitch-text italic tracking-tighter uppercase">EXTRACTION_OK</span>
              <span className="text-xs text-white font-black uppercase tracking-[0.6em] mt-4 animate-pulse">UPLOADING_CREDITS</span>
           </div>
        </div>
      )}

      {/* LOSS OVERLAY */}
      {isEnding === 'LOSS' && (
        <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-red-950/40 backdrop-blur-sm animate-in fade-in duration-300">
           <div className="relative z-10 flex flex-col items-center">
              <span className="text-5xl font-black text-red-500 glitch-text italic tracking-tighter uppercase">LINK_SEVERED</span>
              <span className="text-xs text-red-500/60 font-black uppercase tracking-[0.6em] mt-4 animate-pulse">
                {timeLeft <= 0 ? 'TIMEOUT_EXPIRED' : 'PROTOCOL_FAILURE'}
              </span>
           </div>
        </div>
      )}

      {/* MAIN LAYOUT: FLEX COLUMN (NO SCROLL) */}
      <div className={`flex flex-col h-full w-full max-w-lg mx-auto z-10 p-4 transition-opacity duration-300 ${isEnding ? 'opacity-0 scale-95' : 'opacity-100'}`}>
        
        {/* 1. TOP HUD (Fixed) */}
        <div className="shrink-0 flex justify-between items-center gap-2 mb-2">
          <div className="flex-1 bg-black/80 p-2 border border-white/10 tech-border relative overflow-hidden">
            <p className="text-[9px] text-white/40 font-black uppercase tracking-widest leading-none mb-1">EXTRACT_VAL</p>
            <div className="flex items-baseline gap-2">
              <span className={`mono text-xl font-black italic tracking-tighter ${risk > 85 ? 'text-red-500' : 'text-white'}`}>
                {currentYield}
              </span>
              <span className="text-[10px] text-[#14F195] font-black italic">SOL</span>
            </div>
          </div>
          
          <div className={`relative w-28 px-2 py-2 bg-black/80 border tech-border flex flex-col items-center ${timerGlowClass}`}>
            <span className={`text-[8px] font-black uppercase tracking-widest mb-0.5 ${isUrgent ? 'text-red-500 animate-pulse' : 'text-white/30'}`}>
              TIME_LEFT
            </span>
            <div className="flex items-baseline gap-1">
               <span className={`mono text-2xl font-black leading-none ${isUrgent ? 'text-red-500' : 'text-[#00FBFF]'}`}>
                 {Math.max(0, Math.floor(timeLeft))}
               </span>
               <span className="text-[10px] font-black uppercase italic text-white/20">s</span>
            </div>
          </div>
        </div>

        {/* 2. MIDDLE SECTION (Flexible Growth) */}
        <div className="flex-1 relative flex items-center justify-center min-h-0">
          
          {/* Logs Background */}
          <div className="absolute top-2 left-2 z-0 opacity-40 pointer-events-none">
             {logs.map((log, i) => (
                <div key={i} className={`text-[9px] mono font-bold uppercase tracking-widest mb-1 ${log.includes('PENALTY') || log.includes('OVERHEAT') ? 'text-red-500' : 'text-[#14F195]'}`}>
                   {'>'} {log}
                </div>
             ))}
          </div>

          {/* 3D Scene Container */}
          <div className="absolute inset-0 z-0">
             <Canvas shadows camera={{ position: [0, 0, 6.5], fov: 50 }}>
                <ambientLight intensity={0.4} />
                <SpotLight position={[10, 10, 10]} angle={0.3} penumbra={1} intensity={80} castShadow />
                <pointLight position={[-10, 5, -5]} intensity={0.5} color="cyan" />
                <pointLight position={[10, 5, -5]} intensity={0.5} color="red" />
                
                <Suspense fallback={null}>
                   {/* USER FIGHTER (Left) - Uses userColor and equippedGearIds */}
                   <FighterModel 
                      action={userAction} 
                      position={[-1.2, -2.5, 0]} 
                      rotation={[0, Math.PI / 2, 0]} 
                      scale={0.5}
                      color={userColor}
                      gearIds={equippedGearIds} 
                   />

                   {/* ENEMY FIGHTER (Right) */}
                   <FighterModel 
                      action={enemyAction} 
                      position={[1.2, -2.5, 0]} 
                      rotation={[0, -Math.PI / 2, 0]} 
                      scale={0.5}
                      color="#EF4444"
                      isEnemy={true} 
                   />

                   <Environment preset="city" />
                   <ContactShadows position={[0, -2.5, 0]} opacity={0.5} scale={10} blur={1.5} far={0.8} />
                </Suspense>
                
                <OrbitControls enableZoom={false} enablePan={false} minPolarAngle={Math.PI / 2.5} maxPolarAngle={Math.PI / 1.8} />
             </Canvas>
          </div>

          {/* Risk Ring Overlay */}
          <div className="relative z-10 w-56 h-56 md:w-64 md:h-64 flex items-center justify-center pointer-events-none">
             <div className="absolute inset-0 border-[3px] border-dashed rounded-full animate-[spin_30s_linear_infinite] transition-colors duration-300" 
                  style={{ borderColor: risk > 80 ? 'rgba(239,68,68,0.6)' : risk > 50 ? 'rgba(249,115,22,0.6)' : 'rgba(153,69,255,0.4)' }}>
             </div>
             
             {/* Floating Tags within Scene */}
             <div className="absolute top-0 right-0 bg-black/80 backdrop-blur-sm px-2 py-1 border tech-border border-white/10">
                <p className="text-[8px] font-black text-white/40 uppercase tracking-widest">RISK</p>
                <div className="flex items-baseline">
                  <span className={`mono text-xl font-black ${risk > 85 ? 'text-red-500 animate-pulse' : 'text-white'}`}>{Math.floor(risk)}</span>
                  <span className="text-[10px] text-white/40">%</span>
                </div>
             </div>
             
             <div className="absolute bottom-0 left-0 bg-black/80 backdrop-blur-sm px-2 py-1 border tech-border border-white/10">
                <span className={`text-[10px] font-black uppercase italic ${diffConfig.color}`}>
                  {difficulty}
                </span>
             </div>
          </div>
        </div>

        {/* 3. BOTTOM CONTROLS (Fixed Height) */}
        <div className="shrink-0 mt-2 space-y-2 pb-16 md:pb-4">
           
           {/* Multiplier Bar */}
           <div className="bg-black/60 backdrop-blur-sm p-2 rounded border border-white/5 flex justify-between items-end">
              <div>
                <p className="text-[8px] text-white/30 font-black uppercase tracking-widest mb-0.5">MULT</p>
                <div className="flex items-center gap-2">
                  <p className={`mono text-2xl font-black italic ${multiplier > 3 ? 'text-[#9945FF] chromatic-aberration' : 'text-white'}`}>
                    {multiplier.toFixed(2)}x
                  </p>
                  {activeBoosts.includes('score_mult') && (
                     <span className="px-1 py-0.5 bg-yellow-500/10 border border-yellow-500/30 text-[8px] font-black text-yellow-500 uppercase rounded">BOOST</span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-[8px] text-white/30 font-black uppercase tracking-widest mb-0.5">SCORE</p>
                <p className="mono text-xl font-black text-white/60">{points.toLocaleString()}</p>
              </div>
           </div>

           {/* Buttons Grid */}
           <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={handleAttack}
                disabled={!!isEnding}
                className="col-span-1 bg-black/90 border border-red-600/50 p-3 tech-border active:translate-y-0.5 transition-all disabled:opacity-50 group"
              >
                <div className="flex flex-col items-center group-active:scale-95 transition-transform">
                  <span className="text-base font-black uppercase italic tracking-tighter text-red-500">ATTACK</span>
                  <span className="text-[8px] font-bold text-red-500/40 uppercase tracking-widest">RISK ++</span>
                </div>
              </button>

              <button 
                onClick={handleDefend}
                disabled={!!isEnding}
                className="col-span-1 bg-black/90 border border-[#00FBFF]/50 p-3 tech-border active:translate-y-0.5 transition-all disabled:opacity-50 group"
              >
                <div className="flex flex-col items-center group-active:scale-95 transition-transform">
                  <span className="text-base font-black uppercase italic tracking-tighter text-[#00FBFF]">DEFEND</span>
                  <span className="text-[8px] font-bold text-[#00FBFF]/40 uppercase tracking-widest">
                     {consecutiveDefends > 1 ? (consecutiveDefends > 2 ? 'OVERHEAT!' : 'STABLE') : 'RISK --'}
                  </span>
                </div>
              </button>

              <button 
                onClick={handleCashOut}
                disabled={!!isEnding || !hasInteracted}
                className={`col-span-2 p-4 tech-border transition-all duration-300 disabled:opacity-80 ${
                  !hasInteracted 
                    ? 'bg-[#1a1a1a] text-white/20 border-white/5 cursor-not-allowed grayscale' 
                    : 'bg-[#14F195] text-black shadow-[0_0_20px_rgba(20,241,149,0.2)] active:translate-y-1'
                }`}
              >
                <div className="flex flex-col items-center">
                  <span className="text-2xl font-black uppercase italic tracking-tighter leading-none">
                    {!hasInteracted ? 'ENGAGE_TO_UNLOCK' : 'EXIT & CASH OUT'}
                  </span>
                  <span className="text-[9px] font-black uppercase mt-0.5 tracking-[0.2em] opacity-60 italic">
                    {!hasInteracted ? 'PROTOCOL_IDLE' : 'SECURE_PROFITS'}
                  </span>
                </div>
              </button>
           </div>
        </div>
        
      </div>
    </div>
  );
};

export default RaidScreen;
