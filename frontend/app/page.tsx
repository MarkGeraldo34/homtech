import Link from "next/link";
import { HowItWorks } from "@/components/HowItWorks";

const FACTS = [
  { label: "Loan sizes", value: "$200–$600" },
  { label: "Interest", value: "15%" },
  { label: "Term", value: "30 days" },
  { label: "Collateral", value: "Your NFT" },
];

export default function Home() {
  return (
    <div className="space-y-20 sm:space-y-24">
      <section className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div className="animate-fade-up space-y-6">
          <span className="eyebrow">
            <span className="eyebrow-dot" />
            Live on Arc Testnet
          </span>
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.08]">
            NFT-collateralized <span className="text-accent">house</span>{" "}
            <span className="bg-gradient-to-r from-accent to-accent-2 bg-clip-text text-transparent">
              rent lending
            </span>
          </h1>
          <p className="text-muted text-base sm:text-lg leading-relaxed max-w-xl">
            Borrowers draw a fixed monthly USDC loan ($200&ndash;$600), gated by cross-chain wallet
            activity and a locked Ethereum-mainnet NFT. Lenders fund per-tier pools and earn
            streaming <span className="font-medium text-foreground">$RENT</span> rewards until
            loans are repaid.
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <Link href="/lend" className="btn-primary">
              Start lending
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </Link>
            <Link href="/borrow" className="btn-secondary">
              Borrow now
            </Link>
          </div>
        </div>

        <div className="animate-fade-up grid grid-cols-2 gap-3 sm:gap-4" style={{ animationDelay: "0.1s" }}>
          {FACTS.map((fact) => (
            <div key={fact.label} className="surface-card surface-card--hover p-5">
              <p className="text-2xl sm:text-3xl font-semibold bg-gradient-to-r from-accent to-accent-2 bg-clip-text text-transparent">
                {fact.value}
              </p>
              <p className="mt-1 text-xs text-muted">{fact.label}</p>
            </div>
          ))}
        </div>
      </section>

      <HowItWorks />

      <section className="surface-card p-8 sm:p-10 text-center space-y-4 bg-gradient-to-br from-accent/5 to-accent-2/5">
        <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">Ready to get started?</h2>
        <p className="text-muted text-sm max-w-md mx-auto">
          Connect a wallet on Arc Testnet to deposit into a pool or draw your first loan.
        </p>
        <div className="flex flex-wrap justify-center gap-3 pt-1">
          <Link href="/lend" className="btn-primary">
            Lend USDC
          </Link>
          <Link href="/borrow" className="btn-secondary">
            Borrow against your NFT
          </Link>
        </div>
      </section>
    </div>
  );
}
