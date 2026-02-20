import { useRef } from 'react';

/**
 * useGameSounds — Web Audio API synthesized SFX + Vibration haptics
 * No external audio files needed. All sounds are generated procedurally.
 */
export const useGameSounds = () => {
  const ctxRef = useRef<AudioContext | null>(null);

  const getCtx = (): AudioContext => {
    if (!ctxRef.current || ctxRef.current.state === 'closed') {
      ctxRef.current = new AudioContext();
    }
    if (ctxRef.current.state === 'suspended') {
      ctxRef.current.resume();
    }
    return ctxRef.current;
  };

  // ── Attack: low thump + noise punch ──────────────────────────────────────
  const playAttack = () => {
    try {
      const ctx = getCtx();
      const now = ctx.currentTime;

      // Sub thump
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.frequency.setValueAtTime(110, now);
      osc.frequency.exponentialRampToValueAtTime(35, now + 0.12);
      oscGain.gain.setValueAtTime(0.8, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.connect(oscGain);
      oscGain.connect(ctx.destination);
      osc.start(now); osc.stop(now + 0.18);

      // Noise burst
      const bufLen = Math.floor(ctx.sampleRate * 0.07);
      const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < bufLen; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / bufLen) ** 2;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.5, now);
      src.connect(noiseGain); noiseGain.connect(ctx.destination);
      src.start(now + 0.01);
    } catch (_) { /* AudioContext blocked by policy */ }
  };

  // ── Defend: metallic shield clank ────────────────────────────────────────
  const playDefend = () => {
    try {
      const ctx = getCtx();
      const now = ctx.currentTime;
      [440, 660, 880].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.018);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.7, now + i * 0.018 + 0.18);
        g.gain.setValueAtTime(0.12, now + i * 0.018);
        g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.018 + 0.22);
        osc.connect(g); g.connect(ctx.destination);
        osc.start(now + i * 0.018); osc.stop(now + i * 0.018 + 0.25);
      });
    } catch (_) {}
  };

  // ── Cash Out: ascending victory arpeggio ─────────────────────────────────
  const playCashOut = () => {
    try {
      const ctx = getCtx();
      const notes = [523, 659, 784, 1047, 1568]; // C5 E5 G5 C6 G6
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.09);
        g.gain.setValueAtTime(0.18, ctx.currentTime + i * 0.09);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.09 + 0.28);
        osc.connect(g); g.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.09);
        osc.stop(ctx.currentTime + i * 0.09 + 0.32);
      });
    } catch (_) {}
  };

  // ── Bust: descending explosion ───────────────────────────────────────────
  const playBust = () => {
    try {
      const ctx = getCtx();
      const now = ctx.currentTime;

      // Explosion noise
      const bufLen = Math.floor(ctx.sampleRate * 0.55);
      const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < bufLen; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufLen * 0.18));
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.9, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      src.connect(noiseGain); noiseGain.connect(ctx.destination);
      src.start(now);

      // Descending rumble
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.frequency.setValueAtTime(240, now);
      osc.frequency.exponentialRampToValueAtTime(28, now + 0.7);
      oscGain.gain.setValueAtTime(0.55, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
      osc.connect(oscGain); oscGain.connect(ctx.destination);
      osc.start(now); osc.stop(now + 0.72);
    } catch (_) {}
  };

  // ── Countdown tick ────────────────────────────────────────────────────────
  const playCountdownTick = (isGo = false) => {
    try {
      const ctx = getCtx();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = isGo ? 'square' : 'sine';
      osc.frequency.setValueAtTime(isGo ? 1400 : 880, now);
      if (isGo) osc.frequency.setValueAtTime(1760, now + 0.06);
      g.gain.setValueAtTime(isGo ? 0.35 : 0.25, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + (isGo ? 0.2 : 0.1));
      osc.connect(g); g.connect(ctx.destination);
      osc.start(now); osc.stop(now + (isGo ? 0.25 : 0.12));
    } catch (_) {}
  };

  // ── Risk warning pulse ────────────────────────────────────────────────────
  const playRiskWarning = () => {
    try {
      const ctx = getCtx();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(95, now);
      osc.frequency.setValueAtTime(115, now + 0.06);
      osc.frequency.setValueAtTime(95, now + 0.12);
      g.gain.setValueAtTime(0.12, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(g); g.connect(ctx.destination);
      osc.start(now); osc.stop(now + 0.25);
    } catch (_) {}
  };

  // ── Critical hit ──────────────────────────────────────────────────────────
  const playCritical = () => {
    try {
      const ctx = getCtx();
      const now = ctx.currentTime;
      // Two stacked notes for a sharp impact
      [220, 440].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq * 2, now + i * 0.01);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.5, now + i * 0.01 + 0.12);
        g.gain.setValueAtTime(0.35, now + i * 0.01);
        g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.01 + 0.15);
        osc.connect(g); g.connect(ctx.destination);
        osc.start(now + i * 0.01); osc.stop(now + i * 0.01 + 0.18);
      });
    } catch (_) {}
  };

  // ── PvP winner fanfare ────────────────────────────────────────────────────
  const playWinnerFanfare = () => {
    try {
      const ctx = getCtx();
      const seq = [523, 659, 784, 659, 1047, 880, 1047, 1568];
      seq.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = i > 4 ? 'square' : 'sawtooth';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.11);
        g.gain.setValueAtTime(0.22, ctx.currentTime + i * 0.11);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.11 + 0.22);
        osc.connect(g); g.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.11);
        osc.stop(ctx.currentTime + i * 0.11 + 0.25);
      });
    } catch (_) {}
  };

  // ── Haptic vibration ─────────────────────────────────────────────────────
  const vibrate = (pattern: number | number[]) => {
    try {
      if ('vibrate' in navigator) navigator.vibrate(pattern);
    } catch (_) {}
  };

  return {
    playAttack,
    playDefend,
    playCashOut,
    playBust,
    playCountdownTick,
    playRiskWarning,
    playCritical,
    playWinnerFanfare,
    vibrate,
  };
};
