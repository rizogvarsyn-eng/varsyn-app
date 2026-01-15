"use client";

import React, { useState, useEffect } from 'react';
import { Skull, ShoppingBag, Clock, Database, ChevronRight, CheckCircle, ImageOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';

// --- THIRDWEB IMPORTS ---
import { createThirdwebClient, getContract } from "thirdweb";
import { ConnectButton, useActiveAccount, TransactionButton } from "thirdweb/react";
import { baseSepolia } from "thirdweb/chains";
import { claimTo, balanceOf } from "thirdweb/extensions/erc721";

// 1. Setup Client
const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || "",
});

// 2. Setup Contract
const contract = getContract({
  client,
  chain: baseSepolia,
  address: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "", 
});

type Phase = 'GATEWAY' | 'INTRO_DIALOGUE' | 'MINTING' | 'LOBBY' | 'HUNTING' | 'SUMMARY';

// --- KOMPONEN GAMBAR AMAN ---
const SafeImage = ({ src, alt, className, fallbackText }: { src: string, alt: string, className?: string, fallbackText?: string }) => {
    const [error, setError] = useState(false);
    const fallbackSrc = `https://placehold.co/400x600/1a1a1a/4ade80/png?text=${fallbackText || 'NO+ASSET'}&font=roboto`;

    return (
        <img 
            src={error ? fallbackSrc : src} 
            alt={alt} 
            className={className} 
            onError={() => setError(true)}
        />
    );
};

