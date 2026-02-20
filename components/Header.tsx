
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
    <header className="px-3 sm:px-6 pt-4 sm:pt-6 pb-2 flex justify-between items-center z-50 shrink-0 min-w-0">
      {/* ── LEFT SIDE ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 sm:gap-4 min-w-0 overflow-hidden">
        {/* S.R badge + level */}
        <div className="relative shrink-0 flex items-center gap-1">
          <div
            className={`px-2 py-1 border-2 font-black italic tech-border transition-colors ${
              isConnected
                ? 'border-cyan-500 text-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.3)]'
                : 'border-white/10 text-white/20'
            }`}
          >
            <span className="text-sm">S.R</span>
          </div>
          {isConnected && (
            <span className="text-xs font-black" style={{ color: currentRank.color }}>
              L.{currentRank.level}
            </span>
          )}
        </div>

        {isConnected ? (
          <div className="flex gap-2 sm:gap-4 items-center min-w-0 overflow-hidden">
            {/* SOL balance — visible on ALL sizes */}
            <div className="shrink-0 min-w-0">
              <p className="hidden sm:block text-[10px] text-white/40 font-black uppercase tracking-[0.2em] leading-tight italic">
                NODE_SOL
              </p>
              <p className="mono font-black uppercase leading-tight text-cyan-400" style={{ fontSize: 'clamp(9px, 2.2vw, 14px)' }}>
                {balance.toFixed(3)} SOL
              </p>
            </div>

            {/* Rank — always visible, label hidden on mobile */}
            <div className="sm:border-l sm:border-white/10 sm:pl-4 shrink-0">
              <p className="hidden sm:block text-[10px] text-white/40 font-black uppercase tracking-[0.2em] leading-tight italic">
                REP_RANK
              </p>
              <div className="flex items-center gap-1 sm:gap-1.5">
                <p
                  className="mono font-black uppercase leading-tight"
                  style={{ color: currentRank.color, fontSize: 'clamp(9px, 2.2vw, 14px)' }}
                >
                  {currentRank.title}
                </p>
                <span className="text-xs font-black text-white/20">
                  ({srPoints.toLocaleString()})
                </span>
              </div>
            </div>

            {/* Wallet address / .skr domain — desktop only */}
            <div className="hidden sm:block sm:ml-2 px-2 py-1 bg-cyan-900/30 rounded text-xs font-mono font-bold border shrink-0 transition-colors"
              style={{ color: domain ? '#14F195' : '#67e8f9', borderColor: domain ? 'rgba(20,241,149,0.4)' : 'rgb(21 94 117)' }}>
              {displayName}
            </div>
          </div>
        ) : (
          <div className="hidden sm:block">
            <p className="text-[10px] text-white/40 font-black uppercase tracking-[0.2em] leading-tight italic">
              LINK_OFFLINE
            </p>
            <p className="text-xs font-black text-red-500 uppercase tracking-tighter italic">
              NO_SIGNATURE
            </p>
          </div>
        )}
      </div>

      {/* ── RIGHT SIDE ────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 sm:gap-2 shrink-0 ml-2">
        <button
          onClick={onOpenHowItWorks}
          className="px-2 sm:px-3 py-1.5 border tech-border border-white/10 text-xs font-black uppercase tracking-widest text-white/40 hover:text-cyan-400 hover:border-cyan-400/30 transition-all"
        >
          <span className="hidden sm:inline">HELP</span>
          <span className="sm:hidden">?</span>
        </button>

        {!isConnected ? (
          <button
            onClick={onConnect}
            className="px-3 sm:px-5 py-2 bg-cyan-500 text-black text-xs font-black uppercase tracking-tighter tech-border shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all active:scale-95"
          >
            CONNECT<span className="hidden sm:inline"> WALLET</span>
          </button>
        ) : (
          <button
            onClick={onDisconnect}
            className="px-3 sm:px-4 py-1.5 border tech-border border-red-500/20 text-xs font-black uppercase text-red-500/40 hover:text-red-500 transition-colors"
          >
            EXIT
          </button>
        )}
      </div>
    </header>
  );
};

export default Header;
