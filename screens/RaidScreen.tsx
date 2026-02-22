
import React, { useState, useEffect, useRef, useMemo, Suspense, useCallback } from 'react';
import { GEAR_ITEMS, AVATAR_ITEMS, Difficulty, DIFFICULTY_CONFIG, RAID_BOOSTS, RaidEvent } from '../types';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations, OrbitControls, Environment, ContactShadows, SpotLight, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { useGameSounds } from '../hooks/useGameSounds';

interface RaidScreenProps {
  onFinish: (success: boolean, solAmount: number, points: number, elapsedSec: number, events?: RaidEvent[]) => void;
  equippedGearIds: string[];
  entryFee: number;
  difficulty: Difficulty;
  activeBoosts: string[];
  equippedAvatarId?: string;
  ticketBoost?: boolean;   // +10% win reward when true
  streakBonus?: number;    // +0.15x starting multiplier per 3-win streak
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
  @keyframes golden-pulse {
    0%,100% { box-shadow: 0 0 18px rgba(234,179,8,0.5), inset 0 0 18px rgba(234,179,8,0.05); }
    50%     { box-shadow: 0 0 45px rgba(234,179,8,1.0), inset 0 0 30px rgba(234,179,8,0.15); }
  }
  @keyframes firewall-pop {
    0%   { transform: scale(0.4) rotate(-4deg); opacity:0; }
    25%  { transform: scale(1.25) rotate(1deg); opacity:1; }
    60%  { transform: scale(1.0) rotate(0deg); opacity:1; }
    100% { transform: scale(0.8); opacity:0; }
  }
  @keyframes hot-streak {
    0%,100% { text-shadow: 0 0 12px #f97316, 0 0 24px #ef4444; }
    50%     { text-shadow: 0 0 28px #fbbf24, 0 0 56px #f97316; }
  }
  @keyframes ambush-in {
    0%   { opacity:0; transform: scaleY(0.2); }
    100% { opacity:1; transform: scaleY(1); }
  }
  @keyframes combo-pop {
    0%   { transform: scale(0) rotate(-10deg); opacity:0; }
    40%  { transform: scale(1.4) rotate(3deg);  opacity:1; }
    70%  { transform: scale(1.0) rotate(0deg);  opacity:1; }
    100% { transform: scale(0.6); opacity:0; }
  }
  .shake-mild     { animation: shake-mild     0.28s cubic-bezier(.36,.07,.19,.97) infinite; }
  .shake-heavy    { animation: shake-heavy    0.22s cubic-bezier(.36,.07,.19,.97) infinite; }
  .shake-critical { animation: shake-critical 0.18s cubic-bezier(.36,.07,.19,.97) infinite; }
  .spark          { position: absolute; border-radius: 50%; animation: spark-fly 0.38s ease-out forwards; pointer-events: none; }
  .dmg-popup      { position: absolute; animation: dmg-float 1.1s ease-out forwards; pointer-events: none; font-family: 'JetBrains Mono', monospace; font-weight: 900; text-transform: uppercase; white-space: nowrap; }
  .critical-text  { animation: critical-flash 0.15s ease-in-out 3; }
  .golden-glow    { animation: golden-pulse 0.9s ease-in-out infinite; }
  .hot-streak-text{ animation: hot-streak 0.6s ease-in-out infinite; }
  .firewall-pop   { animation: firewall-pop 1.2s ease-out forwards; pointer-events:none; }
  .combo-pop      { position:absolute; animation: combo-pop 0.9s ease-out forwards; pointer-events:none; font-family:'JetBrains Mono',monospace; font-weight:900; text-transform:uppercase; }
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
  onFinish, equippedGearIds, entryFee, difficulty, activeBoosts, equippedAvatarId, ticketBoost = false, streakBonus = 0,
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
  const initialMultiplier = 1.0 + gearStats.mult + boostStats.startMultBonus + streakBonus;
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
  const [defendLocked,       setDefendLocked]       = useState(false);
  const [defendLockTimer,    setDefendLockTimer]     = useState(0);
  const defendLockRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Addictive mechanics state ────────────────────────────────────────────
  const [attackCount,     setAttackCount]     = useState(0);
  const [ambushed,        setAmbushed]        = useState(false);
  const [goldenWindow,    setGoldenWindow]    = useState(false);
  const [goldenCountdown, setGoldenCountdown] = useState(0);
  const [hotStreak,       setHotStreak]       = useState(false);
  const [jackpotFlash,    setJackpotFlash]    = useState(false);
  const [firewallSave,    setFirewallSave]    = useState(false);
  const [nearMissSOL,     setNearMissSOL]     = useState<number | null>(null);
  const [comboPopups,     setComboPopups]     = useState<Array<{ id: number; text: string; color: string }>>([]);

  const lastActionTimeRef   = useRef<number>(0);
  const lastActionTypeRef   = useRef<'ATTACK' | 'DEFEND' | null>(null);
  const peakMultRef         = useRef(initialMultiplier);
  const goldenWindowRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const ambushTimeoutRef    = useRef<ReturnType<typeof setTimeout>  | null>(null);
  const goldenTriggeredRef  = useRef(false);
  const hotStreakTimerRef   = useRef<ReturnType<typeof setTimeout>  | null>(null);

  // Cleanup all intervals/timeouts on unmount
  useEffect(() => () => {
    if (defendLockRef.current)   clearInterval(defendLockRef.current);
    if (goldenWindowRef.current) clearInterval(goldenWindowRef.current);
    if (ambushTimeoutRef.current) clearTimeout(ambushTimeoutRef.current);
    if (hotStreakTimerRef.current) clearTimeout(hotStreakTimerRef.current);
  }, []);

  const addComboPopup = useCallback((text: string, color: string) => {
    const id = Date.now() + Math.random();
    setComboPopups(prev => [...prev, { id, text, color }]);
    setTimeout(() => setComboPopups(prev => prev.filter(p => p.id !== id)), 950);
  }, []);

  // ── Post-Raid Event Ledger ────────────────────────────────────────────────
  const raidEventsRef  = useRef<RaidEvent[]>([]);
  const raidStartMsRef = useRef(Date.now());
  const logEvent = useCallback((
    type: string, reason: string, impact: string, severity: RaidEvent['severity'],
  ) => {
    const tick = Math.floor((Date.now() - raidStartMsRef.current) / 1000);
    raidEventsRef.current.push({ tick, type, reason, impact, severity });
  }, []);

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
    // Clear all timers
    if (defendLockRef.current)    { clearInterval(defendLockRef.current);  defendLockRef.current = null; }
    if (goldenWindowRef.current)  { clearInterval(goldenWindowRef.current); goldenWindowRef.current = null; }
    if (ambushTimeoutRef.current) { clearTimeout(ambushTimeoutRef.current); ambushTimeoutRef.current = null; }
    if (hotStreakTimerRef.current) { clearTimeout(hotStreakTimerRef.current); hotStreakTimerRef.current = null; }
    setDefendLocked(false);
    setDefendLockTimer(0);
    setGoldenWindow(false);
    setAmbushed(false);
    setHotStreak(false);
    // Near-miss: show what they could have extracted
    const wouldHave = (stateRef.current.points / 2500) * 6 * entryFee * (ticketBoost ? 1.1 : 1.0);
    if (wouldHave >= entryFee * 0.4) setNearMissSOL(parseFloat(wouldHave.toFixed(4)));
    bustTimeRef.current = stateRef.current.timeLeft >= 0
      ? Math.max(3, (initialTime - stateRef.current.timeLeft))
      : initialTime;
    addLog(reason);
    // Log the final bust event
    const bustReasons: Record<string, { reason: string; impact: string }> = {
      RISK_OVERLOAD:    { reason: 'Cumulative risk drift exceeded 100%', impact: 'Entry fee lost' },
      RISK_CRITICAL:    { reason: 'High-risk attack triggered critical overload', impact: 'Instant bust' },
      TIMEOUT_EXPIRED:  { reason: 'Timer ran out before extraction', impact: 'Entry fee lost' },
      PROTOCOL_FAILURE: { reason: 'Protocol collapsed from accumulated damage', impact: 'Entry fee lost' },
    };
    const bustInfo = bustReasons[reason] ?? { reason: reason, impact: 'Entry fee lost' };
    logEvent('BUST', bustInfo.reason, bustInfo.impact, 'danger');
    setIsEnding('LOSS');
    setUserAction('Death');
    setEnemyAction('Dance');
    sounds.playBust();
    sounds.hapticBust();
    spawnSparks('#EF4444', '#ff6600', 22);
    addDmgPopup('BUSTED!', '#EF4444', true);
    setTimeout(() => onFinish(false, 0, stateRef.current.points, bustTimeRef.current, [...raidEventsRef.current]), 2500);
  }, [onFinish, initialTime, entryFee, ticketBoost, sounds, spawnSparks, addDmgPopup]);

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

