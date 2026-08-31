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
import { SolanaWalletContext } from './components/SolanaWalletContext';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { SolanaMobileWalletAdapterWalletName } from '@solana-mobile/wallet-standard-mobile';
import { useRoundData } from './hooks/useRoundData';

const isSeekerTwa = () =>
  typeof document !== 'undefined' &&
  document.referrer.startsWith('android-app://') &&
  /android/i.test(typeof navigator !== 'undefined' ? navigator.userAgent : '');

const AppInner: React.FC = () => {
  const { connected, disconnect, publicKey, wallets, select } = useWallet();
  const { setVisible } = useWalletModal();
  const { info: currentRound } = useRoundData();
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

  // Sync wallet connection state with gameState
  useEffect(() => {
    setGameState(prev => ({ ...prev, isConnected: connected }));
  }, [connected]);

  const { connection } = useConnection();

  // Fetch on-connect wallet balance and keep in sync
  useEffect(() => {
    let mounted = true;
    const fetchBalance = async () => {
      if (!publicKey) return;
      try {
        const lamports = await connection.getBalance(publicKey);
        const sol = lamports / LAMPORTS_PER_SOL;
        if (!mounted) return;
        setGameState(prev => ({ ...prev, walletBalance: sol }));
      } catch (err) {
        console.error('Failed to fetch balance', err);
      }
    };
    fetchBalance();
    return () => { mounted = false; };
  }, [publicKey, connection]);

  // Force back to lobby if wallet disconnects while on a protected screen
  useEffect(() => {
    if (!connected && gameState.currentScreen !== Screen.LOBBY) {
      setGameState(prev => ({ ...prev, currentScreen: Screen.LOBBY }));
    }
  }, [connected, gameState.currentScreen]);

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

  const handleConnect = () => {
    if (!isSeekerTwa()) {
      setVisible(true);
      return;
    }

    const mobileWallet = wallets.find(
      ({ adapter }) => adapter.name === SolanaMobileWalletAdapterWalletName,
    );

    if (!mobileWallet) {
      // This should not occur when registerMwa() ran before React mounted, but
      // retain the normal desktop picker as a safe fallback.
      setVisible(true);
      return;
    }

    // Both operations start in this click handler. Calling the MWA adapter
    // directly avoids WalletProvider's post-render auto-connect effect, which
    // loses the user activation required for Android intent navigation in a TWA.
    select(mobileWallet.adapter.name);
    void mobileWallet.adapter.connect().catch((error: unknown) => {
      console.error('Mobile Wallet Adapter connection failed', error);
    });
  };
  const handleDisconnect = () => disconnect();

  // Require wallet helper: returns true if connected, otherwise opens connect modal and returns false
  const requireWallet = (): boolean => {
    if (!connected) {
      handleConnect();
      return false;
    }
    return true;
  };

  const handleUpdateUsername = (name: string) => {
    setGameState(prev => ({ ...prev, username: name }));
  };

  const handleRaidEnd = (success: boolean, solAmount: number, points: number) => {
    const baseSR = success ? 100 : 25;
    const performanceSR = Math.floor(points / 200);
    const totalSREarned = baseSR + performanceSR;

    const raidId = 'RAID-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    const serverSeedHash = Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    const txSignature = Array.from({ length: 88 }, () => Math.floor(Math.random() * 36).toString(36)).join('');
    const userWallet = "8xP...3k9";

    setGameState(prev => ({
      ...prev,
      currentScreen: Screen.RESULT,
      walletBalance: success ? prev.walletBalance : prev.walletBalance - prev.activeRaidFee,
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
      activeRaidBoosts: [],
      activeRoom: undefined
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

  const handlePurchase = (itemId: string, price: number, currency: Currency): boolean => {
    if (!requireWallet()) return false;
    if (currency === Currency.SOL && gameState.walletBalance < price) return false;
    if (currency === Currency.USDC && gameState.usdcBalance < price) return false;
    if (currency === Currency.SKR && gameState.skrBalance < price) return false;

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
    if (!requireWallet()) return;
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
    if (!requireWallet()) return;
    setGameState(prev => {
      const isEquipped = prev.equippedGearIds.includes(gearId);
      if (isEquipped) {
        return {
          ...prev,
          equippedGearIds: prev.equippedGearIds.filter(id => id !== gearId)
        };
      } else {
        if (prev.equippedGearIds.length >= 4) return prev;
        return {
          ...prev,
          equippedGearIds: [...prev.equippedGearIds, gearId],
          srPoints: prev.srPoints + 25
        };
      }
    });
  };

  const handleCreateRoom = (stake: number, maxPlayers: number) => {
    if (!requireWallet()) return;
    if (gameState.walletBalance < stake) {
      alert("INSUFFICIENT FUNDS TO STAKE");
      return;
    }

    const roomId = 'RM-' + Math.floor(Math.random() * 10000);
    const code = 'RAID-' + Math.random().toString(36).substr(2, 4).toUpperCase();

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
    if (!requireWallet()) return;
    if (!code.startsWith("RAID-")) {
      alert("INVALID INVITE CODE");
      return;
    }

    const stake = 0.1;

    if (gameState.walletBalance < stake) {
      alert("INSUFFICIENT FUNDS TO MATCH STAKE (0.1 SOL)");
      return;
    }

    const mockRoom: Room = {
      id: 'RM-' + Math.floor(Math.random() * 9999),
      code,
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
    if (!requireWallet()) return;
    if (!gameState.activeRoom) return;

    const updatedRoom: Room = { ...gameState.activeRoom, status: 'ACTIVE' };
    setGameState(prev => ({
      ...prev,
      activeRoom: updatedRoom,
      currentScreen: Screen.MULTIPLAYER_GAME
    }));
  };

  const enterRaid = (mode: Mode, difficulty: Difficulty = Difficulty.MEDIUM, boosts: string[] = []) => {
    if (!requireWallet()) return;
    if (mode === Mode.PVP) {
      setGameState(prev => ({ ...prev, currentScreen: Screen.MULTIPLAYER_SETUP }));
      return;
    }

    const entryFee = ENTRY_FEES[mode];

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
      activeRaidFee: entryFee,
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
            onConnect={handleConnect}
            onEnterRaid={enterRaid}
            currentRound={currentRound}
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
        return (
          <TeamScreen onStartRaid={() => {
            setGameState(prev => ({ ...prev, activeRaidFee: ENTRY_FEES[Mode.TEAM] }));
            navigateTo(Screen.RAID);
          }} />
        );
      case Screen.TOURNAMENT:
        return (
          <TournamentScreen onEnter={() => {
            setGameState(prev => ({ ...prev, activeRaidFee: ENTRY_FEES[Mode.TOURNAMENT] }));
            navigateTo(Screen.RAID);
          }} />
        );
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
            isConnected={gameState.isConnected}
            onConnect={handleConnect}
            walletAddress={publicKey ? publicKey.toBase58() : null}
            onNavigateStore={() => navigateTo(Screen.STORE)}
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
            onConnect={handleConnect}
            onEnterRaid={enterRaid}
            currentRound={currentRound}
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

  const showNavigation = [
    Screen.LOBBY,
    Screen.TEAM,
    Screen.TOURNAMENT,
    Screen.PROFILE,
    Screen.STORE,
    Screen.TREASURY
  ].includes(gameState.currentScreen);

  return (
    <div className="relative h-screen w-full bg-[#000000] text-white flex flex-col md:flex-row overflow-hidden">
      {!introComplete && (
        <IntroOverlay onComplete={handleIntroFinish} />
      )}
      <div className="absolute inset-0 pixel-grid z-0" />
      {showNavigation && (
        <Navigation
        
        currentScreen={gameState.currentScreen} onNavigate={navigateTo} />
      )}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative z-10">
        <Header
          balance={gameState.walletBalance}
          srPoints={gameState.srPoints}
          currentRank={currentRank}
          isConnected={gameState.isConnected}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
          onOpenHowItWorks={() => setIsHowItWorksOpen(true)}
          walletAddress={publicKey ? publicKey.toBase58() : null}
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

const App: React.FC = () => {
  return (
    <SolanaWalletContext>
      <AppInner />
    </SolanaWalletContext>
  );
};

export default App;
