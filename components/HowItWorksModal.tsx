
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Screen } from '../types';

interface HowItWorksModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateLegal: (screen: Screen) => void;
}

const HowItWorksModal: React.FC<HowItWorksModalProps> = ({ isOpen, onClose, onNavigateLegal }) => {
  const { t } = useTranslation();
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
            <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white leading-none">How it works</h2>
            <p className="text-xs text-white/40 mt-1">Mechanics v8.0</p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors font-bold text-lg leading-none">✕</button>
        </div>

        {/* Tabs — scrollable on small screens */}
        <div className="flex border-b border-white/5 bg-black/50 overflow-x-auto scrollbar-hide shrink-0">
          {([
            { id: 'GUIDE',    label: t('howItWorks.guide'),    activeClass: 'bg-white/8 text-white border-b-2 border-white/60' },
            { id: 'EVENTS',   label: t('howItWorks.events'),   activeClass: 'bg-orange-500/10 text-orange-400 border-b-2 border-orange-500' },
            { id: 'PVP',      label: t('howItWorks.pvp'),      activeClass: 'bg-red-500/10 text-[#FF2929] border-b-2 border-[#FF2929]' },
            { id: 'ECONOMY',  label: t('howItWorks.economy'),  activeClass: 'bg-yellow-500/10 text-yellow-400 border-b-2 border-yellow-500' },
            { id: 'REFERRAL', label: t('howItWorks.referral'), activeClass: 'bg-amber-500/10 text-amber-400 border-b-2 border-amber-500' },
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 min-w-[72px] py-3.5 text-[9px] sm:text-[10px] font-semibold tracking-wide transition-all whitespace-nowrap px-2 ${activeTab === tab.id ? tab.activeClass : 'text-white/40 hover:text-white/75'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 scrollbar-hide bg-black/40">

          {/* ── GUIDE ── */}
          {activeTab === 'GUIDE' && (
            <div className="space-y-5 animate-in slide-in-from-right-4 duration-300">

              <div className="bg-white/5 border border-white/10 p-4">
                <h3 className="text-sm font-bold text-white uppercase mb-2">Objective</h3>
                <p className="text-xs text-white/70 leading-relaxed">
                  Enter a Raid. Watch your score multiply. <span className="text-white">Cash out before Risk hits 100%.</span> Stay longer = more reward, but higher bust probability. Skill, timing and gear decide your fate.
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase text-white/40 tracking-wide">Actions</h3>
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-3 border border-red-500/30 bg-red-950/10 text-center">
                    <span className="text-xs font-bold text-red-500 block mb-1">ATTACK</span>
                    <span className="text-[10px] text-white/50 leading-tight block">Boosts multiplier. Spikes risk. Combo chains for bonus pts.</span>
                  </div>
                  <div className="p-3 border border-blue-500/30 bg-blue-950/10 text-center">
                    <span className="text-xs font-bold text-blue-400 block mb-1">DEFEND</span>
                    <span className="text-[10px] text-white/50 leading-tight block">Cuts risk. Max 2 in a row, then 3s cooldown.</span>
                  </div>
                  <div className="p-3 border border-[#FFB800]/30 bg-[#FFB800]/5 text-center">
                    <span className="text-xs font-bold text-[#FFB800] block mb-1">EXIT</span>
                    <span className="text-[10px] text-white/50 leading-tight block">Lock in earnings. Penalty if before 8s.</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase text-white/40 tracking-wide">Combo system</h3>
                <div className="flex gap-2">
                  <div className="flex-1 p-3 border border-yellow-500/20 bg-yellow-500/5">
                    <span className="text-[10px] font-bold text-yellow-400 block mb-0.5">COMBO</span>
                    <span className="text-[10px] text-white/50">Defend → Attack within 2.2s. +500 pts, -4 risk.</span>
                  </div>
                  <div className="flex-1 p-3 border border-white/10 bg-white/5">
                    <span className="text-[10px] font-bold text-white/70 block mb-0.5">COUNTER</span>
                    <span className="text-[10px] text-white/50">Attack → Defend within 2.2s. +350 pts, -10 risk.</span>
                  </div>
                </div>
                <p className="text-[10px] text-white/40">5 attacks without defending triggers an AGGRESSION surge (+15 risk).</p>
              </div>

              <div className="flex gap-4 p-4 border border-white/5">
                <div className="w-12 h-12 border-2 border-red-500 rounded-full flex items-center justify-center shrink-0">
                  <span className="text-red-500 font-black text-xs">99%</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold uppercase text-red-500 mb-1">Risk — the enemy</h3>
                  <p className="text-xs text-white/60 leading-relaxed">
                    Risk climbs every tick. Idle for 3s+ = slow decay. At <span className="text-red-400">100%</span> the link severs — stake lost. Exit early (&lt;8s) = 50% penalty on reward.
                  </p>
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 p-4 space-y-2">
                <h3 className="text-xs font-bold text-white/60 uppercase tracking-wide mb-1">Two raid modes</h3>
                <p className="text-[10px] text-white/50 leading-relaxed"><span className="text-white/75">Normal Raid</span> — Pay entry fee, extract SOL immediately on success. Reward paid out at end of session via Withdraw.</p>
                <p className="text-[10px] text-white/50 leading-relaxed"><span className="text-[#FF2929]">Round-Based Raid</span> — Score points instead of SOL. Your best score in the 6-hour window competes on the leaderboard. Winnings are claimed after the round closes from Profile → Round Wins.</p>
              </div>

              <div className="bg-white/5 border border-white/10 p-4">
                <h3 className="text-sm font-bold text-white uppercase mb-3">Payment options</h3>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { token: 'SOL',  color: 'text-[#FFB800]', desc: 'Native Solana' },
                    { token: 'USDC', color: 'text-blue-400',  desc: 'USD Stablecoin' },
                    { token: 'SKR',  color: 'text-[#FFB800]', desc: 'Seeker Token' },
                  ].map(t => (
                    <div key={t.token} className="text-center p-2 border border-white/10">
                      <span className={`text-sm font-bold block ${t.color}`}>{t.token}</span>
                      <span className="text-[9px] text-white/50">{t.desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 p-4 space-y-2">
                <h3 className="text-xs font-bold text-white/60 uppercase tracking-wide mb-1">Gear & Passes</h3>
                <p className="text-[10px] text-white/50 leading-relaxed">Buy <span className="text-white/75">Gear</span> from the Store to boost multiplier, reduce risk drift, or extend raid time. Equip up to 4 pieces per raid.</p>
                <p className="text-[10px] text-white/50 leading-relaxed"><span className="text-[#FFB800]">Raid Passes</span> give 50% off entry fee + 10% win boost. Toggle at deployment if you own one.</p>
                <p className="text-[10px] text-white/50 leading-relaxed"><span className="text-white/60">Avatars</span> must be purchased — equip from your Profile to set your identity.</p>
              </div>
            </div>
          )}

          {/* ── EVENTS ── */}
          {activeTab === 'EVENTS' && (
            <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
              <p className="text-[10px] text-white/50">Random events fire during raids. Learn them — they change outcomes.</p>

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
                  color: 'text-blue-400',
                  border: 'border-blue-500/30 bg-blue-500/5',
                  dot: 'bg-blue-400',
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
                  color: 'text-[#FFB800]',
                  border: 'border-[#FFB800]/20 bg-[#FFB800]/5',
                  dot: 'bg-[#FFB800]',
                  desc: 'Visual indicator on the multiplier bar after sustained aggressive play. No mechanical effect — just a heads-up that you\'re going hard.',
                },
              ].map(ev => (
                <div key={ev.name} className={`p-4 border ${ev.border}`}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${ev.dot}`} />
                    <span className={`text-xs font-bold uppercase tracking-wide ${ev.color}`}>{ev.name}</span>
                  </div>
                  <p className="text-[11px] text-white/60 leading-relaxed">{ev.desc}</p>
                </div>
              ))}

              <div className="p-4 bg-white/5 border border-white/10">
                <h3 className="text-xs font-bold text-white/60 uppercase tracking-wide mb-2">Post-raid debrief</h3>
                <p className="text-[11px] text-white/50 leading-relaxed">
                  After every raid the Result screen shows a full timeline of every event that fired — SURGE, AMBUSH, JACKPOT, COMBO, BUST reason and more. Use it to understand what happened and improve.
                </p>
              </div>
            </div>
          )}

          {/* ── MULTIPLAYER ── */}
          {activeTab === 'PVP' && (
            <div className="space-y-5 animate-in slide-in-from-right-4 duration-300">
              <div className="bg-[#FF2929]/10 border border-[#FF2929]/40 p-5 tech-border">
                <h3 className="text-lg font-bold text-[#FF2929] uppercase mb-2">Winner takes all</h3>
                <p className="text-xs text-white/75 leading-relaxed">
                  In PvP all players raid the <span className="text-white">same RNG seed</span>. Same spikes, same drifts — pure skill separates you. The player who extracts with the <span className="text-white">highest score</span> wins the entire pot.
                </p>
              </div>

              <div className="space-y-3">
                {[
                  { n: 1, title: 'Create & set stake', body: 'Host a lobby. Pick currency (SOL / USDC / SKR) and stake amount — choose a preset or enter a custom amount. Share the room code or QR.' },
                  { n: 2, title: 'Join via code or QR', body: 'Enter the room code or tap the scan icon. Preview stake, currency and player count before paying. Confirm and pay in one tap.' },
                  { n: 3, title: 'Live leaderboard', body: 'During the raid a real-time leaderboard shows everyone\'s score, risk bar and status. Know exactly where you stand at all times.' },
                  { n: 4, title: 'Highest score wins', body: 'Everyone raids simultaneously on the same seed. The player with the highest points when they extract takes the full pot. No second place payout.' },
                ].map(step => (
                  <div key={step.n} className="flex gap-4 items-start">
                    <div className="w-7 h-7 flex items-center justify-center bg-[#FF2929]/10 border border-[#FF2929]/30 text-[#FF2929] font-bold text-xs shrink-0">{step.n}</div>
                    <div>
                      <h4 className="text-xs font-bold uppercase text-white mb-1">{step.title}</h4>
                      <p className="text-xs text-white/60">{step.body}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 bg-white/5 border border-white/10">
                <h3 className="text-xs font-bold uppercase text-white/60 tracking-wide mb-2">Lobby chat</h3>
                <p className="text-[11px] text-white/50 leading-relaxed">
                  The active lobby includes a live comms channel. Trash talk, coordinate, or just stare at the room code together.
                </p>
              </div>
            </div>
          )}

          {/* ── ECONOMICS ── */}
          {activeTab === 'ECONOMY' && (
            <div className="space-y-5 animate-in slide-in-from-right-4 duration-300">

              <div className="bg-yellow-500/5 border border-yellow-500/20 p-4">
                <h3 className="text-sm font-bold text-yellow-400 uppercase mb-2">How rewards work</h3>
                <p className="text-xs text-white/70 leading-relaxed">
                  Your reward is based <span className="text-white">entirely on your score</span>. The entry fee is the cost to play — it is <span className="text-red-400">not returned</span> on a win.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 bg-white/5 border border-white/10">
                  <span className="text-xs font-bold text-white/60 uppercase">Reward formula</span>
                  <span className="text-xs font-bold text-yellow-400 mono">(score / 2500) × entry</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-white/5 border border-white/10">
                  <span className="text-xs font-bold text-white/60 uppercase">House edge</span>
                  <span className="text-xs font-bold text-white mono">~10%</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-white/5 border border-white/10">
                  <span className="text-xs font-bold text-white/60 uppercase">Max payout</span>
                  <span className="text-xs font-bold text-white mono">6× entry fee</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-white/5 border border-white/10">
                  <span className="text-xs font-bold text-white/60 uppercase">On bust</span>
                  <span className="text-xs font-bold text-red-400 mono">Entry fee lost</span>
                </div>
              </div>

              {/* Round Competition */}
              <div className="border border-[#FF2929]/25 bg-[#FF2929]/5 p-4 space-y-3">
                <h3 className="text-xs font-bold text-[#FF2929] uppercase tracking-wide">Raid Round competition</h3>
                <p className="text-[10px] text-white/60 leading-relaxed">
                  4 rounds run daily (UTC), each 6 hours. Enter a round-based raid to submit your <span className="text-white">best point score</span> to the leaderboard. No immediate SOL payout — prizes are distributed after the round ends.
                </p>
                <div className="space-y-1.5">
                  {[
                    { label: 'Prize pool', value: '8% of all round entry fees' },
                    { label: 'Eligibility', value: 'Top 5 wallets by highest single score' },
                    { label: '1st place', value: '40% of pool' },
                    { label: '2nd place', value: '25% of pool' },
                    { label: '3rd – 5th', value: '18% · 11% · 6%' },
                    { label: 'Claiming', value: 'Profile → Round Wins tab' },
                  ].map(row => (
                    <div key={row.label} className="flex items-center justify-between">
                      <span className="text-[10px] text-white/40">{row.label}</span>
                      <span className="text-[10px] font-bold text-white/75 mono">{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase text-white/40 tracking-wide">Bonuses & savings</h3>
                <div className="flex items-center justify-between p-3 bg-[#FFB800]/5 border border-[#FFB800]/20">
                  <div>
                    <span className="text-xs font-bold text-[#FFB800] uppercase block">Raid Pass</span>
                    <span className="text-[10px] text-white/50">Buy in Store — 50% off entry + 10% win boost</span>
                  </div>
                  <span className="text-xs font-bold text-[#FFB800] mono shrink-0 ml-2">PASS</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-white/5 border border-white/10">
                  <div>
                    <span className="text-xs font-bold text-white/75 uppercase block">Free Tickets</span>
                    <span className="text-[10px] text-white/50">+1 free ticket per day, max 3 stockpiled. Toggle at deployment.</span>
                  </div>
                  <span className="text-xs font-bold text-white/50 mono shrink-0 ml-2">FREE</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-[#FFB800]/5 border border-[#FFB800]/20">
                  <div>
                    <span className="text-xs font-bold text-[#FFB800] uppercase block">Win Streak Bonus</span>
                    <span className="text-[10px] text-white/50">3+ consecutive wins → +0.15× starting multiplier</span>
                  </div>
                  <span className="text-xs font-bold text-[#FFB800] mono shrink-0 ml-2">+0.15×</span>
                </div>
              </div>

              <div className="p-4 bg-red-900/10 border-l-2 border-red-500">
                <h3 className="text-xs font-bold uppercase text-red-500 mb-2">Fail states</h3>
                <div className="space-y-2 text-xs text-white/60">
                  <p><span className="text-red-400">Greed</span> — Risk at 99% and you wait or attack. Most common loss.</p>
                  <p><span className="text-orange-400">Early exit</span> — Cashing out before 8s cuts reward by 50%.</p>
                  <p><span className="text-white/50">Bad RNG</span> — Spike pushes risk to 100% instantly. Rare but real.</p>
                  <p><span className="text-white/50">Rage-quit protection</span> — 3 busts in 10 minutes locks you out briefly.</p>
                </div>
              </div>

              <div className="p-4 bg-white/5 border border-white/10">
                <h3 className="text-xs font-bold uppercase text-white/60 tracking-wide mb-2">Provably fair</h3>
                <p className="text-xs text-white/50 leading-relaxed">
                  Every raid uses a server seed committed before play (SHA-256 hash shown pre-raid). After the raid the full seed is revealed. Verify on-chain that the RNG was never manipulated.
                </p>
              </div>
            </div>
          )}

          {/* ── REFERRAL ── */}
          {activeTab === 'REFERRAL' && (
            <div className="space-y-5 animate-in slide-in-from-right-4 duration-300">
              <div className="bg-white/5 border border-white/10 p-5">
                <h3 className="text-lg font-bold text-white uppercase mb-2">Recruit & earn</h3>
                <p className="text-xs text-white/75 leading-relaxed">
                  Share your personal referral link. Every time a new player connects for the first time via your link, <span className="text-[#FFB800]">you earn 250 SR points</span> instantly.
                </p>
              </div>

              <div className="space-y-3">
                {[
                  { step: 1, title: 'Find your link', body: 'Go to Profile → scroll to Referral. Your unique code (e.g. SR4F3A9B2E) is always shown there.' },
                  { step: 2, title: 'Share it', body: 'Copy the link (https://solraid.app/ref/YOUR_CODE) and post on X, Discord, Telegram, or anywhere.' },
                  { step: 3, title: 'Earn SR', body: 'When a new wallet connects for the first time through your link, 250 SR points are credited to you automatically.' },
                  { step: 4, title: 'Track recruits', body: 'Your profile shows total recruits and total SR earned from referrals in real time. Build your network.' },
                ].map(s => (
                  <div key={s.step} className="flex gap-4 items-start">
                    <div className="w-7 h-7 flex items-center justify-center bg-white/8 border border-white/20 text-white font-bold text-xs shrink-0">{s.step}</div>
                    <div>
                      <h4 className="text-xs font-bold uppercase text-white mb-1">{s.title}</h4>
                      <p className="text-xs text-white/60">{s.body}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between p-3 bg-white/5 border border-white/10">
                <span className="text-xs font-bold text-white/60 uppercase">SR per recruit</span>
                <span className="text-xs font-bold text-[#FFB800] mono">+250 SR</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-white/5 bg-black shrink-0">
          <div className="flex gap-3 mb-4">
            <button
              onClick={() => { onClose(); onNavigateLegal(Screen.PRIVACY); }}
              className="flex-1 p-3 bg-white/2 border border-white/5 text-xs font-bold tracking-wide hover:text-white transition-all text-white/50"
            >
              Privacy
            </button>
            <button
              onClick={() => { onClose(); onNavigateLegal(Screen.TERMS); }}
              className="flex-1 p-3 bg-white/2 border border-white/5 text-xs font-bold tracking-wide hover:text-white transition-all text-white/50"
            >
              Terms
            </button>
            <a
              href="https://x.com/solraid_app"
              target="_blank"
              rel="noreferrer"
              className="flex-1 p-3 bg-white text-black border border-white text-xs font-bold tracking-wide hover:bg-gray-200 transition-all flex items-center justify-center gap-1.5"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 shrink-0">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              <span>@solraid_app</span>
            </a>
          </div>
          <p className="text-[10px] text-center text-white/20">
            For entertainment only · Not financial advice
          </p>
        </div>
      </div>
    </div>
  );
};

export default HowItWorksModal;