      // ── Idle risk decay: patience is a skill ─────────────────────────────
      const idleSecs = (Date.now() - lastActionTimeRef.current) / 1000;
      if (idleSecs > 3) {
        setRisk(prev => Math.max(0, prev - 0.4));
      }

      // ── Hot streak visual tracking ─────────────────────────────────────
      if (state.multiplier > peakMultRef.current * 0.85 && state.multiplier > 2.0) {
        setHotStreak(true);
      } else {
        setHotStreak(false);
      }

      // ── Golden window trigger: crosses 2.5x first time ─────────────────
      if (!goldenTriggeredRef.current && state.multiplier >= 2.5) {
        goldenTriggeredRef.current = true;
        let secs = 6;
        setGoldenWindow(true);
        setGoldenCountdown(secs);
        logEvent('GOLDEN_WINDOW', `Multiplier reached ${state.multiplier.toFixed(2)}x — extraction window opened`, '6s window: +5% bonus if you cash out now', 'bonus');
        addLog('GOLDEN_WINDOW_OPEN');
        addDmgPopup('GOLDEN WINDOW! +5%', '#FFD700', true);
        spawnSparks('#FFD700', '#14F195', 22);
        if (goldenWindowRef.current) clearInterval(goldenWindowRef.current);
        goldenWindowRef.current = setInterval(() => {
          secs -= 1;
          setGoldenCountdown(secs);
          if (secs <= 0) {
            clearInterval(goldenWindowRef.current!);
            goldenWindowRef.current = null;
            setGoldenWindow(false);
            setGoldenCountdown(0);
            logEvent('GOLDEN_EXPIRED', 'Golden extraction window expired unused', 'Bonus opportunity missed — no penalty', 'warning');
            addLog('GOLDEN_WINDOW_EXPIRED');
            addDmgPopup('WINDOW CLOSED!', '#EF4444');
          }
        }, 1000);
      }

