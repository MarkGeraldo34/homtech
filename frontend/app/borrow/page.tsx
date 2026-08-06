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

  // The real Ethereum-mainnet NFT used for the eligibility check (read-only — never locked).
  const [mainnetNftContract, setMainnetNftContract] = useState("");
  const [mainnetTokenId, setMainnetTokenId] = useState("");

  // The Sepolia-testnet NFT actually locked as seizable collateral.
  const [sepoliaNftContract, setSepoliaNftContract] = useState("");
  const [sepoliaTokenId, setSepoliaTokenId] = useState("");

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
      const tokenId = BigInt(sepoliaTokenId || "0");

      const approveHash = await writeContractAsync({
        address: sepoliaNftContract as `0x${string}`,
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
        args: [sepoliaNftContract as `0x${string}`, tokenId, arcLoanRef],
        chainId: sepolia.id,
      });
      await waitForTransactionReceipt(wagmiConfig, { hash: lockHash, chainId: sepolia.id });

      const id = await readContract(wagmiConfig, {
        address: COLLATERAL_VAULT_ADDRESS,
        abi: collateralVaultAbi,
        functionName: "activeDepositOf",
        args: [sepoliaNftContract as `0x${string}`, tokenId],
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
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold mb-2">Borrow</h1>
        <p className="text-muted text-sm">
          Borrow up to a tier&apos;s worth of USDC as a 30-day loan, gated by real cross-chain
          wallet activity and an Ethereum-mainnet NFT you own, and collateralized by a matching
          NFT locked on Ethereum Sepolia.
        </p>
      </div>

      {!isConnected ? (
        <p className="text-sm text-muted">Connect your wallet to borrow.</p>
      ) : hasActiveLoan && loan ? (
        <div className="space-y-4 rounded-lg border border-border bg-surface p-4">
          <h2 className="font-medium">Active loan #{activeLoanId?.toString()}</h2>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-muted">Tier</dt>
              <dd>{TIER_LABELS[loan[1]]}</dd>
            </div>
            <div>
              <dt className="text-muted">Principal</dt>
              <dd className="font-mono">{formatUnits(loan[2], 6)} USDC</dd>
            </div>
            <div>
              <dt className="text-muted">Due</dt>
              <dd>{new Date(Number(loan[4]) * 1000).toLocaleString()}</dd>
            </div>
          </dl>
          <button
            onClick={repayLoan}
            disabled={isPending}
            className="rounded-md bg-gradient-to-r from-accent to-accent-2 px-4 py-2 text-sm text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            Repay {formatUnits(loan[2], 6)} USDC
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="rounded-lg border border-border bg-surface p-4">
            <h2 className="font-medium mb-2">1. Choose a tier</h2>
            <TierPicker value={tier} onChange={setTier} />
          </div>

          <div className="rounded-lg border border-border bg-surface p-4">
            <h2 className="font-medium mb-2">2. Your Ethereum mainnet NFT (eligibility)</h2>
            <p className="text-xs text-muted mb-2">
              Read only — never locked. Must be worth more than {TIER_LABELS[tier]} and held 6+
              months.
            </p>
            <div className="flex gap-2">
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
                className="w-32 rounded-md border border-border bg-background px-3 py-2 text-sm font-mono focus:border-accent"
              />
            </div>
            <button
              onClick={checkEligibility}
              disabled={eligibilityLoading || !mainnetNftContract || !mainnetTokenId}
              className="mt-2 rounded-md border border-border px-4 py-2 text-sm transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
            >
              {eligibilityLoading ? "Checking…" : "Check eligibility"}
            </button>
            {eligibilityError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{eligibilityError}</p>}
            {eligibility && (
              <div
                className={`mt-2 rounded-md border p-3 text-sm ${
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

          <div className="rounded-lg border border-border bg-surface p-4">
            <h2 className="font-medium mb-2">3. Lock collateral on Sepolia</h2>
            <p className="text-xs text-muted mb-2">
              An NFT you own on Ethereum Sepolia — this is what actually gets locked and, if you
              default, seized.
            </p>
            <div className="flex gap-2">
              <input
                value={sepoliaNftContract}
                onChange={(e) => setSepoliaNftContract(e.target.value)}
                placeholder="Sepolia NFT contract address (0x…)"
                className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm font-mono focus:border-accent"
              />
              <input
                value={sepoliaTokenId}
                onChange={(e) => setSepoliaTokenId(e.target.value)}
                placeholder="Token ID"
                className="w-32 rounded-md border border-border bg-background px-3 py-2 text-sm font-mono focus:border-accent"
              />
            </div>
            <button
              onClick={lockCollateral}
              disabled={!eligibility?.eligible || locking || !sepoliaNftContract || !sepoliaTokenId}
              className="mt-2 rounded-md border border-border px-4 py-2 text-sm transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
            >
              {locking ? "Approving + locking…" : "Approve + Lock NFT"}
            </button>
            {lockError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{lockError}</p>}
            {depositId && (
              <p className="mt-2 text-sm text-green-600 dark:text-green-400 font-mono break-all">Locked. depositId: {depositId}</p>
            )}
          </div>

          <div className="rounded-lg border border-border bg-surface p-4">
            <h2 className="font-medium mb-2">4. Get attestation + claim loan</h2>
            <button
              onClick={requestAttestation}
              disabled={!depositId || attestationLoading}
              className="rounded-md border border-border px-4 py-2 text-sm transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
            >
              {attestationLoading ? "Requesting…" : "Request attestation"}
            </button>
            {attestationResult && !attestationResult.eligible && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">{attestationResult.error || attestationResult.reasons?.join("; ")}</p>
            )}
            {attestationResult?.attestation && (
              <button
                onClick={claimLoan}
                disabled={isPending}
                className="mt-2 ml-2 rounded-md bg-gradient-to-r from-accent to-accent-2 px-4 py-2 text-sm text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                Pay 15% interest + claim {TIER_LABELS[tier]}
              </button>
            )}
          </div>

          {isConfirmed && <p className="text-sm text-green-600 dark:text-green-400">Last transaction confirmed.</p>}
          {writeError && <p className="text-sm text-red-600 dark:text-red-400">{writeError.message}</p>}
        </div>
      )}
    </div>
  );
}
