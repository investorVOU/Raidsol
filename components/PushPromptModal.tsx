import React, { useState } from 'react';

interface PushPromptModalProps {
  onEnable: () => Promise<boolean>;
  onDismiss: () => void;
}

const BENEFITS = [
  { icon: 'fa-clock',  color: '#9945FF', text: 'Round competition alerts' },
  { icon: 'fa-coins',  color: '#FFB800', text: 'Daily bounty reminders' },
  { icon: 'fa-trophy', color: '#14F195', text: 'Leaderboard rank updates' },
];

const PushPromptModal: React.FC<PushPromptModalProps> = ({ onEnable, onDismiss }) => {
  const [busy, setBusy] = useState(false);

  const handleEnable = async () => {
    setBusy(true);
    await onEnable();
    setBusy(false);
  };

  return (
    <div
      className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300"
        style={{ background: '#080820', border: '1px solid rgba(153,69,255,0.30)', boxShadow: '0 0 48px rgba(153,69,255,0.12)' }}
      >
        {/* Top accent */}
        <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, #9945FF, #14F195)' }} />

        <div className="p-6 flex flex-col gap-5">
          {/* Icon + headline */}
          <div className="flex flex-col items-center gap-3 text-center">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(153,69,255,0.12)', border: '1px solid rgba(153,69,255,0.28)' }}
            >
              <i className="fa-solid fa-bell text-2xl" style={{ color: '#9945FF' }} />
            </div>
            <div>
              <p className="text-lg font-black text-white leading-tight"
                style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.5px' }}>
                STAY IN THE LOOP
              </p>
              <p className="text-[12px] mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
                Never miss a round or bounty drop
              </p>
            </div>
          </div>

          {/* Benefits */}
          <ul className="flex flex-col gap-2.5">
            {BENEFITS.map(({ icon, color, text }) => (
              <li key={text} className="flex items-center gap-3">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: `${color}18`, border: `1px solid ${color}35` }}
                >
                  <i className={`fa-solid ${icon} text-[11px]`} style={{ color }} />
                </div>
                <span className="text-[13px]" style={{ color: 'rgba(255,255,255,0.70)' }}>{text}</span>
              </li>
            ))}
          </ul>

          {/* CTAs */}
          <div className="flex flex-col gap-2">
            <button
              onClick={handleEnable}
              disabled={busy}
              className="w-full py-3.5 rounded-xl font-black text-sm text-white transition-all active:scale-[0.97]"
              style={{
                background: busy ? 'rgba(153,69,255,0.5)' : '#9945FF',
                fontFamily: "'Space Grotesk', sans-serif",
                letterSpacing: '0.6px',
              }}
            >
              {busy ? 'ENABLING...' : 'ENABLE NOTIFICATIONS'}
            </button>
            <button
              onClick={onDismiss}
              className="w-full py-2 text-[12px] transition-colors"
              style={{ color: 'rgba(255,255,255,0.30)' }}
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PushPromptModal;
