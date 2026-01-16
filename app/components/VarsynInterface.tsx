"use client";

import React, { useState, useEffect } from 'react';
import { ChevronLeft, Map, Swords, Clock, Database, Plus, Minus } from 'lucide-react';
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

type ViewState = 'LOGIN' | 'MINTING' | 'LOBBY' | 'HUNTING' | 'MISSION';

// Safe Image
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
  const [selectedMaterial, setSelectedMaterial] = useState<string | null>(null);
  const [donateQty, setDonateQty] = useState(10);

  // --- LOGIC ---
  useEffect(() => {
    if (account?.address) { checkAccess(account.address); } else { setCurrentView('LOGIN'); }
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
    } catch (err) { console.error(err); } finally { setLoading(false); }
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

  const startHunt = () => { setCurrentView('HUNTING'); setHuntTimer(5); setHuntLog([]); };
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

      if (loot.type) setInventory(prev => ({ ...prev, [loot.type]: prev[loot.type as keyof typeof inventory] + loot.qty }));
      setHuntLog([`> Target: ${beast} eliminated.`, `> Loot: ${loot.qty}x ${loot.name}`, `> Status: Return.`]);
  };

  const handleSelectMaterial = (type: string) => { setSelectedMaterial(type); setDonateQty(10); };
  const handleDonateConfirm = async () => {
      if (!selectedMaterial) return;
      setInventory(prev => ({ ...prev, [selectedMaterial]: Math.max(0, prev[selectedMaterial as keyof typeof inventory] - donateQty) }));
      alert(`Donated ${donateQty} ${selectedMaterial} to Project!`);
      setSelectedMaterial(null);
  };

  // --- RENDER UI ---
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0f1115] p-4 font-mono">
      <div className="w-full max-w-[400px] aspect-[9/16] bg-black relative overflow-hidden shadow-2xl border-2 border-[#2d3748] rounded-[24px] text-white flex flex-col">
        
        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=VT323&display=swap');
          .font-pixel { font-family: 'VT323', monospace; }
          .bg-full { width: 100%; height: 100%; object-fit: cover; position: absolute; inset: 0; z-index: 0; }
          .ui-layer { position: relative; z-index: 10; height: 100%; display: flex; flex-direction: column; }
        `}</style>

        {currentView !== 'LOGIN' && (
            <div className="absolute top-0 w-full z-20 bg-black/50 p-2 border-b border-white/10 flex justify-between items-center backdrop-blur-sm pt-4 px-4">
                <span className="font-pixel text-xl text-green-400 tracking-widest drop-shadow-md">VARSYN</span>
                <div className="scale-75 origin-right"><ConnectButton client={client} chain={baseSepolia} theme="dark" connectModal={{ size: "compact" }} /></div>
            </div>
        )}

        <AnimatePresence mode='wait'>

            {/* --- VIEW 1: LOGIN (CENTER FIXED) --- */}
            {currentView === 'LOGIN' && (
                <motion.div key="login" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="w-full h-full relative">
                    <SafeImage src="/assets/bg_common.png" fallbackText="BG LOGIN" alt="bg" className="bg-full opacity-60" />
                    
                    {/* UI LAYER: 
                        - justify-center: Vertikal Tengah
                        - items-center: Horizontal Tengah
                        - gap-10: Jarak antar grup (Logo vs Tombol)
                    */}
                    <div className="ui-layer items-center justify-center h-full w-full gap-10 p-6">
                        
                        {/* 1. LOGO */}
                        <div className="w-full flex justify-center">
                            <SafeImage 
                                src="/assets/logo_main.png" 
                                fallbackText="VARSYN LOGO" 
                                alt="logo" 
                                className="w-[240px] h-auto object-contain animate-pulse drop-shadow-2xl" 
                            />
                        </div>

                        {/* 2. BUTTON GROUP (Tombol + Teks) */}
                        <div className="flex flex-col items-center gap-4 w-full">
                            {/* Tombol Connect */}
                            <div className="transform scale-110">
                                <ConnectButton client={client} chain={baseSepolia} theme="dark" connectModal={{ size: "compact" }} />
                            </div>
                            
                            {/* Teks Status */}
                            <div className="text-center">
                                <h2 className="font-pixel text-2xl text-green-400 tracking-widest mb-1 drop-shadow-md">SYSTEM ONLINE</h2>
                                <p className="font-pixel text-slate-400 text-sm">Identify Yourself, Manager.</p>
                            </div>
                        </div>

                    </div>
                </motion.div>
            )}

            {/* VIEW 1.5: MINTING */}
            {currentView === 'MINTING' && (
                <motion.div key="minting" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="w-full h-full relative">
                    <SafeImage src="/assets/bg_common.png" fallbackText="BG MINT" alt="bg" className="bg-full opacity-40" />
                    <div className="ui-layer p-4 pt-20 flex-col">
                        <div className="flex-1 flex items-center justify-center">
                            <div className="relative">
                                <SafeImage src="/assets/img_sigil.png" fallbackText="SIGIL CARD" alt="sigil" className="w-32 hover:scale-105 transition drop-shadow-[0_0_15px_rgba(74,222,128,0.5)]" />
                            </div>
                        </div>
                        <div className="w-full mb-8">
                            <TransactionButton transaction={() => { if(!account?.address) throw new Error("No wallet"); return claimTo({ contract, to: account.address, quantity: BigInt(1) }); }} onTransactionConfirmed={handleMintSuccess} unstyled className="w-full bg-blue-600 hover:bg-blue-500 text-white font-pixel text-3xl py-4 border-b-4 border-blue-800 rounded-xl active:translate-y-1 active:border-b-0 shadow-lg">MINT ACCESS</TransactionButton>
                            <p className="text-center font-pixel text-slate-400 mt-2">Price: 0.5 USDC</p>
                        </div>
                        <div className="flex items-end gap-2 pb-4">
                            <SafeImage src="/assets/char_creator.png" fallbackText="CREATOR" alt="creator" className="w-24 drop-shadow-lg" />
                            <div className="bg-white border-2 border-black p-3 rounded-tr-xl rounded-tl-xl rounded-br-xl relative flex-1 mb-4 shadow-lg">
                                <p className="font-pixel text-xl text-black leading-tight">"Listen up, Manager. The system's crashing. We need that <span className="font-bold text-blue-700">SigilVar</span>. Get yours, ASAP."</p>
                                <div className="absolute bottom-[-8px] left-0 w-0 h-0 border-l-[10px] border-l-white border-b-[10px] border-b-transparent"></div>
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
                        <div className="flex flex-col gap-2">
                            <div className="bg-black/70 px-2 py-1 rounded border border-slate-700 self-start font-pixel text-slate-400 text-xs">ID: {account?.address?.slice(0,6)}...</div>
                            <div className="bg-black/70 border border-slate-600 rounded-lg p-2 flex justify-between backdrop-blur-md">
                                {['cVar', 'meat', 'bone', 'hide'].map((item) => (
                                    <div key={item} className="flex flex-col items-center min-w-[40px]">
                                        <SafeImage src={`/assets/icon_${item.toLowerCase()}.png`} fallbackText={item[0].toUpperCase()} alt={item} className="w-6 h-6 mb-1" />
                                        <span className={`font-pixel text-lg ${item === 'cVar' ? 'text-yellow-400' : 'text-white'}`}>{inventory[item as keyof typeof inventory]}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="flex-1 flex items-center justify-center">
                            <SafeImage src="/assets/char_clonevar.png" fallbackText="CLONEVAR" alt="char" className="w-48 drop-shadow-2xl filter brightness-110" />
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setCurrentView('MISSION')} className="flex-1 bg-blue-700 border-b-4 border-blue-900 p-3 rounded-lg active:translate-y-1 active:border-b-0 hover:bg-blue-600 transition"><Map className="mx-auto mb-1 w-6" /><span className="font-pixel text-2xl block">MISSION</span><span className="font-pixel text-xs text-blue-200 block">GLOBAL</span></button>
                            <button onClick={startHunt} className="flex-1 bg-red-700 border-b-4 border-red-900 p-3 rounded-lg active:translate-y-1 active:border-b-0 hover:bg-red-600 transition"><Swords className="mx-auto mb-1 w-6" /><span className="font-pixel text-2xl block">HUNT</span><span className="font-pixel text-xs text-red-200 block">RAID</span></button>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* VIEW 3: HUNTING */}
            {currentView === 'HUNTING' && (
                <motion.div key="hunting" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="w-full h-full relative">
                    <SafeImage src="/assets/bg_hunt.png" fallbackText="FOREST BG" alt="bg" className="bg-full brightness-50" />
                    <div className="ui-layer p-6 pt-20 flex flex-col items-center justify-center">
                        <h2 className="font-pixel text-4xl text-red-500 mb-8 animate-pulse text-center tracking-widest">HUNTING...</h2>
                        <div className="bg-black/80 border-4 border-red-900 rounded-full w-48 h-48 flex items-center justify-center mb-8 shadow-[0_0_30px_rgba(220,38,38,0.4)]">
                            {huntTimer > 0 ? (<span className="font-pixel text-7xl text-white">{huntTimer}</span>) : (<span className="font-pixel text-5xl text-green-400">DONE</span>)}
                        </div>
                        <div className="w-full bg-black/80 border border-slate-600 p-4 rounded-lg min-h-[150px] mb-6 font-mono text-left shadow-lg">
                            {huntLog.length > 0 ? (huntLog.map((log, i) => (<p key={i} className="font-pixel text-xl text-green-400 border-b border-white/10 pb-1 mb-1">{log}</p>))) : (<p className="font-pixel text-xl text-slate-500 italic text-center mt-10 animate-pulse">Tracking beast signals...</p>)}
                        </div>
                        {huntTimer === 0 && (<button onClick={() => setCurrentView('LOBBY')} className="w-full bg-slate-700 hover:bg-slate-600 py-4 rounded-lg font-pixel text-2xl border-b-4 border-slate-900 active:border-b-0 active:translate-y-1">RETURN TO BASE</button>)}
                    </div>
                </motion.div>
            )}

            {/* VIEW 4: MISSION */}
            {currentView === 'MISSION' && (
                <motion.div key="mission" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="w-full h-full relative">
                    <SafeImage src={`/assets/bg_mission_${missionLevel}.png`} fallbackText="VILLAGE BG" alt="bg" className="bg-full" />
                    <div className="ui-layer p-4 pt-20 flex flex-col h-full">
                        <div className="bg-black/80 p-4 rounded-lg border border-yellow-600/50 backdrop-blur-md shadow-lg mb-auto">
                            <h2 className="font-pixel text-2xl text-yellow-400 text-center mb-2">PROJECT: THE OUTER WALL</h2>
                            <div className="w-full bg-gray-700 h-6 rounded-full overflow-hidden border-2 border-gray-500 relative">
                                <div className="bg-yellow-500 h-full w-[45%]"></div> 
                                <span className="absolute inset-0 flex items-center justify-center font-pixel text-white text-sm drop-shadow-md">45% Completed</span>
                            </div>
                        </div>
                        <div className="mt-auto space-y-3 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-3 rounded-xl pt-10">
                            <div className="bg-[#1e293b]/95 p-4 rounded-xl border-2 border-slate-600 shadow-xl">
                                <p className="font-pixel text-xl text-center mb-4 text-white">Select Material:</p>
                                <div className="grid grid-cols-2 gap-4 mb-6">
                                    {['meat', 'bone', 'hide', 'cVar'].map((item) => (
                                        <button key={item} onClick={() => handleSelectMaterial(item)} className={`relative h-24 w-full rounded-xl border-2 transition-all active:scale-95 flex flex-col items-center justify-center gap-1 ${selectedMaterial === item ? 'bg-yellow-900/40 border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.3)]' : 'bg-black/60 border-slate-700 hover:border-slate-500 hover:bg-black/80'}`}>
                                            <div className="w-10 h-10 flex items-center justify-center flex-shrink-0"><SafeImage src={`/assets/icon_${item.toLowerCase()}.png`} className="w-full h-full object-contain drop-shadow-md" alt={item} fallbackText={item[0].toUpperCase()} /></div>
                                            <span className={`font-pixel text-lg uppercase tracking-wide leading-none ${selectedMaterial === item ? 'text-yellow-400' : 'text-slate-400'}`}>{item}</span>
                                            {selectedMaterial === item && <div className="absolute top-2 right-2 w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />}
                                        </button>
                                    ))}
                                </div>
                                {selectedMaterial ? (
                                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                                        <div className="flex items-center justify-center gap-4 mb-4">
                                            <button onClick={() => setDonateQty(Math.max(1, donateQty - 1))} className="p-2 bg-slate-700 rounded hover:bg-slate-600"><Minus size={16} /></button>
                                            <span className="font-pixel text-3xl text-white w-16 text-center">{donateQty}</span>
                                            <button onClick={() => setDonateQty(donateQty + 1)} className="p-2 bg-slate-700 rounded hover:bg-slate-600"><Plus size={16} /></button>
                                        </div>
                                        <button onClick={handleDonateConfirm} className="w-full bg-green-600 hover:bg-green-500 py-3 rounded-lg font-pixel text-2xl border-b-4 border-green-800 active:border-b-0 active:translate-y-1 text-white">CONFIRM</button>
                                    </div>
                                ) : (<p className="text-center font-pixel text-slate-500 text-sm h-[88px] flex items-center justify-center">Select item above to contribute...</p>)}
                            </div>
                            <button onClick={() => setCurrentView('LOBBY')} className="w-full bg-slate-800 hover:bg-slate-700 py-3 rounded-lg font-pixel text-2xl border-b-4 border-slate-950 flex items-center justify-center gap-2 active:border-b-0 active:translate-y-1"><ChevronLeft /> BACK TO LOBBY</button>
                        </div>
                    </div>
                </motion.div>
            )}

        </AnimatePresence>
      </div>
    </div>
  );
}