import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const ADMIN_PWD    = import.meta.env.VITE_ADMIN_PWD ?? '';
const SESSION_KEY  = '__sr_admin';
const TREASURY     = import.meta.env.VITE_TREASURY_ADDRESS ?? '';
const USDC_MINT    = import.meta.env.VITE_USDC_MINT ?? 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const SKR_MINT     = import.meta.env.VITE_SKR_MINT  ?? 'SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3';
const RPC_URL      = import.meta.env.VITE_HELIUS_RPC_URL ?? import.meta.env.VITE_SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';

type Tab = 'OVERVIEW' | 'STATS' | 'RAIDS' | 'USERS' | 'CLAIMS' | 'ROUNDS' | 'FEEDBACK' | 'PUSH';

interface RaidRow   { raid_id: string; wallet_address: string; difficulty: string; success: boolean; points: number; sol_amount: number; elapsed_sec: number; created_at: string; }
interface UserRow   { wallet_address: string; username: string; sr_points: number; unclaimed_sol: number; raid_tickets: number; created_at: string; }
interface ClaimRow  { id: string; wallet_address: string; action_type: string; reward_sr: number; twitter_handle: string | null; created_at: string; }
interface WinnerRow      { id: string; round_number: number; round_date: string; rank: number; wallet_address: string; prize_sol: number; claimed: boolean; }
interface SuggestionRow  { id: number; wallet_address: string | null; category: string; suggestion_text: string; created_at: string; }

interface Overview {
  totalUsers: number; totalRaids: number; totalWins: number;
  totalSolWagered: number; totalSR: number; openBounties: number;
}

