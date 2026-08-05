"use client";

import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { arcTestnet, sepolia } from "wagmi/chains";

function truncate(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function ConnectButton() {
  const { address, isConnected, chainId } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  if (!isConnected) {
    const injectedConnector = connectors[0];
    return (
      <button
        onClick={() => injectedConnector && connect({ connector: injectedConnector })}
        disabled={isPending}
        className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {isPending ? "Connecting…" : "Connect Wallet"}
      </button>
    );
  }

  const onArc = chainId === arcTestnet.id;
  const onSepolia = chainId === sepolia.id;

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="rounded-full bg-gray-100 px-3 py-1 font-mono">{truncate(address!)}</span>
      <span className={`rounded-full px-3 py-1 ${onArc || onSepolia ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}>
        {onArc ? "Arc Testnet" : onSepolia ? "Sepolia" : `Chain ${chainId}`}
      </span>
      {!onArc && (
        <button onClick={() => switchChain({ chainId: arcTestnet.id })} className="underline">
          Switch to Arc
        </button>
      )}
      {!onSepolia && (
        <button onClick={() => switchChain({ chainId: sepolia.id })} className="underline">
          Switch to Sepolia
        </button>
      )}
      <button onClick={() => disconnect()} className="text-gray-500 underline">
        Disconnect
      </button>
    </div>
  );
}
