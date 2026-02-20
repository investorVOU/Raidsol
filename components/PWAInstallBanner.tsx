import React, { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'solraid-pwa-dismissed';

const PWAInstallBanner: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIos, setShowIos] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(DISMISSED_KEY) === 'true'
  );

  useEffect(() => {
    // Already running as installed PWA — don't show
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true);
      return;
    }

    // Android / Chrome / Edge: capture the install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // iOS Safari: show manual "Add to Home Screen" hint
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    if (isIos && isSafari) setShowIos(true);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstalled(true);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, 'true');
    setDismissed(true);
  };

  if (installed || dismissed) return null;
  if (!deferredPrompt && !showIos) return null;

  return (
    <div
      className="fixed bottom-20 md:bottom-4 left-1/2 -translate-x-1/2 z-[150] w-[calc(100%-2rem)] max-w-sm"
      style={{
        background: 'linear-gradient(135deg, #020202 0%, #060f08 100%)',
        border: '1px solid rgba(20,241,149,0.35)',
        boxShadow: '0 0 24px rgba(20,241,149,0.15), 0 4px 24px rgba(0,0,0,0.8)',
      }}
    >
      {/* Top accent */}
      <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, #9945FF, #14F195)' }} />

      <div className="p-4 flex items-center gap-4">
        {/* Icon */}
        <div
          className="flex-shrink-0 w-12 h-12 flex items-center justify-center border border-[#14F195]/30"
          style={{ background: '#020202' }}
        >
          <img src="/icon.svg" alt="Solana Raid" className="w-9 h-9" />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-black text-white uppercase tracking-[0.2em] leading-tight">
            INSTALL_SOLANA_RAID
          </p>
          {showIos ? (
            <p className="text-[9px] text-white/40 font-mono mt-0.5 leading-snug">
              Tap <span className="text-[#14F195]">Share</span> → <span className="text-[#14F195]">Add to Home Screen</span>
            </p>
          ) : (
            <p className="text-[9px] text-white/40 font-mono mt-0.5">
              Play offline · Fast load · No browser UI
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {!showIos && (
            <button
              onClick={handleInstall}
              className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider bg-[#14F195] text-black transition-all active:scale-95 hover:bg-[#0fd880]"
            >
              INSTALL
            </button>
          )}
          <button
            onClick={handleDismiss}
            className="w-6 h-6 flex items-center justify-center text-white/30 hover:text-white/70 transition-colors text-lg leading-none"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
};

export default PWAInstallBanner;