export default function VarsynInterface() {
  const account = useActiveAccount();
  const [phase, setPhase] = useState<Phase>('GATEWAY');
  
  // Game State
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(0);
  const [inventory, setInventory] = useState({ meat: 0, bone: 0, hide: 0, cVar: 0 });
  const [logs, setLogs] = useState<string[]>([]);

  // Dialogue State
  const [dialogueText, setDialogueText] = useState("");
  const [dialogueIndex, setDialogueIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(false);

  const introDialogues = [
    "System Initializing...",
    "Connection established.",
    "Greetings, Manager. I am The Creator.",
    "Varsyn's ecosystem is collapsing.",
    "We need an external entity to restore order.",
    "Access is restricted to authorized personnel.",
    "Show me your SigilVar, or forge a new identity."
  ];

  const addLog = (text: string) => {
    setLogs(prev => [`> ${text}`, ...prev].slice(0, 3));
  };

  // --- TYPEWRITER ---
  useEffect(() => {
    if (phase === 'INTRO_DIALOGUE' && dialogueIndex < introDialogues.length) {
      setIsTyping(true);
      setDialogueText("");
      let currentText = introDialogues[dialogueIndex];
      let charIndex = 0;
      const typingInterval = setInterval(() => {
        if (charIndex <= currentText.length) {
          setDialogueText(currentText.slice(0, charIndex));
          charIndex++;
        } else {
          clearInterval(typingInterval);
          setIsTyping(false);
        }
      }, 40); 
      return () => clearInterval(typingInterval);
    }
  }, [phase, dialogueIndex]);

  const nextDialogue = () => {
    if (dialogueIndex < introDialogues.length - 1) {
      setDialogueIndex(prev => prev + 1);
    } else {
      setPhase('MINTING');
    }
  };

  // --- SYSTEM CHECK ---
  useEffect(() => {
    if (account?.address) {
        checkUserStatus(account.address);
    } else {
        setPhase('GATEWAY');
        setDialogueIndex(0);
    }
  }, [account?.address]);

  const checkUserStatus = async (wallet: string) => {
    setLoading(true);
    addLog(`Scanning...`);

    try {
        let ownsNftOnChain = false;
        try {
            const balance = await balanceOf({ contract, owner: wallet });
            ownsNftOnChain = balance > BigInt(0);
        } catch (e) { console.warn(e); }

        const { data: users, error } = await supabase.from('users').select('*').eq('wallet_address', wallet);
        if (error) throw error;
        const existingUser = users && users.length > 0 ? users[0] : null;

        if (existingUser) {
            if (ownsNftOnChain && !existingUser.has_sigil) {
                await supabase.from('users').update({ has_sigil: true }).eq('wallet_address', wallet);
                existingUser.has_sigil = true;
            }
            if (existingUser.has_sigil) {
                setPhase('LOBBY');
                loadInventory(existingUser.id);
            } else {
                setPhase('INTRO_DIALOGUE');
            }
        } else {
            const { data: newUsers } = await supabase.from('users').insert([{ wallet_address: wallet, has_sigil: ownsNftOnChain }]).select();
            const newUser = newUsers?.[0];
            if(newUser) await supabase.from('inventory').insert([{ user_id: newUser.id }]);

            if (ownsNftOnChain) {
                setPhase('LOBBY');
            } else {
                setPhase('INTRO_DIALOGUE');
            }
        }
    } catch (err) {
        console.error(err);
    } finally {
        setLoading(false);
    }
  };

  const loadInventory = async (userId: string) => {
      const { data: invs } = await supabase.from('inventory').select('*').eq('user_id', userId);
      const data = invs?.[0];
      if(data) setInventory({ meat: data.meat, bone: data.bone, hide: data.hide, cVar: data.cvar });
  };

  const handleMintSuccess = async () => {
      if (account?.address) {
          await supabase.from('users').update({ has_sigil: true }).eq('wallet_address', account.address);
          setPhase('LOBBY');
      }
  };

  // --- GAMEPLAY ---
  const startHunt = () => { setPhase('HUNTING'); setTimer(3); };
  
  useEffect(() => {
    if (phase === 'HUNTING' && timer > 0) {
      const tick = setInterval(() => setTimer(t => t - 1), 1000);
      return () => clearInterval(tick);
    }
  }, [phase, timer]);

  const claimLoot = async () => {
    setLoading(true);
    const loot = { meat: 0, bone: 0, hide: 0, cVar: 0 };
    const rolls = 6;
    for(let i=0; i<rolls; i++) {
        const r = Math.random();
        if(r < 0.05) loot.cVar++; else if(r < 0.20) loot.hide++; else if(r < 0.50) loot.bone++; else loot.meat++;
    }

    if (account?.address) {
        const { data: users } = await supabase.from('users').select('id').eq('wallet_address', account.address);
        const user = users?.[0];
        if (user) {
             const { data: invs } = await supabase.from('inventory').select('*').eq('user_id', user.id);
             const oldInv = invs?.[0];
             if (oldInv) {
                 await supabase.from('inventory').update({
                     meat: oldInv.meat + loot.meat, bone: oldInv.bone + loot.bone, hide: oldInv.hide + loot.hide, cvar: oldInv.cvar + loot.cVar
                 }).eq('user_id', user.id);
             }
        }
    }
    setInventory(prev => ({ meat: prev.meat + loot.meat, bone: prev.bone + loot.bone, hide: prev.hide + loot.hide, cVar: prev.cVar + loot.cVar }));
    setTimeout(() => { setLoading(false); setPhase('SUMMARY'); }, 1000);
  };

  // --- RENDER VISUAL ---
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0f1115] p-4">
      {/* MOBILE CONTAINER */}
      <div className="w-full max-w-[400px] aspect-[9/16] bg-black relative overflow-hidden shadow-2xl border-8 border-[#2d3748] rounded-[2rem] font-mono text-white flex flex-col">
        
        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=VT323&display=swap');
          .pixel-font { font-family: 'VT323', monospace; }
          .pixel-corners { clip-path: polygon(0 4px, 4px 4px, 4px 0, calc(100% - 4px) 0, calc(100% - 4px) 4px, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 4px calc(100% - 4px), 0 calc(100% - 4px)); }
          .bg-portrait { width: 100%; height: 100%; object-fit: cover; object-position: center; }
        `}</style>

        {/* LAYER 1: BACKGROUND */}
        <div className="absolute inset-0 z-0">
          {/* UPDATED: GATEWAY PAKE BG_LOGIN.PNG */}
          {phase === 'GATEWAY' && <SafeImage src="/assets/bg_login.png" fallbackText="LOGIN+BG" alt="bg" className="bg-portrait opacity-80" />}
          {phase === 'INTRO_DIALOGUE' && <SafeImage src="/assets/bg_intro.png" fallbackText="VOID+BG" alt="bg" className="bg-portrait opacity-40" />}
          {phase === 'MINTING' && <SafeImage src="/assets/bg_intro.png" fallbackText="VOID+BG" alt="bg" className="bg-portrait opacity-30" />}
          {phase === 'LOBBY' && <SafeImage src="/assets/bg_lobby.png" fallbackText="VILLAGE+BG" alt="bg" className="bg-portrait" />}
          {phase === 'HUNTING' && <SafeImage src="/assets/bg_hunt.png" fallbackText="FOREST+BG" alt="bg" className="bg-portrait" />}
          {phase === 'SUMMARY' && <SafeImage src="/assets/bg_lobby.png" fallbackText="VILLAGE+BG" alt="bg" className="bg-portrait blur-sm" />}
        </div>

        {/* LAYER 2: UI CONTENT */}
        <div className="absolute inset-0 z-10 flex flex-col pointer-events-none">
          
          {/* TOP BAR */}
          <div className="bg-black/70 p-3 border-b-2 border-white/10 flex justify-between items-center pointer-events-auto backdrop-blur-sm pt-6"> 
              <span className="pixel-font text-2xl text-green-400 tracking-widest drop-shadow-md">VARSYN</span>
              <div className="scale-75 origin-right">
                  <ConnectButton client={client} chain={baseSepolia} theme="dark" connectModal={{ size: "compact" }} />
              </div>
          </div>

          {/* MAIN GAME AREA */}
          <div className="flex-1 relative flex flex-col items-center justify-center p-4 pointer-events-auto">
              <AnimatePresence mode='wait'>

                  {phase === 'GATEWAY' && (
                      <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} className="text-center space-y-6 mt-10">
                          <SafeImage src="/assets/sigil_seal.png" fallbackText="SEAL" alt="seal" className="w-32 h-32 mx-auto animate-pulse drop-shadow-[0_0_15px_rgba(74,222,128,0.5)]" />
                          <div>
                              <h1 className="pixel-font text-5xl text-white drop-shadow-lg mb-2">VARSYN</h1>
                              <p className="pixel-font text-xl text-green-400 bg-black/50 px-2 rounded border border-green-800">SYSTEM OF RESTORATION</p>
                          </div>
                      </motion.div>
                  )}

                  {phase === 'INTRO_DIALOGUE' && (
                      <motion.div initial={{opacity:0}} animate={{opacity:1}} className="w-full h-full flex flex-col justify-end pb-8">
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <SafeImage src="/assets/creator_silhouette.png" fallbackText="THE+CREATOR" alt="creator" className="w-64 opacity-90 animate-float" />
                          </div>
                          <div 
                              className="bg-[#1a1a1a]/95 border-2 border-white p-4 min-h-[140px] relative cursor-pointer pixel-corners shadow-lg"
                              onClick={nextDialogue}
                          >
                              <h3 className="pixel-font text-xl text-green-400 mb-1 tracking-wider">THE CREATOR</h3>
                              <p className="pixel-font text-2xl leading-tight text-slate-200">{dialogueText}</p>
                              {!isTyping && <div className="absolute bottom-3 right-3 animate-bounce"><ChevronRight size={24} className="text-green-400" /></div>}
                          </div>
                      </motion.div>
                  )}

                  {phase === 'MINTING' && (
                      <motion.div initial={{opacity:0}} animate={{opacity:1}} className="w-full h-full flex flex-col justify-center items-center space-y-8">
                          <div className="bg-black/80 p-6 rounded-xl border border-slate-700 text-center w-full max-w-xs backdrop-blur-md">
                              <SafeImage src="/assets/sigil_seal.png" fallbackText="SEAL" alt="seal" className="w-24 h-24 mx-auto mb-4" />
                              <h2 className="pixel-font text-3xl text-red-400 mb-2">ACCESS REQUIRED</h2>
                              <p className="pixel-font text-lg text-slate-300">Mint SigilVar to Enter</p>
                          </div>
                          <div className="w-full max-w-xs">
                              <TransactionButton
                                  transaction={() => {
                                      if(!account?.address) throw new Error("No wallet");
                                      return claimTo({ contract, to: account.address, quantity: BigInt(1) });
                                  }}
                                  onTransactionConfirmed={handleMintSuccess}
                                  unstyled
                                  className="w-full py-4 bg-green-600 hover:bg-green-500 text-white pixel-font text-2xl border-b-4 border-green-800 active:border-b-0 active:translate-y-1 transition-all pixel-corners shadow-xl"
                              >
                                  MINT (0.5 USDC)
                              </TransactionButton>
                          </div>
                      </motion.div>
                  )}

                  {phase === 'LOBBY' && (
                      <motion.div initial={{opacity:0}} animate={{opacity:1}} className="w-full h-full flex flex-col justify-between pt-10 pb-4">
                          <div className="absolute top-2 right-2 bg-black/60 px-3 py-1 rounded pixel-corners border border-slate-600">
                              <span className="pixel-font text-yellow-400 text-lg flex items-center gap-1"><span className="text-xs">LVL</span> 1</span>
                          </div>
                          <div className="flex-1 relative flex items-end justify-center pb-24">
                              <SafeImage src="/assets/char_idle.gif" fallbackText="HERO" alt="char" className="w-32 pixelated drop-shadow-2xl" />
                          </div>
                          <div className="space-y-3 w-full bg-black/40 p-2 rounded-xl backdrop-blur-sm">
                              <div className="flex gap-2">
                                  <button onClick={startHunt} className="flex-1 bg-red-700 border-b-4 border-red-900 p-3 pixel-corners active:border-b-0 active:translate-y-1">
                                      <span className="pixel-font text-2xl text-white block">HUNT</span>
                                  </button>
                                  <button className="flex-1 bg-slate-700 border-b-4 border-slate-900 p-3 pixel-corners opacity-70">
                                      <span className="pixel-font text-2xl text-white block">STORE</span>
                                  </button>
                              </div>
                              <div className="bg-[#2d2d2d] border-2 border-gray-600 p-2 flex justify-between pixel-corners">
                                  <div className="flex items-center gap-2">
                                      <SafeImage src="/assets/icon_meat.png" fallbackText="M" alt="meat" className="w-6 h-6" />
                                      <span className="pixel-font text-xl">{inventory.meat}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                      <SafeImage src="/assets/icon_bone.png" fallbackText="B" alt="bone" className="w-6 h-6" />
                                      <span className="pixel-font text-xl">{inventory.bone}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                      <SafeImage src="/assets/icon_hide.png" fallbackText="H" alt="hide" className="w-6 h-6" />
                                      <span className="pixel-font text-xl">{inventory.hide}</span>
                                  </div>
                              </div>
                          </div>
                      </motion.div>
                  )}

                  {phase === 'HUNTING' && (
                      <motion.div className="w-full h-full flex flex-col items-center justify-center space-y-12">
                          <div className="relative w-full flex justify-center">
                              <SafeImage src="/assets/char_run.gif" fallbackText="RUNNING..." alt="run" className="w-40 pixelated" />
                          </div>
                          <div className="bg-black/80 px-8 py-3 rounded pixel-corners border-2 border-green-500 shadow-[0_0_20px_rgba(74,222,128,0.3)]">
                              <span className="pixel-font text-5xl text-green-400 tracking-widest">00:0{timer}</span>
                          </div>
                          {timer === 0 && (
                              <button onClick={claimLoot} disabled={loading} className="w-full max-w-xs py-4 bg-yellow-600 hover:bg-yellow-500 text-white pixel-font text-3xl border-b-4 border-yellow-800 pixel-corners animate-bounce shadow-xl">
                                  CLAIM LOOT!
                              </button>
                          )}
                      </motion.div>
                  )}

                  {phase === 'SUMMARY' && (
                      <motion.div className="w-full h-full flex flex-col justify-center items-center p-4">
                          <div className="w-full bg-[#1a1a1a] border-4 border-white p-6 pixel-corners text-center shadow-2xl relative">
                              <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-black px-4 border-2 border-white pixel-corners">
                                  <h2 className="pixel-font text-3xl text-green-400">SUCCESS</h2>
                              </div>
                              <div className="grid grid-cols-1 gap-3 mt-4 mb-6">
                                  {Object.entries(inventory).map(([key, val]) => (
                                      val > 0 && <div key={key} className="flex justify-between items-center bg-slate-800 p-3 pixel-corners border border-slate-600">
                                          <div className="flex items-center gap-2">
                                              <span className="pixel-font text-xl uppercase text-slate-300">{key}</span>
                                          </div>
                                          <span className="pixel-font text-2xl text-yellow-400">+{val}</span>
                                      </div>
                                  ))}
                              </div>
                              <button onClick={() => setPhase('LOBBY')} className="w-full py-3 bg-slate-600 hover:bg-slate-500 text-white pixel-font text-2xl border-b-4 border-slate-800 pixel-corners">CONTINUE</button>
                          </div>
                      </motion.div>
                  )}

              </AnimatePresence>
          </div>

          {/* LOGS */}
          <div className="bg-black/90 p-2 border-t-2 border-white/10 h-20 overflow-hidden pointer-events-auto text-left rounded-b-[1.5rem]">
              {logs.map((log, i) => (
                  <div key={i} className="pixel-font text-green-500/70 text-base leading-tight truncate font-thin">{log}</div>
              ))}
          </div>

        </div>
      </div>
    </div>
  );
}