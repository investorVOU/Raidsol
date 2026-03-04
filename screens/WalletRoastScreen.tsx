
import React, { useState, useCallback } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

interface WalletRoastScreenProps {
  walletAddress: string | null;
  walletBalance: number;
  onBack: () => void;
}

interface RoastData {
  zeroTokens: number;   // SPL accounts with 0 balance (rugs)
  totalTokens: number;  // total SPL accounts
  txCount: number;      // recent tx count
  solBalance: number;   // SOL balance
}

// ── Roast template library ─────────────────────────────────────────────────

const RUG_LINES = [
  (n: number) => `You're holding ${n} rugs. Classic.`,
  (n: number) => `${n} zero-balance tokens. That's not a portfolio, that's a museum of failure.`,
  (n: number) => `Congratulations on ${n} rugs. You really committed to the experience.`,
  (n: number) => `${n} ghost tokens. Each one a fond memory of a better time.`,
  (n: number) => `I counted ${n} rugs. Your wallet is basically a graveyard.`,
];

const DEGEN_LINES = [
  (n: number) => `${n} transactions and still broke. Respect the dedication.`,
  (n: number) => `${n} txs. You've been busy. Busy losing money, but busy.`,
  (n: number) => `With ${n} transactions you'd think you'd have figured it out by now.`,
  (n: number) => `${n} on-chain moves. The block history doesn't lie.`,
  (n: number) => `${n} transactions. The chain has receipts. All bad.`,
];

const SOL_POOR_LINES = [
  (s: number) => `${s.toFixed(3)} SOL? That won't even cover gas in another life.`,
  (s: number) => `${s.toFixed(3)} SOL remaining. Almost enough for a sad meal.`,
  (s: number) => `Your ${s.toFixed(3)} SOL is giving "I believe in crypto" energy.`,
  (s: number) => `${s.toFixed(3)} SOL. Technically still a holder. Barely.`,
];

const SOL_RICH_LINES = [
  (s: number) => `${s.toFixed(3)} SOL. Not bad for someone who also held those rugs.`,
  (s: number) => `${s.toFixed(3)} SOL — okay whale, we see you. Still held the rugs though.`,
  (s: number) => `You have ${s.toFixed(3)} SOL. Congrats, you survived.`,
];

