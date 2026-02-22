
import React, { useState } from 'react';
import { ENTRY_FEES, Mode } from '../types';

interface TeamScreenProps {
  onStartRaid: () => void;
  username?: string;
  walletAddress?: string | null;
}

const SQUAD_FEE = ENTRY_FEES[Mode.TEAM];
const MAX_SQUAD = 4;

// Static open slots for matching display
const OPEN_SLOTS = [
  { label: 'SLOT_02', hint: 'AWAITING OPERATOR' },
  { label: 'SLOT_03', hint: 'AWAITING OPERATOR' },
  { label: 'SLOT_04', hint: 'AWAITING OPERATOR' },
];

// Role badges available to squad members
const ROLES = ['BREACHER', 'SUPPORT', 'RECON', 'MEDIC'] as const;
type Role = typeof ROLES[number];

const ROLE_COLORS: Record<Role, string> = {
  BREACHER: 'text-orange-400 border-orange-500/40 bg-orange-500/10',
  SUPPORT:  'text-cyan-400 border-cyan-500/40 bg-cyan-500/10',
  RECON:    'text-purple-400 border-purple-500/40 bg-purple-500/10',
  MEDIC:    'text-green-400 border-green-500/40 bg-green-500/10',
};

const TeamScreen: React.FC<TeamScreenProps> = ({ onStartRaid, username, walletAddress }) => {
  const [selectedRole, setSelectedRole] = useState<Role>('BREACHER');

  const shortAddr = walletAddress
    ? `${walletAddress.slice(0, 4)}…${walletAddress.slice(-4)}`
    : null;

  const isConnected = !!walletAddress;

  return (
    <div className="h-full flex flex-col animate-in slide-in-from-right duration-300 overflow-hidden">

      {/* ── HEADER ── */}
      <div className="shrink-0 px-5 pt-5 pb-4 border-b border-white/5">
        <div className="flex items-start justify-between mb-1">
          <div>
            <h2 className="text-2xl sm:text-3xl font-black italic uppercase tracking-tighter">
              SQUAD_OPS
            </h2>
            <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.35em] italic mt-0.5">
              _CO-OP RAID PROTOCOL · {MAX_SQUAD}-MAN UNIT
            </p>
          </div>
          {/* Member count badge */}
          <div className="flex items-center gap-1.5 bg-cyan-500/10 border border-cyan-500/30 px-3 py-1.5 tech-border">
            <span className="text-lg font-black text-cyan-400 leading-none mono">1</span>
            <span className="text-[9px] font-black text-cyan-400/60 uppercase tracking-widest">/4</span>
          </div>
        </div>
      </div>

      {/* ── SCROLL BODY ── */}
      <div className="flex-1 overflow-y-auto scrollbar-hide px-5 py-4 pb-36 space-y-5">

        {/* ─── SQUAD ROSTER ─── */}
        <div>
          <p className="text-[9px] font-black text-white/25 uppercase tracking-[0.4em] italic mb-3">
            __ ROSTER
          </p>
          <div className="space-y-2">

            {/* YOU — filled slot */}
            <div className="bg-black border-2 border-cyan-500/30 tech-border p-4 flex items-center gap-4 relative overflow-hidden">
              <div className="absolute inset-0 bg-cyan-500/3 pointer-events-none" />
              {/* Avatar circle */}
              <div className="shrink-0 w-12 h-12 rounded-full bg-cyan-500/15 border-2 border-cyan-500/40 flex items-center justify-center">
                <span className="text-xl font-black text-cyan-300 uppercase">
                  {username?.[0] ?? '?'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <p className="font-black uppercase tracking-tight text-base leading-none truncate">
                    {username || 'OPERATOR'}
                  </p>
                  <span className="text-[8px] font-black bg-cyan-400/15 text-cyan-400 border border-cyan-400/30 px-1.5 py-0.5 uppercase tracking-widest shrink-0">
                    YOU
                  </span>
                  <span className="text-[8px] font-black bg-yellow-400/10 text-yellow-400 border border-yellow-400/20 px-1.5 py-0.5 uppercase tracking-widest shrink-0">
                    HOST
                  </span>
                </div>
                {shortAddr && (
                  <p className="text-[10px] font-mono text-white/25 tracking-widest truncate">{shortAddr}</p>
                )}
              </div>
              {/* Role badge */}
              <div className={`shrink-0 text-[9px] font-black uppercase border px-2 py-1 tracking-widest ${ROLE_COLORS[selectedRole]}`}>
                {selectedRole}
              </div>
            </div>

            {/* OPEN SLOTS */}
            {OPEN_SLOTS.map((slot, i) => (
              <div
                key={i}
                className="border border-dashed border-white/10 p-4 flex items-center gap-4 transition-colors hover:border-white/20"
              >
                <div className="shrink-0 w-12 h-12 rounded-full bg-white/3 border border-dashed border-white/10 flex items-center justify-center">
                  <span className="text-white/15 text-xl font-black">+</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black uppercase tracking-widest text-white/15 italic">
                    {slot.hint}
                  </p>
                  <p className="text-[9px] mono text-white/10 uppercase tracking-widest mt-0.5">{slot.label}</p>
                </div>
                <div className="shrink-0">
                  <div className="w-2 h-2 rounded-full bg-white/10" />
                </div>
              </div>
            ))}

          </div>
        </div>

        {/* ─── ROLE SELECTION ─── */}
        <div>
          <p className="text-[9px] font-black text-white/25 uppercase tracking-[0.4em] italic mb-3">
            __ SELECT ROLE
          </p>
          <div className="grid grid-cols-2 gap-2">
            {ROLES.map(role => (
              <button
                key={role}
                onClick={() => setSelectedRole(role)}
                className={`p-3 tech-border border-2 text-left transition-all ${
                  selectedRole === role
                    ? ROLE_COLORS[role] + ' border-opacity-100'
                    : 'bg-black border-white/10 text-white/30 hover:border-white/20'
                }`}
              >
                <p className={`text-xs font-black uppercase tracking-widest ${selectedRole === role ? '' : 'text-white/25'}`}>
                  {role}
                </p>
                <p className="text-[8px] font-bold uppercase text-white/20 mt-0.5 tracking-wide normal-case italic">
                  {role === 'BREACHER'  && 'High offense. +10% attack dmg'}
                  {role === 'SUPPORT'   && 'Shared shield. Defends 2x'}
                  {role === 'RECON'     && 'Reveals spikes 1s early'}
                  {role === 'MEDIC'     && 'Team risk reduction −5%'}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* ─── SQUAD INTEL ─── */}
        <div className="bg-black border border-white/5 tech-border p-4 space-y-3">
          <p className="text-[9px] font-black text-white/25 uppercase tracking-[0.4em] italic mb-1">
            __ SQUAD INTEL
          </p>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-[9px] text-white/20 font-black uppercase tracking-widest">ENTRY FEE</p>
              <p className="mono font-black text-white mt-0.5">{SQUAD_FEE} SOL<span className="text-white/30 text-[9px]"> / player</span></p>
            </div>
            <div>
              <p className="text-[9px] text-white/20 font-black uppercase tracking-widest">PAYOUT SPLIT</p>
              <p className="mono font-black text-white mt-0.5">EQUAL SHARE</p>
            </div>
            <div>
              <p className="text-[9px] text-white/20 font-black uppercase tracking-widest">BUST PENALTY</p>
              <p className="mono font-black text-red-400 mt-0.5">−25% POOL</p>
            </div>
            <div>
              <p className="text-[9px] text-white/20 font-black uppercase tracking-widest">SQUAD BONUS</p>
              <p className="mono font-black text-cyan-400 mt-0.5">+1.25× POOL</p>
            </div>
          </div>
        </div>

        {/* ─── MATCHMAKING STATUS ─── */}
        <div className="bg-white/3 border border-white/5 p-3 flex items-center gap-3">
          <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse shrink-0" />
          <div>
            <p className="text-[9px] font-black text-yellow-400 uppercase tracking-widest">MATCHMAKING COMING SOON</p>
            <p className="text-[8px] text-white/20 font-black uppercase tracking-widest mt-0.5">
              Share code · Invite direct · Auto-match queue
            </p>
          </div>
        </div>

      </div>

      {/* ── FOOTER ── */}
      <div className="shrink-0 px-5 py-4 border-t border-white/5 bg-black space-y-3">
        {!isConnected && (
          <p className="text-center text-[10px] text-red-400/70 font-black uppercase tracking-widest italic">
            ✗ CONNECT WALLET TO DEPLOY SQUAD
          </p>
        )}
        <button
          onClick={onStartRaid}
          disabled={!isConnected}
          className={`w-full py-5 tech-border font-black uppercase tracking-tight text-xl italic transition-all flex items-center justify-center gap-3 ${
            isConnected
              ? 'bg-cyan-500 text-black active:scale-95 shadow-[0_0_25px_rgba(6,182,212,0.25)]'
              : 'bg-white/5 border border-white/5 text-white/20 cursor-not-allowed'
          }`}
        >
          {isConnected ? '⚡ DEPLOY SQUAD →' : '🔒 WALLET_REQUIRED'}
        </button>
        <p className="text-center text-[9px] text-white/10 font-black uppercase tracking-[0.5em] italic">
          * CO-OP RAID · {SQUAD_FEE} SOL ENTRY · SHARED PAYOUT *
        </p>
      </div>

    </div>
  );
};

export default TeamScreen;
