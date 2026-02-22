import React, { useState, useEffect, useMemo, useRef, useCallback, lazy, Suspense } from 'react';
import { Screen, Mode, GameState, ENTRY_FEES, AVATAR_ITEMS, RANKS, Rank, Difficulty, Currency, CURRENCY_RATES, RAID_BOOSTS, RAID_PASSES, Room, Opponent } from './types';
const LobbyScreen = lazy(() => import('./screens/LobbyScreen'));
const RaidScreen = lazy(() => import('./screens/RaidScreen'));
const TeamScreen = lazy(() => import('./screens/TeamScreen'));
const TournamentScreen = lazy(() => import('./screens/TournamentScreen'));
const ResultScreen = lazy(() => import('./screens/ResultScreen'));
const PrivacyScreen = lazy(() => import('./screens/PrivacyScreen'));
const TermsScreen = lazy(() => import('./screens/TermsScreen'));
const ProfileScreen = lazy(() => import('./screens/ProfileScreen'));
const StoreScreen = lazy(() => import('./screens/StoreScreen'));
const TreasuryScreen = lazy(() => import('./screens/TreasuryScreen'));
const MultiplayerSetupScreen = lazy(() => import('./screens/MultiplayerSetupScreen'));
const MultiplayerRaidScreen = lazy(() => import('./screens/MultiplayerRaidScreen'));
import Header from './components/Header';
import Navigation from './components/Navigation';
const HowItWorksModal = lazy(() => import('./components/HowItWorksModal'));
import RaidLoadingScreen from './components/RaidLoadingScreen';
const LevelUpModal = lazy(() => import('./components/LevelUpModal'));
const PvpWinnerModal = lazy(() => import('./components/PvpWinnerModal'));
const PWAInstallBanner = lazy(() => import('./components/PWAInstallBanner'));
const IntroOverlay = lazy(() => import('./components/IntroOverlay'));
import { SolanaWalletContext } from './components/SolanaWalletContext';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { LAMPORTS_PER_SOL, Transaction, SystemProgram, PublicKey, Connection } from '@solana/web3.js';
import { getRpcList, makeConnection } from './lib/rpc';
import { getAssociatedTokenAddressSync, createTransferInstruction } from '@solana/spl-token';
import { useProfile } from './hooks/useProfile';
import { useDomainName } from './hooks/useDomainName';
import { supabase } from './lib/supabase';

// USDC mint — mainnet by default (VITE_USDC_MINT), falls back to devnet Circle mint
const USDC_MINT = new PublicKey(
  import.meta.env.VITE_USDC_MINT ?? 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
);

// Seeker SKR token mint (from env for easy swap)
const SKR_MINT = new PublicKey(
  import.meta.env.VITE_SKR_MINT ?? 'SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3'
);
const SKR_DECIMALS = 6;


