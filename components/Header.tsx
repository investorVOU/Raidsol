
import React from 'react';
import { Rank } from '../types';

interface HeaderProps {
  balance: number;
  srPoints: number;
  currentRank: Rank;
  isConnected: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onOpenHowItWorks: () => void;
  walletAddress?: string | null;
  domainName?: string | null;
}

const INTER: React.CSSProperties  = { fontFamily: "'Inter', system-ui, sans-serif" };
const SG_NUM: React.CSSProperties = { fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontVariantNumeric: 'tabular-nums' };

const Header: React.FC<HeaderProps> = ({
  balance,
  srPoints,
  currentRank,
  isConnected,
  onConnect,
  onDisconnect,
  onOpenHowItWorks,
  walletAddress,
  domainName,
}) => {
  const domain = domainName ?? null;
  const shortAddress = walletAddress
    ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`
    : null;
  const displayName = domain ?? shortAddress;

  return (
    <header className="px-4 pt-3 pb-2 shrink-0 z-50">

      {/* ── ROW 1: wallet pill + action buttons ── */}
      <div className="flex items-center justify-between mb-2.5">
        {/* Wallet / status */}
        <div className="flex items-center gap-2 min-w-0">
          {isConnected && displayName ? (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border"
              style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.10)' }}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-[#14F195] animate-pulse shrink-0" />
              <span className="text-[10px] text-white/55 truncate max-w-[120px]" style={INTER}>
                {displayName}
              </span>
            </div>
          ) : !isConnected ? (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border"
              style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.07)' }}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
              <span className="text-[10px] text-white/35" style={INTER}>Not connected</span>
            </div>
          ) : null}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onOpenHowItWorks}
            className="w-7 h-7 rounded-full flex items-center justify-center text-white/35 hover:text-white transition-colors"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)' }}
          >
            <span className="text-[11px] font-bold" style={INTER}>?</span>
          </button>

          {!isConnected ? (
            <button
              onClick={onConnect}
              className="px-3 py-1.5 rounded-full text-black text-[11px] font-bold active:scale-95 transition-all"
              style={{ background: '#14F195', ...INTER }}
            >
              Connect
            </button>
          ) : (
            <button
              onClick={onDisconnect}
              className="px-3 py-1.5 rounded-full text-[11px] font-medium text-white/35 hover:text-red-400 transition-colors"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', ...INTER }}
            >
              Disconnect
            </button>
          )}
        </div>
      </div>

      {/* ── ROW 2: stat chips (connected only) ── */}
      {isConnected && (
        <div className="grid grid-cols-3 gap-2">

          {/* SOL Balance */}
          <div
            className="rounded-xl px-3 py-2"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)' }}
          >
            <p className="text-[9px] text-white/70 mb-0.5 uppercase tracking-wide" style={INTER}>Balance</p>
            <p className="text-[13px] leading-tight text-[#14F195]" style={SG_NUM}>
              {balance.toFixed(3)}
              <span className="text-[10px] text-white/35 ml-1" style={INTER}>SOL</span>
            </p>
          </div>

          {/* Level + Rank */}
          <div
            className="rounded-xl px-3 py-2"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)' }}
          >
            <p className="text-[9px] text-white/70 mb-0.5 uppercase tracking-wide" style={INTER}>Rank</p>
            <p className="text-[13px] leading-tight truncate" style={{ ...SG_NUM, color: currentRank.color }}>
              Lv.{currentRank.level}
              <span className="text-[11px] ml-1 text-white/50" style={INTER}>{currentRank.title}</span>
            </p>
          </div>

          {/* SR Points */}
          <div
            className="rounded-xl px-3 py-2"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)' }}
          >
            <p className="text-[9px] text-white/70 mb-0.5 uppercase tracking-wide" style={INTER}>SR Points</p>
            <p className="text-[13px] leading-tight text-amber-400" style={SG_NUM}>
              {srPoints.toLocaleString()}
            </p>
          </div>

        </div>
      )}
    </header>
  );
};

export default Header;
