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
        className="shrink-0 whitespace-nowrap rounded-md bg-gradient-to-r from-accent to-accent-2 px-3 sm:px-4 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? "Connecting…" : (
          <>
            <span className="sm:hidden">Connect</span>
            <span className="hidden sm:inline">Connect Wallet</span>
          </>
        )}
      </button>
    );
  }

  const onArc = chainId === arcTestnet.id;
  const onSepolia = chainId === sepolia.id;

  return (
    <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1 text-sm max-w-[60vw] sm:max-w-none">
      <span className="rounded-full border border-border bg-surface px-3 py-1 font-mono whitespace-nowrap">{truncate(address!)}</span>
      <span
        className={`rounded-full px-3 py-1 whitespace-nowrap ${
          onArc || onSepolia
            ? "bg-green-500/10 text-green-600 dark:text-green-400"
            : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
        }`}
      >
        {onArc ? "Arc Testnet" : onSepolia ? "Sepolia" : `Chain ${chainId}`}
      </span>
      {!onArc && (
        <button onClick={() => switchChain({ chainId: arcTestnet.id })} className="whitespace-nowrap text-accent underline underline-offset-2 hover:opacity-80">
          Switch to Arc
        </button>
      )}
      {!onSepolia && (
        <button onClick={() => switchChain({ chainId: sepolia.id })} className="whitespace-nowrap text-accent underline underline-offset-2 hover:opacity-80">
          Switch to Sepolia
        </button>
      )}
      <button onClick={() => disconnect()} className="whitespace-nowrap text-muted underline underline-offset-2 hover:opacity-80">
        Disconnect
      </button>
    </div>
  );
}