      // ── JACKPOT: 3% chance after 6s — variable reward rush ────────────
      if (elapsedSeconds > 6 && Math.random() < 0.03 && !state.isEnding) {
        logEvent('JACKPOT', 'Protocol glitch in your favour — rare random event', '+0.5x multiplier bonus', 'bonus');
        addLog('PROTOCOL_GLITCH_DETECTED');
        addDmgPopup('JACKPOT! +0.5x', '#FFD700', true);
        spawnSparks('#FFD700', '#9945FF', 28);
        setJackpotFlash(true);
        setTimeout(() => setJackpotFlash(false), 700);
        setMultiplier(prev => {
          const next = prev + 0.5;
          if (next > peakMultRef.current) peakMultRef.current = next;
          return next;
        });
        sounds.hapticWarning();
      }

      // ── AMBUSH: 10% chance after 8s, throttled by ambushTimeoutRef ─────
      if (elapsedSeconds > 8 && Math.random() < 0.10 && !ambushTimeoutRef.current && !state.isEnding) {
        logEvent('AMBUSH', 'Enemy flanked your position — random event', '+10 RISK + 2.2s controls locked', 'danger');
        setAmbushed(true);
        addLog('AMBUSH_DETECTED');
        addDmgPopup('AMBUSH!', '#EF4444', true);
        spawnSparks('#EF4444', '#f97316', 18);
        setRisk(prev => Math.min(98, prev + 10));
        sounds.hapticCritical();
        ambushTimeoutRef.current = setTimeout(() => {
          setAmbushed(false);
          ambushTimeoutRef.current = null;
        }, 2200);
      }

