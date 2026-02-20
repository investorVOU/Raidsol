
import React from 'react';
import { Screen } from '../types';

interface NavigationProps {
  currentScreen: Screen;
  onNavigate: (screen: Screen) => void;
}

const Navigation: React.FC<NavigationProps> = ({ currentScreen, onNavigate }) => {
  return (
    <nav className="fixed bottom-0 left-0 w-full bg-black/95 border-t-2 border-white/10 px-2 py-4 flex justify-between items-center z-50 md:relative md:w-32 md:h-full md:flex-col md:border-t-0 md:border-r-2 md:justify-start md:pt-12 md:gap-8">
      
      <div className="hidden md:flex mb-12 flex-col items-center">
        <span className="text-2xl font-black italic text-cyan-500 tracking-tighter">RAID</span>
        <div className="w-10 h-[2px] bg-white/20 mt-1" />
      </div>

      <div className="flex md:flex-col w-full justify-between md:justify-start md:gap-8 px-4 md:px-0">
        <NavItem 
            label="LOBBY" 
            active={currentScreen === Screen.LOBBY} 
            onClick={() => onNavigate(Screen.LOBBY)} 
        />
        <NavItem 
            label="MARKET" 
            active={currentScreen === Screen.STORE} 
            onClick={() => onNavigate(Screen.STORE)} 
        />
        <NavItem 
            label="SQUAD" 
            active={currentScreen === Screen.TEAM} 
            onClick={() => onNavigate(Screen.TEAM)} 
        />
        <NavItem 
            label="RANKS" 
            active={currentScreen === Screen.TOURNAMENT} 
            onClick={() => onNavigate(Screen.TOURNAMENT)} 
        />
        <NavItem 
            label="VAULT" 
            active={currentScreen === Screen.TREASURY} 
            onClick={() => onNavigate(Screen.TREASURY)} 
        />
        <NavItem 
            label="USER" 
            active={currentScreen === Screen.PROFILE} 
            onClick={() => onNavigate(Screen.PROFILE)} 
        />
      </div>
    </nav>
  );
};

const NavItem: React.FC<{ label: string; active: boolean; onClick: () => void }> = ({ label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center transition-all flex-1 md:flex-none md:w-full py-2 ${active ? 'text-cyan-400' : 'text-white/55 hover:text-white/80'}`}
  >
    <span className={`text-[10px] md:text-sm font-black tracking-[0.2em] uppercase transition-colors ${active ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-white/55'}`}>
      {label}
    </span>
  </button>
);

export default Navigation;
