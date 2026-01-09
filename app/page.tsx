import VarsynInterface from "./components/VarsynInterface";
// 1. Kita import Provider-nya dari Thirdweb
import { ThirdwebProvider } from "thirdweb/react"; 

export default function Home() {
  return (
    // 2. Kita BUNGKUS seluruh aplikasi dengan Provider ini
    <ThirdwebProvider>
      <main className="flex min-h-screen flex-col items-center justify-center p-4 md:p-24 bg-slate-950">
        <VarsynInterface />
        
        <div className="mt-8 text-center text-slate-600 text-xs font-mono">
          <p>VARSYN PROTOTYPE v0.1</p>
          <p>Running on Base Sepolia • Farcaster Ready</p>
        </div>
      </main>
    </ThirdwebProvider>
  );
}