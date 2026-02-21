
import React, { useState, useEffect, useRef, useMemo, Suspense, useCallback } from 'react';
import { GEAR_ITEMS, AVATAR_ITEMS, Difficulty, DIFFICULTY_CONFIG, RAID_BOOSTS } from '../types';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations, OrbitControls, Environment, ContactShadows, SpotLight, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { useGameSounds } from '../hooks/useGameSounds';

interface RaidScreenProps {
  onFinish: (success: boolean, solAmount: number, points: number, elapsedSec: number) => void;
  equippedGearIds: string[];
  entryFee: number;
  difficulty: Difficulty;
  activeBoosts: string[];
  equippedAvatarId?: string;
  ticketBoost?: boolean;  // +10% win reward when true
}

interface Spark {
  id: number;
  dx: number;
  dy: number;
  color: string;
  size: number;
}

interface DamagePopup {
  id: number;
  text: string;
  color: string;
  x: number;
  y: number;
  large: boolean;
}

// ─── CSS ─────────────────────────────────────────────────────────────────────
const GameStyles = `
  @keyframes shake-mild {
    0%,100% { transform: translate(0,0) rotate(0deg); }
    25%     { transform: translate(-2px,1px) rotate(-0.3deg); }
    50%     { transform: translate(2px,-1px) rotate(0.3deg); }
    75%     { transform: translate(-1px,2px) rotate(-0.2deg); }
  }
  @keyframes shake-heavy {
    0%,100% { transform: translate(0,0) rotate(0deg); }
    15%     { transform: translate(-6px,4px) rotate(-0.9deg); }
    30%     { transform: translate(6px,-4px) rotate(0.9deg); }
    45%     { transform: translate(-5px,-4px) rotate(-0.6deg); }
    60%     { transform: translate(5px,4px) rotate(0.6deg); }
    75%     { transform: translate(-3px,2px) rotate(-0.3deg); }
    90%     { transform: translate(3px,-2px) rotate(0.3deg); }
  }
  @keyframes shake-critical {
    0%,100% { transform: translate(0,0) rotate(0deg) scale(1); }
    10%     { transform: translate(-10px,6px) rotate(-1.4deg) scale(1.012); }
    20%     { transform: translate(10px,-6px) rotate(1.4deg) scale(0.988); }
    30%     { transform: translate(-9px,-7px) rotate(-1.1deg) scale(1.01); }
    40%     { transform: translate(9px,7px) rotate(1.1deg) scale(0.99); }
    50%     { transform: translate(-7px,5px) rotate(-0.9deg) scale(1.006); }
    60%     { transform: translate(7px,-5px) rotate(0.9deg) scale(0.994); }
    70%     { transform: translate(-6px,-5px) rotate(-0.6deg); }
    80%     { transform: translate(6px,5px) rotate(0.6deg); }
    90%     { transform: translate(-4px,3px) rotate(-0.3deg); }
  }
  @keyframes spark-fly {
    0%   { transform: translate(0,0) scale(1.2); opacity: 1; }
    60%  { opacity: 0.7; }
    100% { transform: translate(calc(var(--dx) * 1px), calc(var(--dy) * 1px)) scale(0); opacity: 0; }
  }
  @keyframes dmg-float {
    0%   { transform: translateY(0) scale(0.6); opacity: 0; }
    15%  { transform: translateY(-8px) scale(1.2); opacity: 1; }
    70%  { opacity: 1; }
    100% { transform: translateY(-60px) scale(0.9); opacity: 0; }
  }
  @keyframes critical-flash {
    0%,100% { opacity: 1; }
    25%     { opacity: 0.4; }
    75%     { opacity: 0.4; }
  }
  .shake-mild     { animation: shake-mild     0.28s cubic-bezier(.36,.07,.19,.97) infinite; }
  .shake-heavy    { animation: shake-heavy    0.22s cubic-bezier(.36,.07,.19,.97) infinite; }
  .shake-critical { animation: shake-critical 0.18s cubic-bezier(.36,.07,.19,.97) infinite; }
  .spark          { position: absolute; border-radius: 50%; animation: spark-fly 0.38s ease-out forwards; pointer-events: none; }
  .dmg-popup      { position: absolute; animation: dmg-float 1.1s ease-out forwards; pointer-events: none; font-family: 'JetBrains Mono', monospace; font-weight: 900; text-transform: uppercase; white-space: nowrap; }
  .critical-text  { animation: critical-flash 0.15s ease-in-out 3; }
`;

// ─── 3D Fighter ───────────────────────────────────────────────────────────────
const MODEL_URL = 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/models/gltf/RobotExpressive/RobotExpressive.glb';

