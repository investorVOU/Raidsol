import React, { useState, useEffect, useMemo, useRef, useCallback, lazy, Suspense } from 'react';
import { Screen, Mode, GameState, ENTRY_FEES, AVATAR_ITEMS, GEAR_ITEMS, RANKS, Rank, Difficulty, Currency, CURRENCY_RATES, RAID_BOOSTS, RAID_PASSES, Room, Opponent, PLATFORM_FEE_RAID, RaidTier, RAID_TIER_CONFIG, ACHIEVEMENTS } from './types';
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
const BountyScreen = lazy(() => import('./screens/BountyScreen'));
const WalletRoastScreen = lazy(() => import('./screens/WalletRoastScreen'));
const BriefingScreen = lazy(() => import('./screens/BriefingScreen'));
const AdminScreen = lazy(() => import('./screens/AdminScreen'));
import Header from './components/Header';
import Navigation from './components/Navigation';
import { ThemeProvider, useTheme } from './components/ThemeContext';
const HowItWorksModal = lazy(() => import('./components/HowItWorksModal'));
import RaidLoadingScreen from './components/RaidLoadingScreen';
const LevelUpModal = lazy(() => import('./components/LevelUpModal'));
const PvpWinnerModal = lazy(() => import('./components/PvpWinnerModal'));
const DisclaimerModal = lazy(() => import('./components/DisclaimerModal'));
const OnboardingFlow  = lazy(() => import('./components/OnboardingFlow'));
const SuggestionModal = lazy(() => import('./components/SuggestionModal'));
import { SolanaWalletContext } from './components/SolanaWalletContext';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { LAMPORTS_PER_SOL, Transaction, SystemProgram, PublicKey, Connection } from '@solana/web3.js';
import { getRpcList, makeConnection } from './lib/rpc';
import { getAssociatedTokenAddressSync, createTransferInstruction, createAssociatedTokenAccountIdempotentInstruction } from '@solana/spl-token';
import { useProfile } from './hooks/useProfile';
import { useDomainName } from './hooks/useDomainName';
import { usePrices } from './hooks/usePrices';
import { useRoundData } from './hooks/useRoundData';
import { usePlayerRoundWins } from './hooks/usePlayerRoundWins';
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
  const { isDark, toggleTheme } = useTheme();
  const { connected, disconnect, publicKey, sendTransaction, signMessage, signTransaction } = useWallet();
  const { setVisible } = useWalletModal();
  const [introComplete, setIntroComplete] = useState(
    () => localStorage.getItem('solraid-intro-dismissed') === 'true'
  );
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Read referral code from URL once on mount (?ref=CODE)
  const incomingRefCode = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('ref');
  }, []);

  // Read ?join= param once on mount — auto-fills MultiplayerSetupScreen JOIN view
  const incomingJoinCode = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('join')?.toUpperCase() ?? null;
  }, []);

  const walletAddr = publicKey ? publicKey.toBase58() : null;
  const { profile, loading: profileLoading, updateProfile } = useProfile(walletAddr, incomingRefCode);
  // Resolved once here — passed as prop to Header + ProfileScreen to avoid duplicate API calls
  const domainName = useDomainName(walletAddr);
  const { currencyRates: liveCurrencyRates, pricesReady, pricesFailed: livePricesFailed } = usePrices();
  const { info: currentRound, refetch: refetchRound } = useRoundData();
  const { wins: roundWins } = usePlayerRoundWins(walletAddr);
  const unclaimedRoundWins = roundWins.filter(w => !w.claimed);
  const [roundWinPopupDismissed, setRoundWinPopupDismissed] = React.useState<string | null>(null);

  // Screens that are safe to restore on reload (mid-game states are excluded)
  const RESTORABLE_SCREENS = new Set<Screen>([
    Screen.LOBBY, Screen.STORE, Screen.TREASURY, Screen.PROFILE,
    Screen.TEAM, Screen.TOURNAMENT, Screen.PRIVACY, Screen.TERMS,
    Screen.MULTIPLAYER_SETUP, Screen.BOUNTY, Screen.ROAST, Screen.BRIEFING,
  ]);

  const [gameState, setGameState] = useState<GameState>(() => {
    // Admin panel: /rushtik path → always open admin screen
    if (window.location.pathname === '/rushtik') {
      return {
        currentScreen: Screen.ADMIN,
        walletBalance: 0, usdcBalance: 0, skrBalance: 0, unclaimedBalance: 0,
        srPoints: 0, isConnected: false, username: '', ownedItemIds: [],
        equippedAvatarId: '', equippedGearIds: [], activeRaidFee: ENTRY_FEES[Mode.SOLO],
        activeRaidDifficulty: Difficulty.MEDIUM, activeRaidBoosts: [], activeRaidIsRound: false, activeRaidTier: RaidTier.GRUNT,
        raidTickets: 0, lastFreeTicketDate: null, ticketBoostActive: false, raidStreak: 0,
        bustTimestamps: [], lastFreeRaidDate: null, activeStreakBonus: 0, drillCount: 0,
        drillWindowStart: 0, dailyStreak: 0, lastPlayedDate: null, personalBestPoints: 0,
      };
    }
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
      activeRaidIsRound: false,
      activeRaidTier: RaidTier.GRUNT,
      raidTickets: 0,
      lastFreeTicketDate: null,
      ticketBoostActive: false,
      raidStreak: 0,
      bustTimestamps: [],
      lastFreeRaidDate: null,
      activeStreakBonus: 0,
      drillCount: 0,
      drillWindowStart: 0,
      dailyStreak: 0,
      lastPlayedDate: null,
      personalBestPoints: 0,
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
      lastFreeRaidDate:   profile.last_free_raid_date ?? null,
      drillCount:           profile.drill_count ?? 0,
      drillWindowStart:     profile.drill_window_start ?? 0,
      dailyStreak:          profile.daily_streak ?? 0,
      lastPlayedDate:       profile.last_played_date ?? null,
      personalBestPoints:   profile.personal_best_points ?? 0,
    }));
    // Silently sync lastLevel to the profile's actual rank so we don't fire
    // a level-up modal just because srPoints jumped from 0 → real value on hydration.
    const hydratedRank = RANKS.reduce(
      (best, r) => (profile.sr_points >= r.minSR ? r : best),
      RANKS[0],
    );
    setLastLevel(hydratedRank.level);
  }, [profile]);

  // Persist resolved .skr domain to Supabase profile (Seeker Domain Flex)
  useEffect(() => {
    if (!domainName || !profile) return;
    if (domainName === (profile as any).skr_domain) return; // already saved
    updateProfile({ skr_domain: domainName } as any);
  }, [domainName, profile?.wallet_address]);

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
    const isDrillMode = gameState.lastRaidConfig?.mode === Mode.DRILL;
    if (!connected && PROTECTED_SCREENS.includes(gameState.currentScreen) && !isDrillMode) {
      setGameState(prev => ({ ...prev, currentScreen: Screen.LOBBY }));
    }
  }, [connected, gameState.currentScreen, gameState.lastRaidConfig?.mode]);

  const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(false);
  const [showSuggestionModal, setShowSuggestionModal] = useState(false);
  const [newRank, setNewRank] = useState<Rank | null>(null);
  const [joinNotification, setJoinNotification] = useState<string | null>(null);
  const [achievementToast, setAchievementToast] = useState<string | null>(null);

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

  // ── Fullscreen during raids — must be called synchronously from a click handler ──
  const enterFullscreen = () => {
    try {
      const el = document.documentElement;
      if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
      else if ((el as any).webkitRequestFullscreen) (el as any).webkitRequestFullscreen();
    } catch {
      // Ignore — browser may block if not a direct user gesture
    }
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

  // ── Pass discount: fetch best earned coupon from bounty tasks ─────────────────
  const [passDiscountPct, setPassDiscountPct] = useState(0);
  const fetchPassDiscount = useCallback(async () => {
    if (!walletAddr) { setPassDiscountPct(0); return; }
    const { data } = await supabase
      .from('social_claims')
      .select('action_type')
      .eq('wallet_address', walletAddr)
      .like('action_type', 'PASS_DISC_%');
    const types = (data ?? []).map((c: { action_type: string }) => c.action_type);
    const pct = types.some(a => a.includes('_50_')) ? 50
              : types.some(a => a.includes('_20_')) ? 20 : 0;
    setPassDiscountPct(pct);
  }, [walletAddr]);
  useEffect(() => { fetchPassDiscount(); }, [fetchPassDiscount]);

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
    if (!localStorage.getItem('solraid-onboarding-seen')) {
      setShowOnboarding(true);
    }
  };

  const [showDemoNotice, setShowDemoNotice] = useState(false);

  const handleOnboardingComplete = () => {
    localStorage.setItem('solraid-onboarding-seen', 'true');
    setShowOnboarding(false);
    if (!localStorage.getItem('solraid-demo-notice-seen')) {
      setShowDemoNotice(true);
    }
  };

  const handleDismissDemoNotice = (startDemo = false) => {
    localStorage.setItem('solraid-demo-notice-seen', 'true');
    setShowDemoNotice(false);
    if (startDemo) enterRaid(Mode.DRILL, Difficulty.EASY, [], Currency.SOL, false, 0);
  };

  // Auto-navigate to multiplayer setup when ?join= param is present
  useEffect(() => {
    if (incomingJoinCode && introComplete) {
      setGameState(prev => ({ ...prev, currentScreen: Screen.MULTIPLAYER_SETUP }));
    }
  }, [incomingJoinCode, introComplete]);

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

  const handleRaidEnd = async (success: boolean, solAmount: number, points: number, elapsedSec = 10, events?: import('./types').RaidEvent[], peakMult?: number, nearWinCount?: number, bankedYield = 0, lootDrops: import('./types').LootDrop[] = []) => {
    // DRILL = pure simulation — no SR, no SOL, no DB writes
    const isDrill = gameState.lastRaidConfig?.mode === Mode.DRILL;
    const baseSR = success ? 100 : 25;
    const performanceSR = Math.floor(points / 200);
    const localSREarned = isDrill ? 0 : baseSR + performanceSR;
    const localRaidId = 'RAID-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    const userWallet = walletAddr ? `${walletAddr.slice(0, 4)}...${walletAddr.slice(-3)}` : '';

    // Capture PvP context before state update clears activeRoom
    const isPvp = gameState.currentScreen === Screen.MULTIPLAYER_GAME && !!gameState.activeRoom;
    const activeRoomId = gameState.activeRoom?.id;
    const roomCurrency = gameState.activeRoom?.stakeCurrency ?? 'SOL';

    // solAmount arrives already net of the 5% platform fee (applied in RaidScreen)
    // DRILL = pure simulation — no SOL reward regardless of outcome
    const netSolAmount = success && !isDrill ? solAmount : 0;

    // Optimistic UI update — show result immediately
    releaseWakeLock();
    setGameState(prev => ({
      ...prev,
      ticketBoostActive: false,
      currentScreen: Screen.RESULT,
      walletBalance: success ? prev.walletBalance : prev.walletBalance - prev.activeRaidFee,
      unclaimedBalance: (success ? prev.unclaimedBalance + netSolAmount : prev.unclaimedBalance) + bankedYield,
      srPoints: prev.srPoints + localSREarned,
      // Streak & tilt tracking
      raidStreak: success ? prev.raidStreak + 1 : 0,
      bustTimestamps: success
        ? prev.bustTimestamps
        : [...prev.bustTimestamps.filter(t => t > Date.now() - 10 * 60 * 1000), Date.now()],
      lastRaidEvents: events ?? [],
      lastResult: {
        success,
        solAmount: netSolAmount,
        points,
        srEarned: localSREarned,
        raidId: localRaidId,
        serverSeedHash: prev.activeServerSeedHash ?? '',
        userWallet,
        txSignature: '',
        peakMult,
        nearWinCount,
        dailyStreak: prev.dailyStreak,
        bankedYield: bankedYield > 0 ? bankedYield : undefined,
        lootDrops: lootDrops.length > 0 ? lootDrops : undefined,
      },
      personalBestPoints: points > prev.personalBestPoints ? points : prev.personalBestPoints,
      activeRaidBoosts: [],
      activeRoom: undefined,
      pvpWaiting: isPvp,   // waiting for other players to finish
      pvpWinnerResult: null,
    }));

    // Apply loot SR from raid events (skipped for drills — simulation only)
    const srFromLoot = lootDrops.find(d => d.type === 'SR_BURST')?.amount ?? 0;
    if (!isDrill && srFromLoot > 0) {
      setGameState(prev => ({ ...prev, srPoints: prev.srPoints + Math.floor(srFromLoot) }));
    }

    // Persist personal best if beaten (skipped for drills)
    if (!isDrill && points > gameState.personalBestPoints) {
      updateProfile({ personal_best_points: points } as any);
    }

    // Background: call edge function for authoritative result + recording
    // Drills are pure simulations — nothing is recorded server-side
    if (!isDrill && walletAddr && gameState.activeSeedId) {
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
          raid_tier:      gameState.activeRaidTier,
          ...(isPvp && activeRoomId ? { room_id: activeRoomId } : {}),
        },
      });

      if (data && !error) {
        // Patch with server-computed authoritative values
        setGameState(prev => ({
          ...prev,
          srPoints:        data.new_sr_points,
          unclaimedBalance: data.new_unclaimed,
          dailyStreak:     data.daily_streak ?? prev.dailyStreak,
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

        // Show achievement toast for newly earned badges
        if (Array.isArray(data.new_achievements) && data.new_achievements.length > 0) {
          const first = data.new_achievements[0] as string;
          const def = ACHIEVEMENTS.find(a => a.id === first);
          if (def) {
            setAchievementToast(`${def.icon} ${def.name} unlocked!`);
            setTimeout(() => setAchievementToast(null), 4000);
          }
        }

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
        unclaimedBalance: Math.max(0, prev.unclaimedBalance - (data.amount_claimed ?? data.amount_paid)),
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

  const handleClaimRoundWin = async (roundNum: number, roundDate: string): Promise<boolean> => {
    if (!walletAddr) return false;
    try {
      const { data, error } = await supabase.functions.invoke('claim-round-win', {
        body: { round_number: roundNum, round_date: roundDate, wallet_address: walletAddr },
      });
      if (error || !data?.success) {
        let msg = data?.error ?? '';
        if (!msg && error) msg = (error as any).message ?? String(error);
        alert('Claim failed: ' + (msg || 'Unknown error'));
        return false;
      }
      // Credit unclaimed_sol locally (the edge function updates the DB)
      setGameState(prev => ({
        ...prev,
        unclaimedBalance: prev.unclaimedBalance + Number(data.sol_allocation),
      }));
      // Refresh round standings so the CLAIMED badge appears
      refetchRound();
      return true;
    } catch (err) {
      alert('Claim failed: ' + String(err));
      return false;
    }
  };

  // ── cNFT Avatar Minting ──────────────────────────────────────────────────
  const handleMintAvatar = async (avatarId: string): Promise<boolean> => {
    if (!walletAddr || !signTransaction) return false;

    // 1. Request partially-signed tx from edge function (server signs as tree creator)
    const { data, error } = await supabase.functions.invoke('mint-avatar-nft', {
      body: { wallet_address: walletAddr, avatar_id: avatarId, action: 'prepare' },
    });

    if (error || !data?.serializedTx) {
      if (data?.error === 'already_minted') return true; // Already done — UI will show it
      const errMsg = data?.error ?? (error as any)?.message ?? 'Unknown error';
      alert(`Mint failed: ${errMsg}`);
      return false;
    }

    // 2. Deserialize the partially-signed tx (tree creator already signed)
    let tx: import('@solana/web3.js').Transaction;
    try {
      const txBytes = Uint8Array.from(atob(data.serializedTx), c => c.charCodeAt(0));
      tx = Transaction.from(txBytes);
    } catch (err) {
      alert('Mint failed: could not deserialize transaction.');
      return false;
    }

    // 3. User signs (adds fee-payer signature); may throw if wallet rejects
    let signedTx: import('@solana/web3.js').Transaction;
    try {
      signedTx = await signTransaction(tx);
    } catch {
      // User rejected — clean up the pending minted_nfts row
      await supabase.from('minted_nfts')
        .delete()
        .eq('wallet_address', walletAddr)
        .eq('avatar_id', avatarId)
        .is('tx_signature', null);
      return false;
    }

    // 4. Send fully-signed transaction
    let sig: string;
    try {
      sig = await connection.sendRawTransaction(signedTx.serialize());
      await connection.confirmTransaction(sig, 'confirmed');
    } catch (err) {
      alert(`Mint failed: send error — ${String(err)}`);
      return false;
    }

    // 5. Record the confirmed tx signature in Supabase
    await supabase.functions.invoke('mint-avatar-nft', {
      body: { wallet_address: walletAddr, avatar_id: avatarId, action: 'record', tx_signature: sig },
    });

    return true;
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
          createAssociatedTokenAccountIdempotentInstruction(publicKey!, destATA, TREASURY_PUBKEY, USDC_MINT),
          createTransferInstruction(sourceATA, destATA, publicKey!, BigInt(expectedUnits)),
        );
      } else {
        // SKR Seeker token SPL transfer
        expectedUnits = Math.round(price * Math.pow(10, SKR_DECIMALS));
        const sourceATA = getAssociatedTokenAddressSync(SKR_MINT, publicKey!);
        const destATA = getAssociatedTokenAddressSync(SKR_MINT, TREASURY_PUBKEY);
        tx = new Transaction().add(
          createAssociatedTokenAccountIdempotentInstruction(publicKey!, destATA, TREASURY_PUBKEY, SKR_MINT),
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

      console.log('[verify-payment] invoking', { paymentType, expectedUnits, itemId, sig: signature?.slice(0, 20) });
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
        const isAvatar = AVATAR_ITEMS.some(a => a.id === itemId);
        setGameState(prev => ({
          ...prev,
          walletBalance:    currency === Currency.SOL  ? prev.walletBalance - price : prev.walletBalance,
          usdcBalance:      currency === Currency.USDC ? prev.usdcBalance - price   : prev.usdcBalance,
          skrBalance:       currency === Currency.SKR  ? prev.skrBalance - price    : prev.skrBalance,
          ownedItemIds:     data.owned_item_ids ?? [...prev.ownedItemIds, itemId],
          srPoints:         data.new_sr_points  ?? prev.srPoints,
          // Auto-equip avatar on purchase
          ...(isAvatar ? { equippedAvatarId: itemId } : {}),
        }));
        if (isAvatar) {
          updateProfile({ equipped_avatar_id: itemId });
        }
        return true;
      } else {
        // Extract actual error body from FunctionsHttpError
        let errMsg = data?.error ?? 'verify-payment failed';
        if (error) {
          try {
            const body = await (error as any).context?.json?.();
            errMsg = body?.error ?? error.message ?? errMsg;
          } catch {
            errMsg = error.message ?? errMsg;
          }
        }
        console.error('[verify-payment] error:', errMsg, { paymentType, expectedUnits, itemId });
        throw new Error(errMsg);
      }
    } catch (err: any) {
      console.error('[handlePurchase] failed:', err?.message ?? err);
      throw err;
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
          createAssociatedTokenAccountIdempotentInstruction(publicKey!, destATA, TREASURY_PUBKEY, USDC_MINT),
          createTransferInstruction(sourceATA, destATA, publicKey!, BigInt(Math.round(price * 1_000_000))),
        );
      } else {
        const sourceATA = getAssociatedTokenAddressSync(SKR_MINT, publicKey!);
        const destATA   = getAssociatedTokenAddressSync(SKR_MINT, TREASURY_PUBKEY);
        tx = new Transaction().add(
          createAssociatedTokenAccountIdempotentInstruction(publicKey!, destATA, TREASURY_PUBKEY, SKR_MINT),
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
      throw err;
    }
  };

  const handleForgeGear = async (item1Id: string, item2Id: string): Promise<string | null> => {
    if (!requireWallet()) return null;
    const ownedIds = gameState.ownedItemIds;

    // Pick a random LIMITED gear the user doesn't own yet
    const available = GEAR_ITEMS.filter(g => g.rarity === 'LIMITED' && !ownedIds.includes(g.id));
    if (available.length === 0) return null;

    const forged = available[Math.floor(Math.random() * available.length)];
    const newOwned = ownedIds.filter(id => id !== item1Id && id !== item2Id).concat(forged.id);

    setGameState(prev => ({ ...prev, ownedItemIds: newOwned }));
    await updateProfile({ owned_item_ids: newOwned });

    return forged.id;
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
        tx = new Transaction().add(
          createAssociatedTokenAccountIdempotentInstruction(publicKey!, dstATA, TREASURY_PUBKEY, USDC_MINT),
          createTransferInstruction(srcATA, dstATA, publicKey!, BigInt(atoms)),
        );
      } else {
        const atoms = Math.round(stake * Math.pow(10, SKR_DECIMALS));
        const srcATA = getAssociatedTokenAddressSync(SKR_MINT, publicKey!);
        const dstATA = getAssociatedTokenAddressSync(SKR_MINT, TREASURY_PUBKEY);
        tx = new Transaction().add(
          createAssociatedTokenAccountIdempotentInstruction(publicKey!, dstATA, TREASURY_PUBKEY, SKR_MINT),
          createTransferInstruction(srcATA, dstATA, publicKey!, BigInt(atoms)),
        );
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
          tx = new Transaction().add(
            createAssociatedTokenAccountIdempotentInstruction(publicKey!, dstATA, TREASURY_PUBKEY, USDC_MINT),
            createTransferInstruction(srcATA, dstATA, publicKey!, BigInt(atoms)),
          );
        } else {
          const atoms = Math.round(stake * Math.pow(10, SKR_DECIMALS));
          const srcATA = getAssociatedTokenAddressSync(SKR_MINT, publicKey!);
          const dstATA = getAssociatedTokenAddressSync(SKR_MINT, TREASURY_PUBKEY);
          tx = new Transaction().add(
            createAssociatedTokenAccountIdempotentInstruction(publicKey!, dstATA, TREASURY_PUBKEY, SKR_MINT),
            createTransferInstruction(srcATA, dstATA, publicKey!, BigInt(atoms)),
          );
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
    customFeeOverride?: number,
    isRoundEntry: boolean = false,
    tier: RaidTier = RaidTier.GRUNT,
  ) => {
    // All SOLO raids are round-based — points ranked 1-5, 90% of pot distributed after round ends
    const effectiveIsRoundEntry = mode === Mode.SOLO ? true : (isRoundEntry || !!currentRound);
    // For round entries, override fee with tier's entry fee (unless customFeeOverride explicitly set)
    const effectiveTierFee = effectiveIsRoundEntry && customFeeOverride === undefined
      ? RAID_TIER_CONFIG[tier].entryFee
      : customFeeOverride;

    if (mode !== Mode.DRILL && !requireWallet()) return;
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

    // ── Drill cap: 3 free drills per 6-hour rolling window ───────────────
    if (mode === Mode.DRILL) {
      const SIX_HOURS = 6 * 60 * 60 * 1000;
      const windowExpired = (now - gameState.drillWindowStart) >= SIX_HOURS;
      const currentDrillCount = windowExpired ? 0 : gameState.drillCount;
      if (currentDrillCount >= 3) {
        const nextReset = gameState.drillWindowStart + SIX_HOURS;
        const minLeft = Math.ceil((nextReset - now) / 60000);
        alert(`DRILL_CAP_REACHED — 3 free drills used. Resets in ${minLeft} min.`);
        return;
      }
    }

    // ── Daily free raid at EASY (first of each calendar day) ─────────────
    const todayStr = new Date().toISOString().slice(0, 10);
    const freeRaidToday = gameState.lastFreeRaidDate === todayStr;

    const applyTicket = useTicket && gameState.raidTickets > 0;
    const entryFeeBase = effectiveTierFee ?? ENTRY_FEES[mode]; // always in SOL units
    // Daily free raid: EASY mode, first raid of the day is free (never for round entries — pool requires fees)
    const isFreeRaid = !effectiveIsRoundEntry && !freeRaidToday && difficulty === Difficulty.EASY && mode === Mode.SOLO;
    const entryFee = isFreeRaid ? 0 : applyTicket ? entryFeeBase * 0.5 : entryFeeBase;
    let boostCost = 0;
    boosts.forEach(bId => {
      const boost = RAID_BOOSTS.find(b => b.id === bId);
      if (boost) boostCost += boost.cost;
    });
    const totalCostSol = entryFee + boostCost; // SOL equivalent
    // Streak bonus: 3+ consecutive wins → +0.15x starting multiplier (applied via boosts passthrough)
    const streakBonus = gameState.raidStreak >= 3 ? 0.15 : 0;

    // Daily play streak — update if first raid today (skip for non-connected demo players)
    const todayDateStr = new Date().toISOString().slice(0, 10);
    const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (walletAddr && gameState.lastPlayedDate !== todayDateStr) {
      const newDailyStreak = gameState.lastPlayedDate === yesterdayStr
        ? gameState.dailyStreak + 1
        : 1;
      updateProfile({ daily_streak: newDailyStreak, last_played_date: todayDateStr } as any);
      setGameState(prev => ({ ...prev, dailyStreak: newDailyStreak, lastPlayedDate: todayDateStr }));
    }

    // Prices must be loaded before paying in USDC/SKR
    if (currency !== Currency.SOL && !pricesReady) {
      alert('Prices still loading — please wait a moment, then try again.');
      return;
    }

    // Convert to chosen currency for balance check
    const rate = liveCurrencyRates[currency]; // SKR/USDC per SOL
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
          tx = new Transaction().add(
            createAssociatedTokenAccountIdempotentInstruction(publicKey!, dstATA, TREASURY_PUBKEY, USDC_MINT),
            createTransferInstruction(srcATA, dstATA, publicKey!, BigInt(atoms)),
          );
        } else {
          // SKR Seeker token
          const atoms = Math.round(totalCostCurrency * Math.pow(10, SKR_DECIMALS));
          const srcATA = getAssociatedTokenAddressSync(SKR_MINT, publicKey!);
          const dstATA = getAssociatedTokenAddressSync(SKR_MINT, TREASURY_PUBKEY);
          tx = new Transaction().add(
            createAssociatedTokenAccountIdempotentInstruction(publicKey!, dstATA, TREASURY_PUBKEY, SKR_MINT),
            createTransferInstruction(srcATA, dstATA, publicKey!, BigInt(atoms)),
          );
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
      activeRaidIsRound: effectiveIsRoundEntry,
      activeRaidTier: effectiveIsRoundEntry ? tier : RaidTier.GRUNT,
      activeSeedId: undefined,
      activeServerSeedHash: undefined,
      // Remember config so "Redeploy" button reuses same settings
      lastRaidConfig: { mode, difficulty, boosts, currency, isRoundEntry: effectiveIsRoundEntry, tier: effectiveIsRoundEntry ? tier : undefined },
      // Ticket
      raidTickets: applyTicket ? prev.raidTickets - 1 : prev.raidTickets,
      ticketBoostActive: applyTicket,
      // Daily free raid tracking
      lastFreeRaidDate: isFreeRaid ? todayStr : prev.lastFreeRaidDate,
      // Streak bonus stored (used by RaidScreen via activeRaidBoosts or multiplier — pass via dedicated state)
      activeStreakBonus: streakBonus,
      // Drill cap tracking
      ...(mode === Mode.DRILL ? (() => {
        const SIX_HOURS = 6 * 60 * 60 * 1000;
        const windowExpired = (now - prev.drillWindowStart) >= SIX_HOURS;
        return {
          drillCount: windowExpired ? 1 : prev.drillCount + 1,
          drillWindowStart: windowExpired ? now : prev.drillWindowStart,
        };
      })() : {}),
    }));

    // Persist drill cap and free raid state to Supabase so reloads don't reset limits
    if (mode === Mode.DRILL && walletAddr) {
      const SIX_HOURS = 6 * 60 * 60 * 1000;
      const windowExpired = (now - gameState.drillWindowStart) >= SIX_HOURS;
      updateProfile({
        drill_count:        windowExpired ? 1 : gameState.drillCount + 1,
        drill_window_start: windowExpired ? now : gameState.drillWindowStart,
      });
    }
    if (isFreeRaid) {
      updateProfile({ last_free_raid_date: todayStr });
    }

    setGameState(prev => ({ ...prev, currentScreen: Screen.RAID, isRaidLoading: true }));
    acquireWakeLock();
    // enterFullscreen() intentionally omitted here — requestFullscreen can only be
    // called synchronously from a user gesture; after await-ing wallet signing it is
    // too late and the browser blocks it. Call it from the click handler instead.

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

  const enterRoundRaid = async (difficulty: Difficulty, boosts: string[], currency: Currency, tier: RaidTier = RaidTier.GRUNT, useTicket = false) => {
    // effectiveIsRoundEntry in enterRaid auto-enrolls when currentRound is set;
    // pass isRoundEntry=true explicitly as a fallback for safety
    await enterRaid(Mode.SOLO, difficulty, boosts, currency, useTicket, undefined, true, tier);
  };

  // ── Bounty Board ──────────────────────────────────────────────────────────
  const handlePostBounty = async (
    difficulty: Difficulty,
    targetPoints: number,
    rewardType: 'SOL' | 'SR',
    rewardAmount: number,
    durationHours: number,
  ) => {
    if (!walletAddr) throw new Error('Wallet not connected');
    const { data, error } = await supabase.functions.invoke('post-bounty', {
      body: { wallet_address: walletAddr, difficulty, target_points: targetPoints, reward_type: rewardType, reward_amount: rewardAmount, duration_hours: durationHours },
    });
    if (error || data?.error) throw new Error(data?.error ?? 'Failed to post bounty');
    if (rewardType === 'SOL') setGameState(prev => ({ ...prev, unclaimedBalance: Math.max(0, prev.unclaimedBalance - rewardAmount) }));
    if (rewardType === 'SR')  setGameState(prev => ({ ...prev, srPoints: Math.max(0, prev.srPoints - Math.floor(rewardAmount)) }));
  };

  const handleClaimBounty = async (bountyId: string): Promise<{ reward_type: string; reward_amount: number } | null> => {
    if (!walletAddr) throw new Error('Wallet not connected');
    const { data, error } = await supabase.functions.invoke('claim-bounty', {
      body: { wallet_address: walletAddr, bounty_id: bountyId },
    });
    if (error) {
      let msg = 'Failed to claim bounty';
      try { const body = await (error as any).context?.json?.(); if (body?.error) msg = body.error; } catch {}
      throw new Error(msg);
    }
    if (data?.error) throw new Error(data.error);
    if (data.reward_type === 'SOL') setGameState(prev => ({ ...prev, unclaimedBalance: prev.unclaimedBalance + Number(data.reward_amount) }));
    if (data.reward_type === 'SR')  setGameState(prev => ({ ...prev, srPoints: prev.srPoints + Math.floor(Number(data.reward_amount)) }));
    return data as { reward_type: string; reward_amount: number };
  };

  const handleClaimSocialBounty = async (actionType: string, twitterHandle?: string, tweetUrl?: string): Promise<{ reward_sr: number } | null> => {
    if (!walletAddr) throw new Error('Wallet not connected');
    const { data, error } = await supabase.functions.invoke('claim-social-bounty', {
      body: { wallet_address: walletAddr, action_type: actionType, twitter_handle: twitterHandle, tweet_url: tweetUrl },
    });
    if (error) {
      let msg = 'Failed to claim reward';
      try { const body = await (error as any).context?.json?.(); if (body?.error) msg = body.error; } catch {}
      throw new Error(msg);
    }
    if (data?.error) throw new Error(data.error);
    if (data.reward_sr) setGameState(prev => ({ ...prev, srPoints: prev.srPoints + Number(data.reward_sr) }));
    // Refresh pass discount immediately if a PASS_DISC_* task was just claimed
    if (actionType.startsWith('PASS_DISC_')) fetchPassDiscount();
    return data as { reward_sr: number };
  };

  const handleCheckBriefing = async (answer: string, date: string): Promise<{ correct: boolean; reward_sr?: number; isFirst?: boolean }> => {
    if (!walletAddr) throw new Error('Wallet not connected');
    const { data, error } = await supabase.functions.invoke('check-briefing', {
      body: { wallet_address: walletAddr, answer, date },
    });
    if (error) {
      let msg = 'Failed to check answer';
      try { const body = await (error as any).context?.json?.(); if (body?.error) msg = body.error; } catch {}
      throw new Error(msg);
    }
    if (data?.error) throw new Error(data.error);
    if (data.correct && data.reward_sr) {
      setGameState(prev => ({ ...prev, srPoints: prev.srPoints + Number(data.reward_sr) }));
    }
    return data as { correct: boolean; reward_sr?: number; isFirst?: boolean };
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
            onNavigateStore={(tab) => { setGameState(prev => ({ ...prev, storeInitialTab: tab })); navigateTo(Screen.STORE); }}
            onNavigateBounty={() => navigateTo(Screen.BOUNTY)}
            onNavigateRoast={() => navigateTo(Screen.ROAST)}
            onNavigateBriefing={() => navigateTo(Screen.BRIEFING)}
            onOpenSuggestions={() => setShowSuggestionModal(true)}
            raidTickets={gameState.raidTickets}
            lastFreeRaidDate={gameState.lastFreeRaidDate}
            drillCount={gameState.drillCount}
            drillWindowStart={gameState.drillWindowStart}
            currencyRates={liveCurrencyRates}
            pricesFailed={livePricesFailed}
            currentRound={currentRound}
            onEnterRound={enterRoundRaid}
            onRequestFullscreen={enterFullscreen}
            dailyStreak={gameState.dailyStreak}
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
            dailyStreak={gameState.dailyStreak}
            personalBestPoints={gameState.personalBestPoints}
            isRoundEntry={gameState.activeRaidIsRound}
          />
        );
      case Screen.TEAM:
        return (
          <TeamScreen
            onStartRaid={(currency) => enterRaid(Mode.TEAM, Difficulty.MEDIUM, [], currency)}
            username={gameState.username}
            walletAddress={walletAddr}
            walletBalance={gameState.walletBalance}
            usdcBalance={gameState.usdcBalance}
            skrBalance={gameState.skrBalance}
            currencyRates={liveCurrencyRates}
          />
        );
      case Screen.TOURNAMENT:
        return (
          <TournamentScreen
            walletAddress={walletAddr ?? undefined}
            walletBalance={gameState.walletBalance}
            usdcBalance={gameState.usdcBalance}
            skrBalance={gameState.skrBalance}
            rankLevel={currentRank.level}
            rankTitle={currentRank.title}
            srPoints={gameState.srPoints}
            onEnterRaid={enterRaid}
            currencyRates={liveCurrencyRates}
          />
        );
      case Screen.RESULT:
        return (
          <ResultScreen
            result={gameState.lastResult!}
            entryFee={gameState.activeRaidFee}
            raidEvents={gameState.lastRaidEvents}
            equippedGearCount={gameState.equippedGearIds.length}
            onNavigateStore={() => navigateTo(Screen.STORE)}
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
            isRoundEntry={true}
            roundInfo={currentRound}
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
            onNavigateStore={(tab) => { setGameState(prev => ({ ...prev, storeInitialTab: tab })); navigateTo(Screen.STORE); }}
            onClaimRoundWin={handleClaimRoundWin}
            onMintAvatar={handleMintAvatar}
            lastClaimAt={profile?.last_claim_at ?? null}
            dailyStreak={gameState.dailyStreak}
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
            onForgeGear={handleForgeGear}
            initialTab={gameState.storeInitialTab}
            currencyRates={liveCurrencyRates}
            passDiscountPct={passDiscountPct}
          />
        );
      case Screen.BOUNTY:
        return (
          <BountyScreen
            walletAddress={walletAddr}
            unclaimedSol={gameState.unclaimedBalance}
            srPoints={gameState.srPoints}
            onPostBounty={handlePostBounty}
            onClaimBounty={handleClaimBounty}
            onClaimSocialBounty={handleClaimSocialBounty}
            onBack={() => navigateTo(Screen.LOBBY)}
          />
        );
      case Screen.ROAST:
        return (
          <WalletRoastScreen
            walletAddress={walletAddr}
            walletBalance={gameState.walletBalance}
            onBack={() => navigateTo(Screen.LOBBY)}
          />
        );
      case Screen.BRIEFING:
        return (
          <BriefingScreen
            walletAddress={walletAddr}
            srPoints={gameState.srPoints}
            onCheckBriefing={handleCheckBriefing}
            onSpendSR={(amount) => {
              const newSR = Math.max(0, gameState.srPoints - amount);
              setGameState(prev => ({ ...prev, srPoints: newSR }));
              updateProfile({ sr_points: newSR });
            }}
            onBack={() => navigateTo(Screen.LOBBY)}
          />
        );
      case Screen.TREASURY:
        return <TreasuryScreen onBack={() => navigateTo(Screen.LOBBY)} />;
      case Screen.ADMIN:
        return <AdminScreen />;
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
            initialRoomCode={incomingJoinCode ?? undefined}
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
            lastFreeRaidDate={gameState.lastFreeRaidDate}
            drillCount={gameState.drillCount}
            drillWindowStart={gameState.drillWindowStart}
            onEquipAvatar={handleEquipAvatar}
            onNavigateTreasury={() => navigateTo(Screen.TREASURY)}
            onNavigateStore={(tab) => { setGameState(prev => ({ ...prev, storeInitialTab: tab })); navigateTo(Screen.STORE); }}
            onNavigateBounty={() => navigateTo(Screen.BOUNTY)}
            onNavigateRoast={() => navigateTo(Screen.ROAST)}
            onNavigateBriefing={() => navigateTo(Screen.BRIEFING)}
            onOpenSuggestions={() => setShowSuggestionModal(true)}
            currencyRates={liveCurrencyRates}
            pricesFailed={livePricesFailed}
            currentRound={currentRound}
            onEnterRound={enterRoundRaid}
            onRequestFullscreen={enterFullscreen}
            dailyStreak={gameState.dailyStreak}
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
    <div className="relative h-screen w-full flex flex-col md:flex-row overflow-hidden" style={{ background: 'var(--app-bg)', color: 'var(--text-primary)' }}>
      {!introComplete && (
        <Suspense fallback={null}><DisclaimerModal onComplete={handleIntroFinish} /></Suspense>
      )}
      {showOnboarding && (
        <Suspense fallback={null}><OnboardingFlow onComplete={handleOnboardingComplete} /></Suspense>
      )}
      {showDemoNotice && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-sm rounded-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-400"
            style={{ background: '#080820', border: '2px solid rgba(153,69,255,0.40)', boxShadow: '0 0 40px rgba(153,69,255,0.15)' }}>
            {/* Top accent bar */}
            <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, #9945FF, #14F195)' }} />
            <div className="p-6">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#14F195] mb-2">Before you dive in</p>
              <h2 className="text-2xl font-black text-white uppercase leading-tight mb-3"
                style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '2px' }}>
                Try the Free Demo First
              </h2>
              <p className="text-[13px] text-white leading-relaxed mb-5">
                No wallet, no fees — just you and the game. The free demo is the best way to learn when to extract before your risk goes too high.
              </p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => handleDismissDemoNotice(true)}
                  className="w-full py-3.5 rounded-xl font-black text-sm uppercase tracking-wider active:scale-[0.98] transition-all"
                  style={{ background: 'linear-gradient(135deg, #6622BB, #3d0099)', color: '#fff', fontFamily: "'Bebas Neue', sans-serif", fontSize: '16px', letterSpacing: '2px' }}
                >
                  Got it — show me the demo
                </button>
                <button
                  onClick={handleDismissDemoNotice}
                  className="w-full py-2 text-[11px] font-bold text-white uppercase tracking-wider"
                  style={{ opacity: 0.45 }}
                >
                  Skip
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="absolute inset-0 pixel-grid z-0" />
      {showNavigation && (
        <Navigation currentScreen={gameState.currentScreen} onNavigate={navigateTo} roundWinCount={unclaimedRoundWins.length} onOpenSuggestions={() => setShowSuggestionModal(true)} />
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
          onToggleTheme={toggleTheme}
          isDark={isDark}
          walletAddress={publicKey ? publicKey.toBase58() : null}
          domainName={domainName}
          isLobby={gameState.currentScreen === Screen.LOBBY}
        />
        <main className="flex-1 relative overflow-hidden">
          <Suspense fallback={<div className="flex-1 flex items-center justify-center text-white text-xs font-black uppercase tracking-widest animate-pulse">LOADING...</div>}>{renderScreen()}</Suspense>
        </main>
      </div>
      <HowItWorksModal
        isOpen={isHowItWorksOpen}
        onClose={() => setIsHowItWorksOpen(false)}
        onNavigateLegal={navigateTo}
      />
      {showSuggestionModal && (
        <Suspense fallback={null}>
          <SuggestionModal
            walletAddress={publicKey ? publicKey.toBase58() : null}
            onClose={() => setShowSuggestionModal(false)}
          />
        </Suspense>
      )}
      {newRank && (
        <LevelUpModal rank={newRank} onClose={() => setNewRank(null)} />
      )}
      {gameState.pvpWinnerResult && (
        <PvpWinnerModal
          result={gameState.pvpWinnerResult}
          onClose={() => setGameState(prev => ({ ...prev, pvpWinnerResult: null }))}
        />
      )}
      {achievementToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[200] pointer-events-none animate-in slide-in-from-top-2 duration-300">
          <div className="px-5 py-3 text-sm font-black text-white flex items-center gap-2" style={{ background: '#0d0d18', border: '1px solid rgba(255,184,0,0.45)', borderRadius: '10px', boxShadow: '0 0 24px rgba(255,184,0,0.2)' }}>
            <span style={{ color: '#FFB800' }}>BADGE EARNED</span>
            <span className="text-white">·</span>
            <span>{achievementToast}</span>
          </div>
        </div>
      )}
      {gameState.pvpWaiting && !gameState.pvpWinnerResult && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 bg-black/90 border border-[#14F195]/40 text-[#14F195] text-xs font-black uppercase tracking-[0.3em] flex items-center gap-3 animate-pulse">
          <span className="inline-block w-2 h-2 rounded-full bg-[#14F195]" />
          WAITING_FOR_OTHER_PLAYERS...
        </div>
      )}
      {/* ── ROUND WIN POPUP ── */}
      {unclaimedRoundWins.length > 0 && roundWinPopupDismissed !== unclaimedRoundWins[0].id && gameState.isConnected && gameState.currentScreen === Screen.LOBBY && (
        (() => {
          const win = unclaimedRoundWins[0];
          const medalMap: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉', 4: '4th', 5: '5th' };
          const pctMap: Record<number, string> = { 1: '40%', 2: '28%', 3: '18%', 4: '10%', 5: '4%' };
          return (
            <div className="fixed top-20 left-0 right-0 z-[150] px-4 pointer-events-none">
              <div
                className="w-full max-w-sm mx-auto pointer-events-auto animate-in slide-in-from-top duration-300"
                style={{ background: '#0d0a16', border: '1px solid rgba(153,69,255,0.45)', borderRadius: '16px', boxShadow: '0 0 40px rgba(153,69,255,0.15), 0 8px 32px rgba(0,0,0,0.6)' }}
              >
                <div className="px-4 pt-4 pb-3">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(153,69,255,0.18)', border: '1px solid rgba(153,69,255,0.30)' }}>
                        <i className="fa-solid fa-trophy text-sm" style={{ color: '#b77aff' }} />
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold" style={{ color: '#b77aff' }}>ROUND WIN</p>
                        <p className="text-[9px] text-white">R{win.roundNum}/4 · {win.roundDate}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setRoundWinPopupDismissed(win.id)}
                      className="w-6 h-6 rounded-full bg-white/6 flex items-center justify-center text-white hover:text-white transition-colors shrink-0 mt-0.5"
                    >
                      <i className="fa-solid fa-xmark text-[10px]" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-[9px] text-white mb-0.5">Rank · Allocation</p>
                      <p className="text-lg font-black text-white leading-none">
                        {medalMap[win.rank]} <span style={{ color: '#b77aff' }}>{win.solAllocation.toFixed(4)} SOL</span>
                      </p>
                      <p className="text-[9px] text-white mt-0.5">{pctMap[win.rank]} of {win.poolSol.toFixed(3)} SOL pool</p>
                    </div>
                    <button
                      onClick={() => { setRoundWinPopupDismissed(win.id); navigateTo(Screen.PROFILE); }}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-white active:scale-95 transition-all shrink-0"
                      style={{ background: 'linear-gradient(135deg, #9945FF 0%, #7c2dd6 100%)', boxShadow: '0 0 16px rgba(153,69,255,0.25)' }}
                    >
                      Claim →
                    </button>
                  </div>

                  {unclaimedRoundWins.length > 1 && (
                    <p className="text-[9px] text-white text-center">+{unclaimedRoundWins.length - 1} more unclaimed win{unclaimedRoundWins.length - 1 > 1 ? 's' : ''}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })()
      )}

      {showVaultLocked && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm border-2 border-white/10 bg-black tech-border p-6 flex flex-col items-center gap-4 text-center">
            <div className="text-4xl">🔒</div>
            <h2 className="text-lg font-black uppercase tracking-widest text-white">
              VAULT ACCESS DENIED
            </h2>
            <p className="text-xs text-white font-black uppercase tracking-widest leading-relaxed">
              The vault is restricted to<br />
              <span className="text-[#00FBFF]">OPERATIVE</span> rank and above.
            </p>
            <div className="w-full border border-white/5 bg-white/5 p-3 flex flex-col gap-1">
              <p className="text-[10px] text-white font-black uppercase tracking-[0.2em]">YOUR CURRENT RANK</p>
              <p className="font-black uppercase tracking-widest text-sm" style={{ color: currentRank.color }}>
                {currentRank.title}
              </p>
              <p className="text-[10px] text-white font-black uppercase tracking-widest">
                {gameState.srPoints.toLocaleString()} / 3,000 SR REQUIRED
              </p>
            </div>
            <p className="text-[10px] text-white font-black uppercase tracking-widest leading-relaxed">
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
    <ThemeProvider>
      <SolanaWalletContext>
        <AppInner />
      </SolanaWalletContext>
    </ThemeProvider>
  );
};

export default App;