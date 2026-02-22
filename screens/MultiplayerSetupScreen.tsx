
import React, { useState, useEffect, useRef } from 'react';
import { Room, Currency } from '../types';
import { Html5Qrcode } from 'html5-qrcode';
import QRious from 'qrious';
import { Scan, X, Copy, Check, Swords, Users, Trophy } from 'lucide-react';
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
  walletAddress?: string | null;
  joinNotification?: string | null;
}

const CURRENCY_LABELS: Record<Currency, string> = {
  [Currency.SOL]:  'SOL',
  [Currency.USDC]: 'USDC',
  [Currency.SKR]:  'SKR',
};

const STAKE_OPTIONS: Record<Currency, number[]> = {
  [Currency.SOL]:  [0.05, 0.1, 0.5, 1.0],
  [Currency.USDC]: [1, 5, 10, 25],
  [Currency.SKR]:  [100, 500, 1000, 5000],
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
  walletAddress,
  joinNotification,
}) => {
  const [view, setView] = useState<'MENU' | 'CREATE' | 'JOIN'>('MENU');

  // CREATE state
  const [stakeCurrency, setStakeCurrency] = useState<Currency>(Currency.SOL);
  const [stakeAmount, setStakeAmount]   = useState<number>(0.1);
  const [maxPlayers, setMaxPlayers]     = useState<number>(4);

  // JOIN state
  const [inviteCode, setInviteCode]           = useState('');
  const [joinPreview, setJoinPreview]         = useState<JoinPreview | null>(null);
  const [previewLoading, setPreviewLoading]   = useState(false);
  const [previewError, setPreviewError]       = useState('');

  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining]   = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  // QR scanner
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef  = useRef<Html5Qrcode | null>(null);

  // Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setStakeAmount(STAKE_OPTIONS[stakeCurrency][1]); }, [stakeCurrency]);

  useEffect(() => {
    if (activeRoom && qrCanvasRef.current) {
      new QRious({
        element: qrCanvasRef.current,
        value: activeRoom.code,
        size: 180,
        background: 'transparent',
        foreground: '#14F195',
        level: 'H',
      });
    }
  }, [activeRoom]);

  useEffect(() => {
    return () => {
      if (scannerRef.current && isScanning) scannerRef.current.stop().catch(console.error);
    };
  }, [isScanning]);

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
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => { setInviteCode(decodedText); stopScanning(); },
          () => {},
        );
      }, 100);
    } catch {
      alert('Camera access failed or denied.');
      setIsScanning(false);
    }
  };

  const stopScanning = async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); await scannerRef.current.clear(); } catch { /* ignored */ }
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

  const copyCode = () => {
    if (!activeRoom) return;
    navigator.clipboard.writeText(activeRoom.code);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const players  = activeRoom?.players ?? [];
  const isHost   = !!walletAddress && activeRoom?.hostId === walletAddress;
  const canStart = isHost && players.length > 1;
  const roomCcy  = activeRoom?.stakeCurrency ?? Currency.SOL;
  const totalPot = activeRoom ? (activeRoom.stakePerPlayer * players.length) : 0;

  const balanceFor = (c: Currency) =>
    c === Currency.SOL ? currentWalletBalance : c === Currency.USDC ? currentUsdcBalance : currentSkrBalance;
  const balanceFmt = (c: Currency) =>
    c === Currency.SOL ? balanceFor(c).toFixed(4) : c === Currency.USDC ? balanceFor(c).toFixed(2) : balanceFor(c).toFixed(0);

  // ── ACTIVE LOBBY ─────────────────────────────────────────────────────
  if (activeRoom) {
    return (
      <div className="h-full flex flex-col animate-in fade-in duration-300 relative bg-black">

        {/* Join notification */}
        {joinNotification && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[300] w-max max-w-xs bg-[#14F195]/15 border border-[#14F195] px-5 py-3 text-xs font-black text-[#14F195] uppercase tracking-widest animate-in slide-in-from-top-4 duration-300 shadow-[0_0_20px_rgba(20,241,149,0.3)]">
            {joinNotification}
          </div>
        )}

        {/* Top bar */}
        <div className="shrink-0 flex justify-between items-center px-4 sm:px-6 py-3 border-b border-white/5 bg-[#050505] z-10">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-[#9945FF] rounded-full animate-pulse shadow-[0_0_8px_#9945FF]" />
            <span className="text-xs font-black uppercase tracking-widest text-[#9945FF]">LOBBY_ACTIVE</span>
            <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">// {players.length}/{activeRoom.maxPlayers} ONLINE</span>
          </div>
          <button onClick={onLeaveRoom} className="text-[10px] font-black uppercase tracking-widest text-red-500/70 hover:text-red-400 border border-red-500/20 hover:border-red-500/50 px-3 py-1.5 transition-all">
            LEAVE_ROOM
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-hide">
          <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">

            {/* ── CODE + QR ── */}
            <div className="bg-[#09090b] border border-[#9945FF]/40 tech-border relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-[#9945FF] to-transparent" />
              <div className="flex flex-col sm:flex-row items-center gap-6 p-4 sm:p-6">
                {/* QR */}
                <div className="shrink-0 p-2 bg-black border border-white/10">
                  <canvas ref={qrCanvasRef} width="180" height="180" className="w-[120px] h-[120px] sm:w-[150px] sm:h-[150px] block" />
                  <p className="text-[8px] text-center text-white/20 font-black uppercase mt-1 tracking-widest">SCAN_TO_JOIN</p>
                </div>
                {/* Code + stats */}
                <div className="flex-1 w-full text-center sm:text-left">
                  <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.4em] mb-2">ACCESS_CODE</p>
                  <button
                    onClick={copyCode}
                    className="group inline-flex items-center gap-3 px-5 py-3 bg-white/5 border border-white/10 hover:border-[#9945FF]/50 hover:bg-[#9945FF]/5 transition-all mb-2"
                  >
                    <span className="text-3xl sm:text-4xl font-black text-white tracking-widest mono select-all">{activeRoom.code}</span>
                    <span className="text-white/30 group-hover:text-[#9945FF] transition-colors">
                      {codeCopied ? <Check size={18} /> : <Copy size={18} />}
                    </span>
                  </button>
                  <p className="text-[9px] font-black text-white/20 uppercase tracking-widest mb-4">{codeCopied ? 'COPIED!' : 'TAP_TO_COPY'}</p>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-black border border-white/8 p-3 text-center">
                      <p className="text-[9px] text-white/30 font-black uppercase tracking-widest mb-0.5">STAKE</p>
                      <p className="text-lg font-black text-[#14F195] mono">{activeRoom.stakePerPlayer} <span className="text-sm">{CURRENCY_LABELS[roomCcy]}</span></p>
                    </div>
                    <div className="bg-black border border-white/8 p-3 text-center">
                      <p className="text-[9px] text-white/30 font-black uppercase tracking-widest mb-0.5">POT</p>
                      <p className="text-lg font-black text-yellow-500 mono">{totalPot.toFixed(roomCcy === Currency.SKR ? 0 : 2)} <span className="text-sm">{CURRENCY_LABELS[roomCcy]}</span></p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── PLAYER SLOTS ── */}
            <div className="bg-[#09090b] border border-white/8 tech-border overflow-hidden">
              <div className="px-4 py-3 border-b border-white/5 flex justify-between items-center">
                <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">OPERATIVES</span>
                <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: players.length >= activeRoom.maxPlayers ? '#14F195' : '#9945FF' }}>
                  {players.length}/{activeRoom.maxPlayers}
                </span>
              </div>
              <div className="divide-y divide-white/5">
                {players.map((player, i) => (
                  <div key={player.id} className="flex items-center gap-3 px-4 py-3 animate-in slide-in-from-left duration-300" style={{ animationDelay: `${i * 80}ms` }}>
                    <div className="w-6 h-6 border border-[#9945FF]/50 bg-[#9945FF]/10 flex items-center justify-center shrink-0">
                      <span className="text-[9px] font-black text-[#9945FF]">{String(i + 1).padStart(2, '0')}</span>
                    </div>
                    <span className={`flex-1 text-sm font-black italic ${player.id === walletAddress ? 'text-[#14F195]' : 'text-white'}`}>
                      {player.name} {player.id === walletAddress && <span className="text-[9px] text-[#14F195]/50 not-italic">(YOU)</span>}
                    </span>
                    <span className="text-[9px] font-black text-[#14F195] bg-[#14F195]/10 border border-[#14F195]/20 px-2 py-0.5">READY</span>
                  </div>
                ))}
                {[...Array(activeRoom.maxPlayers - players.length)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3 opacity-30">
                    <div className="w-6 h-6 border border-white/10 flex items-center justify-center shrink-0">
                      <span className="text-[9px] font-black text-white/20">{String(players.length + i + 1).padStart(2, '0')}</span>
                    </div>
                    <span className="flex-1 text-sm font-black italic text-white/20">Waiting for operative...</span>
                    <div className="w-2 h-2 rounded-full bg-white/10 animate-pulse" />
                  </div>
                ))}
              </div>
            </div>

            {/* ── CHAT ── */}
            <div className="bg-[#09090b] border border-white/8 tech-border overflow-hidden">
              <div className="px-4 py-2 border-b border-white/5">
                <span className="text-[9px] font-black text-white/30 uppercase tracking-[0.4em]">COMMS_CHANNEL</span>
              </div>
              <div className="h-36 overflow-y-auto scrollbar-hide bg-black/60 p-3 space-y-1.5">
                {chatMessages.length === 0 && (
                  <p className="text-[10px] text-white/15 font-black italic tracking-widest text-center mt-10">No transmissions yet...</p>
                )}
                {chatMessages.map((msg) => {
                  const isMe = msg.wallet_address === walletAddress;
                  return (
                    <div key={msg.id} className={`flex gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] px-2.5 py-1.5 ${isMe ? 'bg-[#9945FF]/20 border border-[#9945FF]/30' : 'bg-white/5 border border-white/8'}`}>
                        {!isMe && <p className="text-[8px] font-black text-white/30 uppercase tracking-widest mb-0.5">{msg.username}</p>}
                        <p className={`text-[11px] font-medium ${isMe ? 'text-[#9945FF]' : 'text-white/70'}`}>{msg.content}</p>
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
                  className="flex-1 bg-black border border-white/10 px-3 py-2 text-xs font-black text-white placeholder-white/15 outline-none focus:border-[#9945FF]/50 transition-colors"
                />
                <button
                  onClick={sendChatMessage}
                  disabled={!chatInput.trim()}
                  className="px-4 py-2 bg-[#9945FF]/20 border border-[#9945FF]/40 text-[#9945FF] text-xs font-black uppercase hover:bg-[#9945FF]/30 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                >
                  SEND
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* Footer CTA */}
        <div className="shrink-0 p-4 sm:p-5 border-t border-white/5 bg-[#050505] z-10">
          {isHost ? (
            <button
              onClick={onStartGame}
              disabled={!canStart}
              className={`w-full py-5 sm:py-6 tech-border font-black uppercase tracking-tight text-xl sm:text-2xl transition-all
                ${canStart
                  ? 'bg-[#9945FF] text-white shadow-[0_0_40px_rgba(153,69,255,0.35)] hover:bg-[#8035e0] active:scale-[0.99]'
                  : 'bg-white/5 text-white/20 cursor-not-allowed border border-white/5'}`}
            >
              {canStart ? 'INITIATE_PVP_PROTOCOL →' : `WAITING FOR PLAYERS (${players.length}/${activeRoom.maxPlayers})...`}
            </button>
          ) : (
            <div className="w-full py-5 sm:py-6 border border-white/8 tech-border text-center bg-black">
              <span className="text-sm font-black uppercase text-white/30 animate-pulse tracking-widest">HOST_CONTROLS_START — STANDBY...</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── MENU / CREATE / JOIN ──────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col animate-in slide-in-from-right duration-300 bg-black">

      {/* QR Scanner overlay */}
      {isScanning && (
        <div className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center p-4">
          <div className="relative w-full max-w-md bg-black border-2 border-[#9945FF] tech-border p-1">
            <div id="reader" className="w-full h-64 sm:h-96 bg-black" />
            <div className="absolute inset-0 pointer-events-none m-12 animate-pulse">
              <div className="absolute top-0 left-0 w-5 h-5 border-t-4 border-l-4 border-[#9945FF]" />
              <div className="absolute top-0 right-0 w-5 h-5 border-t-4 border-r-4 border-[#9945FF]" />
              <div className="absolute bottom-0 left-0 w-5 h-5 border-b-4 border-l-4 border-[#9945FF]" />
              <div className="absolute bottom-0 right-0 w-5 h-5 border-b-4 border-r-4 border-[#9945FF]" />
            </div>
            <button onClick={stopScanning} className="absolute -bottom-16 left-1/2 -translate-x-1/2 rounded-full bg-white text-black p-4 shadow-xl">
              <X size={28} />
            </button>
          </div>
          <p className="mt-20 text-white font-black uppercase tracking-widest animate-pulse text-sm">SEARCHING_QR_PATTERN</p>
        </div>
      )}

      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b border-white/5 bg-[#050505]">
        <button
          onClick={() => view === 'MENU' ? onBack() : (setView('MENU'), setJoinPreview(null), setPreviewError(''))}
          className="w-8 h-8 flex items-center justify-center text-white/40 hover:text-white border border-white/10 hover:border-white/30 transition-all font-black text-lg"
        >
          {'<'}
        </button>
        <div>
          <h2 className="text-xl sm:text-2xl font-black uppercase italic tracking-tighter text-white leading-none">
            PVP_<span className="text-[#9945FF]">ARENA</span>
          </h2>
          <p className="text-[9px] font-black text-white/20 uppercase tracking-widest">
            {view === 'MENU' ? 'SELECT MODE' : view === 'CREATE' ? 'CONFIGURE ROOM' : 'ENTER ROOM CODE'}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="max-w-lg mx-auto p-4 sm:p-6 flex flex-col min-h-full">

          {/* ── MENU ── */}
          {view === 'MENU' && (
            <div className="flex flex-col gap-4 flex-1 justify-center">

              {/* Banner */}
              <div className="border border-[#9945FF]/30 bg-[#9945FF]/5 p-4 sm:p-5 tech-border text-center">
                <Trophy className="mx-auto mb-2 text-[#9945FF]" size={22} />
                <p className="text-white font-black uppercase tracking-widest text-sm sm:text-base mb-1">WINNER TAKES ALL</p>
                <p className="text-white/40 text-[11px] font-medium leading-relaxed">
                  Pool tokens with rivals. Raid the same protocol.<br />
                  <span className="text-white/60">Highest extract wins the entire pot.</span>
                </p>
              </div>

              {/* Create card */}
              <button
                onClick={() => setView('CREATE')}
                className="group w-full p-4 sm:p-5 bg-white text-black tech-border hover:bg-[#14F195] transition-all active:scale-[0.99] text-left flex items-center gap-4"
              >
                <div className="w-10 h-10 bg-black/10 flex items-center justify-center shrink-0">
                  <Swords size={20} />
                </div>
                <div className="flex-1">
                  <p className="text-base sm:text-lg font-black uppercase tracking-tight leading-none mb-0.5">CREATE ROOM</p>
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-50">SET STAKE · INVITE FRIENDS · HOST</p>
                </div>
                <span className="text-xl font-black opacity-40 group-hover:opacity-100 transition-opacity">→</span>
              </button>

              {/* Join card */}
              <button
                onClick={() => setView('JOIN')}
                className="group w-full p-4 sm:p-5 bg-black border-2 border-white/20 text-white tech-border hover:border-[#9945FF]/60 hover:bg-[#9945FF]/5 transition-all active:scale-[0.99] text-left flex items-center gap-4"
              >
                <div className="w-10 h-10 border border-white/20 flex items-center justify-center shrink-0 group-hover:border-[#9945FF]/50">
                  <Users size={20} className="text-white/60 group-hover:text-[#9945FF]" />
                </div>
                <div className="flex-1">
                  <p className="text-base sm:text-lg font-black uppercase tracking-tight leading-none mb-0.5">JOIN ROOM</p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/30">ENTER CODE OR SCAN QR</p>
                </div>
                <span className="text-xl font-black text-white/20 group-hover:text-[#9945FF] transition-colors">→</span>
              </button>

            </div>
          )}

          {/* ── CREATE ── */}
          {view === 'CREATE' && (
            <div className="space-y-5 py-2">

              {/* Currency selector */}
              <div>
                <p className="text-[10px] font-black text-white/50 uppercase tracking-widest mb-2">01 // STAKE_CURRENCY</p>
                <div className="grid grid-cols-3 gap-2">
                  {([Currency.SOL, Currency.USDC, Currency.SKR] as Currency[]).map(c => {
                    const active = stakeCurrency === c;
                    const col = c === Currency.SOL ? 'border-[#14F195] text-[#14F195] bg-[#14F195]/10'
                              : c === Currency.USDC ? 'border-blue-400 text-blue-400 bg-blue-400/10'
                              : 'border-orange-400 text-orange-400 bg-orange-400/10';
                    return (
                      <button
                        key={c}
                        onClick={() => setStakeCurrency(c)}
                        className={`py-3 sm:py-4 border-2 tech-border font-black text-sm transition-all ${active ? col : 'bg-black border-white/10 text-white/30 hover:border-white/30'}`}
                      >
                        <p className="text-sm font-black">{CURRENCY_LABELS[c]}</p>
                        <p className="text-[9px] font-black opacity-60 mt-0.5">{balanceFmt(c)}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Stake amount */}
              <div>
                <p className="text-[10px] font-black text-white/50 uppercase tracking-widest mb-2">02 // ENTRY_STAKE</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {STAKE_OPTIONS[stakeCurrency].map(val => (
                    <button
                      key={val}
                      onClick={() => setStakeAmount(val)}
                      className={`py-4 tech-border font-black text-lg transition-all ${stakeAmount === val ? 'bg-[#14F195] text-black border-[#14F195]' : 'bg-black border-white/10 text-white/40 hover:border-white/30 hover:text-white/70'}`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>

              {/* Max players */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <p className="text-[10px] font-black text-white/50 uppercase tracking-widest">03 // MAX_PLAYERS</p>
                  <span className="text-sm font-black text-[#9945FF] mono">{maxPlayers}</span>
                </div>
                <input
                  type="range" min="2" max="10" value={maxPlayers}
                  onChange={(e) => setMaxPlayers(parseInt(e.target.value))}
                  className="w-full accent-[#9945FF]"
                />
                <div className="flex justify-between text-[9px] font-black text-white/20 mt-1">
                  <span>2 MIN</span>
                  <span>10 MAX</span>
                </div>
              </div>

              {/* Pool preview */}
              <div className="p-4 sm:p-5 bg-[#09090b] border border-[#9945FF]/20 tech-border">
                <div className="flex justify-between items-center mb-3 pb-3 border-b border-white/5">
                  <span className="text-[10px] font-black text-white/30 uppercase tracking-widest">STAKE PER PLAYER</span>
                  <span className="font-black mono text-white">{stakeAmount} {CURRENCY_LABELS[stakeCurrency]}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-white/30 uppercase tracking-widest">MAX TOTAL POT</span>
                  <span className="text-2xl font-black text-yellow-500 mono">
                    {(stakeAmount * maxPlayers).toFixed(stakeCurrency === Currency.SKR ? 0 : 2)}
                    <span className="text-sm ml-1 text-yellow-500/60">{CURRENCY_LABELS[stakeCurrency]}</span>
                  </span>
                </div>
              </div>

              <button
                onClick={async () => { setIsCreating(true); try { await onCreateRoom(stakeAmount, maxPlayers, stakeCurrency); } finally { setIsCreating(false); } }}
                disabled={isCreating}
                className="w-full py-5 sm:py-6 bg-[#9945FF] text-white tech-border font-black uppercase tracking-tight text-xl sm:text-2xl shadow-[0_0_25px_rgba(153,69,255,0.3)] hover:bg-[#8035e0] active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isCreating ? 'AWAITING_WALLET...' : 'DEPLOY LOBBY →'}
              </button>
            </div>
          )}

          {/* ── JOIN ── */}
          {view === 'JOIN' && (
            <div className="space-y-4 py-2">

              <div>
                <p className="text-[10px] font-black text-white/50 uppercase tracking-widest mb-2">ROOM_CODE</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inviteCode}
                    onChange={(e) => { setInviteCode(e.target.value.toUpperCase()); setJoinPreview(null); setPreviewError(''); }}
                    placeholder="RAID-XXXX"
                    className="flex-1 bg-black border-2 border-white/20 p-4 sm:p-5 text-2xl sm:text-3xl font-black text-center text-white placeholder-white/10 outline-none focus:border-[#9945FF] tech-border mono transition-colors"
                  />
                  <button
                    onClick={startScanning}
                    className="bg-white/5 border-2 border-white/15 tech-border px-4 hover:bg-[#9945FF]/10 hover:border-[#9945FF]/50 text-white/40 hover:text-[#9945FF] transition-all"
                    title="Scan QR Code"
                  >
                    <Scan size={24} />
                  </button>
                </div>
              </div>

              {previewError && (
                <div className="flex items-center gap-2 p-3 border border-red-500/30 bg-red-500/5">
                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full shrink-0" />
                  <p className="text-red-400 text-[11px] font-black uppercase tracking-widest">{previewError}</p>
                </div>
              )}

              {joinPreview && (
                <div className="bg-[#09090b] border border-[#9945FF]/40 tech-border overflow-hidden">
                  <div className="px-4 py-2 bg-[#9945FF]/10 border-b border-[#9945FF]/20">
                    <p className="text-[9px] font-black text-[#9945FF] uppercase tracking-widest">ROOM_DETAILS</p>
                  </div>
                  <div className="p-4 grid grid-cols-2 gap-3 mb-3">
                    <div className="bg-black/60 p-3 text-center border border-white/8">
                      <p className="text-[9px] font-black text-white/30 uppercase tracking-widest mb-1">STAKE</p>
                      <p className="text-xl font-black text-[#14F195] mono">{joinPreview.stake} <span className="text-sm">{CURRENCY_LABELS[joinPreview.currency]}</span></p>
                    </div>
                    <div className="bg-black/60 p-3 text-center border border-white/8">
                      <p className="text-[9px] font-black text-white/30 uppercase tracking-widest mb-1">MAX PLAYERS</p>
                      <p className="text-xl font-black text-white mono">{joinPreview.maxPlayers}</p>
                    </div>
                  </div>
                  <div className="px-4 pb-4">
                    <div className="flex items-center justify-between p-2.5 bg-black/40 border border-white/5">
                      <span className="text-[9px] font-black text-white/30 uppercase tracking-widest">YOUR BALANCE</span>
                      <span className={`text-[11px] font-black mono ${
                        balanceFor(joinPreview.currency) >= joinPreview.stake ? 'text-[#14F195]' : 'text-red-400'
                      }`}>
                        {balanceFmt(joinPreview.currency)} {CURRENCY_LABELS[joinPreview.currency]}
                        {balanceFor(joinPreview.currency) < joinPreview.stake && <span className="ml-1 text-red-400/60">(INSUFFICIENT)</span>}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {!joinPreview ? (
                <button
                  onClick={handleLookupRoom}
                  disabled={previewLoading || inviteCode.length < 6}
                  className="w-full py-5 bg-white text-black tech-border font-black uppercase tracking-tight text-xl hover:bg-[#14F195] transition-all active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {previewLoading ? 'SEARCHING...' : 'LOOK UP ROOM →'}
                </button>
              ) : joinPreview.alreadyJoined ? (
                <button
                  onClick={async () => { setIsJoining(true); try { await onJoinRoom(inviteCode); } finally { setIsJoining(false); } }}
                  disabled={isJoining}
                  className="w-full py-5 bg-cyan-500 text-black tech-border font-black uppercase tracking-tight text-xl shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:bg-cyan-400 active:scale-[0.99] transition-all disabled:opacity-60"
                >
                  {isJoining ? 'RECONNECTING...' : 'REJOIN ROOM →'}
                </button>
              ) : (
                <button
                  onClick={async () => { setIsJoining(true); try { await onJoinRoom(inviteCode); } finally { setIsJoining(false); } }}
                  disabled={isJoining || balanceFor(joinPreview.currency) < joinPreview.stake}
                  className="w-full py-5 bg-[#9945FF] text-white tech-border font-black uppercase tracking-tight text-xl shadow-[0_0_25px_rgba(153,69,255,0.3)] hover:bg-[#8035e0] active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isJoining ? 'AWAITING_WALLET...' : `PAY & JOIN — ${joinPreview.stake} ${CURRENCY_LABELS[joinPreview.currency]}`}
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
