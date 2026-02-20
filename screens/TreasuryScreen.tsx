
import React, { useState, useEffect } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useTreasuryStats } from '../hooks/useTreasuryStats';
import { supabase } from '../lib/supabase';

interface TreasuryScreenProps {
  onBack: () => void;
}

interface RecentTx {
  id: string;
  raid_id: string;
  success: boolean;
  sol_amount: number;
  entry_fee: number;
  server_seed_hash: string | null;
  created_at: string;
}

const TreasuryScreen: React.FC<TreasuryScreenProps> = ({ onBack }) => {
  const { stats, loading } = useTreasuryStats();
  const { connection } = useConnection();
  const [recentTx, setRecentTx] = useState<RecentTx[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [liveBalance, setLiveBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  // Load recent raid history
  useEffect(() => {
    setTxLoading(true);
    supabase
      .from('raid_history')
      .select('id, raid_id, success, sol_amount, entry_fee, server_seed_hash, created_at')
      .order('created_at', { ascending: false })
      .limit(8)
      .then(({ data }) => {
        if (data) setRecentTx(data as RecentTx[]);
        setTxLoading(false);
      });
  }, []);

  // Fetch live on-chain SOL balance of treasury wallet
  const addr = import.meta.env.VITE_TREASURY_ADDRESS || stats?.treasury_address || '';
  useEffect(() => {
    if (!addr) return;
    let mounted = true;
    const fetchOnChainBalance = async () => {
      setBalanceLoading(true);
      try {
        const pk = new PublicKey(addr);
        const lamports = await connection.getBalance(pk, 'confirmed');
        if (mounted) setLiveBalance(lamports / LAMPORTS_PER_SOL);
      } catch (err) {
        console.error('Failed to fetch treasury on-chain balance', err);
      } finally {
        if (mounted) setBalanceLoading(false);
      }
    };
    fetchOnChainBalance();
    // Refresh every 30s
    const interval = setInterval(fetchOnChainBalance, 30_000);
    return () => { mounted = false; clearInterval(interval); };
  }, [addr, connection]);

  const explorerUrl = addr
    ? `https://explorer.solana.com/address/${addr}?cluster=devnet`
    : 'https://explorer.solana.com?cluster=devnet';
  const solscanUrl = addr
    ? `https://solscan.io/account/${addr}?cluster=devnet`
    : 'https://solscan.io';
  const displayAddr = addr
    ? `${addr.slice(0, 6)}...${addr.slice(-6)}`
    : 'NOT_CONFIGURED';

  return (
    <div className="h-full flex flex-col p-6 animate-in slide-in-from-right duration-300 overflow-y-auto scrollbar-hide">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-4 mb-8">
        <button onClick={onBack} className="text-white/40 hover:text-white font-black text-2xl">
          {'<'}
        </button>
        <div>
          <h2 className="text-4xl font-black italic uppercase tracking-tighter text-white">
            PROTOCOL_<span className="text-[#14F195]">TREASURY</span>
          </h2>
          <p className="text-xs font-black text-white/30 uppercase tracking-[0.4em]">Solvency_Check_v5.0</p>
        </div>
      </div>

      <div className="space-y-6 max-w-4xl">
        {/* Big Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-[#050505] border-2 border-[#14F195]/30 p-8 tech-border relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <span className="text-6xl font-black text-[#14F195]">SOL</span>
            </div>
            <p className="text-sm font-black text-white/40 uppercase tracking-widest mb-2">TOTAL_RESERVE</p>
            {balanceLoading && liveBalance === null ? (
              <div className="h-12 bg-white/5 animate-pulse rounded w-2/3" />
            ) : (
              <p className="text-5xl font-black text-white mono tracking-tighter">
                {liveBalance !== null
                  ? liveBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })
                  : stats
                    ? Number(stats.total_reserve_sol).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    : '—'}
              </p>
            )}
            <div className="flex items-center gap-3 mt-2">
              <p className="text-xs font-black text-[#14F195] uppercase tracking-wider">STATUS: OVER-COLLATERALIZED</p>
              <span className="flex items-center gap-1 text-[10px] font-black text-[#14F195]/60 uppercase tracking-widest">
                <span className="w-1.5 h-1.5 rounded-full bg-[#14F195] animate-pulse inline-block" />
                LIVE_ON-CHAIN
              </span>
            </div>
            <p className="text-[10px] font-black text-white/20 uppercase tracking-widest mt-1">DEVNET</p>
          </div>

          <div className="bg-[#050505] border-2 border-white/10 p-8 tech-border">
            <p className="text-sm font-black text-white/40 uppercase tracking-widest mb-2">24H_PAYOUTS</p>
            {loading ? (
              <div className="h-12 bg-white/5 animate-pulse rounded w-2/3" />
            ) : (
              <p className="text-5xl font-black text-white mono tracking-tighter">
                {stats ? Number(stats.payouts_24h_sol).toFixed(2) : '—'}
              </p>
            )}
            <p className="text-xs font-black text-white/20 mt-2 uppercase tracking-wider">
              VIA {stats ? stats.total_transactions.toLocaleString() : '—'} TRANSACTIONS
            </p>
          </div>
        </div>

        {/* Verification Link */}
        <div className="p-6 bg-[#14F195]/5 border border-[#14F195]/20 tech-border flex flex-col md:flex-row justify-between items-center gap-6">
          <div>
            <h3 className="text-lg font-black uppercase text-[#14F195] italic">VERIFY ON CHAIN</h3>
            <div className="flex items-center gap-2 mt-1 mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-white/40">TREASURY_ADDR:</span>
              <span className="mono text-xs text-white bg-black/50 px-2 py-1 border border-white/10">
                {displayAddr}
              </span>
            </div>
            <p className="text-xs text-white/60 font-medium max-w-md">
              The treasury wallet is public. You can audit all inflows (fees) and outflows (payouts) directly on the ledger.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <a
              href={explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="px-5 py-3 bg-black border border-purple-500/30 text-purple-400 font-black uppercase tracking-tight text-xs hover:bg-purple-500/10 transition-colors tech-border text-center"
            >
              SOLANA EXPLORER
            </a>
            <a
              href={solscanUrl}
              target="_blank"
              rel="noreferrer"
              className="px-6 py-3 bg-[#14F195] text-black font-black uppercase tracking-tight text-xs hover:bg-[#10c479] transition-colors tech-border text-center shadow-[0_0_15px_rgba(20,241,149,0.2)]"
            >
              VIEW ON SOLSCAN
            </a>
          </div>
        </div>

        {/* Recent Transactions — from real raid_history */}
        <div className="border-t border-white/10 pt-6">
          <h3 className="text-sm font-black text-white/40 uppercase tracking-widest mb-4">RECENT_PROTOCOLS</h3>
          {txLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-10 bg-white/5 animate-pulse rounded" />
              ))}
            </div>
          ) : recentTx.length === 0 ? (
            <p className="text-white/20 font-black uppercase tracking-widest text-xs py-8 text-center">
              NO TRANSACTIONS YET
            </p>
          ) : (
            <div className="space-y-2 font-mono text-xs">
              {recentTx.map((tx) => (
                <div
                  key={tx.id}
                  className="flex justify-between items-center p-3 bg-white/2 border border-white/5 hover:bg-white/5 transition-colors"
                >
                  <span className="text-white/40 truncate max-w-[120px]">{tx.raid_id}</span>
                  <span className={tx.success ? 'text-[#14F195]' : 'text-red-500'}>
                    {tx.success ? 'OUTFLOW (WIN)' : 'INFLOW (FEE)'}
                  </span>
                  <span className="text-white font-bold">
                    {tx.success ? `+${Number(tx.sol_amount).toFixed(3)}` : `-${Number(tx.entry_fee).toFixed(3)}`} SOL
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TreasuryScreen;
