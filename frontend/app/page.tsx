import Link from "next/link";

export default function Home() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">NFT-collateralized rent lending on Arc Testnet</h1>
      <p className="text-gray-600">
        Borrowers draw a fixed monthly &quot;rent&quot; loan in USDC ($200-$600), gated by real
        cross-chain wallet activity and an owned Ethereum-mainnet NFT, and collateralized by a
        matching deposit locked on Ethereum Sepolia. Lenders fund a shared pool per tier and earn
        a streaming reward token until borrowers repay.
      </p>
      <div className="flex gap-4">
        <Link href="/lend" className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white">
          Lend
        </Link>
        <Link href="/borrow" className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium">
          Borrow
        </Link>
      </div>
      <div className="rounded-md border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900">
        Testnet only. Loans are USDC on Arc Testnet; collateral is locked on Ethereum Sepolia, not
        real mainnet — see the project README for how eligibility checks relate to your real
        mainnet NFT.
      </div>
    </div>
  );
}
