
import React from 'react';
import { Screen } from '../types';

interface NavigationProps {
  currentScreen: Screen;
  onNavigate: (screen: Screen) => void;
}

const Navigation: React.FC<NavigationProps> = ({ currentScreen, onNavigate }) => {
  const leftTabs = [
    { label: 'Home',   icon: 'fa-solid fa-house',  screen: Screen.LOBBY      },
    { label: 'Market', icon: 'fa-solid fa-store',   screen: Screen.STORE      },
  ];
  const rightTabs = [
    { label: 'Ranks',   icon: 'fa-solid fa-trophy', screen: Screen.TOURNAMENT },
    { label: 'Profile', icon: 'fa-solid fa-user',   screen: Screen.PROFILE    },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 w-full bg-[#07070f] z-50 md:relative md:w-28 md:h-full md:flex-col md:border-r md:border-white/8"
      style={{ paddingBottom: 'max(10px, env(safe-area-inset-bottom, 0px))' }}
    >

      {/* ── MOBILE: 5-item row with raised center RAID button ── */}
      <div className="flex items-end justify-around px-2 pt-2 md:hidden">
        {leftTabs.map(tab => (
          <NavItem
            key={tab.screen}
            label={tab.label}
            icon={tab.icon}
            active={currentScreen === tab.screen}
            onClick={() => onNavigate(tab.screen)}
          />
        ))}

        {/* Centre RAID button — raised above the bar */}
        <div className="flex flex-col items-center -translate-y-3 px-1">
          <button
            onClick={() => {
              onNavigate(Screen.LOBBY);
              window.dispatchEvent(new CustomEvent('solraid:openRaidModal'));
            }}
            className="rounded-full flex items-center justify-center active:scale-95 transition-transform"
            style={{
              width: '52px', height: '52px',
              background: 'linear-gradient(145deg, #1aff9f 0%, #0bbf75 100%)',
              boxShadow: '0 0 20px rgba(20,241,149,0.3), 0 4px 16px rgba(0,0,0,0.5)',
            }}
          >
            <i className="fa-solid fa-person-running" style={{ fontSize: '20px', color: '#000' }} />
          </button>
          <span className="text-[9px] font-medium text-[#14F195]/60 mt-1">Deploy</span>
        </div>

        {rightTabs.map(tab => (
          <NavItem
            key={tab.screen}
            label={tab.label}
            icon={tab.icon}
            active={currentScreen === tab.screen}
            onClick={() => onNavigate(tab.screen)}
          />
        ))}
      </div>

      {/* ── DESKTOP: sidebar ── */}
      <div className="hidden md:flex flex-col h-full pt-10 gap-5 px-2 items-center">
        <div className="mb-4">
          <span className="text-base font-black text-white/80 tracking-tight">RAID</span>
          <div className="w-8 h-px bg-white/15 mx-auto mt-1" />
        </div>
        {[...leftTabs, { label: 'Raid', icon: 'fa-solid fa-bolt', screen: Screen.LOBBY }, ...rightTabs].map((tab, i) => (
          <NavItem
            key={tab.screen + i}
            label={tab.label}
            icon={tab.icon}
            active={currentScreen === tab.screen && tab.label !== 'Raid'}
            onClick={() => onNavigate(tab.screen)}
          />
        ))}
      </div>
    </nav>
  );
};

const NavItem: React.FC<{ label: string; icon: string; active: boolean; onClick: () => void }> = ({
  label, icon, active, onClick,
}) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center flex-1 md:flex-none md:w-full py-1.5 gap-1 transition-all active:scale-95`}
  >
    <i
      className={icon}
      style={{
        fontSize: '17px',
        color: active ? '#ffffff' : 'rgba(255,255,255,0.35)',
        transition: 'color 0.15s',
      }}
    />
    <span
      style={{
        fontSize: '9px',
        fontWeight: 500,
        color: active ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.3)',
        transition: 'color 0.15s',
      }}
    >
      {label}
    </span>
  </button>
);

export default Navigation;
