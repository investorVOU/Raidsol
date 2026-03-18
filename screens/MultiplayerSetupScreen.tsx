
import React, { useState, useEffect, useRef } from 'react';
import { Room, Currency } from '../types';
import { Html5Qrcode } from 'html5-qrcode';
import QRious from 'qrious';
import { Scan, X, Copy, Check, Swords, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ChatMessage {
  id: string;
  wallet_address: string;
  username: string;
  content: string;
  inserted_at: string;
}

interface JoinPreview {
  stake: number;
  currency: Currency;
  maxPlayers: number;
  alreadyJoined?: boolean;
}

interface MultiplayerSetupScreenProps {
  onBack: () => void;
  onLeaveRoom: () => void;
  onCreateRoom: (stake: number, maxPlayers: number, currency: Currency) => Promise<void>;
  onJoinRoom: (code: string) => Promise<void>;
  onFetchRoom: (code: string) => Promise<JoinPreview | null>;
  activeRoom?: Room;
  onStartGame: () => void;
  currentWalletBalance: number;
  currentUsdcBalance: number;
  currentSkrBalance: number;
  currentRaidBalance: number;
  walletAddress?: string | null;
  joinNotification?: string | null;
  initialRoomCode?: string;
}

const CURRENCY_LABELS: Record<Currency, string> = {
  [Currency.SOL]:  'SOL',
  [Currency.USDC]: 'USDC',
  [Currency.SKR]:  'SKR',
  [Currency.RAID]: 'RAID',
};

const STAKE_OPTIONS: Record<Currency, number[]> = {
  [Currency.SOL]:  [0.05, 0.1, 0.5, 1.0],
  [Currency.USDC]: [1, 5, 10, 25],
  [Currency.SKR]:  [100, 500, 1000, 5000],
  [Currency.RAID]: [100, 500, 1000, 5000],
};

const MultiplayerSetupScreen: React.FC<MultiplayerSetupScreenProps> = ({
  onBack,
  onLeaveRoom,
  onCreateRoom,
  onJoinRoom,
  onFetchRoom,
  activeRoom,
  onStartGame,
  currentWalletBalance,
  currentUsdcBalance,
  currentSkrBalance,
  currentRaidBalance,
  walletAddress,
  joinNotification,
  initialRoomCode,
}) => {
  const [view, setView] = useState<'MENU' | 'CREATE' | 'JOIN'>(initialRoomCode ? 'JOIN' : 'MENU');

  // CREATE state
  const [stakeCurrency, setStakeCurrency] = useState<Currency>(Currency.SOL);
  const [stakeAmount, setStakeAmount]   = useState<number>(0.1);
  const [maxPlayers, setMaxPlayers]     = useState<number>(4);

  // JOIN state
  const [inviteCode, setInviteCode]           = useState(initialRoomCode ?? '');
  const [joinPreview, setJoinPreview]         = useState<JoinPreview | null>(null);
  const [previewLoading, setPreviewLoading]   = useState(false);
  const [previewError, setPreviewError]       = useState('');

  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining]   = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // QR scanner
  const qrCanvasRef    = useRef<HTMLCanvasElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef     = useRef<Html5Qrcode | null>(null);
  const isScanningRef  = useRef(false); // tracks actual running state (avoids stale closure in cleanup)

  // Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setStakeAmount(STAKE_OPTIONS[stakeCurrency][1]); }, [stakeCurrency]);

  // Auto-lookup when arriving via invite link
  useEffect(() => {
    if (initialRoomCode && initialRoomCode.startsWith('RAID-')) {
      handleLookupRoom();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeRoom && qrCanvasRef.current) {
      new QRious({
        element: qrCanvasRef.current,
        value: activeRoom.code,
        size: 180,
        background: 'transparent',
        foreground: '#9945FF',
        level: 'H',
      });
    }
  }, [activeRoom]);

  // Unmount-only cleanup — uses ref so it never reads stale state
  useEffect(() => {
    return () => {
      if (scannerRef.current && isScanningRef.current) {
        isScanningRef.current = false;
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    if (!activeRoom) return;
    let cancelled = false;
    supabase
      .from('messages')
      .select('id, wallet_address, username, content, inserted_at')
      .eq('room_id', activeRoom.id)
      .order('inserted_at', { ascending: true })
      .limit(50)
      .then(({ data }) => { if (!cancelled && data) setChatMessages(data as ChatMessage[]); });

    const channel = supabase
      .channel(`room-chat:${activeRoom.id}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${activeRoom.id}` },
        (payload) => { if (!cancelled) setChatMessages(prev => [...prev, payload.new as ChatMessage].slice(-100)); },
      )
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [activeRoom?.id]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  const sendChatMessage = async () => {
    const text = chatInput.trim().slice(0, 200);
    if (!text || !walletAddress || !activeRoom) return;
    setChatInput('');
    const myName = players.find(p => p.id === walletAddress)?.name ?? walletAddress.slice(0, 8);
    await supabase.from('messages').insert({ room_id: activeRoom.id, wallet_address: walletAddress, username: myName, content: text });
  };

  const startScanning = async () => {
    try {
      setIsScanning(true);
      setTimeout(async () => {
        const html5QrCode = new Html5Qrcode('reader');
        scannerRef.current = html5QrCode;
        await html5QrCode.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 200, height: 200 } },
          (decodedText) => { setInviteCode(decodedText); stopScanning(); },
          () => {},
        );
        isScanningRef.current = true; // only true once camera is actually running
      }, 100);
    } catch {
      alert('Camera access failed or denied.');
      isScanningRef.current = false;
      setIsScanning(false);
    }
  };

  const stopScanning = async () => {
    isScanningRef.current = false; // mark stopped before the async call
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); await scannerRef.current.clear(); } catch { /* already stopped */ }
    }
    setIsScanning(false);
  };

  const handleLookupRoom = async () => {
    const code = inviteCode.trim().toUpperCase();
    if (!code.startsWith('RAID-')) { setPreviewError('Invalid room code — must start with RAID-'); return; }
    setPreviewLoading(true); setPreviewError(''); setJoinPreview(null);
    try {
      const preview = await onFetchRoom(code);
      if (!preview) setPreviewError('Room not found, already started, or is full.');
      else setJoinPreview(preview);
    } catch { setPreviewError('Could not reach server. Check your connection.'); }
    setPreviewLoading(false);
  };

  const copyToClipboard = async (text: string): Promise<void> => {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const el = document.createElement('textarea');
      el.value = text;
      el.style.cssText = 'position:fixed;left:-9999px;top:-9999px';
      document.body.appendChild(el);
      el.focus();
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
  };

  const copyCode = async () => {
    if (!activeRoom) return;
    try {
      await copyToClipboard(activeRoom.code);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    } catch { /* silent */ }
  };

  const copyInviteLink = async () => {
    if (!activeRoom) return;
    try {
      await copyToClipboard(`https://solraid.app/?join=${activeRoom.code}`);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch { /* silent */ }
  };

  const players  = activeRoom?.players ?? [];
  const isHost   = !!walletAddress && activeRoom?.hostId === walletAddress;
  const canStart = isHost && players.length > 1;
  const roomCcy  = activeRoom?.stakeCurrency ?? Currency.SOL;
  const totalPot = activeRoom ? (activeRoom.stakePerPlayer * players.length) : 0;

  const balanceFor = (c: Currency) =>
    c === Currency.SOL ? currentWalletBalance : c === Currency.USDC ? currentUsdcBalance : c === Currency.SKR ? currentSkrBalance : currentRaidBalance;
  const balanceFmt = (c: Currency) =>
    c === Currency.SOL ? balanceFor(c).toFixed(4) : c === Currency.USDC ? balanceFor(c).toFixed(2) : balanceFor(c).toFixed(0);

  // ── ACTIVE LOBBY ─────────────────────────────────────────────────────
  if (activeRoom) {
    return (
      <div className="h-full flex flex-col animate-in fade-in duration-300 relative bg-[var(--modal-bg)]">

        {/* Join notification */}
        {joinNotification && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[300] w-max max-w-xs bg-[#9945FF]/12 border border-[#9945FF] px-5 py-3 text-xs font-bold text-white animate-in slide-in-from-top-4 duration-300 shadow-[0_0_20px_rgba(153,69,255,0.3)]">
            {joinNotification}
          </div>
        )}

        {/* Top bar */}
        <div className="shrink-0 flex justify-between items-center px-4 sm:px-6 py-3 border-b border-white/5 bg-[var(--modal-bg)] z-10">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-[#9945FF] rounded-full animate-pulse" style={{ boxShadow: '0 0 8px rgba(153,69,255,0.7)' }} />
            <span className="text-xs font-bold text-[#9945FF]">Lobby active</span>
            <span className="text-[10px] text-white">· {players.length}/{activeRoom.maxPlayers} online</span>
          </div>
          <button onClick={onLeaveRoom} className="text-[10px] font-bold text-[#9945FF]/70 hover:text-[#9945FF] border border-[#9945FF]/20 hover:border-[#9945FF]/50 px-3 py-1.5 transition-all">
            Leave room
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-hide">
          <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">

            {/* ── CODE + QR ── */}
            <div className="bg-[#0a0a1a] border border-[#9945FF]/40 tech-border relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-[#9945FF] to-transparent" />
              <div className="flex flex-col sm:flex-row items-center gap-6 p-4 sm:p-6">
                {/* QR */}
                <div className="shrink-0 p-2 bg-[var(--modal-bg)] border border-white/10">
                  <canvas ref={qrCanvasRef} width="180" height="180" className="w-[120px] h-[120px] sm:w-[150px] sm:h-[150px] block" />
                  <p className="text-[8px] text-center text-white font-bold mt-1">Scan to join</p>
                </div>
                {/* Code + stats */}
                <div className="flex-1 w-full text-center sm:text-left">
                  <p className="text-[10px] font-bold text-white mb-2">Access code</p>
                  <button
                    onClick={copyCode}
                    className="group inline-flex items-center gap-3 px-5 py-3 bg-white/5 border border-white/10 hover:border-[#9945FF]/50 hover:bg-[#9945FF]/5 transition-all mb-2"
                  >
                    <span className="text-3xl sm:text-4xl font-black text-white tracking-widest mono select-all">{activeRoom.code}</span>
                    <span className="text-white group-hover:text-white transition-colors">
                      {codeCopied ? <Check size={18} /> : <Copy size={18} />}
                    </span>
                  </button>
                  <p className="text-[9px] font-bold text-white mb-3">{codeCopied ? 'Copied!' : 'Tap to copy room code'}</p>
                  <button
                    onClick={copyInviteLink}
                    className="flex items-center gap-2 px-3 py-2 text-[9px] font-bold transition-all mb-4"
                    style={{ background: 'rgba(153,69,255,0.08)', border: '1px solid rgba(153,69,255,0.25)', color: '#9945FF' }}
                  >
                    {linkCopied ? <Check size={11} /> : <Copy size={11} />}
                    {linkCopied ? 'Link copied!' : 'Copy invite link'}
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-[var(--modal-bg)] border border-white/8 p-3 text-center">
                      <p className="text-[9px] text-white font-bold mb-0.5">Stake</p>
                      <p className="text-lg font-black text-[#FFB800] mono">{activeRoom.stakePerPlayer} <span className="text-sm">{CURRENCY_LABELS[roomCcy]}</span></p>
                    </div>
                    <div className="bg-[var(--modal-bg)] border border-white/8 p-3 text-center">
                      <p className="text-[9px] text-white font-bold mb-0.5">Pot</p>
                      <p className="text-lg font-black text-yellow-500 mono">{totalPot.toFixed(roomCcy === Currency.SOL ? 2 : 0)} <span className="text-sm">{CURRENCY_LABELS[roomCcy]}</span></p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── PLAYER SLOTS ── */}
            <div className="bg-[#0a0a1a] border border-white/8 tech-border overflow-hidden">
              <div className="px-4 py-3 border-b border-white/5 flex justify-between items-center">
                <span className="text-[10px] font-bold text-white">Players</span>
                <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#9945FF' }}>
                  {players.length}/{activeRoom.maxPlayers}
                </span>
              </div>
              <div className="divide-y divide-white/5">
                {players.map((player, i) => (
                  <div key={player.id} className="flex items-center gap-3 px-4 py-3 animate-in slide-in-from-left duration-300" style={{ animationDelay: `${i * 80}ms` }}>
                    <div className="w-6 h-6 border border-white/25 bg-white/8 flex items-center justify-center shrink-0">
                      <span className="text-[9px] font-black text-white">{String(i + 1).padStart(2, '0')}</span>
                    </div>
                    <span className="flex-1 text-sm font-bold text-white">
                      {player.name} {player.id === walletAddress && <span className="text-[9px] text-white">(you)</span>}
                    </span>
                    <span className="text-[9px] font-bold text-white bg-white/8 border border-white/15 px-2 py-0.5">Ready</span>
                  </div>
                ))}
                {[...Array(activeRoom.maxPlayers - players.length)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3 opacity-30">
                    <div className="w-6 h-6 border border-white/10 flex items-center justify-center shrink-0">
                      <span className="text-[9px] font-black text-white">{String(players.length + i + 1).padStart(2, '0')}</span>
                    </div>
                    <span className="flex-1 text-sm font-bold text-white">Waiting for player...</span>
                    <div className="w-2 h-2 rounded-full bg-white/10 animate-pulse" />
                  </div>
                ))}
              </div>
            </div>

            {/* ── CHAT ── */}
            <div className="bg-[#0a0a1a] border border-white/8 tech-border overflow-hidden">
              <div className="px-4 py-2 border-b border-white/5">
                <span className="text-[9px] font-bold text-white">Comms</span>
              </div>
              <div className="h-36 overflow-y-auto scrollbar-hide bg-[var(--modal-bg)]/60 p-3 space-y-1.5">
                {chatMessages.length === 0 && (
                  <p className="text-[10px] text-white font-bold text-center mt-10">No messages yet...</p>
                )}
                {chatMessages.map((msg) => {
                  const isMe = msg.wallet_address === walletAddress;
                  return (
                    <div key={msg.id} className={`flex gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] px-2.5 py-1.5 ${isMe ? 'bg-[#9945FF]/12 border border-[#9945FF]/25' : 'bg-white/5 border border-white/8'}`}>
                        {!isMe && <p className="text-[8px] font-bold text-white mb-0.5">{msg.username}</p>}
                        <p className={`text-[11px] font-medium ${isMe ? 'text-white' : 'text-white'}`}>{msg.content}</p>
                      </div>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>
              <div className="flex gap-1.5 p-2 border-t border-white/5">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') sendChatMessage(); }}
                  placeholder="Transmit..."
                  maxLength={200}
                  className="flex-1 bg-[var(--modal-bg)] border border-white/10 px-3 py-2 text-xs font-black text-white placeholder-white/15 outline-none focus:border-[#9945FF]/50 transition-colors"
                />
                <button
                  onClick={sendChatMessage}
                  disabled={!chatInput.trim()}
                  className="px-4 py-2 bg-[#9945FF]/15 border border-[#9945FF]/30 text-[#9945FF]/80 text-xs font-bold hover:bg-[#9945FF]/25 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                >
                  Send
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* Footer CTA */}
        <div className="shrink-0 p-4 sm:p-5 border-t border-white/5 bg-[var(--modal-bg)] z-10">
          {isHost ? (
            <button
              onClick={onStartGame}
              disabled={!canStart}
              className={`w-full py-5 sm:py-6 tech-border font-bold uppercase tracking-tight text-xl sm:text-2xl transition-all
                ${canStart
                  ? 'bg-[#9945FF] text-white shadow-[0_0_40px_rgba(153,69,255,0.35)] hover:bg-[#7c2dd6] active:scale-[0.99]'
                  : 'bg-white/5 text-white cursor-not-allowed border border-white/5'}`}
            >
              {canStart ? 'Start PvP →' : `Waiting for players (${players.length}/${activeRoom.maxPlayers})...`}
            </button>
          ) : (
            <div className="w-full py-5 sm:py-6 border border-white/8 tech-border text-center bg-[var(--modal-bg)]">
              <span className="text-sm font-bold text-white animate-pulse">Waiting for host to start...</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── MENU / CREATE / JOIN ──────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col animate-in slide-in-from-right duration-300" style={{ backgroundColor: 'var(--app-bg)' }}>

      {/* QR Scanner overlay — full-screen, safe on all viewports */}
      {isScanning && (
        <div className="fixed inset-0 z-[200] bg-[var(--modal-bg)] flex flex-col">
          {/* Top bar */}
          <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-[#9945FF]/30 bg-[var(--modal-bg)]">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#9945FF] animate-pulse" />
              <span className="text-xs font-bold text-[#9945FF]">Scanning QR code</span>
            </div>
            <button
              onClick={stopScanning}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-white/20 hover:border-white/50 text-white hover:text-white transition-all text-xs font-bold"
            >
              <X size={14} /> Cancel
            </button>
          </div>

          {/* Camera view — fills remaining space, never overflows */}
          <div className="flex-1 flex items-center justify-center p-6 min-h-0">
            <div className="relative w-full max-w-xs">
              {/* Scanner mount — aspect-square so it fits any phone */}
              <div id="reader" className="w-full aspect-square bg-[var(--modal-bg)] border-2 border-[#9945FF]/40 overflow-hidden" />
              {/* Corner decorators */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-2 left-2 w-6 h-6 border-t-4 border-l-4 border-[#9945FF]" />
                <div className="absolute top-2 right-2 w-6 h-6 border-t-4 border-r-4 border-[#9945FF]" />
                <div className="absolute bottom-2 left-2 w-6 h-6 border-b-4 border-l-4 border-[#9945FF]" />
                <div className="absolute bottom-2 right-2 w-6 h-6 border-b-4 border-r-4 border-[#9945FF]" />
              </div>
            </div>
          </div>

          {/* Bottom hint — always visible */}
          <div className="shrink-0 px-4 py-5 text-center border-t border-white/5 bg-[var(--modal-bg)]">
            <p className="text-[11px] font-bold text-white animate-pulse">
              Point camera at room QR code
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b border-white/5 bg-[var(--modal-bg)]">
        <button
          onClick={() => view === 'MENU' ? onBack() : (setView('MENU'), setJoinPreview(null), setPreviewError(''))}
          className="w-8 h-8 flex items-center justify-center text-white hover:text-white border border-white/10 hover:border-white/30 transition-all font-bold"
        >
          {'<'}
        </button>
        <div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white leading-none">
            PvP <span className="text-[#9945FF]">Arena</span>
          </h2>
          <p className="text-[9px] font-bold text-white">
            {view === 'MENU' ? 'Select mode' : view === 'CREATE' ? 'Configure room' : 'Enter room code'}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="max-w-lg mx-auto p-4 sm:p-6 flex flex-col min-h-full">

          {/* ── MENU ── */}
          {view === 'MENU' && (
            <div className="flex flex-col gap-4 flex-1 justify-center">

              {/* Banner */}
              <div className="border border-[#9945FF]/25 bg-[#9945FF]/4 p-4 sm:p-5 tech-border text-center">
                <p className="text-white font-bold text-sm sm:text-base mb-1">Winner takes all</p>
                <p className="text-white text-[11px] font-medium leading-relaxed">
                  Pool tokens with rivals. Raid the same protocol.<br />
                  <span className="text-white">Highest extract wins the entire pot.</span>
                </p>
              </div>

              {/* Create card */}
              <button
                onClick={() => setView('CREATE')}
                className="group w-full p-4 sm:p-5 bg-white text-black tech-border hover:bg-[#9945FF] hover:text-white transition-all active:scale-[0.99] text-left flex items-center gap-4"
              >
                <div className="w-10 h-10 bg-[var(--modal-bg)]/10 flex items-center justify-center shrink-0">
                  <Swords size={20} />
                </div>
                <div className="flex-1">
                  <p className="text-base sm:text-lg font-bold uppercase leading-none mb-0.5">Create room</p>
                  <p className="text-[10px] font-bold opacity-50">Set stake · Invite friends · Host</p>
                </div>
                <span className="text-xl font-black opacity-40 group-hover:opacity-100 transition-opacity">→</span>
              </button>

              {/* Join card */}
              <button
                onClick={() => setView('JOIN')}
                className="group w-full p-4 sm:p-5 bg-[var(--modal-bg)] border-2 border-white/20 text-white tech-border hover:border-[#9945FF]/60 hover:bg-[#9945FF]/5 transition-all active:scale-[0.99] text-left flex items-center gap-4"
              >
                <div className="w-10 h-10 border border-white/20 flex items-center justify-center shrink-0 group-hover:border-[#9945FF]/50">
                  <Users size={20} className="text-white group-hover:text-[#9945FF]" />
                </div>
                <div className="flex-1">
                  <p className="text-base sm:text-lg font-bold uppercase leading-none mb-0.5">Join room</p>
                  <p className="text-[10px] font-bold text-white">Enter code or scan QR</p>
                </div>
                <span className="text-xl font-black text-white group-hover:text-[#9945FF] transition-colors">→</span>
              </button>

            </div>
          )}

          {/* ── CREATE ── */}
          {view === 'CREATE' && (
            <div className="space-y-5 py-2">

              {/* Currency selector */}
              <div>
                <p className="text-[10px] font-bold text-white mb-2">01 · Stake currency</p>
                <div className="grid grid-cols-3 gap-2">
                  {([Currency.SOL, Currency.SKR, Currency.RAID] as Currency[]).map(c => {
                    const active = stakeCurrency === c;
                    const col = c === Currency.SOL ? 'border-[#9945FF] text-[#9945FF] bg-[#9945FF]/10'
                              : c === Currency.SKR ? 'border-orange-400 text-orange-400 bg-orange-400/10'
                              : 'border-[#00E5FF] text-[#00E5FF] bg-[#00E5FF]/10';
                    return (
                      <button
                        key={c}
                        onClick={() => setStakeCurrency(c)}
                        className={`py-3 sm:py-4 border-2 tech-border font-bold text-sm transition-all ${active ? col : 'bg-[var(--modal-bg)] border-white/10 text-white hover:border-white/30'}`}
                      >
                        <p className="text-sm font-bold">{CURRENCY_LABELS[c]}</p>
                        <p className="text-[9px] font-bold opacity-60 mt-0.5">{balanceFmt(c)}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Stake amount */}
              <div>
                <p className="text-[10px] font-bold text-white mb-2">02 · Entry stake</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                  {STAKE_OPTIONS[stakeCurrency].map(val => (
                    <button
                      key={val}
                      onClick={() => setStakeAmount(val)}
                      className={`py-4 tech-border font-black text-lg transition-all ${stakeAmount === val ? 'bg-[#9945FF] text-white border-[#9945FF]' : 'bg-[var(--modal-bg)] border-white/10 text-white hover:border-white/30 hover:text-white'}`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0.001"
                    step={stakeCurrency === Currency.SKR || stakeCurrency === Currency.RAID ? '1' : '0.01'}
                    placeholder={`Custom amount`}
                    className="flex-1 bg-[var(--modal-bg)] border border-white/15 px-3 py-2.5 text-sm font-black text-white placeholder-white/20 outline-none focus:border-[#9945FF]/50 mono transition-colors"
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (!isNaN(v) && v > 0) setStakeAmount(v);
                    }}
                  />
                  <span className="text-[10px] font-bold text-white shrink-0">{CURRENCY_LABELS[stakeCurrency]}</span>
                </div>
              </div>

              {/* Max players */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <p className="text-[10px] font-bold text-white">03 · Max players</p>
                  <span className="text-sm font-black text-[#9945FF] mono">{maxPlayers}</span>
                </div>
                <input
                  type="range" min="2" max="10" value={maxPlayers}
                  onChange={(e) => setMaxPlayers(parseInt(e.target.value))}
                  className="w-full accent-[#9945FF]"
                />
                <div className="flex justify-between text-[9px] font-bold text-white mt-1">
                  <span>2 min</span>
                  <span>10 max</span>
                </div>
              </div>

              {/* Pool preview */}
              <div className="p-4 sm:p-5 bg-[#0a0a1a] border border-white/12 tech-border">
                <div className="flex justify-between items-center mb-3 pb-3 border-b border-white/5">
                  <span className="text-[10px] font-bold text-white">Stake per player</span>
                  <span className="font-black mono text-white">{stakeAmount} {CURRENCY_LABELS[stakeCurrency]}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-white">Max total pot</span>
                  <span className="text-2xl font-black text-yellow-500 mono">
                    {(stakeAmount * maxPlayers).toFixed(stakeCurrency === Currency.SOL ? 2 : 0)}
                    <span className="text-sm ml-1 text-yellow-500/60">{CURRENCY_LABELS[stakeCurrency]}</span>
                  </span>
                </div>
              </div>

              <button
                onClick={async () => { setIsCreating(true); try { await onCreateRoom(stakeAmount, maxPlayers, stakeCurrency); } finally { setIsCreating(false); } }}
                disabled={isCreating}
                className="w-full py-5 sm:py-6 bg-[#9945FF] text-white tech-border font-bold uppercase tracking-tight text-xl sm:text-2xl shadow-[0_0_25px_rgba(153,69,255,0.3)] hover:bg-[#7c2dd6] active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isCreating ? 'Awaiting wallet...' : 'Deploy lobby →'}
              </button>
            </div>
          )}

          {/* ── JOIN ── */}
          {view === 'JOIN' && (
            <div className="space-y-4 py-2">

              <div>
                <p className="text-[10px] font-bold text-white mb-2">Room code</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inviteCode}
                    onChange={(e) => { setInviteCode(e.target.value.toUpperCase()); setJoinPreview(null); setPreviewError(''); }}
                    placeholder="RAID-XXXX"
                    className="flex-1 bg-[var(--modal-bg)] border-2 border-white/20 px-3 py-3 sm:py-4 text-xl sm:text-2xl font-black text-center text-white placeholder-white/10 outline-none focus:border-[#9945FF] tech-border mono transition-colors min-w-0"
                  />
                  <button
                    onClick={startScanning}
                    className="shrink-0 bg-white/5 border-2 border-white/15 tech-border px-3 sm:px-4 hover:bg-[#9945FF]/10 hover:border-[#9945FF]/50 text-white hover:text-[#9945FF] transition-all"
                    title="Scan QR Code"
                  >
                    <Scan size={20} />
                  </button>
                </div>
              </div>

              {previewError && (
                <div className="flex items-center gap-2 p-3 border border-[#9945FF]/30 bg-[#9945FF]/5">
                  <div className="w-1.5 h-1.5 bg-[#9945FF] rounded-full shrink-0" />
                  <p className="text-[#9945FF] text-[11px] font-bold">{previewError}</p>
                </div>
              )}

              {joinPreview && (
                <div className="bg-[#0a0a1a] border border-[#9945FF]/35 tech-border overflow-hidden">
                  <div className="px-4 py-2 bg-[#9945FF]/8 border-b border-[#9945FF]/18">
                    <p className="text-[9px] font-bold text-[#9945FF]">Room details</p>
                  </div>
                  <div className="p-4 grid grid-cols-2 gap-3 mb-3">
                    <div className="bg-[var(--modal-bg)]/60 p-3 text-center border border-white/8">
                      <p className="text-[9px] font-bold text-white mb-1">Stake</p>
                      <p className="text-xl font-black text-[#FFB800] mono">{joinPreview.stake} <span className="text-sm">{CURRENCY_LABELS[joinPreview.currency]}</span></p>
                    </div>
                    <div className="bg-[var(--modal-bg)]/60 p-3 text-center border border-white/8">
                      <p className="text-[9px] font-bold text-white mb-1">Max players</p>
                      <p className="text-xl font-black text-white mono">{joinPreview.maxPlayers}</p>
                    </div>
                  </div>
                  <div className="px-4 pb-4">
                    <div className="flex items-center justify-between p-2.5 bg-[var(--modal-bg)]/40 border border-white/5">
                      <span className="text-[9px] font-bold text-white">Your balance</span>
                      <span className={`text-[11px] font-black mono ${
                        balanceFor(joinPreview.currency) >= joinPreview.stake ? 'text-white' : 'text-[#9945FF]'
                      }`}>
                        {balanceFmt(joinPreview.currency)} {CURRENCY_LABELS[joinPreview.currency]}
                        {balanceFor(joinPreview.currency) < joinPreview.stake && <span className="ml-1 text-[#9945FF]/60">(insufficient)</span>}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {!joinPreview ? (
                <button
                  onClick={handleLookupRoom}
                  disabled={previewLoading || inviteCode.length < 6}
                  className="w-full py-5 bg-white text-black tech-border font-bold uppercase tracking-tight text-xl hover:bg-[#9945FF] hover:text-white transition-all active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {previewLoading ? 'Searching...' : 'Look up room →'}
                </button>
              ) : joinPreview.alreadyJoined ? (
                <button
                  onClick={async () => { setIsJoining(true); try { await onJoinRoom(inviteCode); } finally { setIsJoining(false); } }}
                  disabled={isJoining}
                  style={{ background: "linear-gradient(135deg, #9945FF 0%, #7c2dd6 100%)", boxShadow: "0 0 20px rgba(153,69,255,0.30)" }} className="w-full py-5 text-white tech-border font-bold uppercase tracking-tight text-xl hover:brightness-110 active:scale-[0.99] transition-all disabled:opacity-60"
                >
                  {isJoining ? 'Reconnecting...' : 'Rejoin room →'}
                </button>
              ) : (
                <button
                  onClick={async () => { setIsJoining(true); try { await onJoinRoom(inviteCode); } finally { setIsJoining(false); } }}
                  disabled={isJoining || balanceFor(joinPreview.currency) < joinPreview.stake}
                  className="w-full py-5 bg-[#9945FF] text-white tech-border font-bold uppercase tracking-tight text-xl shadow-[0_0_25px_rgba(153,69,255,0.3)] hover:bg-[#7c2dd6] active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isJoining ? 'Awaiting wallet...' : `Pay & join — ${joinPreview.stake} ${CURRENCY_LABELS[joinPreview.currency]}`}
                </button>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default MultiplayerSetupScreen;
