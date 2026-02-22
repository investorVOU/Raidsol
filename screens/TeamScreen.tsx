
import React, { useState } from 'react';
import { ENTRY_FEES, Mode, Currency, CURRENCY_RATES } from '../types';
import type { LivePrices } from '../hooks/usePrices';

interface TeamScreenProps {
  onStartRaid: (currency: Currency) => void;
  username?: string;
  walletAddress?: string | null;
  walletBalance?: number;
  usdcBalance?: number;
  skrBalance?: number;
  currencyRates?: LivePrices['currencyRates'];
}

const SQUAD_FEE_SOL = ENTRY_FEES[Mode.TEAM];

const ROLES = ['Breacher', 'Support', 'Recon', 'Medic'] as const;
type Role = typeof ROLES[number];

const ROLE_META: Record<Role, { color: string; desc: string }> = {
  Breacher: { color: 'text-orange-400 border-orange-500/40 bg-orange-500/10', desc: 'High offense · +10% attack dmg' },
  Support:  { color: 'text-cyan-400 border-cyan-500/40 bg-cyan-500/10',       desc: 'Shared shield · Defends 2×' },
  Recon:    { color: 'text-purple-400 border-purple-500/40 bg-purple-500/10', desc: 'Reveals spikes 1s early' },
  Medic:    { color: 'text-green-400 border-green-500/40 bg-green-500/10',    desc: 'Team risk reduction −5%' },
};

const CURRENCY_META: Record<Currency, { label: string; color: string; decimals: number }> = {
  [Currency.SOL]:  { label: 'SOL',  color: 'border-[#14F195] text-[#14F195]', decimals: 3 },
  [Currency.USDC]: { label: 'USDC', color: 'border-blue-400 text-blue-400',   decimals: 2 },
  [Currency.SKR]:  { label: 'SKR',  color: 'border-orange-400 text-orange-400', decimals: 0 },
};

