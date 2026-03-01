
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Screen } from '../types';

interface NavigationProps {
  currentScreen: Screen;
  onNavigate: (screen: Screen) => void;
  roundWinCount?: number;
  onOpenSuggestions?: () => void;
}

const Navigation: React.FC<NavigationProps> = ({ currentScreen, onNavigate, roundWinCount = 0, onOpenSuggestions }) => {
  const { t } = useTranslation();
  const [showSuggestLabel, setShowSuggestLabel] = useState(false);

  // Slide in the label 1s after mount, slide out after 3.5s — every page load
  useEffect(() => {
    if (!onOpenSuggestions) return;
    const inTimer  = setTimeout(() => setShowSuggestLabel(true),  1000);
    const outTimer = setTimeout(() => setShowSuggestLabel(false), 4000);
    return () => { clearTimeout(inTimer); clearTimeout(outTimer); };
  }, [onOpenSuggestions]);

  const leftTabs = [
    { label: t('nav.home'),    icon: 'fa-solid fa-house',   screen: Screen.LOBBY      },
    { label: t('nav.market'),  icon: 'fa-solid fa-store',    screen: Screen.STORE      },
  ];
  const rightTabs = [
    { label: t('nav.ranks'),   icon: 'fa-solid fa-trophy',  screen: Screen.TOURNAMENT },
    { label: t('nav.profile'), icon: 'fa-solid fa-user',     screen: Screen.PROFILE    },
  ];

  const handleDeploy = () => {
    onNavigate(Screen.LOBBY);
    window.dispatchEvent(new CustomEvent('solraid:openRaidModal'));
  };

  return (
    <>
      {/* ── MOBILE: fixed bottom bar ── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 w-full z-50"
        style={{ background: 'var(--nav-bg)', paddingBottom: 'max(10px, env(safe-area-inset-bottom, 0px))', borderTop: '1px solid var(--border-col)' }}
      >
        <div className="flex items-end justify-around px-2 pt-2">
          {leftTabs.map(tab => (
            <MobileNavItem
              key={tab.screen}
              label={tab.label}
              icon={tab.icon}
              active={currentScreen === tab.screen}
              onClick={() => onNavigate(tab.screen)}
            />
          ))}

          {/* Centre Deploy button */}
          <div className="flex flex-col items-center -translate-y-3 px-1">
            <button
              onClick={handleDeploy}
              className="rounded-full flex items-center justify-center active:scale-95 transition-transform"
              style={{
                width: '52px', height: '52px',
                background: 'linear-gradient(145deg, #FF2929 0%, #CC0000 100%)',
                boxShadow: '0 0 20px rgba(255,41,41,0.40), 0 4px 16px rgba(0,0,0,0.5)',
              }}
            >
              <i className="fa-solid fa-person-running" style={{ fontSize: '20px', color: '#fff' }} />
            </button>
            <span className="text-[9px] font-medium text-[#FF4444]/80 mt-1">{t('nav.deploy')}</span>
          </div>

          {rightTabs.map(tab => (
            <MobileNavItem
              key={tab.screen}
              label={tab.label}
              icon={tab.icon}
              active={currentScreen === tab.screen}
              onClick={() => onNavigate(tab.screen)}
              badge={tab.screen === Screen.PROFILE && roundWinCount > 0 ? roundWinCount : 0}
            />
          ))}
        </div>
      </nav>

      {/* ── DESKTOP: left sidebar ── */}
      <aside className="hidden md:flex flex-col w-[76px] shrink-0 h-full z-50" style={{ background: 'var(--nav-bg)', borderRight: '1px solid var(--border-col)' }}>
        {/* Logo */}
        <div className="flex items-center justify-center h-[60px] shrink-0" style={{ borderBottom: '1px solid var(--border-col)' }}>
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(255,41,41,0.10)', border: '1px solid rgba(255,41,41,0.28)' }}
          >
            <i className="fa-solid fa-person-running" style={{ fontSize: '16px', color: '#FF2929' }} />
          </div>
        </div>

        {/* Nav items */}
        <div className="flex flex-col items-center gap-0.5 py-3 flex-1">
          {leftTabs.map(tab => (
            <SidebarNavItem
              key={tab.screen}
              label={tab.label}
              icon={tab.icon}
              active={currentScreen === tab.screen}
              onClick={() => onNavigate(tab.screen)}
            />
          ))}

          {/* Deploy button */}
          <div className="my-2 w-full px-3">
            <button
              onClick={handleDeploy}
              className="w-full flex flex-col items-center gap-1.5 py-2.5 rounded-xl active:scale-95 transition-transform"
              style={{
                background: 'linear-gradient(145deg, #FF2929 0%, #CC0000 100%)',
                boxShadow: '0 0 16px rgba(255,41,41,0.35), 0 2px 8px rgba(0,0,0,0.4)',
              }}
            >
              <i className="fa-solid fa-person-running" style={{ fontSize: '18px', color: '#fff' }} />
              <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '11px', color: 'rgba(255,255,255,0.9)', letterSpacing: '1.5px' }}>
                {t('nav.deploy')}
              </span>
            </button>
          </div>

          {rightTabs.map(tab => (
            <SidebarNavItem
              key={tab.screen}
              label={tab.label}
              icon={tab.icon}
              active={currentScreen === tab.screen}
              onClick={() => onNavigate(tab.screen)}
              badge={tab.screen === Screen.PROFILE && roundWinCount > 0 ? roundWinCount : 0}
            />
          ))}
        </div>

        {/* Feedback button — desktop sidebar bottom */}
        {onOpenSuggestions && (
          <div className="shrink-0 pb-4 px-3" style={{ borderTop: '1px solid var(--border-col)' }}>
            <button
              onClick={onOpenSuggestions}
              title="Suggest a feature"
              className="w-full flex flex-col items-center gap-1.5 pt-3 pb-1 active:scale-95 transition-all rounded-xl"
              style={{
                touchAction: 'manipulation',
                boxShadow: showSuggestLabel ? '0 0 14px rgba(255,184,0,0.25)' : 'none',
                transition: 'box-shadow 0.4s',
              }}
            >
              <i
                className="fa-solid fa-lightbulb"
                style={{
                  fontSize: '17px',
                  color: '#FFB800',
                  filter: 'drop-shadow(0 0 5px rgba(255,184,0,0.7))',
                }}
              />
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '8px', color: '#FFB800', letterSpacing: '1px', textTransform: 'uppercase', opacity: 0.75 }}>
                SUGGEST
              </span>
            </button>
          </div>
        )}
      </aside>

      {/* ── MOBILE: floating suggestion button (above nav bar) ── */}
      {onOpenSuggestions && (
        <button
          onClick={onOpenSuggestions}
          title="Suggest a feature"
          className="md:hidden fixed bottom-28 right-3 z-40 flex items-center gap-2 active:scale-95"
          style={{
            touchAction: 'manipulation',
            height: '40px',
            borderRadius: '20px',
            padding: '0 14px 0 10px',
            background: 'rgba(9,9,11,0.95)',
            border: '1px solid rgba(255,184,0,0.55)',
            boxShadow: '0 0 18px rgba(255,184,0,0.35), 0 0 6px rgba(255,184,0,0.2)',
            overflow: 'hidden',
            transition: 'box-shadow 0.3s',
          }}
        >
          <i
            className="fa-solid fa-lightbulb"
            style={{ fontSize: '15px', color: '#FFB800', filter: 'drop-shadow(0 0 6px rgba(255,184,0,0.8))', flexShrink: 0 }}
          />
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '1.5px',
              color: '#FFB800',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
              maxWidth: showSuggestLabel ? '120px' : '0px',
              opacity: showSuggestLabel ? 1 : 0,
              transition: 'max-width 0.45s cubic-bezier(0.4,0,0.2,1), opacity 0.35s ease',
              overflow: 'hidden',
            }}
          >
            Suggestion Box
          </span>
        </button>
      )}
    </>
  );
};

