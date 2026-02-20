
import React, { useState, useEffect, useRef } from 'react';
import { Room, Currency } from '../types';
import { Html5Qrcode } from 'html5-qrcode';
import QRious from 'qrious';
import { Scan, X } from 'lucide-react';
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

  // Lobby creation in-flight
  const [isCreating, setIsCreating] = useState(false);
  // Join payment in-flight
  const [isJoining, setIsJoining] = useState(false);

  // QR scanner
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef  = useRef<Html5Qrcode | null>(null);

  // Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Reset stake amount when currency changes
  useEffect(() => {
    setStakeAmount(STAKE_OPTIONS[stakeCurrency][1]);
  }, [stakeCurrency]);

  // Generate QR Code when in Lobby
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

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current && isScanning) {
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, [isScanning]);

  // Chat: fetch history + subscribe when in active room
  useEffect(() => {
    if (!activeRoom) return;
    let cancelled = false;

    // Fetch last 50 messages
    supabase
      .from('messages')
      .select('id, wallet_address, username, content, inserted_at')
      .eq('room_id', activeRoom.id)
      .order('inserted_at', { ascending: true })
      .limit(50)
      .then(({ data }) => {
        if (!cancelled && data) setChatMessages(data as ChatMessage[]);
      });

    // Subscribe to new messages
    const channel = supabase
      .channel(`room-chat:${activeRoom.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${activeRoom.id}` },
        (payload) => {
          if (!cancelled) {
            setChatMessages(prev => [...prev, payload.new as ChatMessage].slice(-100));
          }
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [activeRoom?.id]);

  // Auto-scroll chat to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const sendChatMessage = async () => {
    const text = chatInput.trim().slice(0, 200);
    if (!text || !walletAddress || !activeRoom) return;
    setChatInput('');
    const myName = players.find(p => p.id === walletAddress)?.name ?? walletAddress.slice(0, 8);
    await supabase.from('messages').insert({
      room_id: activeRoom.id,
      wallet_address: walletAddress,
      username: myName,
      content: text,
    });
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
    } catch (err) {
      console.error(err);
      alert('Camera access failed or denied.');
      setIsScanning(false);
    }
  };

  const stopScanning = async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); await scannerRef.current.clear(); }
      catch (e) { console.error(e); }
    }
    setIsScanning(false);
  };

  // Look up a room before payment (preview)
  const handleLookupRoom = async () => {
    const code = inviteCode.trim().toUpperCase();
    if (!code.startsWith('RAID-')) {
      setPreviewError('Invalid room code — must start with RAID-');
      return;
    }
    setPreviewLoading(true);
    setPreviewError('');
    setJoinPreview(null);
    try {
      const preview = await onFetchRoom(code);
      if (!preview) {
        setPreviewError('Room not found, already started, or is full.');
      } else {
        setJoinPreview(preview);
      }
    } catch {
      setPreviewError('Could not reach server. Check your connection.');
    }
    setPreviewLoading(false);
  };

  const players  = activeRoom?.players ?? [];
  const isHost   = !!walletAddress && activeRoom?.hostId === walletAddress;
  const canStart = isHost && players.length > 1;
  const roomCcy  = activeRoom?.stakeCurrency ?? Currency.SOL;

  // ── ACTIVE LOBBY VIEW ────────────────────────────────────────────────
  if (activeRoom) {
    return (
      <div className="h-full flex flex-col animate-in fade-in duration-300 relative">

        {/* Join notification toast */}
        {joinNotification && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[300] w-max max-w-xs bg-[#14F195]/15 border border-[#14F195] px-5 py-3 text-xs font-black text-[#14F195] uppercase tracking-widest animate-in slide-in-from-top-4 duration-300 shadow-[0_0_20px_rgba(20,241,149,0.3)]">
            {joinNotification}
          </div>
        )}

        <div className="shrink-0 flex justify-between items-center p-6 border-b border-white/5 bg-black z-10">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 bg-green-500 animate-pulse rounded-full" />
            <span className="text-sm font-black uppercase tracking-widest text-green-500">LOBBY_ACTIVE</span>
          </div>
          <button onClick={onLeaveRoom} className="text-xs font-black uppercase tracking-widest text-red-500 hover:text-red-400 transition-colors">
            LEAVE_ROOM
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
          <div className="flex flex-col items-center justify-start min-h-full space-y-8 py-4">
            <div className="w-full max-w-2xl bg-black border-2 border-[#9945FF]/50 p-6 sm:p-8 tech-border relative overflow-hidden shrink-0">
              <div className="absolute top-0 left-0 w-full h-1 bg-[#9945FF] shadow-[0_0_15px_#9945FF]" />

              <div className="flex flex-col md:flex-row gap-8 items-center justify-center mb-8">
                <div className="p-2 bg-white/5 border border-white/10 tech-border">
                  <canvas ref={qrCanvasRef} width="180" height="180" className="w-[140px] h-[140px] sm:w-[180px] sm:h-[180px]" />
                  <p className="text-[9px] text-center text-white/30 font-black uppercase mt-2 tracking-widest">SCAN_TO_JOIN</p>
                </div>
                <div className="text-center md:text-left">
                  <p className="text-xs font-black text-white/30 uppercase tracking-[0.4em] mb-3">ACCESS_CODE</p>
                  <div
                    className="inline-block px-8 py-4 bg-white/5 border border-white/10 tech-border cursor-pointer hover:bg-white/10 transition-colors mb-2"
                    onClick={() => navigator.clipboard.writeText(activeRoom.code)}
                  >
                    <p className="text-4xl sm:text-5xl font-black text-white tracking-widest mono select-all">{activeRoom.code}</p>
                  </div>
                  <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">TAP_TO_COPY</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-[#050505] p-5 border border-white/10 text-center">
                  <p className="text-xs text-white/30 font-black uppercase tracking-widest mb-1">STAKE_LOCKED</p>
                  <p className="text-xl sm:text-2xl font-black text-[#14F195] mono">
                    {activeRoom.stakePerPlayer} {CURRENCY_LABELS[roomCcy]}
                  </p>
                </div>
                <div className="bg-[#050505] p-5 border border-white/10 text-center">
                  <p className="text-xs text-white/30 font-black uppercase tracking-widest mb-1">TOTAL_POT</p>
                  <p className="text-xl sm:text-2xl font-black text-yellow-500 mono">
                    {(activeRoom.stakePerPlayer * players.length).toFixed(2)} {CURRENCY_LABELS[roomCcy]}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center text-xs font-black uppercase tracking-widest text-white/40 border-b border-white/5 pb-3">
                  <span>OPERATIVE</span>
                  <span>STATUS</span>
                </div>
                {players.map((player, i) => (
                  <div key={player.id} className="flex justify-between items-center animate-in slide-in-from-left duration-300" style={{ animationDelay: `${i * 100}ms` }}>
                    <span className={`text-base font-black italic ${player.id === walletAddress ? 'text-cyan-400' : 'text-white'}`}>
                      {player.name}
                    </span>
                    <span className="text-xs font-black text-green-500 bg-green-500/10 px-2 py-0.5 border border-green-500/20">READY</span>
                  </div>
                ))}
                {[...Array(activeRoom.maxPlayers - players.length)].map((_, i) => (
                  <div key={i} className="flex justify-between items-center opacity-30">
                    <span className="text-base font-black italic text-white/20">Waiting for connection...</span>
                    <span className="w-2.5 h-2.5 rounded-full bg-white/10 animate-pulse" />
                  </div>
                ))}
              </div>

              {/* ── ROOM CHAT ── */}
              <div className="mt-8 border-t border-white/5 pt-6">
                <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em] mb-3">COMMS_CHANNEL</p>

                {/* Message list */}
                <div className="h-44 overflow-y-auto scrollbar-hide bg-black/60 border border-white/5 p-3 space-y-2 mb-3">
                  {chatMessages.length === 0 && (
                    <p className="text-[10px] text-white/20 font-black italic tracking-widest text-center mt-16">No transmissions yet...</p>
                  )}
                  {chatMessages.map((msg) => {
                    const isMe = msg.wallet_address === walletAddress;
                    return (
                      <div key={msg.id} className={`flex gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] px-3 py-1.5 ${isMe ? 'bg-[#9945FF]/20 border border-[#9945FF]/30' : 'bg-white/5 border border-white/10'}`}>
                          {!isMe && (
                            <p className="text-[9px] font-black text-white/30 uppercase tracking-widest mb-0.5">{msg.username}</p>
                          )}
                          <p className={`text-xs font-medium ${isMe ? 'text-[#9945FF]' : 'text-white/70'}`}>{msg.content}</p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={chatEndRef} />
                </div>

                {/* Input row */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') sendChatMessage(); }}
                    placeholder="Transmit message..."
                    maxLength={200}
                    className="flex-1 bg-black border border-white/10 px-4 py-2.5 text-xs font-black text-white placeholder-white/10 outline-none focus:border-[#9945FF]/50 transition-colors"
                  />
                  <button
                    onClick={sendChatMessage}
                    disabled={!chatInput.trim()}
                    className="px-4 py-2.5 bg-[#9945FF]/20 border border-[#9945FF]/40 text-[#9945FF] text-xs font-black uppercase tracking-widest hover:bg-[#9945FF]/30 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                  >
                    SEND
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 p-6 border-t border-white/5 bg-black z-10">
          {isHost ? (
            <button
              onClick={onStartGame}
              disabled={!canStart}
              className={`w-full py-6 tech-border font-black uppercase tracking-tight text-2xl transition-all
                ${canStart ? 'bg-[#9945FF] text-white shadow-[0_0_30px_rgba(153,69,255,0.4)] hover:bg-[#8035e0]' : 'bg-white/5 text-white/20 cursor-not-allowed'}`}
            >
              {canStart ? 'INITIATE_PVP_PROTOCOL' : 'WAITING_FOR_PLAYERS...'}
            </button>
          ) : (
            <div className="w-full py-6 bg-black border border-white/10 tech-border text-center">
              <span className="text-base font-black uppercase text-white/40 animate-pulse tracking-widest">WAITING_FOR_HOST_SIGNAL...</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── MENU / CREATE / JOIN VIEW ────────────────────────────────────────
  return (
    <div className="h-full flex flex-col p-6 animate-in slide-in-from-right duration-300 overflow-y-auto scrollbar-hide relative">

      {/* QR Scanner Overlay */}
      {isScanning && (
        <div className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center p-4">
          <div className="relative w-full max-w-md bg-black border-2 border-[#9945FF] tech-border p-1">
            <div id="reader" className="w-full h-64 sm:h-96 bg-black" />
            <div className="absolute inset-0 pointer-events-none border-2 border-[#9945FF]/50 m-12 animate-pulse">
              <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-[#9945FF]" />
              <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-[#9945FF]" />
              <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-[#9945FF]" />
              <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-[#9945FF]" />
            </div>
            <button onClick={stopScanning} className="absolute -bottom-16 left-1/2 -translate-x-1/2 rounded-full bg-white text-black p-4 shadow-xl">
              <X size={32} />
            </button>
          </div>
          <p className="mt-20 text-white font-black uppercase tracking-widest animate-pulse">SEARCHING_QR_PATTERN</p>
        </div>
      )}

      <div className="flex items-center gap-4 mb-8 pb-4 border-b border-white/5 shrink-0">
        <button
          onClick={() => view === 'MENU' ? onBack() : (setView('MENU'), setJoinPreview(null), setPreviewError(''))}
          className="text-white/40 hover:text-white transition-colors font-black text-2xl"
        >
          {'<'}
        </button>
        <h2 className="text-3xl font-black uppercase italic tracking-tighter text-white">
          PRIVATE_ROOM_<span className="text-[#9945FF]">SETUP</span>
        </h2>
      </div>

      <div className="flex-1 flex flex-col justify-center min-h-0">

        {/* ── MENU ── */}
        {view === 'MENU' && (
          <div className="space-y-6 max-w-lg mx-auto w-full overflow-y-auto scrollbar-hide">
            <div className="bg-[#9945FF]/10 border border-[#9945FF]/30 p-8 tech-border text-center mb-8">
              <p className="text-[#9945FF] text-sm font-black uppercase tracking-widest mb-3">HOW IT WORKS</p>
              <p className="text-white/60 text-sm leading-relaxed italic font-medium">
                Pool tokens with friends. Raid together on the same seed.
                <br /><span className="text-white">HIGHEST EXTRACT WINS THE POT.</span>
                <br />Winner takes all. No second place.
              </p>
            </div>
            <button onClick={() => setView('CREATE')} className="w-full py-6 bg-white text-black tech-border font-black uppercase tracking-tight text-2xl hover:bg-cyan-400 transition-colors">
              CREATE ROOM
            </button>
            <button onClick={() => setView('JOIN')} className="w-full py-6 bg-black border-2 border-white/20 text-white tech-border font-black uppercase tracking-tight text-2xl hover:border-white transition-colors">
              JOIN ROOM
            </button>
          </div>
        )}

        {/* ── CREATE ── */}
        {view === 'CREATE' && (
          <div className="max-w-lg mx-auto w-full space-y-6 overflow-y-auto scrollbar-hide pb-4">

            {/* Currency selector */}
            <label className="block">
              <span className="text-xs font-black text-white/40 uppercase tracking-widest">PAY_WITH</span>
              <div className="flex items-center gap-2 mt-3">
                {([Currency.SOL, Currency.USDC, Currency.SKR] as Currency[]).map(c => (
                  <button
                    key={c}
                    onClick={() => setStakeCurrency(c)}
                    className={`flex-1 py-3 tech-border font-black text-sm transition-all ${stakeCurrency === c ? 'bg-[#9945FF] text-white border-[#9945FF]' : 'bg-black border-white/10 text-white/40 hover:border-white/30'}`}
                  >
                    {CURRENCY_LABELS[c]}
                  </button>
                ))}
              </div>
            </label>

            {/* Balance indicator */}
            <p className="text-[10px] font-black text-white/30 uppercase tracking-widest -mt-3">
              YOUR BALANCE:&nbsp;
              <span className="text-white/60">
                {stakeCurrency === Currency.SOL  && `${currentWalletBalance.toFixed(4)} SOL`}
                {stakeCurrency === Currency.USDC && `${currentUsdcBalance.toFixed(2)} USDC`}
                {stakeCurrency === Currency.SKR  && `${currentSkrBalance.toFixed(0)} SKR`}
              </span>
            </p>

            {/* Stake amount */}
            <label className="block">
              <span className="text-xs font-black text-white/40 uppercase tracking-widest">ENTRY_STAKE ({CURRENCY_LABELS[stakeCurrency]})</span>
              <div className="flex items-center gap-3 mt-3">
                {STAKE_OPTIONS[stakeCurrency].map(val => (
                  <button
                    key={val}
                    onClick={() => setStakeAmount(val)}
                    className={`flex-1 py-4 tech-border font-black text-base transition-all ${stakeAmount === val ? 'bg-[#14F195] text-black border-[#14F195]' : 'bg-black border-white/10 text-white/40'}`}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </label>

            {/* Max players */}
            <label className="block">
              <span className="text-xs font-black text-white/40 uppercase tracking-widest">MAX_PLAYERS</span>
              <input
                type="range"
                min="2"
                max="10"
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(parseInt(e.target.value))}
                className="w-full mt-4 accent-[#9945FF]"
              />
              <div className="flex justify-between text-sm font-black mono mt-2 text-[#9945FF]">
                <span>2</span>
                <span className="text-white">{maxPlayers} PLAYERS</span>
                <span>10</span>
              </div>
            </label>

            {/* Total pool preview */}
            <div className="p-6 bg-black border border-white/10 tech-border">
              <div className="flex justify-between items-center">
                <span className="text-xs font-black uppercase text-white/40">TOTAL_POOL_POTENTIAL</span>
                <span className="text-2xl font-black text-yellow-500 mono">
                  {(stakeAmount * maxPlayers).toFixed(stakeCurrency === Currency.SKR ? 0 : 2)} {CURRENCY_LABELS[stakeCurrency]}
                </span>
              </div>
            </div>

            <button
              onClick={async () => {
                setIsCreating(true);
                try { await onCreateRoom(stakeAmount, maxPlayers, stakeCurrency); }
                finally { setIsCreating(false); }
              }}
              disabled={isCreating}
              className="w-full py-6 bg-[#9945FF] text-white tech-border font-black uppercase tracking-tight text-2xl shadow-[0_0_20px_rgba(153,69,255,0.3)] hover:bg-[#8035e0] active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isCreating ? 'AWAITING_WALLET...' : 'DEPLOY LOBBY'}
            </button>
          </div>
        )}

        {/* ── JOIN ── */}
        {view === 'JOIN' && (
          <div className="max-w-lg mx-auto w-full space-y-6 overflow-y-auto scrollbar-hide">

            {/* Code input */}
            <label className="block">
              <span className="text-xs font-black text-white/40 uppercase tracking-widest">ENTER_ROOM_CODE</span>
              <div className="flex gap-2 mt-3">
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => { setInviteCode(e.target.value.toUpperCase()); setJoinPreview(null); setPreviewError(''); }}
                  placeholder="RAID-XXXX"
                  className="w-full bg-black border-2 border-white/20 p-5 text-3xl font-black text-center text-white placeholder-white/10 outline-none focus:border-[#9945FF] tech-border mono"
                />
                <button
                  onClick={startScanning}
                  className="bg-white/10 border-2 border-white/20 tech-border px-4 hover:bg-white/20 hover:border-white text-white/60 hover:text-white transition-all"
                  title="Scan QR Code"
                >
                  <Scan size={28} />
                </button>
              </div>
            </label>

            {/* Error */}
            {previewError && (
              <p className="text-red-400 text-xs font-black uppercase tracking-widest border border-red-500/20 bg-red-500/5 p-3">
                {previewError}
              </p>
            )}

            {/* Room preview (shown after lookup) */}
            {joinPreview && (
              <div className="bg-[#9945FF]/10 border border-[#9945FF]/40 p-6 tech-border space-y-4">
                <p className="text-xs font-black text-[#9945FF] uppercase tracking-widest mb-3">ROOM_DETAILS</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-black/60 p-4 text-center border border-white/10">
                    <p className="text-[9px] font-black text-white/30 uppercase tracking-widest mb-1">STAKE</p>
                    <p className="text-xl font-black text-[#14F195] mono">
                      {joinPreview.stake} {CURRENCY_LABELS[joinPreview.currency]}
                    </p>
                  </div>
                  <div className="bg-black/60 p-4 text-center border border-white/10">
                    <p className="text-[9px] font-black text-white/30 uppercase tracking-widest mb-1">MAX_PLAYERS</p>
                    <p className="text-xl font-black text-white mono">{joinPreview.maxPlayers}</p>
                  </div>
                </div>
                <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">
                  YOUR BALANCE:&nbsp;
                  <span className={
                    (joinPreview.currency === Currency.SOL  && currentWalletBalance   >= joinPreview.stake) ||
                    (joinPreview.currency === Currency.USDC && currentUsdcBalance     >= joinPreview.stake) ||
                    (joinPreview.currency === Currency.SKR  && currentSkrBalance      >= joinPreview.stake)
                      ? 'text-green-400' : 'text-red-400'
                  }>
                    {joinPreview.currency === Currency.SOL  && `${currentWalletBalance.toFixed(4)} SOL`}
                    {joinPreview.currency === Currency.USDC && `${currentUsdcBalance.toFixed(2)} USDC`}
                    {joinPreview.currency === Currency.SKR  && `${currentSkrBalance.toFixed(0)} SKR`}
                  </span>
                </p>
              </div>
            )}

            {/* Lookup OR Confirm/Rejoin button */}
            {!joinPreview ? (
              <button
                onClick={handleLookupRoom}
                disabled={previewLoading || inviteCode.length < 6}
                className="w-full py-6 bg-white text-black tech-border font-black uppercase tracking-tight text-2xl hover:bg-cyan-400 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {previewLoading ? 'SEARCHING...' : 'LOOK UP ROOM'}
              </button>
            ) : joinPreview.alreadyJoined ? (
              <button
                onClick={async () => { setIsJoining(true); try { await onJoinRoom(inviteCode); } finally { setIsJoining(false); } }}
                disabled={isJoining}
                className="w-full py-6 bg-cyan-500 text-black tech-border font-black uppercase tracking-tight text-2xl shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:bg-cyan-400 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isJoining ? 'RECONNECTING...' : 'REJOIN ROOM →'}
              </button>
            ) : (
              <button
                onClick={async () => { setIsJoining(true); try { await onJoinRoom(inviteCode); } finally { setIsJoining(false); } }}
                disabled={isJoining}
                className="w-full py-6 bg-[#9945FF] text-white tech-border font-black uppercase tracking-tight text-2xl shadow-[0_0_20px_rgba(153,69,255,0.4)] hover:bg-[#8035e0] active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isJoining
                  ? 'AWAITING_WALLET...'
                  : `CONFIRM & PAY ${joinPreview.stake} ${CURRENCY_LABELS[joinPreview.currency]}`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MultiplayerSetupScreen;
