
import React, { useState, useEffect, useRef, useMemo, Suspense, useCallback, Component } from 'react';

class CanvasErrorBoundary extends Component<{ children: React.ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() { return { error: true }; }
  render() {
    if (this.state.error) return (
      <div className="absolute inset-0 flex items-center justify-center">
        <p className="text-white text-xs">3D unavailable</p>
      </div>
    );
    return this.props.children;
  }
}
import { GEAR_ITEMS, AVATAR_ITEMS, Difficulty, DIFFICULTY_CONFIG, RAID_BOOSTS, RaidEvent, PLATFORM_FEE_RAID, DIFFICULTY_MAX_WIN, RaidPhase, RAID_PHASE_CONFIG, EventCard, EventCardType, EVENT_CARD_META, ScoutNode, SCOUT_NODES, LootDrop } from '../types';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sparkles, useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';
import { useGameSounds } from '../hooks/useGameSounds';

interface RaidScreenProps {
  onFinish: (success: boolean, solAmount: number, points: number, elapsedSec: number, events?: RaidEvent[], peakMult?: number, nearWinCount?: number, bankedYield?: number, lootDrops?: LootDrop[]) => void;
  equippedGearIds: string[];
  entryFee: number;
  difficulty: Difficulty;
  activeBoosts: string[];
  equippedAvatarId?: string;
  ticketBoost?: boolean;   // +10% win reward when true
  streakBonus?: number;    // +0.15x starting multiplier per 3-win streak
  dailyStreak?: number;    // consecutive days played — bonus firewall save %
  personalBestPoints?: number; // show PB highlight when beaten mid-raid
  isRoundEntry?: boolean;  // true when this raid counts toward the active round competition
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
    0%,100% { transform: translate(0,0); }
    33%     { transform: translate(-1px,0.5px); }
    66%     { transform: translate(1px,-0.5px); }
  }
  @keyframes shake-heavy {
    0%,100% { transform: translate(0,0); }
    20%     { transform: translate(-3px,2px); }
    40%     { transform: translate(3px,-2px); }
    60%     { transform: translate(-2px,-2px); }
    80%     { transform: translate(2px,2px); }
  }
  @keyframes shake-critical {
    0%,100% { transform: translate(0,0); }
    10%     { transform: translate(-5px,3px); }
    20%     { transform: translate(5px,-3px); }
    30%     { transform: translate(-4px,-3px); }
    40%     { transform: translate(4px,3px); }
    50%     { transform: translate(-3px,2px); }
    60%     { transform: translate(3px,-2px); }
    70%     { transform: translate(-3px,-2px); }
    80%     { transform: translate(3px,2px); }
    90%     { transform: translate(-2px,1px); }
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
    0%,100% { text-shadow: 0 0 12px #f97316, 0 0 24px #9945FF; }
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
  @keyframes sc-cursor {
    0%,100% { left: 4%; }
    50%     { left: 80%; }
  }
  @keyframes sc-in {
    0%   { transform: translateY(24px); opacity: 0; }
    100% { transform: translateY(0);    opacity: 1; }
  }
  @keyframes sc-result-pop {
    0%   { transform: scale(0.6); opacity: 0; }
    40%  { transform: scale(1.2); opacity: 1; }
    100% { transform: scale(1.0); opacity: 1; }
  }
  @keyframes sc-bar-drain {
    from { width: 100%; }
    to   { width: 0%; }
  }
  @keyframes sc-target-pulse {
    0%,100% { box-shadow: 0 0 0 0 rgba(153,69,255,0.5); }
    50%     { box-shadow: 0 0 0 10px rgba(153,69,255,0); }
  }
  .sc-panel       { animation: sc-in 0.18s ease-out forwards; }
  .sc-cursor      { position: absolute; top: 0; width: 14px; height: 100%; background: #fff; border-radius: 3px;
                    box-shadow: 0 0 10px #fff, 0 0 20px '#ffffff';
                    animation: sc-cursor 1.8s linear infinite; pointer-events: none; }
  .sc-result-pop  { animation: sc-result-pop 0.3s ease-out forwards; }
  .sc-target-btn  { animation: sc-target-pulse 0.6s ease-in-out infinite; }
  @keyframes phase-flash { 0%{opacity:0.9} 50%{opacity:0.3} 100%{opacity:0} }
  @keyframes card-slide-in  { 0%{transform:translateX(110%);opacity:0} 100%{transform:translateX(0);opacity:1} }
  @keyframes card-slide-out { 0%{transform:translateX(0);opacity:1} 100%{transform:translateX(110%);opacity:0} }
  .event-card-in  { animation: card-slide-in  0.25s ease-out forwards; }
  .event-card-out { animation: card-slide-out 0.22s ease-in  forwards; }
`;


// ─── Skill Check ──────────────────────────────────────────────────────────────
type SkillCheckType = 'TAP_ZONE' | 'QUICK_TAP' | 'CODE_BREACH' | 'PATTERN_DODGE';

interface SkillCheck {
  type: SkillCheckType;
  startTime: number;   // Date.now() when triggered
  duration: number;    // ms the player has to respond
  phase: 'SHOW' | 'INPUT';  // CODE_BREACH: SHOW flashes the target, INPUT is pick-time
  data: {
    codes?: string[];    // CODE_BREACH: 4 hex codes
    targetIdx?: number;  // CODE_BREACH: which code was highlighted
    safeIdx?: number;    // PATTERN_DODGE: which of 4 slots is safe
  };
}

const BREACH_CODES = ['0xF3A7','0x8B2C','0x4D91','0xE5F6','0xA2B8','0x7C3E','0xD140','0x9FF2','0xC03B','0x61EA'];

const SC_META: Record<SkillCheckType, { label: string; sub: string; successMsg: string; failMsg: string; successRisk: number; failRisk: number; successPts: number; successMult: number }> = {
  TAP_ZONE:      { label: 'INTERCEPT SIGNAL',  sub: 'Press when bar enters green zone',   successMsg: '-18 RISK', failMsg: '+8 RISK',  successRisk: -18, failRisk: 8,  successPts: 0,   successMult: 0    },
  QUICK_TAP:     { label: 'BREACH WINDOW',     sub: 'Tap the target before it closes',    successMsg: '-15 RISK +150pts', failMsg: '+10 RISK', successRisk: -15, failRisk: 10, successPts: 150, successMult: 0    },
  CODE_BREACH:   { label: 'MEMORY BREACH',     sub: 'Memorise then select the lit code',  successMsg: '+0.25x MULT', failMsg: '+12 RISK', successRisk: 0,  failRisk: 12, successPts: 0,   successMult: 0.25 },
  PATTERN_DODGE: { label: 'FIREWALL BYPASS',   sub: 'Find the safe path',                 successMsg: '-12 RISK +200pts', failMsg: '+20 RISK', successRisk: -12, failRisk: 20, successPts: 200, successMult: 0    },
};

// ─── Robot GLB model (player side) ───────────────────────────────────────────
const ROBOT_ANIM: Record<string, string> = {
  'Idle':    'Idle',
  'Walking': 'Walk',
  'Punch':   'Punch',
  'Jump':    'Jump',
  'Dance':   'ThumbsUp',
  'Death':   'Death',
};
const RobotModel: React.FC<{
  action: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale?: number;
  riskLevel?: number;
}> = ({ action, position, rotation, scale = 1.2, riskLevel = 0 }) => {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF('/RobotExpressive.glb');
  // Clone per-instance so both player + enemy animate independently (SkeletonUtils preserves skin/bones)
  const clonedScene = useMemo(() => SkeletonUtils.clone(scene) as THREE.Object3D, [scene]);
  const { actions } = useAnimations(animations, group);
  const prevAnimRef = useRef('Idle');

  useEffect(() => {
    const animName = ROBOT_ANIM[action] ?? 'Idle';
    if (prevAnimRef.current === animName) return;
    actions[prevAnimRef.current]?.fadeOut(0.25);
    const next = actions[animName];
    if (next) {
      next.reset().fadeIn(0.25).play();
      if (animName === 'Death') { next.setLoop(THREE.LoopOnce, 1); next.clampWhenFinished = true; }
    }
    prevAnimRef.current = animName;
  }, [action, actions]);

  useFrame(() => {
    if (!group.current) return;
    if (riskLevel > 85) {
      group.current.rotation.z += ((Math.random() - 0.5) * 0.06 - group.current.rotation.z) * 0.3;
    } else {
      group.current.rotation.z *= 0.85;
    }
  });

  return (
    <group ref={group} position={position} rotation={rotation} scale={scale}>
      <primitive object={clonedScene} />
    </group>
  );
};
useGLTF.preload('/RobotExpressive.glb');

// ─── 3D Fighter ───────────────────────────────────────────────────────────────
const getAvatarColor = (id?: string) => {
  if (!id) return '#00FBFF';
  if (id.includes('gold') || id.includes('god'))    return '#FFD700';
  if (id.includes('void') || id.includes('ghost'))  return '#A855F7';
  if (id.includes('red')  || id.includes('striker'))return '#9945FF';
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
  riskLevel?: number;
}

// Procedural humanoid — no external model file required
const FighterModel: React.FC<FighterProps> = ({
  action, position, rotation, scale = 1.0, color = '#00fbff', gearIds = [], isEnemy = false, riskLevel = 0,
}) => {
  const groupRef   = useRef<THREE.Group>(null);
  const leftArmRef  = useRef<THREE.Mesh>(null);
  const rightArmRef = useRef<THREE.Mesh>(null);
  const leftLegRef  = useRef<THREE.Mesh>(null);
  const rightLegRef = useRef<THREE.Mesh>(null);
  const t = useRef(0);
  const weaponType = useMemo(() => isEnemy ? 'BLADE' : getWeaponType(gearIds), [gearIds, isEnemy]);
  const ei = isEnemy ? 0.45 : 0.3; // emissive intensity

  useFrame((_, delta) => {
    t.current += delta;
    const time = t.current;
    if (!groupRef.current) return;

    // Animation speed scales with risk: 1× at 0 risk, 2.5× at 100 risk
    const speed = 1 + (riskLevel / 100) * 1.5;

    if (action === 'Idle') {
      groupRef.current.position.y = position[1] + Math.sin(time * 1.4 * speed) * 0.05;
      // Enemy leans toward player at high risk
      if (isEnemy && riskLevel > 50) {
        groupRef.current.rotation.y = rotation[1] + Math.sin(time * 0.8) * 0.12 * (riskLevel / 100);
      }
    } else if (action === 'Walking' || action === 'Punch') {
      const freq = 5 * speed;
      groupRef.current.position.y = position[1] + Math.abs(Math.sin(time * freq)) * 0.06;
      if (leftArmRef.current)  leftArmRef.current.rotation.x  =  Math.sin(time * freq) * 0.65;
      if (rightArmRef.current) rightArmRef.current.rotation.x = -Math.sin(time * freq) * 0.65;
      if (leftLegRef.current)  leftLegRef.current.rotation.x  = -Math.sin(time * freq) * 0.5;
      if (rightLegRef.current) rightLegRef.current.rotation.x =  Math.sin(time * freq) * 0.5;
    } else if (action === 'Jump') {
      groupRef.current.position.y = position[1] + Math.abs(Math.sin(time * 3)) * 0.45;
    } else if (action === 'Dance') {
      groupRef.current.position.y = position[1] + Math.abs(Math.sin(time * 5)) * 0.18;
      groupRef.current.rotation.y = rotation[1] + Math.sin(time * 3) * 0.45;
    } else if (action === 'Death') {
      if (groupRef.current.rotation.z < Math.PI / 2.2)
        groupRef.current.rotation.z += delta * 1.8;
    }
  });

  return (
    <group ref={groupRef} position={position} rotation={rotation} scale={scale}>
      {/* Head */}
      <mesh position={[0, 1.72, 0]}>
        <sphereGeometry args={[0.26, 16, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={ei} />
      </mesh>
      {/* Visor */}
      <mesh position={[0, 1.72, 0.23]}>
        <boxGeometry args={[0.3, 0.09, 0.04]} />
        <meshStandardMaterial color={isEnemy ? '#ff2222' : '#00ffff'} emissive={isEnemy ? '#ff2222' : '#00ffff'} emissiveIntensity={4} />
      </mesh>
      {/* Body */}
      <mesh position={[0, 1.08, 0]}>
        <boxGeometry args={[0.52, 0.72, 0.28]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={ei} />
      </mesh>
      {/* Left arm */}
      <mesh ref={leftArmRef} position={[-0.4, 1.08, 0]}>
        <cylinderGeometry args={[0.09, 0.08, 0.62, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={ei} />
      </mesh>
      {/* Right arm */}
      <mesh ref={rightArmRef} position={[0.4, 1.08, 0]}>
        <cylinderGeometry args={[0.09, 0.08, 0.62, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={ei} />
      </mesh>
      {/* Left leg */}
      <mesh ref={leftLegRef} position={[-0.16, 0.44, 0]}>
        <cylinderGeometry args={[0.11, 0.09, 0.62, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={ei} />
      </mesh>
      {/* Right leg */}
      <mesh ref={rightLegRef} position={[0.16, 0.44, 0]}>
        <cylinderGeometry args={[0.11, 0.09, 0.62, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={ei} />
      </mesh>
      {/* Weapon */}
      {weaponType !== 'NONE' && (
        <group position={[0, 1.1, isEnemy ? -0.7 : 0.7]} rotation={[isEnemy ? -Math.PI / 10 : Math.PI / 10, 0, 0]}>
          <mesh position={[0, 0.4, 0]}>
            <boxGeometry args={[0.07, 1.2, 0.04]} />
            <meshStandardMaterial color={isEnemy ? '#9945FF' : '#00fbff'} emissive={isEnemy ? '#9945FF' : '#00fbff'} emissiveIntensity={3} />
          </mesh>
          <Sparkles count={8} scale={1.4} size={2.5} speed={0.4} opacity={0.5} color={isEnemy ? 'red' : 'cyan'} />
        </group>
      )}
      {/* Ground glow */}
      <pointLight position={[0, 0.6, 0]} distance={3.5} intensity={isEnemy ? 6 : 5} color={color} />
    </group>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
const RaidScreen: React.FC<RaidScreenProps> = ({
  onFinish, equippedGearIds, entryFee, difficulty, activeBoosts, equippedAvatarId,
  ticketBoost = false, streakBonus = 0, dailyStreak = 0, personalBestPoints = 0,
  isRoundEntry = false,
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

  const gearRiskFactor  = Math.max(0.60, 1 - gearStats.riskReduc / 100);
  const baseRisk        = Math.max(0, diffConfig.riskMod - gearStats.riskReduc);
  const initialMultiplier = 1.0 + gearStats.mult + boostStats.startMultBonus + streakBonus;
  const initialTime     = 90 + gearStats.timeBoost;

  const [points,     setPoints]     = useState(0);
  const [risk,       setRisk]       = useState(baseRisk);
  const [timeLeft,   setTimeLeft]   = useState(initialTime);
  const [multiplier, setMultiplier] = useState(initialMultiplier);
  const [flash,      setFlash]      = useState<string | null>(null);
  const [logs,       setLogs]       = useState<string[]>(['Link stable', 'Timer synced']);
  const [isEnding,   setIsEnding]   = useState<'WIN' | 'LOSS' | null>(null);
  const [sparks,     setSparks]     = useState<Spark[]>([]);
  const [dmgPopups,  setDmgPopups]  = useState<DamagePopup[]>([]);

  // Grace period
  const [graceCount,  setGraceCount]  = useState(3);
  const [graceActive, setGraceActive] = useState(true);

  // Anti-cheat
  const [hasInteracted,      setHasInteracted]      = useState(false);
  const [showExtractHint,    setShowExtractHint]    = useState(false);
  const extractHintShownRef = useRef(false);
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
  const [comboPopups,     setComboPopups]     = useState<Array<{ id: number; text: string; color: string }>>([]);

  // ── Skill check state ─────────────────────────────────────────────────────
  const [skillCheck,       setSkillCheck]       = useState<SkillCheck | null>(null);
  const [skillCheckResult, setSkillCheckResult] = useState<'SUCCESS' | 'FAIL' | null>(null);
  const skillCheckRef         = useRef<SkillCheck | null>(null);
  const lastSkillCheckTimeRef = useRef(0);
  const skillCheckTimeoutRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { skillCheckRef.current = skillCheck; }, [skillCheck]);

  // ── Feature 1: Raid Phases ────────────────────────────────────────────────
  const [raidPhase, setRaidPhase] = useState<RaidPhase>('BREACH');
  const [phaseFlash, setPhaseFlash] = useState<string | null>(null);
  const raidPhaseRef = useRef<RaidPhase>('BREACH');

  // ── Feature 2: Checkpoint Banking ────────────────────────────────────────
  const [bankedYield, setBankedYield] = useState(0);
  const bankedYieldRef = useRef(0);
  const checkpointFiredRef = useRef<Set<number>>(new Set());
  const currentYieldRef = useRef('0');

  // ── Feature 3: Event Cards ────────────────────────────────────────────────
  const [activeEventCard, setActiveEventCard] = useState<EventCard | null>(null);
  const activeEventCardRef = useRef<EventCard | null>(null);
  const lastEventCardSecRef = useRef(0);
  const eventCardTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [eventCardExiting, setEventCardExiting] = useState(false);
  const corpSweepActiveRef = useRef(false);

  // ── Feature 4 (Intel): Scout Phase ───────────────────────────────────────
  const [scoutPhase, setScoutPhase] = useState<'SCOUTING' | 'DONE'>('SCOUTING');
  const [scoutCountdown, setScoutCountdown] = useState(15);
  const [selectedNode, setSelectedNode] = useState<ScoutNode | null>(null);
  const selectedNodeRef = useRef<ScoutNode | null>(null);
  const scoutIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scoutNodeAppliedRef = useRef(false);
  const scoutPhaseDoneRef = useRef(false);

  // ── Feature 5: Loot Layers ────────────────────────────────────────────────
  const [skrShards, setSkrShards] = useState(0);
  const [srBursts, setSrBursts] = useState(0);
  const skrShardsRef = useRef(0);
  const srBurstsRef = useRef(0);

  // ── Meta-loop hook refs ────────────────────────────────────────────────────
  const nearWinCountRef   = useRef(0);           // firewall saves this raid
  const newPbShownRef     = useRef(false);        // only flash PB popup once
  const donShownRef       = useRef(false);        // Double or Nothing shown once
  const donTimerRef       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const solMultiplierRef  = useRef(1.0);          // 2.0 when player pushes DON
  const [donActive, setDonActive] = useState(false);

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
    if (skillCheckTimeoutRef.current) clearTimeout(skillCheckTimeoutRef.current);
    if (donTimerRef.current) clearTimeout(donTimerRef.current);
    if (scoutIntervalRef.current)    clearInterval(scoutIntervalRef.current);
    if (eventCardTimeoutRef.current) clearTimeout(eventCardTimeoutRef.current);
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
  const stateRef = useRef({ multiplier, risk, points, isEnding, enemyAction, timeLeft, raidPhase });
  useEffect(() => {
    stateRef.current = { multiplier, risk, points, isEnding, enemyAction, timeLeft, raidPhase };
  }, [multiplier, risk, points, isEnding, enemyAction, timeLeft, raidPhase]);
  useEffect(() => { raidPhaseRef.current = raidPhase; }, [raidPhase]);
  useEffect(() => { activeEventCardRef.current = activeEventCard; }, [activeEventCard]);
  useEffect(() => { selectedNodeRef.current = selectedNode; }, [selectedNode]);

  const userColor  = useMemo(() => getAvatarColor(equippedAvatarId), [equippedAvatarId]);
  const weaponType = useMemo(() => getWeaponType(equippedGearIds),    [equippedGearIds]);

  // Grace period countdown
  useEffect(() => {
    if (scoutPhase !== 'DONE') return;
    if (!graceActive) return;
    if (graceCount <= 0) {
      sounds.playCountdownTick(true);
      const t = setTimeout(() => setGraceActive(false), 700);
      return () => clearTimeout(t);
    }
    sounds.playCountdownTick(false);
    const t = setTimeout(() => setGraceCount(prev => prev - 1), 1000);
    return () => clearTimeout(t);
  }, [graceCount, graceActive, scoutPhase]); // eslint-disable-line

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

  // ── Extended raid helpers ─────────────────────────────────────────────────

  const buildLootDrops = useCallback((): LootDrop[] => {
    const drops: LootDrop[] = [];
    if (skrShardsRef.current > 0) drops.push({ type: 'SKR_SHARD', amount: parseFloat(skrShardsRef.current.toFixed(2)) });
    if (srBurstsRef.current > 0)  drops.push({ type: 'SR_BURST',  amount: srBurstsRef.current });
    return drops;
  }, []);

  const dismissEventCard = useCallback(() => {
    setEventCardExiting(true);
    setTimeout(() => {
      setActiveEventCard(null);
      activeEventCardRef.current = null;
      setEventCardExiting(false);
    }, 220);
  }, []);

  const applyScoutNode = useCallback((node: ScoutNode) => {
    if (scoutNodeAppliedRef.current) return;
    scoutNodeAppliedRef.current = true;
    if (scoutIntervalRef.current) { clearInterval(scoutIntervalRef.current); scoutIntervalRef.current = null; }
    setSelectedNode(node);
    selectedNodeRef.current = node;
    setScoutPhase('DONE');
    scoutPhaseDoneRef.current = true;
    if (node.riskMod !== 0) setRisk(prev => Math.max(0, prev + node.riskMod));
    logEvent('INTEL', `Selected entry node: ${node.label}`, `Risk ${node.riskMod >= 0 ? '+' : ''}${node.riskMod} · Loot bias: ${node.lootBias}`, 'info');
  }, [logEvent]); // eslint-disable-line

  const bankCheckpoint = useCallback((elapsedSec: number, source: string) => {
    const key = source === 'RANDOM' ? -1 : elapsedSec;
    if (checkpointFiredRef.current.has(key)) return;
    checkpointFiredRef.current.add(key);
    const nodeBonus = selectedNodeRef.current?.checkpointBankBonus ?? 1.0;
    const raw = parseFloat(currentYieldRef.current) * 0.05 * nodeBonus;
    const bankAmt = Math.min(0.002, raw);
    if (bankAmt <= 0) return;
    bankedYieldRef.current = parseFloat((bankedYieldRef.current + bankAmt).toFixed(6));
    setBankedYield(bankedYieldRef.current);
    const srGain = 15 + Math.floor(Math.random() * 20);
    srBurstsRef.current += srGain;
    setSrBursts(srBurstsRef.current);
    spawnSparks('#FFB800', '#ffffff', 10);
    addDmgPopup(`CHECKPOINT +${bankAmt.toFixed(4)}`, '#FFB800', false);
    logEvent('CHECKPOINT', `${source} checkpoint banked`, `+${bankAmt.toFixed(4)} SOL locked in · +${srGain} SR`, 'bonus');
  }, [spawnSparks, addDmgPopup, logEvent]); // eslint-disable-line

  const bankCheckpointRef = useRef(bankCheckpoint);
  useEffect(() => { bankCheckpointRef.current = bankCheckpoint; }, [bankCheckpoint]);

  const triggerEventCard = useCallback((type?: EventCardType) => {
    if (activeEventCardRef.current || stateRef.current.isEnding) return;
    if (skillCheckRef.current || ambushTimeoutRef.current) return;
    const types: EventCardType[] = ['DATA_CACHE', 'FIREWALL_SURGE', 'GHOST_SIGNAL', 'CORP_SWEEP'];
    const cardType = type ?? types[Math.floor(Math.random() * types.length)];
    const meta = EVENT_CARD_META[cardType];
    const card: EventCard = { id: Date.now(), type: cardType, startTime: Date.now(), duration: meta.duration, resolved: false };
    setActiveEventCard(card);
    activeEventCardRef.current = card;
    lastEventCardSecRef.current = Math.floor((Date.now() - raidStartMsRef.current) / 1000);
    logEvent('EVENT_CARD', `Event card: ${meta.label}`, meta.sub, 'info');

    if (eventCardTimeoutRef.current) clearTimeout(eventCardTimeoutRef.current);
    eventCardTimeoutRef.current = setTimeout(() => {
      // Auto-resolve
      if (!activeEventCardRef.current || activeEventCardRef.current.id !== card.id) return;
      if (cardType === 'FIREWALL_SURGE') {
        // ignored → +15 risk
        setRisk(prev => Math.min(98, prev + 15));
        addDmgPopup('+15 RISK!', '#9945FF');
        logEvent('EVENT_CARD', 'FIREWALL_SURGE ignored', '+15 RISK', 'danger');
      } else if (cardType === 'DATA_CACHE') {
        // auto-grant SKR shard
        const skrGain = parseFloat((0.1 + Math.random() * 0.5).toFixed(2));
        skrShardsRef.current = parseFloat((skrShardsRef.current + skrGain).toFixed(2));
        setSkrShards(skrShardsRef.current);
        addDmgPopup(`+${skrGain} SKR`, '#FFB800');
        logEvent('EVENT_CARD', 'DATA_CACHE collected', `+${skrGain} SKR shards`, 'bonus');
      } else if (cardType === 'CORP_SWEEP') {
        corpSweepActiveRef.current = true;
        setTimeout(() => { corpSweepActiveRef.current = false; }, 4000);
        logEvent('EVENT_CARD', 'CORP_SWEEP — going dark', 'Controls frozen 4s', 'warning');
      }
      // GHOST_SIGNAL ignored → correct choice, no penalty
      setEventCardExiting(true);
      setTimeout(() => {
        setActiveEventCard(null);
        activeEventCardRef.current = null;
        setEventCardExiting(false);
        eventCardTimeoutRef.current = null;
      }, 220);
    }, meta.duration);
  }, [addDmgPopup, logEvent]); // eslint-disable-line

  const triggerEventCardRef = useRef(triggerEventCard);
  useEffect(() => { triggerEventCardRef.current = triggerEventCard; }, [triggerEventCard]);

  const transitionToPhase = useCallback((newPhase: RaidPhase, elapsedSec: number) => {
    const config = RAID_PHASE_CONFIG[newPhase];
    setRaidPhase(newPhase);
    raidPhaseRef.current = newPhase;
    if (config.riskResetOnEntry > 0) setRisk(prev => Math.max(0, prev - config.riskResetOnEntry));
    setPhaseFlash(config.color);
    setTimeout(() => setPhaseFlash(null), 700);
    spawnSparks(config.color, '#ffffff', 16);
    addDmgPopup(`${config.label}`, config.color, true);
    logEvent('PHASE_TRANSITION', `Entering phase: ${config.label}`, config.riskResetOnEntry > 0 ? `-${config.riskResetOnEntry} RISK · Drift ×${config.driftMod}` : `Drift ×${config.driftMod}`, 'bonus');
    bankCheckpointRef.current(elapsedSec, 'PHASE');
    setTimeout(() => triggerEventCardRef.current('DATA_CACHE'), 800);
  }, [spawnSparks, addDmgPopup, logEvent]); // eslint-disable-line

  const transitionToPhaseRef = useRef(transitionToPhase);
  useEffect(() => { transitionToPhaseRef.current = transitionToPhase; }, [transitionToPhase]);

  // ── Skill check callbacks (after spawnSparks / logEvent are defined) ───────
  const applySkillCheckResult = useCallback((success: boolean) => {
    const sc = skillCheckRef.current;
    if (!sc || stateRef.current.isEnding) return;
    if (skillCheckTimeoutRef.current) { clearTimeout(skillCheckTimeoutRef.current); skillCheckTimeoutRef.current = null; }
    const meta = SC_META[sc.type];
    if (success) {
      setSkillCheckResult('SUCCESS');
      if (meta.successRisk !== 0) setRisk(prev => Math.max(0, prev + meta.successRisk));
      if (meta.successPts > 0)    setPoints(prev => prev + meta.successPts);
      if (meta.successMult > 0)   setMultiplier(prev => { const n = prev + meta.successMult; if (n > peakMultRef.current) peakMultRef.current = n; return n; });
      // Loot: SR burst on skill check success
      const srGain = 20 + Math.floor(Math.random() * 40);
      srBurstsRef.current += srGain;
      setSrBursts(srBurstsRef.current);
      addComboPopup(meta.successMsg, '#14F195');
      spawnSparks('#14F195', '#FFD700', 14);
      sounds.playCashOut();
      logEvent('SKILL_CHECK', `${meta.label} — Success`, meta.successMsg, 'bonus');
    } else {
      setSkillCheckResult('FAIL');
      setRisk(prev => Math.min(98, prev + meta.failRisk));
      addComboPopup(meta.failMsg, '#9945FF');
      spawnSparks('#9945FF', '#f97316', 10);
      sounds.playDefend();
      logEvent('SKILL_CHECK', `${meta.label} — Fail`, meta.failMsg, 'warning');
    }
    skillCheckTimeoutRef.current = setTimeout(() => {
      setSkillCheck(null);
      skillCheckRef.current = null;
      setSkillCheckResult(null);
      skillCheckTimeoutRef.current = null;
      lastSkillCheckTimeRef.current = Date.now();
    }, 1200);
  }, [addComboPopup, spawnSparks, sounds, logEvent]); // eslint-disable-line

  const applySkillCheckResultRef = useRef(applySkillCheckResult);
  useEffect(() => { applySkillCheckResultRef.current = applySkillCheckResult; }, [applySkillCheckResult]);

  const triggerSkillCheck = useCallback(() => {
    if (skillCheckRef.current || stateRef.current.isEnding) return;
    const types: SkillCheckType[] = ['TAP_ZONE', 'QUICK_TAP', 'CODE_BREACH', 'PATTERN_DODGE'];
    const type = types[Math.floor(Math.random() * types.length)];
    let data: SkillCheck['data'] = {};
    let duration = 3000;
    const phase: SkillCheck['phase'] = (type === 'CODE_BREACH' || type === 'PATTERN_DODGE') ? 'SHOW' : 'INPUT';
    if (type === 'QUICK_TAP')     { data.targetIdx = Math.floor(Math.random() * 4); duration = 1800; }
    else if (type === 'CODE_BREACH') {
      const shuffled = [...BREACH_CODES].sort(() => Math.random() - 0.5);
      data.codes = shuffled.slice(0, 4);
      data.targetIdx = Math.floor(Math.random() * 4);
      duration = 3000;
    } else if (type === 'PATTERN_DODGE') { data.safeIdx = Math.floor(Math.random() * 4); duration = 2000; }
    else { duration = 4000; } // TAP_ZONE
    const sc: SkillCheck = { type, startTime: Date.now(), duration, phase, data };
    setSkillCheck(sc);
    skillCheckRef.current = sc;
    if (type === 'CODE_BREACH' || type === 'PATTERN_DODGE') {
      const showMs = type === 'CODE_BREACH' ? 1500 : 1000;
      skillCheckTimeoutRef.current = setTimeout(() => {
        const updated: SkillCheck = { ...sc, phase: 'INPUT', startTime: Date.now() };
        setSkillCheck(updated);
        skillCheckRef.current = updated;
        skillCheckTimeoutRef.current = setTimeout(() => applySkillCheckResultRef.current(false), duration);
      }, showMs);
    } else {
      skillCheckTimeoutRef.current = setTimeout(() => applySkillCheckResultRef.current(false), duration);
    }
    setLogs(prev => ['Skill check!', ...prev].slice(0, 2));
    sounds.hapticWarning();
  }, [sounds]); // eslint-disable-line

  const triggerSkillCheckRef = useRef(triggerSkillCheck);
  useEffect(() => { triggerSkillCheckRef.current = triggerSkillCheck; }, [triggerSkillCheck]);

  // ── Intel Scout Phase countdown ───────────────────────────────────────────
  useEffect(() => {
    let remaining = 15;
    scoutIntervalRef.current = setInterval(() => {
      remaining -= 1;
      setScoutCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(scoutIntervalRef.current!);
        scoutIntervalRef.current = null;
        applyScoutNode(SCOUT_NODES[0]); // auto-pick LOW THREAT
      }
    }, 1000);
    return () => {
      if (scoutIntervalRef.current) { clearInterval(scoutIntervalRef.current); scoutIntervalRef.current = null; }
    };
  }, []); // eslint-disable-line

  // ── Personal Best mid-raid highlight ─────────────────────────────────────
  useEffect(() => {
    if (!newPbShownRef.current && personalBestPoints > 0 && points > personalBestPoints && !isEnding) {
      newPbShownRef.current = true;
      addComboPopup('🏆 NEW BEST!', '#FFD700');
      spawnSparks('#FFD700', '#FFB800', 16);
    }
  }, [points]); // eslint-disable-line

  const bustTimeRef = useRef(0);
  const handleBust = useCallback((reason: string = 'PROTOCOL_FAILURE') => {
    if (stateRef.current.isEnding) return;
    // Clear all timers
    if (defendLockRef.current)    { clearInterval(defendLockRef.current);  defendLockRef.current = null; }
    if (goldenWindowRef.current)  { clearInterval(goldenWindowRef.current); goldenWindowRef.current = null; }
    if (ambushTimeoutRef.current) { clearTimeout(ambushTimeoutRef.current); ambushTimeoutRef.current = null; }
    if (hotStreakTimerRef.current) { clearTimeout(hotStreakTimerRef.current); hotStreakTimerRef.current = null; }
    if (skillCheckTimeoutRef.current) { clearTimeout(skillCheckTimeoutRef.current); skillCheckTimeoutRef.current = null; }
    setDefendLocked(false);
    setDefendLockTimer(0);
    setGoldenWindow(false);
    setAmbushed(false);
    setHotStreak(false);
    setSkillCheck(null);
    setSkillCheckResult(null);
    skillCheckRef.current = null;
    // (near-miss display removed — round-based raids show points only)
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
    spawnSparks('#9945FF', '#ff6600', 22);
    addDmgPopup('BUSTED!', '#9945FF', true);
    setTimeout(() => onFinish(false, 0, stateRef.current.points, bustTimeRef.current, [...raidEventsRef.current], peakMultRef.current, nearWinCountRef.current, 0, buildLootDrops()), 2500);
  }, [onFinish, initialTime, difficulty, ticketBoost, sounds, spawnSparks, addDmgPopup, buildLootDrops]); // eslint-disable-line

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

      // Guard: pause all game logic during scout phase
      if (!scoutPhaseDoneRef.current) return;

      if (elapsedSeconds < 3) {
        setPoints(prev => prev + Math.floor(15 * state.multiplier * diffConfig.multMod));
        return;
      }

      // ── Phase transitions ──────────────────────────────────────────────────
      if (elapsedSeconds === 30 && raidPhaseRef.current === 'BREACH'   && !state.isEnding) transitionToPhaseRef.current('DEEP_RUN', elapsedSeconds);
      if (elapsedSeconds === 60 && raidPhaseRef.current === 'DEEP_RUN' && !state.isEnding) transitionToPhaseRef.current('CORE',     elapsedSeconds);

      // ── Random mid-phase checkpoint (around 45-55s, ~20% chance per tick) ─
      if (elapsedSeconds >= 45 && elapsedSeconds <= 55 && !state.isEnding) {
        if (!checkpointFiredRef.current.has(-1) && Math.random() < 0.20) {
          checkpointFiredRef.current.add(-1);
          bankCheckpointRef.current(elapsedSeconds, 'RANDOM');
        }
      }

      // ── Random event card (after 20s, 15s+ since last, ~6% per tick) ──────
      const secsSinceLastCard = elapsedSeconds - lastEventCardSecRef.current;
      if (
        elapsedSeconds > 20 && !activeEventCardRef.current && secsSinceLastCard >= 15 &&
        !state.isEnding && !skillCheckRef.current && !ambushTimeoutRef.current &&
        Math.random() < 0.06
      ) {
        triggerEventCardRef.current();
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
        addLog('Golden window');
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
            addLog('Window expired');
            addDmgPopup('WINDOW CLOSED!', '#9945FF');
          }
        }, 1000);
      }

      // ── JACKPOT: 3% chance after 6s — variable reward rush ────────────
      if (elapsedSeconds > 6 && Math.random() < 0.03 && !state.isEnding) {
        logEvent('JACKPOT', 'Protocol glitch in your favour — rare random event', '+0.5x multiplier bonus', 'bonus');
        addLog('Protocol glitch');
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

      // ── AMBUSH: 10% chance after 20s, throttled by ambushTimeoutRef ─────
      if (elapsedSeconds > 20 && Math.random() < 0.10 && !ambushTimeoutRef.current && !state.isEnding) {
        logEvent('AMBUSH', 'Enemy flanked your position — random event', '+14 RISK + 2.2s controls locked', 'danger');
        setAmbushed(true);
        addLog('Ambush detected');
        addDmgPopup('AMBUSH!', '#9945FF', true);
        spawnSparks('#9945FF', '#f97316', 18);
        setRisk(prev => Math.min(98, prev + 14));
        sounds.hapticCritical();
        ambushTimeoutRef.current = setTimeout(() => {
          setAmbushed(false);
          ambushTimeoutRef.current = null;
        }, 2200);
      }

      // ── Skill check trigger: ~12% per tick after 15s, 10s cooldown ──────
      if (
        elapsedSeconds > 15 &&
        !skillCheckRef.current &&
        (Date.now() - lastSkillCheckTimeRef.current) > 10000 &&
        Math.random() < 0.12 &&
        !state.isEnding
      ) {
        triggerSkillCheckRef.current();
      }

      const timePenalty   = Math.max(0, (elapsedSeconds - 30) * 0.13);  // flat first 30s, then escalates
      const greedFactor   = state.multiplier > 1.7 ? 2.6 : state.multiplier > 1.2 ? 1.9 : 1.0;
      const houseEdge     = 1.65;
      const baseDrift     = (0.5 + (Math.random() * 1.2)) + timePenalty;
      const phaseDriftMod = RAID_PHASE_CONFIG[raidPhaseRef.current].driftMod;
      const totalDrift    = baseDrift * diffConfig.driftMod * boostStats.driftMultiplier * greedFactor * houseEdge * gearRiskFactor * phaseDriftMod;
      const spikeRoll    = Math.random();
      const randomSpike  = spikeRoll > 0.88 ? (spikeRoll > 0.94 ? 22 : 17) : 0;  // 12% spike chance
      if (randomSpike > 0 && !state.isEnding) {
        logEvent('NETWORK_SURGE', 'Random protocol traffic spike — occurs ~9% of ticks', `+${randomSpike} RISK applied`, 'danger');
        addLog('Network surge');
        addDmgPopup(`+${randomSpike} RISK!`, '#f97316');
        spawnSparks('#f97316', '#9945FF', 6);
      }

      if (!corpSweepActiveRef.current) {
        const nextRisk = state.risk + totalDrift + randomSpike;

        // ── Double or Nothing: trigger once at ~60% risk after 20s ──────────
        if (state.risk >= 58 && state.risk < 65 && !donShownRef.current && elapsedSeconds > 20 && !state.isEnding) {
          donShownRef.current = true;
          setDonActive(true);
          if (donTimerRef.current) clearTimeout(donTimerRef.current);
          donTimerRef.current = setTimeout(() => setDonActive(false), 9000);
        }

        // ── LAST-SECOND SAVE: base 4% + 2% per daily streak day (max 14%) ──
        const firewallChance = Math.min(0.14, 0.04 + dailyStreak * 0.02);
        if (nextRisk >= 100 && Math.random() < firewallChance && !state.isEnding) {
          nearWinCountRef.current += 1;
          logEvent('FIREWALL', `Emergency firewall — streak day ${dailyStreak} boosted save chance`, 'Risk reset to 75, raid continues', 'bonus');
          addLog('Firewall activated');
          spawnSparks('#14F195', '#00FBFF', 32);
          setFirewallSave(true);
          setTimeout(() => setFirewallSave(false), 1400);
          setRisk(75);
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
      }

      // Fighter animations driven by risk level
      const r = state.risk;
      if (state.enemyAction === 'Idle') {
        if (r > 85) {
          // Critical risk — enemy punches aggressively every tick
          setEnemyAction('Punch');
          setTimeout(() => { if (!stateRef.current.isEnding) setEnemyAction('Idle'); }, 500);
          setUserAction(prev => prev === 'Idle' ? 'Walking' : prev);
          setTimeout(() => { if (!stateRef.current.isEnding) setUserAction('Idle'); }, 500);
        } else if (r > 65) {
          // High risk — enemy punches occasionally, player retreats
          if (Math.random() > 0.4) {
            setEnemyAction('Punch');
            setTimeout(() => { if (!stateRef.current.isEnding) setEnemyAction('Idle'); }, 600);
          } else {
            setEnemyAction('Walking');
            setTimeout(() => { if (!stateRef.current.isEnding) setEnemyAction('Idle'); }, 800);
          }
        } else if (r > 40) {
          // Medium risk — enemy walks forward menacingly
          if (Math.random() > 0.5) {
            setEnemyAction('Walking');
            setTimeout(() => { if (!stateRef.current.isEnding) setEnemyAction('Idle'); }, 1000);
          }
        } else {
          // Low risk — occasional idle movement
          if (Math.random() > 0.75) {
            setEnemyAction('Walking');
            setTimeout(() => { if (!stateRef.current.isEnding) setEnemyAction('Idle'); }, 800);
          }
        }
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, []); // eslint-disable-line

  const handleCashOut = () => {
    if (isEnding || !hasInteracted || graceActive || ambushed) return;
    if (defendLockRef.current)    { clearInterval(defendLockRef.current);  defendLockRef.current = null; }
    if (goldenWindowRef.current)  { clearInterval(goldenWindowRef.current); goldenWindowRef.current = null; }
    if (hotStreakTimerRef.current) { clearTimeout(hotStreakTimerRef.current); hotStreakTimerRef.current = null; }
    if (skillCheckTimeoutRef.current) { clearTimeout(skillCheckTimeoutRef.current); skillCheckTimeoutRef.current = null; }
    setDefendLocked(false);
    setDefendLockTimer(0);
    setGoldenWindow(false);
    setHotStreak(false);
    setSkillCheck(null);
    setSkillCheckResult(null);
    skillCheckRef.current = null;
    setIsEnding('WIN');
    setUserAction('Dance');
    setEnemyAction('Death');
    const elapsedSec = Math.max(3, initialTime - timeLeft);
    // Golden window gives +5% point bonus on lock-in; no SOL reward (round-based)
    const goldenBonus  = goldenWindow ? 1.05 : 1.0;
    const finalPoints  = Math.floor(points * goldenBonus);
    sounds.playCashOut();
    sounds.hapticExtract();
    if (goldenWindow) {
      logEvent('CASHOUT', 'Score locked during Golden Window', `+5% pts bonus → ${finalPoints.toLocaleString()} pts`, 'bonus');
      spawnSparks('#FFD700', '#14F195', 32);
      addDmgPopup('GOLDEN LOCK! +5%', '#FFD700', true);
    } else {
      logEvent('CASHOUT', 'Score locked in — awaiting round end', `${points.toLocaleString()} pts submitted`, 'bonus');
      spawnSparks('#14F195', '#00FBFF', 22);
      addDmgPopup('SCORE LOCKED!', '#14F195', true);
    }
    setTimeout(() => onFinish(true, 0, finalPoints, elapsedSec, [...raidEventsRef.current], peakMultRef.current, nearWinCountRef.current, 0, buildLootDrops()), 2500);
  };

  const handleAttack = () => {
    if (isEnding || graceActive || ambushed) return;
    setHasInteracted(true);
    if (!extractHintShownRef.current && personalBestPoints === 0) {
      extractHintShownRef.current = true;
      setShowExtractHint(true);
      setTimeout(() => setShowExtractHint(false), 5000);
    }
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
      addLog('Combo strike');
      setPoints(prev => prev + 500);
      setRisk(prev => Math.max(0, prev - 4));
    }

    // ── Aggression surge: every 5 attacks without defending ────────────────
    if (newAttackCount >= 5 && newAttackCount % 5 === 0) {
      logEvent('AGGRESSION', `${newAttackCount} attacks fired without defending — aggression penalty triggered`, '+15 RISK surge', 'danger');
      addLog('Aggression detected');
      addDmgPopup('AGGRESSION! +15', '#f97316', true);
      spawnSparks('#f97316', '#9945FF', 12);
      setTimeout(() => { if (!stateRef.current.isEnding) setRisk(prev => Math.min(99, prev + 15)); }, 200);
    }

    // ── Hot streak visual (2s flash when climbing) ────────────────────────
    setHotStreak(true);
    if (hotStreakTimerRef.current) clearTimeout(hotStreakTimerRef.current);
    hotStreakTimerRef.current = setTimeout(() => { setHotStreak(false); hotStreakTimerRef.current = null; }, 2000);

    const riskAdded = isCombo ? Math.max(6, 10 + Math.random() * 7) : 12 + Math.random() * 9;
    spawnSparks('#9945FF', '#f97316', 14);
    if (!isCombo) addDmgPopup(`+${Math.floor(riskAdded)} RISK`, '#9945FF');
    setFlash('rgba(153,69,255,0.25)');
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
        addDmgPopup('CRITICAL!', '#9945FF', true);
        spawnSparks('#9945FF', '#ffffff', 20);
        addLog('Critical overload');
        setTimeout(() => handleBust('RISK_CRITICAL'), 350);
        return 100;
      }
      return next;
    });
    setPoints(prev => prev + 200);
    if (!isCombo) addLog('Attack initiated');

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
      addLog('Counter executed');
      setPoints(prev => prev + 350);
      setRisk(prev => Math.max(0, prev - 10));
    }

    const tiers = [
      { min: 10, max: 14, multCost: 0.10, log: 'Shield stable'   },
      { min:  7, max: 11, multCost: 0.15, log: 'Shield active'   },
      { min:  5, max:  9, multCost: 0.22, log: 'Shield overheat' },
      { min:  3, max:  6, multCost: 0.30, log: 'Shield strained' },
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

  const elapsedSec         = Math.max(0, initialTime - timeLeft);
  const earlyExitWarn      = elapsedSec < 20 && hasInteracted && !graceActive && !isEnding;
  const currentYield       = (
    (points / 5000) * DIFFICULTY_MAX_WIN[difficulty]
    * (ticketBoost ? 1.1 : 1.0)
    * (goldenWindow ? 1.05 : 1.0)
    * (earlyExitWarn ? 0.3 : 1.0)
    * (1 - PLATFORM_FEE_RAID)
  ).toFixed(4);
  currentYieldRef.current = currentYield;
  const isUrgent       = timeLeft < 10;
  const isCritical     = timeLeft < 5;

  // Shake level
  const shakeClass = isEnding ? '' : risk > 93 ? 'shake-critical' : risk > 82 ? 'shake-heavy' : risk > 72 ? 'shake-mild' : '';

  const timerGlowClass = isCritical
    ? 'shadow-[0_0_20px_rgba(153,69,255,0.6)] border-[#9945FF] animate-pulse bg-red-950/40'
    : isUrgent
    ? 'shadow-[0_0_15px_rgba(153,69,255,0.3)] border-[#9945FF]/50 bg-red-950/20'
    : 'shadow-[0_0_10px_rgba(0,251,255,0.2)] border-[#00FBFF]/30';

  // Risk bar gradient
  const riskBarBg = risk > 75
    ? 'linear-gradient(90deg, #f97316, #9945FF)'
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
        <div className={`absolute inset-0 pointer-events-none z-0 ${isCritical ? 'bg-[#8833ee]/15' : 'bg-[#8833ee]/5'} animate-pulse`} />
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

      {/* ── SCOUT PHASE OVERLAY ── */}
      {scoutPhase === 'SCOUTING' && (
        <div className="absolute inset-0 z-[200] flex flex-col bg-black/95 backdrop-blur-sm p-4">
          <div className="shrink-0 flex items-center justify-between mb-4">
            <div>
              <p className="text-[9px] font-bold text-white uppercase tracking-widest mb-0.5">Intel Report</p>
              <p className="text-sm font-black text-white uppercase">SELECT ENTRY NODE</p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 border border-white/20 bg-white/5">
              <span className="text-[9px] font-bold text-white uppercase">Auto in</span>
              <span className="mono text-lg font-black text-[#9945FF]">{scoutCountdown}s</span>
            </div>
          </div>
          <div className="flex-1 flex flex-col gap-3 min-h-0">
            {SCOUT_NODES.map(node => (
              <button
                key={node.id}
                onClick={() => applyScoutNode(node)}
                className="flex-1 min-h-0 text-left p-4 border-2 transition-all active:scale-[0.98]"
                style={{ borderColor: node.color + '60', background: node.color + '10' }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-black uppercase tracking-wider" style={{ color: node.color }}>{node.label}</span>
                  <div className="flex items-center gap-2 text-[9px] font-bold text-white">
                    <span style={{ color: node.riskMod > 0 ? '#9945FF' : node.riskMod < 0 ? '#4ade80' : '#FFB800' }}>
                      {node.riskMod > 0 ? '+' : ''}{node.riskMod} RISK
                    </span>
                    <span className="text-white">·</span>
                    <span>LOOT: {node.lootBias}</span>
                  </div>
                </div>
                <p className="text-[10px] text-white leading-snug">{node.description}</p>
                {node.checkpointBankBonus > 1 && (
                  <p className="text-[8px] font-bold mt-1" style={{ color: '#FFB800' }}>⬆ +{Math.round((node.checkpointBankBonus - 1) * 100)}% checkpoint bonus</p>
                )}
              </button>
            ))}
          </div>
          <p className="shrink-0 text-center text-[8px] text-white mt-3 font-bold uppercase tracking-widest">
            Auto-selects LOW THREAT if no choice made
          </p>
        </div>
      )}

      {/* ── PHASE FLASH ── */}
      {phaseFlash && (
        <div
          className="absolute inset-0 z-[96] pointer-events-none"
          style={{ backgroundColor: phaseFlash, opacity: 0.35, animation: 'phase-flash 0.7s ease-out forwards' }}
        />
      )}

      {/* ── EVENT CARD ── */}
      {activeEventCard && !isEnding && (() => {
        const meta = EVENT_CARD_META[activeEventCard.type];
        const elapsed = Date.now() - activeEventCard.startTime;
        const progress = Math.max(0, 1 - elapsed / meta.duration);
        return (
          <div
            className={`absolute bottom-24 right-3 z-[85] w-52 ${eventCardExiting ? 'event-card-out' : 'event-card-in'}`}
            style={{ borderLeft: `3px solid ${meta.color}`, background: 'rgba(0,0,0,0.92)', padding: '10px 12px' }}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: meta.color }}>{meta.label}</span>
              <button onClick={dismissEventCard} className="text-white hover:text-white text-xs leading-none">✕</button>
            </div>
            <p className="text-[9px] text-white mb-2">{meta.sub}</p>
            {/* Drain bar */}
            <div className="h-0.5 bg-white/10 overflow-hidden mb-2">
              <div className="h-full transition-none" style={{ width: `${progress * 100}%`, backgroundColor: meta.color }} />
            </div>
            {/* Action buttons */}
            {activeEventCard.type === 'FIREWALL_SURGE' && (
              <button
                disabled={ambushed}
                onClick={() => {
                  if (eventCardTimeoutRef.current) { clearTimeout(eventCardTimeoutRef.current); eventCardTimeoutRef.current = null; }
                  setRisk(prev => Math.max(0, prev - 10));
                  const sr = 20 + Math.floor(Math.random() * 30);
                  srBurstsRef.current += sr; setSrBursts(srBurstsRef.current);
                  addDmgPopup('-10 RISK', '#4ade80');
                  logEvent('EVENT_CARD', 'FIREWALL_SURGE absorbed', '-10 RISK · +SR', 'bonus');
                  dismissEventCard();
                }}
                className="w-full py-1.5 text-[10px] font-black uppercase transition-all disabled:opacity-30"
                style={{ background: '#9945FF', color: '#fff' }}
              >
                ABSORB
              </button>
            )}
            {activeEventCard.type === 'GHOST_SIGNAL' && (
              <button
                disabled={ambushed}
                onClick={() => {
                  if (eventCardTimeoutRef.current) { clearTimeout(eventCardTimeoutRef.current); eventCardTimeoutRef.current = null; }
                  // Extract = wrong choice: -8% yield for 15s
                  const prev = solMultiplierRef.current;
                  solMultiplierRef.current *= 0.92;
                  addDmgPopup('-8% YIELD 15s', '#f97316');
                  logEvent('EVENT_CARD', 'GHOST_SIGNAL — lure triggered', '-8% yield for 15s', 'warning');
                  setTimeout(() => { solMultiplierRef.current = prev; }, 15000);
                  dismissEventCard();
                }}
                className="w-full py-1.5 text-[10px] font-black uppercase transition-all disabled:opacity-30"
                style={{ background: '#9945FF', color: '#fff' }}
              >
                EXTRACT (LURE)
              </button>
            )}
          </div>
        );
      })()}

      {/* WIN OVERLAY */}
      {isEnding === 'WIN' && (
        <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-[#14F195]/20 backdrop-blur-sm animate-in fade-in duration-300">
          <span className="text-5xl font-black text-[#14F195] glitch-text uppercase">Score Locked!</span>
          <span className="text-xs text-white font-bold mt-4 animate-pulse">Uploading score...</span>
        </div>
      )}

      {/* LOSS OVERLAY */}
      {isEnding === 'LOSS' && (
        <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-red-950/40 backdrop-blur-sm animate-in fade-in duration-300 gap-3">
          <span className="text-5xl font-black text-[#9945FF] glitch-text uppercase">Link Severed</span>
          <span className="text-xs text-[#9945FF]/60 font-bold animate-pulse">
            {timeLeft <= 0 ? 'Timeout' : 'Protocol failure'}
          </span>
          {points > 0 && (
            <div className="mt-2 text-center px-6 py-3 border border-white/10 bg-black/60">
              <p className="text-[9px] font-bold text-white mb-1">Points scored</p>
              <p className="mono text-3xl font-black text-white">{points.toLocaleString()} <span className="text-sm text-[#FFB800]/60">pts</span></p>
              <p className="text-[8px] font-bold text-[#9945FF]/40 mt-1">No round allocation for failed raids</p>
            </div>
          )}
          {(() => {
            const g = equippedGearIds.length;
            if (g >= 4) return (
              <p className="text-[9px] font-bold text-white mt-2 px-4 text-center">
                Full loadout — try a Raid Pass for 50% off + 10% boost
              </p>
            );
            if (g === 0) return (
              <p className="text-[9px] font-bold text-[#FFB800]/50 mt-2 px-4 text-center">
                No gear loaded — equip from the Market to cut drift
              </p>
            );
            return (
              <p className="text-[9px] font-bold text-white mt-2 px-4 text-center">
                {g}/4 gear slots — {4 - g} more slot{4 - g > 1 ? 's' : ''} open in the Market
              </p>
            );
          })()}
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
            <span className="text-5xl font-black text-[#14F195] uppercase" style={{ textShadow: '0 0 40px #14F195' }}>Firewall</span>
            <span className="text-sm font-bold text-[#00FBFF]">Protocol saved</span>
          </div>
        </div>
      )}

      {/* GOLDEN WINDOW BANNER */}
      {goldenWindow && !isEnding && (
        <div className="absolute top-0 left-0 right-0 z-[60] flex justify-center pt-1 pointer-events-none">
          <div className="golden-glow flex items-center gap-3 px-4 py-2 bg-yellow-950/80 border border-yellow-500/80">
            <span className="text-[10px] font-bold text-yellow-500">Golden window</span>
            <span className="mono text-2xl font-black text-yellow-400">{goldenCountdown}s</span>
            <span className="text-[9px] font-bold text-yellow-600">+5% bonus</span>
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
          <div className={`flex-1 bg-black/80 p-2 border tech-border transition-colors duration-300 ${goldenWindow ? 'border-yellow-500/60' : 'border-white/10'}`}>
            <p className={`text-[9px] font-bold leading-none mb-1 ${goldenWindow ? 'text-yellow-500/80' : 'text-white'}`}>
              {goldenWindow ? 'Golden lock' : 'Score'}
            </p>
            <div className="flex items-baseline gap-2">
              <span className={`mono text-xl font-black ${goldenWindow ? 'text-yellow-400' : risk > 85 ? 'text-[#9945FF]' : 'text-white'}`}>{points.toLocaleString()}</span>
              <span className={`text-[10px] font-bold ${goldenWindow ? 'text-yellow-500' : 'text-[#FFB800]'}`}>pts</span>
            </div>
          </div>
          <div className={`relative w-28 px-2 py-2 bg-black/80 border tech-border flex flex-col items-center ${timerGlowClass}`}>
            <span className={`text-[8px] font-bold mb-0.5 ${isUrgent ? 'text-[#9945FF] animate-pulse' : 'text-white'}`}>Time left</span>
            <div className="flex items-baseline gap-1">
              <span className={`mono text-2xl font-black leading-none ${isUrgent ? 'text-[#9945FF]' : 'text-[#00FBFF]'}`}>{Math.max(0, Math.floor(timeLeft))}</span>
              <span className="text-[10px] font-bold text-white">s</span>
            </div>
          </div>
          {dailyStreak >= 2 && (
            <div className="flex flex-col items-center justify-center px-2 py-1 rounded-lg"
              style={{ background: 'rgba(255,184,0,0.12)', border: '1px solid rgba(255,184,0,0.35)' }}>
              <span className="text-[14px] leading-none">🔥</span>
              <span className="text-[9px] font-black text-[#FFB800] leading-none mt-0.5">{dailyStreak}d</span>
            </div>
          )}
        </div>

        {/* ── Phase badge + loot counters + round badge ── */}
        {!isEnding && scoutPhase === 'DONE' && (
          <div className="shrink-0 flex items-center justify-center gap-2 mb-1.5 flex-wrap">
            {/* Phase badge */}
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full"
              style={{ background: RAID_PHASE_CONFIG[raidPhase].color + '18', border: `1px solid ${RAID_PHASE_CONFIG[raidPhase].color}50` }}>
              <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: RAID_PHASE_CONFIG[raidPhase].color }} />
              <span className="text-[8px] font-black uppercase tracking-widest" style={{ color: RAID_PHASE_CONFIG[raidPhase].color }}>
                {RAID_PHASE_CONFIG[raidPhase].label}
              </span>
            </div>
            {/* SKR shards */}
            {skrShards > 0 && (
              <span className="text-[8px] font-black text-[#FFB800] px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(255,184,0,0.12)', border: '1px solid rgba(255,184,0,0.30)' }}>
                ◆ {skrShards.toFixed(2)} SKR
              </span>
            )}
            {/* SR bursts */}
            {srBursts > 0 && (
              <span className="text-[8px] font-bold text-white px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)' }}>
                +{srBursts} SR
              </span>
            )}
            {/* Round badge */}
            {isRoundEntry && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(153,69,255,0.15)', border: '1px solid rgba(153,69,255,0.45)' }}>
                <div className="w-1.5 h-1.5 rounded-full bg-[#9945FF] animate-pulse" />
                <span className="text-[8px] font-black text-[#9945FF] uppercase tracking-widest">Round</span>
              </div>
            )}
          </div>
        )}
        {/* Old round badge — hidden when scoutPhase DONE (above replaces it) */}
        {isRoundEntry && !isEnding && scoutPhase !== 'DONE' && (
          <div className="shrink-0 flex justify-center mb-1.5">
            <div className="flex items-center gap-1.5 px-3 py-0.5 rounded-full"
              style={{ background: 'rgba(153,69,255,0.15)', border: '1px solid rgba(153,69,255,0.45)' }}>
              <div className="w-1.5 h-1.5 rounded-full bg-[#9945FF] animate-pulse" />
              <span className="text-[9px] font-black text-[#9945FF] uppercase tracking-widest">Round Competition</span>
            </div>
          </div>
        )}

        {/* ── 3D ARENA ── */}
        <div className="flex-1 relative flex items-center justify-center min-h-0">
          {/* Logs bg */}
          <div className="absolute top-2 left-2 z-0 opacity-40 pointer-events-none">
            {logs.map((log, i) => (
              <div key={i} className={`text-[9px] mono font-bold mb-1 ${log.includes('overheat') || log.includes('surge') || log.includes('overload') || log.includes('Ambush') || log.includes('Critical') ? 'text-[#9945FF]' : 'text-[#14F195]'}`}>
                {'>'} {log}
              </div>
            ))}
          </div>

          {/* Three.js Canvas — sized to match the risk circle */}
          <div className="absolute w-56 h-56 md:w-64 md:h-64 rounded-full overflow-hidden z-[5]">
            <CanvasErrorBoundary>
            <Canvas
              camera={{ position: [0, 0, 3.8], fov: 62 }}
              gl={{ antialias: false, powerPreference: 'high-performance', alpha: false }}
              dpr={[1, 1.5]}
            >
              <ambientLight intensity={0.8} />
              <directionalLight position={[5, 8, 5]} intensity={1.5} />
              <pointLight position={[-6, 4, -4]} intensity={1.5} color="cyan" />
              <pointLight position={[6, 4, -4]} intensity={1.5} color="red" />
              <Suspense fallback={null}>
                {/* Player robot — rotated to face +x (toward enemy) */}
                <RobotModel action={userAction} position={[-0.5, -1.55, 0]} rotation={[0, Math.PI / 2, 0]} scale={0.85} riskLevel={risk} />
                {/* Enemy robot — rotated to face -x (toward player) */}
                <RobotModel action={enemyAction} position={[0.5, -1.55, 0]} rotation={[0, -Math.PI / 2, 0]} scale={0.85} riskLevel={risk} />
              </Suspense>
              <OrbitControls enableZoom={false} enablePan={false} minPolarAngle={Math.PI / 2.5} maxPolarAngle={Math.PI / 1.8} />
            </Canvas>
            </CanvasErrorBoundary>
          </div>

          {/* Risk tag */}
          <div className="relative z-20 w-56 h-56 md:w-64 md:h-64 flex items-center justify-center pointer-events-none">
            <div className="absolute inset-0 border-[3px] border-dashed rounded-full animate-[spin_30s_linear_infinite] transition-colors duration-300"
                 style={{ borderColor: risk > 80 ? 'rgba(153,69,255,0.6)' : risk > 50 ? 'rgba(249,115,22,0.6)' : 'rgba(153,69,255,0.4)' }} />
            <div className="absolute top-0 right-0 bg-black/80 backdrop-blur-sm px-2 py-1 border tech-border border-white/10 min-w-[68px]">
              <p className="text-[8px] font-bold text-white uppercase">Risk</p>
              <div className="flex items-baseline gap-0.5">
                <span className={`mono text-xl font-black ${risk > 85 ? 'text-[#9945FF] animate-pulse' : risk > 60 ? 'text-orange-400' : 'text-white'}`}>{Math.floor(risk)}</span>
                <span className="text-[10px] text-white">%</span>
              </div>
              <div className="w-full h-0.5 bg-white/10 overflow-hidden mt-1">
                <div className="h-full transition-all duration-500"
                     style={{ width: `${Math.min(100, risk)}%`, background: riskBarBg, boxShadow: `0 0 6px ${risk > 75 ? '#9945FF' : risk > 45 ? '#9945FF' : '#14F195'}` }} />
              </div>
              <p className={`text-[7px] font-black uppercase tracking-widest mt-0.5 ${risk > 70 ? 'text-[#9945FF] animate-pulse' : risk > 40 ? 'text-orange-400' : 'text-[#14F195]'}`}>
                {risk > 70 ? 'DANGER' : risk > 40 ? 'CAUTION' : 'LOW RISK'}
              </p>
            </div>
            <div className="absolute bottom-0 left-0 bg-black/80 backdrop-blur-sm px-2 py-1 border tech-border border-white/10">
              <span className={`text-[10px] font-bold uppercase ${diffConfig.color}`}>{difficulty}</span>
            </div>
          </div>

          {/* AMBUSH OVERLAY on arena */}
          {ambushed && !isEnding && (
            <div className="absolute inset-0 z-[55] flex items-center justify-center" style={{ animation: 'ambush-in 0.2s ease-out' }}>
              <div className="absolute inset-0 bg-red-950/70 backdrop-blur-[2px]" />
              <div className="relative flex flex-col items-center gap-1">
                <span className="text-4xl font-black text-[#9945FF] uppercase animate-pulse" style={{ textShadow: '0 0 30px #9945FF' }}>AMBUSH!</span>
                <span className="text-xs font-bold text-[#9945FF]/70">Controls locked</span>
              </div>
            </div>
          )}


          {/* Grace period countdown */}
          {graceActive && !isEnding && (
            <div className="absolute inset-0 z-[50] flex items-center justify-center pointer-events-none">
              <div className="flex flex-col items-center gap-2">
                <span key={graceCount}
                  className={`text-9xl font-black leading-none drop-shadow-[0_0_40px_'#ffffff'] animate-in zoom-in-75 duration-200 ${graceCount === 0 ? 'text-[#14F195]' : 'text-white'}`}>
                  {graceCount === 0 ? 'GO!' : graceCount}
                </span>
                {graceCount > 0 && (
                  <span className="text-[10px] font-bold text-white animate-pulse">Get ready</span>
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
              <p className="text-[8px] text-white font-bold mb-0.5">Mult</p>
              <div className="flex items-center gap-2">
                <p className={`mono text-2xl font-black ${
                  hotStreak ? 'hot-streak-text text-orange-400' :
                  multiplier > 3 ? 'text-[#9945FF] chromatic-aberration' : 'text-white'
                }`}>{multiplier.toFixed(2)}x</p>
                {hotStreak && <span className="text-[8px] font-bold text-orange-500 animate-pulse">HOT</span>}
                {activeBoosts.includes('score_mult') && (
                  <span className="px-1 py-0.5 bg-yellow-500/10 border border-yellow-500/30 text-[8px] font-bold text-yellow-500 uppercase">BOOST</span>
                )}
              </div>
            </div>
            <div className="text-center">
              {attackCount >= 4 && (
                <div className="px-2 py-0.5 bg-red-950/80 border border-[#9945FF]/40 mb-1">
                  <span className="text-[8px] font-bold text-[#9945FF]">Aggression {attackCount}/5</span>
                </div>
              )}
            </div>
            <div className="text-right">
              <p className="text-[8px] text-white font-bold mb-0.5">Score</p>
              <p className="mono text-xl font-black text-white">{points.toLocaleString()}</p>
            </div>
          </div>

          {skillCheck && !isEnding ? (
            /* ── SKILL CHECK PANEL ─────────────────────────────────────────── */
            <div className="sc-panel space-y-2">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#9945FF]">{SC_META[skillCheck.type].label}</p>
                  <p className="text-[8px] text-white font-bold mt-0.5">{SC_META[skillCheck.type].sub}</p>
                </div>
                {skillCheckResult && (
                  <div className={`sc-result-pop px-3 py-1 border font-black text-xs uppercase ${
                    skillCheckResult === 'SUCCESS'
                      ? 'border-[#14F195]/60 text-[#14F195] bg-[#14F195]/10'
                      : 'border-[#9945FF]/60 text-[#9945FF] bg-[#9945FF]/10'
                  }`}>
                    {skillCheckResult}
                  </div>
                )}
              </div>

              {/* Timer drain bar — only during INPUT phase */}
              {!skillCheckResult && skillCheck.phase === 'INPUT' && (
                <div className="h-0.5 bg-white/10 overflow-hidden">
                  <div className="h-full bg-[#9945FF]"
                       style={{ animation: `sc-bar-drain ${skillCheck.duration}ms linear forwards` }} />
                </div>
              )}

              {/* TAP_ZONE */}
              {skillCheck.type === 'TAP_ZONE' && !skillCheckResult && (
                <>
                  <div className="relative h-10 bg-white/5 border border-white/10 overflow-hidden">
                    <div className="absolute top-0 bottom-0 bg-[#14F195]/20 border-l border-r border-[#14F195]/50"
                         style={{ left: '35%', width: '20%' }} />
                    <div className="sc-cursor" />
                    <p className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-white pointer-events-none">HIT GREEN ZONE</p>
                  </div>
                  <button
                    onClick={() => {
                      const elapsed = (Date.now() - skillCheck.startTime) % 1800;
                      const t = elapsed / 1800;
                      const pos = t <= 0.5 ? 4 + 76 * t * 2 : 80 - 76 * (t - 0.5) * 2;
                      applySkillCheckResult(pos >= 35 && pos <= 55);
                    }}
                    className="w-full py-3 bg-[#9945FF]/10 border border-[#9945FF]/40 font-black uppercase text-[#9945FF] text-sm active:scale-95 transition-transform"
                  >
                    TAP!
                  </button>
                </>
              )}

              {/* QUICK_TAP */}
              {skillCheck.type === 'QUICK_TAP' && !skillCheckResult && (
                <div className="grid grid-cols-2 gap-2">
                  {[0, 1, 2, 3].map(i => (
                    <button
                      key={i}
                      onClick={() => applySkillCheckResult(i === skillCheck.data.targetIdx)}
                      className={`py-3 border font-black uppercase text-sm active:scale-95 transition-all ${
                        i === skillCheck.data.targetIdx
                          ? 'sc-target-btn border-[#9945FF] bg-[#9945FF]/20 text-[#9945FF]'
                          : 'border-white/10 bg-white/5 text-white'
                      }`}
                    >
                      {i === skillCheck.data.targetIdx ? 'TAP!' : `NODE ${String.fromCharCode(65 + i)}`}
                    </button>
                  ))}
                </div>
              )}

              {/* CODE_BREACH */}
              {skillCheck.type === 'CODE_BREACH' && (
                <>
                  <p className={`text-[8px] font-bold text-center ${
                    skillCheck.phase === 'SHOW' ? 'text-[#FFB800]/70 animate-pulse' : 'text-white'
                  }`}>
                    {skillCheck.phase === 'SHOW' ? 'MEMORISE THE HIGHLIGHTED CODE' : 'SELECT THE CODE YOU SAW'}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {(skillCheck.data.codes ?? []).map((code, i) => (
                      <button
                        key={i}
                        onClick={() => skillCheck.phase === 'INPUT' && !skillCheckResult && applySkillCheckResult(i === skillCheck.data.targetIdx)}
                        disabled={skillCheck.phase === 'SHOW' || !!skillCheckResult}
                        className={`py-3 border mono font-bold text-sm active:scale-95 transition-all disabled:cursor-default ${
                          skillCheck.phase === 'SHOW' && i === skillCheck.data.targetIdx
                            ? 'border-[#FFB800] bg-[#FFB800]/20 text-[#FFB800]'
                            : skillCheck.phase === 'INPUT' && !skillCheckResult
                            ? 'border-white/20 bg-white/5 text-white hover:border-white/40'
                            : 'border-white/10 bg-white/5 text-white'
                        }`}
                      >
                        {code}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* PATTERN_DODGE */}
              {skillCheck.type === 'PATTERN_DODGE' && (
                <>
                  <p className={`text-[8px] font-bold text-center ${
                    skillCheck.phase === 'SHOW' ? 'text-[#14F195]/70 animate-pulse' : 'text-white'
                  }`}>
                    {skillCheck.phase === 'SHOW' ? 'MEMORISE THE SAFE NODE' : skillCheckResult ? '' : 'SELECT THE SAFE NODE'}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {[0, 1, 2, 3].map(i => {
                      const isSafe = i === skillCheck.data.safeIdx;
                      return (
                        <button
                          key={i}
                          onClick={() => skillCheck.phase === 'INPUT' && !skillCheckResult && applySkillCheckResult(isSafe)}
                          disabled={skillCheck.phase === 'SHOW' || !!skillCheckResult}
                          className={`py-3 border font-black uppercase text-sm active:scale-95 transition-all disabled:cursor-default ${
                            skillCheck.phase === 'SHOW' && isSafe
                              ? 'border-[#14F195] bg-[#14F195]/20 text-[#14F195]'
                              : skillCheck.phase === 'INPUT' && !skillCheckResult
                              ? 'border-white/20 bg-white/5 text-white hover:border-white/40'
                              : 'border-white/10 bg-white/5 text-white'
                          }`}
                        >
                          {`NODE ${String.fromCharCode(65 + i)}`}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {skillCheckResult && (
                <p className="text-[8px] text-white text-center font-bold animate-pulse">Resuming...</p>
              )}
            </div>
          ) : !isEnding && (
            /* ── NORMAL CONTROLS ───────────────────────────────────────────── */
            <div className="grid grid-cols-2 gap-2">
              {/* ATTACK button */}
              <button onClick={handleAttack} disabled={!!isEnding || graceActive || ambushed}
                className={`col-span-1 bg-black/90 border p-3 tech-border active:translate-y-0.5 transition-all disabled:opacity-40 group ${
                  ambushed ? 'border-red-900/30 opacity-30' : 'border-[#8833ee]/50'
                }`}>
                <div className="flex flex-col items-center group-active:scale-95 transition-transform">
                  <span className="text-base font-bold uppercase text-[#9945FF]">ATTACK</span>
                  <span className="text-[8px] font-bold text-[#9945FF]/40 uppercase">
                    {attackCount >= 4 ? `Rage ${attackCount}/5` : 'RISK ++'}
                  </span>
                </div>
              </button>

              {/* DEFEND button */}
              <div className="col-span-1 relative">
                {defendLocked && (() => {
                  const r = 46;
                  const circ = 2 * Math.PI * r;
                  const offset = circ * (1 - defendLockTimer / 3);
                  return (
                    <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r={r} fill="none" stroke="#f97316" strokeWidth="3.5"
                        strokeDasharray={circ} strokeDashoffset={offset}
                        strokeLinecap="round" transform="rotate(-90 50 50)"
                        style={{ transition: 'stroke-dashoffset 1s linear' }} />
                    </svg>
                  );
                })()}
                <button onClick={handleDefend} disabled={!!isEnding || graceActive || defendLocked || ambushed}
                  className={`w-full bg-black/90 border p-3 tech-border active:translate-y-0.5 transition-all disabled:opacity-40 group ${
                    ambushed ? 'border-cyan-900/30 opacity-30' :
                    defendLocked ? 'border-orange-500/60 bg-orange-950/20' : 'border-[#00FBFF]/50'
                  }`}>
                  <div className="flex flex-col items-center group-active:scale-95 transition-transform">
                    <span className={`text-base font-bold uppercase ${
                      defendLocked ? 'text-orange-400 animate-pulse' : 'text-[#00FBFF]'
                    }`}>
                      {defendLocked ? `Cooldown ${defendLockTimer}s` : 'DEFEND'}
                    </span>
                    <span className={`text-[8px] font-bold uppercase ${
                      defendLocked ? 'text-orange-500/60' : 'text-[#00FBFF]/40'
                    }`}>
                      {defendLocked ? 'Shield overload' : consecutiveDefends >= 1 ? 'CHAIN RISK' : 'RISK --'}
                    </span>
                  </div>
                </button>
              </div>

              {/* First-raid extract hint */}
              {showExtractHint && (
                <div className="col-span-2 flex items-center gap-2 px-3 py-2 rounded-lg animate-in fade-in slide-in-from-bottom-2 duration-300"
                  style={{ background: 'rgba(153,69,255,0.15)', border: '1px solid rgba(153,69,255,0.40)' }}>
                  <span className="text-lg animate-bounce">👇</span>
                  <p className="text-[11px] font-bold text-white">Press <span className="text-[#9945FF]">LOCK IN SCORE</span> when you're ready to extract and secure your SOL!</p>
                </div>
              )}

              {/* LOCK IN SCORE button */}
              <button onClick={handleCashOut} disabled={!!isEnding || !hasInteracted || graceActive || ambushed}
                className={`col-span-2 p-4 tech-border transition-all duration-300 relative overflow-hidden disabled:opacity-80 ${
                  ambushed
                    ? 'bg-red-950/40 text-[#9945FF]/40 border-red-900/20 cursor-not-allowed'
                    : !hasInteracted || graceActive
                    ? 'bg-[#1a1a1a] text-white border-white/5 cursor-not-allowed grayscale'
                    : goldenWindow
                    ? 'bg-yellow-500 text-black active:translate-y-1 golden-glow'
                    : `bg-[#9945FF] text-white active:translate-y-1 ${multiplier > 3 ? 'shadow-[0_0_35px_rgba(153,69,255,0.6)]' : multiplier > 2 ? 'shadow-[0_0_22px_rgba(153,69,255,0.4)]' : 'shadow-[0_0_12px_rgba(153,69,255,0.2)]'}`
                }`}>
                <div className="flex flex-col items-center">
                  <span className="text-2xl font-bold uppercase leading-none">
                    {ambushed
                      ? 'Ambush! Locked'
                      : graceActive ? 'Get ready...'
                      : !hasInteracted ? 'Act to unlock'
                      : goldenWindow ? 'GOLDEN LOCK! +5%'
                      : 'LOCK IN SCORE'}
                  </span>
                  {hasInteracted && !graceActive && !ambushed && (
                    <span className="mono text-sm font-black mt-1 text-white">
                      {points.toLocaleString()} pts
                    </span>
                  )}
                  <span className="text-[9px] font-bold mt-0.5 opacity-60">
                    {ambushed ? 'Wait for clear'
                      : graceActive ? 'Arming...'
                      : !hasInteracted ? 'Idle'
                      : goldenWindow ? `${goldenCountdown}s remaining`
                      : 'Submit your score'}
                  </span>
                </div>
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default RaidScreen;
