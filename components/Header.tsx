
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
}

const Header: React.FC<HeaderProps> = ({ balance, srPoints, currentRank, isConnected, onConnect, onDisconnect, onOpenHowItWorks, walletAddress }) => {
  const shortAddress = walletAddress ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}` : null;
  return (
    <header className="px-6 pt-6 pb-2 flex justify-between items-center z-50 shrink-0">
      <div className="flex items-center gap-4">
        <div className="relative">
          <div className={`px-2 py-1 border-2 font-black italic tech-border transition-colors ${isConnected ? 'border-cyan-500 text-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.3)]' : 'border-white/10 text-white/20'}`}>
            <span className="text-sm">S.R</span>
          </div>
          <div className="absolute -bottom-2 -right-3 px-1.5 py-0.5 border border-white/10 bg-black/80 text-[10px] font-black italic leading-none text-white/70">
            L.{currentRank.level}
          </div>
        </div>
        
        {isConnected ? (
          <div className="flex gap-4 items-center">
            <div>
              <p className="text-[10px] text-white/40 font-black uppercase tracking-[0.2em] leading-tight italic">NODE_SOL</p>
              <p className="mono text-sm font-black uppercase">
                {balance.toFixed(3)} <span className="text-cyan-400">SOL</span>
              </p>
            </div>
            <div className="border-l border-white/10 pl-4">
              <p className="text-[10px] text-white/40 font-black uppercase tracking-[0.2em] leading-tight italic">REP_RANK</p>
              <div className="flex items-center gap-1.5">
                <p className="mono text-sm font-black uppercase" style={{ color: currentRank.color }}>
                  {currentRank.title}
                </p>
                <span className="text-xs font-black text-white/20">({srPoints.toLocaleString()})</span>
              </div>
            </div>
            <div className="ml-4 px-2 py-1 bg-cyan-900/30 rounded text-xs font-mono font-bold text-cyan-300 border border-cyan-700">
              {shortAddress}
            </div>
          </div>
        ) : (
          <div>
            <p className="text-[10px] text-white/40 font-black uppercase tracking-[0.2em] leading-tight italic">LINK_OFFLINE</p>
            <p className="text-xs font-black text-red-500 uppercase tracking-tighter italic">NO_SIGNATURE</p>
            <div className="ml-2 px-2 py-1 bg-gray-800/30 rounded text-xs font-mono font-bold text-gray-400 border border-gray-700">
              Not Connected
            </div>
          </div>
        )}
      </div>
      
      <div className="flex items-center gap-2">
        <button 
          onClick={onOpenHowItWorks}
          className="px-3 py-1.5 border tech-border border-white/10 text-xs font-black uppercase tracking-widest text-white/40 hover:text-cyan-400 hover:border-cyan-400/30 transition-all"
        >
          HELP
        </button>

        {!isConnected ? (
          <button
            onClick={onConnect}
            className="px-5 py-2 bg-cyan-500 text-black text-xs font-black uppercase tracking-tighter tech-border shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all active:scale-95"
          >
            CONNECT WALLET
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={onDisconnect}
              className="px-4 py-1.5 border tech-border border-red-500/20 text-xs font-black uppercase text-red-500/40 hover:text-red-500 transition-colors"
            >
              EXIT
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
