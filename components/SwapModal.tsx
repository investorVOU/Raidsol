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
  requestId:  string;
  inAmount:   string;
  outAmount:  string;
  transaction: string | null;
  errorCode?:  string;
  errorMessage?: string;
  routePlan?: { swapInfo: { label: string } }[];
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

/* ── Logos ── */
const SolLogo = () => (
  <svg className="w-8 h-8 shrink-0" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="solGrad" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#9945FF" />
        <stop offset="100%" stopColor="#14F195" />
      </linearGradient>
    </defs>
    <circle cx="50" cy="50" r="50" fill="url(#solGrad)" />
    <path d="M26,62 L64,62 Q68,62 71,59 L77,53 Q79,51 77,49 L39,49 Q35,49 32,52 Z" fill="white" />
    <path d="M26,44 L64,44 Q68,44 71,41 L77,35 Q79,33 77,31 L39,31 Q35,31 32,34 Z" fill="white" />
    <path d="M26,80 L64,80 Q68,80 71,77 L77,71 Q79,69 77,67 L39,67 Q35,67 32,70 Z" fill="white" />
  </svg>
);
const RAID_ICON = 'https://ipfs.io/ipfs/QmNfBzvgSRGc5p3CTqjzmpq9rTYYJfd43zwPDPdoeKtfeE';
const RAID_DECIMALS = 9;

const RaidLogo = () => (
  <img src={RAID_ICON} alt="RAID"
    className="w-8 h-8 rounded-full shrink-0 object-cover"
    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
  />
);

const UsdcLogo = () => (
  <svg className="w-8 h-8 shrink-0" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="50" fill="#2775CA" />
    <circle cx="50" cy="50" r="38" fill="white" fillOpacity="0.15" />
    <text x="50" y="57" textAnchor="middle" fill="white" fontSize="28" fontWeight="900"
      fontFamily="Arial,sans-serif">$</text>
    <circle cx="50" cy="50" r="44" fill="none" stroke="white" strokeWidth="3" strokeOpacity="0.3"/>
  </svg>
);
const JupLogo = () => (
  <div className="w-4 h-4 rounded flex items-center justify-center text-[7px] font-black text-white shrink-0"
    style={{ background: 'linear-gradient(135deg, #C7F284 0%, #00BEF0 100%)' }}>J</div>
);

