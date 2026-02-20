
import React, { useState } from 'react';
import { Screen } from '../types';

interface HowItWorksModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateLegal: (screen: Screen) => void;
}

const HowItWorksModal: React.FC<HowItWorksModalProps> = ({ isOpen, onClose, onNavigateLegal }) => {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'GUIDE' | 'PVP' | 'ECONOMY' | 'REFERRAL'>('GUIDE');

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/95 backdrop-blur-md animate-in fade-in duration-300"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative w-full max-w-lg bg-[#050505] border-4 border-white/10 p-1 tech-border shadow-[0_0_100px_rgba(0,0,0,1)] animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="p-5 border-b border-white/5 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-2xl sm:text-3xl font-black uppercase italic tracking-tighter text-white leading-none">MANUAL_OVERRIDE</h2>
            <p className="text-xs font-black text-white/30 uppercase tracking-[0.4em] mt-1">Protocol_Mechanics_v6.0</p>
          </div>
          <button onClick={onClose} className="text-white/20 hover:text-white transition-colors font-black text-xl">[X]</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/5 bg-black/50 overflow-x-auto scrollbar-hide shrink-0">
          {([
            { id: 'GUIDE',    label: 'GAME_LOOP',   activeClass: 'bg-cyan-500/10 text-cyan-400 border-b-2 border-cyan-500' },
            { id: 'PVP',      label: 'MULTIPLAYER', activeClass: 'bg-purple-500/10 text-purple-400 border-b-2 border-purple-500' },
            { id: 'ECONOMY',  label: 'ECONOMICS',   activeClass: 'bg-yellow-500/10 text-yellow-400 border-b-2 border-yellow-500' },
            { id: 'REFERRAL', label: 'REFERRAL',    activeClass: 'bg-green-500/10 text-green-400 border-b-2 border-green-500' },
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 min-w-[80px] py-4 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? tab.activeClass : 'text-white/20 hover:text-white'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 scrollbar-hide bg-black/40">

          {/* ── GAME LOOP ── */}
          {activeTab === 'GUIDE' && (
            <div className="space-y-5 animate-in slide-in-from-right-4 duration-300">
              <div className="bg-white/5 border border-white/10 p-4">
                <h3 className="text-sm font-black text-cyan-400 uppercase italic mb-2">OBJECTIVE</h3>
                <p className="text-xs text-white/50 leading-relaxed">
                  Enter a Raid. Watch your score multiply. <span className="text-white">Cash out before Risk hits 100%.</span> The longer you stay, the more you earn — but the higher the chance of losing everything.
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="text-xs font-black uppercase text-white/20 tracking-widest">ACTIONS</h3>
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-3 border border-red-500/30 bg-red-950/10 text-center">
                    <span className="text-xs font-black text-red-500 block mb-1">ATTACK</span>
                    <span className="text-[10px] text-white/30 leading-tight block">Boosts multiplier. Adds risk spike.</span>
                  </div>
                  <div className="p-3 border border-cyan-500/30 bg-cyan-950/10 text-center">
                    <span className="text-xs font-black text-cyan-500 block mb-1">DEFEND</span>
                    <span className="text-[10px] text-white/30 leading-tight block">Reduces risk. Costs multiplier.</span>
                  </div>
                  <div className="p-3 border border-green-500/30 bg-green-950/10 text-center">
                    <span className="text-xs font-black text-green-500 block mb-1">EXIT</span>
                    <span className="text-[10px] text-white/30 leading-tight block">Lock in earnings. Safe exit.</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 p-4 border border-white/5">
                <div className="w-12 h-12 border-2 border-red-500 rounded-full flex items-center justify-center shrink-0">
                  <span className="text-red-500 font-black text-xs">99%</span>
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase text-red-500 mb-1">RISK — THE ENEMY</h3>
                  <p className="text-xs text-white/40 leading-relaxed">
                    Risk climbs every second. At <span className="text-red-400">100%</span> the link severs — you lose your stake. A 3-second grace window at start gives you time to orient before drift begins.
                  </p>
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 p-4">
                <h3 className="text-sm font-black text-white uppercase italic mb-3">PAYMENT OPTIONS</h3>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { token: 'SOL',  color: 'text-[#9945FF]', desc: 'Native Solana' },
                    { token: 'USDC', color: 'text-blue-400',  desc: 'USD Stablecoin' },
                    { token: 'SKR',  color: 'text-[#14F195]', desc: 'Seeker Token'  },
                  ].map(t => (
                    <div key={t.token} className="text-center p-2 border border-white/10">
                      <span className={`text-sm font-black block ${t.color}`}>{t.token}</span>
                      <span className="text-[9px] text-white/30">{t.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── MULTIPLAYER ── */}
          {activeTab === 'PVP' && (
            <div className="space-y-5 animate-in slide-in-from-right-4 duration-300">
              <div className="bg-[#9945FF]/10 border border-[#9945FF]/40 p-5 tech-border">
                <h3 className="text-lg font-black text-[#9945FF] uppercase italic mb-2">WINNER TAKES ALL</h3>
                <p className="text-xs text-white/60 leading-relaxed">
                  In PvP, all players raid on the <span className="text-white">same RNG seed</span>. If risk spikes for you, it spikes for everyone. The player who extracts with the <span className="text-white">HIGHEST SCORE</span> wins the entire pot.
                </p>
              </div>

              <div className="space-y-3">
                {[
                  { n: 1, title: 'CREATE & SET STAKE', body: 'Host a lobby. Choose your stake amount and currency (SOL / USDC / SKR). Share the room code or QR.' },
                  { n: 2, title: 'JOIN VIA CODE OR QR', body: 'Enter the room code manually or use the QR scanner. Preview the stake before paying. One-click confirm.' },
                  { n: 3, title: 'SYNCED CHAOS', body: 'All players share the same provably-fair seed. Same spikes, same drifts — pure skill differentiates you.' },
                  { n: 4, title: 'HIGHEST EXTRACT WINS', body: 'When the host starts the round, everyone raids simultaneously. First to cash out highest takes the pool.' },
                ].map(step => (
                  <div key={step.n} className="flex gap-4 items-start">
                    <div className="w-7 h-7 flex items-center justify-center bg-white/10 text-white font-black text-xs shrink-0">{step.n}</div>
                    <div>
                      <h4 className="text-xs font-black uppercase text-white mb-1">{step.title}</h4>
                      <p className="text-xs text-white/40">{step.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── ECONOMICS ── */}
          {activeTab === 'ECONOMY' && (
            <div className="space-y-5 animate-in slide-in-from-right-4 duration-300">
              <div className="bg-yellow-500/5 border border-yellow-500/20 p-4">
                <h3 className="text-sm font-black text-yellow-400 uppercase italic mb-2">HOW REWARDS WORK</h3>
                <p className="text-xs text-white/50 leading-relaxed">
                  Your reward is based <span className="text-white">entirely on your score</span>. The entry fee is the cost to play — it is <span className="text-red-400">not returned</span> to you on a win.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 bg-white/5 border border-white/10">
                  <span className="text-xs font-black text-white/40 uppercase">Reward formula</span>
                  <span className="text-xs font-black text-yellow-400 mono">(score / 2500) × 6 × entry</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-white/5 border border-white/10">
                  <span className="text-xs font-black text-white/40 uppercase">House edge</span>
                  <span className="text-xs font-black text-white mono">~10%</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-white/5 border border-white/10">
                  <span className="text-xs font-black text-white/40 uppercase">Max payout</span>
                  <span className="text-xs font-black text-white mono">6× entry fee</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-white/5 border border-white/10">
                  <span className="text-xs font-black text-white/40 uppercase">On bust</span>
                  <span className="text-xs font-black text-red-400 mono">Entry fee lost</span>
                </div>
              </div>

              <div className="p-4 bg-red-900/10 border-l-2 border-red-500">
                <h3 className="text-xs font-black uppercase text-red-500 mb-2">FAIL STATES</h3>
                <div className="space-y-2 text-xs text-white/40">
                  <p><span className="text-red-400">GREED</span> — Risk at 99% but you wait or attack. Most common loss.</p>
                  <p><span className="text-orange-400">TIMEOUT</span> — Timer hits 0 before you exit. Link auto-severs.</p>
                  <p><span className="text-purple-400">BAD_RNG</span> — Spike pushes risk to 100% instantly. Unlucky but rare.</p>
                </div>
              </div>

              <div className="p-4 bg-white/5 border border-white/10">
                <h3 className="text-xs font-black uppercase text-white/40 tracking-widest mb-2">PROVABLY FAIR</h3>
                <p className="text-xs text-white/30 leading-relaxed">
                  Every raid uses a server seed committed before play begins (SHA-256 hash shown pre-raid). After the raid the full seed is revealed — you can verify the RNG was not manipulated.
                </p>
              </div>
            </div>
          )}

          {/* ── REFERRAL ── */}
          {activeTab === 'REFERRAL' && (
            <div className="space-y-5 animate-in slide-in-from-right-4 duration-300">
              <div className="bg-green-500/5 border border-green-500/20 p-5">
                <h3 className="text-lg font-black text-[#14F195] uppercase italic mb-2">RECRUIT & EARN</h3>
                <p className="text-xs text-white/60 leading-relaxed">
                  Share your personal referral link. Every time a new player signs up through your link, <span className="text-white">you earn 250 SR points</span> instantly.
                </p>
              </div>

              <div className="space-y-3">
                {[
                  { step: 1, title: 'FIND YOUR LINK', body: 'Go to Profile → scroll to the REFERRAL section. Your unique code (e.g. SR4F3A9B2E) is always displayed.' },
                  { step: 2, title: 'SHARE IT', body: 'Copy your link (https://solraid.app/ref/YOUR_CODE) and share via X, Discord, Telegram, or anywhere.' },
                  { step: 3, title: 'EARN SR', body: 'When a new wallet connects for the first time using your link, you receive 250 SR points credited automatically.' },
                  { step: 4, title: 'TRACK RECRUITS', body: 'Your profile shows total recruits and total SR earned from referrals. Build your network.' },
                ].map(s => (
                  <div key={s.step} className="flex gap-4 items-start">
                    <div className="w-7 h-7 flex items-center justify-center bg-[#14F195]/10 border border-[#14F195]/30 text-[#14F195] font-black text-xs shrink-0">{s.step}</div>
                    <div>
                      <h4 className="text-xs font-black uppercase text-white mb-1">{s.title}</h4>
                      <p className="text-xs text-white/40">{s.body}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between p-3 bg-white/5 border border-white/10">
                <span className="text-xs font-black text-white/40 uppercase">SR per recruit</span>
                <span className="text-xs font-black text-[#14F195] mono">+250 SR</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-white/5 bg-black shrink-0">
          <div className="flex gap-3 mb-4">
            <button
              onClick={() => { onClose(); onNavigateLegal(Screen.PRIVACY); }}
              className="flex-1 p-3 bg-white/2 border border-white/5 text-xs font-black uppercase tracking-widest hover:text-white transition-all italic text-white/30"
            >
              Privacy
            </button>
            <button
              onClick={() => { onClose(); onNavigateLegal(Screen.TERMS); }}
              className="flex-1 p-3 bg-white/2 border border-white/5 text-xs font-black uppercase tracking-widest hover:text-white transition-all italic text-white/30"
            >
              Terms
            </button>
            <a
              href="https://x.com/SolanaRaid"
              target="_blank"
              rel="noreferrer"
              className="flex-1 p-3 bg-white text-black border border-white text-xs font-black uppercase tracking-widest hover:bg-gray-200 transition-all italic flex items-center justify-center"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
          </div>
          <p className="text-[10px] text-center text-white/10 font-black tracking-[0.3em] uppercase">
            PROTOCOL_DATA_READ_ONLY // NO_FINANCIAL_ADVICE
          </p>
        </div>
      </div>
    </div>
  );
};

export default HowItWorksModal;
