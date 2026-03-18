import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { VersionedTransaction, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';

const SOL_MINT  = 'So11111111111111111111111111111111111111112';
const USDC_MINT = import.meta.env.VITE_USDC_MINT ?? 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const BAGS_URL  = 'https://bags.fm/J8sMGxWB5kT8SqgmeTa3TfW6mpmucYK8xpMkmPCbBAGS';
const PROXY     = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/jup-proxy`;
const ANON_KEY  = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

const INPUT_TOKENS = {
  SOL:  { mint: SOL_MINT,  decimals: 9, symbol: 'SOL',  label: 'Solana' },
  USDC: { mint: USDC_MINT, decimals: 6, symbol: 'USDC', label: 'USD Coin' },
} as const;
type InputToken = keyof typeof INPUT_TOKENS;

const INTER: React.CSSProperties = { fontFamily: "'Inter', system-ui, sans-serif" };
const SG:    React.CSSProperties = { fontFamily: "'Space Grotesk', sans-serif" };
const BN:    React.CSSProperties = { fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '1.5px' };

interface SwapModalProps {
  isOpen: boolean;
  onClose: () => void;
  outputMint: string;
}

type Step   = 'choose' | 'swap';
type Status = 'idle' | 'quoting' | 'ready' | 'signing' | 'executing' | 'success' | 'error';

interface UltraOrder {
  requestId:    string;
  inAmount:     string;
  outAmount:    string;
  transaction:  string | null;
  errorCode?:   string;
  errorMessage?: string;
  routePlan?:   { swapInfo: { label: string } }[];
  priceImpactPct?: string;
}

const fmt = (n: number, d = 4) =>
  n.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: 0 });

async function proxyCall(action: string, body: Record<string, unknown>) {
  const res = await fetch(PROXY, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': ANON_KEY,
      'Authorization': `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify({ action, ...body }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(txt);
  }
  return res.json();
}

/* ─────────────────── Logos ─────────────────── */