const getAvatarColor = (id?: string) => {
  if (!id) return '#00FBFF';
  if (id.includes('gold') || id.includes('god'))    return '#FFD700';
  if (id.includes('void') || id.includes('ghost'))  return '#A855F7';
  if (id.includes('red')  || id.includes('striker'))return '#EF4444';
  if (id.includes('green')|| id.includes('whale'))  return '#22C55E';
  const item = AVATAR_ITEMS.find(a => a.id === id);
  if (item?.rarity === 'EXCLUSIVE') return '#FFD700';
  if (item?.rarity === 'LIMITED')   return '#A855F7';
  return '#00FBFF';
};

const getWeaponType = (gearIds: string[]) => {
  const g = GEAR_ITEMS.find(gi => gearIds.includes(gi.id));
  if (!g) return 'NONE';
  const n = g.name.toLowerCase();
  if (n.includes('blade') || n.includes('sword') || n.includes('katana') || n.includes('dagger')) return 'BLADE';
  if (n.includes('hammer') || n.includes('smasher') || n.includes('wrench')) return 'HAMMER';
  if (n.includes('gun') || n.includes('scythe') || n.includes('bow')) return 'RANGED';
  if (n.includes('shield') || n.includes('guard')) return 'SHIELD';
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

const FighterModel: React.FC<FighterProps> = ({
  action, position, rotation, scale = 0.65, color = '#ffffff', gearIds = [], isEnemy = false,
}) => {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(MODEL_URL);

  const clonedScene = useMemo(() => {
    const s = scene.clone();
    s.traverse(child => {
      if ((child as THREE.Mesh).isMesh) {
        const m = child as THREE.Mesh;
        m.material = (m.material as THREE.Material).clone();
        (m.material as THREE.MeshStandardMaterial).emissive = new THREE.Color(color);
        (m.material as THREE.MeshStandardMaterial).emissiveIntensity = isEnemy ? 0.5 : 0.35;
        (m.material as THREE.MeshStandardMaterial).color = new THREE.Color(color);
      }
    });
    return s;
  }, [scene, color, isEnemy]);

  const { actions } = useAnimations(animations, group);
  const weaponType = useMemo(() => isEnemy ? 'BLADE' : getWeaponType(gearIds), [gearIds, isEnemy]);

  const rightHandBone = useMemo(() => {
    let bone: THREE.Object3D | undefined;
    clonedScene.traverse(c => { if (c.name === 'HandR' || c.name === 'Hand_R') bone = c; });
    return bone;
  }, [clonedScene]);

  // Slight float animation on idle
  useFrame((_, delta) => {
    if (group.current && (action === 'Idle' || action === 'Walking')) {
      group.current.position.y = position[1] + Math.sin(Date.now() * 0.002) * 0.04;
    }
  });

  useEffect(() => {
    let animName = 'Idle';
    if (action === 'Punch')   animName = 'Punch';
    if (action === 'Jump')    animName = 'Jump';
    if (action === 'Death')   animName = 'Death';
    if (action === 'Dance')   animName = 'Dance';
    if (action === 'Walking') animName = 'Walking';
    const cur = actions[animName];
    if (cur) {
      const blend = animName === 'Punch' ? 0.04 : 0.18;
      cur.reset().fadeIn(blend).play();
      if (animName === 'Death') { cur.setLoop(THREE.LoopOnce, 1); cur.clampWhenFinished = true; }
      else if (animName === 'Punch' || animName === 'Jump') {
        cur.setLoop(THREE.LoopOnce, 1);
        if (animName === 'Punch') cur.timeScale = 2.2;
      } else { cur.setLoop(THREE.LoopRepeat, Infinity); }
      return () => { cur.fadeOut(blend); };
    }
  }, [action, actions]);

  return (
    <group ref={group} dispose={null} position={position} rotation={rotation} scale={scale}>
      <primitive object={clonedScene} />
      {rightHandBone && (
        <primitive object={rightHandBone}>
          <group position={[0, 0.4, 0]} rotation={[Math.PI / 2, 0, 0]}>
            {weaponType === 'BLADE' && (
              <mesh position={[0, 0.9, 0]}>
                <boxGeometry args={[0.18, 2.6, 0.08]} />
                <meshStandardMaterial color={isEnemy ? '#ef4444' : '#00fbff'} emissive={isEnemy ? '#ef4444' : '#00fbff'} emissiveIntensity={2.5} />
                <Sparkles count={12} scale={2.2} size={3} speed={0.5} opacity={0.6} color={isEnemy ? 'red' : 'cyan'} />
              </mesh>
            )}
            {weaponType === 'HAMMER' && (
              <group position={[0, 1.6, 0]}>
                <mesh><boxGeometry args={[1.1, 0.65, 0.65]} /><meshStandardMaterial color="#888" metalness={0.9} roughness={0.15} /></mesh>
                <mesh position={[0, -1.1, 0]}><cylinderGeometry args={[0.1, 0.1, 2.2]} /><meshStandardMaterial color="#333" /></mesh>
              </group>
            )}
            {weaponType === 'SHIELD' && (
              <mesh position={[0, 0, 0.6]} rotation={[0, 0, 0]}>
                <cylinderGeometry args={[1.1, 1.1, 0.1, 6]} />
                <meshStandardMaterial color={color} transparent opacity={0.65} side={THREE.DoubleSide} emissive={color} emissiveIntensity={0.5} />
              </mesh>
            )}
            {weaponType === 'RANGED' && (
              <mesh position={[0, 0.5, 0.2]} rotation={[-Math.PI / 4, 0, 0]}>
                <boxGeometry args={[0.3, 1.6, 0.3]} />
                <meshStandardMaterial color="#333" />
                <mesh position={[0, 0.9, 0]}>
                  <sphereGeometry args={[0.22]} />
                  <meshStandardMaterial color={color} emissive={color} emissiveIntensity={5} />
                </mesh>
              </mesh>
            )}
          </group>
        </primitive>
      )}
      <pointLight position={[0, 4, 0]} distance={4} intensity={isEnemy ? 8 : 6} color={color} />
    </group>
  );
};

useGLTF.preload(MODEL_URL);

// ─── Main Screen ──────────────────────────────────────────────────────────────
const RaidScreen: React.FC<RaidScreenProps> = ({
  onFinish, equippedGearIds, entryFee, difficulty, activeBoosts, equippedAvatarId, ticketBoost = false,
}) => {
  const sounds = useGameSounds();
  const diffConfig = DIFFICULTY_CONFIG[difficulty];

  const gearStats = useMemo(() => {
    let mult = 0, riskReduc = 0, timeBoost = 0;
    equippedGearIds.forEach(id => {
      const item = GEAR_ITEMS.find(g => g.id === id);
      if (item) {
        if (item.effect === 'MULT_BOOST')    mult      += item.benefitValue || 0;
        if (item.effect === 'RISK_REDUCTION')riskReduc += item.benefitValue || 0;
        if (item.effect === 'TIME_BOOST')    timeBoost += item.benefitValue || 0;
      }
    });
    return { mult, riskReduc, timeBoost };
  }, [equippedGearIds]);

  const boostStats = useMemo(() => {
    let driftMultiplier = 1.0, startMultBonus = 0;
    activeBoosts.forEach(bId => {
      const boost = RAID_BOOSTS.find(b => b.id === bId);
      if (boost) {
        if (boost.effectType === 'RISK')       driftMultiplier  *= boost.value;
        if (boost.effectType === 'MULTIPLIER') startMultBonus   += boost.value;
      }
    });
    return { driftMultiplier, startMultBonus };
  }, [activeBoosts]);

  const gearRiskFactor  = Math.max(0.4, 1 - gearStats.riskReduc / 100);
  const baseRisk        = Math.max(0, diffConfig.riskMod - gearStats.riskReduc);
  const initialMultiplier = 1.0 + gearStats.mult + boostStats.startMultBonus;
  const initialTime     = 30 + gearStats.timeBoost;

  const [points,     setPoints]     = useState(0);
  const [risk,       setRisk]       = useState(baseRisk);
  const [timeLeft,   setTimeLeft]   = useState(initialTime);
  const [multiplier, setMultiplier] = useState(initialMultiplier);
  const [flash,      setFlash]      = useState<string | null>(null);
  const [logs,       setLogs]       = useState<string[]>(['LINK_STABLE', 'TIMER_SYNCED']);
  const [isEnding,   setIsEnding]   = useState<'WIN' | 'LOSS' | null>(null);
  const [sparks,     setSparks]     = useState<Spark[]>([]);
  const [dmgPopups,  setDmgPopups]  = useState<DamagePopup[]>([]);

  // Grace period
  const [graceCount,  setGraceCount]  = useState(3);
  const [graceActive, setGraceActive] = useState(true);

  // Anti-cheat
  const [hasInteracted,      setHasInteracted]      = useState(false);
  const [consecutiveDefends, setConsecutiveDefends] = useState(0);

  // Fighter actions
  const [userAction,  setUserAction]  = useState('Idle');
  const [enemyAction, setEnemyAction] = useState('Idle');

  // Refs
  const stateRef = useRef({ multiplier, risk, points, isEnding, enemyAction, timeLeft });
  useEffect(() => {
    stateRef.current = { multiplier, risk, points, isEnding, enemyAction, timeLeft };
  }, [multiplier, risk, points, isEnding, enemyAction, timeLeft]);

  const userColor  = useMemo(() => getAvatarColor(equippedAvatarId), [equippedAvatarId]);
  const weaponType = useMemo(() => getWeaponType(equippedGearIds),    [equippedGearIds]);

  // Grace period countdown
  useEffect(() => {
    if (!graceActive) return;
    if (graceCount <= 0) {
      sounds.playCountdownTick(true);
      const t = setTimeout(() => setGraceActive(false), 700);
      return () => clearTimeout(t);
    }
    sounds.playCountdownTick(false);
    const t = setTimeout(() => setGraceCount(prev => prev - 1), 1000);
    return () => clearTimeout(t);
  }, [graceCount, graceActive]); // eslint-disable-line

  // ── Spawn sparks ──────────────────────────────────────────────────────────
  const spawnSparks = useCallback((c1: string, c2: string, count = 12) => {
    const newSparks: Spark[] = Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.6;
      const speed = 50 + Math.random() * 90;
      return {
        id: Date.now() + i + Math.random(),
        dx: Math.cos(angle) * speed,
        dy: Math.sin(angle) * speed,
        color: i % 2 === 0 ? c1 : c2,
        size: 5 + Math.random() * 10,
      };
    });
    setSparks(prev => [...prev, ...newSparks]);
    setTimeout(() => {
      const ids = new Set(newSparks.map(s => s.id));
      setSparks(prev => prev.filter(s => !ids.has(s.id)));
    }, 420);
  }, []);

  // ── Spawn damage popup ────────────────────────────────────────────────────
  const addDmgPopup = useCallback((text: string, color: string, large = false) => {
    const id = Date.now() + Math.random();
    const x  = 30 + Math.random() * 40;
    const y  = 20 + Math.random() * 45;
    setDmgPopups(prev => [...prev, { id, text, color, x, y, large }]);
    setTimeout(() => setDmgPopups(prev => prev.filter(p => p.id !== id)), 1200);
  }, []);

  const addLog = (msg: string) => setLogs(prev => [msg, ...prev].slice(0, 2));

  const bustTimeRef = useRef(0);
  const handleBust = useCallback((reason: string = 'PROTOCOL_FAILURE') => {
    if (stateRef.current.isEnding) return;
    bustTimeRef.current = stateRef.current.timeLeft >= 0
      ? Math.max(3, (initialTime - stateRef.current.timeLeft))
      : initialTime;
    addLog(reason);
    setIsEnding('LOSS');
    setUserAction('Death');
    setEnemyAction('Dance');
    sounds.playBust();
    sounds.hapticBust();
    spawnSparks('#EF4444', '#ff6600', 18);
    addDmgPopup('BUSTED!', '#EF4444', true);
    setTimeout(() => onFinish(false, 0, stateRef.current.points, bustTimeRef.current), 2500);
  }, [onFinish, initialTime, sounds, spawnSparks, addDmgPopup]);

  const handleBustRef = useRef(handleBust);
  useEffect(() => { handleBustRef.current = handleBust; }, [handleBust]);

  // Risk warning sound (throttled)
  const lastWarnRef = useRef(0);
  useEffect(() => {
    if (risk > 75 && !isEnding) {
      const now = Date.now();
      if (now - lastWarnRef.current > 2500) {
        sounds.playRiskWarning();
        sounds.hapticWarning();
        lastWarnRef.current = now;
      }
    }
  }, [Math.floor(risk / 5)]); // eslint-disable-line

  // ── MAIN GAME LOOP ─────────────────────────────────────────────────────────
  useEffect(() => {
    const startTime = Date.now();
    const intervalId = setInterval(() => {
      const state = stateRef.current;
      if (state.isEnding) return;

      const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
      const newTimeLeft    = Math.max(0, initialTime - elapsedSeconds);
      if (newTimeLeft !== state.timeLeft) setTimeLeft(newTimeLeft);
      if (newTimeLeft <= 0) { handleBustRef.current('TIMEOUT_EXPIRED'); return; }

      if (elapsedSeconds < 3) {
        setPoints(prev => prev + Math.floor(15 * state.multiplier * diffConfig.multMod));
        return;
      }

      const timePenalty = (elapsedSeconds - 3) * 0.07;
      // Harder: greed triggers earlier
      const greedFactor  = state.multiplier > 2.5 ? 2.4 : state.multiplier > 1.8 ? 1.8 : 1.0;
      // Harder: house edge raised to 1.30 (30%)
      const houseEdge    = 1.30;
      // Harder: base drift more aggressive
      const baseDrift    = (2.2 + (Math.random() * 2.8)) + timePenalty;
      const totalDrift   = baseDrift * diffConfig.driftMod * boostStats.driftMultiplier * greedFactor * houseEdge * gearRiskFactor;
      // Harder: spike 4% → 7%, size 6 → 14
      const spikeRoll    = Math.random();
      const randomSpike  = spikeRoll > 0.93 ? (spikeRoll > 0.97 ? 18 : 14) : 0;
      if (randomSpike > 0 && !state.isEnding) {
        addLog('NETWORK_SURGE (+RISK)');
        addDmgPopup(`+${randomSpike} RISK!`, '#f97316');
        spawnSparks('#f97316', '#EF4444', 6);
      }

      const nextRisk = state.risk + totalDrift + randomSpike;
      if (nextRisk >= 100) {
        handleBustRef.current('RISK_OVERLOAD');
        setRisk(100);
        return;
      } else {
        setRisk(nextRisk);
      }

      const yieldGain = Math.floor(15 * state.multiplier * diffConfig.multMod);
      setPoints(prev => {
        const next = prev + yieldGain;
        if (Math.floor(next / 500) > Math.floor(prev / 500)) {
          addDmgPopup('+5 SR', '#FFD700');
        }
        return next;
      });

      if (Math.random() > 0.7 && state.enemyAction === 'Idle') {
        setEnemyAction('Walking');
        setTimeout(() => { if (!stateRef.current.isEnding) setEnemyAction('Idle'); }, 1000);
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, []); // eslint-disable-line

  const handleCashOut = () => {
    if (isEnding || !hasInteracted || graceActive) return;
    setIsEnding('WIN');
    setUserAction('Dance');
    setEnemyAction('Death');
    const solReward = (points / 2500) * 6 * entryFee * (ticketBoost ? 1.1 : 1.0);
    sounds.playCashOut();
    sounds.hapticExtract();
    spawnSparks('#14F195', '#00FBFF', 20);
    addDmgPopup('EXTRACTED!', '#14F195', true);
    const elapsedSec = Math.max(3, initialTime - timeLeft);
    setTimeout(() => onFinish(true, solReward, points, elapsedSec), 2500);
  };

  const handleAttack = () => {
    if (isEnding || graceActive) return;
    setHasInteracted(true);
    setConsecutiveDefends(0);
    sounds.playAttack();
    sounds.hapticAttack();

    const riskAdded = 12 + Math.random() * 9;
    spawnSparks('#EF4444', '#f97316', 14);
    addDmgPopup(`+${Math.floor(riskAdded)} RISK`, '#EF4444');
    setFlash('rgba(239,68,68,0.25)');
    setTimeout(() => setFlash(null), 250);

    setMultiplier(prev => prev + 0.35);
    setRisk(prev => {
      const next = Math.min(99.9, prev + riskAdded);
      if (next > 85 && Math.random() > 0.75) {
        sounds.playCritical();
        sounds.hapticCritical();
        addDmgPopup('CRITICAL!', '#EF4444', true);
        spawnSparks('#EF4444', '#ffffff', 20);
        addLog('CRITICAL_OVERLOAD');
        setTimeout(() => handleBust('RISK_CRITICAL'), 350);
        return 100;
      }
      return next;
    });
    setPoints(prev => prev + 200);
    addLog('ATTACK_INITIATED');

    setUserAction('Punch');
    setTimeout(() => { if (!stateRef.current.isEnding) setUserAction('Idle'); }, 600);
    setTimeout(() => {
      if (!stateRef.current.isEnding) {
        setEnemyAction('Punch');
        spawnSparks('#ffffff', '#9945FF', 8);
        setTimeout(() => { if (!stateRef.current.isEnding) setEnemyAction('Idle'); }, 600);
      }
    }, 310);
  };

  const handleDefend = () => {
    if (isEnding || graceActive) return;
    setHasInteracted(true);
    const newCount = consecutiveDefends + 1;
    setConsecutiveDefends(newCount);
    sounds.playDefend();
    sounds.hapticDefend();

    const tiers = [
      { min: 10, max: 14, multCost: 0.10, log: 'SHIELD_STABLE'   },
      { min:  7, max: 11, multCost: 0.15, log: 'SHIELD_ACTIVE'   },
      { min:  5, max:  9, multCost: 0.22, log: 'SHIELD_OVERHEAT' },
      { min:  3, max:  6, multCost: 0.30, log: 'SHIELD_STRAINED' },
    ];
    const tier      = tiers[Math.min(newCount - 1, tiers.length - 1)];
    const reduction = tier.min + Math.random() * (tier.max - tier.min);

    spawnSparks('#00FBFF', '#9945FF', 10);
    addDmgPopup(`-${Math.floor(reduction)} RISK`, '#00FBFF');
    setFlash('rgba(0,251,255,0.18)');
    setTimeout(() => setFlash(null), 250);
    addLog(tier.log);
    setRisk(prev => Math.max(0, prev - reduction));
    setMultiplier(prev => Math.max(1, prev - tier.multCost));

    setUserAction('Jump');
    setTimeout(() => { if (!stateRef.current.isEnding) setUserAction('Idle'); }, 800);
  };

  const currentYield   = ((points / 2500) * 6 * entryFee * (ticketBoost ? 1.1 : 1.0)).toFixed(4);
  const isUrgent       = timeLeft < 10;
  const isCritical     = timeLeft < 5;

  // Shake level
  const shakeClass = isEnding ? '' : risk > 90 ? 'shake-critical' : risk > 75 ? 'shake-heavy' : risk > 60 ? 'shake-mild' : '';

  const timerGlowClass = isCritical
    ? 'shadow-[0_0_20px_rgba(239,68,68,0.6)] border-red-500 animate-pulse bg-red-950/40'
    : isUrgent
    ? 'shadow-[0_0_15px_rgba(239,68,68,0.3)] border-red-500/50 bg-red-950/20'
    : 'shadow-[0_0_10px_rgba(0,251,255,0.2)] border-[#00FBFF]/30';

  // Risk bar gradient
  const riskBarBg = risk > 75
    ? 'linear-gradient(90deg, #f97316, #ef4444)'
    : risk > 45
    ? 'linear-gradient(90deg, #9945FF, #f97316)'
    : 'linear-gradient(90deg, #14F195, #9945FF)';

  return (
    <div
      className={`h-full w-full flex flex-col relative overflow-hidden transition-colors duration-100 ${shakeClass} ${isEnding === 'LOSS' ? 'bg-red-950/20' : ''}`}
      style={{ backgroundColor: flash || 'transparent' }}
    >
      <style>{GameStyles}</style>

      {/* Background pulse on high risk */}
      {(risk > 80 || isUrgent) && !isEnding && (
        <div className={`absolute inset-0 pointer-events-none z-0 ${isCritical ? 'bg-red-600/15' : 'bg-red-600/5'} animate-pulse`} />
      )}

      {/* Sparks overlay */}
      <div className="absolute inset-0 pointer-events-none z-[70] overflow-hidden"
           style={{ left: '50%', top: '40%', width: 0, height: 0 }}>
        {sparks.map(s => (
          <div
            key={s.id}
            className="spark"
            style={{
              width: s.size,
              height: s.size,
              backgroundColor: s.color,
              boxShadow: `0 0 ${s.size * 1.5}px ${s.color}`,
              '--dx': s.dx,
              '--dy': s.dy,
              left: -s.size / 2,
              top:  -s.size / 2,
            } as React.CSSProperties}
          />
        ))}
      </div>

      {/* Damage popups overlay */}
      <div className="absolute inset-0 pointer-events-none z-[65]">
        {dmgPopups.map(p => (
          <div
            key={p.id}
            className={`dmg-popup ${p.large ? 'critical-text' : ''}`}
            style={{
              left: `${p.x}%`,
              top:  `${p.y}%`,
              color: p.color,
              fontSize: p.large ? '28px' : '16px',
              textShadow: `0 0 12px ${p.color}, 0 0 24px ${p.color}`,
              letterSpacing: '0.1em',
            }}
          >
            {p.text}
          </div>
        ))}
      </div>

      {/* WIN OVERLAY */}
      {isEnding === 'WIN' && (
        <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-[#14F195]/20 backdrop-blur-sm animate-in fade-in duration-300">
          <span className="text-5xl font-black text-[#14F195] glitch-text italic tracking-tighter uppercase">EXTRACTION_OK</span>
          <span className="text-xs text-white font-black uppercase tracking-[0.6em] mt-4 animate-pulse">UPLOADING_CREDITS</span>
        </div>
      )}

      {/* LOSS OVERLAY */}
      {isEnding === 'LOSS' && (
        <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-red-950/40 backdrop-blur-sm animate-in fade-in duration-300">
          <span className="text-5xl font-black text-red-500 glitch-text italic tracking-tighter uppercase">LINK_SEVERED</span>
          <span className="text-xs text-red-500/60 font-black uppercase tracking-[0.6em] mt-4 animate-pulse">
            {timeLeft <= 0 ? 'TIMEOUT_EXPIRED' : 'PROTOCOL_FAILURE'}
          </span>
        </div>
      )}

      {/* MAIN LAYOUT */}
      <div className={`flex flex-col h-full w-full max-w-lg mx-auto z-10 p-4 transition-opacity duration-300 ${isEnding ? 'opacity-0 scale-95' : 'opacity-100'}`}>

        {/* ── TOP HUD ── */}
        <div className="shrink-0 flex justify-between items-center gap-2 mb-2">
          <div className="flex-1 bg-black/80 p-2 border border-white/10 tech-border">
            <p className="text-[9px] text-white/40 font-black uppercase tracking-widest leading-none mb-1">EXTRACT_VAL</p>
            <div className="flex items-baseline gap-2">
              <span className={`mono text-xl font-black italic ${risk > 85 ? 'text-red-500' : 'text-white'}`}>{currentYield}</span>
              <span className="text-[10px] text-[#14F195] font-black italic">SOL</span>
            </div>
          </div>
          <div className={`relative w-28 px-2 py-2 bg-black/80 border tech-border flex flex-col items-center ${timerGlowClass}`}>
            <span className={`text-[8px] font-black uppercase tracking-widest mb-0.5 ${isUrgent ? 'text-red-500 animate-pulse' : 'text-white/30'}`}>TIME_LEFT</span>
            <div className="flex items-baseline gap-1">
              <span className={`mono text-2xl font-black leading-none ${isUrgent ? 'text-red-500' : 'text-[#00FBFF]'}`}>{Math.max(0, Math.floor(timeLeft))}</span>
              <span className="text-[10px] font-black uppercase italic text-white/20">s</span>
            </div>
          </div>
        </div>

        {/* ── 3D ARENA ── */}
        <div className="flex-1 relative flex items-center justify-center min-h-0">
          {/* Logs bg */}
          <div className="absolute top-2 left-2 z-0 opacity-40 pointer-events-none">
            {logs.map((log, i) => (
              <div key={i} className={`text-[9px] mono font-bold uppercase tracking-widest mb-1 ${log.includes('PENALTY') || log.includes('OVERHEAT') || log.includes('SURGE') ? 'text-red-500' : 'text-[#14F195]'}`}>
                {'>'} {log}
              </div>
            ))}
          </div>

          {/* Three.js Canvas */}
          <div className="absolute inset-0 z-0">
            <Canvas shadows camera={{ position: [0, 0.5, 5.5], fov: 52 }}>
              <ambientLight intensity={0.45} />
              <SpotLight position={[10, 10, 10]} angle={0.3} penumbra={1} intensity={110} castShadow />
              <pointLight position={[-10, 5, -5]} intensity={0.9} color="cyan" />
              <pointLight position={[10, 5, -5]} intensity={0.9} color="red" />
              <Suspense fallback={null}>
                <FighterModel action={userAction} position={[-1.4, -2.2, 0]} rotation={[0, Math.PI / 2, 0]}  scale={0.65} color={userColor} gearIds={equippedGearIds} />
                <FighterModel action={enemyAction} position={[1.4, -2.2, 0]}  rotation={[0, -Math.PI / 2, 0]} scale={0.65} color="#EF4444" isEnemy />
                <Environment preset="city" />
                <ContactShadows position={[0, -2.2, 0]} opacity={0.6} scale={12} blur={1.5} far={1} />
              </Suspense>
              <OrbitControls enableZoom={false} enablePan={false} minPolarAngle={Math.PI / 2.5} maxPolarAngle={Math.PI / 1.8} />
            </Canvas>
          </div>

          {/* Risk tag */}
          <div className="relative z-10 w-56 h-56 md:w-64 md:h-64 flex items-center justify-center pointer-events-none">
            <div className="absolute inset-0 border-[3px] border-dashed rounded-full animate-[spin_30s_linear_infinite] transition-colors duration-300"
                 style={{ borderColor: risk > 80 ? 'rgba(239,68,68,0.6)' : risk > 50 ? 'rgba(249,115,22,0.6)' : 'rgba(153,69,255,0.4)' }} />
            <div className="absolute top-0 right-0 bg-black/80 backdrop-blur-sm px-2 py-1 border tech-border border-white/10 min-w-[68px]">
              <p className="text-[8px] font-black text-white/40 uppercase tracking-widest">RISK</p>
              <div className="flex items-baseline gap-0.5">
                <span className={`mono text-xl font-black ${risk > 85 ? 'text-red-500 animate-pulse' : risk > 60 ? 'text-orange-400' : 'text-white'}`}>{Math.floor(risk)}</span>
                <span className="text-[10px] text-white/40">%</span>
              </div>
              <div className="w-full h-0.5 bg-white/10 overflow-hidden mt-1">
                <div className="h-full transition-all duration-500"
                     style={{ width: `${Math.min(100, risk)}%`, background: riskBarBg, boxShadow: `0 0 6px ${risk > 75 ? '#ef4444' : risk > 45 ? '#9945FF' : '#14F195'}` }} />
              </div>
            </div>
            <div className="absolute bottom-0 left-0 bg-black/80 backdrop-blur-sm px-2 py-1 border tech-border border-white/10">
              <span className={`text-[10px] font-black uppercase italic ${diffConfig.color}`}>{difficulty}</span>
            </div>
          </div>

          {/* Grace period countdown */}
          {graceActive && !isEnding && (
            <div className="absolute inset-0 z-[50] flex items-center justify-center pointer-events-none">
              <div className="flex flex-col items-center gap-2">
                <span key={graceCount}
                  className={`text-9xl font-black italic leading-none drop-shadow-[0_0_40px_rgba(255,255,255,0.6)] animate-in zoom-in-75 duration-200 ${graceCount === 0 ? 'text-[#14F195]' : 'text-white'}`}>
                  {graceCount === 0 ? 'GO!' : graceCount}
                </span>
                {graceCount > 0 && (
                  <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/30 animate-pulse">GET_READY</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── BOTTOM CONTROLS ── */}
        <div className="shrink-0 mt-2 space-y-2 pb-16 md:pb-4">
          <div className="bg-black/60 backdrop-blur-sm p-2 rounded border border-white/5 flex justify-between items-end">
            <div>
              <p className="text-[8px] text-white/30 font-black uppercase tracking-widest mb-0.5">MULT</p>
              <div className="flex items-center gap-2">
                <p className={`mono text-2xl font-black italic ${multiplier > 3 ? 'text-[#9945FF] chromatic-aberration' : 'text-white'}`}>{multiplier.toFixed(2)}x</p>
                {activeBoosts.includes('score_mult') && (
                  <span className="px-1 py-0.5 bg-yellow-500/10 border border-yellow-500/30 text-[8px] font-black text-yellow-500 uppercase">BOOST</span>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-[8px] text-white/30 font-black uppercase tracking-widest mb-0.5">SCORE</p>
              <p className="mono text-xl font-black text-white/60">{points.toLocaleString()}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button onClick={handleAttack} disabled={!!isEnding || graceActive}
              className="col-span-1 bg-black/90 border border-red-600/50 p-3 tech-border active:translate-y-0.5 transition-all disabled:opacity-40 group">
              <div className="flex flex-col items-center group-active:scale-95 transition-transform">
                <span className="text-base font-black uppercase italic tracking-tighter text-red-500">ATTACK</span>
                <span className="text-[8px] font-bold text-red-500/40 uppercase tracking-widest">RISK ++</span>
              </div>
            </button>
            <button onClick={handleDefend} disabled={!!isEnding || graceActive}
              className="col-span-1 bg-black/90 border border-[#00FBFF]/50 p-3 tech-border active:translate-y-0.5 transition-all disabled:opacity-40 group">
              <div className="flex flex-col items-center group-active:scale-95 transition-transform">
                <span className="text-base font-black uppercase italic tracking-tighter text-[#00FBFF]">DEFEND</span>
                <span className="text-[8px] font-bold text-[#00FBFF]/40 uppercase tracking-widest">
                  {consecutiveDefends > 1 ? (consecutiveDefends > 2 ? 'OVERHEAT!' : 'STABLE') : 'RISK --'}
                </span>
              </div>
            </button>
            <button onClick={handleCashOut} disabled={!!isEnding || !hasInteracted || graceActive}
              className={`col-span-2 p-4 tech-border transition-all duration-300 disabled:opacity-80 ${
                !hasInteracted || graceActive
                  ? 'bg-[#1a1a1a] text-white/20 border-white/5 cursor-not-allowed grayscale'
                  : `bg-[#14F195] text-black active:translate-y-1 ${multiplier > 3 ? 'shadow-[0_0_35px_rgba(20,241,149,0.6)]' : multiplier > 2 ? 'shadow-[0_0_22px_rgba(20,241,149,0.4)]' : 'shadow-[0_0_12px_rgba(20,241,149,0.2)]'}`
              }`}>
              <div className="flex flex-col items-center">
                <span className="text-2xl font-black uppercase italic tracking-tighter leading-none">
                  {graceActive ? 'GET_READY...' : !hasInteracted ? 'ENGAGE_TO_UNLOCK' : 'EXIT & CASH OUT'}
                </span>
                <span className="text-[9px] font-black uppercase mt-0.5 tracking-[0.2em] opacity-60 italic">
                  {graceActive ? 'PROTOCOL_ARMING' : !hasInteracted ? 'PROTOCOL_IDLE' : 'SECURE_PROFITS'}
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
