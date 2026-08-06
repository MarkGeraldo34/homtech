import Link from "next/link";

export default function Home() {
  return (
    <div className="space-y-6">
      <span className="inline-block rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
        Arc Testnet
      </span>
      <h1 className="text-3xl font-semibold tracking-tight">
        NFT-collateralized <span className="text-accent">house</span>{" "}
        <span className="bg-gradient-to-r from-accent to-accent-2 bg-clip-text text-transparent">
          rent lending
        </span>
      </h1>
      <p className="text-muted">
        Borrowers draw a fixed monthly &quot;rent&quot; loan in USDC ($200-$600), gated by real
        cross-chain wallet activity and an owned Ethereum-mainnet NFT, and collateralized by a
        matching deposit locked on Ethereum Sepolia. Lenders fund a shared pool per tier and earn
        a streaming reward token until borrowers repay.
      </p>
      <div className="flex gap-4">
        <Link
          href="/lend"
          className="rounded-md bg-gradient-to-r from-accent to-accent-2 px-4 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90"
        >
          Lend
        </Link>
        <Link
          href="/borrow"
          className="rounded-md border border-border px-4 py-2 text-sm font-medium transition-colors hover:border-accent hover:text-accent"
        >
          Borrow
        </Link>
      </div>
    </div>
  );
}
