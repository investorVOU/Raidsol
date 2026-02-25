
import React, { useState, useEffect } from 'react';
import { useDailyBriefing } from '../hooks/useDailyBriefing';

const DECODER_COST = 75; // SR cost to unlock the full cipher key

interface BriefingScreenProps {
  walletAddress: string | null;
  srPoints: number;
  onCheckBriefing: (answer: string, date: string) => Promise<{ correct: boolean; reward_sr?: number; isFirst?: boolean }>;
  onSpendSR: (amount: number) => void;
  onBack: () => void;
}

// ── The same 30-puzzle list, client-side version (cipher + hint only — no answer) ──
const PUZZLES_CLIENT: { cipher: string; hint: string }[] = [
  { cipher: 'VRODQD',            hint: 'Fastest blockchain' },
  { cipher: 'EORFNFKDLQ',        hint: 'Chain of blocks' },
  { cipher: 'VWDNH',             hint: 'Put skin in the game' },
  { cipher: 'ZDOOHW',            hint: 'Holds your keys' },
  { cipher: 'YDOLGDWRU',         hint: 'Secures the network' },
  { cipher: 'VPDUW FRQWUDFW',    hint: 'Self-executing code' },
  { cipher: 'GHFHQWUDOLVHG',     hint: 'No single point of control' },
  { cipher: 'OLTXLGLWB',         hint: 'Ease of buying/selling' },
  { cipher: 'SURWRFRO',          hint: 'Set of rules' },
  { cipher: 'VLJQDWXUH',         hint: 'Proves you signed it' },
  { cipher: 'PLQWLQJ',           hint: 'Creating new tokens' },
  { cipher: 'EXUQLQJ',           hint: 'Destroying tokens' },
  { cipher: 'ODWHQFB',           hint: 'Network delay' },
  { cipher: 'FRQVHQVXV',         hint: 'Agreement mechanism' },
  { cipher: 'WRNHQ',             hint: 'Digital asset unit' },
  { cipher: 'DLUGUURS',          hint: 'Free token distribution' },
  { cipher: 'ZKLWHOLVW',         hint: 'Approved addresses only' },
  { cipher: 'VOLFH',             hint: 'A piece of a block' },
  { cipher: 'IRUNH',             hint: 'Split in the chain' },
  { cipher: 'UXJSXOO',           hint: 'Exit scam' },
  { cipher: 'GHILODWLRQ',        hint: 'Token value goes down' },
  { cipher: 'LQIODWLRQ',         hint: 'Token supply grows' },
  { cipher: 'EULGGH',            hint: 'Cross-chain connector' },
  { cipher: 'RSWLPLVWLF',        hint: 'Bullish on the future' },
  { cipher: 'SHVVLPLVWLF',       hint: 'Bearish on the future' },
  { cipher: 'OLTXLGDWLRQ',       hint: 'Forced position close' },
  { cipher: 'VOLS',              hint: 'Price moved between click and fill' },
  { cipher: 'JDV',               hint: 'Transaction fee unit' },
  { cipher: 'QRGH',              hint: 'Network participant' },
  { cipher: 'HQFUBSW',           hint: 'Scramble the data' },
];

function getTodayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function getTodayPuzzle() {
  const dayIndex = Math.floor(Date.now() / 86_400_000);
  return PUZZLES_CLIENT[dayIndex % PUZZLES_CLIENT.length];
}