/* ── Mobile bottom nav item ── */
const MobileNavItem: React.FC<{
  label: string; icon: string; active: boolean; onClick: () => void; badge?: number;
}> = ({ label, icon, active, onClick, badge = 0 }) => (
  <button
    onClick={onClick}
    className="flex flex-col items-center flex-1 py-1.5 gap-1 transition-all active:scale-95"
  >
    <div className="relative">
      <i className={icon} style={{ fontSize: '17px', color: active ? 'var(--text-primary)' : 'var(--text-35)', transition: 'color 0.15s' }} />
      {badge > 0 && (
        <span
          className="absolute -top-1 -right-1.5 w-3.5 h-3.5 rounded-full flex items-center justify-center text-black font-black animate-pulse"
          style={{ background: '#14F195', fontSize: '7px', lineHeight: 1 }}
        >
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </div>
    <span style={{ fontSize: '9px', fontWeight: 500, color: active ? 'var(--text-75)' : 'var(--text-30)', transition: 'color 0.15s' }}>
      {label}
    </span>
  </button>
);

/* ── Desktop sidebar nav item ── */
const SidebarNavItem: React.FC<{
  label: string; icon: string; active: boolean; onClick: () => void; badge?: number;
}> = ({ label, icon, active, onClick, badge = 0 }) => (
  <button
    onClick={onClick}
    className="relative w-full flex flex-col items-center gap-1.5 py-2.5 px-2 rounded-xl mx-2 transition-all active:scale-95 group"
    style={{
      background: active ? 'var(--card-bg-strong)' : 'transparent',
      width: 'calc(100% - 16px)',
    }}
  >
    {active && (
      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-[#FF2929]" />
    )}
    <div className="relative">
      <i
        className={icon}
        style={{
          fontSize: '17px',
          color: active ? 'var(--text-primary)' : 'var(--text-30)',
          transition: 'color 0.15s',
        }}
      />
      {badge > 0 && (
        <span
          className="absolute -top-1 -right-1.5 w-3.5 h-3.5 rounded-full flex items-center justify-center text-black font-black animate-pulse"
          style={{ background: '#14F195', fontSize: '7px', lineHeight: 1 }}
        >
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </div>
    <span style={{
      fontSize: '9px',
      fontWeight: 500,
      color: active ? 'var(--text-75)' : 'var(--text-30)',
      transition: 'color 0.15s',
      letterSpacing: '0.2px',
    }}>
      {label}
    </span>
  </button>
);

export default Navigation;
