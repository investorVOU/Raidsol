
import React, { useState, useEffect, useRef } from 'react';
import { Room } from '../types';
import { Html5Qrcode, Html5QrcodeScanner } from 'html5-qrcode';
import QRious from 'qrious';
import { Scan, X } from 'lucide-react';

interface MultiplayerSetupScreenProps {
  onBack: () => void;
  onCreateRoom: (stake: number, maxPlayers: number) => void;
  onJoinRoom: (code: string) => void;
  activeRoom?: Room;
  onStartGame: () => void;
  currentWalletBalance: number;
}

const MultiplayerSetupScreen: React.FC<MultiplayerSetupScreenProps> = ({
  onBack,
  onCreateRoom,
  onJoinRoom,
  activeRoom,
  onStartGame,
  currentWalletBalance
}) => {
  const [view, setView] = useState<'MENU' | 'CREATE' | 'JOIN'>('MENU');
  const [stakeAmount, setStakeAmount] = useState<number>(0.1);
  const [maxPlayers, setMaxPlayers] = useState<number>(4);
  const [inviteCode, setInviteCode] = useState('');
  const [simulatedPlayers, setSimulatedPlayers] = useState(activeRoom?.players || []);
  
  // QR & Scanner State
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  // Sync active room state
  useEffect(() => {
    if (activeRoom) {
      setSimulatedPlayers(activeRoom.players);
    }
  }, [activeRoom]);

  // Generate QR Code when in Lobby
  useEffect(() => {
    if (activeRoom && qrCanvasRef.current) {
      new QRious({
        element: qrCanvasRef.current,
        value: activeRoom.code,
        size: 180,
        background: 'transparent',
        foreground: '#14F195',
        level: 'H'
      });
    }
  }, [activeRoom]);

  // Handle Scanner Cleanup
  useEffect(() => {
    return () => {
      if (scannerRef.current && isScanning) {
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, [isScanning]);

  const startScanning = async () => {
    try {
      setIsScanning(true);
      // Wait for DOM to update
      setTimeout(async () => {
          const html5QrCode = new Html5Qrcode("reader");
          scannerRef.current = html5QrCode;
          
          await html5QrCode.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 250, height: 250 } },
            (decodedText) => {
              // Success
              setInviteCode(decodedText);
              stopScanning();
              // Optional: Auto-join
              // onJoinRoom(decodedText); 
            },
            (errorMessage) => {
              // Parse error, ignore
            }
          );
      }, 100);
    } catch (err) {
      console.error(err);
      alert("Camera access failed or denied.");
      setIsScanning(false);
    }
  };

  const stopScanning = async () => {
    if (scannerRef.current) {
        try {
            await scannerRef.current.stop();
            await scannerRef.current.clear();
        } catch (e) {
            console.error(e);
        }
    }
    setIsScanning(false);
  };

  // Simulate players joining the lobby
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (activeRoom && activeRoom.status === 'LOBBY' && simulatedPlayers.length < activeRoom.maxPlayers) {
      interval = setInterval(() => {
         const newPlayerId = 'BOT-' + Math.floor(Math.random() * 1000);
         const botNames = ['Sol_Hunter', 'Raid_King', 'Degen_0x', 'Node_Runner', 'Phantom'];
         const newPlayerName = botNames[Math.floor(Math.random() * botNames.length)];
         
         setSimulatedPlayers(prev => {
            if (prev.length >= activeRoom.maxPlayers) return prev;
            return [...prev, { id: newPlayerId, name: newPlayerName, status: 'WAITING', score: 0, solResult: 0 }];
         });
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [activeRoom, simulatedPlayers]);

  const isHost = activeRoom?.hostId === 'USER_ME';
  const canStart = isHost && simulatedPlayers.length > 1;

  if (activeRoom) {
    // --- LOBBY VIEW ---
    return (
      <div className="h-full flex flex-col animate-in fade-in duration-300">
        
        {/* FIXED HEADER */}
        <div className="shrink-0 flex justify-between items-center p-6 border-b border-white/5 bg-black z-10">
           <div className="flex items-center gap-3">
             <div className="w-2.5 h-2.5 bg-green-500 animate-pulse rounded-full" />
             <span className="text-sm font-black uppercase tracking-widest text-green-500">LOBBY_ACTIVE</span>
           </div>
           <button 
             onClick={onBack}
             className="text-xs font-black uppercase tracking-widest text-red-500 hover:text-red-400 transition-colors"
           >
             LEAVE_ROOM
           </button>
        </div>

        {/* SCROLLABLE CONTENT AREA */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
           <div className="flex flex-col items-center justify-start min-h-full space-y-8 py-4">
              
              <div className="w-full max-w-2xl bg-black border-2 border-[#9945FF]/50 p-6 sm:p-8 tech-border relative overflow-hidden shrink-0">
                  <div className="absolute top-0 left-0 w-full h-1 bg-[#9945FF] shadow-[0_0_15px_#9945FF]" />
                  
                  <div className="flex flex-col md:flex-row gap-8 items-center justify-center mb-8">
                      {/* QR Code */}
                      <div className="p-2 bg-white/5 border border-white/10 tech-border">
                          <canvas ref={qrCanvasRef} width="180" height="180" className="w-[140px] h-[140px] sm:w-[180px] sm:h-[180px]" />
                          <p className="text-[9px] text-center text-white/30 font-black uppercase mt-2 tracking-widest">SCAN_TO_JOIN</p>
                      </div>

                      {/* Code Text */}
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
                       <p className="text-xl sm:text-2xl font-black text-[#14F195] mono">{activeRoom.stakePerPlayer} SOL</p>
                    </div>
                    <div className="bg-[#050505] p-5 border border-white/10 text-center">
                       <p className="text-xs text-white/30 font-black uppercase tracking-widest mb-1">TOTAL_POT</p>
                       <p className="text-xl sm:text-2xl font-black text-yellow-500 mono">{(activeRoom.stakePerPlayer * simulatedPlayers.length).toFixed(2)} SOL</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                     <div className="flex justify-between items-center text-xs font-black uppercase tracking-widest text-white/40 border-b border-white/5 pb-3">
                        <span>OPERATIVE</span>
                        <span>STATUS</span>
                     </div>
                     {simulatedPlayers.map((player, i) => (
                       <div key={player.id} className="flex justify-between items-center animate-in slide-in-from-left duration-300" style={{ animationDelay: `${i * 100}ms` }}>
                          <span className={`text-base font-black italic ${player.id === 'USER_ME' ? 'text-cyan-400' : 'text-white'}`}>
                            {player.name}
                          </span>
                          <span className="text-xs font-black text-green-500 bg-green-500/10 px-2 py-0.5 border border-green-500/20">
                            READY
                          </span>
                       </div>
                     ))}
                     {[...Array(activeRoom.maxPlayers - simulatedPlayers.length)].map((_, i) => (
                        <div key={i} className="flex justify-between items-center opacity-30">
                           <span className="text-base font-black italic text-white/20">Waiting for connection...</span>
                           <span className="w-2.5 h-2.5 rounded-full bg-white/10 animate-pulse" />
                        </div>
                     ))}
                  </div>
              </div>

           </div>
        </div>

        {/* FIXED FOOTER */}
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

  // --- MENU VIEW ---
  return (
    <div className="h-full flex flex-col p-6 animate-in slide-in-from-right duration-300 overflow-y-auto scrollbar-hide relative">
      
      {/* Scanner Overlay */}
      {isScanning && (
        <div className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center p-4">
             <div className="relative w-full max-w-md bg-black border-2 border-[#9945FF] tech-border p-1">
                 <div id="reader" className="w-full h-64 sm:h-96 bg-black"></div>
                 <div className="absolute inset-0 pointer-events-none border-2 border-[#9945FF]/50 m-12 animate-pulse">
                    <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-[#9945FF]" />
                    <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-[#9945FF]" />
                    <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-[#9945FF]" />
                    <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-[#9945FF]" />
                 </div>
                 <button 
                   onClick={stopScanning}
                   className="absolute -bottom-16 left-1/2 -translate-x-1/2 rounded-full bg-white text-black p-4 shadow-xl"
                 >
                    <X size={32} />
                 </button>
             </div>
             <p className="mt-20 text-white font-black uppercase tracking-widest animate-pulse">SEARCHING_QR_PATTERN</p>
        </div>
      )}

      <div className="flex items-center gap-4 mb-8 pb-4 border-b border-white/5 shrink-0">
        <button 
          onClick={() => view === 'MENU' ? onBack() : setView('MENU')}
          className="text-white/40 hover:text-white transition-colors font-black text-2xl"
        >
          {'<'}
        </button>
        <h2 className="text-3xl font-black uppercase italic tracking-tighter text-white">
          PRIVATE_ROOM_<span className="text-[#9945FF]">SETUP</span>
        </h2>
      </div>

      <div className="flex-1 flex flex-col justify-center min-h-0">
        {view === 'MENU' && (
          <div className="space-y-6 max-w-lg mx-auto w-full overflow-y-auto scrollbar-hide">
             <div className="bg-[#9945FF]/10 border border-[#9945FF]/30 p-8 tech-border text-center mb-8">
                <p className="text-[#9945FF] text-sm font-black uppercase tracking-widest mb-3">HOW IT WORKS</p>
                <p className="text-white/60 text-sm leading-relaxed italic font-medium">
                   Pool SOL with friends. Raid together on the same seed. 
                   <br/><span className="text-white">HIGHEST EXTRACT WINS THE POT.</span>
                   <br/>Winner takes all. No second place.
                </p>
             </div>

             <button 
               onClick={() => setView('CREATE')}
               className="w-full py-6 bg-white text-black tech-border font-black uppercase tracking-tight text-2xl hover:bg-cyan-400 transition-colors"
             >
               CREATE ROOM
             </button>
             <button 
               onClick={() => setView('JOIN')}
               className="w-full py-6 bg-black border-2 border-white/20 text-white tech-border font-black uppercase tracking-tight text-2xl hover:border-white transition-colors"
             >
               JOIN ROOM
             </button>
          </div>
        )}

        {view === 'CREATE' && (
          <div className="max-w-lg mx-auto w-full space-y-8 overflow-y-auto scrollbar-hide pb-4">
             <div className="space-y-4">
                <label className="block">
                   <span className="text-xs font-black text-white/40 uppercase tracking-widest">ENTRY_STAKE (SOL)</span>
                   <div className="flex items-center gap-4 mt-3">
                      {[0.05, 0.1, 0.5, 1.0].map(val => (
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

                <div className="p-6 bg-black border border-white/10 tech-border mt-6">
                   <div className="flex justify-between items-center">
                      <span className="text-xs font-black uppercase text-white/40">TOTAL_POOL_POTENTIAL</span>
                      <span className="text-2xl font-black text-yellow-500 mono">{(stakeAmount * maxPlayers).toFixed(2)} SOL</span>
                   </div>
                </div>
             </div>

             <button 
               onClick={() => onCreateRoom(stakeAmount, maxPlayers)}
               className="w-full py-6 bg-[#9945FF] text-white tech-border font-black uppercase tracking-tight text-2xl shadow-[0_0_20px_rgba(153,69,255,0.3)] hover:bg-[#8035e0] active:scale-95 transition-all"
             >
               DEPLOY LOBBY
             </button>
          </div>
        )}

        {view === 'JOIN' && (
          <div className="max-w-lg mx-auto w-full space-y-8 overflow-y-auto scrollbar-hide">
             <label className="block">
                <span className="text-xs font-black text-white/40 uppercase tracking-widest">ENTER_ROOM_CODE</span>
                
                <div className="flex gap-2 mt-3">
                    <input 
                    type="text" 
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
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

             <button 
               onClick={() => onJoinRoom(inviteCode)}
               className="w-full py-6 bg-white text-black tech-border font-black uppercase tracking-tight text-2xl hover:bg-cyan-400 transition-all active:scale-95"
             >
               CONNECT
             </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MultiplayerSetupScreen;
