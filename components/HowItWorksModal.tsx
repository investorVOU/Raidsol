
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Screen } from '../types';

interface HowItWorksModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateLegal: (screen: Screen) => void;
}

const MONO: React.CSSProperties = { fontFamily: "'JetBrains Mono', 'Courier New', monospace" };
const INTER: React.CSSProperties = { fontFamily: "'Inter', system-ui, sans-serif" };
const BN: React.CSSProperties = { fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '1.5px' };

type Tab = 'GUIDE' | 'EVENTS' | 'PVP' | 'ECONOMY' | 'REFERRAL';

const HowItWorksModal: React.FC<HowItWorksModalProps> = ({ isOpen, onClose, onNavigateLegal }) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<Tab>('GUIDE');

  if (!isOpen) return null;

  const tabs: { id: Tab; label: string; activeClass: string }[] = [
    { id: 'GUIDE',    label: t('howItWorks.guide'),    activeClass: 'text-white border-b-2 border-white' },
    { id: 'EVENTS',   label: t('howItWorks.events'),   activeClass: 'text-orange-400 border-b-2 border-orange-500' },
    { id: 'PVP',      label: t('howItWorks.pvp'),      activeClass: 'text-[#9945FF] border-b-2 border-[#9945FF]' },
    { id: 'ECONOMY',  label: t('howItWorks.economy'),  activeClass: 'text-[#FFB800] border-b-2 border-[#FFB800]' },
    { id: 'REFERRAL', label: t('howItWorks.referral'), activeClass: 'text-amber-400 border-b-2 border-amber-500' },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/95 backdrop-blur-md animate-in fade-in duration-300"
        onClick={onClose}
      />

      <div className="relative w-full max-w-lg bg-[#0c0c20] border border-white/10 shadow-[0_0_80px_rgba(0,0,0,1)] animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="px-5 py-4 border-b border-white/8 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tight text-white leading-none" style={BN}>
              How It Works
            </h2>
            <p className="text-[10px] text-white mt-0.5" style={INTER}>Solana Raid — mechanics guide</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-white hover:text-white transition-colors text-base leading-none">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/8 bg-black/30 overflow-x-auto scrollbar-hide shrink-0">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 min-w-[64px] py-3 text-[9px] sm:text-[10px] font-bold tracking-wider uppercase transition-all whitespace-nowrap px-2 ${
                activeTab === tab.id ? tab.activeClass : 'text-white hover:text-white'
              }`}
              style={INTER}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-hide">

          {/* ── GUIDE ── */}
          {activeTab === 'GUIDE' && (
            <div className="space-y-4 animate-in slide-in-from-right-4 duration-200">

              {/* What is a raid */}
              <div className="p-4 border border-white/10 bg-white/[0.03]">
                <h3 className="text-xs font-bold text-white uppercase tracking-wide mb-2" style={INTER}>What is a Raid?</h3>
                <p className="text-[11px] text-white leading-relaxed">
                  Every raid is a <span className="text-white">round-based competition</span>. Pay an entry fee, score as many points as possible, then extract before your risk hits 100%. Your best score in the 6-hour round window competes on the leaderboard. The <span className="text-[#FFB800]">top 5 wallets split the prize pool by tier</span> when the round closes.
                </p>
              </div>

              {/* Actions */}
              <div>
                <p className="text-[9px] font-bold text-white uppercase tracking-widest mb-2" style={INTER}>Three actions</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'ATTACK', color: 'text-[#9945FF]', border: 'border-[#9945FF]/30 bg-[#9945FF]/5', desc: 'Pushes multiplier up. Also spikes risk. Combo with Defend for bonus points.' },
                    { label: 'DEFEND', color: 'text-blue-400',  border: 'border-blue-500/25 bg-blue-950/20', desc: 'Cuts risk down. Max 2 in a row, then a 3-second cooldown applies.' },
                    { label: 'EXTRACT', color: 'text-[#FFB800]', border: 'border-[#FFB800]/30 bg-[#FFB800]/5', desc: 'Locks in your score. Locked for 20s at round start. Exit before 20s = 50% penalty.' },
                  ].map(a => (
                    <div key={a.label} className={`p-3 border ${a.border} text-center`}>
                      <span className={`text-[11px] font-black block mb-1.5 ${a.color}`} style={BN}>{a.label}</span>
                      <span className="text-[9px] text-white leading-snug block" style={INTER}>{a.desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Combo system */}
              <div>
                <p className="text-[9px] font-bold text-white uppercase tracking-widest mb-2" style={INTER}>Combo system</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 border border-yellow-500/20 bg-yellow-500/5">
                    <span className="text-[10px] font-bold text-yellow-400 block mb-1" style={INTER}>COMBO</span>
                    <span className="text-[10px] text-white" style={INTER}>Defend → Attack within 2.2s. +500 pts · −4 risk.</span>
                  </div>
                  <div className="p-3 border border-white/10 bg-white/[0.03]">
                    <span className="text-[10px] font-bold text-white block mb-1" style={INTER}>COUNTER</span>
                    <span className="text-[10px] text-white" style={INTER}>Attack → Defend within 2.2s. +350 pts · −10 risk.</span>
                  </div>
                </div>
                <p className="text-[10px] text-white mt-2" style={INTER}>5 consecutive attacks without defending triggers an AGGRESSION surge (+15 risk).</p>
              </div>

              {/* Risk */}
              <div className="flex gap-4 p-4 border border-[#9945FF]/20 bg-[#9945FF]/10">
                <div className="w-11 h-11 border-2 border-[#9945FF] rounded-full flex items-center justify-center shrink-0">
                  <span className="text-[#9945FF] font-black text-[10px]" style={MONO}>100%</span>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-[#9945FF] uppercase mb-1" style={INTER}>Risk — the enemy</h3>
                  <p className="text-[11px] text-white leading-relaxed" style={INTER}>
                    Risk climbs every tick as you stay inside. Idle for 3+ seconds and it decays slowly. Hit 100% and the session severs — entry fee is lost. Stay sharp and extract in time.
                  </p>
                </div>
              </div>

              {/* Gear & Passes */}
              <div className="p-4 border border-white/10 bg-white/[0.03] space-y-2">
                <h3 className="text-xs font-bold text-white uppercase tracking-wide mb-2" style={INTER}>Gear & Raid Passes</h3>
                {[
                  { label: 'Time Boost', color: 'text-white', desc: '+30s extra raid time. Stay in longer to score higher.' },
                  { label: 'Mult Boost', color: 'text-white', desc: 'Higher starting multiplier — more points from the opening second.' },
                  { label: 'Risk Reduction', color: 'text-white', desc: 'Slows risk drift rate. More room to push without busting.' },
                  { label: 'Raid Pass', color: 'text-[#FFB800]', desc: '50% off entry fee + 10% score boost. Buy in the Store.' },
                  { label: 'Free Ticket', color: 'text-white', desc: '+1 free ticket per day, stockpile up to 3. Toggle at deploy.' },
                ].map(g => (
                  <div key={g.label} className="flex items-start gap-2">
                    <span className="text-[#9945FF] text-[10px] shrink-0 mt-0.5" style={MONO}>›</span>
                    <p className="text-[10px] leading-snug" style={INTER}>
                      <span className={`font-bold ${g.color}`}>{g.label}</span>
                      <span className="text-white"> — {g.desc}</span>
                    </p>
                  </div>
                ))}
              </div>

              {/* Payment */}
              <div className="p-4 border border-white/10 bg-white/[0.03]">
                <h3 className="text-xs font-bold text-white uppercase tracking-wide mb-3" style={INTER}>Entry fee currencies</h3>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { token: 'SOL',  color: 'text-[#FFB800]', desc: 'Native Solana' },
                  { token: 'SKR',  color: 'text-[#FFB800]', desc: 'Seeker Token' },
                  { token: 'RAID', color: 'text-[#00E5FF]', desc: '$RAID Token' },
                  ].map(c => (
                    <div key={c.token} className="text-center p-2.5 border border-white/10">
                      <span className={`text-sm font-black block ${c.color}`} style={BN}>{c.token}</span>
                      <span className="text-[9px] text-white" style={INTER}>{c.desc}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* ── EVENTS ── */}
          {activeTab === 'EVENTS' && (
            <div className="space-y-3 animate-in slide-in-from-right-4 duration-200">
              <p className="text-[10px] text-white pb-1" style={INTER}>Random events fire mid-raid. Learning them is a core part of skill.</p>

              {[
                {
                  name: 'GOLDEN WINDOW',
                  tag: 'LUCKY',
                  color: 'text-yellow-400',
                  border: 'border-yellow-500/25 bg-yellow-500/5',
                  desc: 'Triggers the first time your multiplier crosses 2.5×. A 6-second extraction window opens with a +5% score bonus. The screen pulses gold — act fast.',
                },
                {
                  name: 'JACKPOT',
                  tag: 'LUCKY',
                  color: 'text-yellow-300',
                  border: 'border-yellow-300/20 bg-yellow-300/5',
                  desc: '3% chance after 6 seconds. Your multiplier jumps +0.5× instantly. Rare — let it compound if you can hold the risk.',
                },
                {
                  name: 'FIREWALL SAVE',
                  tag: 'SAVED',
                  color: 'text-blue-400',
                  border: 'border-blue-500/25 bg-blue-950/20',
                  desc: '12% chance at the exact moment of bust. Risk resets to 72% and the SHIELD overlay fires. You survive — but this is a one-time reprieve, not a strategy.',
                },
                {
                  name: 'AMBUSH',
                  tag: 'DANGER',
                  color: 'text-[#9945FF]',
                  border: 'border-[#9945FF]/25 bg-[#9945FF]/5',
                  desc: '10% chance after 8 seconds. Controls freeze for 2.2 seconds while risk surges +10. You cannot attack, defend, or extract. Watch for the red flash and breathe.',
                },
                {
                  name: 'NETWORK SURGE',
                  tag: 'DANGER',
                  color: 'text-orange-400',
                  border: 'border-orange-500/25 bg-orange-500/5',
                  desc: 'Sudden risk spikes outside normal drift. More frequent and more violent above 2× and 3× multipliers. Greed amplifies these — know when to stop attacking.',
                },
                {
                  name: 'HOT STREAK',
                  tag: 'INFO',
                  color: 'text-[#FFB800]',
                  border: 'border-[#FFB800]/20 bg-[#FFB800]/5',
                  desc: 'A visual indicator that appears after sustained aggressive play. No direct mechanical effect — it signals that risk accumulation is now accelerating.',
                },
              ].map(ev => (
                <div key={ev.name} className={`p-4 border ${ev.border}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-xs font-black uppercase tracking-wide ${ev.color}`} style={INTER}>{ev.name}</span>
                    <span className="text-[8px] font-bold text-white uppercase tracking-widest" style={MONO}>{ev.tag}</span>
                  </div>
                  <p className="text-[11px] text-white leading-relaxed" style={INTER}>{ev.desc}</p>
                </div>
              ))}

              <div className="p-4 border border-white/10 bg-white/[0.03]">
                <h3 className="text-xs font-bold text-white uppercase tracking-wide mb-1.5" style={INTER}>Post-raid debrief</h3>
                <p className="text-[11px] text-white leading-relaxed" style={INTER}>
                  The Result screen shows a full event timeline after every raid — every surge, ambush, combo, jackpot, and the exact bust trigger if it happened. Use it to improve your reads.
                </p>
              </div>
            </div>
          )}

          {/* ── PVP ── */}
          {activeTab === 'PVP' && (
            <div className="space-y-4 animate-in slide-in-from-right-4 duration-200">

              <div className="p-4 border border-[#9945FF]/35 bg-[#9945FF]/8">
                <h3 className="text-base font-black text-[#9945FF] uppercase mb-2" style={BN}>Winner takes the pot</h3>
                <p className="text-[11px] text-white leading-relaxed" style={INTER}>
                  In a PvP room all players raid the <span className="text-white font-bold">same RNG seed</span> simultaneously — identical spikes, identical drifts. The only variable is your decisions. The player who extracts with the <span className="text-white font-bold">highest score</span> claims the entire combined stake.
                </p>
              </div>

              <div className="space-y-3">
                <p className="text-[9px] font-bold text-white uppercase tracking-widest" style={INTER}>How to play</p>
                {[
                  {
                    n: '01',
                    title: 'Create a room',
                    body: 'Host sets the stake amount and currency (SOL, SKR, or RAID). Choose a preset or enter a custom amount. Share your room code or QR link.',
                  },
                  {
                    n: '02',
                    title: 'Join via code',
                    body: 'Enter the room code or scan the QR. You see a preview of the stake and currency before committing. Tap Confirm & Pay to lock in.',
                  },
                  {
                    n: '03',
                    title: 'Raid simultaneously',
                    body: 'All players start on the same seed at the same time. A live scoreboard shows every player\'s score, risk, and status in real time.',
                  },
                  {
                    n: '04',
                    title: 'Highest score wins',
                    body: 'The player with the most points at extraction takes the full pot. No runner-up payout. If you bust, the entry fee is forfeited to the winner\'s pool.',
                  },
                ].map(s => (
                  <div key={s.n} className="flex gap-3 items-start">
                    <div className="w-7 h-7 shrink-0 flex items-center justify-center border border-[#9945FF]/35 bg-[#9945FF]/8">
                      <span className="text-[9px] font-black text-[#9945FF]" style={MONO}>{s.n}</span>
                    </div>
                    <div>
                      <h4 className="text-[11px] font-bold text-white uppercase mb-0.5" style={INTER}>{s.title}</h4>
                      <p className="text-[11px] text-white leading-relaxed" style={INTER}>{s.body}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 border border-white/10 bg-white/[0.03]">
                <h3 className="text-xs font-bold text-white uppercase tracking-wide mb-1.5" style={INTER}>Share to challenge</h3>
                <p className="text-[11px] text-white leading-relaxed" style={INTER}>
                  From the Lobby, tap <span className="text-white">Copy invite link</span> to generate a direct URL. Anyone who opens it is automatically dropped into your room code on the Join screen — no manual entry needed.
                </p>
              </div>

            </div>
          )}

          {/* ── ECONOMY ── */}
          {activeTab === 'ECONOMY' && (
            <div className="space-y-4 animate-in slide-in-from-right-4 duration-200">

              {/* Pool mechanic */}
              <div className="p-4 border border-[#FFB800]/30 bg-[#FFB800]/5">
                <h3 className="text-base font-black text-[#FFB800] uppercase mb-2" style={BN}>100% goes to the pool</h3>
                <p className="text-[11px] text-white leading-relaxed" style={INTER}>
                  Every entry fee paid into a round goes directly into the prize pool. Your best score across all your raids in the 6-hour window is your submission. <span className="text-white">Top 5 wallets</span> split the pool by tier when the round closes.
                </p>
              </div>

              {/* Tier splits */}
              <div>
                <p className="text-[9px] font-bold text-white uppercase tracking-widest mb-2" style={INTER}>Prize split by tier</p>
                <div className="space-y-2">
                  {[
                    { tier: 'GRUNT',  fee: '0.026 SOL', color: '#94a3b8', splits: ['35%', '25%', '20%', '13%', '7%'],  note: 'Casual — most balanced split' },
                    { tier: 'ELITE',  fee: '0.05 SOL',  color: '#FFB800', splits: ['40%', '28%', '18%', '10%', '4%'], note: 'Competitive — standard weighting' },
                    { tier: 'WHALE',  fee: '0.25 SOL',  color: '#9945FF', splits: ['50%', '25%', '15%', '7%', '3%'],  note: 'High-stakes — winner takes most' },
                  ].map(row => (
                    <div key={row.tier} className="border border-white/10 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black uppercase" style={{ ...INTER, color: row.color }}>{row.tier}</span>
                          <span className="text-[9px] text-white" style={MONO}>{row.fee} entry</span>
                        </div>
                        <span className="text-[9px] text-white italic" style={INTER}>{row.note}</span>
                      </div>
                      <div className="grid grid-cols-5 gap-1">
                        {['1st', '2nd', '3rd', '4th', '5th'].map((rank, i) => (
                          <div key={rank} className="text-center p-1.5 bg-white/[0.03] border border-white/8">
                            <span className="text-[8px] text-white block" style={INTER}>{rank}</span>
                            <span className="text-[11px] font-black text-white" style={{ ...MONO, color: i === 0 ? row.color : undefined }}>{row.splits[i]}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Refund guarantee */}
              <div className="p-4 border border-[#FFB800]/25 bg-[#FFB800]/5">
                <h3 className="text-xs font-bold text-[#FFB800] uppercase tracking-wide mb-1.5" style={INTER}>Refund guarantee</h3>
                <p className="text-[11px] text-white leading-relaxed" style={INTER}>
                  If fewer than 3 unique wallets enter a round, the round is cancelled automatically and every entry fee is refunded in full to each participant's unclaimed balance. No risk of playing into an empty pool.
                </p>
              </div>

              {/* Claim */}
              <div className="space-y-1.5">
                <p className="text-[9px] font-bold text-white uppercase tracking-widest" style={INTER}>Claiming winnings</p>
                {[
                  { label: 'Where', value: 'Profile → Round Wins tab' },
                  { label: 'When', value: 'After the 6-hour round closes' },
                  { label: 'How', value: 'One-tap claim → SOL to wallet' },
                  { label: 'On bust', value: 'Entry fee lost, points still count for round' },
                ].map(r => (
                  <div key={r.label} className="flex items-center justify-between p-2.5 border border-white/8 bg-white/[0.02]">
                    <span className="text-[10px] text-white uppercase" style={INTER}>{r.label}</span>
                    <span className="text-[10px] font-bold text-white" style={MONO}>{r.value}</span>
                  </div>
                ))}
              </div>

              {/* Bonuses */}
              <div>
                <p className="text-[9px] font-bold text-white uppercase tracking-widest mb-2" style={INTER}>Advantages</p>
                <div className="space-y-2">
                  {[
                    { label: 'Raid Pass', value: '−50% entry + +10% score', color: '#FFB800' },
                    { label: 'Free Ticket', value: '+1/day · max 3 stacked', color: '#ffffff' },
                    { label: 'Daily Streak', value: '+10% SR/day · cap +40%', color: '#FFB800' },
                    { label: 'Gear (equipped)', value: 'Time / Mult / Risk bonuses', color: '#ffffff' },
                  ].map(b => (
                    <div key={b.label} className="flex items-center justify-between p-2.5 border border-white/8 bg-white/[0.02]">
                      <span className="text-[10px] font-bold uppercase" style={{ ...INTER, color: b.color }}>{b.label}</span>
                      <span className="text-[10px] text-white" style={MONO}>{b.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Provably fair */}
              <div className="p-4 border border-white/10 bg-white/[0.03]">
                <h3 className="text-xs font-bold text-white uppercase tracking-wide mb-1.5" style={INTER}>Provably fair RNG</h3>
                <p className="text-[11px] text-white leading-relaxed" style={INTER}>
                  Before every raid a server seed hash is shown before the raid starts (loading screen). After the raid the full seed is revealed so you can verify the RNG outcome yourself.
                </p>
              </div>

            </div>
          )}

          {/* ── REFERRAL ── */}
          {activeTab === 'REFERRAL' && (
            <div className="space-y-4 animate-in slide-in-from-right-4 duration-200">

              <div className="p-4 border border-white/10 bg-white/[0.03]">
                <h3 className="text-base font-black text-white uppercase mb-2" style={BN}>Recruit & earn SR</h3>
                <p className="text-[11px] text-white leading-relaxed" style={INTER}>
                  Every player has a unique referral code. When a new wallet connects for the first time through your link, <span className="text-[#FFB800] font-bold">you earn 250 SR points instantly</span>. No cap — recruit as many as you can.
                </p>
              </div>

              <div className="space-y-3">
                {[
                  {
                    n: '01',
                    title: 'Find your code',
                    body: 'Go to Profile and scroll to the Referral section. Your unique code is always displayed there — something like SR4F3A9B2E.',
                  },
                  {
                    n: '02',
                    title: 'Share the link',
                    body: 'Copy the full referral URL (solraid.app/ref/YOUR_CODE) and drop it anywhere — X, Discord, Telegram, group chats. The link auto-fills the join screen for new players.',
                  },
                  {
                    n: '03',
                    title: 'Earn on first connect',
                    body: 'The moment a new wallet connects via your link for the first time, 250 SR points are credited to your account. Tracked automatically, no action needed.',
                  },
                  {
                    n: '04',
                    title: 'Track your network',
                    body: 'Profile shows your total recruit count and cumulative SR earned from referrals in real time. Build a network and climb the SR leaderboard passively.',
                  },
                ].map(s => (
                  <div key={s.n} className="flex gap-3 items-start">
                    <div className="w-7 h-7 shrink-0 flex items-center justify-center border border-white/15 bg-white/[0.04]">
                      <span className="text-[9px] font-black text-white" style={MONO}>{s.n}</span>
                    </div>
                    <div>
                      <h4 className="text-[11px] font-bold text-white uppercase mb-0.5" style={INTER}>{s.title}</h4>
                      <p className="text-[11px] text-white leading-relaxed" style={INTER}>{s.body}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between p-3 border border-[#FFB800]/25 bg-[#FFB800]/5">
                <span className="text-xs font-bold text-[#FFB800] uppercase" style={INTER}>SR per recruit</span>
                <span className="text-sm font-black text-[#FFB800]" style={MONO}>+250 SR</span>
              </div>

            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/8 bg-black shrink-0">
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => { onClose(); onNavigateLegal(Screen.PRIVACY); }}
              className="flex-1 py-2.5 border border-white/8 text-[10px] font-bold uppercase tracking-wide text-white hover:text-white transition-colors"
              style={INTER}
            >
              Privacy
            </button>
            <button
              onClick={() => { onClose(); onNavigateLegal(Screen.TERMS); }}
              className="flex-1 py-2.5 border border-white/8 text-[10px] font-bold uppercase tracking-wide text-white hover:text-white transition-colors"
              style={INTER}
            >
              Terms
            </button>
            <a
              href="https://x.com/solraid_app"
              target="_blank"
              rel="noreferrer"
              className="flex-1 py-2.5 bg-white text-black text-[10px] font-bold uppercase tracking-wide hover:bg-gray-200 transition-colors flex items-center justify-center gap-1.5"
              style={INTER}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 shrink-0">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              @solraid_app
            </a>
          </div>
          <p className="text-[9px] text-center text-white" style={INTER}>For entertainment only · Not financial advice</p>
        </div>
      </div>
    </div>
  );
};

export default HowItWorksModal;



