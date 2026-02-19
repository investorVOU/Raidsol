import React, { useState, useEffect, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { useGLTF, Environment, Float, Sparkles } from '@react-three/drei';
import * as THREE from 'three';

// Reusing the reliable Robot model but framing it differently
const MODEL_URL = 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/models/gltf/RobotExpressive/RobotExpressive.glb';

const HeadModel = () => {
  const { scene } = useGLTF(MODEL_URL);
  
  // Clone and strip down to just the head/upper body feel
  const clonedScene = React.useMemo(() => {
    const s = scene.clone();
    s.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const m = child as THREE.Mesh;
        m.material = (m.material as THREE.Material).clone();
        // Make it dark and metallic
        (m.material as THREE.MeshStandardMaterial).color = new THREE.Color('#1a1a1a');
        (m.material as THREE.MeshStandardMaterial).emissive = new THREE.Color('#ff0000');
        (m.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.2;
        (m.material as THREE.MeshStandardMaterial).roughness = 0.2;
        (m.material as THREE.MeshStandardMaterial).metalness = 0.9;
      }
    });
    return s;
  }, [scene]);

  return (
    <group rotation={[0, 0, 0]} position={[0, -2, 3]}>
       <primitive object={clonedScene} />
    </group>
  );
};

interface IntroOverlayProps {
  onComplete: () => void;
}