      const timePenalty = (elapsedSeconds - 3) * 0.07;
      const greedFactor  = state.multiplier > 2.5 ? 2.4 : state.multiplier > 1.8 ? 1.8 : 1.0;
      const houseEdge    = 1.30;
      const baseDrift    = (2.2 + (Math.random() * 2.8)) + timePenalty;
      const totalDrift   = baseDrift * diffConfig.driftMod * boostStats.driftMultiplier * greedFactor * houseEdge * gearRiskFactor;
      const spikeRoll    = Math.random();
      const randomSpike  = spikeRoll > 0.93 ? (spikeRoll > 0.97 ? 18 : 14) : 0;
      if (randomSpike > 0 && !state.isEnding) {
        logEvent('NETWORK_SURGE', 'Random protocol traffic spike — occurs ~7% of ticks', `+${randomSpike} RISK applied`, 'danger');
        addLog('NETWORK_SURGE (+RISK)');
        addDmgPopup(`+${randomSpike} RISK!`, '#f97316');
        spawnSparks('#f97316', '#EF4444', 6);
      }

      const nextRisk = state.risk + totalDrift + randomSpike;

      // ── LAST-SECOND SAVE: 12% chance right at 100 — heart-stopping ─────
      if (nextRisk >= 100 && Math.random() < 0.12 && !state.isEnding) {
        logEvent('FIREWALL', 'Emergency firewall activated just before bust — 12% chance', 'Risk reset to 72, raid continues', 'bonus');
        addLog('FIREWALL_ACTIVATED');
        spawnSparks('#14F195', '#00FBFF', 32);
        setFirewallSave(true);
        setTimeout(() => setFirewallSave(false), 1400);
        setRisk(72);
        sounds.hapticCritical();
        addDmgPopup('FIREWALL SAVED!', '#14F195', true);
      } else if (nextRisk >= 100) {
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
    if (isEnding || !hasInteracted || graceActive || ambushed) return;
    if (defendLockRef.current)    { clearInterval(defendLockRef.current);  defendLockRef.current = null; }
    if (goldenWindowRef.current)  { clearInterval(goldenWindowRef.current); goldenWindowRef.current = null; }
    if (hotStreakTimerRef.current) { clearTimeout(hotStreakTimerRef.current); hotStreakTimerRef.current = null; }
    setDefendLocked(false);
    setDefendLockTimer(0);
    setGoldenWindow(false);
    setHotStreak(false);
    setIsEnding('WIN');
    setUserAction('Dance');
    setEnemyAction('Death');
    const elapsedSec  = Math.max(3, initialTime - timeLeft);
    const earlyMult   = elapsedSec < 8 ? 0.5 : 1.0;    // Rule: early exit penalty
    const goldenMult  = goldenWindow ? 1.05 : 1.0;      // Rule: golden window bonus
    const solReward   = (points / 2500) * 6 * entryFee * (ticketBoost ? 1.1 : 1.0) * earlyMult * goldenMult;
    sounds.playCashOut();
    sounds.hapticExtract();
    if (goldenWindow) {
      logEvent('CASHOUT', 'Extracted during Golden Window', `+5% bonus → ${solReward.toFixed(4)} SOL`, 'bonus');
      spawnSparks('#FFD700', '#14F195', 32);
      addDmgPopup('GOLDEN EXIT! +5%', '#FFD700', true);
    } else if (elapsedSec < 8) {
      logEvent('CASHOUT', 'Early exit before 8s full-value window', `-50% penalty → ${solReward.toFixed(4)} SOL`, 'warning');
      spawnSparks('#f97316', '#EF4444', 14);
      addDmgPopup('EARLY EXIT! -50%', '#f97316', true);
    } else {
      logEvent('CASHOUT', 'Clean extraction at full value', `${solReward.toFixed(4)} SOL secured`, 'bonus');
      spawnSparks('#14F195', '#00FBFF', 22);
      addDmgPopup('EXTRACTED!', '#14F195', true);
    }
    setTimeout(() => onFinish(true, solReward, points, elapsedSec, [...raidEventsRef.current]), 2500);
  };