function formatCountdown(): string {
  const now = new Date();
  const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const diff = tomorrow.getTime() - now.getTime();
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1_000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const BriefingScreen: React.FC<BriefingScreenProps> = ({
  walletAddress,
  srPoints,
  onCheckBriefing,
  onSpendSR,
  onBack,
}) => {
  const todayDate = getTodayUTC();
  const puzzle = getTodayPuzzle();
  const { winner, alreadyClaimed, loading } = useDailyBriefing(walletAddress);

  const [answer, setAnswer] = useState('');
  const [showHint, setShowHint] = useState(false);
  const [decoderUnlocked, setDecoderUnlocked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ correct: boolean; reward_sr?: number; isFirst?: boolean } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [countdown, setCountdown] = useState(formatCountdown());

  const canAffordDecoder = srPoints >= DECODER_COST;

  const handleUnlockDecoder = () => {
    if (!canAffordDecoder || decoderUnlocked) return;
    onSpendSR(DECODER_COST);
    setDecoderUnlocked(true);
  };

  // Live countdown to next briefing
  useEffect(() => {
    const interval = setInterval(() => setCountdown(formatCountdown()), 1_000);
    return () => clearInterval(interval);
  }, []);

  const shortWallet = (w: string) => `${w.slice(0, 4)}...${w.slice(-4)}`;

  const handleSubmit = async () => {
    if (!walletAddress) return;
    if (!answer.trim()) return;
    setSubmitting(true);
    setErrorMsg('');
    try {
      const res = await onCheckBriefing(answer.trim(), todayDate);
      setResult(res);
      if (!res.correct) {
        setErrorMsg('Wrong answer. Try again.');
      }
    } catch (err: any) {
      const msg = err?.message ?? 'Something went wrong';
      if (msg.includes('ALREADY_CLAIMED') || msg.includes('Already claimed')) {
        setErrorMsg('You already claimed today\'s briefing.');
      } else {
        setErrorMsg(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const claimed = alreadyClaimed || (result?.correct === true);

  return (
    <div className="h-full flex flex-col overflow-y-auto scrollbar-hide pb-28 md:pb-8 bg-[#000]">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 pt-5 pb-4 border-b border-white/6">
        <button onClick={onBack} className="text-white/40 hover:text-white transition-colors p-1">
          <i className="fa-solid fa-arrow-left text-sm" />
        </button>
        <div className="text-center">
          <h1
            className="text-lg font-black text-white uppercase tracking-widest"
            style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '3px' }}
          >
            The Briefing
          </h1>
          <p className="text-[10px] text-white/30 font-bold">Daily Cipher · {todayDate}</p>
        </div>
        <div className="text-right">
          <p className="text-[9px] text-white/30 font-bold uppercase tracking-widest">Next in</p>
          <p className="text-xs font-black text-[#FFB800] font-mono">{countdown}</p>
        </div>
      </div>

      <div className="flex-1 px-4 py-6 max-w-md mx-auto w-full space-y-5">

        {/* SR Tiers */}
        <div className="flex gap-2">
          <div
            className="flex-1 rounded-xl p-3 text-center"
            style={{ background: 'rgba(255,184,0,0.06)', border: '1px solid rgba(255,184,0,0.20)' }}
          >
            <p className="text-base font-black text-[#FFB800]">🥇 +1,000 SR</p>
            <p className="text-[9px] text-white/40 mt-0.5 font-bold uppercase tracking-wide">First solve</p>
          </div>
          <div
            className="flex-1 rounded-xl p-3 text-center"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <p className="text-base font-black text-white">+200 SR</p>
            <p className="text-[9px] text-white/40 mt-0.5 font-bold uppercase tracking-wide">All others</p>
          </div>
        </div>

        {/* Winner banner */}
        {winner && (
          <div
            className="rounded-xl p-3 flex items-center gap-3"
            style={{ background: 'rgba(255,184,0,0.08)', border: '1px solid rgba(255,184,0,0.25)' }}
          >
            <span className="text-xl shrink-0">🥇</span>
            <div>
              <p className="text-xs font-black text-[#FFB800]">First solve: {shortWallet(winner.wallet)}</p>
              <p className="text-[10px] text-white/40">
                {new Date(winner.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} UTC
              </p>
            </div>
          </div>
        )}

        {/* Cipher display */}
        <div
          className="rounded-2xl p-5 space-y-3"
          style={{ background: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.10)' }}
        >
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1.5 h-1.5 bg-[#FF2929] rounded-full animate-pulse" />
            <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Today's cipher</p>
          </div>
          <p
            className="text-3xl font-black text-white tracking-widest text-center py-3 select-all"
            style={{ fontFamily: "'Courier New', monospace", letterSpacing: '5px', lineHeight: 1.3 }}
          >
            {puzzle.cipher}
          </p>
          {/* Hint toggle */}
          <button
            onClick={() => setShowHint(v => !v)}
            className="text-[10px] font-bold text-white/30 hover:text-white/60 transition-colors uppercase tracking-widest flex items-center gap-1.5"
          >
            <i className={`fa-solid fa-chevron-${showHint ? 'up' : 'down'} text-[8px]`} />
            {showHint ? 'Hide hint' : 'Show hint'}
          </button>
          {showHint && (
            <div className="space-y-2 animate-in fade-in duration-200">
              <p className="text-xs text-[#FFB800]/80 font-bold">💡 {puzzle.hint}</p>
              {/* Letter-count slots derived from cipher (spaces preserved) */}
              <div className="flex items-center gap-2 flex-wrap">
                {puzzle.cipher.split(' ').map((word, wi) => (
                  <div key={wi} className="flex items-center gap-1">
                    {wi > 0 && <span className="text-white/20 text-xs mx-1">·</span>}
                    {Array.from(word).map((_, li) => (
                      <div
                        key={li}
                        className="w-4 h-0.5 bg-[#FFB800]/50 rounded-full"
                      />
                    ))}
                    <span className="text-[9px] text-white/25 font-bold ml-0.5">{word.length}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── CIPHER KEY (locked behind SR) ── */}
        {!decoderUnlocked ? (
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: '1px solid rgba(255,255,255,0.08)' }}
          >
            {/* Blurred preview of the table */}
            <div className="relative px-4 py-3 select-none" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <div className="blur-sm pointer-events-none font-mono text-[10px] text-white/40 leading-5 space-y-0.5">
                <p>Plain&nbsp;&nbsp;A B C D E F G H I J K L M</p>
                <p>Cipher D E F G H I J K L M N O P</p>
              </div>
              {/* Lock overlay */}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                <i className="fa-solid fa-lock text-white/30 text-base" />
                <p className="text-[10px] font-black text-white/50 uppercase tracking-widest">Cipher Key</p>
              </div>
            </div>
            {/* Unlock button */}
            <button
              onClick={handleUnlockDecoder}
              disabled={!canAffordDecoder || !walletAddress}
              className="w-full py-2.5 text-xs font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={
                canAffordDecoder && walletAddress
                  ? { background: 'rgba(255,184,0,0.10)', borderTop: '1px solid rgba(255,184,0,0.20)', color: '#FFB800' }
                  : { background: 'rgba(255,255,255,0.03)', borderTop: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.25)' }
              }
            >
              <i className="fa-solid fa-unlock text-[10px]" />
              {!walletAddress
                ? 'Connect wallet'
                : !canAffordDecoder
                ? `Need ${DECODER_COST} SR to unlock`
                : `Unlock full key · ${DECODER_COST} SR`}
            </button>
          </div>
        ) : (
          <div
            className="rounded-xl p-4 space-y-2 animate-in fade-in duration-300"
            style={{ background: 'rgba(255,184,0,0.05)', border: '1px solid rgba(255,184,0,0.20)' }}
          >
            <div className="flex items-center gap-2 mb-1">
              <i className="fa-solid fa-key text-[#FFB800] text-[10px]" />
              <p className="text-[10px] font-black text-[#FFB800] uppercase tracking-widest">Cipher Key — Caesar +3</p>
            </div>
            <div className="font-mono text-[10px] leading-6 overflow-x-auto scrollbar-hide">
              <div className="flex gap-0 min-w-max">
                <span className="text-white/40 w-14 shrink-0">Plain</span>
                {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(c => (
                  <span key={c} className="w-[18px] text-center text-white/60">{c}</span>
                ))}
              </div>
              <div className="flex gap-0 min-w-max">
                <span className="text-[#FFB800]/60 w-14 shrink-0">Cipher</span>
                {'DEFGHIJKLMNOPQRSTUVWXYZABC'.split('').map((c, i) => (
                  <span key={i} className="w-[18px] text-center font-black text-[#FFB800]">{c}</span>
                ))}
              </div>
            </div>
            <p className="text-[9px] text-white/25 pt-1">
              To decode: find the Cipher letter → read the Plain letter above it.
            </p>
          </div>
        )}

        {/* Already claimed state */}
        {claimed ? (
          <div
            className="rounded-xl p-5 text-center space-y-2"
            style={{ background: 'rgba(255,184,0,0.06)', border: '1px solid rgba(255,184,0,0.25)' }}
          >
            <p className="text-2xl">✅</p>
            {result?.correct ? (
              <>
                <p className="text-base font-black text-[#FFB800]">
                  {result.isFirst ? '🥇 First solve!' : 'Correct!'}
                </p>
                <p className="text-sm text-white/70">+{result.reward_sr?.toLocaleString()} SR awarded</p>
                {result.isFirst && <p className="text-xs text-white/40">You were the first to crack today's cipher</p>}
              </>
            ) : (
              <>
                <p className="text-base font-black text-white/60">Already claimed today</p>
                <p className="text-xs text-white/30">Come back tomorrow for a new cipher</p>
              </>
            )}
          </div>
        ) : (
          <>
            {/* Input */}
            {!walletAddress ? (
              <div className="rounded-xl bg-white/3 border border-white/10 p-4 text-center">
                <p className="text-white/40 text-sm font-bold">Connect wallet to claim SR</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative">
                  <input
                    type="text"
                    value={answer}
                    onChange={e => setAnswer(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !submitting && handleSubmit()}
                    placeholder="Decode the cipher..."
                    maxLength={40}
                    disabled={submitting}
                    className="w-full rounded-xl px-4 py-3.5 text-sm font-bold text-white placeholder-white/20 focus:outline-none transition-all"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', fontFamily: "'Inter', sans-serif" }}
                  />
                </div>

                {errorMsg && (
                  <p className="text-xs font-bold text-[#FF2929] animate-in fade-in duration-200">{errorMsg}</p>
                )}

                <button
                  onClick={handleSubmit}
                  disabled={submitting || !answer.trim()}
                  className="w-full py-4 rounded-xl font-black text-base transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={
                    !submitting && answer.trim()
                      ? { background: 'linear-gradient(135deg, #FF2929 0%, #CC0000 100%)', color: '#fff', boxShadow: '0 0 25px rgba(255,41,41,0.25)', fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '2px', fontSize: '18px' }
                      : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.3)', fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '2px', fontSize: '18px' }
                  }
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <i className="fa-solid fa-circle-notch fa-spin text-base" />
                      DECODING...
                    </span>
                  ) : 'DECODE & CLAIM'}
                </button>
              </div>
            )}
          </>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="rounded-xl bg-white/3 border border-white/5 p-4 animate-pulse text-center">
            <p className="text-white/20 text-xs font-bold">Checking claim status...</p>
          </div>
        )}

        {/* Info footer */}
        <div className="pt-2 border-t border-white/5 space-y-1.5">
          <p className="text-[10px] text-white/25 font-bold uppercase tracking-widest">How it works</p>
          <p className="text-[11px] text-white/35 leading-relaxed">
            Each day a new cipher rotates. Decode it and claim SR. First solver earns 1,000 SR, all others earn 200 SR. One claim per wallet per day.
          </p>
        </div>

      </div>
    </div>
  );
};

export default BriefingScreen;
