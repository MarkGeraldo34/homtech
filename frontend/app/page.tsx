import Link from "next/link";
import { HowItWorks } from "@/components/HowItWorks";

const FACTS = [
  { label: "Loan sizes", value: "$200–$600", icon: "loan" },
  { label: "Interest", value: "15%", icon: "interest" },
  { label: "Term", value: "30 days", icon: "term" },
  { label: "Collateral", value: "Your NFT", icon: "collateral" },
] as const;

function FactIcon({ name }: { name: (typeof FACTS)[number]["icon"] }) {
  const props = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "h-5 w-5",
  };
  switch (name) {
    case "loan":
      return (
        <svg {...props}>
          <path d="M12 2v20M8.5 6H15a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h7" />
        </svg>
      );
    case "interest":
      return (
        <svg {...props}>
          <path d="M6 18 18 6" />
          <circle cx="7.5" cy="7.5" r="2" />
          <circle cx="16.5" cy="16.5" r="2" />
        </svg>
      );
    case "term":
      return (
        <svg {...props}>
          <path d="M3.5 9h17M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
          <path d="M8 3v4M16 3v4" />
        </svg>
      );
    case "collateral":
      return (
        <svg {...props}>
          <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3ZM9 12l2 2 4-4" />
        </svg>
      );
  }
}

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

        <div className="animate-fade-up fade-delay-1 grid grid-cols-2 gap-3 sm:gap-4">
          {FACTS.map((fact, i) => (
            <div key={fact.label} className="surface-card surface-card--hover p-5">
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-full ${
                  i % 2 === 0 ? "bg-accent/10 text-accent" : "bg-accent-2/10 text-accent-2"
                }`}
              >
                <FactIcon name={fact.icon} />
              </span>
              <p className="mt-3 whitespace-nowrap text-xl sm:text-2xl font-bold leading-tight tracking-tight bg-gradient-to-r from-accent to-accent-2 bg-clip-text text-transparent">
                {fact.value}
              </p>
              <p className="mt-1 text-xs text-muted">{fact.label}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="animate-fade-up fade-delay-2">
        <HowItWorks />
      </div>

      <section className="animate-fade-up fade-delay-3 surface-card p-8 sm:p-10 text-center space-y-4 bg-gradient-to-br from-accent/5 to-accent-2/5">
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
