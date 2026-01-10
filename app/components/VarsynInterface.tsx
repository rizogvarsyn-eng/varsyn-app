"use client";

import React, { useState, useEffect } from 'react';
import { Shield, Skull, ShoppingBag, Clock, Database, User, Loader2, CheckCircle } from 'lucide-react';
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

type Phase = 'GATEWAY' | 'MINTING' | 'LOBBY' | 'HUNTING' | 'SUMMARY';

export default function VarsynInterface() {
  const account = useActiveAccount();
  
  const [phase, setPhase] = useState<Phase>('GATEWAY');
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(0);
  const [inventory, setInventory] = useState({ meat: 0, bone: 0, hide: 0, cVar: 0 });
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (text: string) => {
    setLogs(prev => [`> ${text}`, ...prev].slice(0, 4));
  };

  useEffect(() => {
    if (account?.address) {
        runSystemCheck(account.address);
    } else {
        setPhase('GATEWAY');
        addLog("Wallet disconnected.");
    }
  }, [account?.address]);

  // --- LOGIC UTAMA (REVISI BIGINT) ---
  const runSystemCheck = async (wallet: string) => {
    setLoading(true);
    addLog(`Scanning ID: ${wallet.slice(0,6)}...`);

    try {
        // STEP 1: INTEL BLOCKCHAIN
        let ownsNftOnChain = false;
        try {
            const balance = await balanceOf({ contract, owner: wallet });
            
            // --- [FIX DISINI] ---
            // Kita ganti '' jadi 'BigInt(0)' biar gak error di TS lama
            
            if (ownsNftOnChain) addLog("Permit detected on Blockchain! 💎");
        } catch (chainErr) {
            console.warn("Blockchain scan skipped:", chainErr);
        }

        // STEP 2: CEK DATABASE
        const { data: users, error } = await supabase
            .from('users')
            .select('*')
            .eq('wallet_address', wallet);

        if (error) throw error;

        const existingUser = users && users.length > 0 ? users[0] : null;

        if (existingUser) {
            // SKENARIO A: USER LAMA
            addLog("Manager Identity Found.");

            if (ownsNftOnChain && !existingUser.has_sigil) {
                addLog("Syncing DB with Blockchain...");
                await supabase.from('users').update({ has_sigil: true }).eq('wallet_address', wallet);
                existingUser.has_sigil = true; 
            }

            if (existingUser.has_sigil) {
                setPhase('LOBBY');
                loadInventory(existingUser.id);
            } else {
                setPhase('MINTING');
            }

        } else {
            // SKENARIO B: USER BARU
            addLog("Registering New Entity...");
            
            const { data: newUsers, error: insertError } = await supabase
                .from('users')
                .insert([{ 
                    wallet_address: wallet, 
                    has_sigil: ownsNftOnChain 
                }])
                .select();
            
            if (insertError) throw insertError;

            const newUser = newUsers && newUsers.length > 0 ? newUsers[0] : null;

            if(newUser) {
                await supabase.from('inventory').insert([{ user_id: newUser.id }]);
                
                if (ownsNftOnChain) {
                    setPhase('LOBBY');
                    addLog("Access Restored via Chain.");
                } else {
                    setPhase('MINTING');
                }
            }
        }
    } catch (err) {
        console.error("System Check Error:", err);
        addLog("Connection Failed.");
    } finally {
        setLoading(false);
    }
  };

  const loadInventory = async (userId: string) => {
      const { data: invs } = await supabase.from('inventory').select('*').eq('user_id', userId);
      const data = invs && invs.length > 0 ? invs[0] : null;
      if(data) setInventory({ meat: data.meat, bone: data.bone, hide: data.hide, cVar: data.cvar });
  };

  const handleMintSuccess = async () => {
      addLog("Transaction Confirmed! ⛓️");
      
      if (account?.address) {
          await supabase
            .from('users')
            .update({ has_sigil: true })
            .eq('wallet_address', account.address);
          
          setPhase('LOBBY');
          addLog("Access Granted.");
      }
  };

  const startHunt = () => { setPhase('HUNTING'); setTimer(3); addLog("Hunt started..."); };

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
                     meat: oldInv.meat + loot.meat,
                     bone: oldInv.bone + loot.bone,
                     hide: oldInv.hide + loot.hide,
                     cvar: oldInv.cvar + loot.cVar
                 }).eq('user_id', user.id);
             }
        }
    }
    setInventory(prev => ({ meat: prev.meat + loot.meat, bone: prev.bone + loot.bone, hide: prev.hide + loot.hide, cVar: prev.cVar + loot.cVar }));
    setTimeout(() => { setLoading(false); setPhase('SUMMARY'); addLog("Loot Saved."); }, 1000);
  };

  return (
    <div className="w-full max-w-md bg-slate-900 border-2 border-slate-700 rounded-xl overflow-hidden shadow-2xl relative flex flex-col h-[650px]">
      
      {/* HEADER */}
      <div className="bg-slate-950 p-4 border-b border-slate-800 flex justify-between items-center z-20 shadow-lg">
        <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${phase === 'LOBBY' ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`}></div>
            <span className="font-bold tracking-widest text-green-500 text-sm">VARSYN<span className="text-slate-600 text-xs">.OS</span></span>
        </div>
        <div className="scale-90 origin-right">
            <ConnectButton client={client} chain={baseSepolia} theme="dark" connectModal={{ size: "compact" }} />
        </div>
      </div>

      {/* MAIN SCREEN */}
      <main className="flex-1 relative p-6 flex flex-col items-center justify-center overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#4ade80 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>

        <AnimatePresence mode='wait'>
            
            {phase === 'GATEWAY' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center space-y-6 z-10">
                    <div className="w-24 h-24 bg-slate-800 rounded-full mx-auto flex items-center justify-center border-4 border-slate-700">
                        <User size={40} className="text-slate-500" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white mb-2">IDENTIFICATION</h1>
                        <p className="text-xs text-slate-400">Please connect Neural Link (Wallet) ↗</p>
                    </div>
                </motion.div>
            )}

            {phase === 'MINTING' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full space-y-4 z-10 text-center">
                    <div className="border border-red-500/30 bg-red-900/10 p-4 rounded">
                        <h2 className="text-red-400 font-bold text-sm mb-1">ACCESS DENIED</h2>
                        <p className="text-[10px] text-red-300">No SigilVar detected on Blockchain.</p>
                    </div>
                    <div className="bg-slate-800 p-3 rounded border border-slate-700 text-left">
                        <div className="flex justify-between text-xs text-slate-400 mb-1"><span>ITEM</span><span>COST</span></div>
                        <div className="flex justify-between font-bold text-white"><span>SigilVar [SBT]</span><span>0.5 USDC</span></div>
                    </div>
                    <div className="w-full">
                        <TransactionButton
                            transaction={() => {
                                if(!account?.address) throw new Error("No wallet");
                                return claimTo({ contract, to: account.address, quantity: BigInt(1) });
                            }}
                            onTransactionConfirmed={handleMintSuccess}
                            onError={(err) => { console.error(err); addLog("Mint Failed. Check Console."); }}
                            unstyled
                            className="w-full py-4 bg-green-600 hover:bg-green-500 text-black font-bold pixel-corners transition-transform active:scale-95 flex items-center justify-center"
                        >
                            MINT PERMIT
                        </TransactionButton>
                        <p className="text-[10px] text-slate-500 mt-2">Check Base Sepolia ETH Balance</p>
                    </div>
                </motion.div>
            )}

            {phase === 'LOBBY' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full h-full flex flex-col z-10">
                    <div className="flex-1 bg-slate-800/50 rounded-lg mb-4 border border-slate-700 flex flex-col items-center justify-center relative overflow-hidden group">
                         <div className="absolute inset-0 bg-green-500/5 group-hover:bg-green-500/10 transition-colors"></div>
                         <div className="text-6xl mb-2 animate-bounce">🥷</div>
                         <div className="text-[10px] text-green-500 font-mono bg-black/50 px-2 py-1 rounded border border-green-900 flex items-center gap-1">
                            <CheckCircle size={10} /> {account?.address?.slice(0,6)}...
                         </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <button onClick={startHunt} className="h-24 bg-red-900/20 border border-red-500/50 hover:bg-red-900/40 rounded flex flex-col items-center justify-center gap-2 group transition-all">
                            <Skull className="text-red-400 group-hover:scale-110 transition-transform" />
                            <span className="text-xs font-bold text-red-200">START HUNT</span>
                        </button>
                        <button className="h-24 bg-slate-800 border border-slate-700 rounded flex flex-col items-center justify-center gap-2 opacity-50 cursor-not-allowed">
                            <ShoppingBag className="text-slate-500" />
                            <span className="text-xs font-bold text-slate-500">STORE</span>
                        </button>
                    </div>
                    <div className="mt-4 flex justify-between px-2 text-xs text-slate-400 font-mono">
                        <span>MEAT: <b className="text-white">{inventory.meat}</b></span>
                        <span>BONE: <b className="text-white">{inventory.bone}</b></span>
                        <span>HIDE: <b className="text-white">{inventory.hide}</b></span>
                    </div>
                </motion.div>
            )}

            {phase === 'HUNTING' && (
                <motion.div className="text-center z-10 space-y-6">
                    <div className="relative w-32 h-32 mx-auto flex items-center justify-center">
                         <div className="absolute inset-0 bg-green-500/20 rounded-full animate-ping"></div>
                         <div className="w-24 h-24 bg-slate-800 rounded-full border-2 border-green-500 flex items-center justify-center z-10">
                            <span className="text-4xl animate-pulse">⚔️</span>
                         </div>
                    </div>
                    <div className="bg-black/40 inline-flex items-center gap-2 px-4 py-2 rounded text-green-400 font-mono text-xl border border-green-900/50">
                        <Clock size={18} /> 00:0{timer}
                    </div>
                    {timer === 0 && <button onClick={claimLoot} disabled={loading} className="w-full py-3 bg-yellow-600 text-white font-bold pixel-corners animate-bounce">{loading ? 'SAVING...' : 'CLAIM REWARDS'}</button>}
                </motion.div>
            )}

            {phase === 'SUMMARY' && (
                <motion.div className="text-center z-10 w-full">
                    <h2 className="text-2xl font-bold text-white mb-6">HUNT COMPLETE</h2>
                    <div className="bg-slate-800 p-4 rounded mb-6 border border-slate-700">
                        <p className="text-xs text-green-500 mb-2 font-mono flex items-center justify-center gap-1">
                            <Database size={10}/> SYNCED TO SUPABASE
                        </p>
                        <div className="space-y-2">
                             {Object.entries(inventory).map(([key, val]) => (val > 0 && <div key={key} className="flex justify-between text-sm px-2 border-b border-slate-700 pb-1"><span className="uppercase text-slate-400">{key}</span><span className="text-white font-bold">{val}</span></div>))}
                        </div>
                    </div>
                    <button onClick={() => setPhase('LOBBY')} className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold pixel-corners">RETURN TO BASE</button>
                </motion.div>
            )}

        </AnimatePresence>
      </main>
      
      {/* LOGS */}
      <div className="h-24 bg-black p-3 font-mono text-[10px] border-t border-slate-800 overflow-hidden flex flex-col justify-end">
         {logs.map((log, i) => <div key={i} className="text-green-500/70 truncate">{log}</div>)}
      </div>
    </div>
  );
}
