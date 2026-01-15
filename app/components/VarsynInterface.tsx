"use client";

import React, { useState, useEffect } from 'react';
import { Database, Clock, ChevronLeft, Map, Swords, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';

// --- THIRDWEB IMPORTS ---
import { createThirdwebClient, getContract } from "thirdweb";
import { ConnectButton, useActiveAccount, TransactionButton } from "thirdweb/react";
import { baseSepolia } from "thirdweb/chains";
import { claimTo, balanceOf } from "thirdweb/extensions/erc721";

// Setup
const client = createThirdwebClient({ clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || "" });
const contract = getContract({ client, chain: baseSepolia, address: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "" });

// --- VIEW DEFINITIONS (SESUAI REQUEST) ---
type ViewState = 'LOGIN' | 'MINTING' | 'LOBBY' | 'HUNTING' | 'MISSION';

// Komponen Gambar Aman (Fallback)
const SafeImage = ({ src, alt, className, fallbackText }: { src: string, alt: string, className?: string, fallbackText?: string }) => {
    const [error, setError] = useState(false);
    // Placeholder otomatis kalau gambar belum ada
    const fallbackSrc = `https://placehold.co/400x600/1a1a1a/4ade80/png?text=${fallbackText || 'ASSET'}&font=roboto`;
    return <img src={error ? fallbackSrc : src} alt={alt} className={className} onError={() => setError(true)} />;
};

export default function VarsynInterface() {
  const account = useActiveAccount();
  
  // State Utama
  const [currentView, setCurrentView] = useState<ViewState>('LOGIN');
  const [loading, setLoading] = useState(false);
  
  // Data Player
  const [inventory, setInventory] = useState({ meat: 0, bone: 0, hide: 0, cVar: 0 });
  const [missionLevel, setMissionLevel] = useState(1); // Progress Misi Global

  // Hunting State
  const [huntTimer, setHuntTimer] = useState(0);
  const [huntLog, setHuntLog] = useState<string[]>([]); // Catatan Beast

  // --- LOGIC: SYSTEM CHECK (LOGIN) ---
  useEffect(() => {
    if (account?.address) {
        checkAccess(account.address);
    } else {
        setCurrentView('LOGIN');
    }
  }, [account?.address]);

  const checkAccess = async (wallet: string) => {
    setLoading(true);
    try {
        // 1. Cek Blockchain
        let hasNft = false;
        try {
            const balance = await balanceOf({ contract, owner: wallet });
            hasNft = balance > BigInt(0);
        } catch (e) { console.warn("Chain check skip", e); }

        // 2. Cek Database
        const { data: users } = await supabase.from('users').select('*').eq('wallet_address', wallet);
        const user = users?.[0];

        if (user) {
            // Sinkronisasi jika di chain punya tapi di DB belum
            if (hasNft && !user.has_sigil) {
                await supabase.from('users').update({ has_sigil: true }).eq('wallet_address', wallet);
                user.has_sigil = true;
            }

            if (user.has_sigil) {
                loadData(user.id);
                setCurrentView('LOBBY'); // Punya Sigil -> LOBBY
            } else {
                setCurrentView('MINTING'); // Belum Punya -> MINTING
            }
        } else {
            // User Baru
            const { data: newUsers } = await supabase.from('users').insert([{ wallet_address: wallet, has_sigil: hasNft }]).select();
            if (newUsers?.[0]) {
                await supabase.from('inventory').insert([{ user_id: newUsers[0].id }]);
                setCurrentView(hasNft ? 'LOBBY' : 'MINTING');
            }
        }
    } catch (err) {
        console.error(err);
    } finally {
        setLoading(false);
    }
  };

  const loadData = async (userId: string) => {
      const { data } = await supabase.from('inventory').select('*').eq('user_id', userId);
      if(data?.[0]) setInventory({ meat: data[0].meat, bone: data[0].bone, hide: data[0].hide, cVar: data[0].cvar });
  };

  const handleMintSuccess = async () => {
      if (account?.address) {
          await supabase.from('users').update({ has_sigil: true }).eq('wallet_address', account.address);
          setCurrentView('LOBBY');
      }
  };

  // --- LOGIC: HUNTING ---
  const startHunt = () => {
      setCurrentView('HUNTING');
      setHuntTimer(5); // 5 Detik demo (Aslinya nanti 1 jam/sesuai GDD)
      setHuntLog([]); // Reset log
  };

  useEffect(() => {
      if (currentView === 'HUNTING' && huntTimer > 0) {
          const tick = setInterval(() => setHuntTimer(t => t - 1), 1000);
          return () => clearInterval(tick);
      } else if (currentView === 'HUNTING' && huntTimer === 0 && huntLog.length === 0) {
          // Timer habis -> Generate Log & Reward otomatis
          finishHunt();
      }
  }, [currentView, huntTimer]);

  const finishHunt = async () => {
      // RNG Sederhana
      const r = Math.random();
      let loot = { name: "Nothing", type: "", qty: 0 };
      let beast = "Wild Boar";

      if (r < 0.1) { loot = { name: "Hide", type: "hide", qty: 1 }; beast = "Shadow Wolf"; }
      else if (r < 0.4) { loot = { name: "Bone", type: "bone", qty: 2 }; beast = "Skeleton"; }
      else { loot = { name: "Meat", type: "meat", qty: 3 }; beast = "Wild Boar"; }

      // Update Local State (Visual)
      if (loot.type) {
          setInventory(prev => ({ ...prev, [loot.type]: prev[loot.type as keyof typeof inventory] + loot.qty }));
      }
      
      // Update Log Teks
      setHuntLog([
          `> Target: ${beast} eliminated.`,
          `> Loot Acquired: ${loot.qty}x ${loot.name}`,
          `> Status: Return to base.`
      ]);

      // Save to DB (Background Process - Real implementation needed here)
      if (account?.address) {
          // Logic update DB di sini nanti
      }
  };

  // --- RENDER UI (5 VIEWS) ---
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0f1115] p-4 font-mono">
      {/* Mobile Container Ratio 9:16 */}
      <div className="w-full max-w-[400px] aspect-[9/16] bg-black relative overflow-hidden shadow-2xl border-4 border-[#4a5568] rounded-[2rem] text-white flex flex-col">
        
        {/* CSS GLOBAL */}
        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=VT323&display=swap');
          .font-pixel { font-family: 'VT323', monospace; }
          .bg-full { width: 100%; height: 100%; object-fit: cover; position: absolute; inset: 0; z-index: 0; }
          .ui-layer { position: relative; z-index: 10; height: 100%; display: flex; flex-direction: column; }
        `}</style>

        <AnimatePresence mode='wait'>

            {/* VIEW 1: LOGIN (BG + LOGO + CONNECT) */}
            {currentView === 'LOGIN' && (
                <motion.div key="login" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="w-full h-full relative">
                    <SafeImage src="/assets/bg_common.png" fallbackText="BG LOGIN" alt="bg" className="bg-full opacity-60" />
                    
                    <div className="ui-layer items-center justify-center space-y-8 p-6">
                        <SafeImage src="/assets/logo_main.png" fallbackText="VARSYN LOGO" alt="logo" className="w-48 animate-pulse drop-shadow-lg" />
                        
                        <div className="bg-black/50 p-4 rounded-xl border border-white/20 text-center backdrop-blur-sm">
                            <h2 className="font-pixel text-2xl text-green-400 mb-1">SYSTEM ONLINE</h2>
                            <p className="font-pixel text-slate-300 text-lg">Identify yourself, Manager.</p>
                        </div>

                        <div className="w-full">
                            <ConnectButton client={client} chain={baseSepolia} theme="dark" connectModal={{ size: "compact" }} />
                        </div>
                    </div>
                </motion.div>
            )}

            {/* VIEW 1.5: MINTING (CREATOR SPEAKING) */}
            {currentView === 'MINTING' && (
                <motion.div key="minting" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="w-full h-full relative">
                    <SafeImage src="/assets/bg_common.png" fallbackText="BG MINT" alt="bg" className="bg-full opacity-40" />
                    
                    <div className="ui-layer p-4">
                        {/* The Creator */}
                        <div className="flex-1 flex flex-col items-center justify-center relative">
                            <SafeImage src="/assets/char_creator.png" fallbackText="CREATOR CHAR" alt="creator" className="w-40 mb-4 drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]" />
                            
                            {/* Dialogue Bubble */}
                            <div className="bg-slate-900/90 border-2 border-white p-4 rounded-lg w-full mb-6">
                                <h3 className="font-pixel text-xl text-yellow-400 mb-1">THE CREATOR</h3>
                                <p className="font-pixel text-xl leading-tight">
                                    "The world is broken. I need a Manager with a <span className="text-green-400">SigilVar</span> to rebuild it. Obtain yours now."
                                </p>
                            </div>

                            {/* Sigil Image & Button */}
                            <div className="flex flex-col items-center gap-4 w-full">
                                <SafeImage src="/assets/img_sigil.png" fallbackText="SIGIL CARD" alt="sigil" className="w-24 hover:scale-105 transition" />
                                <TransactionButton
                                    transaction={() => {
                                        if(!account?.address) throw new Error("No wallet");
                                        return claimTo({ contract, to: account.address, quantity: BigInt(1) });
                                    }}
                                    onTransactionConfirmed={handleMintSuccess}
                                    unstyled
                                    className="w-full bg-green-700 hover:bg-green-600 text-white font-pixel text-2xl py-3 border-b-4 border-green-900 rounded-lg active:translate-y-1 active:border-b-0"
                                >
                                    MINT SIGIL (0.5 USDC)
                                </TransactionButton>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* VIEW 2: LOBBY UTAMA */}
            {currentView === 'LOBBY' && (
                <motion.div key="lobby" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="w-full h-full relative">
                    <SafeImage src="/assets/bg_lobby.png" fallbackText="CAVE BG" alt="bg" className="bg-full" />
                    
                    <div className="ui-layer p-4 justify-between">
                        {/* Header Stats */}
                        <div className="flex justify-between items-start">
                            <div className="bg-black/60 p-2 rounded border border-slate-600 flex items-center gap-2">
                                <SafeImage src="/assets/icon_cvar.png" fallbackText="C" alt="cvar" className="w-6" />
                                <span className="font-pixel text-xl text-yellow-400">{inventory.cVar}</span>
                            </div>
                            <div className="bg-black/60 px-3 py-1 rounded border border-slate-600 font-pixel text-slate-300 text-sm">
                                {account?.address?.slice(0,6)}...
                            </div>
                        </div>

                        {/* Clonevar Character (Center - Diam) */}
                        <div className="flex-1 flex items-end justify-center pb-8">
                            <SafeImage src="/assets/char_clonevar.png" fallbackText="CLONEVAR" alt="char" className="w-48 drop-shadow-2xl" />
                        </div>

                        {/* Bottom UI */}
                        <div className="space-y-3">
                            {/* Inventory Strip */}
                            <div className="bg-[#2d2d2d] border-2 border-gray-600 p-2 rounded-lg flex justify-around shadow-lg">
                                <div className="text-center">
                                    <SafeImage src="/assets/icon_meat.png" fallbackText="M" alt="meat" className="w-8 mx-auto" />
                                    <span className="font-pixel text-lg">{inventory.meat}</span>
                                </div>
                                <div className="text-center">
                                    <SafeImage src="/assets/icon_bone.png" fallbackText="B" alt="bone" className="w-8 mx-auto" />
                                    <span className="font-pixel text-lg">{inventory.bone}</span>
                                </div>
                                <div className="text-center">
                                    <SafeImage src="/assets/icon_hide.png" fallbackText="H" alt="hide" className="w-8 mx-auto" />
                                    <span className="font-pixel text-lg">{inventory.hide}</span>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-3">
                                <button 
                                    onClick={() => setCurrentView('MISSION')}
                                    className="flex-1 bg-blue-800 border-b-4 border-blue-950 p-3 rounded-lg active:translate-y-1 active:border-b-0"
                                >
                                    <Map className="mx-auto mb-1 w-6" />
                                    <span className="font-pixel text-2xl block">MISSION</span>
                                </button>
                                <button 
                                    onClick={startHunt}
                                    className="flex-1 bg-red-800 border-b-4 border-red-950 p-3 rounded-lg active:translate-y-1 active:border-b-0"
                                >
                                    <Swords className="mx-auto mb-1 w-6" />
                                    <span className="font-pixel text-2xl block">HUNT</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* VIEW 3: HUNTING (TIMER + LOG, NO ANIMATION) */}
            {currentView === 'HUNTING' && (
                <motion.div key="hunting" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="w-full h-full relative">
                    <SafeImage src="/assets/bg_hunt.png" fallbackText="FOREST BG" alt="bg" className="bg-full brightness-50" />
                    
                    <div className="ui-layer p-6 flex flex-col items-center justify-center">
                        <h2 className="font-pixel text-4xl text-red-500 mb-8 animate-pulse text-center">HUNTING IN PROGRESS</h2>
                        
                        {/* Countdown */}
                        <div className="bg-black/80 border-4 border-red-900 rounded-full w-40 h-40 flex items-center justify-center mb-8 shadow-[0_0_30px_rgba(220,38,38,0.5)]">
                            {huntTimer > 0 ? (
                                <span className="font-pixel text-6xl text-white">{huntTimer}</span>
                            ) : (
                                <span className="font-pixel text-4xl text-green-400">DONE</span>
                            )}
                        </div>

                        {/* Logs */}
                        <div className="w-full bg-black/70 border border-slate-600 p-4 rounded-lg min-h-[150px] mb-6 font-mono text-left">
                            {huntLog.length > 0 ? (
                                huntLog.map((log, i) => (
                                    <p key={i} className="font-pixel text-xl text-green-300 border-b border-white/10 pb-1 mb-1">{log}</p>
                                ))
                            ) : (
                                <p className="font-pixel text-xl text-slate-500 italic text-center mt-10">Tracking beast signals...</p>
                            )}
                        </div>

                        {/* Back Button (Muncul kalau selesai) */}
                        {huntTimer === 0 && (
                            <button 
                                onClick={() => setCurrentView('LOBBY')}
                                className="w-full bg-slate-700 hover:bg-slate-600 py-4 rounded-lg font-pixel text-2xl border-b-4 border-slate-900 active:border-b-0 active:translate-y-1"
                            >
                                RETURN TO BASE
                            </button>
                        )}
                    </div>
                </motion.div>
            )}

            {/* VIEW 4: MISSION (GLOBAL PROGRESS) */}
            {currentView === 'MISSION' && (
                <motion.div key="mission" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="w-full h-full relative">
                    {/* BG Berubah sesuai level (Mockup logic) */}
                    <SafeImage src={`/assets/bg_mission_${missionLevel}.png`} fallbackText="VILLAGE BG" alt="bg" className="bg-full" />
                    
                    <div className="ui-layer p-4 justify-between">
                        {/* Top Bar */}
                        <div className="bg-black/80 p-4 rounded-lg border border-yellow-600/50 backdrop-blur-md shadow-lg">
                            <h2 className="font-pixel text-2xl text-yellow-400 text-center mb-2">PROJECT: THE OUTER WALL</h2>
                            <div className="w-full bg-gray-700 h-6 rounded-full overflow-hidden border-2 border-gray-500 relative">
                                <div className="bg-yellow-500 h-full w-[45%]"></div> {/* Mock Progress 45% */}
                                <span className="absolute inset-0 flex items-center justify-center font-pixel text-white text-sm drop-shadow-md">45%</span>
                            </div>
                            <p className="text-center font-pixel text-sm mt-2 text-slate-300">Global Contribution Phase 1</p>
                        </div>

                        {/* Contribution Area */}
                        <div className="bg-[#2d2d2d] p-4 rounded-lg border-2 border-slate-600 shadow-xl">
                            <p className="font-pixel text-xl text-center mb-4 text-white">Donate Materials to Build:</p>
                            <div className="grid grid-cols-3 gap-3 mb-4">
                                <button className="bg-black/50 p-2 rounded border-2 border-slate-500 hover:border-yellow-500 transition active:scale-95">
                                    <SafeImage src="/assets/icon_bone.png" className="w-10 mx-auto mb-1" alt="bone" fallbackText="B" />
                                    <span className="font-pixel text-sm text-slate-300">Donate Bone</span>
                                </button>
                                <button className="bg-black/50 p-2 rounded border-2 border-slate-500 hover:border-yellow-500 transition active:scale-95">
                                    <SafeImage src="/assets/icon_hide.png" className="w-10 mx-auto mb-1" alt="hide" fallbackText="H" />
                                    <span className="font-pixel text-sm text-slate-300">Donate Hide</span>
                                </button>
                                <button className="bg-black/50 p-2 rounded border-2 border-slate-500 hover:border-yellow-500 transition active:scale-95">
                                    <SafeImage src="/assets/icon_cvar.png" className="w-10 mx-auto mb-1" alt="cvar" fallbackText="C" />
                                    <span className="font-pixel text-sm text-slate-300">Donate cVar</span>
                                </button>
                            </div>
                            <p className="font-pixel text-xs text-center text-slate-500">*Rewards distributed upon completion</p>
                        </div>

                        <button 
                            onClick={() => setCurrentView('LOBBY')}
                            className="w-full bg-slate-800 hover:bg-slate-700 py-3 rounded-lg font-pixel text-2xl border-b-4 border-slate-950 flex items-center justify-center gap-2 active:border-b-0 active:translate-y-1"
                        >
                            <ChevronLeft /> BACK TO LOBBY
                        </button>
                    </div>
                </motion.div>
            )}

        </AnimatePresence>
      </div>
    </div>
  );
}