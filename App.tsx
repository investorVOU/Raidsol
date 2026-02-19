
import React, { useState, useEffect, useMemo } from 'react';
import { Screen, Mode, GameState, ENTRY_FEES, AVATAR_ITEMS, RANKS, Rank, Difficulty, Currency, RAID_BOOSTS, Room } from './types';
import LobbyScreen from './screens/LobbyScreen';
import RaidScreen from './screens/RaidScreen';
import TeamScreen from './screens/TeamScreen';
import TournamentScreen from './screens/TournamentScreen';
import ResultScreen from './screens/ResultScreen';
import PrivacyScreen from './screens/PrivacyScreen';
import TermsScreen from './screens/TermsScreen';
import ProfileScreen from './screens/ProfileScreen';
import StoreScreen from './screens/StoreScreen';
import TreasuryScreen from './screens/TreasuryScreen';
import MultiplayerSetupScreen from './screens/MultiplayerSetupScreen';
import MultiplayerRaidScreen from './screens/MultiplayerRaidScreen';
import Header from './components/Header';
import Navigation from './components/Navigation';
import HowItWorksModal from './components/HowItWorksModal';
import LevelUpModal from './components/LevelUpModal';
import IntroOverlay from './components/IntroOverlay';

const App: React.FC = () => {
  const [introComplete, setIntroComplete] = useState(false);
  
  const [gameState, setGameState] = useState<GameState>({
    currentScreen: Screen.LOBBY,
    walletBalance: 1.45,
    usdcBalance: 250.50,
    skrBalance: 5000,
    unclaimedBalance: 0,
    srPoints: 250, 
    isConnected: false,
    username: 'USER_42',
    ownedItemIds: [],
    equippedAvatarId: AVATAR_ITEMS[0].id,
    equippedGearIds: [],
    activeRaidFee: ENTRY_FEES[Mode.SOLO],
    activeRaidDifficulty: Difficulty.MEDIUM,
    activeRaidBoosts: []
  });

  const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(false);
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

  // Handle intro sequence
  useEffect(() => {
    // Check if we've seen the intro this session
    const sessionIntro = sessionStorage.getItem('raid_intro_seen');
    if (sessionIntro) {
      setIntroComplete(true);
    }
  }, []);

  const handleIntroFinish = () => {
    sessionStorage.setItem('raid_intro_seen', 'true');
    setIntroComplete(true);
  };

  const navigateTo = (screen: Screen) => {
    setGameState(prev => ({ ...prev, currentScreen: screen }));
  };

  const toggleConnection = () => {
    setGameState(prev => ({ ...prev, isConnected: !prev.isConnected }));
  };

  const handleUpdateUsername = (name: string) => {
    setGameState(prev => ({ ...prev, username: name }));
  };

  const handleRaidEnd = (success: boolean, solAmount: number, points: number) => {
    const baseSR = success ? 100 : 25;
    const performanceSR = Math.floor(points / 200);
    const totalSREarned = baseSR + performanceSR;

    // Generate mock verification data
    const raidId = 'RAID-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    const serverSeedHash = Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join('');
    const txSignature = Array.from({length: 88}, () => Math.floor(Math.random()*36).toString(36)).join('');
    const userWallet = "8xP...3k9";

    setGameState(prev => ({
      ...prev,
      currentScreen: Screen.RESULT,
      walletBalance: success ? prev.walletBalance : prev.walletBalance - prev.activeRaidFee, // Fee already deducted on start in reality, but logic here simplifies flow to result
      unclaimedBalance: success ? prev.unclaimedBalance + solAmount : prev.unclaimedBalance,
      srPoints: prev.srPoints + totalSREarned,
      lastResult: { 
        success, 
        solAmount, 
        points, 
        srEarned: totalSREarned,
        raidId,
        serverSeedHash,
        userWallet,
        txSignature
      },
      activeRaidBoosts: [], // Reset boosts after raid
      activeRoom: undefined // Clear room after raid
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

  const handlePurchase = (itemId: string, price: number, currency: Currency) => {
    // Check balances based on currency
    if (currency === Currency.SOL && gameState.walletBalance < price) return false;
    if (currency === Currency.USDC && gameState.usdcBalance < price) return false;
    if (currency === Currency.SKR && gameState.skrBalance < price) return false;

    // Convert price to SOL equivalent for SR points calculation logic mostly
    const srReward = Math.max(50, Math.floor(price * (currency === Currency.SOL ? 1000 : currency === Currency.USDC ? 6 : 1))); 

    setGameState(prev => ({
      ...prev,
      walletBalance: currency === Currency.SOL ? prev.walletBalance - price : prev.walletBalance,
      usdcBalance: currency === Currency.USDC ? prev.usdcBalance - price : prev.usdcBalance,
      skrBalance: currency === Currency.SKR ? prev.skrBalance - price : prev.skrBalance,
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

  // --- MULTIPLAYER HANDLERS ---
  const handleCreateRoom = (stake: number, maxPlayers: number) => {
    if (gameState.walletBalance < stake) {
      alert("INSUFFICIENT FUNDS TO STAKE");
      return;
    }

    const roomId = 'RM-' + Math.floor(Math.random() * 10000);
    const code = 'RAID-' + Math.random().toString(36).substr(2, 4).toUpperCase();
    
    // Create room and deduct stake immediately (escrow simulation)
    const newRoom: Room = {
      id: roomId,
      code,
      hostId: 'USER_ME',
      stakePerPlayer: stake,
      maxPlayers,
      players: [{ id: 'USER_ME', name: 'YOU (HOST)', status: 'WAITING', score: 0, solResult: 0 }],
      status: 'LOBBY',
      poolTotal: stake,
      seed: Math.random().toString(36)
    };

    setGameState(prev => ({
      ...prev,
      walletBalance: prev.walletBalance - stake,
      activeRoom: newRoom,
      currentScreen: Screen.MULTIPLAYER_SETUP
    }));
  };

  const handleJoinRoom = (code: string) => {
    // Simulate finding a room
    // For demo: assume any code starting with RAID works, or we find the current active room if it exists locally (unlikely in real app but good for demo flow if self-joining)
    // To make it playable, we just create a mock room if the user enters a valid looking code
    
    if (!code.startsWith("RAID-")) {
      alert("INVALID INVITE CODE");
      return;
    }

    const stake = 0.1; // Default mock stake for joiners

    if (gameState.walletBalance < stake) {
       alert("INSUFFICIENT FUNDS TO MATCH STAKE (0.1 SOL)");
       return;
    }

    const mockRoom: Room = {
      id: 'RM-' + Math.floor(Math.random() * 9999),
      code: code,
      hostId: 'HOST_BOT',
      stakePerPlayer: stake,
      maxPlayers: 4,
      players: [
         { id: 'HOST_BOT', name: 'Ghost_Protocol', status: 'WAITING', score: 0, solResult: 0 },
         { id: 'USER_ME', name: 'YOU', status: 'WAITING', score: 0, solResult: 0 }
      ],
      status: 'LOBBY',
      poolTotal: stake * 2,
      seed: Math.random().toString(36)
    };

    setGameState(prev => ({
      ...prev,
      walletBalance: prev.walletBalance - stake,
      activeRoom: mockRoom,
      currentScreen: Screen.MULTIPLAYER_SETUP
    }));
  };

  const handleStartMultiplayerRaid = () => {
    if (!gameState.activeRoom) return;
    
    // Lock the room
    const updatedRoom: Room = { ...gameState.activeRoom, status: 'ACTIVE' };
    setGameState(prev => ({
       ...prev,
       activeRoom: updatedRoom,
       currentScreen: Screen.MULTIPLAYER_GAME
    }));
  };

  const enterRaid = (mode: Mode, difficulty: Difficulty = Difficulty.MEDIUM, boosts: string[] = []) => {
    // Intercept PVP mode
    if (mode === Mode.PVP) {
      setGameState(prev => ({ ...prev, currentScreen: Screen.MULTIPLAYER_SETUP }));
      return;
    }

    const entryFee = ENTRY_FEES[mode];
    
    // Calculate boost cost
    let boostCost = 0;
    boosts.forEach(bId => {
      const boost = RAID_BOOSTS.find(b => b.id === bId);
      if (boost) boostCost += boost.cost;
    });

    const totalCost = entryFee + boostCost;

    if (gameState.walletBalance < totalCost) {
      alert("INSUFFICIENT FUNDS FOR DEPLOYMENT");
      return;
    }

    setGameState(prev => ({ 
      ...prev, 
      activeRaidFee: entryFee, // Only store entry fee as "stake" potentially, or track separately? 
      // For simplicity, we just deduct fee + boosts immediately from wallet
      walletBalance: prev.walletBalance - totalCost,
      activeRaidDifficulty: difficulty,
      activeRaidBoosts: boosts
    }));
    
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
            equippedGearIds={gameState.equippedGearIds}
            equippedAvatarId={gameState.equippedAvatarId}
            ownedItemIds={gameState.ownedItemIds}
            onToggleGear={handleToggleGear}
            onEquipAvatar={handleEquipAvatar}
            onNavigateTreasury={() => navigateTo(Screen.TREASURY)}
          />
        );
      case Screen.RAID:
        return (
          <RaidScreen 
            onFinish={handleRaidEnd} 
            equippedGearIds={gameState.equippedGearIds} 
            entryFee={gameState.activeRaidFee} 
            difficulty={gameState.activeRaidDifficulty}
            activeBoosts={gameState.activeRaidBoosts}
            equippedAvatarId={gameState.equippedAvatarId}
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
            username={gameState.username}
            onUpdateUsername={handleUpdateUsername}
          />
        );
      case Screen.STORE:
        return (
          <StoreScreen 
            walletBalance={gameState.walletBalance}
            usdcBalance={gameState.usdcBalance}
            skrBalance={gameState.skrBalance}
            ownedItemIds={gameState.ownedItemIds}
            onPurchase={handlePurchase}
            currentLevel={currentRank.level}
          />
        );
      case Screen.TREASURY:
          return <TreasuryScreen onBack={() => navigateTo(Screen.LOBBY)} />;
      case Screen.MULTIPLAYER_SETUP:
        return (
          <MultiplayerSetupScreen
            onBack={() => navigateTo(Screen.LOBBY)}
            onCreateRoom={handleCreateRoom}
            onJoinRoom={handleJoinRoom}
            activeRoom={gameState.activeRoom}
            onStartGame={handleStartMultiplayerRaid}
            currentWalletBalance={gameState.walletBalance}
          />
        );
      case Screen.MULTIPLAYER_GAME:
        return (
          <MultiplayerRaidScreen
            room={gameState.activeRoom!}
            equippedGearIds={gameState.equippedGearIds}
            onFinish={handleRaidEnd}
          />
        );
      default:
        return (
          <LobbyScreen 
            isConnected={gameState.isConnected} 
            onConnect={toggleConnection} 
            onEnterRaid={enterRaid} 
            currentLevel={currentRank.level} 
            equippedGearIds={gameState.equippedGearIds}
            equippedAvatarId={gameState.equippedAvatarId}
            ownedItemIds={gameState.ownedItemIds}
            onToggleGear={handleToggleGear}
            onEquipAvatar={handleEquipAvatar}
            onNavigateTreasury={() => navigateTo(Screen.TREASURY)}
          />
        );
    }
  };

  const showNavigation = [Screen.LOBBY, Screen.TEAM, Screen.TOURNAMENT, Screen.PROFILE, Screen.STORE, Screen.TREASURY].includes(gameState.currentScreen);

  return (
    <div className="relative h-screen w-full bg-[#000000] text-white flex flex-col md:flex-row overflow-hidden">
      
      {/* INTRO SPLASH */}
      {!introComplete && (
        <IntroOverlay onComplete={handleIntroFinish} />
      )}
      
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

      {newRank && (
        <LevelUpModal rank={newRank} onClose={() => setNewRank(null)} />
      )}
    </div>
  );
};

export default App;