const AppInner: React.FC = () => {
  const { connected, disconnect, publicKey, sendTransaction, signMessage } = useWallet();
  const { setVisible } = useWalletModal();
  const [introComplete, setIntroComplete] = useState(
    () => localStorage.getItem('solraid-intro-dismissed') === 'true'
  );

  // Read referral code from URL once on mount (?ref=CODE)
  const incomingRefCode = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('ref');
  }, []);

  const walletAddr = publicKey ? publicKey.toBase58() : null;
  const { profile, loading: profileLoading, updateProfile } = useProfile(walletAddr, incomingRefCode);
  // Resolved once here — passed as prop to Header + ProfileScreen to avoid duplicate API calls
  const domainName = useDomainName(walletAddr);

  // Screens that are safe to restore on reload (mid-game states are excluded)
  const RESTORABLE_SCREENS = new Set<Screen>([
    Screen.LOBBY, Screen.STORE, Screen.TREASURY, Screen.PROFILE,
    Screen.TEAM, Screen.TOURNAMENT, Screen.PRIVACY, Screen.TERMS,
    Screen.MULTIPLAYER_SETUP,
  ]);

  const [gameState, setGameState] = useState<GameState>(() => {
    const savedScreen = sessionStorage.getItem('solraid-screen') as Screen | null;
    const restoredScreen = savedScreen && RESTORABLE_SCREENS.has(savedScreen) ? savedScreen : Screen.LOBBY;
    return {
      currentScreen: restoredScreen,
      walletBalance: 0,
      usdcBalance: 0,
      skrBalance: 0,
      unclaimedBalance: 0,
      srPoints: 0,
      isConnected: false,
      username: '',
      ownedItemIds: [],
      equippedAvatarId: '',
      equippedGearIds: [],
      activeRaidFee: ENTRY_FEES[Mode.SOLO],
      activeRaidDifficulty: Difficulty.MEDIUM,
      activeRaidBoosts: [],
      raidTickets: 0,
      lastFreeTicketDate: null,
      ticketBoostActive: false,
      raidStreak: 0,
      bustTimestamps: [],
      lastFreeRaidDate: null,
      activeStreakBonus: 0,
    };
  });

  // Persist current screen to sessionStorage so reload restores it
  useEffect(() => {
    sessionStorage.setItem('solraid-screen', gameState.currentScreen);
  }, [gameState.currentScreen]);

  // Sync wallet connection state with gameState
  useEffect(() => {
    setGameState(prev => ({ ...prev, isConnected: connected }));
  }, [connected]);


  const { connection } = useConnection();

  /**
   * Try getLatestBlockhash + sendTransaction across all RPC endpoints in order.
   * Wallet-rejection errors are re-thrown immediately (no retry).
   */
  const sendWithFallback = useCallback(
    async (tx: Transaction): Promise<{ sig: string; conn: Connection }> => {
      const rpcs = getRpcList();
      let lastErr: unknown;
      for (const url of rpcs) {
        try {
          const conn = makeConnection(url);
          const { blockhash } = await conn.getLatestBlockhash('confirmed');
          tx.recentBlockhash = blockhash;
          tx.feePayer = publicKey!;
          const sig = await sendTransaction(tx, conn);
          return { sig, conn };
        } catch (err) {
          const msg = String(err);
          if (
            msg.includes('User rejected') ||
            msg.includes('WalletSign') ||
            msg.includes('dismissed') ||
            msg.includes('WalletNotReady')
          ) throw err; // wallet error — don't retry
          console.warn('[RPC] endpoint failed, trying next:', url, err);
          lastErr = err;
        }
      }
      throw lastErr;
    },
    [publicKey, sendTransaction],
  );

  // Resolve treasury public key from env
  const TREASURY_PUBKEY = useMemo(() => {
    const addr = import.meta.env.VITE_TREASURY_ADDRESS;
    if (!addr || addr === 'YOUR_TREASURY_WALLET_PUBLIC_KEY_HERE') return null;
    try { return new PublicKey(addr); } catch { return null; }
  }, []);

  // Fetch SOL balance on connect / publicKey change
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
        console.error('Failed to fetch SOL balance', err);
      }
    };
    fetchBalance();
    return () => { mounted = false; };
  }, [publicKey, connection]);

  // Fetch USDC balance on connect / publicKey change
  useEffect(() => {
    let mounted = true;
    const fetchUsdcBalance = async () => {
      if (!publicKey) return;
      try {
        const ata = getAssociatedTokenAddressSync(USDC_MINT, publicKey);
        const bal = await connection.getTokenAccountBalance(ata);
        if (!mounted) return;
        setGameState(prev => ({ ...prev, usdcBalance: Number(bal.value.uiAmount ?? 0) }));
      } catch {
        if (mounted) setGameState(prev => ({ ...prev, usdcBalance: 0 }));
      }
    };
    fetchUsdcBalance();
    return () => { mounted = false; };
  }, [publicKey, connection]);

  // Fetch on-chain Seeker SKR token balance on connect / publicKey change
  useEffect(() => {
    let mounted = true;
    const fetchSkrBalance = async () => {
      if (!publicKey) return;
      try {
        const ata = getAssociatedTokenAddressSync(SKR_MINT, publicKey);
        const bal = await connection.getTokenAccountBalance(ata);
        if (!mounted) return;
        setGameState(prev => ({ ...prev, skrBalance: Number(bal.value.uiAmount ?? 0) }));
      } catch {
        // ATA not found = 0 SKR
        if (mounted) setGameState(prev => ({ ...prev, skrBalance: 0 }));
      }
    };
    fetchSkrBalance();
    return () => { mounted = false; };
  }, [publicKey, connection]);

  // Hydrate gameState from Supabase profile when it loads
  useEffect(() => {
    if (!profile) return;

    setGameState(prev => ({
      ...prev,
      srPoints:           profile.sr_points,
      // skrBalance is the on-chain Seeker token balance — fetched separately, not from profile
      unclaimedBalance:   profile.unclaimed_sol,
      username:           profile.username,
      ownedItemIds:       profile.owned_item_ids,
      equippedAvatarId:   profile.equipped_avatar_id ?? '',
      equippedGearIds:    profile.equipped_gear_ids,
      raidTickets:        profile.raid_tickets ?? 0,
      lastFreeTicketDate: profile.last_free_ticket_date ?? null,
    }));
    // Silently sync lastLevel to the profile's actual rank so we don't fire
    // a level-up modal just because srPoints jumped from 0 → real value on hydration.
    const hydratedRank = RANKS.reduce(
      (best, r) => (profile.sr_points >= r.minSR ? r : best),
      RANKS[0],
    );
    setLastLevel(hydratedRank.level);
  }, [profile]);

  // One-time free ticket for first-time Seeker users (SKR balance > 0, never had tickets before)
  useEffect(() => {
    if (seekerTicketGrantedRef.current) return;
    if (!profile || !walletAddr) return;
    if (gameState.skrBalance <= 0) return;                            // not a Seeker holder
    if ((profile.raid_tickets ?? 0) > 0) return;                     // already has tickets
    if (profile.last_free_ticket_date !== null) return;               // already received free ticket

    seekerTicketGrantedRef.current = true;
    const todayStr = new Date().toISOString().slice(0, 10);
    updateProfile({ raid_tickets: 1, last_free_ticket_date: todayStr });
    setGameState(prev => ({ ...prev, raidTickets: 1, lastFreeTicketDate: todayStr }));
  }, [profile, gameState.skrBalance, walletAddr]);

  // Force back to lobby if wallet disconnects while on a protected screen
  // SQUAD and RANKS are viewable without a wallet; action buttons inside guard themselves via requireWallet()
  // Screens that hard-redirect to Lobby when wallet disconnects
  const PROTECTED_SCREENS = [
    Screen.RAID,
    Screen.MULTIPLAYER_SETUP,
    Screen.MULTIPLAYER_GAME,
    Screen.RESULT,
    Screen.TREASURY,
  ];
  useEffect(() => {
    if (!connected && PROTECTED_SCREENS.includes(gameState.currentScreen)) {
      setGameState(prev => ({ ...prev, currentScreen: Screen.LOBBY }));
    }
  }, [connected, gameState.currentScreen]);

  const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(false);
  const [newRank, setNewRank] = useState<Rank | null>(null);
  const [joinNotification, setJoinNotification] = useState<string | null>(null);

  // Stable ref for walletAddr so async callbacks don't close over a stale value
  const walletAddrRef = useRef<string | null>(null);
  const seekerTicketGrantedRef = useRef(false); // one-time free ticket for Seeker users
  useEffect(() => { walletAddrRef.current = walletAddr; }, [walletAddr]);

  // ── Deep-link shortcuts: ?screen=raid|ranks|profile ─────────────────
  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get('screen');
    if (!param) return;
    const map: Record<string, Screen> = {
      raid:    Screen.LOBBY,
      ranks:   Screen.TOURNAMENT,
      profile: Screen.PROFILE,
      store:   Screen.STORE,
    };
    if (map[param]) setGameState(prev => ({ ...prev, currentScreen: map[param] }));
    // Clean URL so refreshing doesn't re-trigger
    window.history.replaceState({}, '', window.location.pathname);
  }, []);

  // ── Wake Lock — keep screen on during active raids ───────────────────────────
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const acquireWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      }
    } catch (_) { /* not supported or denied */ }
  };
  const releaseWakeLock = () => {
    wakeLockRef.current?.release().catch(() => {});
    wakeLockRef.current = null;
  };

  // ── Fullscreen during raids — removes browser chrome for full immersion ──
  const enterFullscreen = () => {
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    else if ((el as any).webkitRequestFullscreen) (el as any).webkitRequestFullscreen();
  };
  const exitFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  };
  // Re-acquire if page becomes visible again while raid is active
  useEffect(() => {
    const onVisible = () => {
      if (gameState.currentScreen === Screen.RAID && !wakeLockRef.current) acquireWakeLock();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [gameState.currentScreen]);

  // ── App Badge API — show unclaimed SOL on icon badge ─────────────────────
  useEffect(() => {
    if (!('setAppBadge' in navigator)) return;
    const cents = Math.round(gameState.unclaimedBalance * 100);
    if (cents > 0) {
      (navigator as any).setAppBadge(cents).catch(() => {});
    } else {
      (navigator as any).clearAppBadge().catch(() => {});
    }
  }, [gameState.unclaimedBalance]);

  // ── Android back button — hardware back navigates screens, blocked in raid ──
  useEffect(() => {
    if (gameState.currentScreen === Screen.LOBBY) {
      history.replaceState({ solraidScreen: Screen.LOBBY }, '');
    } else {
      history.pushState({ solraidScreen: gameState.currentScreen }, '');
    }
  }, [gameState.currentScreen]);

  useEffect(() => {
    const BACK_BLOCKED = [Screen.RAID, Screen.MULTIPLAYER_GAME];
    const onPop = () => {
      if (BACK_BLOCKED.includes(gameState.currentScreen)) {
        // Re-push to block back during active raid
        history.pushState({ solraidScreen: gameState.currentScreen }, '');
        return;
      }
      setGameState(prev => ({ ...prev, currentScreen: Screen.LOBBY }));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [gameState.currentScreen]);

  // Realtime subscription handle for multiplayer rooms
  const roomChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Clean up room subscription on unmount
  useEffect(() => {
    return () => {
      if (roomChannelRef.current) {
        supabase.removeChannel(roomChannelRef.current);
      }
    };
  }, []);

  const fetchRoomPlayers = async (roomId: string, stakePerPlayer: number) => {
    const { data } = await supabase
      .from('room_players')
      .select('wallet_address, username')
      .eq('room_id', roomId)
      .order('joined_at');
    if (!data) return;
    const players: Opponent[] = data.map(p => ({
      id: p.wallet_address,
      name: p.username || `${p.wallet_address.slice(0, 4)}...${p.wallet_address.slice(-4)}`,
      status: 'WAITING' as const,
      score: 0,
      solResult: 0,
    }));
    setGameState(prev => {
      if (!prev.activeRoom) return prev;
      // Notify host when a new player joins
      const isHost = walletAddrRef.current === prev.activeRoom.hostId;
      if (isHost && players.length > prev.activeRoom.players.length) {
        const newest = players[players.length - 1];
        setJoinNotification(`⚡ ${newest.name} joined the raid!`);
        setTimeout(() => setJoinNotification(null), 4000);
      }
      return {
        ...prev,
        activeRoom: { ...prev.activeRoom, players, poolTotal: players.length * stakePerPlayer },
      };
    });
  };

  const handlePvpFinished = async (roomId: string, winnerWallet: string) => {
    const myWallet = walletAddrRef.current;
    if (!myWallet) return;

    // Fetch room + players to build full winner result
    const [{ data: room }, { data: players }] = await Promise.all([
      supabase.from('rooms').select('stake_per_player, stake_currency').eq('id', roomId).single(),
      supabase.from('room_players').select('wallet_address, username').eq('room_id', roomId),
    ]);

    const playerCount = (players ?? []).length;
    const pot = room ? Number(room.stake_per_player) * playerCount : 0;
    const currency = (room?.stake_currency ?? 'SOL') as string;
    const winnerRow = (players ?? []).find(p => p.wallet_address === winnerWallet);
    const winnerName = winnerRow?.username || `${winnerWallet.slice(0, 4)}...${winnerWallet.slice(-4)}`;

    setGameState(prev => ({
      ...prev,
      pvpWaiting: false,
      pvpWinnerResult: {
        isWinner: winnerWallet === myWallet,
        winnerName,
        winnerWallet,
        potSol: pot,
        currency,
      },
    }));
  };

  const subscribeToRoom = (roomId: string, stakePerPlayer: number) => {
    if (roomChannelRef.current) {
      supabase.removeChannel(roomChannelRef.current);
    }
    roomChannelRef.current = supabase
      .channel(`room-players:${roomId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'room_players', filter: `room_id=eq.${roomId}` },
        (payload) => {
          // Apply the new player immediately from the payload — no extra DB round-trip needed
          const p = payload.new as { wallet_address: string; username: string };
          const newPlayer: Opponent = {
            id: p.wallet_address,
            name: p.username || `${p.wallet_address.slice(0, 4)}...${p.wallet_address.slice(-4)}`,
            status: 'WAITING',
            score: 0,
            solResult: 0,
          };
          setGameState(prev => {
            if (!prev.activeRoom) return prev;
            // Skip if already in list (idempotent)
            if (prev.activeRoom.players.some(pl => pl.id === newPlayer.id)) return prev;
            const players = [...prev.activeRoom.players, newPlayer];
            // Notify host
            if (walletAddrRef.current === prev.activeRoom.hostId) {
              setJoinNotification(`⚡ ${newPlayer.name} joined the raid!`);
              setTimeout(() => setJoinNotification(null), 4000);
            }
            return {
              ...prev,
              activeRoom: { ...prev.activeRoom, players, poolTotal: players.length * stakePerPlayer },
            };
          });
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'room_players', filter: `room_id=eq.${roomId}` },
        () => fetchRoomPlayers(roomId, stakePerPlayer),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        (payload) => {
          const updated = payload.new as { status: string; winner_wallet: string | null };
          if (updated.status === 'FINISHED' && updated.winner_wallet) {
            handlePvpFinished(roomId, updated.winner_wallet);
          }
        },
      )
      .subscribe((status) => {
        // On successful connection, re-sync the full player list in case we missed events
        if (status === 'SUBSCRIBED') {
          fetchRoomPlayers(roomId, stakePerPlayer);
        }
      });
  };

  // Restore an active room from sessionStorage after page reload
  const handleRestoreRoom = async (code: string) => {
    const addr = walletAddrRef.current;
    if (!addr) return;
    const { data: room } = await supabase
      .from('rooms')
      .select('*')
      .eq('code', code)
      .neq('status', 'FINISHED')
      .single();
    if (!room) { sessionStorage.removeItem('solraid-room'); return; }

    const { data: playersData } = await supabase
      .from('room_players')
      .select('wallet_address, username')
      .eq('room_id', room.id)
      .order('joined_at');

    const isInRoom = (playersData ?? []).some(p => p.wallet_address === addr);
    if (!isInRoom) { sessionStorage.removeItem('solraid-room'); return; }

    const stake = Number(room.stake_per_player);
    const currency = (room.stake_currency || 'SOL') as Currency;
    const players: Opponent[] = (playersData ?? []).map(p => ({
      id: p.wallet_address,
      name: p.username || `${p.wallet_address.slice(0, 4)}...${p.wallet_address.slice(-4)}`,
      status: 'WAITING' as const,
      score: 0,
      solResult: 0,
    }));
    const restoredRoom: Room = {
      id: room.id,
      code: room.code,
      hostId: room.host_wallet,
      stakePerPlayer: stake,
      stakeCurrency: currency,
      maxPlayers: room.max_players,
      players,
      status: room.status as 'LOBBY' | 'ACTIVE' | 'FINISHED',
      poolTotal: players.length * stake,
      seed: '',
    };
    setGameState(prev => ({ ...prev, activeRoom: restoredRoom, currentScreen: Screen.MULTIPLAYER_SETUP }));
    subscribeToRoom(room.id, stake);
  };

  // Restore room on wallet connect after a page reload
  useEffect(() => {
    if (!walletAddr || gameState.activeRoom) return;
    const saved = sessionStorage.getItem('solraid-room');
    if (!saved) return;
    try {
      const { code } = JSON.parse(saved);
      handleRestoreRoom(code);
    } catch {
      sessionStorage.removeItem('solraid-room');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddr]);

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
  const [showVaultLocked, setShowVaultLocked] = useState(false);
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

  const OPERATIVE_LEVEL = 10; // OPERATIVE rank minimum level
  const navigateTo = (screen: Screen) => {
    if (screen === Screen.TREASURY) {
      if (!connected) {
        setVisible(true); // open wallet connect modal
        return;
      }
      if (currentRank.level < OPERATIVE_LEVEL) {
        setShowVaultLocked(true);
        return;
      }
    }
    setGameState(prev => ({ ...prev, currentScreen: screen }));
  };

  const handleConnect = () => setVisible(true);
  const handleDisconnect = () => disconnect();

  // Require wallet helper: returns true if connected, otherwise opens connect modal and returns false
  const requireWallet = (): boolean => {
    if (!connected) {
      setVisible(true);
      return false;
    }
    return true;
  };

  const handleUpdateUsername = (name: string) => {
    setGameState(prev => ({ ...prev, username: name }));
    updateProfile({ username: name });
  };

  const handleRaidEnd = async (success: boolean, solAmount: number, points: number, elapsedSec = 10, events?: import('./types').RaidEvent[]) => {
    const baseSR = success ? 100 : 25;
    const performanceSR = Math.floor(points / 200);
    const localSREarned = baseSR + performanceSR;
    const localRaidId = 'RAID-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    const userWallet = walletAddr ? `${walletAddr.slice(0, 4)}...${walletAddr.slice(-3)}` : '';

    // Capture PvP context before state update clears activeRoom
    const isPvp = gameState.currentScreen === Screen.MULTIPLAYER_GAME && !!gameState.activeRoom;
    const activeRoomId = gameState.activeRoom?.id;
    const roomCurrency = gameState.activeRoom?.stakeCurrency ?? 'SOL';

    // Optimistic UI update — show result immediately
    releaseWakeLock();
    setGameState(prev => ({
      ...prev,
      ticketBoostActive: false,
      currentScreen: Screen.RESULT,
      walletBalance: success ? prev.walletBalance : prev.walletBalance - prev.activeRaidFee,
      unclaimedBalance: success ? prev.unclaimedBalance + solAmount : prev.unclaimedBalance,
      srPoints: prev.srPoints + localSREarned,
      // Streak & tilt tracking
      raidStreak: success ? prev.raidStreak + 1 : 0,
      bustTimestamps: success
        ? prev.bustTimestamps
        : [...prev.bustTimestamps.filter(t => t > Date.now() - 10 * 60 * 1000), Date.now()],
      lastRaidEvents: events ?? [],
      lastResult: {
        success,
        solAmount,
        points,
        srEarned: localSREarned,
        raidId: localRaidId,
        serverSeedHash: prev.activeServerSeedHash ?? '',
        userWallet,
        txSignature: '',
      },
      activeRaidBoosts: [],
      activeRoom: undefined,
      pvpWaiting: isPvp,   // waiting for other players to finish
      pvpWinnerResult: null,
    }));

    // Background: call edge function for authoritative result + recording
    if (walletAddr && gameState.activeSeedId) {
      const clientSeed = Math.random().toString(36).substr(2, 9);
      const { data, error } = await supabase.functions.invoke('submit-raid-result', {
        body: {
          wallet_address: walletAddr,
          seed_id:        gameState.activeSeedId,
          client_seed:    clientSeed,
          success,
          sol_amount:     solAmount,
          points,
          mode:           isPvp ? 'PVP' : 'SOLO',
          difficulty:     gameState.activeRaidDifficulty,
          entry_fee:      gameState.activeRaidFee,
          elapsed_sec:    Math.round(elapsedSec),
          ...(isPvp && activeRoomId ? { room_id: activeRoomId } : {}),
        },
      });

      if (data && !error) {
        // Patch with server-computed authoritative values
        setGameState(prev => ({
          ...prev,
          srPoints:        data.new_sr_points,
          unclaimedBalance: data.new_unclaimed,
          pvpWaiting: isPvp && !data.pvp_resolved,
          lastResult: prev.lastResult
            ? {
                ...prev.lastResult,
                srEarned:        data.sr_earned,
                raidId:          data.raid_id,
                serverSeedHash:  data.server_seed_hash,
                txSignature:     data.server_seed, // revealed seed for verification
              }
            : prev.lastResult,
        }));

        // If this player's submission resolved the PvP match, show winner modal immediately
        if (isPvp && data.pvp_resolved) {
          setGameState(prev => ({
            ...prev,
            pvpWaiting: false,
            pvpWinnerResult: {
              isWinner: !!data.is_winner,
              winnerName: (data.winner_name as string) ?? (data.winner_wallet as string)?.slice(0, 8) ?? 'UNKNOWN',
              winnerWallet: (data.winner_wallet as string) ?? '',
              potSol: Number(data.pot_sol ?? 0),
              currency: roomCurrency,
            },
          }));
        }
      } else if (error) {
        console.error('submit-raid-result failed — optimistic state kept', error);
        // Fallback: persist optimistically via direct profile update
        updateProfile({
          sr_points:    gameState.srPoints + localSREarned,
          unclaimed_sol: success
            ? gameState.unclaimedBalance + solAmount
            : gameState.unclaimedBalance,
        });
      }
    }
  };

  const handleClaim = async (amount?: number): Promise<string | null> => {
    const toClaim = amount !== undefined ? amount : gameState.unclaimedBalance;
    if (toClaim <= 0 || !walletAddr) return null;

    // ── F. Sign payout message to prove wallet ownership ──────────────
    if (!signMessage) {
      alert('Your wallet does not support message signing. Please use Phantom, Solflare, or another compatible wallet.');
      return null;
    }

    let walletSig = '';
    try {
      const message    = new TextEncoder().encode(`payout:${walletAddr}:${toClaim}`);
      const sigBytes   = await signMessage(message);
      // Encode as base64 for the Edge Function header
      walletSig = btoa(String.fromCharCode(...sigBytes));
    } catch (sigErr) {
      alert('Signature cancelled or failed. Please approve the signature request in your wallet to withdraw.');
      return null;
    }

    const { data, error } = await supabase.functions.invoke('process-payout', {
      body: { wallet_address: walletAddr, amount_sol: toClaim },
      headers: {
        'x-wallet-signature': walletSig,
        'x-wallet-pubkey':    walletAddr,
      },
    });

    if (data?.success) {
      setGameState(prev => ({
        ...prev,
        walletBalance: prev.walletBalance + data.amount_paid,
        unclaimedBalance: Math.max(0, prev.unclaimedBalance - data.amount_paid),
      }));
      return (data.tx_signature as string) ?? null;
    }

    // Supabase FunctionsHttpError: non-2xx responses land in `error`
    // with the raw Response in `error.context`. Parse the body to get the message.
    let errorMsg: string = data?.error || '';
    if (!errorMsg && error) {
      try {
        const ctx = (error as any).context;
        if (ctx && typeof ctx.json === 'function') {
          const body = await ctx.json();
          errorMsg = body?.error || '';
        }
      } catch { /* ignore parse failure */ }
      if (!errorMsg) errorMsg = (error as any).message || String(error);
    }

    // Friendly guidance for the most common causes
    if (!errorMsg || errorMsg === 'null' || errorMsg === 'undefined' || errorMsg === '[object Object]') {
      errorMsg = 'No response from payout service. Check Supabase Dashboard → Edge Functions → Logs.';
    } else if (errorMsg.includes('TREASURY_WALLET_KEYPAIR')) {
      errorMsg = 'Treasury keypair not configured.\nAdd TREASURY_WALLET_KEYPAIR to Supabase → Edge Functions → Secrets.';
    } else if (errorMsg.includes('insufficient') || errorMsg.includes('lamport')) {
      errorMsg = 'Treasury wallet has insufficient SOL to process this payout.\nPlease try again later or contact support.';
    } else if (errorMsg.includes('withdrawals')) {
      errorMsg = 'withdrawals table missing — run the updated schema.sql in Supabase SQL Editor.';
    } else if (errorMsg.includes('wallet signature') || errorMsg.includes('x-wallet-')) {
      errorMsg = 'Wallet signature verification failed. Please try again and approve the signature in your wallet.';
    } else if (errorMsg.includes('Daily withdrawal limit')) {
      // Pass through as-is — it already includes the remaining amount
    } else if (errorMsg.includes('capped at')) {
      // Pass through as-is — it already includes the cap amount
    }

    console.error('[handleClaim] Payout failed (raw):', { error, data });
    alert('WITHDRAW FAILED\n\n' + errorMsg);
    return null;
  };

  const handlePurchase = async (itemId: string, price: number, currency: Currency): Promise<boolean> => {
    if (!requireWallet()) return false;

    // ── SOL / USDC / SKR (Seeker): on-chain payment ─────────────────────
    if (!TREASURY_PUBKEY) {
      alert('Treasury address not configured. Set VITE_TREASURY_ADDRESS in .env');
      return false;
    }

    if (currency === Currency.SOL && gameState.walletBalance < price) return false;
    if (currency === Currency.USDC && gameState.usdcBalance < price) return false;
    if (currency === Currency.SKR && gameState.skrBalance < price) return false;

    try {
      let tx: Transaction;
      let expectedUnits: number;

      if (currency === Currency.SOL) {
        expectedUnits = Math.round(price * LAMPORTS_PER_SOL);
        tx = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: publicKey!,
            toPubkey: TREASURY_PUBKEY,
            lamports: expectedUnits,
          }),
        );
      } else if (currency === Currency.USDC) {
        // USDC SPL token transfer (6 decimals)
        expectedUnits = Math.round(price * 1_000_000);
        const sourceATA = getAssociatedTokenAddressSync(USDC_MINT, publicKey!);
        const destATA = getAssociatedTokenAddressSync(USDC_MINT, TREASURY_PUBKEY);
        tx = new Transaction().add(
          createTransferInstruction(sourceATA, destATA, publicKey!, BigInt(expectedUnits)),
        );
      } else {
        // SKR Seeker token SPL transfer
        expectedUnits = Math.round(price * Math.pow(10, SKR_DECIMALS));
        const sourceATA = getAssociatedTokenAddressSync(SKR_MINT, publicKey!);
        const destATA = getAssociatedTokenAddressSync(SKR_MINT, TREASURY_PUBKEY);
        tx = new Transaction().add(
          createTransferInstruction(sourceATA, destATA, publicKey!, BigInt(expectedUnits)),
        );
      }

      const { sig: signature, conn: rpcConn } = await sendWithFallback(tx);
      await rpcConn.confirmTransaction(signature, 'confirmed');

      // Brief pause so the RPC endpoint has time to index the transaction
      await new Promise(resolve => setTimeout(resolve, 2000));

      // ── Verify payment on-chain and credit item in Supabase ──────────
      const paymentType =
        currency === Currency.SOL ? 'STORE_SOL' :
        currency === Currency.USDC ? 'STORE_USDC' : 'STORE_SKR';

      const { data, error } = await supabase.functions.invoke('verify-payment', {
        body: {
          wallet_address: walletAddr,
          tx_signature: signature,
          item_id: itemId,
          expected_lamports: expectedUnits,
          payment_type: paymentType,
        },
      });

      if (data?.success) {
        setGameState(prev => ({
          ...prev,
          walletBalance: currency === Currency.SOL  ? prev.walletBalance - price : prev.walletBalance,
          usdcBalance:   currency === Currency.USDC ? prev.usdcBalance - price   : prev.usdcBalance,
          skrBalance:    currency === Currency.SKR  ? prev.skrBalance - price    : prev.skrBalance,
          ownedItemIds:  data.owned_item_ids ?? [...prev.ownedItemIds, itemId],
          srPoints:      data.new_sr_points  ?? prev.srPoints,
        }));
        return true;
      } else {
        console.error('verify-payment failed:', error || data?.error);
        return false;
      }
    } catch (err: any) {
      console.error('Purchase transaction failed:', err);
      return false;
    }
  };

  const handleBuyPass = async (passId: string, price: number, currency: Currency): Promise<boolean> => {
    if (!requireWallet()) return false;
    if (!TREASURY_PUBKEY) {
      alert('Treasury address not configured. Set VITE_TREASURY_ADDRESS in .env');
      return false;
    }

    if (currency === Currency.SOL  && gameState.walletBalance < price) return false;
    if (currency === Currency.USDC && gameState.usdcBalance   < price) return false;
    if (currency === Currency.SKR  && gameState.skrBalance    < price) return false;

    const pass = RAID_PASSES.find(p => p.id === passId);
    if (!pass) return false;

    try {
      let tx: Transaction;
      if (currency === Currency.SOL) {
        tx = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: publicKey!,
            toPubkey: TREASURY_PUBKEY,
            lamports: Math.round(price * LAMPORTS_PER_SOL),
          }),
        );
      } else if (currency === Currency.USDC) {
        const sourceATA = getAssociatedTokenAddressSync(USDC_MINT, publicKey!);
        const destATA   = getAssociatedTokenAddressSync(USDC_MINT, TREASURY_PUBKEY);
        tx = new Transaction().add(
          createTransferInstruction(sourceATA, destATA, publicKey!, BigInt(Math.round(price * 1_000_000))),
        );
      } else {
        const sourceATA = getAssociatedTokenAddressSync(SKR_MINT, publicKey!);
        const destATA   = getAssociatedTokenAddressSync(SKR_MINT, TREASURY_PUBKEY);
        tx = new Transaction().add(
          createTransferInstruction(sourceATA, destATA, publicKey!, BigInt(Math.round(price * Math.pow(10, SKR_DECIMALS)))),
        );
      }

      const { sig, conn: raidConn } = await sendWithFallback(tx);
      await raidConn.confirmTransaction(sig, 'confirmed');

      // Credit tickets to profile
      const newTickets = gameState.raidTickets + pass.tickets;
      await updateProfile({ raid_tickets: newTickets });
      setGameState(prev => ({
        ...prev,
        raidTickets:   newTickets,
        walletBalance: currency === Currency.SOL  ? prev.walletBalance - price : prev.walletBalance,
        usdcBalance:   currency === Currency.USDC ? prev.usdcBalance   - price : prev.usdcBalance,
        skrBalance:    currency === Currency.SKR  ? prev.skrBalance    - price : prev.skrBalance,
      }));
      return true;
    } catch (err: any) {
      console.error('Pass purchase failed:', err);
      return false;
    }
  };

  const handleEquipAvatar = (avatarId: string) => {
    if (!requireWallet()) return;
    setGameState(prev => {
      if (prev.equippedAvatarId === avatarId) return prev;
      const newSR = prev.srPoints + 50;
      updateProfile({ equipped_avatar_id: avatarId, sr_points: newSR });
      return {
        ...prev,
        equippedAvatarId: avatarId,
        srPoints: newSR,
      };
    });
  };

  const handleToggleGear = (gearId: string) => {
    if (!requireWallet()) return;
    setGameState(prev => {
      const isEquipped = prev.equippedGearIds.includes(gearId);
      if (isEquipped) {
        const newGear = prev.equippedGearIds.filter(id => id !== gearId);
        updateProfile({ equipped_gear_ids: newGear });
        return { ...prev, equippedGearIds: newGear };
      } else {
        if (prev.equippedGearIds.length >= 4) return prev;
        const newGear = [...prev.equippedGearIds, gearId];
        const newSR   = prev.srPoints + 25;
        updateProfile({ equipped_gear_ids: newGear, sr_points: newSR });
        return { ...prev, equippedGearIds: newGear, srPoints: newSR };
      }
    });
  };

  const handleCreateRoom = async (stake: number, maxPlayers: number, currency: Currency) => {
    if (!requireWallet()) return;

    // Balance check for the chosen currency
    if (currency === Currency.SOL  && gameState.walletBalance < stake) { alert(`INSUFFICIENT SOL TO STAKE (need ${stake} SOL)`); return; }
    if (currency === Currency.USDC && gameState.usdcBalance   < stake) { alert(`INSUFFICIENT USDC TO STAKE (need ${stake} USDC)`); return; }
    if (currency === Currency.SKR  && gameState.skrBalance    < stake) { alert(`INSUFFICIENT SKR TO STAKE (need ${stake} SKR)`);  return; }

    if (!TREASURY_PUBKEY) {
      alert('Treasury address not configured. Set VITE_TREASURY_ADDRESS in .env');
      return;
    }

    // On-chain stake payment in the selected currency
    let stakeTxSig: string;
    try {
      let tx: Transaction;
      if (currency === Currency.SOL) {
        tx = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: publicKey!,
            toPubkey: TREASURY_PUBKEY,
            lamports: Math.round(stake * LAMPORTS_PER_SOL),
          }),
        );
      } else if (currency === Currency.USDC) {
        const atoms = Math.round(stake * 1_000_000);
        const srcATA = getAssociatedTokenAddressSync(USDC_MINT, publicKey!);
        const dstATA = getAssociatedTokenAddressSync(USDC_MINT, TREASURY_PUBKEY);
        tx = new Transaction().add(createTransferInstruction(srcATA, dstATA, publicKey!, BigInt(atoms)));
      } else {
        const atoms = Math.round(stake * Math.pow(10, SKR_DECIMALS));
        const srcATA = getAssociatedTokenAddressSync(SKR_MINT, publicKey!);
        const dstATA = getAssociatedTokenAddressSync(SKR_MINT, TREASURY_PUBKEY);
        tx = new Transaction().add(createTransferInstruction(srcATA, dstATA, publicKey!, BigInt(atoms)));
      }
      const { sig: _stakeSig, conn: _stakeConn } = await sendWithFallback(tx);
      stakeTxSig = _stakeSig;
      await _stakeConn.confirmTransaction(stakeTxSig, 'confirmed');
    } catch (err: any) {
      console.error('Stake payment failed', err);
      alert('Stake payment failed: ' + (err?.message ?? String(err)));
      return;
    }

    // Unique invite code
    const code = 'RAID-' + Math.random().toString(36).substr(2, 4).toUpperCase();

    // Persist room in Supabase (include stake_currency)
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .insert({ code, host_wallet: walletAddr, stake_per_player: stake, stake_currency: currency, max_players: maxPlayers, entry_tx_signature: stakeTxSig })
      .select()
      .single();

    if (roomError || !room) {
      console.error('Room creation failed:', roomError);
      alert('Room creation failed. Please try again.');
      return;
    }

    // Register host as first player
    const hostName = gameState.username || `${walletAddr!.slice(0, 4)}...${walletAddr!.slice(-4)}`;
    const { error: hostInsertError } = await supabase.from('room_players').insert({
      room_id: room.id,
      wallet_address: walletAddr,
      username: hostName,
      stake_tx_signature: stakeTxSig,
    });
    if (hostInsertError) {
      console.error('Failed to register host in room_players:', hostInsertError);
      alert('Room created but failed to register you as a player. Try rejoining with the room code.');
    }

    const newRoom: Room = {
      id: room.id,
      code: room.code,
      hostId: walletAddr!,
      stakePerPlayer: stake,
      stakeCurrency: currency,
      maxPlayers,
      players: [{ id: walletAddr!, name: `${hostName} (HOST)`, status: 'WAITING', score: 0, solResult: 0 }],
      status: 'LOBBY',
      poolTotal: stake,
      seed: '',
    };

    setGameState(prev => ({
      ...prev,
      walletBalance: currency === Currency.SOL  ? prev.walletBalance - stake : prev.walletBalance,
      usdcBalance:   currency === Currency.USDC ? prev.usdcBalance   - stake : prev.usdcBalance,
      skrBalance:    currency === Currency.SKR  ? prev.skrBalance    - stake : prev.skrBalance,
      activeRoom: newRoom,
      currentScreen: Screen.MULTIPLAYER_SETUP,
    }));

    sessionStorage.setItem('solraid-room', JSON.stringify({ id: room.id, code: room.code }));
    subscribeToRoom(room.id, stake);
  };

  // Explicit leave — clears room state and sessionStorage
  const handleLeaveRoom = () => {
    sessionStorage.removeItem('solraid-room');
    if (roomChannelRef.current) {
      supabase.removeChannel(roomChannelRef.current);
      roomChannelRef.current = null;
    }
    setGameState(prev => ({ ...prev, activeRoom: undefined, currentScreen: Screen.LOBBY }));
  };

  // Fetch room details for JOIN preview (no payment yet)
  const handleFetchRoom = async (code: string): Promise<{ stake: number; currency: Currency; maxPlayers: number; alreadyJoined: boolean } | null> => {
    const trimmedCode = code.trim().toUpperCase();
    if (!trimmedCode.startsWith('RAID-')) return null;

    const { data: room } = await supabase
      .from('rooms')
      .select('stake_per_player, stake_currency, max_players, id, status')
      .eq('code', trimmedCode)
      .single();

    if (!room) return null;
    // Allow rejoining a LOBBY or ACTIVE room
    if (room.status === 'FINISHED') return null;

    const { data: playersInRoom, count } = await supabase
      .from('room_players')
      .select('wallet_address', { count: 'exact' })
      .eq('room_id', room.id);

    const alreadyJoined = !!(playersInRoom ?? []).find(p => p.wallet_address === walletAddr);

    // Only block if room is full AND user is not already in it
    if (!alreadyJoined && (count ?? 0) >= room.max_players) return null;

    return {
      stake: Number(room.stake_per_player),
      currency: (room.stake_currency || 'SOL') as Currency,
      maxPlayers: room.max_players,
      alreadyJoined,
    };
  };

  const handleJoinRoom = async (code: string) => {
    if (!requireWallet()) return;
    const trimmedCode = code.trim().toUpperCase();
    if (!trimmedCode.startsWith('RAID-')) {
      alert('INVALID INVITE CODE');
      return;
    }

    // Fetch room from Supabase (allow rejoining ACTIVE rooms too)
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('code', trimmedCode)
      .neq('status', 'FINISHED')
      .single();

    if (roomError || !room) {
      alert('ROOM NOT FOUND — check the code or the room may have already finished.');
      return;
    }

    const stake: number      = Number(room.stake_per_player);
    const currency: Currency = (room.stake_currency || 'SOL') as Currency;

    // Check if this wallet already paid and is in the room (rejoin — no payment needed)
    const { data: existingEntry } = await supabase
      .from('room_players')
      .select('stake_tx_signature')
      .eq('room_id', room.id)
      .eq('wallet_address', walletAddr!)
      .maybeSingle();

    if (!existingEntry) {
      // ── New joiner — check capacity and charge ────────────────────────
      const { count } = await supabase
        .from('room_players')
        .select('*', { count: 'exact', head: true })
        .eq('room_id', room.id);

      if ((count ?? 0) >= room.max_players) {
        alert('ROOM IS FULL');
        return;
      }

      if (currency === Currency.SOL  && gameState.walletBalance < stake) { alert(`INSUFFICIENT SOL — room requires ${stake} SOL`);   return; }
      if (currency === Currency.USDC && gameState.usdcBalance   < stake) { alert(`INSUFFICIENT USDC — room requires ${stake} USDC`); return; }
      if (currency === Currency.SKR  && gameState.skrBalance    < stake) { alert(`INSUFFICIENT SKR — room requires ${stake} SKR`);   return; }

      if (!TREASURY_PUBKEY) {
        alert('Treasury address not configured. Set VITE_TREASURY_ADDRESS in .env');
        return;
      }

      // On-chain stake payment
      let stakeTxSig: string;
      try {
        let tx: Transaction;
        if (currency === Currency.SOL) {
          tx = new Transaction().add(
            SystemProgram.transfer({
              fromPubkey: publicKey!,
              toPubkey: TREASURY_PUBKEY,
              lamports: Math.round(stake * LAMPORTS_PER_SOL),
            }),
          );
        } else if (currency === Currency.USDC) {
          const atoms = Math.round(stake * 1_000_000);
          const srcATA = getAssociatedTokenAddressSync(USDC_MINT, publicKey!);
          const dstATA = getAssociatedTokenAddressSync(USDC_MINT, TREASURY_PUBKEY);
          tx = new Transaction().add(createTransferInstruction(srcATA, dstATA, publicKey!, BigInt(atoms)));
        } else {
          const atoms = Math.round(stake * Math.pow(10, SKR_DECIMALS));
          const srcATA = getAssociatedTokenAddressSync(SKR_MINT, publicKey!);
          const dstATA = getAssociatedTokenAddressSync(SKR_MINT, TREASURY_PUBKEY);
          tx = new Transaction().add(createTransferInstruction(srcATA, dstATA, publicKey!, BigInt(atoms)));
        }
        const { sig: _joinSig, conn: _joinConn } = await sendWithFallback(tx);
        stakeTxSig = _joinSig;
        await _joinConn.confirmTransaction(stakeTxSig, 'confirmed');
      } catch (err: any) {
        console.error('Stake payment failed', err);
        alert('Stake payment failed: ' + (err?.message ?? String(err)));
        return;
      }

      const playerName = gameState.username || `${walletAddr!.slice(0, 4)}...${walletAddr!.slice(-4)}`;
      const { error: joinInsertError } = await supabase.from('room_players').insert({
        room_id: room.id,
        wallet_address: walletAddr,
        username: playerName,
        stake_tx_signature: stakeTxSig,
      });
      if (joinInsertError) {
        console.error('Failed to register joiner in room_players:', joinInsertError);
        alert('Payment sent but failed to register you in the room. Contact support with tx: ' + stakeTxSig);
        return;
      }

      setGameState(prev => ({
        ...prev,
        walletBalance: currency === Currency.SOL  ? prev.walletBalance - stake : prev.walletBalance,
        usdcBalance:   currency === Currency.USDC ? prev.usdcBalance   - stake : prev.usdcBalance,
        skrBalance:    currency === Currency.SKR  ? prev.skrBalance    - stake : prev.skrBalance,
      }));
    }
    // ── (Re)join: fetch all current players and restore state ────────────
    const { data: playersData } = await supabase
      .from('room_players')
      .select('wallet_address, username')
      .eq('room_id', room.id)
      .order('joined_at');

    const players: Opponent[] = (playersData ?? []).map(p => ({
      id: p.wallet_address,
      name: p.username || `${p.wallet_address.slice(0, 4)}...${p.wallet_address.slice(-4)}`,
      status: 'WAITING' as const,
      score: 0,
      solResult: 0,
    }));

    const joinedRoom: Room = {
      id: room.id,
      code: room.code,
      hostId: room.host_wallet,
      stakePerPlayer: stake,
      stakeCurrency: currency,
      maxPlayers: room.max_players,
      players,
      status: room.status as 'LOBBY' | 'ACTIVE' | 'FINISHED',
      poolTotal: players.length * stake,
      seed: '',
    };

    setGameState(prev => ({ ...prev, activeRoom: joinedRoom, currentScreen: Screen.MULTIPLAYER_SETUP }));
    sessionStorage.setItem('solraid-room', JSON.stringify({ id: room.id, code: room.code }));
    subscribeToRoom(room.id, stake);
  };

  const handleStartMultiplayerRaid = async () => {
    if (!requireWallet()) return;
    if (!gameState.activeRoom) return;

    // Server-side guard — verify at least 2 players confirmed in DB (don't trust local state alone)
    const { count } = await supabase
      .from('room_players')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', gameState.activeRoom.id);

    if ((count ?? 0) < 2) {
      alert('WAITING_FOR_PLAYERS — at least 2 operatives required to initiate PvP protocol.');
      return;
    }

    // Lock room so no new players can join
    await supabase.from('rooms').update({ status: 'ACTIVE' }).eq('id', gameState.activeRoom.id);

    const updatedRoom: Room = { ...gameState.activeRoom, status: 'ACTIVE' };
    setGameState(prev => ({
      ...prev,
      activeRoom: updatedRoom,
      currentScreen: Screen.MULTIPLAYER_GAME,
      isRaidLoading: true,
    }));
  };

  const enterRaid = async (
    mode: Mode,
    difficulty: Difficulty = Difficulty.MEDIUM,
    boosts: string[] = [],
    currency: Currency = Currency.SOL,
    useTicket: boolean = false,
  ) => {
    if (!requireWallet()) return;
    if (mode === Mode.PVP) {
      setGameState(prev => ({ ...prev, currentScreen: Screen.MULTIPLAYER_SETUP }));
      return;
    }

    // ── Rage-quit cooldown: 3 busts in 10 minutes → 30s wait ────────────
    const now = Date.now();
    const tenMinAgo = now - 10 * 60 * 1000;
    const recentBusts = gameState.bustTimestamps.filter(t => t > tenMinAgo);
    if (recentBusts.length >= 3) {
      const oldestRecent = Math.min(...recentBusts);
      const cooldownEndsAt = oldestRecent + 10 * 60 * 1000;
      const waitSec = Math.ceil((cooldownEndsAt - now) / 1000);
      alert(`TILT_PROTECTION — You've busted 3 times in 10 minutes. Cooldown: ${waitSec}s. Breathe, raider.`);
      return;
    }

    // ── Daily free raid at EASY (first of each calendar day) ─────────────
    const todayStr = new Date().toISOString().slice(0, 10);
    const freeRaidToday = gameState.lastFreeRaidDate === todayStr;

    const applyTicket = useTicket && gameState.raidTickets > 0;
    const entryFeeBase = ENTRY_FEES[mode]; // always in SOL units
    // Daily free raid: EASY mode, first raid of the day is free
    const isFreeRaid = !freeRaidToday && difficulty === Difficulty.EASY && mode === Mode.SOLO;
    const entryFee = isFreeRaid ? 0 : applyTicket ? entryFeeBase * 0.5 : entryFeeBase;
    let boostCost = 0;
    boosts.forEach(bId => {
      const boost = RAID_BOOSTS.find(b => b.id === bId);
      if (boost) boostCost += boost.cost;
    });
    const totalCostSol = entryFee + boostCost; // SOL equivalent
    // Streak bonus: 3+ consecutive wins → +0.15x starting multiplier (applied via boosts passthrough)
    const streakBonus = gameState.raidStreak >= 3 ? 0.15 : 0;

    // Convert to chosen currency for balance check
    const rate = CURRENCY_RATES[currency]; // SKR/USDC per SOL
    const totalCostCurrency = totalCostSol * rate;

    if (currency === Currency.SOL  && gameState.walletBalance < totalCostSol)     { alert('INSUFFICIENT SOL FOR DEPLOYMENT');  return; }
    if (currency === Currency.USDC && gameState.usdcBalance   < totalCostCurrency) { alert('INSUFFICIENT USDC FOR DEPLOYMENT'); return; }
    if (currency === Currency.SKR  && gameState.skrBalance    < totalCostCurrency) { alert('INSUFFICIENT SKR FOR DEPLOYMENT');  return; }

    // ── On-chain entry fee payment ──────────────────────────────────────
    if (totalCostSol > 0) {
      if (!TREASURY_PUBKEY) {
        alert('Treasury address not configured. Set VITE_TREASURY_ADDRESS in .env');
        return;
      }
      try {
        let tx: Transaction;
        if (currency === Currency.SOL) {
          tx = new Transaction().add(
            SystemProgram.transfer({
              fromPubkey: publicKey!,
              toPubkey: TREASURY_PUBKEY,
              lamports: Math.round(totalCostSol * LAMPORTS_PER_SOL),
            }),
          );
        } else if (currency === Currency.USDC) {
          const atoms = Math.round(totalCostCurrency * 1_000_000);
          const srcATA = getAssociatedTokenAddressSync(USDC_MINT, publicKey!);
          const dstATA = getAssociatedTokenAddressSync(USDC_MINT, TREASURY_PUBKEY);
          tx = new Transaction().add(createTransferInstruction(srcATA, dstATA, publicKey!, BigInt(atoms)));
        } else {
          // SKR Seeker token
          const atoms = Math.round(totalCostCurrency * Math.pow(10, SKR_DECIMALS));
          const srcATA = getAssociatedTokenAddressSync(SKR_MINT, publicKey!);
          const dstATA = getAssociatedTokenAddressSync(SKR_MINT, TREASURY_PUBKEY);
          tx = new Transaction().add(createTransferInstruction(srcATA, dstATA, publicKey!, BigInt(atoms)));
        }
        const { sig, conn: raidConn } = await sendWithFallback(tx);
        await raidConn.confirmTransaction(sig, 'confirmed');
      } catch (err: any) {
        console.error('Entry fee payment failed', err);
        alert('Entry fee payment failed: ' + (err?.message ?? String(err)));
        return;
      }
    }

    // ── Deduct ticket if used ────────────────────────────────────────────
    if (applyTicket) {
      const newTickets = gameState.raidTickets - 1;
      updateProfile({ raid_tickets: newTickets });
    }

    // ── Navigate immediately after payment ──────────────────────────────
    setGameState(prev => ({
      ...prev,
      activeRaidFee: entryFee,
      walletBalance: currency === Currency.SOL  ? prev.walletBalance - totalCostSol      : prev.walletBalance,
      usdcBalance:   currency === Currency.USDC ? prev.usdcBalance   - totalCostCurrency : prev.usdcBalance,
      skrBalance:    currency === Currency.SKR  ? prev.skrBalance    - totalCostCurrency : prev.skrBalance,
      activeRaidDifficulty: difficulty,
      activeRaidBoosts: boosts,
      activeSeedId: undefined,
      activeServerSeedHash: undefined,
      // Remember config so "Redeploy" button reuses same settings
      lastRaidConfig: { mode, difficulty, boosts, currency },
      // Ticket
      raidTickets: applyTicket ? prev.raidTickets - 1 : prev.raidTickets,
      ticketBoostActive: applyTicket,
      // Daily free raid tracking
      lastFreeRaidDate: isFreeRaid ? todayStr : prev.lastFreeRaidDate,
      // Streak bonus stored (used by RaidScreen via activeRaidBoosts or multiplier — pass via dedicated state)
      activeStreakBonus: streakBonus,
    }));

    if (mode === Mode.TEAM) navigateTo(Screen.TEAM);
    else if (mode === Mode.TOURNAMENT) navigateTo(Screen.TOURNAMENT);
    else {
      setGameState(prev => ({ ...prev, currentScreen: Screen.RAID, isRaidLoading: true }));
      acquireWakeLock();
      enterFullscreen();
    }

    // ── Provably-fair seed fetched in background (ready before raid ends) ─
    if (walletAddr) {
      supabase.functions.invoke('raid-seed', { body: { wallet_address: walletAddr } })
        .then(({ data }) => {
          if (data) {
            setGameState(prev => ({
              ...prev,
              activeSeedId: data.seed_id,
              activeServerSeedHash: data.server_seed_hash,
            }));
          }
        });
    }
  };

  const renderScreen = () => {
    switch (gameState.currentScreen) {
      case Screen.LOBBY:
        return (
          <LobbyScreen
            isConnected={gameState.isConnected}
            onConnect={handleConnect}
            onEnterRaid={enterRaid}
            walletBalance={gameState.walletBalance}
            usdcBalance={gameState.usdcBalance}
            skrBalance={gameState.skrBalance}
            currentLevel={currentRank.level}
            equippedGearIds={gameState.equippedGearIds}
            equippedAvatarId={gameState.equippedAvatarId}
            ownedItemIds={gameState.ownedItemIds}
            onToggleGear={handleToggleGear}
            onEquipAvatar={handleEquipAvatar}
            onNavigateTreasury={() => navigateTo(Screen.TREASURY)}
            raidTickets={gameState.raidTickets}
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
            ticketBoost={gameState.ticketBoostActive}
            streakBonus={gameState.activeStreakBonus}
          />
        );
      case Screen.TEAM:
        return (
          <TeamScreen
            onStartRaid={() => {
              if (!requireWallet()) return;
              setGameState(prev => ({ ...prev, activeRaidFee: ENTRY_FEES[Mode.TEAM] }));
              navigateTo(Screen.RAID);
            }}
            username={gameState.username}
            walletAddress={walletAddr}
          />
        );
      case Screen.TOURNAMENT:
        return (
          <TournamentScreen onEnter={() => {
            if (!requireWallet()) return;
            setGameState(prev => ({ ...prev, activeRaidFee: ENTRY_FEES[Mode.TOURNAMENT] }));
            navigateTo(Screen.RAID);
          }} />
        );
      case Screen.RESULT:
        return (
          <ResultScreen
            result={gameState.lastResult!}
            entryFee={gameState.activeRaidFee}
            raidEvents={gameState.lastRaidEvents}
            onPlayAgain={() => navigateTo(Screen.LOBBY)}
            onRedeploy={gameState.lastRaidConfig
              ? () => enterRaid(
                  gameState.lastRaidConfig!.mode,
                  gameState.lastRaidConfig!.difficulty,
                  gameState.lastRaidConfig!.boosts,
                  gameState.lastRaidConfig!.currency,
                )
              : undefined}
            onClaim={() => navigateTo(Screen.PROFILE)}
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
            walletAddress={walletAddr}
            domainName={domainName}
            referralCode={profile?.referral_code ?? null}
            referralSREarned={profile?.referral_sr_earned ?? 0}
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
            raidTickets={gameState.raidTickets}
            onBuyPass={handleBuyPass}
          />
        );
      case Screen.TREASURY:
        return <TreasuryScreen onBack={() => navigateTo(Screen.LOBBY)} />;
      case Screen.MULTIPLAYER_SETUP:
        return (
          <MultiplayerSetupScreen
            onBack={() => navigateTo(Screen.LOBBY)}
            onLeaveRoom={handleLeaveRoom}
            onCreateRoom={handleCreateRoom}
            onJoinRoom={handleJoinRoom}
            onFetchRoom={handleFetchRoom}
            activeRoom={gameState.activeRoom}
            onStartGame={handleStartMultiplayerRaid}
            currentWalletBalance={gameState.walletBalance}
            currentUsdcBalance={gameState.usdcBalance}
            currentSkrBalance={gameState.skrBalance}
            walletAddress={walletAddr}
            joinNotification={joinNotification}
          />
        );
      case Screen.MULTIPLAYER_GAME:
        return (
          <MultiplayerRaidScreen
            room={gameState.activeRoom!}
            equippedGearIds={gameState.equippedGearIds}
            walletAddress={walletAddr}
            onFinish={handleRaidEnd}
          />
        );
      default:
        return (
          <LobbyScreen
            isConnected={gameState.isConnected}
            onConnect={handleConnect}
            onEnterRaid={enterRaid}
            walletBalance={gameState.walletBalance}
            usdcBalance={gameState.usdcBalance}
            skrBalance={gameState.skrBalance}
            currentLevel={currentRank.level}
            equippedGearIds={gameState.equippedGearIds}
            equippedAvatarId={gameState.equippedAvatarId}
            ownedItemIds={gameState.ownedItemIds}
            onToggleGear={handleToggleGear}
            raidTickets={gameState.raidTickets}
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
        <Navigation currentScreen={gameState.currentScreen} onNavigate={navigateTo} />
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
          domainName={domainName}
        />
        <main className="flex-1 relative overflow-hidden">
          <Suspense fallback={<div className="flex-1 flex items-center justify-center text-white/20 text-xs font-black uppercase tracking-widest animate-pulse">LOADING...</div>}>{renderScreen()}</Suspense>
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
      {gameState.pvpWinnerResult && (
        <PvpWinnerModal
          result={gameState.pvpWinnerResult}
          onClose={() => setGameState(prev => ({ ...prev, pvpWinnerResult: null }))}
        />
      )}
      {gameState.pvpWaiting && !gameState.pvpWinnerResult && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 bg-black/90 border border-[#14F195]/40 text-[#14F195] text-xs font-black uppercase tracking-[0.3em] flex items-center gap-3 animate-pulse">
          <span className="inline-block w-2 h-2 rounded-full bg-[#14F195]" />
          WAITING_FOR_OTHER_PLAYERS...
        </div>
      )}
      {showVaultLocked && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm border-2 border-white/10 bg-black tech-border p-6 flex flex-col items-center gap-4 text-center">
            <div className="text-4xl">🔒</div>
            <h2 className="text-lg font-black uppercase tracking-widest text-white">
              VAULT ACCESS DENIED
            </h2>
            <p className="text-xs text-white/50 font-black uppercase tracking-widest leading-relaxed">
              The vault is restricted to<br />
              <span className="text-[#00FBFF]">OPERATIVE</span> rank and above.
            </p>
            <div className="w-full border border-white/5 bg-white/5 p-3 flex flex-col gap-1">
              <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.2em]">YOUR CURRENT RANK</p>
              <p className="font-black uppercase tracking-widest text-sm" style={{ color: currentRank.color }}>
                {currentRank.title}
              </p>
              <p className="text-[10px] text-white/20 font-black uppercase tracking-widest">
                {gameState.srPoints.toLocaleString()} / 3,000 SR REQUIRED
              </p>
            </div>
            <p className="text-[10px] text-white/30 font-black uppercase tracking-widest leading-relaxed">
              Keep raiding to reach OPERATIVE.<br />
              The vault will be waiting.
            </p>
            <button
              onClick={() => setShowVaultLocked(false)}
              style={{ touchAction: 'manipulation' }}
              className="w-full px-6 py-2 border tech-border border-cyan-500/30 text-cyan-400 text-xs font-black uppercase tracking-[0.2em] hover:bg-cyan-500/10 transition-colors"
            >
              ACKNOWLEDGED
            </button>
          </div>
        </div>
      )}
      <PWAInstallBanner />
      {gameState.isRaidLoading && (
        <RaidLoadingScreen
          mode={gameState.currentScreen === Screen.MULTIPLAYER_GAME ? 'PVP' : 'SOLO'}
          onComplete={() => setGameState(prev => ({ ...prev, isRaidLoading: false }))}
        />
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