/** SOL — inline SVG gradient circle with 3 bars (no external URL) */
const SolLogo = ({ size = 32 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 100 100"
    style={{ borderRadius: '50%', flexShrink: 0 }}
    xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="sg" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#9945FF" />
        <stop offset="100%" stopColor="#14F195" />
      </linearGradient>
    </defs>
    <circle cx="50" cy="50" r="50" fill="url(#sg)" />
    <path d="M22,64 L66,64 Q71,64 74,60 L79,54 Q81,51 79,48 L35,48 Q30,48 27,52 Z" fill="white" />
    <path d="M22,45 L66,45 Q71,45 74,41 L79,35 Q81,32 79,29 L35,29 Q30,29 27,33 Z" fill="white" />
    <path d="M22,83 L66,83 Q71,83 74,79 L79,73 Q81,70 79,67 L35,67 Q30,67 27,71 Z" fill="white" />
  </svg>
);

/** USDC — plain HTML div (always renders, no SVG text issues) */
const UsdcLogo = ({ size = 32 }: { size?: number }) => (
  <div style={{
    width: size, height: size, borderRadius: '50%',
    background: 'linear-gradient(135deg, #2775CA 0%, #1a5fa8 100%)',
    border: '1.5px solid rgba(255,255,255,0.2)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, fontFamily: 'Arial, sans-serif',
    fontWeight: 900, color: 'white',
    fontSize: Math.round(size * 0.42),
    lineHeight: 1,
    boxSizing: 'border-box' as const,
  }}>
    $
  </div>
);

/** RAID — IPFS image with div fallback */
const RAID_ICON    = 'https://ipfs.io/ipfs/QmNfBzvgSRGc5p3CTqjzmpq9rTYYJfd43zwPDPdoeKtfeE';
const RAID_DECIMALS = 9;
const RaidLogo = ({ size = 32 }: { size?: number }) => (
  <img src={RAID_ICON} alt="RAID" width={size} height={size}
    style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
    onError={e => {
      const el = e.target as HTMLImageElement;
      el.style.display = 'none';
    }}
  />
);

const JupLogo = () => (
  <div style={{
    width: 16, height: 16, borderRadius: 4,
    background: 'linear-gradient(135deg, #C7F284 0%, #00BEF0 100%)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 8, fontWeight: 900, color: '#000', flexShrink: 0,
    fontFamily: 'Arial, sans-serif',
  }}>J</div>
);

function TokenLogo({ token, size = 32 }: { token: InputToken; size?: number }) {
  return token === 'SOL' ? <SolLogo size={size} /> : <UsdcLogo size={size} />;
}

/* ══════════════════════════════════════════════════════════════════ */

const SwapModal: React.FC<SwapModalProps> = ({ isOpen, onClose, outputMint }) => {
  const { publicKey, signTransaction, connected } = useWallet();
  const { connection } = useConnection();

  const [step,       setStep]       = useState<Step>('choose');
  const [inputToken, setInputToken] = useState<InputToken>('SOL');
  const [solBal,     setSolBal]     = useState<number | null>(null);
  const [usdcBal,    setUsdcBal]    = useState<number | null>(null);
  const [amount,     setAmount]     = useState('');
  const [order,      setOrder]      = useState<UltraOrder | null>(null);
  const [status,     setStatus]     = useState<Status>('idle');
  const [txSig,      setTxSig]      = useState<string | null>(null);
  const [errMsg,     setErrMsg]     = useState('');
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Reset on open ── */
  useEffect(() => {
    if (!isOpen) return;
    setStep('choose'); setAmount(''); setOrder(null); setInputToken('SOL');
    setStatus('idle'); setTxSig(null); setErrMsg(''); setSolBal(null); setUsdcBal(null);
  }, [isOpen]);

  /* ── Fetch balances ── */
  useEffect(() => {
    if (!isOpen || !publicKey) return;
    let cancelled = false;
    connection.getBalance(publicKey)
      .then(l => { if (!cancelled) setSolBal(l / LAMPORTS_PER_SOL); })
      .catch(() => {});
    connection.getParsedTokenAccountsByOwner(publicKey, { mint: new PublicKey(USDC_MINT) })
      .then(res => {
        if (cancelled) return;
        const bal = res.value[0]?.account.data.parsed.info.tokenAmount.uiAmount ?? 0;
        setUsdcBal(bal);
      })
      .catch(() => setUsdcBal(0));
    return () => { cancelled = true; };
  }, [isOpen, publicKey, connection]);

  /* ── Quote fetch ── */
  const fetchQuote = useCallback(async (raw: string, token: InputToken) => {
    const num = parseFloat(raw);
    if (!raw || isNaN(num) || num <= 0) { setOrder(null); setStatus('idle'); return; }
    setStatus('quoting'); setOrder(null); setErrMsg('');
    try {
      const { mint, decimals } = INPUT_TOKENS[token];
      const units = Math.round(num * 10 ** decimals);
      const data: UltraOrder = await proxyCall('order', {
        params: { inputMint: mint, outputMint, amount: String(units) },
      });
      if (data.errorCode) throw new Error(data.errorMessage ?? data.errorCode);
      setOrder(data);
      setStatus('ready');
    } catch (e: unknown) {
      setErrMsg(e instanceof Error ? e.message : 'Failed to fetch quote');
      setStatus('error');
    }
  }, [outputMint]);

  useEffect(() => {
    if (step !== 'swap') return;
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => fetchQuote(amount, inputToken), 650);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [amount, inputToken, step, fetchQuote]);

  /* ── Swap ── */
  const handleSwap = async () => {
    if (!publicKey || !signTransaction) return;
    setStatus('signing'); setErrMsg('');
    try {
      const { mint, decimals } = INPUT_TOKENS[inputToken];
      const units = Math.round(parseFloat(amount) * 10 ** decimals);
      const freshOrder: UltraOrder = await proxyCall('order', {
        params: { inputMint: mint, outputMint, amount: String(units), taker: publicKey.toBase58() },
      });
      if (freshOrder.errorCode) throw new Error(freshOrder.errorMessage ?? freshOrder.errorCode);
      if (!freshOrder.transaction) throw new Error('No transaction returned');
      const tx       = VersionedTransaction.deserialize(Buffer.from(freshOrder.transaction, 'base64'));
      const signedTx = await signTransaction(tx);
      const signedB64 = Buffer.from(signedTx.serialize()).toString('base64');
      setStatus('executing');
      const result = await proxyCall('execute', {
        payload: { signedTransaction: signedB64, requestId: freshOrder.requestId },
      });
      if (result.status !== 'Success') throw new Error(result.error ?? `Failed: ${result.status}`);
      setTxSig(result.signature);
      setStatus('success');
      connection.getBalance(publicKey).then(l => setSolBal(l / LAMPORTS_PER_SOL)).catch(() => {});
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Swap failed';
      setErrMsg(/reject|cancel/i.test(msg) ? 'Transaction rejected by wallet.' : msg);
      setStatus('error');
    }
  };

  if (!isOpen) return null;

  const tokenCfg  = INPUT_TOKENS[inputToken];
  const inputBal  = inputToken === 'SOL' ? solBal : usdcBal;
  const amountNum = parseFloat(amount) || 0;
  const raidOut   = order ? Number(order.outAmount) / 10 ** RAID_DECIMALS : 0;
  const impact    = order ? Math.abs(parseFloat(order.priceImpactPct ?? '0')) : 0;
  const maxInput  = inputToken === 'SOL'
    ? (solBal !== null ? Math.max(0, solBal - 0.005) : 0)
    : (usdcBal ?? 0);
  const overBal   = inputBal !== null && amountNum > inputBal;
  const busy      = status === 'quoting' || status === 'signing' || status === 'executing';
  const canSwap   = status === 'ready' && !overBal && connected && !!publicKey && amountNum > 0;

  /* ══════════ CHOOSE ══════════ */
  if (step === 'choose') {
    return (
      <div
        className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center"
        style={{ background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(8px)' }}
        onClick={onClose}
      >
        <div
          className="relative w-full sm:max-w-[380px] rounded-t-2xl sm:rounded-2xl px-5 pt-5 pb-8 sm:pb-6"
          style={{
            background: 'linear-gradient(160deg, #0d0d2a 0%, #080820 100%)',
            border: '1.5px solid rgba(153,69,255,0.45)',
            boxShadow: '0 -8px 40px rgba(153,69,255,0.12), 0 0 80px rgba(0,0,0,0.6)',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* drag handle — mobile */}
          <div className="w-10 h-1 rounded-full mx-auto mb-4 sm:hidden"
            style={{ background: 'rgba(255,255,255,0.18)' }} />

          {/* close — desktop */}
          <button onClick={onClose}
            className="hidden sm:flex absolute top-3.5 right-3.5 w-7 h-7 rounded-full items-center justify-center hover:bg-white/10 active:scale-90 transition-all"
            style={{ border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.5)' }}>
            <span className="text-[13px] leading-none">✕</span>
          </button>

          <div className="mb-5 pr-8">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-[0.2em] text-black"
                style={{ background: '#FFB800', boxShadow: '0 0 10px rgba(255,184,0,0.4)' }}>$RAID</span>
              <span className="text-[16px] font-black uppercase tracking-[0.12em] text-white" style={SG}>BUY NOW</span>
            </div>
            <p className="text-[12px] text-white/40" style={INTER}>Choose where you'd like to buy $RAID</p>
          </div>

          <div className="flex flex-col gap-3">
            {/* BAGS.FM */}
            <button
              onClick={() => { window.open(BAGS_URL, '_blank', 'noopener,noreferrer'); onClose(); }}
              className="w-full rounded-2xl px-4 py-4 flex items-center justify-between transition-all active:scale-[0.97] group"
              style={{ background: 'linear-gradient(135deg,rgba(255,184,0,0.14) 0%,rgba(255,122,0,0.08) 100%)', border: '1.5px solid rgba(255,184,0,0.40)' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-black text-[11px] text-black"
                  style={{ background: '#FFB800', boxShadow: '0 0 14px rgba(255,184,0,0.45)' }}>BAGS</div>
                <div className="text-left">
                  <p className="text-[14px] font-black text-white uppercase tracking-[0.06em]" style={SG}>BAGS.FM</p>
                  <p className="text-[11px] text-white/40 mt-0.5" style={INTER}>Opens in new tab</p>
                </div>
              </div>
              <svg className="w-5 h-5 shrink-0 text-white/25 group-hover:text-[#FFB800] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </button>

            {/* SWAP IN-APP */}
            <button
              onClick={() => setStep('swap')}
              className="w-full rounded-2xl px-4 py-4 flex items-center justify-between transition-all active:scale-[0.97] group"
              style={{ background: 'linear-gradient(135deg,rgba(153,69,255,0.16) 0%,rgba(124,45,214,0.10) 100%)', border: '1.5px solid rgba(153,69,255,0.45)' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white font-black text-[11px]"
                  style={{ background: 'linear-gradient(135deg,#9945FF 0%,#7c2dd6 100%)', boxShadow: '0 0 14px rgba(153,69,255,0.5)' }}>JUP</div>
                <div className="text-left">
                  <p className="text-[14px] font-black text-white uppercase tracking-[0.06em]" style={SG}>SWAP IN-APP</p>
                  <p className="text-[11px] text-white/40 mt-0.5" style={INTER}>Best price via Jupiter</p>
                </div>
              </div>
              <svg className="w-5 h-5 shrink-0 text-white/25 group-hover:text-[#9945FF] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ══════════ SWAP ══════════ */
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full sm:max-w-[440px] rounded-t-2xl sm:rounded-2xl flex flex-col overflow-hidden"
        style={{
          background: 'linear-gradient(160deg, #0d0d2a 0%, #080820 100%)',
          border: '1.5px solid rgba(153,69,255,0.45)',
          boxShadow: '0 -8px 40px rgba(153,69,255,0.14), 0 0 80px rgba(0,0,0,0.7)',
          maxHeight: '92vh',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* drag handle — mobile */}
        <div className="w-10 h-1 rounded-full mx-auto mt-3 sm:hidden"
          style={{ background: 'rgba(255,255,255,0.18)' }} />

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-3.5 shrink-0"
          style={{ borderBottom: '1px solid rgba(153,69,255,0.18)' }}>
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => { setStep('choose'); setStatus('idle'); setOrder(null); }}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 active:scale-90 transition-all"
              style={{ border: '1px solid rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.5)' }}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex items-center gap-2">
              <TokenLogo token={inputToken} size={22} />
              <span className="text-white/40 text-[12px]" style={INTER}>→</span>
              <RaidLogo size={22} />
              <span className="text-[14px] font-black text-white uppercase tracking-[0.08em] ml-1" style={SG}>
                {tokenCfg.symbol} → $RAID
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {inputBal !== null ? (
              <div className="px-2.5 py-1 rounded-full text-[10px] font-semibold text-white/50 hidden sm:block"
                style={{ ...INTER, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)' }}>
                {fmt(inputBal, inputToken === 'SOL' ? 3 : 2)} {tokenCfg.symbol}
              </div>
            ) : connected && (
              <div className="w-4 h-4 rounded-full border-2 border-[#9945FF] border-t-transparent animate-spin" />
            )}
            <button onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 active:scale-90 transition-all"
              style={{ border: '1px solid rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.5)' }}>
              <span className="text-[14px] leading-none">✕</span>
            </button>
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 flex flex-col gap-3.5">

          {/* ─ Success ─ */}
          {status === 'success' && txSig && (
            <div className="rounded-2xl px-4 py-8 flex flex-col items-center gap-3 text-center"
              style={{ background: 'rgba(20,241,149,0.07)', border: '1.5px solid rgba(20,241,149,0.28)' }}>
              <div className="w-14 h-14 rounded-full flex items-center justify-center text-[22px] text-[#14F195]"
                style={{ background: 'rgba(20,241,149,0.14)' }}>✓</div>
              <div>
                <p className="text-[15px] font-black text-[#14F195] uppercase tracking-wide" style={SG}>Swap Successful!</p>
                <p className="text-[12px] text-white/45 mt-1.5" style={INTER}>
                  {fmt(amountNum, 4)} {tokenCfg.symbol} → {fmt(raidOut)} $RAID
                </p>
              </div>
              <a href={`https://solscan.io/tx/${txSig}`} target="_blank" rel="noopener noreferrer"
                className="text-[11px] text-[#14F195]/60 hover:text-[#14F195] transition-colors" style={INTER}>
                View on Solscan ↗
              </a>
              <button onClick={onClose}
                className="mt-2 px-8 py-3 rounded-2xl text-[12px] font-black uppercase tracking-[0.12em] text-white active:scale-95 transition-all"
                style={{ background: 'linear-gradient(135deg,#9945FF 0%,#7c2dd6 100%)', boxShadow: '0 0 20px rgba(153,69,255,0.3)' }}>
                Done
              </button>
            </div>
          )}

          {status !== 'success' && (<>

            {/* ─ Token selector ─ */}
            <div className="flex gap-2">
              {(Object.keys(INPUT_TOKENS) as InputToken[]).map(t => {
                const active = inputToken === t;
                return (
                  <button key={t}
                    onClick={() => { setInputToken(t); setAmount(''); setOrder(null); setStatus('idle'); }}
                    className="flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95"
                    style={{
                      background: active ? 'rgba(153,69,255,0.18)' : 'rgba(255,255,255,0.04)',
                      border: `1.5px solid ${active ? 'rgba(153,69,255,0.55)' : 'rgba(255,255,255,0.08)'}`,
                    }}>
                    {t === 'SOL' ? <SolLogo size={20} /> : <UsdcLogo size={20} />}
                    <span className="text-[12px] font-black uppercase tracking-[0.08em]"
                      style={{ ...SG, color: active ? '#c084fc' : 'rgba(255,255,255,0.40)' }}>
                      {t}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* ─ You Pay ─ */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase tracking-[0.18em] text-white/35" style={BN}>You Pay</span>
                <div className="flex items-center gap-2">
                  {/* mobile balance */}
                  {inputBal !== null && (
                    <span className="text-[10px] text-white/35 sm:hidden" style={INTER}>
                      {fmt(inputBal, inputToken === 'SOL' ? 3 : 2)} {tokenCfg.symbol}
                    </span>
                  )}
                  {inputBal !== null && (
                    <button className="text-[10px] text-[#9945FF] hover:text-[#b87fff] transition-colors font-semibold" style={INTER}
                      onClick={() => setAmount(maxInput.toFixed(inputToken === 'SOL' ? 4 : 2))}>
                      MAX
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl px-4 py-3.5"
                style={{ background: 'rgba(255,255,255,0.04)', border: `1.5px solid ${overBal ? 'rgba(255,80,80,0.55)' : 'rgba(255,255,255,0.10)'}` }}>
                <TokenLogo token={inputToken} size={36} />
                <input
                  type="number" min="0" step={inputToken === 'SOL' ? '0.01' : '1'}
                  placeholder="0.00" value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="flex-1 bg-transparent text-white font-bold outline-none placeholder-white/20 min-w-0"
                  style={{ ...SG, fontSize: 'clamp(18px, 5vw, 24px)' }}
                />
                <span className="text-[13px] font-black text-white/45 shrink-0" style={SG}>
                  {tokenCfg.symbol}
                </span>
              </div>
              {overBal && <p className="text-[11px] text-red-400 mt-1.5 pl-1" style={INTER}>Insufficient balance</p>}
            </div>

            {/* ─ Arrow ─ */}
            <div className="flex items-center justify-center py-0.5">
              <div className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(153,69,255,0.12)', border: '1px solid rgba(153,69,255,0.28)' }}>
                <svg className="w-4 h-4 text-[#9945FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </div>
            </div>

            {/* ─ You Receive ─ */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase tracking-[0.18em] text-white/35" style={BN}>You Receive</span>
                {order && impact > 1 && (
                  <span className="text-[10px] font-semibold" style={{ ...INTER, color: impact > 5 ? '#ff6b6b' : '#FFB800' }}>
                    Price impact: {impact.toFixed(2)}%
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 rounded-2xl px-4 py-3.5"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1.5px solid rgba(255,255,255,0.07)' }}>
                <RaidLogo size={36} />
                <div className="flex-1 min-w-0">
                  {status === 'quoting' ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full border-2 border-[#9945FF] border-t-transparent animate-spin shrink-0" />
                      <span className="text-[12px] text-white/30" style={INTER}>Fetching best price…</span>
                    </div>
                  ) : order ? (
                    <span className="font-bold text-white" style={{ ...SG, fontSize: 'clamp(18px, 5vw, 24px)' }}>
                      {fmt(raidOut)}
                    </span>
                  ) : (
                    <span className="font-bold text-white/20" style={{ ...SG, fontSize: 'clamp(18px, 5vw, 24px)' }}>—</span>
                  )}
                </div>
                <span className="text-[13px] font-black text-white/45 shrink-0" style={SG}>$RAID</span>
              </div>
            </div>

            {/* ─ Route ─ */}
            {order && (
              <p className="text-[10px] text-white/25 px-1" style={INTER}>
                via {order.routePlan?.map(r => r.swapInfo?.label).filter(Boolean).join(' + ') || 'Jupiter'}
              </p>
            )}

            {/* ─ Error ─ */}
            {status === 'error' && errMsg && (
              <div className="rounded-xl px-4 py-3 text-[11px] text-red-300 leading-relaxed"
                style={{ ...INTER, background: 'rgba(255,80,80,0.09)', border: '1px solid rgba(255,80,80,0.22)' }}>
                {errMsg}
              </div>
            )}

            {/* ─ Signing / executing pill ─ */}
            {(status === 'signing' || status === 'executing') && (
              <div className="rounded-xl px-4 py-3 flex items-center gap-2.5 text-[11px] text-[#9945FF]"
                style={{ ...INTER, background: 'rgba(153,69,255,0.08)', border: '1px solid rgba(153,69,255,0.22)' }}>
                <div className="w-4 h-4 rounded-full border-2 border-[#9945FF] border-t-transparent animate-spin shrink-0" />
                {status === 'signing' ? 'Approve in your wallet…' : 'Submitting transaction…'}
              </div>
            )}

            {/* ─ CTA ─ */}
            <button onClick={handleSwap} disabled={!canSwap || busy}
              className="w-full py-4 rounded-2xl font-black uppercase tracking-[0.12em] transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                ...SG, fontSize: 'clamp(12px, 3.5vw, 14px)',
                background: canSwap ? 'linear-gradient(135deg,#9945FF 0%,#7c2dd6 100%)' : 'rgba(153,69,255,0.15)',
                boxShadow: canSwap ? '0 0 24px rgba(153,69,255,0.38)' : 'none',
                color: 'white',
              }}>
              {!connected  ? 'Connect Wallet First'
                : overBal ? `Insufficient ${tokenCfg.symbol}`
                : !amount ? 'Enter an Amount'
                : busy    ? '...'
                : !order  ? 'Enter an Amount'
                : `Swap ${tokenCfg.symbol} → $RAID`}
            </button>

            {/* bottom safe-area spacer on mobile */}
            <div className="h-2 sm:hidden" />
          </>)}
        </div>

        {/* ── Footer ── */}
        <div className="px-5 py-2.5 shrink-0 flex items-center justify-center gap-1.5"
          style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <span className="text-[9px] text-white/20 uppercase tracking-[0.16em]" style={INTER}>Powered by</span>
          <JupLogo />
          <span className="text-[9px] font-black text-white/25 uppercase tracking-[0.12em]" style={SG}>Jupiter</span>
        </div>
      </div>
    </div>
  );
};

export default SwapModal;
