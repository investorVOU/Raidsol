
import React, { useState } from 'react';
import { Screen } from '../types';

interface HowItWorksModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateLegal: (screen: Screen) => void;
}

const HowItWorksModal: React.FC<HowItWorksModalProps> = ({ isOpen, onClose, onNavigateLegal }) => {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'GUIDE' | 'EVENTS' | 'PVP' | 'ECONOMY' | 'REFERRAL'>('GUIDE');

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/95 backdrop-blur-md animate-in fade-in duration-300"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-[#050505] border-4 border-white/10 p-1 tech-border shadow-[0_0_100px_rgba(0,0,0,1)] animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="p-5 border-b border-white/5 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-2xl sm:text-3xl font-black uppercase italic tracking-tighter text-white leading-none">MANUAL_OVERRIDE</h2>
            <p className="text-xs font-black text-white/30 uppercase tracking-[0.4em] mt-1">Protocol_Mechanics_v7.0</p>
          </div>
          <button onClick={onClose} className="text-white/20 hover:text-white transition-colors font-black text-xl">[X]</button>
        </div>

        {/* Tabs — scrollable on small screens */}
        <div className="flex border-b border-white/5 bg-black/50 overflow-x-auto scrollbar-hide shrink-0">
          {([
            { id: 'GUIDE',    label: 'GAME_LOOP',  activeClass: 'bg-cyan-500/10 text-cyan-400 border-b-2 border-cyan-500' },
            { id: 'EVENTS',   label: 'EVENTS',     activeClass: 'bg-orange-500/10 text-orange-400 border-b-2 border-orange-500' },
            { id: 'PVP',      label: 'MULTIPLAYER',activeClass: 'bg-purple-500/10 text-purple-400 border-b-2 border-purple-500' },
            { id: 'ECONOMY',  label: 'ECONOMICS',  activeClass: 'bg-yellow-500/10 text-yellow-400 border-b-2 border-yellow-500' },
            { id: 'REFERRAL', label: 'REFERRAL',   activeClass: 'bg-green-500/10 text-green-400 border-b-2 border-green-500' },
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 min-w-[72px] py-3.5 text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap px-2 ${activeTab === tab.id ? tab.activeClass : 'text-white/20 hover:text-white/60'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 scrollbar-hide bg-black/40">

          {/* ── GAME LOOP ── */}
          {activeTab === 'GUIDE' && (
            <div className="space-y-5 animate-in slide-in-from-right-4 duration-300">

              <div className="bg-white/5 border border-white/10 p-4">
                <h3 className="text-sm font-black text-cyan-400 uppercase italic mb-2">OBJECTIVE</h3>
                <p className="text-xs text-white/50 leading-relaxed">
                  Enter a Raid. Watch your score multiply. <span className="text-white">Cash out before Risk hits 100%.</span> Stay longer = more reward, but higher bust probability. Skill, timing and gear decide your fate.
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="text-xs font-black uppercase text-white/20 tracking-widest">ACTIONS</h3>
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-3 border border-red-500/30 bg-red-950/10 text-center">
                    <span className="text-xs font-black text-red-500 block mb-1">ATTACK</span>
                    <span className="text-[10px] text-white/30 leading-tight block">Boosts multiplier. Spikes risk. Combo chains for bonus pts.</span>
                  </div>
                  <div className="p-3 border border-cyan-500/30 bg-cyan-950/10 text-center">
                    <span className="text-xs font-black text-cyan-500 block mb-1">DEFEND</span>
                    <span className="text-[10px] text-white/30 leading-tight block">Cuts risk. Max 2 in a row, then 3s cooldown.</span>
                  </div>
                  <div className="p-3 border border-green-500/30 bg-green-950/10 text-center">
                    <span className="text-xs font-black text-green-500 block mb-1">EXIT</span>
                    <span className="text-[10px] text-white/30 leading-tight block">Lock in earnings. Penalty if before 8s.</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-black uppercase text-white/20 tracking-widest">COMBO SYSTEM</h3>
                <div className="flex gap-2">
                  <div className="flex-1 p-3 border border-yellow-500/20 bg-yellow-500/5">
                    <span className="text-[10px] font-black text-yellow-400 block mb-0.5">COMBO</span>
                    <span className="text-[10px] text-white/30">Defend → Attack within 2.2s. +500 pts, -4 risk.</span>
                  </div>
                  <div className="flex-1 p-3 border border-purple-500/20 bg-purple-500/5">
                    <span className="text-[10px] font-black text-purple-400 block mb-0.5">COUNTER</span>
                    <span className="text-[10px] text-white/30">Attack → Defend within 2.2s. +350 pts, -10 risk.</span>
                  </div>
                </div>
                <p className="text-[10px] text-white/20 italic">5 attacks without defending triggers AGGRESSION surge (+15 risk).</p>
              </div>

              <div className="flex gap-4 p-4 border border-white/5">
                <div className="w-12 h-12 border-2 border-red-500 rounded-full flex items-center justify-center shrink-0">
                  <span className="text-red-500 font-black text-xs">99%</span>
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase text-red-500 mb-1">RISK — THE ENEMY</h3>
                  <p className="text-xs text-white/40 leading-relaxed">
                    Risk climbs every tick. Idle for 3s+ = slow decay. At <span className="text-red-400">100%</span> the link severs — stake lost. Exit early (&lt;8s) = 50% penalty on reward.
                  </p>
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 p-4">
                <h3 className="text-sm font-black text-white uppercase italic mb-3">PAYMENT OPTIONS</h3>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { token: 'SOL',  color: 'text-[#9945FF]', desc: 'Native Solana' },
                    { token: 'USDC', color: 'text-blue-400',  desc: 'USD Stablecoin' },
                    { token: 'SKR',  color: 'text-[#14F195]', desc: 'Seeker Token' },
                  ].map(t => (
                    <div key={t.token} className="text-center p-2 border border-white/10">
                      <span className={`text-sm font-black block ${t.color}`}>{t.token}</span>
                      <span className="text-[9px] text-white/30">{t.desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 p-4 space-y-2">
                <h3 className="text-xs font-black text-white/40 uppercase tracking-widest mb-1">GEAR & PASSES</h3>
                <p className="text-[10px] text-white/30 leading-relaxed">Buy <span className="text-white/60">Gear</span> from the Store to boost multiplier, reduce risk drift, or extend raid time. Equip up to 4 pieces per raid.</p>
                <p className="text-[10px] text-white/30 leading-relaxed"><span className="text-yellow-400">Raid Passes</span> give 50% off entry fee + 10% win boost. Toggle at deployment if you own one.</p>
                <p className="text-[10px] text-white/30 leading-relaxed"><span className="text-cyan-400">Avatars</span> must be purchased — equip from your Profile to set your identity.</p>
              </div>
            </div>
          )}

          {/* ── EVENTS ── */}
          {activeTab === 'EVENTS' && (
            <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
              <p className="text-[10px] text-white/30 uppercase tracking-widest">Random events fire during raids. Learn them — they change outcomes.</p>

              {[
                {
                  name: 'GOLDEN WINDOW',
                  color: 'text-yellow-400',
                  border: 'border-yellow-500/30 bg-yellow-500/5',
                  dot: 'bg-yellow-500',
                  desc: 'Triggers when multiplier first crosses 2.5×. A 6-second window opens — if you extract during it, reward is boosted +5%. The banner pulses gold.',
                },
                {
                  name: 'AMBUSH',
                  color: 'text-red-400',
                  border: 'border-red-500/30 bg-red-500/5',
                  dot: 'bg-red-500',
                  desc: '10% chance after 8s. Controls lock for 2.2 seconds, risk surges +10. You cannot attack, defend or extract during lockdown. Watch for the red flash.',
                },
                {
                  name: 'JACKPOT',
                  color: 'text-yellow-300',
                  border: 'border-yellow-300/30 bg-yellow-300/5',
                  dot: 'bg-yellow-300',
                  desc: '3% chance after 6s. A rare lucky event — multiplier jumps +0.5×. The arena flashes gold. Keep raiding to let it compound.',
                },
                {
                  name: 'FIREWALL SAVE',
                  color: 'text-cyan-400',
                  border: 'border-cyan-500/30 bg-cyan-500/5',
                  dot: 'bg-cyan-400',
                  desc: '12% chance at the moment of bust. A last-second save resets risk to 72% and shows the SHIELD overlay. You survive — but don\'t push your luck twice.',
                },
                {
                  name: 'NETWORK SURGE',
                  color: 'text-orange-400',
                  border: 'border-orange-500/30 bg-orange-500/5',
                  dot: 'bg-orange-400',
                  desc: 'Random risk spikes outside the normal drift. More frequent at higher multipliers. Greed factor amplifies these above 2× and 3×.',
                },
                {
                  name: 'HOT STREAK',
                  color: 'text-[#14F195]',
                  border: 'border-[#14F195]/20 bg-[#14F195]/5',
                  dot: 'bg-[#14F195]',
                  desc: 'Visual indicator on the multiplier bar after sustained aggressive play. No mechanical effect — just a heads-up that you\'re going hard.',
                },
              ].map(ev => (
                <div key={ev.name} className={`p-4 border ${ev.border}`}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${ev.dot}`} />
                    <span className={`text-xs font-black uppercase tracking-widest ${ev.color}`}>{ev.name}</span>
                  </div>
                  <p className="text-[11px] text-white/40 leading-relaxed">{ev.desc}</p>
                </div>
              ))}

              <div className="p-4 bg-white/5 border border-white/10">
                <h3 className="text-xs font-black text-white/40 uppercase tracking-widest mb-2">POST-RAID DEBRIEF</h3>
                <p className="text-[11px] text-white/30 leading-relaxed">
                  After every raid the Result screen shows a full timeline of every event that fired — SURGE, AMBUSH, JACKPOT, COMBO, BUST reason and more. Use it to understand what happened and improve.
                </p>
              </div>
            </div>
          )}

          {/* ── MULTIPLAYER ── */}
          {activeTab === 'PVP' && (
            <div className="space-y-5 animate-in slide-in-from-right-4 duration-300">
              <div className="bg-[#9945FF]/10 border border-[#9945FF]/40 p-5 tech-border">
                <h3 className="text-lg font-black text-[#9945FF] uppercase italic mb-2">WINNER TAKES ALL</h3>
                <p className="text-xs text-white/60 leading-relaxed">
                  In PvP all players raid the <span className="text-white">same RNG seed</span>. Same spikes, same drifts — pure skill separates you. The player who extracts with the <span className="text-white">HIGHEST SCORE</span> wins the entire pot.
                </p>
              </div>

              <div className="space-y-3">
                {[
                  { n: 1, title: 'CREATE & SET STAKE', body: 'Host a lobby. Pick currency (SOL / USDC / SKR) and stake amount. Share the room code or QR — the QR scanner works directly from the Join screen.' },
                  { n: 2, title: 'JOIN VIA CODE OR QR', body: 'Enter the room code or tap the scan icon. Preview stake, currency and player count before paying. Confirm and pay in one tap.' },
                  { n: 3, title: 'LIVE LEADERBOARD', body: 'During the raid a real-time leaderboard on the right panel shows everyone\'s score, risk bar and status. Know exactly where you stand.' },
                  { n: 4, title: 'HIGHEST EXTRACT WINS', body: 'When the host fires the round, everyone raids simultaneously. First to lock in the highest score takes the pool. No second place.' },
                ].map(step => (
                  <div key={step.n} className="flex gap-4 items-start">
                    <div className="w-7 h-7 flex items-center justify-center bg-[#9945FF]/10 border border-[#9945FF]/30 text-[#9945FF] font-black text-xs shrink-0">{step.n}</div>
                    <div>
                      <h4 className="text-xs font-black uppercase text-white mb-1">{step.title}</h4>
                      <p className="text-xs text-white/40">{step.body}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 bg-white/5 border border-white/10">
                <h3 className="text-xs font-black uppercase text-white/40 tracking-widest mb-2">LOBBY CHAT</h3>
                <p className="text-[11px] text-white/30 leading-relaxed">
                  The active lobby includes a live comms channel. Trash talk, coordinate, or just stare at the room code together.
                </p>
              </div>
            </div>
          )}

          {/* ── ECONOMICS ── */}
          {activeTab === 'ECONOMY' && (
            <div className="space-y-5 animate-in slide-in-from-right-4 duration-300">

              <div className="bg-yellow-500/5 border border-yellow-500/20 p-4">
                <h3 className="text-sm font-black text-yellow-400 uppercase italic mb-2">HOW REWARDS WORK</h3>
                <p className="text-xs text-white/50 leading-relaxed">
                  Your reward is based <span className="text-white">entirely on your score</span>. The entry fee is the cost to play — it is <span className="text-red-400">not returned</span> on a win.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 bg-white/5 border border-white/10">
                  <span className="text-xs font-black text-white/40 uppercase">Reward formula</span>
                  <span className="text-xs font-black text-yellow-400 mono">(score / 2500) × entry</span>
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

              <div className="space-y-2">
                <h3 className="text-xs font-black uppercase text-white/20 tracking-widest">BONUSES & SAVINGS</h3>
                <div className="flex items-center justify-between p-3 bg-yellow-500/5 border border-yellow-500/20">
                  <div>
                    <span className="text-xs font-black text-yellow-400 uppercase block">Raid Pass</span>
                    <span className="text-[10px] text-white/30">Buy in Store — 50% off entry + 10% win boost</span>
                  </div>
                  <span className="text-xs font-black text-yellow-400 mono shrink-0 ml-2">🎟️</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-[#14F195]/5 border border-[#14F195]/20">
                  <div>
                    <span className="text-xs font-black text-[#14F195] uppercase block">Daily Free Raid</span>
                    <span className="text-[10px] text-white/30">First EASY solo raid each day costs nothing</span>
                  </div>
                  <span className="text-xs font-black text-[#14F195] mono shrink-0 ml-2">FREE</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-[#9945FF]/5 border border-[#9945FF]/20">
                  <div>
                    <span className="text-xs font-black text-[#9945FF] uppercase block">Win Streak Bonus</span>
                    <span className="text-[10px] text-white/30">3+ consecutive wins → +0.15× starting multiplier</span>
                  </div>
                  <span className="text-xs font-black text-[#9945FF] mono shrink-0 ml-2">+0.15×</span>
                </div>
              </div>

              <div className="p-4 bg-red-900/10 border-l-2 border-red-500">
                <h3 className="text-xs font-black uppercase text-red-500 mb-2">FAIL STATES & PROTECTION</h3>
                <div className="space-y-2 text-xs text-white/40">
                  <p><span className="text-red-400">GREED</span> — Risk at 99% and you wait or attack. Most common loss.</p>
                  <p><span className="text-orange-400">EARLY EXIT</span> — Cashing out before 8s cuts reward by 50%.</p>
                  <p><span className="text-purple-400">BAD_RNG</span> — Spike pushes risk to 100% instantly. Rare but real.</p>
                  <p><span className="text-white/30">RAGE-QUIT BLOCK</span> — 3 busts in 10 minutes locks you out briefly. Tilt protection.</p>
                </div>
              </div>

              <div className="p-4 bg-white/5 border border-white/10">
                <h3 className="text-xs font-black uppercase text-white/40 tracking-widest mb-2">PROVABLY FAIR</h3>
                <p className="text-xs text-white/30 leading-relaxed">
                  Every raid uses a server seed committed before play (SHA-256 hash shown pre-raid). After the raid the full seed is revealed. Verify on-chain that the RNG was never manipulated.
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
                  Share your personal referral link. Every time a new player connects for the first time via your link, <span className="text-white">you earn 250 SR points</span> instantly.
                </p>
              </div>

              <div className="space-y-3">
                {[
                  { step: 1, title: 'FIND YOUR LINK', body: 'Go to Profile → scroll to REFERRAL_PROTOCOL. Your unique code (e.g. SR4F3A9B2E) is always shown there.' },
                  { step: 2, title: 'SHARE IT', body: 'Copy the link (https://solraid.app/ref/YOUR_CODE) and post on X, Discord, Telegram, or anywhere.' },
                  { step: 3, title: 'EARN SR', body: 'When a new wallet connects for the first time through your link, 250 SR points are credited to you automatically.' },
                  { step: 4, title: 'TRACK RECRUITS', body: 'Your profile shows total recruits and total SR earned from referrals in real time. Build your network.' },
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
              href="https://x.com/solraid_app"
              target="_blank"
              rel="noreferrer"
              className="flex-1 p-3 bg-white text-black border border-white text-xs font-black uppercase tracking-widest hover:bg-gray-200 transition-all italic flex items-center justify-center gap-1.5"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 shrink-0">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              <span>@solraid_app</span>
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
