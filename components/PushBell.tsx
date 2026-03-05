import React, { useState } from 'react';
import { usePushNotifications, PushStatus } from '../hooks/usePushNotifications';

interface PushBellProps {
  walletAddress: string | null;
}

const LABEL: Record<PushStatus, string> = {
  loading:      '',
  unsupported:  'Not supported',
  denied:       'Blocked',
  subscribed:   'On',
  unsubscribed: 'Off',
};

const PushBell: React.FC<PushBellProps> = ({ walletAddress }) => {
  const { status, subscribe, unsubscribe } = usePushNotifications(walletAddress);
  const [busy, setBusy] = useState(false);

  if (status === 'unsupported' || status === 'loading') return null;

  const on = status === 'subscribed';

  const toggle = async () => {
    setBusy(true);
    try { on ? await unsubscribe() : await subscribe(); }
    finally { setBusy(false); }
  };

  return (
    <button
      onClick={toggle}
      disabled={busy || status === 'denied'}
      className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all active:scale-[0.97]"
      style={{
        background: on ? 'rgba(20,241,149,0.08)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${on ? 'rgba(20,241,149,0.22)' : 'rgba(255,255,255,0.10)'}`,
        opacity: busy ? 0.5 : 1,
      }}
      title={status === 'denied' ? 'Notifications blocked in browser settings' : undefined}
    >
      <i className={`fa-solid ${on ? 'fa-bell' : 'fa-bell-slash'} text-[13px]`}
        style={{ color: on ? '#14F195' : 'rgba(255,255,255,0.45)' }} />
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-left"
          style={{ color: on ? '#14F195' : 'rgba(255,255,255,0.55)' }}>
          Push Notifications
        </p>
        <p className="text-[9px] text-left" style={{ color: 'rgba(255,255,255,0.35)' }}>
          {status === 'denied'
            ? 'Enable in browser settings'
            : on
              ? 'Round alerts · daily bounty reminders'
              : 'Tap to enable'}
        </p>
      </div>
      {status !== 'denied' && (
        <div className={`w-8 h-4 rounded-full ml-auto transition-all relative ${on ? 'bg-[#14F195]' : 'bg-white/15'}`}>
          <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all shadow ${on ? 'left-[18px]' : 'left-0.5'}`} />
        </div>
      )}
    </button>
  );
};

export default PushBell;