  const handleAttack = () => {
    if (isEnding || graceActive || ambushed) return;
    setHasInteracted(true);
    setConsecutiveDefends(0);

    const now = Date.now();
    // Combo: defend → attack within 2.2 seconds
    const isCombo = lastActionTypeRef.current === 'DEFEND' && (now - lastActionTimeRef.current) < 2200;
    lastActionTimeRef.current = now;
    lastActionTypeRef.current = 'ATTACK';

    const newAttackCount = attackCount + 1;
    setAttackCount(newAttackCount);

    sounds.playAttack();
    sounds.hapticAttack();

    // ── Combo bonus ────────────────────────────────────────────────────────
    if (isCombo) {
      logEvent('COMBO', 'Defend → Attack within 2.2s — perfect sequence', '+500 pts, -4 RISK, reduced attack cost', 'bonus');
      addComboPopup('COMBO! +500', '#FFD700');
      spawnSparks('#FFD700', '#14F195', 18);
      addLog('COMBO_STRIKE');
      setPoints(prev => prev + 500);
      setRisk(prev => Math.max(0, prev - 4));
    }

    // ── Aggression surge: every 5 attacks without defending ────────────────
    if (newAttackCount >= 5 && newAttackCount % 5 === 0) {
      logEvent('AGGRESSION', `${newAttackCount} attacks fired without defending — aggression penalty triggered`, '+15 RISK surge', 'danger');
      addLog('AGGRESSION_DETECTED');
      addDmgPopup('AGGRESSION! +15', '#f97316', true);
      spawnSparks('#f97316', '#EF4444', 12);
      setTimeout(() => { if (!stateRef.current.isEnding) setRisk(prev => Math.min(99, prev + 15)); }, 200);
    }

    // ── Hot streak visual (2s flash when climbing) ────────────────────────
    setHotStreak(true);
    if (hotStreakTimerRef.current) clearTimeout(hotStreakTimerRef.current);
    hotStreakTimerRef.current = setTimeout(() => { setHotStreak(false); hotStreakTimerRef.current = null; }, 2000);

    const riskAdded = isCombo ? Math.max(6, 10 + Math.random() * 7) : 12 + Math.random() * 9;
    spawnSparks('#EF4444', '#f97316', 14);
    if (!isCombo) addDmgPopup(`+${Math.floor(riskAdded)} RISK`, '#EF4444');
    setFlash('rgba(239,68,68,0.25)');
    setTimeout(() => setFlash(null), 250);

    setMultiplier(prev => {
      const bonus = isCombo ? 0.50 : 0.35;
      const next = prev + bonus;
      if (next > peakMultRef.current) peakMultRef.current = next;
      return next;
    });
    setRisk(prev => {
      const next = Math.min(99.9, prev + riskAdded);
      if (next > 85 && Math.random() > 0.75) {
        logEvent('CRITICAL', `Attack at ${Math.floor(next)}% risk triggered critical overload (25% chance above 85%)`, 'Instant bust — do not attack above 85% risk', 'danger');
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
    if (!isCombo) addLog('ATTACK_INITIATED');

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
    if (isEnding || graceActive || defendLocked || ambushed) return;
    setHasInteracted(true);
    const newCount = consecutiveDefends + 1;
    setConsecutiveDefends(newCount);

    const now = Date.now();
    // Counter-combo: attack → defend within 2.2s
    const isCounter = lastActionTypeRef.current === 'ATTACK' && (now - lastActionTimeRef.current) < 2200;
    lastActionTimeRef.current = now;
    lastActionTypeRef.current = 'DEFEND';
    setAttackCount(0); // Reset aggression counter on defend

    sounds.playDefend();
    sounds.hapticDefend();

    if (isCounter) {
      logEvent('COUNTER', 'Attack → Defend within 2.2s — counter sequence', '+350 pts, -10 RISK bonus', 'bonus');
      addComboPopup('COUNTER! -10', '#9945FF');
      spawnSparks('#9945FF', '#00FBFF', 16);
      addLog('COUNTER_EXECUTED');
      setPoints(prev => prev + 350);
      setRisk(prev => Math.max(0, prev - 10));
    }

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

    // Lock defend after 2 consecutive uses — must attack first
    if (newCount >= 2) {
      logEvent('SHIELD_OVERLOAD', '2 consecutive defends exhausted your shield generator', '3s lockout — must attack or wait', 'warning');
      setDefendLocked(true);
      addDmgPopup('SHIELD OVERLOAD!', '#f97316', true);
      sounds.hapticWarning();
      let remaining = 3;
      setDefendLockTimer(remaining);
      if (defendLockRef.current) clearInterval(defendLockRef.current);
      defendLockRef.current = setInterval(() => {
        remaining -= 1;
        setDefendLockTimer(remaining);
        if (remaining <= 0) {
          clearInterval(defendLockRef.current!);
          defendLockRef.current = null;
          setDefendLocked(false);
          setDefendLockTimer(0);
          setConsecutiveDefends(0);
        }
      }, 1000);
    }
  };

  const elapsedSec     = Math.max(0, initialTime - timeLeft);
  const earlyExitWarn  = elapsedSec < 8 && hasInteracted && !graceActive;
  const currentYield   = (
    (points / 2500) * 6 * entryFee
    * (ticketBoost ? 1.1 : 1.0)
    * (earlyExitWarn ? 0.5 : 1.0)
    * (goldenWindow  ? 1.05 : 1.0)
  ).toFixed(4);
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
        <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-red-950/40 backdrop-blur-sm animate-in fade-in duration-300 gap-3">
          <span className="text-5xl font-black text-red-500 glitch-text italic tracking-tighter uppercase">LINK_SEVERED</span>
          <span className="text-xs text-red-500/60 font-black uppercase tracking-[0.6em] animate-pulse">
            {timeLeft <= 0 ? 'TIMEOUT_EXPIRED' : 'PROTOCOL_FAILURE'}
          </span>
          {nearMissSOL !== null && (
            <div className="mt-2 text-center px-6 py-3 border border-white/10 bg-black/60">
              <p className="text-[9px] font-black uppercase tracking-[0.3em] text-white/30 mb-1">YOU WERE THIS CLOSE</p>
              <p className="mono text-3xl font-black text-white/70">{nearMissSOL.toFixed(4)} <span className="text-sm text-[#14F195]/60">SOL</span></p>
              <p className="text-[8px] font-black uppercase tracking-widest text-red-500/40 mt-1">COULD HAVE EXTRACTED</p>
            </div>
          )}
        </div>
      )}

      {/* JACKPOT FLASH */}
      {jackpotFlash && (
        <div className="absolute inset-0 z-[95] pointer-events-none bg-yellow-400/12 animate-pulse" />
      )}

      {/* FIREWALL SAVE */}
      {firewallSave && (
        <div className="absolute inset-0 z-[95] flex items-center justify-center pointer-events-none">
          <div className="firewall-pop flex flex-col items-center gap-1">
            <span className="text-5xl font-black text-[#14F195] italic uppercase tracking-tighter" style={{ textShadow: '0 0 40px #14F195' }}>FIREWALL</span>
            <span className="text-sm font-black text-[#00FBFF] uppercase tracking-[0.4em]">PROTOCOL SAVED</span>
          </div>
        </div>
      )}

      {/* GOLDEN WINDOW BANNER */}
      {goldenWindow && !isEnding && (
        <div className="absolute top-0 left-0 right-0 z-[60] flex justify-center pt-1 pointer-events-none">
          <div className="golden-glow flex items-center gap-3 px-4 py-2 bg-yellow-950/80 border border-yellow-500/80">
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-yellow-500">GOLDEN_WINDOW</span>
            <span className="mono text-2xl font-black text-yellow-400">{goldenCountdown}s</span>
            <span className="text-[9px] font-black text-yellow-600 uppercase">+5%_BONUS</span>
          </div>
        </div>
      )}

      {/* COMBO POPUPS */}
      <div className="absolute inset-0 pointer-events-none z-[67]">
        {comboPopups.map(p => (
          <div
            key={p.id}
            className="combo-pop"
            style={{
              left: '50%', top: '35%', transform: 'translateX(-50%)',
              color: p.color, fontSize: '32px',
              textShadow: `0 0 20px ${p.color}, 0 0 40px ${p.color}`,
              letterSpacing: '0.08em',
            }}
          >
            {p.text}
          </div>
        ))}
      </div>

      {/* MAIN LAYOUT */}
      <div className={`flex flex-col h-full w-full max-w-lg mx-auto z-10 p-4 transition-opacity duration-300 ${isEnding ? 'opacity-0 scale-95' : 'opacity-100'}`}>

        {/* ── TOP HUD ── */}
        <div className="shrink-0 flex justify-between items-center gap-2 mb-2">
          <div className={`flex-1 bg-black/80 p-2 border tech-border transition-colors duration-300 ${goldenWindow ? 'border-yellow-500/60' : earlyExitWarn ? 'border-orange-500/40' : 'border-white/10'}`}>
            <p className={`text-[9px] font-black uppercase tracking-widest leading-none mb-1 ${goldenWindow ? 'text-yellow-500/80' : earlyExitWarn ? 'text-orange-500/60' : 'text-white/40'}`}>
              {goldenWindow ? 'GOLDEN_EXTRACT' : earlyExitWarn ? 'EARLY_EXIT_-50%' : 'EXTRACT_VAL'}
            </p>
            <div className="flex items-baseline gap-2">
              <span className={`mono text-xl font-black italic ${goldenWindow ? 'text-yellow-400' : risk > 85 ? 'text-red-500' : 'text-white'}`}>{currentYield}</span>
              <span className={`text-[10px] font-black italic ${goldenWindow ? 'text-yellow-500' : 'text-[#14F195]'}`}>SOL</span>
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

          {/* AMBUSH OVERLAY on arena */}
          {ambushed && !isEnding && (
            <div className="absolute inset-0 z-[55] flex items-center justify-center" style={{ animation: 'ambush-in 0.2s ease-out' }}>
              <div className="absolute inset-0 bg-red-950/70 backdrop-blur-[2px]" />
              <div className="relative flex flex-col items-center gap-1">
                <span className="text-4xl font-black text-red-500 italic uppercase tracking-tight animate-pulse" style={{ textShadow: '0 0 30px #ef4444' }}>AMBUSH!</span>
                <span className="text-xs font-black text-red-400/70 uppercase tracking-[0.4em]">CONTROLS_LOCKED</span>
              </div>
            </div>
          )}

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
          {/* Multiplier + Score row */}
          <div className="bg-black/60 backdrop-blur-sm p-2 rounded border border-white/5 flex justify-between items-center">
            <div>
              <p className="text-[8px] text-white/30 font-black uppercase tracking-widest mb-0.5">MULT</p>
              <div className="flex items-center gap-2">
                <p className={`mono text-2xl font-black italic ${
                  hotStreak ? 'hot-streak-text text-orange-400' :
                  multiplier > 3 ? 'text-[#9945FF] chromatic-aberration' : 'text-white'
                }`}>{multiplier.toFixed(2)}x</p>
                {hotStreak && <span className="text-[8px] font-black text-orange-500 uppercase tracking-widest animate-pulse">HOT</span>}
                {activeBoosts.includes('score_mult') && (
                  <span className="px-1 py-0.5 bg-yellow-500/10 border border-yellow-500/30 text-[8px] font-black text-yellow-500 uppercase">BOOST</span>
                )}
              </div>
            </div>
            <div className="text-center">
              {attackCount >= 4 && (
                <div className="px-2 py-0.5 bg-red-950/80 border border-red-500/40 mb-1">
                  <span className="text-[8px] font-black text-red-400 uppercase tracking-widest">AGGRESSION {attackCount}/5</span>
                </div>
              )}
            </div>
            <div className="text-right">
              <p className="text-[8px] text-white/30 font-black uppercase tracking-widest mb-0.5">SCORE</p>
              <p className="mono text-xl font-black text-white/60">{points.toLocaleString()}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* ATTACK button */}
            <button onClick={handleAttack} disabled={!!isEnding || graceActive || ambushed}
              className={`col-span-1 bg-black/90 border p-3 tech-border active:translate-y-0.5 transition-all disabled:opacity-40 group ${
                ambushed ? 'border-red-900/30 opacity-30' : 'border-red-600/50'
              }`}>
              <div className="flex flex-col items-center group-active:scale-95 transition-transform">
                <span className="text-base font-black uppercase italic tracking-tighter text-red-500">ATTACK</span>
                <span className="text-[8px] font-bold text-red-500/40 uppercase tracking-widest">
                  {attackCount >= 4 ? `RAGE_${attackCount}/5` : 'RISK ++'}
                </span>
              </div>
            </button>

