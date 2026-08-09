"use client";

import { useState } from "react";
import { formatUnits } from "viem";
import { readContract, waitForTransactionReceipt } from "wagmi/actions";
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { arcTestnet, sepolia } from "wagmi/chains";
import { TierPicker } from "@/components/TierPicker";
import { collateralVaultAbi } from "@/lib/abi/collateralVault";
import { erc721Abi } from "@/lib/abi/erc721";
import { lendingPoolAbi } from "@/lib/abi/lendingPool";
import { COLLATERAL_VAULT_ADDRESS, LENDING_POOL_ADDRESS, ORACLE_SERVICE_URL, TIER_LABELS } from "@/lib/contracts";
import { wagmiConfig } from "@/lib/wagmi-config";

interface EligibilityResult {
  eligible: boolean;
  reasons: string[];
}

interface AttestationResponse {
  eligible: boolean;
  attestation?: {
    borrower: `0x${string}`;
    tierIndex: number;
    nftContract: `0x${string}`;
    tokenId: string;
    sepoliaDepositId: `0x${string}`;
    nonce: string;
    expiry: string;
  };
  signature?: `0x${string}`;
  reasons?: string[];
  error?: string;
}

export default function BorrowPage() {
  const { address, isConnected } = useAccount();
  const [tier, setTier] = useState(0);

  // The borrower's real Ethereum-mainnet NFT — checked for eligibility, then locked as the
  // actual seizable collateral in CollateralVault (Ethereum Sepolia for now, while Arc itself
  // is still testnet; mainnet after that and an audit).
  const [mainnetNftContract, setMainnetNftContract] = useState("");
  const [mainnetTokenId, setMainnetTokenId] = useState("");

  const [eligibility, setEligibility] = useState<EligibilityResult | null>(null);
  const [eligibilityLoading, setEligibilityLoading] = useState(false);
  const [eligibilityError, setEligibilityError] = useState<string | null>(null);

  const [locking, setLocking] = useState(false);
  const [lockError, setLockError] = useState<string | null>(null);
  const [depositId, setDepositId] = useState<`0x${string}` | null>(null);

  const [attestationResult, setAttestationResult] = useState<AttestationResponse | null>(null);
  const [attestationLoading, setAttestationLoading] = useState(false);

  const { writeContract, writeContractAsync, data: txHash, isPending, error: writeError } = useWriteContract();
  const { isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash });

  const { data: activeLoanId, refetch: refetchActiveLoanId } = useReadContract({
    address: LENDING_POOL_ADDRESS,
    abi: lendingPoolAbi,
    functionName: "activeLoanOf",
    args: address ? [address] : undefined,
    chainId: arcTestnet.id,
    query: { enabled: isConnected, refetchInterval: 5000 },
  });

  const { data: loan } = useReadContract({
    address: LENDING_POOL_ADDRESS,
    abi: lendingPoolAbi,
    functionName: "loans",
    args: activeLoanId ? [activeLoanId] : undefined,
    chainId: arcTestnet.id,
    query: { enabled: !!activeLoanId && activeLoanId > 0n },
  });

  async function checkEligibility() {
    setEligibilityError(null);
    setEligibilityLoading(true);
    setEligibility(null);
    try {
      const res = await fetch(`${ORACLE_SERVICE_URL}/api/eligibility`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          borrower: address,
          tierIndex: tier,
          nftContract: mainnetNftContract,
          tokenId: mainnetTokenId,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Eligibility check failed");
      setEligibility(json);
    } catch (err) {
      setEligibilityError((err as Error).message);
    } finally {
      setEligibilityLoading(false);
    }
  }

  async function lockCollateral() {
    setLockError(null);
    setLocking(true);
    try {
      const tokenId = BigInt(mainnetTokenId || "0");

      const approveHash = await writeContractAsync({
        address: mainnetNftContract as `0x${string}`,
        abi: erc721Abi,
        functionName: "approve",
        args: [COLLATERAL_VAULT_ADDRESS, tokenId],
        chainId: sepolia.id,
      });
      await waitForTransactionReceipt(wagmiConfig, { hash: approveHash, chainId: sepolia.id });

      const arcLoanRef = `0x${(address ?? "0x").slice(2).padStart(64, "0")}` as `0x${string}`;
      const lockHash = await writeContractAsync({
        address: COLLATERAL_VAULT_ADDRESS,
        abi: collateralVaultAbi,
        functionName: "lockCollateral",
        args: [mainnetNftContract as `0x${string}`, tokenId, arcLoanRef],
        chainId: sepolia.id,
      });
      await waitForTransactionReceipt(wagmiConfig, { hash: lockHash, chainId: sepolia.id });

      const id = await readContract(wagmiConfig, {
        address: COLLATERAL_VAULT_ADDRESS,
        abi: collateralVaultAbi,
        functionName: "activeDepositOf",
        args: [mainnetNftContract as `0x${string}`, tokenId],
        chainId: sepolia.id,
      });
      setDepositId(id as `0x${string}`);
    } catch (err) {
      setLockError((err as Error).message);
    } finally {
      setLocking(false);
    }
  }

  async function requestAttestation() {
    if (!depositId) return;
    setAttestationLoading(true);
    setAttestationResult(null);
    try {
      const res = await fetch(`${ORACLE_SERVICE_URL}/api/attestation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          borrower: address,
          tierIndex: tier,
          nftContract: mainnetNftContract,
          tokenId: mainnetTokenId,
          sepoliaDepositId: depositId,
        }),
      });
      const json = await res.json();
      setAttestationResult(json);
    } catch (err) {
      setAttestationResult({ eligible: false, error: (err as Error).message });
    } finally {
      setAttestationLoading(false);
    }
  }

  function claimLoan() {
    if (!attestationResult?.attestation || !attestationResult.signature) return;
    const att = attestationResult.attestation;
    writeContract({
      address: LENDING_POOL_ADDRESS,
      abi: lendingPoolAbi,
      functionName: "claimLoan",
      args: [
        {
          borrower: att.borrower,
          tierIndex: att.tierIndex,
          nftContract: att.nftContract,
          tokenId: BigInt(att.tokenId),
          sepoliaDepositId: att.sepoliaDepositId,
          nonce: BigInt(att.nonce),
          expiry: BigInt(att.expiry),
        },
        attestationResult.signature,
      ],
      chainId: arcTestnet.id,
    });
  }

  function repayLoan() {
    if (!activeLoanId) return;
    writeContract(
      {
        address: LENDING_POOL_ADDRESS,
        abi: lendingPoolAbi,
        functionName: "repayLoan",
        args: [activeLoanId],
        chainId: arcTestnet.id,
      },
      { onSuccess: () => setTimeout(refetchActiveLoanId, 2000) }
    );
  }

  const hasActiveLoan = !!activeLoanId && activeLoanId > 0n;

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="space-y-2">
        <span className="eyebrow">
          <span className="eyebrow-dot" />
          Borrower
        </span>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Borrow</h1>
        <p className="text-muted text-sm leading-relaxed">
          Borrow up to a tier&apos;s worth of USDC as a 30-day loan, gated by real cross-chain
          wallet activity and an Ethereum-mainnet NFT you own — that same NFT is locked as
          collateral on Ethereum Sepolia for now, the same way it will on mainnet once Arc itself
          is out of testnet.
        </p>
      </div>

      {!isConnected ? (
        <div className="surface-card p-6 text-center text-sm text-muted">Connect your wallet to borrow.</div>
      ) : hasActiveLoan && loan ? (
        <div className="surface-card space-y-4 p-5">
          <h2 className="font-medium">Active loan #{activeLoanId?.toString()}</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div className="rounded-lg border border-border p-3">
              <dt className="text-xs text-muted">Tier</dt>
              <dd className="mt-1 font-medium">{TIER_LABELS[loan[1]]}</dd>
            </div>
            <div className="rounded-lg border border-border p-3">
              <dt className="text-xs text-muted">Principal</dt>
              <dd className="mt-1 font-mono">{formatUnits(loan[2], 6)} USDC</dd>
            </div>
            <div className="rounded-lg border border-border p-3">
              <dt className="text-xs text-muted">Due</dt>
              <dd className="mt-1">{new Date(Number(loan[4]) * 1000).toLocaleString()}</dd>
            </div>
          </dl>
          <button onClick={repayLoan} disabled={isPending} className="btn-primary">
            Repay {formatUnits(loan[2], 6)} USDC
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="surface-card p-5">
            <StepHeader n={1} title="Choose a tier" />
            <TierPicker value={tier} onChange={setTier} />
          </div>

          <div className="surface-card p-5">
            <StepHeader n={2} title="Your Ethereum mainnet NFT" />
            <p className="text-xs text-muted mb-3 leading-relaxed">
              This is the NFT that backs the loan — it must be worth more than {TIER_LABELS[tier]}
              now, and its collection&apos;s floor price must not have dropped to or below that
              amount at any point in the last 6 months. No minimum hold duration on the token
              itself. Once eligible, it&apos;s the same NFT you&apos;ll lock as collateral below.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={mainnetNftContract}
                onChange={(e) => setMainnetNftContract(e.target.value)}
                placeholder="NFT contract address (0x…)"
                className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm font-mono focus:border-accent"
              />
              <input
                value={mainnetTokenId}
                onChange={(e) => setMainnetTokenId(e.target.value)}
                placeholder="Token ID"
                className="sm:w-32 rounded-md border border-border bg-background px-3 py-2 text-sm font-mono focus:border-accent"
              />
            </div>
            <button
              onClick={checkEligibility}
              disabled={eligibilityLoading || !mainnetNftContract || !mainnetTokenId}
              className="btn-secondary mt-3"
            >
              {eligibilityLoading ? "Checking…" : "Check eligibility"}
            </button>
            {eligibilityError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{eligibilityError}</p>}
            {eligibility && (
              <div
                className={`mt-3 rounded-md border p-3 text-sm ${
                  eligibility.eligible
                    ? "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400"
                    : "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400"
                }`}
              >
                <p className="font-medium">{eligibility.eligible ? "Eligible" : "Not eligible"}</p>
                {eligibility.reasons.length > 0 && (
                  <ul className="mt-1 list-disc pl-4">
                    {eligibility.reasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <div className="surface-card p-5">
            <StepHeader n={3} title="Lock it as collateral" />
            <p className="text-xs text-muted mb-3 leading-relaxed">
              Transfers token #{mainnetTokenId || "…"} on {mainnetNftContract || "the contract above"} into
              HomTech&apos;s vault on Ethereum Sepolia (staging ahead of mainnet). If you default,
              it&apos;s seized.
            </p>
            <button
              onClick={lockCollateral}
              disabled={!eligibility?.eligible || locking}
              className="btn-secondary"
            >
              {locking ? "Approving + locking…" : "Approve + Lock NFT"}
            </button>
            {lockError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{lockError}</p>}
            {depositId && (
              <p className="mt-2 text-sm text-green-600 dark:text-green-400 font-mono break-all">Locked. depositId: {depositId}</p>
            )}
          </div>

          <div className="surface-card p-5">
            <StepHeader n={4} title="Get attestation + claim loan" />
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={requestAttestation}
                disabled={!depositId || attestationLoading}
                className="btn-secondary"
              >
                {attestationLoading ? "Requesting…" : "Request attestation"}
              </button>
              {attestationResult?.attestation && (
                <button onClick={claimLoan} disabled={isPending} className="btn-primary">
                  Pay 15% interest + claim {TIER_LABELS[tier]}
                </button>
              )}
            </div>
            {attestationResult && !attestationResult.eligible && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">{attestationResult.error || attestationResult.reasons?.join("; ")}</p>
            )}
          </div>

          <div className="space-y-1 text-sm">
            {isConfirmed && <p className="text-green-600 dark:text-green-400">Last transaction confirmed.</p>}
            {writeError && <p className="text-red-600 dark:text-red-400">{writeError.message}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function StepHeader({ n, title }: { n: number; title: string }) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-accent to-accent-2 text-xs font-semibold text-white">
        {n}
      </span>
      <h2 className="font-medium">{title}</h2>
    </div>
  );
}
