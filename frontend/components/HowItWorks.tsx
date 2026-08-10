function Icon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d={path} />
    </svg>
  );
}

const ICONS = {
  wallet: "M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7ZM16 12h2",
  tag: "M5 6v6c0 1.66 3.13 3 7 3s7-1.34 7-3V6M5 12v6c0 1.66 3.13 3 7 3s7-1.34 7-3v-6M5 6c0 1.66 3.13 3 7 3s7-1.34 7-3-3.13-3-7-3-7 1.34-7 3Z",
  shield: "M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3ZM9 12l2 2 4-4",
  house: "M4 11 12 4l8 7M6 9.5V20h12V9.5",
  deposit: "M12 3v10m0 0-3-3m3 3 3-3M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4",
  trending: "M3 17l6-6 4 4 8-8M15 7h6v6",
} as const;

const BORROW_STEPS = [
  { icon: ICONS.wallet, title: "Connect your wallet", body: "Link your wallet to Arc Testnet to get started." },
  { icon: ICONS.tag, title: "Pick a tier", body: "Choose a loan size from $200 to $600." },
  { icon: ICONS.shield, title: "Verify & lock collateral", body: "Confirm your Ethereum-mainnet NFT, then lock that same NFT as collateral." },
  { icon: ICONS.house, title: "Claim your loan", body: "Pay 15% interest and receive your USDC — repay within 30 days." },
];

const LEND_STEPS = [
  { icon: ICONS.wallet, title: "Connect your wallet", body: "Link your wallet to Arc Testnet to get started." },
  { icon: ICONS.deposit, title: "Deposit into a pool", body: "Add USDC to a tier's shared lending pool." },
  { icon: ICONS.trending, title: "Earn rewards", body: "Collect streaming RENT tokens for as long as loans in that tier are outstanding." },
];

interface Step {
  icon: string;
  title: string;
  body: string;
}

function StepList({ steps, accentClass, bgClass }: { steps: Step[]; accentClass: string; bgClass: string }) {
  return (
    <ol className="space-y-3">
      {steps.map((step, i) => (
        <li
          key={step.title}
          className={`animate-fade-up surface-card surface-card--hover flex gap-4 p-4 ${i > 0 ? `fade-delay-${i}` : ""}`}
        >
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${bgClass} ${accentClass}`}>
            <Icon path={step.icon} />
          </span>
          <div className="pt-0.5">
            <p className="text-sm font-medium">
              <span className="text-muted">{i + 1}.</span> {step.title}
            </p>
            <p className="mt-0.5 text-sm text-muted leading-relaxed">{step.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function HowItWorks() {
  return (
    <section className="space-y-8">
      <div className="animate-fade-up space-y-2 text-center">
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">How HomTech works</h2>
        <p className="text-muted text-sm max-w-md mx-auto">
          Two sides of the same pool &mdash; borrowers get fast USDC, lenders earn while it&apos;s out.
        </p>
      </div>
      <div className="grid gap-8 sm:grid-cols-2">
        <div>
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Borrowing
          </h3>
          <StepList steps={BORROW_STEPS} accentClass="text-accent" bgClass="bg-accent/10" />
        </div>
        <div>
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-accent-2">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-2" />
            Lending
          </h3>
          <StepList steps={LEND_STEPS} accentClass="text-accent-2" bgClass="bg-accent-2/10" />
        </div>
      </div>
    </section>
  );
}
