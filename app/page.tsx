import VarsynInterface from "./components/VarsynInterface";
import { ThirdwebProvider } from "thirdweb/react";

export default function Home() {
  return (
    <ThirdwebProvider>
      <VarsynInterface />
    </ThirdwebProvider>
  );
}