/* ════════════════════════════════════════════════════════════════ */

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

  /* ── Fetch balances from chain ── */
  useEffect(() => {
    if (!isOpen || !publicKey) return;
    let cancelled = false;
    // SOL
    connection.getBalance(publicKey)
      .then(l => { if (!cancelled) setSolBal(l / LAMPORTS_PER_SOL); })
      .catch(() => {});
    // USDC
    connection.getParsedTokenAccountsByOwner(publicKey, { mint: new PublicKey(USDC_MINT) })
      .then(res => {
        if (cancelled) return;
        const bal = res.value[0]?.account.data.parsed.info.tokenAmount.uiAmount ?? 0;
        setUsdcBal(bal);
      })
      .catch(() => setUsdcBal(0));
    return () => { cancelled = true; };
  }, [isOpen, publicKey, connection]);

  /* ── Debounced quote (no taker = preview only) ── */
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

  /* ── Execute swap ── */
  const handleSwap = async () => {
    if (!publicKey || !signTransaction) return;
    setStatus('signing'); setErrMsg('');
    try {
      const { mint, decimals } = INPUT_TOKENS[inputToken];
      const units = Math.round(parseFloat(amount) * 10 ** decimals);

      // 1. Get order WITH taker → returns a signable transaction
      const freshOrder: UltraOrder = await proxyCall('order', {
        params: { inputMint: mint, outputMint, amount: String(units), taker: publicKey.toBase58() },
      });
      if (freshOrder.errorCode) throw new Error(freshOrder.errorMessage ?? freshOrder.errorCode);
      if (!freshOrder.transaction) throw new Error('No transaction returned from order API');

      // 2. Sign with wallet adapter
      const tx = VersionedTransaction.deserialize(Buffer.from(freshOrder.transaction, 'base64'));
      const signedTx = await signTransaction(tx);
      const signedB64 = Buffer.from(signedTx.serialize()).toString('base64');

      // 3. Execute via Ultra execute endpoint
      setStatus('executing');
      const result = await proxyCall('execute', {
        payload: { signedTransaction: signedB64, requestId: freshOrder.requestId },
      });

      if (result.status !== 'Success') {
        throw new Error(result.error ?? `Execution failed: ${result.status}`);
      }

      setTxSig(result.signature);
      setStatus('success');
      // Refresh balance
      connection.getBalance(publicKey).then(l => setSolBal(l / LAMPORTS_PER_SOL)).catch(() => {});
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Swap failed';
      setErrMsg(msg.toLowerCase().includes('reject') || msg.toLowerCase().includes('cancel')
        ? 'Transaction rejected by wallet.' : msg);
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

  const handleClose = () => onClose();

  /* ════════ CHOOSE ════════ */
  if (step === 'choose') {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4"
        style={{ background: 'rgba(0,0,0,0.80)', backdropFilter: 'blur(8px)' }}
        onClick={handleClose}>
        <div className="relative w-full max-w-[360px] rounded-2xl p-6"
          style={{ background: 'linear-gradient(160deg,#0d0d2a 0%,#080820 100%)', border: '1.5px solid rgba(153,69,255,0.45)', boxShadow: '0 0 40px rgba(153,69,255,0.18),0 24px 64px rgba(0,0,0,0.65)' }}
          onClick={e => e.stopPropagation()}>

          <button onClick={handleClose}
            className="absolute top-3.5 right-3.5 w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/10 active:scale-90 transition-all"
            style={{ border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.5)' }}>
            <span className="text-[13px] leading-none">✕</span>
          </button>

          <div className="mb-5 pr-6">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-[0.2em] text-black"
                style={{ background: '#FFB800', boxShadow: '0 0 10px rgba(255,184,0,0.4)' }}>$RAID</span>
              <span className="text-[15px] font-black uppercase tracking-[0.12em] text-white" style={SG}>BUY NOW</span>
            </div>
            <p className="text-[11px] text-white/40" style={INTER}>Choose where you'd like to buy $RAID</p>
          </div>

          <div className="flex flex-col gap-3">
            {/* BAGS.FM */}
            <button onClick={() => { window.open(BAGS_URL, '_blank', 'noopener,noreferrer'); handleClose(); }}
              className="w-full rounded-xl px-4 py-3.5 flex items-center justify-between transition-all active:scale-[0.97] group"
              style={{ background: 'linear-gradient(135deg,rgba(255,184,0,0.14) 0%,rgba(255,122,0,0.08) 100%)', border: '1.5px solid rgba(255,184,0,0.40)' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-black text-[10px] text-black"
                  style={{ background: '#FFB800', boxShadow: '0 0 14px rgba(255,184,0,0.45)' }}>BAGS</div>
                <div className="text-left">
                  <p className="text-[13px] font-black text-white uppercase tracking-[0.06em]" style={SG}>BAGS.FM</p>
                  <p className="text-[10px] text-white/40 mt-0.5" style={INTER}>Opens in new tab</p>
                </div>
              </div>
              <svg className="w-4 h-4 shrink-0 text-white/25 group-hover:text-[#FFB800] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </button>

            {/* SWAP IN-APP */}
            <button onClick={() => setStep('swap')}
              className="w-full rounded-xl px-4 py-3.5 flex items-center justify-between transition-all active:scale-[0.97] group"
              style={{ background: 'linear-gradient(135deg,rgba(153,69,255,0.14) 0%,rgba(124,45,214,0.08) 100%)', border: '1.5px solid rgba(153,69,255,0.40)' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white font-black text-[10px]"
                  style={{ background: 'linear-gradient(135deg,#9945FF 0%,#7c2dd6 100%)', boxShadow: '0 0 14px rgba(153,69,255,0.5)' }}>JUP</div>
                <div className="text-left">
                  <p className="text-[13px] font-black text-white uppercase tracking-[0.06em]" style={SG}>SWAP IN-APP</p>
                  <p className="text-[10px] text-white/40 mt-0.5" style={INTER}>Best price via Jupiter</p>
                </div>
              </div>
              <svg className="w-4 h-4 shrink-0 text-white/25 group-hover:text-[#9945FF] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ════════ SWAP ════════ */
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4 py-6"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)' }}
      onClick={handleClose}>
      <div className="relative w-full max-w-[400px] rounded-2xl flex flex-col overflow-hidden"
        style={{ background: 'linear-gradient(160deg,#0d0d2a 0%,#080820 100%)', border: '1.5px solid rgba(153,69,255,0.45)', boxShadow: '0 0 50px rgba(153,69,255,0.18),0 24px 64px rgba(0,0,0,0.7)' }}
        onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: '1px solid rgba(153,69,255,0.18)' }}>
          <div className="flex items-center gap-2.5">
            <button onClick={() => { setStep('choose'); setStatus('idle'); setOrder(null); }}
              className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/10 active:scale-90 transition-all"
              style={{ border: '1px solid rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.5)' }}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-[14px] font-black uppercase tracking-[0.10em] text-white" style={SG}>
              SOL → $RAID
            </span>
          </div>
          <div className="flex items-center gap-3">
            {/* Live balance */}
            {inputBal !== null
              ? <div className="px-2.5 py-1 rounded-full text-[10px] font-bold text-white/55"
                  style={{ ...INTER, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)' }}>
                  {fmt(inputBal, 3)} {tokenCfg.symbol}
                </div>
              : connected && <div className="w-4 h-4 rounded-full border-2 border-[#9945FF] border-t-transparent animate-spin" />
            }
            <button onClick={handleClose}
              className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/10 active:scale-90 transition-all"
              style={{ border: '1px solid rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.5)' }}>
              <span className="text-[13px] leading-none">✕</span>
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="px-5 py-5 flex flex-col gap-4">

          {/* ─ Success ─ */}
          {status === 'success' && txSig && (
            <div className="rounded-xl px-4 py-6 flex flex-col items-center gap-3 text-center"
              style={{ background: 'rgba(20,241,149,0.08)', border: '1.5px solid rgba(20,241,149,0.28)' }}>
              <div className="w-12 h-12 rounded-full flex items-center justify-center font-black text-[18px] text-[#14F195]"
                style={{ background: 'rgba(20,241,149,0.14)' }}>✓</div>
              <div>
                <p className="text-[13px] font-black text-[#14F195] uppercase tracking-wide" style={SG}>Swap Successful!</p>
                <p className="text-[11px] text-white/40 mt-1" style={INTER}>
                  {fmt(amountNum)} {tokenCfg.symbol} → {fmt(raidOut)} $RAID
                </p>
              </div>
              <a href={`https://solscan.io/tx/${txSig}`} target="_blank" rel="noopener noreferrer"
                className="text-[10px] text-[#14F195]/60 hover:text-[#14F195] transition-colors" style={INTER}>
                View on Solscan ↗
              </a>
              <button onClick={handleClose}
                className="mt-1 px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-[0.12em] text-white active:scale-95 transition-all"
                style={{ background: 'linear-gradient(135deg,#9945FF 0%,#7c2dd6 100%)' }}>
                Done
              </button>
            </div>
          )}

          {status !== 'success' && (
            <>
              {/* ─ Token selector ─ */}
              <div className="flex gap-2">
                {(Object.keys(INPUT_TOKENS) as InputToken[]).map(t => (
                  <button key={t} onClick={() => { setInputToken(t); setAmount(''); setOrder(null); setStatus('idle'); }}
                    className="flex-1 py-2 rounded-xl text-[11px] font-black uppercase tracking-[0.10em] transition-all active:scale-95 flex items-center justify-center gap-1.5"
                    style={{
                      background: inputToken === t ? 'rgba(153,69,255,0.20)' : 'rgba(255,255,255,0.04)',
                      border: `1.5px solid ${inputToken === t ? 'rgba(153,69,255,0.55)' : 'rgba(255,255,255,0.08)'}`,
                      color: inputToken === t ? '#c084fc' : 'rgba(255,255,255,0.35)',
                    }}>
                    {t === 'SOL' ? <SolLogo /> : <UsdcLogo />}
                    <span style={SG}>{t}</span>
                  </button>
                ))}
              </div>

              {/* ─ Input amount ─ */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase tracking-[0.15em] text-white/35" style={BN}>You Pay</span>
                  {inputBal !== null && (
                    <button className="text-[10px] text-[#9945FF] hover:text-[#b87fff] transition-colors" style={INTER}
                      onClick={() => setAmount(maxInput.toFixed(inputToken === 'SOL' ? 4 : 2))}>
                      Max: {fmt(maxInput, inputToken === 'SOL' ? 4 : 2)} {tokenCfg.symbol}
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3 rounded-xl px-4 py-3.5"
                  style={{ background: 'rgba(255,255,255,0.04)', border: `1.5px solid ${overBal ? 'rgba(255,80,80,0.55)' : 'rgba(255,255,255,0.10)'}` }}>
                  {inputToken === 'SOL' ? <SolLogo /> : <UsdcLogo />}
                  <input type="number" min="0" step={inputToken === 'SOL' ? '0.01' : '1'} placeholder="0.00"
                    value={amount} onChange={e => setAmount(e.target.value)}
                    className="flex-1 bg-transparent text-white text-[20px] font-bold outline-none placeholder-white/20 min-w-0"
                    style={SG} />
                  <span className="text-[12px] font-black text-white/45 shrink-0" style={SG}>{tokenCfg.symbol}</span>
                </div>
                {overBal && <p className="text-[10px] text-red-400 mt-1.5 pl-1" style={INTER}>Insufficient balance</p>}
              </div>

              {/* ─ Arrow ─ */}
              <div className="flex items-center justify-center">
                <div className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(153,69,255,0.12)', border: '1px solid rgba(153,69,255,0.25)' }}>
                  <svg className="w-4 h-4 text-[#9945FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </div>
              </div>

              {/* ─ RAID output ─ */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase tracking-[0.15em] text-white/35" style={BN}>You Receive</span>
                  {order && impact > 1 && (
                    <span className="text-[10px]" style={{ ...INTER, color: impact > 5 ? '#ff6b6b' : '#FFB800' }}>
                      Impact: {impact.toFixed(2)}%
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 rounded-xl px-4 py-3.5"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1.5px solid rgba(255,255,255,0.07)' }}>
                  <RaidLogo />
                  <div className="flex-1 min-w-0">
                    {status === 'quoting' ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full border-2 border-[#9945FF] border-t-transparent animate-spin shrink-0" />
                        <span className="text-[12px] text-white/30" style={INTER}>Fetching best price…</span>
                      </div>
                    ) : order ? (
                      <span className="text-[20px] font-bold text-white" style={SG}>{fmt(raidOut)}</span>
                    ) : (
                      <span className="text-[20px] font-bold text-white/20" style={SG}>—</span>
                    )}
                  </div>
                  <span className="text-[12px] font-black text-white/45 shrink-0" style={SG}>$RAID</span>
                </div>
              </div>

              {/* ─ Route ─ */}
              {order && (
                <div className="flex items-center justify-between px-1 -mt-1">
                  <span className="text-[10px] text-white/25" style={INTER}>
                    via {order.routePlan?.map(r => r.swapInfo?.label).filter(Boolean).join(' + ') || 'Jupiter'}
                  </span>
                </div>
              )}

              {/* ─ Error ─ */}
              {status === 'error' && errMsg && (
                <div className="rounded-xl px-4 py-3 text-[11px] text-red-300 leading-relaxed"
                  style={{ ...INTER, background: 'rgba(255,80,80,0.10)', border: '1px solid rgba(255,80,80,0.22)' }}>
                  {errMsg}
                </div>
              )}

              {/* ─ Status pill ─ */}
              {(status === 'signing' || status === 'executing') && (
                <div className="rounded-xl px-4 py-3 flex items-center gap-2.5 text-[11px] text-[#9945FF]"
                  style={{ ...INTER, background: 'rgba(153,69,255,0.08)', border: '1px solid rgba(153,69,255,0.22)' }}>
                  <div className="w-4 h-4 rounded-full border-2 border-[#9945FF] border-t-transparent animate-spin shrink-0" />
                  {status === 'signing' ? 'Check your wallet to approve…' : 'Submitting transaction…'}
                </div>
              )}

              {/* ─ Swap button ─ */}
              <button onClick={handleSwap} disabled={!canSwap || busy}
                className="w-full py-4 rounded-xl text-[13px] font-black uppercase tracking-[0.12em] transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ ...SG, background: canSwap ? 'linear-gradient(135deg,#9945FF 0%,#7c2dd6 100%)' : 'rgba(153,69,255,0.15)', boxShadow: canSwap ? '0 0 22px rgba(153,69,255,0.35)' : 'none', color: 'white' }}>
                {!connected       ? 'Connect Wallet First'
                  : overBal      ? 'Insufficient SOL'
                  : !amount      ? 'Enter an Amount'
                  : busy         ? '...'
                  : !order       ? 'Enter an Amount'
                  : 'Swap Now'}
              </button>
            </>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-5 py-3 shrink-0 flex items-center justify-center gap-1.5"
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