const CLOSING_LINES = [
  'At least the blockchain remembers you fondly.',
  'SolRaid is not responsible for your financial decisions.',
  'GM. This is fine.',
  'Have you tried turning it off and on again?',
  'Your therapist needs a therapist.',
  'Somewhere, a VC is investing your loss as a write-off.',
  'Touch grass. No, really.',
  'The house always wins. You are not the house.',
  'Sir, this is a blockchain.',
  'Not financial advice. Clearly.',
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateRoast(data: RoastData, seed: number): string[] {
  // Use seed to pick different lines on each "ROAST AGAIN"
  const pick = <T,>(arr: T[]) => arr[(seed + arr.length * 7) % arr.length];

  const lines: string[] = [];

  // Rug line
  if (data.zeroTokens > 0) {
    lines.push(pick(RUG_LINES)(data.zeroTokens));
  } else if (data.totalTokens === 0) {
    lines.push('Zero tokens. Either extremely wise or extremely new. Jury\'s out.');
  } else {
    lines.push('No rugged tokens? Either a genius or you haven\'t started yet.');
  }

  // Activity line
  if (data.txCount > 0) {
    lines.push(pick(DEGEN_LINES)(data.txCount));
  }

  // SOL line
  if (data.solBalance < 0.1) {
    lines.push(pick(SOL_POOR_LINES)(data.solBalance));
  } else {
    lines.push(pick(SOL_RICH_LINES)(data.solBalance));
  }

  // Closing
  lines.push(pick(CLOSING_LINES));

  return lines;
}

const WalletRoastScreen: React.FC<WalletRoastScreenProps> = ({
  walletAddress,
  walletBalance,
  onBack,
}) => {
  const { connection } = useConnection();
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [roastLines, setRoastLines] = useState<string[]>([]);
  const [roastData, setRoastData] = useState<RoastData | null>(null);
  const [seed, setSeed] = useState(0);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const runRoast = useCallback(async (newSeed: number) => {
    if (!walletAddress) return;
    setStatus('loading');
    setErrorMsg('');
    try {
      const pubkey = new PublicKey(walletAddress);

      // Fetch SPL token accounts
      const tokenAccounts = await connection.getTokenAccountsByOwner(pubkey, {
        programId: TOKEN_PROGRAM_ID,
      });
      const totalTokens = tokenAccounts.value.length;
      const zeroTokens = tokenAccounts.value.filter(a => {
        try {
          const data = a.account.data;
          // Token account data layout: mint(32) + owner(32) + amount(8) + ...
          // amount is at offset 64, little-endian u64
          const amount = data.readBigUInt64LE(64);
          return amount === 0n;
        } catch {
          return false;
        }
      }).length;

      // Fetch recent tx count
      let txCount = 0;
      try {
        const sigs = await connection.getSignaturesForAddress(pubkey, { limit: 1000 });
        txCount = sigs.length;
      } catch {
        txCount = 0;
      }

      const data: RoastData = {
        zeroTokens,
        totalTokens,
        txCount,
        solBalance: walletBalance,
      };

      setRoastData(data);
      setRoastLines(generateRoast(data, newSeed));
      setStatus('done');
    } catch (err) {
      console.error('[WalletRoast]', err);
      setErrorMsg('Failed to fetch wallet data. Try again.');
      setStatus('error');
    }
  }, [walletAddress, walletBalance, connection]);

  const handleStart = () => {
    const s = Date.now() % 100;
    setSeed(s);
    runRoast(s);
  };

  const handleRoastAgain = () => {
    if (!roastData) return;
    const newSeed = (seed + 13) % 100;
    setSeed(newSeed);
    setRoastLines(generateRoast(roastData, newSeed));
  };

  const shortAddr = walletAddress
    ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`
    : 'UNKNOWN';

  const roastText = roastLines.length > 0
    ? `🔥 SolRaid Wallet Roast: ${shortAddr}\n\n${roastLines.join('\n\n')}\n\nGet roasted at solraid.app`
    : '';

  const handleCopy = () => {
    navigator.clipboard.writeText(roastText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleTweet = () => {
    const encoded = encodeURIComponent(roastText);
    window.open(`https://twitter.com/intent/tweet?text=${encoded}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="h-full flex flex-col overflow-y-auto scrollbar-hide pb-28 md:pb-8" style={{ backgroundColor: 'var(--app-bg)' }}>
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 pt-5 pb-4 border-b border-white/6">
        <button onClick={onBack} className="text-white hover:text-white transition-colors p-1">
          <i className="fa-solid fa-arrow-left text-sm" />
        </button>
        <div className="text-center">
          <h1 className="text-lg font-black text-white uppercase tracking-widest" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '3px' }}>
            Wallet Roast
          </h1>
          <p className="text-[10px] text-white font-bold">On-chain comedy</p>
        </div>
        <div className="w-6" />
      </div>

      <div className="flex-1 flex flex-col items-center justify-start px-4 py-8 max-w-md mx-auto w-full gap-6">

        {status === 'idle' && (
          <>
            <div className="text-6xl">🔥</div>
            <div className="text-center space-y-2">
              <h2 className="text-xl font-black text-white">Let's roast your wallet</h2>
              <p className="text-sm text-white">
                We'll analyse your on-chain history and craft a personalised roast. Share at your own risk.
              </p>
            </div>

            {!walletAddress ? (
              <div className="w-full rounded-xl bg-white/3 border border-white/10 p-5 text-center">
                <p className="text-white text-sm font-bold">Connect wallet to get roasted</p>
              </div>
            ) : (
              <button
                onClick={handleStart}
                className="w-full py-4 rounded-xl font-black text-base text-white active:scale-95 transition-all"
                style={{ background: 'linear-gradient(135deg, #9945FF 0%, #7c2dd6 100%)', boxShadow: '0 0 25px rgba(153,69,255,0.30)', fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '2px', fontSize: '18px' }}
              >
                🔥 ROAST MY WALLET
              </button>
            )}
          </>
        )}

        {status === 'loading' && (
          <div className="flex flex-col items-center gap-4 py-12">
            <div className="text-4xl animate-bounce">🔍</div>
            <p className="text-white font-black text-sm animate-pulse" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '2px' }}>ANALYSING WALLET...</p>
            <p className="text-white text-xs text-center">Reading your on-chain history.<br />This will hurt.</p>
          </div>
        )}

        {status === 'error' && (
          <div className="w-full rounded-xl bg-[#9945FF]/8 border border-[#9945FF]/30 p-5 text-center space-y-3">
            <p className="text-[#9945FF] font-bold text-sm">{errorMsg}</p>
            <button
              onClick={handleStart}
              className="px-6 py-2.5 rounded-xl font-bold text-sm text-white border border-[#9945FF]/40 hover:bg-[#9945FF]/10 transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {status === 'done' && (
          <div className="w-full space-y-4">
            {/* Roast Card */}
            <div
              className="w-full rounded-2xl p-5 space-y-4"
              style={{ background: 'linear-gradient(135deg, #0d0000 0%, #150505 100%)', border: '1px solid rgba(153,69,255,0.25)', boxShadow: '0 0 30px rgba(153,69,255,0.08)' }}
            >
              {/* Card header */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[9px] text-white font-bold uppercase tracking-widest">SolRaid · Wallet Roast</p>
                  <p className="text-sm font-black text-[#9945FF] font-mono">{shortAddr}</p>
                </div>
                <span className="text-2xl">🔥</span>
              </div>

              {/* Divider */}
              <div className="h-px bg-[#9945FF]/20" />

              {/* Roast lines */}
              <div className="space-y-3">
                {roastLines.map((line, i) => (
                  <p key={i} className="text-sm text-white/85 leading-relaxed font-medium">
                    {i < roastLines.length - 1 ? line : (
                      <span className="text-white text-xs italic">{line}</span>
                    )}
                  </p>
                ))}
              </div>

              {/* Stats footer */}
              {roastData && (
                <div className="flex items-center gap-4 pt-2 border-t border-white/5">
                  <div className="flex-1 text-center">
                    <p className="text-lg font-black text-white">{roastData.totalTokens}</p>
                    <p className="text-[8px] text-white uppercase tracking-wide">Tokens</p>
                  </div>
                  <div className="w-px h-8 bg-white/10" />
                  <div className="flex-1 text-center">
                    <p className="text-lg font-black text-[#9945FF]">{roastData.zeroTokens}</p>
                    <p className="text-[8px] text-white uppercase tracking-wide">Rugs</p>
                  </div>
                  <div className="w-px h-8 bg-white/10" />
                  <div className="flex-1 text-center">
                    <p className="text-lg font-black text-[#FFB800]">{roastData.txCount}</p>
                    <p className="text-[8px] text-white uppercase tracking-wide">TXs</p>
                  </div>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleCopy}
                className="py-3 rounded-xl font-bold text-sm transition-all active:scale-95 flex items-center justify-center gap-2"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }}
              >
                <i className={`fa-solid ${copied ? 'fa-check text-green-400' : 'fa-copy'} text-sm`} />
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button
                onClick={handleTweet}
                className="py-3 rounded-xl font-bold text-sm transition-all active:scale-95 flex items-center justify-center gap-2"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }}
              >
                <i className="fa-brands fa-x-twitter text-sm" />
                Tweet it
              </button>
            </div>

            <button
              onClick={handleRoastAgain}
              className="w-full py-3 rounded-xl font-black text-sm active:scale-95 transition-all"
              style={{ background: 'rgba(153,69,255,0.08)', border: '1px solid rgba(153,69,255,0.30)', color: '#9945FF', fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '2px', fontSize: '16px' }}
            >
              🔥 ROAST AGAIN
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default WalletRoastScreen;