const IntroOverlay: React.FC<IntroOverlayProps> = ({ onComplete }) => {
  const [step, setStep] = useState(0);
  const [showControls, setShowControls] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  
  // Encrypted Message State
  const [decryptedText, setDecryptedText] = useState("");
  const [decryptionStarted, setDecryptionStarted] = useState(false);
  
  // The system message
  const targetMessage = ">> SYSTEM_NOTE: ALL_LOST_SOL_&_MARKET_FEES_ARE_ROUTED_TO_THE_[VAULT]. FUNDS_ARE_USED_FOR_CONTESTS_//_TOURNAMENTS_//_PLATFORM_REDISTRIBUTION. >> TRANSPARENCY_MODE: USERS_CAN_CHECK_THE_VAULT_THEMSELVES.";

  // Sequence Timing
  useEffect(() => {
    const sequence = [
      { t: 1000, s: 1 }, // INITIALIZING
      { t: 2500, s: 2 }, // WIN REAL SOL
      { t: 4000, s: 3 }, // JUST A GAME
      { t: 5500, s: 4 }, // NOT REFUNDABLE
      { t: 7000, s: 5 }, // LOSE EVERYTHING
      { t: 8500, s: 6 }, // FINAL MESSAGE
    ];

    let timeouts: ReturnType<typeof setTimeout>[] = [];

    sequence.forEach(({ t, s }) => {
      const tm = setTimeout(() => setStep(s), t);
      timeouts.push(tm);
    });

    const btnTm = setTimeout(() => setShowControls(true), 9000);
    timeouts.push(btnTm);

    return () => timeouts.forEach(clearTimeout);
  }, []);

  // Trigger Decryption Start
  useEffect(() => {
    if (step >= 4 && !decryptionStarted) {
        setDecryptionStarted(true);
    }
  }, [step, decryptionStarted]);

  // "Cooler" Scatter Decryption Effect
  useEffect(() => {
    if (decryptionStarted) {
      const length = targetMessage.length;
      // Initialize with random hex-like chars
      const randomChar = () => "01XYZ"[Math.floor(Math.random() * 5)];
      
      // Mask tracks which characters are resolved
      let resolvedMask = new Array(length).fill(false);
      
      const interval = setInterval(() => {
        let allResolved = true;
        
        const nextText = targetMessage.split('').map((char, index) => {
          if (resolvedMask[index]) return char;
          
          allResolved = false;
          // Chance to resolve this specific character this frame
          // Using a curve so it starts slow and accelerates or just pure random
          if (Math.random() > 0.95) { 
            resolvedMask[index] = true;
            return char;
          }
          return randomChar();
        }).join('');
        
        setDecryptedText(nextText);

        if (allResolved) {
          clearInterval(interval);
        }
      }, 50); // Fast ticks
      
      return () => clearInterval(interval);
    }
  }, [decryptionStarted]);

  return (
    <div className="fixed inset-0 z-[999] bg-black flex flex-col items-center justify-center overflow-hidden">
      
      {/* 3D Background - The "Face" of the Protocol */}
      <div className="absolute inset-0 z-0 opacity-60">
        <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
          <ambientLight intensity={0.1} />
          {/* Ominous Red Side Light */}
          <spotLight position={[5, 5, 5]} angle={0.5} penumbra={1} intensity={20} color="red" />
          <spotLight position={[-5, -5, 5]} angle={0.5} penumbra={1} intensity={10} color="#500000" />
          
          <Suspense fallback={null}>
            <Float speed={2} rotationIntensity={0.2} floatIntensity={0.5}>
              <HeadModel />
            </Float>
            <Sparkles count={50} scale={5} size={2} speed={0.4} opacity={0.5} color="red" />
            <Environment preset="night" />
          </Suspense>
        </Canvas>
      </div>

      {/* CRT Scanline Effect */}
      <div className="absolute inset-0 z-10 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]" />
      <div className="absolute inset-0 z-10 pointer-events-none animate-[scanline_8s_linear_infinite] bg-gradient-to-b from-transparent via-red-500/5 to-transparent h-[10%]" />

      {/* Text Sequence */}
      <div className="relative z-20 w-full max-w-lg p-6 flex flex-col items-center gap-4 text-center">
        
        {step >= 1 && (
          <div className="flex items-center gap-3 text-red-500/60 font-black tracking-widest text-xs sm:text-sm animate-in fade-in slide-in-from-bottom-2 duration-500">
            <span className="animate-pulse">[ █▓▒▒░░ ]</span>
            <span>INITIALIZING RAID PROTOCOL</span>
          </div>
        )}

        {step >= 2 && (
          <div className="flex items-center gap-3 text-[#14F195] font-black tracking-widest text-xs sm:text-sm animate-in fade-in slide-in-from-bottom-2 duration-500">
            <span className="animate-pulse">[ $$$ ]</span>
            <span>YOU CAN WIN REAL SOL</span>
          </div>
        )}

        {step >= 3 && (
            <div className="flex items-center gap-3 text-cyan-400 font-black tracking-widest text-xs sm:text-sm animate-in fade-in slide-in-from-bottom-2 duration-500">
              <span>( IT IS JUST A GAME )</span>
            </div>
        )}

        {step >= 4 && (
          <div className="flex items-center gap-3 text-red-500 font-black tracking-widest text-xs sm:text-sm animate-in fade-in slide-in-from-bottom-2 duration-500">
            <span className="animate-pulse">[ ░░ ]</span>
            <span>SOL IS NOT REFUNDABLE</span>
          </div>
        )}

        {step >= 5 && (
          <div className="flex items-center gap-3 text-red-500 font-black tracking-widest text-xs sm:text-sm animate-in fade-in slide-in-from-bottom-2 duration-500">
            <span className="animate-pulse text-white">[ ✓ ]</span>
            <span className="text-white border-b border-red-500">YOU MAY LOSE EVERYTHING</span>
          </div>
        )}

        {step >= 6 && (
          <div className="mt-8 mb-4 animate-in zoom-in-50 duration-300">
            <h1 className="text-4xl sm:text-6xl font-black italic uppercase tracking-tighter text-white glitch-text leading-none">
              ONLY ENTER <br/>
              <span className="text-red-600">WHAT YOU CAN LOSE</span>
            </h1>
          </div>
        )}

        {/* Cooler Encrypted Vault Message */}
        {decryptionStarted && (
          <div className="mt-2 w-full px-4 animate-in fade-in duration-500">
            <div className="bg-black/80 border border-[#14F195]/30 p-3 tech-border relative overflow-hidden group">
               <div className="absolute top-0 left-0 w-1 h-full bg-[#14F195]/50" />
               <p className="font-mono text-[9px] sm:text-[10px] text-[#14F195] tracking-widest leading-relaxed break-words opacity-90">
                 <span className="text-[#14F195]/40 mr-2">{'>'}</span>
                 {decryptedText}
                 <span className="animate-pulse ml-1 inline-block w-1.5 h-3 bg-[#14F195]" />
               </p>
            </div>
          </div>
        )}

        {showControls && (
          <div className="flex flex-col items-center gap-6 w-full animate-in fade-in zoom-in-90 duration-500 mt-4">
             
             {/* Age Checkbox */}
             <label className="flex items-center gap-4 cursor-pointer group hover:opacity-100 opacity-80 transition-opacity">
              <input 
                type="checkbox" 
                className="hidden" 
                checked={ageConfirmed}
                onChange={() => setAgeConfirmed(!ageConfirmed)}
              />
              <div className={`w-6 h-6 border-2 tech-border transition-colors flex items-center justify-center shrink-0 ${ageConfirmed ? 'bg-red-500 border-red-500' : 'border-white/20 group-hover:border-red-500/50'}`}>
                {ageConfirmed && <div className="w-2.5 h-2.5 bg-white" />}
              </div>
              <span className={`text-xs sm:text-sm font-black uppercase tracking-widest italic transition-colors ${ageConfirmed ? 'text-white' : 'text-white/40'}`}>
                I AM 18 YEARS OF AGE OR OLDER
              </span>
            </label>

            <button
                onClick={onComplete}
                disabled={!ageConfirmed}
                className={`group relative px-12 py-4 border font-black uppercase tracking-[0.2em] transition-all duration-300 tech-border ${
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
      </div>
      
      {/* Footer Version */}
      <div className="absolute bottom-6 text-[10px] text-red-900/40 font-black uppercase tracking-[0.5em] z-20">
        PROTOCOL_V5.0.2 // SECURE_CONNECTION
      </div>

    </div>
  );
};

export default IntroOverlay;