const TeamScreen: React.FC<TeamScreenProps> = ({
  onStartRaid,
  username,
  walletAddress,
  walletBalance = 0,
  usdcBalance = 0,
  skrBalance = 0,
  currencyRates,
}) => {
  const rates = currencyRates ?? { [Currency.SOL]: 1, [Currency.USDC]: 0, [Currency.SKR]: 0 };
  const [selectedRole, setSelectedRole] = useState<Role>('Breacher');
  const [currency, setCurrency] = useState<Currency>(Currency.SOL);

  const shortAddr = walletAddress
    ? `${walletAddress.slice(0, 4)}…${walletAddress.slice(-4)}`
    : null;

  const isConnected = !!walletAddress;

  const balances: Record<Currency, number> = {
    [Currency.SOL]:  walletBalance,
    [Currency.USDC]: usdcBalance,
    [Currency.SKR]:  skrBalance,
  };

  const fee = SQUAD_FEE_SOL * rates[currency];
  const pricesLoading = currency !== Currency.SOL && rates[currency] === 0;
  const balance = balances[currency];
  const canAfford = !pricesLoading && balance >= fee;
  const meta = CURRENCY_META[currency];

  return (
    <div className="h-full flex flex-col animate-in slide-in-from-right duration-300 overflow-hidden">

      {/* ── HEADER ── */}
      <div className="shrink-0 px-5 pt-5 pb-4 border-b border-white/8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tight text-white">
              Squad Ops
            </h2>
            <p className="text-xs text-white/50 mt-0.5">Co-op raid · 4-player unit</p>
          </div>
          <div className="flex items-center gap-1.5 bg-cyan-500/10 border border-cyan-500/25 px-2.5 py-1">
            <span className="text-sm font-black text-cyan-400 mono">1</span>
            <span className="text-[10px] text-cyan-400/60">/4</span>
          </div>
        </div>
      </div>

      {/* ── SCROLL BODY ── */}
      <div className="flex-1 overflow-y-auto scrollbar-hide px-5 py-4 pb-36 space-y-5">

        {/* ─── SQUAD ROSTER ─── */}
        <div>
          <p className="text-[10px] font-semibold text-white/40 uppercase tracking-widest mb-2.5">Roster</p>
          <div className="space-y-2">

            {/* YOU */}
            <div className="bg-black border border-cyan-500/25 p-3.5 flex items-center gap-3.5 relative overflow-hidden">
              <div className="absolute inset-0 bg-cyan-500/3 pointer-events-none" />
              <div className="shrink-0 w-10 h-10 rounded-full bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center">
                <span className="text-base font-black text-cyan-300 uppercase">
                  {username?.[0] ?? '?'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-sm text-white leading-none truncate">
                    {username || 'Operator'}
                  </p>
                  <span className="text-[8px] font-bold bg-cyan-400/15 text-cyan-400 border border-cyan-400/30 px-1.5 py-0.5 uppercase tracking-wider">
                    you
                  </span>
                  <span className="text-[8px] font-bold bg-yellow-400/10 text-yellow-400 border border-yellow-400/20 px-1.5 py-0.5 uppercase tracking-wider">
                    host
                  </span>
                </div>
                {shortAddr && (
                  <p className="text-[10px] font-mono text-white/40 mt-0.5 truncate">{shortAddr}</p>
                )}
              </div>
              <div className={`shrink-0 text-[9px] font-bold uppercase border px-2 py-1 ${ROLE_META[selectedRole].color}`}>
                {selectedRole}
              </div>
            </div>

            {/* Open slots */}
            {[2, 3, 4].map(n => (
              <div key={n} className="border border-dashed border-white/10 p-3.5 flex items-center gap-3.5">
                <div className="shrink-0 w-10 h-10 rounded-full bg-white/3 border border-dashed border-white/10 flex items-center justify-center">
                  <span className="text-white/20 text-lg">+</span>
                </div>
                <div className="flex-1">
                  <p className="text-xs text-white/30">Waiting for player…</p>
                  <p className="text-[9px] mono text-white/15 mt-0.5">Slot {n}</p>
                </div>
                <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
              </div>
            ))}
          </div>
        </div>

        {/* ─── ROLE SELECTION ─── */}
        <div>
          <p className="text-[10px] font-semibold text-white/40 uppercase tracking-widest mb-2.5">Your role</p>
          <div className="grid grid-cols-2 gap-2">
            {ROLES.map(role => (
              <button
                key={role}
                onClick={() => setSelectedRole(role)}
                className={`p-3 border text-left transition-all ${
                  selectedRole === role
                    ? ROLE_META[role].color
                    : 'bg-black border-white/10 hover:border-white/20'
                }`}
              >
                <p className={`text-xs font-bold uppercase tracking-wide ${selectedRole === role ? '' : 'text-white/50'}`}>
                  {role}
                </p>
                <p className="text-[9px] text-white/40 mt-0.5">{ROLE_META[role].desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* ─── ENTRY INFO ─── */}
        <div className="bg-black border border-white/8 p-4 space-y-3">
          <p className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">Raid info</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[9px] text-white/40 uppercase tracking-wider mb-0.5">Entry fee</p>
              <p className="mono font-bold text-white text-sm">
                {pricesLoading
                  ? <span className="text-white/40 text-xs animate-pulse">FETCHING…</span>
                  : <>{fee % 1 === 0 ? fee.toFixed(0) : fee.toFixed(meta.decimals === 0 ? 0 : meta.decimals)}{' '}<span className="text-white/50 text-xs">{meta.label}</span></>
                }
              </p>
            </div>
            <div>
              <p className="text-[9px] text-white/40 uppercase tracking-wider mb-0.5">Payout</p>
              <p className="mono font-bold text-white text-sm">Equal split</p>
            </div>
            <div>
              <p className="text-[9px] text-white/40 uppercase tracking-wider mb-0.5">Bust penalty</p>
              <p className="mono font-bold text-red-400 text-sm">−25% pool</p>
            </div>
            <div>
              <p className="text-[9px] text-white/40 uppercase tracking-wider mb-0.5">Squad bonus</p>
              <p className="mono font-bold text-cyan-400 text-sm">+1.25× pool</p>
            </div>
          </div>
        </div>

        {/* ─── COMING SOON ─── */}
        <div className="flex items-center gap-2.5 px-3 py-2.5 border border-white/8 bg-white/3">
          <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse shrink-0" />
          <div>
            <p className="text-[10px] font-semibold text-yellow-400 uppercase tracking-wider">Matchmaking coming soon</p>
            <p className="text-[9px] text-white/40 mt-0.5">Share code · Invite direct · Auto-match queue</p>
          </div>
        </div>

      </div>

      {/* ── FOOTER ── footer needs pb-16 on mobile to clear fixed nav bar */}
      <div className="shrink-0 px-5 py-4 pb-20 sm:pb-4 border-t border-white/8 bg-black space-y-3">

        {/* Currency selector */}
        <div>
          <p className="text-[9px] text-white/40 uppercase tracking-wider mb-1.5">Pay with</p>
          <div className="grid grid-cols-3 gap-1.5">
            {([Currency.SOL, Currency.USDC, Currency.SKR] as Currency[]).map(c => {
              const m = CURRENCY_META[c];
              const bal = balances[c];
              const f = SQUAD_FEE_SOL * rates[c];
              const ok = bal >= f;
              const active = currency === c;
              return (
                <button
                  key={c}
                  onClick={() => setCurrency(c)}
                  className={`py-2 border text-center transition-all ${
                    active ? `${m.color} bg-white/5` : 'border-white/10 text-white/40 hover:border-white/20'
                  }`}
                >
                  <p className="text-[10px] font-bold uppercase">{m.label}</p>
                  <p className={`text-[9px] mono mt-0.5 ${ok ? 'text-white/50' : 'text-red-400/60'}`}>
                    {bal.toFixed(c === Currency.SKR ? 0 : 2)}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {!isConnected && (
          <p className="text-center text-[10px] text-red-400/70 font-semibold uppercase tracking-wider">
            Connect wallet to deploy
          </p>
        )}

        <button
          onClick={() => onStartRaid(currency)}
          disabled={!isConnected || !canAfford}
          className={`w-full py-4 font-bold uppercase tracking-wide text-base transition-all flex items-center justify-center gap-2 ${
            isConnected && canAfford
              ? 'bg-cyan-500 text-black active:scale-[0.98] shadow-[0_0_20px_rgba(6,182,212,0.2)]'
              : 'bg-white/5 border border-white/5 text-white/25 cursor-not-allowed'
          }`}
        >
          {!isConnected ? '🔒 Wallet required' : pricesLoading ? 'Fetching prices…' : !canAfford ? 'Insufficient funds' : '⚡ Deploy Squad'}
        </button>

        <p className="text-center text-[9px] text-white/30 uppercase tracking-wider">
          {pricesLoading ? '--- ' + meta.label : `${fee % 1 === 0 ? fee.toFixed(0) : fee.toFixed(meta.decimals)} ${meta.label}`} entry · shared payout
        </p>
      </div>

    </div>
  );
};

export default TeamScreen;
