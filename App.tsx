
import React, { useState, useEffect, useMemo } from 'react';
import { Screen, Mode, GameState, ENTRY_FEES, AVATAR_ITEMS, RANKS, Rank } from './types';
import LobbyScreen from './screens/LobbyScreen';
import RaidScreen from './screens/RaidScreen';
import TeamScreen from './screens/TeamScreen';
import TournamentScreen from './screens/TournamentScreen';
import ResultScreen from './screens/ResultScreen';
import PrivacyScreen from './screens/PrivacyScreen';
import TermsScreen from './screens/TermsScreen';
import ProfileScreen from './screens/ProfileScreen';
import StoreScreen from './screens/StoreScreen';
import Header from './components/Header';
import Navigation from './components/Navigation';
import HowItWorksModal from './components/HowItWorksModal';
import DisclaimerOverlay from './components/DisclaimerOverlay';
import LevelUpModal from './components/LevelUpModal';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>({
    currentScreen: Screen.LOBBY,
    walletBalance: 1.45,
    unclaimedBalance: 0,
    srPoints: 250, 
    isConnected: false,
    ownedItemIds: [],
    equippedAvatarId: AVATAR_ITEMS[0].id,
    equippedGearIds: [],
    activeRaidFee: ENTRY_FEES[Mode.SOLO]
  });

  const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [newRank, setNewRank] = useState<Rank | null>(null);

  const currentRank = useMemo(() => {
    let best = RANKS[0];
    for (const r of RANKS) {
      if (gameState.srPoints >= r.minSR) {
        best = r;
      } else {
        break;
      }
    }
    return best;
  }, [gameState.srPoints]);

  const [lastLevel, setLastLevel] = useState(currentRank.level);
  useEffect(() => {
    if (currentRank.level > lastLevel) {
      setNewRank(currentRank);
      setLastLevel(currentRank.level);
    }
  }, [currentRank, lastLevel]);

  useEffect(() => {
    const accepted = localStorage.getItem('raid_disclaimer_accepted');
    if (!accepted) {
      setShowDisclaimer(true);
    }
  }, []);

  const handleAcceptDisclaimer = () => {
    localStorage.setItem('raid_disclaimer_accepted', 'true');
    setShowDisclaimer(false);
  };

  const navigateTo = (screen: Screen) => {
    setGameState(prev => ({ ...prev, currentScreen: screen }));
  };

  const toggleConnection = () => {
    setGameState(prev => ({ ...prev, isConnected: !prev.isConnected }));
  };

  const handleRaidEnd = (success: boolean, solAmount: number, points: number) => {
    const baseSR = success ? 100 : 25;
    const performanceSR = Math.floor(points / 200);
    const totalSREarned = baseSR + performanceSR;

    setGameState(prev => ({
      ...prev,
      currentScreen: Screen.RESULT,
      walletBalance: success ? prev.walletBalance : prev.walletBalance - prev.activeRaidFee,
      unclaimedBalance: success ? prev.unclaimedBalance + solAmount : prev.unclaimedBalance,
      srPoints: prev.srPoints + totalSREarned,
      lastResult: { success, solAmount, points, srEarned: totalSREarned }
    }));
  };

  const handleClaim = (amount?: number) => {
    const toClaim = amount !== undefined ? amount : gameState.unclaimedBalance;
    if (toClaim <= 0) return;

    setGameState(prev => ({
      ...prev,
      walletBalance: prev.walletBalance + toClaim,
      unclaimedBalance: Math.max(0, prev.unclaimedBalance - toClaim)
    }));
  };

  const handlePurchase = (itemId: string, price: number) => {
    if (gameState.walletBalance < price) return false;
    const srReward = Math.max(50, Math.floor(price * 1000));

    setGameState(prev => ({
      ...prev,
      walletBalance: prev.walletBalance - price,
      srPoints: prev.srPoints + srReward,
      ownedItemIds: [...prev.ownedItemIds, itemId]
    }));
    return true;
  };

  const handleEquipAvatar = (avatarId: string) => {
    setGameState(prev => {
      if (prev.equippedAvatarId === avatarId) return prev;
      return { 
        ...prev, 
        equippedAvatarId: avatarId,
        srPoints: prev.srPoints + 50 
      };
    });
  };

  const handleToggleGear = (gearId: string) => {
    setGameState(prev => {
      const isEquipped = prev.equippedGearIds.includes(gearId);
      if (isEquipped) {
        return {
          ...prev,
          equippedGearIds: prev.equippedGearIds.filter(id => id !== gearId)
        };
      } else {
        // Limit to 4 active gear slots
        if (prev.equippedGearIds.length >= 4) return prev;
        return {
          ...prev,
          equippedGearIds: [...prev.equippedGearIds, gearId],
          srPoints: prev.srPoints + 25
        };
      }
    });
  };

  const enterRaid = (mode: Mode) => {
    setGameState(prev => ({ ...prev, activeRaidFee: ENTRY_FEES[mode] }));
    if (mode === Mode.TEAM) navigateTo(Screen.TEAM);
    else if (mode === Mode.TOURNAMENT) navigateTo(Screen.TOURNAMENT);
    else navigateTo(Screen.RAID);
  };

  const renderScreen = () => {
    switch (gameState.currentScreen) {
      case Screen.LOBBY:
        return (
          <LobbyScreen 
            isConnected={gameState.isConnected}
            onConnect={toggleConnection}
            onEnterRaid={enterRaid}
            currentLevel={currentRank.level}
          />
        );
      case Screen.RAID:
        return (
          <RaidScreen 
            onFinish={handleRaidEnd} 
            equippedGearIds={gameState.equippedGearIds} 
            entryFee={gameState.activeRaidFee} 
          />
        );
      case Screen.TEAM:
        return <TeamScreen onStartRaid={() => {
          setGameState(prev => ({ ...prev, activeRaidFee: ENTRY_FEES[Mode.TEAM] }));
          navigateTo(Screen.RAID);
        }} />;
      case Screen.TOURNAMENT:
        return <TournamentScreen onEnter={() => {
          setGameState(prev => ({ ...prev, activeRaidFee: ENTRY_FEES[Mode.TOURNAMENT] }));
          navigateTo(Screen.RAID);
        }} />;
      case Screen.RESULT:
        return (
          <ResultScreen 
            result={gameState.lastResult!} 
            entryFee={gameState.activeRaidFee}
            onPlayAgain={() => navigateTo(Screen.LOBBY)} 
            onClaim={() => {
              handleClaim(gameState.lastResult?.solAmount);
              navigateTo(Screen.LOBBY);
            }}
          />
        );
      case Screen.PRIVACY:
        return <PrivacyScreen onBack={() => navigateTo(Screen.LOBBY)} />;
      case Screen.TERMS:
        return <TermsScreen onBack={() => navigateTo(Screen.LOBBY)} />;
      case Screen.PROFILE:
        return (
          <ProfileScreen 
            balance={gameState.walletBalance} 
            unclaimedBalance={gameState.unclaimedBalance}
            srPoints={gameState.srPoints}
            onClaim={handleClaim}
            ownedItemIds={gameState.ownedItemIds}
            equippedAvatarId={gameState.equippedAvatarId}
            equippedGearIds={gameState.equippedGearIds}
            onEquipAvatar={handleEquipAvatar}
            onToggleGear={handleToggleGear}
          />
        );
      case Screen.STORE:
        return (
          <StoreScreen 
            walletBalance={gameState.walletBalance}
            ownedItemIds={gameState.ownedItemIds}
            onPurchase={handlePurchase}
            currentLevel={currentRank.level}
          />
        );
      default:
        return <LobbyScreen isConnected={gameState.isConnected} onConnect={toggleConnection} onEnterRaid={enterRaid} currentLevel={currentRank.level} />;
    }
  };

  const showNavigation = [Screen.LOBBY, Screen.TEAM, Screen.TOURNAMENT, Screen.PROFILE, Screen.STORE].includes(gameState.currentScreen);

  return (
    <div className="relative h-screen w-full bg-[#000000] text-white flex flex-col md:flex-row overflow-hidden">
      <div className="absolute inset-0 pixel-grid z-0" />
      
      {showNavigation && (
        <Navigation currentScreen={gameState.currentScreen} onNavigate={navigateTo} />
      )}

      <div className="flex-1 flex flex-col h-full overflow-hidden relative z-10">
        <Header 
          balance={gameState.walletBalance} 
          srPoints={gameState.srPoints}
          currentRank={currentRank}
          isConnected={gameState.isConnected} 
          onConnect={toggleConnection}
          onOpenHowItWorks={() => setIsHowItWorksOpen(true)}
        />
        
        <main className="flex-1 relative overflow-hidden">
          {renderScreen()}
        </main>
      </div>

      <HowItWorksModal 
        isOpen={isHowItWorksOpen} 
        onClose={() => setIsHowItWorksOpen(false)} 
        onNavigateLegal={navigateTo}
      />

      {showDisclaimer && (
        <DisclaimerOverlay onAccept={handleAcceptDisclaimer} />
      )}

      {newRank && (
        <LevelUpModal rank={newRank} onClose={() => setNewRank(null)} />
      )}
    </div>
  );
};

export default App;