interface TreasuryStats {
  solBalance: number | null;
  usdcBalance: number | null;
  skrBalance: number | null;
  totalUnclaimed: number;
  totalPaidOut: number;
  todayRaids: number;
  weekRaids: number;
  byDifficulty: { difficulty: string; total: number; wins: number }[];
  byClaimType: { action_type: string; count: number; total_sr: number }[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────
async function rpcPost(method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const json = await res.json() as { result?: unknown };
  return json.result;
}

async function fetchSolBalance(address: string): Promise<number> {
  const result = await rpcPost('getBalance', [address, { commitment: 'confirmed' }]) as { value?: number } | null;
  return (result?.value ?? 0) / 1e9;
}

async function fetchTokenBalance(owner: string, mint: string): Promise<number> {
  const result = await rpcPost('getTokenAccountsByOwner', [
    owner,
    { mint },
    { encoding: 'jsonParsed', commitment: 'confirmed' },
  ]) as { value?: { account: { data: { parsed: { info: { tokenAmount: { uiAmount: number } } } } } }[] } | null;
  const accounts = result?.value ?? [];
  if (accounts.length === 0) return 0;
  return accounts[0].account.data.parsed.info.tokenAmount.uiAmount ?? 0;
}

// ── Copy button ────────────────────────────────────────────────────────────────
const CopyBtn: React.FC<{ text: string }> = ({ text }) => {
  const [copied, setCopied] = useState(false);
  const copy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button onClick={copy}
      className="ml-1.5 text-white hover:text-white transition-colors shrink-0 align-middle"
      title={text}>
      {copied
        ? <i className="fa-solid fa-check text-[#14F195] text-[9px]" />
        : <i className="fa-regular fa-copy text-[9px]" />}
    </button>
  );
};

// ── Wallet cell (truncated + copy btn) ────────────────────────────────────────
const WalletCell: React.FC<{ address: string }> = ({ address }) => (
  <td className="py-1.5 pr-3">
    <span className="flex items-center gap-0.5">
      <span className="font-mono text-white text-[10px]">{address.slice(0, 6)}…{address.slice(-4)}</span>
      <CopyBtn text={address} />
    </span>
  </td>
);

// ── Stat card ─────────────────────────────────────────────────────────────────
const Stat: React.FC<{ label: string; value: string | number; sub?: string; color?: string }> = ({ label, value, sub, color = 'text-white' }) => (
  <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-3">
    <p className="text-[9px] text-white uppercase tracking-widest mb-1">{label}</p>
    <p className={`text-xl font-black mono leading-none ${color}`}>{value}</p>
    {sub && <p className="text-[9px] text-white mt-0.5">{sub}</p>}
  </div>
);

// ── Password gate ─────────────────────────────────────────────────────────────
const PasswordGate: React.FC<{ onAuth: () => void }> = ({ onAuth }) => {
  const [pwd, setPwd] = useState('');
  const [err, setErr] = useState(false);

  const attempt = () => {
    if (ADMIN_PWD && pwd === ADMIN_PWD) {
      sessionStorage.setItem(SESSION_KEY, '1');
      onAuth();
    } else {
      setErr(true);
      setPwd('');
      setTimeout(() => setErr(false), 1800);
    }
  };

  return (
    <div className="min-h-screen bg-[#07071a] flex items-center justify-center p-6">
      <div className="w-full max-w-xs flex flex-col gap-5">
        <div className="text-center">
          <p className="text-[10px] text-white uppercase tracking-[0.3em] mb-1">RESTRICTED</p>
          <h1 className="text-2xl font-black text-white uppercase tracking-widest">RUSHTIK</h1>
          <p className="text-[10px] text-white mt-1">Admin Panel — SolRaid</p>
        </div>
        <div className={`border rounded-xl p-1 transition-colors ${err ? 'border-[#9945FF]/60' : 'border-white/10'}`}>
          <input type="password" value={pwd}
            onChange={e => setPwd(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && attempt()}
            placeholder="Access key" autoFocus
            className="w-full bg-transparent px-4 py-3 text-white text-sm font-mono focus:outline-none placeholder:text-white"
          />
        </div>
        {err && <p className="text-[11px] text-[#9945FF] font-bold text-center -mt-2">Access denied</p>}
        <button onClick={attempt}
          className="w-full py-3 rounded-xl bg-[#9945FF] text-white font-black text-sm uppercase tracking-wider active:scale-95 transition-transform">
          Enter
        </button>
      </div>
    </div>
  );
};

// ── Main dashboard ────────────────────────────────────────────────────────────
const Dashboard: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
  const [tab, setTab]             = useState<Tab>('OVERVIEW');
  const [overview, setOverview]   = useState<Overview | null>(null);
  const [treasury, setTreasury]   = useState<TreasuryStats | null>(null);
  const [raids, setRaids]         = useState<RaidRow[]>([]);
  const [users, setUsers]         = useState<UserRow[]>([]);
  const [claims, setClaims]       = useState<ClaimRow[]>([]);
  const [winners, setWinners]     = useState<WinnerRow[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestionRow[]>([]);
  const [loading, setLoading]     = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [finalizing, setFinalizing]     = useState(false);
  const [finalizeMsg, setFinalizeMsg]   = useState<string | null>(null);
  const [raidFilter, setRaidFilter]     = useState<'ALL' | 'WIN' | 'BUST'>('ALL');
  const [userSort, setUserSort]         = useState<'SR' | 'DATE'>('DATE');

  // Push compose state
  const [pushTarget, setPushTarget]   = useState<'ALL' | 'WALLET'>('ALL');
  const [pushWallet, setPushWallet]   = useState('');
  const [pushTitle, setPushTitle]     = useState('');
  const [pushBody, setPushBody]       = useState('');
  const [pushUrl, setPushUrl]         = useState('/');
  const [pushSending, setPushSending] = useState(false);
  const [pushResult, setPushResult]   = useState<{ ok: boolean; msg: string } | null>(null);

  const load = useCallback(async (t: Tab) => {
    setLoading(true);
    try {
      if (t === 'OVERVIEW') {
        const [usersRes, raidsRes, bountiesRes, profilesRes] = await Promise.all([
          supabase.from('profiles').select('sr_points, unclaimed_sol', { count: 'exact' }),
          supabase.from('raid_history').select('sol_amount, success', { count: 'exact' }),
          supabase.from('bounties').select('id', { count: 'exact' }).eq('status', 'OPEN').gt('expires_at', new Date().toISOString()),
          supabase.from('profiles').select('sr_points'),
        ]);
        const totalWins = (raidsRes.data ?? []).filter((r: { success: boolean }) => r.success).length;
        setOverview({
          totalUsers:     usersRes.count ?? 0,
          totalRaids:     raidsRes.count ?? 0,
          totalWins,
          totalSolWagered: (raidsRes.data ?? []).reduce((s: number, r: { sol_amount: number }) => s + Number(r.sol_amount), 0),
          totalSR:         (profilesRes.data ?? []).reduce((s: number, p: { sr_points: number }) => s + Number(p.sr_points), 0),
          openBounties:    bountiesRes.count ?? 0,
        });
      }
      if (t === 'RAIDS') {
        const { data } = await supabase.from('raid_history').select('*').order('created_at', { ascending: false }).limit(200);
        setRaids((data ?? []) as RaidRow[]);
      }
      if (t === 'USERS') {
        const { data } = await supabase.from('profiles').select('wallet_address, username, sr_points, unclaimed_sol, raid_tickets, created_at').order('created_at', { ascending: false }).limit(200);
        setUsers((data ?? []) as UserRow[]);
      }
      if (t === 'CLAIMS') {
        const { data } = await supabase.from('social_claims').select('*').order('created_at', { ascending: false }).limit(300);
        setClaims((data ?? []) as ClaimRow[]);
      }
      if (t === 'ROUNDS') {
        const { data } = await supabase.from('round_winners').select('*').order('round_date', { ascending: false }).order('rank').limit(100);
        setWinners((data ?? []) as WinnerRow[]);
      }
      if (t === 'FEEDBACK') {
        const { data } = await supabase.from('suggestions').select('*').order('created_at', { ascending: false }).limit(500);
        setSuggestions((data ?? []) as SuggestionRow[]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const now      = new Date();
      const todayStr = now.toISOString().slice(0, 10);
      const weekAgo  = new Date(now.getTime() - 7 * 86400_000).toISOString();

      const [
        solBal, usdcBal, skrBal,
        unclaimedRes, paidRes,
        allRaidsRes, todayRaidsRes, weekRaidsRes,
        claimTypesRes,
      ] = await Promise.all([
        TREASURY ? fetchSolBalance(TREASURY).catch(() => null) : Promise.resolve(null),
        TREASURY ? fetchTokenBalance(TREASURY, USDC_MINT).catch(() => null) : Promise.resolve(null),
        TREASURY ? fetchTokenBalance(TREASURY, SKR_MINT).catch(() => null) : Promise.resolve(null),
        supabase.from('profiles').select('unclaimed_sol'),
        supabase.from('withdrawals').select('amount_sol').eq('status', 'CONFIRMED'),
        supabase.from('raid_history').select('difficulty, success'),
        supabase.from('raid_history').select('raid_id', { count: 'exact' }).gte('created_at', `${todayStr}T00:00:00Z`),
        supabase.from('raid_history').select('raid_id', { count: 'exact' }).gte('created_at', weekAgo),
        supabase.from('social_claims').select('action_type, reward_sr'),
      ]);

      const totalUnclaimed = (unclaimedRes.data ?? []).reduce((s: number, p: { unclaimed_sol: number }) => s + Number(p.unclaimed_sol), 0);
      const totalPaidOut   = (paidRes.data ?? []).reduce((s: number, w: { amount_sol: number }) => s + Number(w.amount_sol), 0);

      // Group raids by difficulty
      const diffMap: Record<string, { total: number; wins: number }> = {};
      for (const r of (allRaidsRes.data ?? []) as { difficulty: string; success: boolean }[]) {
        if (!diffMap[r.difficulty]) diffMap[r.difficulty] = { total: 0, wins: 0 };
        diffMap[r.difficulty].total++;
        if (r.success) diffMap[r.difficulty].wins++;
      }
      const byDifficulty = ['EASY', 'MEDIUM', 'HARD', 'DEGEN']
        .filter(d => diffMap[d])
        .map(d => ({ difficulty: d, ...diffMap[d] }));

      // Group claims by action type
      const typeMap: Record<string, { count: number; total_sr: number }> = {};
      for (const c of (claimTypesRes.data ?? []) as { action_type: string; reward_sr: number }[]) {
        if (!typeMap[c.action_type]) typeMap[c.action_type] = { count: 0, total_sr: 0 };
        typeMap[c.action_type].count++;
        typeMap[c.action_type].total_sr += Number(c.reward_sr);
      }
      const byClaimType = Object.entries(typeMap)
        .map(([action_type, v]) => ({ action_type, ...v }))
        .sort((a, b) => b.count - a.count);

      setTreasury({
        solBalance:  solBal,
        usdcBalance: usdcBal,
        skrBalance:  skrBal,
        totalUnclaimed,
        totalPaidOut,
        todayRaids:  todayRaidsRes.count ?? 0,
        weekRaids:   weekRaidsRes.count ?? 0,
        byDifficulty,
        byClaimType,
      });
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'STATS') loadStats();
    else load(tab);
  }, [tab, load, loadStats]);

  const handleFinalizeRound = async () => {
    setFinalizing(true);
    setFinalizeMsg(null);
    try {
      const now = new Date();
      const roundNum  = Math.floor(now.getUTCHours() / 6) + 1;
      const roundDate = now.toISOString().slice(0, 10);
      const { data, error } = await supabase.functions.invoke('finalize-round', {
        body: { round_number: roundNum, round_date: roundDate },
      });
      if (error || data?.error) setFinalizeMsg(`Error: ${data?.error ?? error?.message ?? 'Unknown'}`);
      else { setFinalizeMsg(`R${roundNum} finalized — ${data?.winners_inserted ?? 0} winners recorded`); load('ROUNDS'); }
    } catch (e) {
      setFinalizeMsg(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally { setFinalizing(false); }
  };

  const handleSendPush = async () => {
    if (!pushTitle.trim()) return;
    if (pushTarget === 'WALLET' && !pushWallet.trim()) return;
    setPushSending(true);
    setPushResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('send-push', {
        body: {
          wallet_address: pushTarget === 'ALL' ? 'ALL' : pushWallet.trim(),
          title: pushTitle.trim(),
          body: pushBody.trim(),
          url: pushUrl.trim() || '/',
        },
      });
      if (error || data?.error) {
        setPushResult({ ok: false, msg: `Error: ${data?.error ?? error?.message ?? 'Unknown'}` });
      } else {
        setPushResult({ ok: true, msg: `Sent to ${data?.sent ?? 0} device${data?.sent !== 1 ? 's' : ''}` });
        setPushTitle(''); setPushBody(''); setPushWallet(''); setPushUrl('/');
      }
    } catch (e) {
      setPushResult({ ok: false, msg: `Error: ${e instanceof Error ? e.message : String(e)}` });
    } finally { setPushSending(false); }
  };

  const filteredRaids = raidFilter === 'ALL' ? raids
    : raidFilter === 'WIN' ? raids.filter(r => r.success)
    : raids.filter(r => !r.success);

  const sortedUsers = userSort === 'DATE'
    ? [...users].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    : [...users].sort((a, b) => Number(b.sr_points) - Number(a.sr_points));

  const TABS: Tab[] = ['OVERVIEW', 'STATS', 'RAIDS', 'USERS', 'CLAIMS', 'ROUNDS', 'FEEDBACK', 'PUSH'];

  const diffColor = (d: string) =>
    d === 'DEGEN' ? 'text-[#9945FF]' : d === 'HARD' ? 'text-orange-400' : d === 'MEDIUM' ? 'text-cyan-400' : 'text-green-400';

  return (
    <div className="h-full text-white flex flex-col" style={{ backgroundColor: 'var(--app-bg)' }}>
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div>
          <h1 className="text-sm font-black uppercase tracking-widest text-[#9945FF]">RUSHTIK</h1>
          <p className="text-[9px] text-white uppercase tracking-wider">SolRaid Admin Panel</p>
        </div>
        <button onClick={onLogout}
          className="text-[10px] text-white hover:text-white font-bold uppercase tracking-wider transition-colors">
          Logout
        </button>
      </div>

      {/* Tabs */}
      <div className="shrink-0 flex gap-1 px-4 pt-3 overflow-x-auto pb-1">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all shrink-0 ${
              tab === t ? 'bg-[#9945FF]/20 text-[#9945FF] border border-[#9945FF]/40' : 'text-white border border-transparent'
            }`}>
            {t}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">

        {/* ── Loading spinner ── */}
        {(loading || (tab === 'STATS' && statsLoading)) && (
          <div className="flex items-center justify-center py-20">
            <p className="text-white text-xs animate-pulse">Loading...</p>
          </div>
        )}

        {/* ── OVERVIEW ── */}
        {!loading && tab === 'OVERVIEW' && overview && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <Stat label="Total Users"   value={overview.totalUsers.toLocaleString()} />
              <Stat label="Total Raids"   value={overview.totalRaids.toLocaleString()} />
              <Stat label="Win Rate"      value={`${overview.totalRaids > 0 ? ((overview.totalWins / overview.totalRaids) * 100).toFixed(1) : 0}%`} color="text-[#FFB800]" />
              <Stat label="SOL Wagered"   value={`${overview.totalSolWagered.toFixed(3)}`} sub="SOL (all raids)" color="text-[#FFB800]" />
              <Stat label="Total SR"      value={overview.totalSR.toLocaleString()} color="text-white" />
              <Stat label="Open Bounties" value={overview.openBounties} color="text-[#9945FF]" />
            </div>

            <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-4">
              <p className="text-[9px] text-white uppercase tracking-widest mb-3">Quick Actions</p>
              <div className="flex flex-col gap-2">
                <button onClick={handleFinalizeRound} disabled={finalizing}
                  className="w-full py-2.5 rounded-xl bg-[#9945FF]/90 text-white font-black text-xs uppercase tracking-wider disabled:opacity-50 active:scale-95 transition-all">
                  {finalizing ? 'Finalizing...' : 'Finalize Current Round'}
                </button>
                <button onClick={() => load(tab)}
                  className="w-full py-2 rounded-xl border border-white/10 text-white font-bold text-xs uppercase tracking-wider active:scale-95 transition-all">
                  Refresh Data
                </button>
              </div>
              {finalizeMsg && (
                <p className={`text-[10px] font-bold mt-2 ${finalizeMsg.startsWith('Error') ? 'text-[#9945FF]' : 'text-[#14F195]'}`}>{finalizeMsg}</p>
              )}
            </div>
          </div>
        )}

        {/* ── STATS ── */}
        {!statsLoading && tab === 'STATS' && treasury && (
          <div className="flex flex-col gap-5">

            {/* Treasury balances */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[9px] text-[#FFB800]/70 uppercase tracking-widest font-bold">Treasury Wallet</p>
                <div className="flex items-center gap-2">
                  {TREASURY && (
                    <span className="flex items-center gap-1 text-[9px] font-mono text-white">
                      {TREASURY.slice(0, 6)}…{TREASURY.slice(-4)}
                      <CopyBtn text={TREASURY} />
                    </span>
                  )}
                  <button onClick={loadStats}
                    className="text-[9px] text-white hover:text-white font-bold uppercase tracking-wider transition-colors">
                    <i className="fa-solid fa-rotate-right text-[9px]" /> Refresh
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Stat label="SOL Balance"
                  value={treasury.solBalance !== null ? `${treasury.solBalance.toFixed(4)}` : '—'}
                  sub="SOL" color="text-[#FFB800]" />
                <Stat label="USDC Balance"
                  value={treasury.usdcBalance !== null ? `$${treasury.usdcBalance.toFixed(2)}` : '—'}
                  sub="USDC" color="text-green-400" />
                <Stat label="SKR Balance"
                  value={treasury.skrBalance !== null ? Math.floor(treasury.skrBalance).toLocaleString() : '—'}
                  sub="SKR" color="text-white" />
              </div>
            </div>

            {/* Financial flow */}
            <div>
              <p className="text-[9px] text-white uppercase tracking-widest font-bold mb-2">Financial Flow</p>
              <div className="grid grid-cols-2 gap-2">
                <Stat label="Total Unclaimed (all users)" value={`${treasury.totalUnclaimed.toFixed(4)}`} sub="SOL owed to players" color="text-[#9945FF]" />
                <Stat label="Total Paid Out" value={`${treasury.totalPaidOut.toFixed(4)}`} sub="SOL withdrawn (all time)" color="text-[#14F195]" />
              </div>
            </div>

            {/* Activity */}
            <div>
              <p className="text-[9px] text-white uppercase tracking-widest font-bold mb-2">Raid Activity</p>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <Stat label="Today's Raids"      value={treasury.todayRaids} color="text-white" />
                <Stat label="Last 7 Days Raids"  value={treasury.weekRaids}  color="text-white" />
              </div>
              {/* By difficulty */}
              <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl overflow-hidden">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      <th className="text-left px-3 py-2 text-white font-bold uppercase tracking-wider">Difficulty</th>
                      <th className="text-right px-3 py-2 text-white font-bold uppercase tracking-wider">Raids</th>
                      <th className="text-right px-3 py-2 text-white font-bold uppercase tracking-wider">Wins</th>
                      <th className="text-right px-3 py-2 text-white font-bold uppercase tracking-wider">Win %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {treasury.byDifficulty.map(d => (
                      <tr key={d.difficulty} className="border-b border-white/[0.04]">
                        <td className={`px-3 py-1.5 font-black ${diffColor(d.difficulty)}`}>{d.difficulty}</td>
                        <td className="px-3 py-1.5 text-right text-white">{d.total.toLocaleString()}</td>
                        <td className="px-3 py-1.5 text-right text-[#14F195]">{d.wins.toLocaleString()}</td>
                        <td className="px-3 py-1.5 text-right text-[#FFB800] font-bold">
                          {d.total > 0 ? ((d.wins / d.total) * 100).toFixed(1) : 0}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Claims breakdown */}
            <div>
              <p className="text-[9px] text-white uppercase tracking-widest font-bold mb-2">Bounty / Social Claims</p>
              <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl overflow-hidden">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      <th className="text-left px-3 py-2 text-white font-bold uppercase tracking-wider">Action Type</th>
                      <th className="text-right px-3 py-2 text-white font-bold uppercase tracking-wider">Claims</th>
                      <th className="text-right px-3 py-2 text-white font-bold uppercase tracking-wider">Total SR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {treasury.byClaimType.map(c => (
                      <tr key={c.action_type} className="border-b border-white/[0.04]">
                        <td className={`px-3 py-1.5 font-bold ${c.action_type.startsWith('PASS_DISC') ? 'text-[#FFB800]' : c.action_type.startsWith('CHALLENGE') ? 'text-cyan-400' : 'text-white'}`}>
                          {c.action_type}
                        </td>
                        <td className="px-3 py-1.5 text-right text-white">{c.count}</td>
                        <td className="px-3 py-1.5 text-right text-[#14F195] font-bold">+{c.total_sr.toLocaleString()}</td>
                      </tr>
                    ))}
                    {treasury.byClaimType.length === 0 && (
                      <tr><td colSpan={3} className="px-3 py-4 text-center text-white">No claims yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── RAIDS ── */}
        {!loading && tab === 'RAIDS' && (
          <div className="flex flex-col gap-3">
            <div className="flex gap-1.5">
              {(['ALL', 'WIN', 'BUST'] as const).map(f => (
                <button key={f} onClick={() => setRaidFilter(f)}
                  className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase border transition-all ${
                    raidFilter === f ? 'border-[#9945FF]/50 text-[#9945FF] bg-[#9945FF]/10' : 'border-white/10 text-white'
                  }`}>
                  {f}{f !== 'ALL' && ` (${f === 'WIN' ? raids.filter(r => r.success).length : raids.filter(r => !r.success).length})`}
                </button>
              ))}
              <span className="ml-auto text-[9px] text-white self-center">{filteredRaids.length} raids</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[10px] border-collapse">
                <thead>
                  <tr className="text-white border-b border-white/[0.06]">
                    <th className="text-left py-2 pr-3 font-bold uppercase tracking-wider">Wallet</th>
                    <th className="text-left py-2 pr-3 font-bold uppercase tracking-wider">Diff</th>
                    <th className="text-left py-2 pr-3 font-bold uppercase tracking-wider">Result</th>
                    <th className="text-right py-2 pr-3 font-bold uppercase tracking-wider">Pts</th>
                    <th className="text-right py-2 pr-3 font-bold uppercase tracking-wider">SOL</th>
                    <th className="text-right py-2 font-bold uppercase tracking-wider">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRaids.map(r => (
                    <tr key={r.raid_id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                      <WalletCell address={r.wallet_address} />
                      <td className="py-1.5 pr-3"><span className={`font-bold ${diffColor(r.difficulty)}`}>{r.difficulty}</span></td>
                      <td className="py-1.5 pr-3"><span className={`font-black ${r.success ? 'text-[#14F195]' : 'text-[#9945FF]/70'}`}>{r.success ? 'WIN' : 'BUST'}</span></td>
                      <td className="py-1.5 pr-3 text-right font-mono text-white">{r.points.toLocaleString()}</td>
                      <td className="py-1.5 pr-3 text-right font-mono text-[#FFB800]">{Number(r.sol_amount).toFixed(4)}</td>
                      <td className="py-1.5 text-right text-white">{new Date(r.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── USERS ── */}
        {!loading && tab === 'USERS' && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-[9px] text-white">{users.length} users</p>
              <div className="flex gap-1">
                {(['DATE', 'SR'] as const).map(s => (
                  <button key={s} onClick={() => setUserSort(s)}
                    className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase border transition-all ${
                      userSort === s ? 'border-[#9945FF]/50 text-[#9945FF] bg-[#9945FF]/10' : 'border-white/10 text-white'
                    }`}>
                    {s === 'DATE' ? 'Newest first' : 'Top SR'}
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[10px] border-collapse">
                <thead>
                  <tr className="text-white border-b border-white/[0.06]">
                    <th className="text-left py-2 pr-3 font-bold uppercase tracking-wider">Wallet</th>
                    <th className="text-left py-2 pr-3 font-bold uppercase tracking-wider">Username</th>
                    <th className="text-right py-2 pr-3 font-bold uppercase tracking-wider">SR</th>
                    <th className="text-right py-2 pr-3 font-bold uppercase tracking-wider">Unclaimed SOL</th>
                    <th className="text-right py-2 pr-3 font-bold uppercase tracking-wider">Tickets</th>
                    <th className="text-right py-2 font-bold uppercase tracking-wider">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedUsers.map(u => (
                    <tr key={u.wallet_address} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                      <WalletCell address={u.wallet_address} />
                      <td className="py-1.5 pr-3 text-white">{u.username || <span className="text-white">—</span>}</td>
                      <td className="py-1.5 pr-3 text-right font-bold text-[#FFB800]">{Number(u.sr_points).toLocaleString()}</td>
                      <td className="py-1.5 pr-3 text-right font-mono text-white">{Number(u.unclaimed_sol).toFixed(4)}</td>
                      <td className="py-1.5 pr-3 text-right text-white">{u.raid_tickets}</td>
                      <td className="py-1.5 text-right text-white">{new Date(u.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── CLAIMS ── */}
        {!loading && tab === 'CLAIMS' && (
          <div className="overflow-x-auto">
            <p className="text-[9px] text-white mb-2">{claims.length} claims</p>
            <table className="w-full text-[10px] border-collapse">
              <thead>
                <tr className="text-white border-b border-white/[0.06]">
                  <th className="text-left py-2 pr-3 font-bold uppercase tracking-wider">Wallet</th>
                  <th className="text-left py-2 pr-3 font-bold uppercase tracking-wider">Action</th>
                  <th className="text-right py-2 pr-3 font-bold uppercase tracking-wider">SR</th>
                  <th className="text-left py-2 pr-3 font-bold uppercase tracking-wider">Handle / URL</th>
                  <th className="text-right py-2 font-bold uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody>
                {claims.map(c => (
                  <tr key={c.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                    <WalletCell address={c.wallet_address} />
                    <td className="py-1.5 pr-3">
                      <span className={`font-bold ${c.action_type.startsWith('PASS_DISC') ? 'text-[#FFB800]' : c.action_type.startsWith('CHALLENGE') ? 'text-cyan-400' : 'text-white'}`}>
                        {c.action_type}
                      </span>
                    </td>
                    <td className="py-1.5 pr-3 text-right text-[#14F195] font-bold">+{c.reward_sr}</td>
                    <td className="py-1.5 pr-3 text-white max-w-[160px] truncate">{c.twitter_handle ?? '—'}</td>
                    <td className="py-1.5 text-right text-white">{new Date(c.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── FEEDBACK ── */}
        {!loading && tab === 'FEEDBACK' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <p className="text-[9px] text-white">{suggestions.length} suggestion{suggestions.length !== 1 ? 's' : ''}</p>
              <button onClick={() => load('FEEDBACK')}
                className="text-[9px] text-white hover:text-white font-bold uppercase tracking-wider transition-colors">
                <i className="fa-solid fa-rotate-right text-[9px]" /> Refresh
              </button>
            </div>
            {suggestions.length === 0 ? (
              <p className="text-center text-white text-xs py-16">No suggestions yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {suggestions.map(s => (
                  <div key={s.id} className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5"
                        style={{
                          background: 'rgba(153,69,255,0.10)',
                          border: '1px solid rgba(153,69,255,0.25)',
                          color: '#9945FF',
                        }}
                      >
                        {s.category}
                      </span>
                      <span className="text-[9px] text-white font-mono">
                        {new Date(s.created_at).toLocaleDateString()} {new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-[13px] text-white leading-relaxed mb-2">{s.suggestion_text}</p>
                    {s.wallet_address ? (
                      <span className="flex items-center gap-1 text-[9px] font-mono text-white">
                        {s.wallet_address.slice(0, 6)}…{s.wallet_address.slice(-4)}
                        <CopyBtn text={s.wallet_address} />
                      </span>
                    ) : (
                      <span className="text-[9px] text-white italic">anonymous</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── PUSH ── */}
        {!loading && tab === 'PUSH' && (
          <div className="flex flex-col gap-4 max-w-lg">
            <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-4 flex flex-col gap-4">
              <p className="text-[9px] text-white uppercase tracking-widest font-bold">Compose Push Notification</p>

              {/* Target */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] text-white uppercase tracking-wider">Target</label>
                <div className="flex gap-1.5">
                  {(['ALL', 'WALLET'] as const).map(t => (
                    <button key={t} onClick={() => setPushTarget(t)}
                      className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase border transition-all ${
                        pushTarget === t ? 'border-[#9945FF]/50 text-[#9945FF] bg-[#9945FF]/10' : 'border-white/10 text-white'
                      }`}>
                      {t === 'ALL' ? 'All subscribers' : 'Specific wallet'}
                    </button>
                  ))}
                </div>
                {pushTarget === 'WALLET' && (
                  <input
                    value={pushWallet}
                    onChange={e => setPushWallet(e.target.value)}
                    placeholder="Wallet address (base58)"
                    className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-[11px] font-mono text-white placeholder:text-white/30 focus:outline-none focus:border-[#9945FF]/50"
                  />
                )}
              </div>

              {/* Title */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] text-white uppercase tracking-wider">Title <span className="text-[#9945FF]">*</span></label>
                <input
                  value={pushTitle}
                  onChange={e => setPushTitle(e.target.value)}
                  placeholder="e.g. Round Competition Starting!"
                  maxLength={80}
                  className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-[12px] text-white placeholder:text-white/30 focus:outline-none focus:border-[#9945FF]/50"
                />
              </div>

              {/* Body */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] text-white uppercase tracking-wider">Message</label>
                <textarea
                  value={pushBody}
                  onChange={e => setPushBody(e.target.value)}
                  placeholder="Notification body text…"
                  rows={3}
                  maxLength={200}
                  className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-[12px] text-white placeholder:text-white/30 focus:outline-none focus:border-[#9945FF]/50 resize-none"
                />
              </div>

              {/* URL */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] text-white uppercase tracking-wider">Deep link URL</label>
                <input
                  value={pushUrl}
                  onChange={e => setPushUrl(e.target.value)}
                  placeholder="/ (default) or /?screen=raid"
                  className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-[11px] font-mono text-white placeholder:text-white/30 focus:outline-none focus:border-[#9945FF]/50"
                />
              </div>

              <button
                onClick={handleSendPush}
                disabled={pushSending || !pushTitle.trim() || (pushTarget === 'WALLET' && !pushWallet.trim())}
                className="w-full py-3 rounded-xl bg-[#9945FF] text-white font-black text-xs uppercase tracking-wider disabled:opacity-40 active:scale-95 transition-all"
              >
                {pushSending
                  ? 'Sending...'
                  : pushTarget === 'ALL'
                    ? 'Broadcast to all subscribers'
                    : 'Send to wallet'}
              </button>

              {pushResult && (
                <p className={`text-[11px] font-bold text-center ${pushResult.ok ? 'text-[#14F195]' : 'text-[#9945FF]'}`}>
                  {pushResult.ok ? <><i className="fa-solid fa-check mr-1" />{pushResult.msg}</> : pushResult.msg}
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── ROUNDS ── */}
        {!loading && tab === 'ROUNDS' && (
          <div className="flex flex-col gap-4">
            <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-4">
              <p className="text-[9px] text-white uppercase tracking-widest mb-2">Finalize Round</p>
              <p className="text-[10px] text-white mb-3">
                Manually finalize the current active round. Only run after a round ends (every 6h UTC). Idempotent — safe to re-run.
              </p>
              <button onClick={handleFinalizeRound} disabled={finalizing}
                className="w-full py-2.5 rounded-xl bg-[#9945FF]/90 text-white font-black text-xs uppercase tracking-wider disabled:opacity-50 active:scale-95 transition-all">
                {finalizing ? 'Finalizing...' : 'Finalize Current Round'}
              </button>
              {finalizeMsg && (
                <p className={`text-[10px] font-bold mt-2 ${finalizeMsg.startsWith('Error') ? 'text-[#9945FF]' : 'text-[#14F195]'}`}>{finalizeMsg}</p>
              )}
            </div>

            <div className="overflow-x-auto">
              <p className="text-[9px] text-white mb-2">{winners.length} winner records</p>
              <table className="w-full text-[10px] border-collapse">
                <thead>
                  <tr className="text-white border-b border-white/[0.06]">
                    <th className="text-left py-2 pr-3 font-bold uppercase tracking-wider">Round</th>
                    <th className="text-left py-2 pr-3 font-bold uppercase tracking-wider">Date</th>
                    <th className="text-center py-2 pr-3 font-bold uppercase tracking-wider">Rank</th>
                    <th className="text-left py-2 pr-3 font-bold uppercase tracking-wider">Wallet</th>
                    <th className="text-right py-2 pr-3 font-bold uppercase tracking-wider">Prize</th>
                    <th className="text-center py-2 font-bold uppercase tracking-wider">Claimed</th>
                  </tr>
                </thead>
                <tbody>
                  {winners.map(w => (
                    <tr key={w.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                      <td className="py-1.5 pr-3 font-bold text-[#9945FF]">R{w.round_number}</td>
                      <td className="py-1.5 pr-3 text-white">{w.round_date}</td>
                      <td className="py-1.5 pr-3 text-center">
                        <span className={`font-black ${w.rank === 1 ? 'text-[#FFB800]' : w.rank === 2 ? 'text-white' : 'text-white'}`}>#{w.rank}</span>
                      </td>
                      <WalletCell address={w.wallet_address} />
                      <td className="py-1.5 pr-3 text-right font-bold text-[#FFB800]">{Number(w.prize_sol).toFixed(4)} SOL</td>
                      <td className="py-1.5 text-center">
                        <span className={w.claimed ? 'text-[#14F195] font-bold' : 'text-white'}>{w.claimed ? '✓' : '—'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Root export ───────────────────────────────────────────────────────────────
const AdminScreen: React.FC = () => {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem(SESSION_KEY) === '1');
  const logout = () => { sessionStorage.removeItem(SESSION_KEY); setAuthed(false); };
  if (!authed) return <PasswordGate onAuth={() => setAuthed(true)} />;
  return <Dashboard onLogout={logout} />;
};

export default AdminScreen;
