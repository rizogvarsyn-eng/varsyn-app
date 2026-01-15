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

// --- VIEW DEFINITIONS ---
type ViewState = 'LOGIN' | 'MINTING' | 'LOBBY' | 'HUNTING' | 'MISSION';

// Komponen Gambar Aman
const SafeImage = ({ src, alt, className, fallbackText }: { src: string, alt: string, className?: string, fallbackText?: string }) => {
    const [error, setError] = useState(false);
    const fallbackSrc = `https://placehold.co/400x600/1a1a1a/4ade80/png?text=${fallbackText || 'ASSET'}&font=roboto`;
    return <img src={error ? fallbackSrc : src} alt={alt} className={className} onError={() => setError(true)} />;
};

export default function VarsynInterface() {
  const account = useActiveAccount();
  const [currentView, setCurrentView] = useState<ViewState>('LOGIN');
  const [loading, setLoading] = useState(false);
  const [inventory, setInventory] = useState({ meat: 0, bone: 0, hide: 0, cVar: 0 });
  const [missionLevel, setMissionLevel] = useState(1);
  const [huntTimer, setHuntTimer] = useState(0);
  const [huntLog, setHuntLog] = useState<string[]>([]);

  // --- LOGIC: SYSTEM CHECK ---
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
        let hasNft = false;
        try {
            const balance = await balanceOf({ contract, owner: wallet });
            hasNft = balance > BigInt(0);
        } catch (e) { console.warn("Chain check skip", e); }

        const { data: users } = await supabase.from('users').select('*').eq('wallet_address', wallet);
        const user = users?.[0];

        if (user) {
            if (hasNft && !user.has_sigil) {
                await supabase.from('users').update({ has_sigil: true }).eq('wallet_address', wallet);
                user.has_sigil = true;
            }
            if (user.has_sigil) {
                loadData(user.id);
                setCurrentView('LOBBY');
            } else {
                setCurrentView('MINTING');
            }
        } else {
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
      setHuntTimer(5);
      setHuntLog([]);
  };

  useEffect(() => {
      if (currentView === 'HUNTING' && huntTimer > 0) {
          const tick = setInterval(() => setHuntTimer(t => t - 1), 1000);
          return () => clearInterval(tick);
      } else if (currentView === 'HUNTING' && huntTimer === 0 && huntLog.length === 0) {
          finishHunt();
      }
  }, [currentView, huntTimer]);

  const finishHunt = async () => {
      const r = Math.random();
      let loot = { name: "Nothing", type: "", qty: 0 };
      let beast = "Wild Boar";

      if (r < 0.1) { loot = { name: "Hide", type: "hide", qty: 1 }; beast = "Shadow Wolf"; }
      else if (r < 0.4) { loot = { name: "Bone", type: "bone", qty: 2 }; beast = "Skeleton"; }
      else { loot = { name: "Meat", type: "meat", qty: 3 }; beast = "Wild Boar"; }

      if (loot.type) {
          setInventory(prev => ({ ...prev, [loot.type]: prev[loot.type as keyof typeof inventory] + loot.qty }));
      }
      
      setHuntLog([
          `> Target: ${beast} eliminated.`,
          `> Loot Acquired: ${loot.qty}x ${loot.name}`,
          `> Status: Return to base.`
      ]);
  };

  // --- RENDER UI ---
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0f1115] p-4 font-mono">
      <div className="w-full max-w-[400px] aspect-[9/16] bg-black relative overflow-hidden shadow-2xl border-4 border-[#4a5568] rounded-[2rem] text-white flex flex-col">
        
        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=VT323&display=swap');
          .font-pixel { font-family: 'VT323', monospace; }
          .bg-full { width: 100%; height: 100%; object-fit: cover; position: absolute; inset: 0; z-index: 0; }
          .ui-layer { position: relative; z-index: 10; height: 100%; display: flex; flex-direction: column; }
        `}</style>

        {/* TOP BAR (Hanya muncul jika BUKAN di halaman Login biar Login-nya bersih) */}
        {currentView !== 'LOGIN' && (
            <div className="absolute top-0 w-full z-20 bg-black/50 p-2 border-b border-white/10 flex justify-between items-center backdrop-blur-sm pt-6 px-4">
                <span className="font-pixel text-xl text-green-400 tracking-widest drop-shadow-md">VARSYN</span>
                <div className="scale-75 origin-right">
                    <ConnectButton client={client} chain={baseSepolia} theme="dark" connectModal={{ size: "compact" }} />
                </div>
            </div>
        )}

        <AnimatePresence mode='wait'>

            {/* VIEW 1: LOGIN (LAYOUT FIX) */}
            {currentView === 'LOGIN' && (
                <motion.div key="login" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="w-full h-full relative">
                    <SafeImage src="/assets/bg_common.png" fallbackText="BG LOGIN" alt="bg" className="bg-full opacity-60" />
                    
                    <div className="ui-layer items-center justify-center p-6 flex-col">
                        {/* 1. LOGO: Dibuat lebih besar (w-64) dan object-contain biar gak gepeng */}
                        <div className="flex-1 flex items-center justify-center w-full">
                            <SafeImage 
                                src="/assets/logo_main.png" 
                                fallbackText="VARSYN LOGO" 
                                alt="logo" 
                                className="w-64 h-auto object-contain animate-pulse drop-shadow-xl" 
                            />
                        </div>
                        
                        {/* 2. TEXT BOX */}
                        <div className="w-full bg-black/60 p-4 rounded-xl border border-white/20 text-center backdrop-blur-md mb-6">
                            <h2 className="font-pixel text-3xl text-green-400 mb-1 tracking-widest">SYSTEM ONLINE</h2>
                            <p className="font-pixel text-slate-300 text-lg">Identify yourself, Manager.</p>
                        </div>

                        {/* 3. CONNECT BUTTON: Dipaksa Center */}
                        <div className="w-full flex justify-center mb-10">
                            <ConnectButton 
                                client={client} 
                                chain={baseSepolia} 
                                theme="dark" 
                                connectModal={{ size: "compact" }} 
                            />
                        </div>
                    </div>
                </motion.div>
            )}

            {/* VIEW 1.5: MINTING */}
            {currentView === 'MINTING' && (
                <motion.div key="minting" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="w-full h-full relative">
                    <SafeImage src="/assets/bg_common.png" fallbackText="BG MINT" alt="bg" className="bg-full opacity-40" />
                    <div className="ui-layer p-4 pt-20">
                        <div className="flex-1 flex flex-col items-center justify-center relative">
                            <SafeImage src="/assets/char_creator.png" fallbackText="CREATOR CHAR" alt="creator" className="w-48 mb-4 drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]" />
                            <div className="bg-slate-900/90 border-2 border-white p-4 rounded-lg w-full mb-6">
                                <h3 className="font-pixel text-xl text-yellow-400 mb-1">THE CREATOR</h3>
                                <p className="font-pixel text-xl leading-tight">
                                    "The world is broken. I need a Manager with a <span className="text-green-400">SigilVar</span> to rebuild it. Obtain yours now."
                                </p>
                            </div>
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

            {/* VIEW 2: LOBBY */}
            {currentView === 'LOBBY' && (
                <motion.div key="lobby" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="w-full h-full relative">
                    <SafeImage src="/assets/bg_lobby.png" fallbackText="CAVE BG" alt="bg" className="bg-full" />
                    <div className="ui-layer p-4 pt-20 justify-between">
                        <div className="flex justify-between items-start">
                            <div className="bg-black/60 p-2 rounded border border-slate-600 flex items-center gap-2">
                                <SafeImage src="/assets/icon_cvar.png" fallbackText="C" alt="cvar" className="w-6" />
                                <span className="font-pixel text-xl text-yellow-400">{inventory.cVar}</span>
                            </div>
                            <div className="bg-black/60 px-3 py-1 rounded border border-slate-600 font-pixel text-slate-300 text-sm">
                                {account?.address?.slice(0,6)}...
                            </div>
                        </div>
                        <div className="flex-1 flex items-end justify-center pb-8">
                            <SafeImage src="/assets/char_clonevar.png" fallbackText="CLONEVAR" alt="char" className="w-48 drop-shadow-2xl" />
                        </div>
                        <div className="space-y-3">
                            <div className="bg-[#2d2d2d] border-2 border-gray-600 p-2 rounded-lg flex justify-around shadow-lg">
                                <div className="text-center"><SafeImage src="/assets/icon_meat.png" fallbackText="M" alt="meat" className="w-8 mx-auto" /><span className="font-pixel text-lg">{inventory.meat}</span></div>
                                <div className="text-center"><SafeImage src="/assets/icon_bone.png" fallbackText="B" alt="bone" className="w-8 mx-auto" /><span className="font-pixel text-lg">{inventory.bone}</span></div>
                                <div className="text-center"><SafeImage src="/assets/icon_hide.png" fallbackText="H" alt="hide" className="w-8 mx-auto" /><span className="font-pixel text-lg">{inventory.hide}</span></div>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => setCurrentView('MISSION')} className="flex-1 bg-blue-800 border-b-4 border-blue-950 p-3 rounded-lg active:translate-y-1 active:border-b-0"><Map className="mx-auto mb-1 w-6" /><span className="font-pixel text-2xl block">MISSION</span></button>
                                <button onClick={startHunt} className="flex-1 bg-red-800 border-b-4 border-red-950 p-3 rounded-lg active:translate-y-1 active:border-b-0"><Swords className="mx-auto mb-1 w-6" /><span className="font-pixel text-2xl block">HUNT</span></button>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* VIEW 3: HUNTING */}
            {currentView === 'HUNTING' && (
                <motion.div key="hunting" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="w-full h-full relative">
                    <SafeImage src="/assets/bg_hunt.png" fallbackText="FOREST BG" alt="bg" className="bg-full brightness-50" />
                    <div className="ui-layer p-6 pt-20 flex flex-col items-center justify-center">
                        <h2 className="font-pixel text-4xl text-red-500 mb-8 animate-pulse text-center">HUNTING IN PROGRESS</h2>
                        <div className="bg-black/80 border-4 border-red-900 rounded-full w-40 h-40 flex items-center justify-center mb-8 shadow-[0_0_30px_rgba(220,38,38,0.5)]">
                            {huntTimer > 0 ? (<span className="font-pixel text-6xl text-white">{huntTimer}</span>) : (<span className="font-pixel text-4xl text-green-400">DONE</span>)}
                        </div>
                        <div className="w-full bg-black/70 border border-slate-600 p-4 rounded-lg min-h-[150px] mb-6 font-mono text-left">
                            {huntLog.length > 0 ? (huntLog.map((log, i) => (<p key={i} className="font-pixel text-xl text-green-300 border-b border-white/10 pb-1 mb-1">{log}</p>))) : (<p className="font-pixel text-xl text-slate-500 italic text-center mt-10">Tracking beast signals...</p>)}
                        </div>
                        {huntTimer === 0 && (<button onClick={() => setCurrentView('LOBBY')} className="w-full bg-slate-700 hover:bg-slate-600 py-4 rounded-lg font-pixel text-2xl border-b-4 border-slate-900 active:border-b-0 active:translate-y-1">RETURN TO BASE</button>)}
                    </div>
                </motion.div>
            )}

            {/* VIEW 4: MISSION */}
            {currentView === 'MISSION' && (
                <motion.div key="mission" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="w-full h-full relative">
                    <SafeImage src={`/assets/bg_mission_${missionLevel}.png`} fallbackText="VILLAGE BG" alt="bg" className="bg-full" />
                    <div className="ui-layer p-4 pt-20 justify-between">
                        <div className="bg-black/80 p-4 rounded-lg border border-yellow-600/50 backdrop-blur-md shadow-lg">
                            <h2 className="font-pixel text-2xl text-yellow-400 text-center mb-2">PROJECT: THE OUTER WALL</h2>
                            <div className="w-full bg-gray-700 h-6 rounded-full overflow-hidden border-2 border-gray-500 relative">
                                <div className="bg-yellow-500 h-full w-[45%]"></div> 
                                <span className="absolute inset-0 flex items-center justify-center font-pixel text-white text-sm drop-shadow-md">45%</span>
                            </div>
                            <p className="text-center font-pixel text-sm mt-2 text-slate-300">Global Contribution Phase 1</p>
                        </div>
                        <div className="bg-[#2d2d2d] p-4 rounded-lg border-2 border-slate-600 shadow-xl">
                            <p className="font-pixel text-xl text-center mb-4 text-white">Donate Materials to Build:</p>
                            <div className="grid grid-cols-3 gap-3 mb-4">
                                <button className="bg-black/50 p-2 rounded border-2 border-slate-500 hover:border-yellow-500 transition active:scale-95"><SafeImage src="/assets/icon_bone.png" className="w-10 mx-auto mb-1" alt="bone" fallbackText="B" /><span className="font-pixel text-sm text-slate-300">Donate Bone</span></button>
                                <button className="bg-black/50 p-2 rounded border-2 border-slate-500 hover:border-yellow-500 transition active:scale-95"><SafeImage src="/assets/icon_hide.png" className="w-10 mx-auto mb-1" alt="hide" fallbackText="H" /><span className="font-pixel text-sm text-slate-300">Donate Hide</span></button>
                                <button className="bg-black/50 p-2 rounded border-2 border-slate-500 hover:border-yellow-500 transition active:scale-95"><SafeImage src="/assets/icon_cvar.png" className="w-10 mx-auto mb-1" alt="cvar" fallbackText="C" /><span className="font-pixel text-sm text-slate-300">Donate cVar</span></button>
                            </div>
                            <p className="font-pixel text-xs text-center text-slate-500">*Rewards distributed upon completion</p>
                        </div>
                        <button onClick={() => setCurrentView('LOBBY')} className="w-full bg-slate-800 hover:bg-slate-700 py-3 rounded-lg font-pixel text-2xl border-b-4 border-slate-950 flex items-center justify-center gap-2 active:border-b-0 active:translate-y-1"><ChevronLeft /> BACK TO LOBBY</button>
                    </div>
                </motion.div>
            )}

        </AnimatePresence>
      </div>
    </div>
  );
}