            {/* DEFEND button */}
            <button onClick={handleDefend} disabled={!!isEnding || graceActive || defendLocked || ambushed}
              className={`col-span-1 bg-black/90 border p-3 tech-border active:translate-y-0.5 transition-all disabled:opacity-40 group ${
                ambushed ? 'border-cyan-900/30 opacity-30' :
                defendLocked ? 'border-orange-500/60 bg-orange-950/20' : 'border-[#00FBFF]/50'
              }`}>
              <div className="flex flex-col items-center group-active:scale-95 transition-transform">
                <span className={`text-base font-black uppercase italic tracking-tighter ${
                  defendLocked ? 'text-orange-400 animate-pulse' : 'text-[#00FBFF]'
                }`}>
                  {defendLocked ? `COOLDOWN_${defendLockTimer}` : 'DEFEND'}
                </span>
                <span className={`text-[8px] font-bold uppercase tracking-widest ${
                  defendLocked ? 'text-orange-500/60' : 'text-[#00FBFF]/40'
                }`}>
                  {defendLocked ? 'SHIELD OVERLOAD' : consecutiveDefends >= 1 ? 'CHAIN RISK' : 'RISK --'}
                </span>
              </div>
            </button>

            {/* CASHOUT button */}
            <button onClick={handleCashOut} disabled={!!isEnding || !hasInteracted || graceActive || ambushed}
              className={`col-span-2 p-4 tech-border transition-all duration-300 relative overflow-hidden disabled:opacity-80 ${
                ambushed
                  ? 'bg-red-950/40 text-red-500/40 border-red-900/20 cursor-not-allowed'
                  : !hasInteracted || graceActive
                  ? 'bg-[#1a1a1a] text-white/20 border-white/5 cursor-not-allowed grayscale'
                  : goldenWindow
                  ? 'bg-yellow-500 text-black active:translate-y-1 golden-glow'
                  : earlyExitWarn
                  ? 'bg-orange-900/80 text-orange-300 border border-orange-600 active:translate-y-1 shadow-[0_0_20px_rgba(249,115,22,0.3)]'
                  : `bg-[#14F195] text-black active:translate-y-1 ${multiplier > 3 ? 'shadow-[0_0_35px_rgba(20,241,149,0.6)]' : multiplier > 2 ? 'shadow-[0_0_22px_rgba(20,241,149,0.4)]' : 'shadow-[0_0_12px_rgba(20,241,149,0.2)]'}`
              }`}>
              <div className="flex flex-col items-center">
                <span className="text-2xl font-black uppercase italic tracking-tighter leading-none">
                  {ambushed
                    ? 'AMBUSH! LOCKED'
                    : graceActive ? 'GET_READY...'
                    : !hasInteracted ? 'ENGAGE_TO_UNLOCK'
                    : goldenWindow ? `GOLDEN EXIT +5%`
                    : earlyExitWarn ? 'EARLY EXIT -50%'
                    : 'EXIT & CASH OUT'}
                </span>
                {hasInteracted && !graceActive && !ambushed && (
                  <span className={`mono text-sm font-black mt-1 ${goldenWindow ? 'text-black/70' : earlyExitWarn ? 'text-orange-400' : 'text-black/70'}`}>
                    {currentYield} SOL
                  </span>
                )}
                <span className={`text-[9px] font-black uppercase mt-0.5 tracking-[0.2em] italic ${goldenWindow || earlyExitWarn ? 'opacity-80' : 'opacity-60'}`}>
                  {ambushed ? 'WAIT_FOR_CLEAR'
                    : graceActive ? 'PROTOCOL_ARMING'
                    : !hasInteracted ? 'PROTOCOL_IDLE'
                    : goldenWindow ? `${goldenCountdown}s REMAINING`
                    : earlyExitWarn ? `${8 - elapsedSec}s TO_FULL_VALUE`
                    : 'SECURE_PROFITS'}
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
