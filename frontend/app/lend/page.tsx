"use client";

import { useState } from "react";
import { formatUnits, parseUnits } from "viem";
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { arcTestnet } from "wagmi/chains";
import { TierPicker } from "@/components/TierPicker";
import { erc20Abi } from "@/lib/abi/erc20";
import { lendingPoolAbi } from "@/lib/abi/lendingPool";
import { LENDING_POOL_ADDRESS, TIER_LABELS, USDC_ADDRESS } from "@/lib/contracts";

const USDC_DECIMALS = 6;

export default function LendPage() {
  const { address, isConnected } = useAccount();
  const [tier, setTier] = useState(0);
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");

  const { writeContract, data: txHash, isPending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash });

  const commonRead = { chainId: arcTestnet.id, query: { enabled: isConnected } } as const;

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, LENDING_POOL_ADDRESS] : undefined,
    ...commonRead,
  });

  const { data: lenderInfo, refetch: refetchLenderInfo } = useReadContract({
    address: LENDING_POOL_ADDRESS,
    abi: lendingPoolAbi,
    functionName: "lenderInfo",
    args: address ? [tier, address] : undefined,
    ...commonRead,
  });

  const { data: pendingRewards, refetch: refetchPendingRewards } = useReadContract({
    address: LENDING_POOL_ADDRESS,
    abi: lendingPoolAbi,
    functionName: "pendingRewards",
    args: address ? [tier, address] : undefined,
    chainId: arcTestnet.id,
    query: { enabled: isConnected, refetchInterval: 3000 },
  });

  const { data: idleLiquidity } = useReadContract({
    address: LENDING_POOL_ADDRESS,
    abi: lendingPoolAbi,
    functionName: "idleLiquidity",
    args: [tier],
    chainId: arcTestnet.id,
    query: { refetchInterval: 5000 },
  });

  const deposited = lenderInfo?.[0] ?? 0n;
  const pending = pendingRewards ?? 0n;
  const needsApproval = depositAmount && allowance !== undefined ? parseUnits(depositAmount || "0", USDC_DECIMALS) > allowance : false;

  function refetchAll() {
    refetchAllowance();
    refetchLenderInfo();
    refetchPendingRewards();
  }

  function approve() {
    writeContract(
      {
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: "approve",
        args: [LENDING_POOL_ADDRESS, parseUnits(depositAmount || "0", USDC_DECIMALS)],
        chainId: arcTestnet.id,
      },
      { onSuccess: () => setTimeout(refetchAll, 2000) }
    );
  }

  function deposit() {
    writeContract(
      {
        address: LENDING_POOL_ADDRESS,
        abi: lendingPoolAbi,
        functionName: "deposit",
        args: [tier, parseUnits(depositAmount || "0", USDC_DECIMALS)],
        chainId: arcTestnet.id,
      },
      { onSuccess: () => setTimeout(refetchAll, 2000) }
    );
  }

  function withdraw() {
    writeContract(
      {
        address: LENDING_POOL_ADDRESS,
        abi: lendingPoolAbi,
        functionName: "withdraw",
        args: [tier, parseUnits(withdrawAmount || "0", USDC_DECIMALS)],
        chainId: arcTestnet.id,
      },
      { onSuccess: () => setTimeout(refetchAll, 2000) }
    );
  }

  function claimRewards() {
    writeContract(
      {
        address: LENDING_POOL_ADDRESS,
        abi: lendingPoolAbi,
        functionName: "claimRewards",
        args: [tier],
        chainId: arcTestnet.id,
      },
      { onSuccess: () => setTimeout(refetchAll, 2000) }
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold mb-2">Lend</h1>
        <p className="text-muted text-sm">
          Deposit USDC into a tier pool. Your share earns RENT tokens for every day a loan in that
          tier is outstanding, streaming continuously until it&apos;s repaid.
        </p>
      </div>

      <TierPicker value={tier} onChange={setTier} />

      {!isConnected ? (
        <p className="text-sm text-muted">Connect your wallet on Arc Testnet to lend.</p>
      ) : (
        <div className="space-y-6">
          <dl className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-surface p-4 text-sm">
            <div>
              <dt className="text-muted">Your deposit ({TIER_LABELS[tier]} pool)</dt>
              <dd className="font-mono">{formatUnits(deposited, USDC_DECIMALS)} USDC</dd>
            </div>
            <div>
              <dt className="text-muted">Pending rewards</dt>
              <dd className="font-mono">{Number(formatUnits(pending, 18)).toFixed(4)} RENT</dd>
            </div>
            <div>
              <dt className="text-muted">Idle pool liquidity</dt>
              <dd className="font-mono">{formatUnits(idleLiquidity ?? 0n, USDC_DECIMALS)} USDC</dd>
            </div>
          </dl>

          <div className="space-y-2">
            <label className="text-sm font-medium">Deposit amount (USDC)</label>
            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-accent"
                placeholder="0.00"
              />
              {needsApproval ? (
                <button
                  onClick={approve}
                  disabled={isPending}
                  className="rounded-md bg-gradient-to-r from-accent to-accent-2 px-4 py-2 text-sm text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  Approve
                </button>
              ) : (
                <button
                  onClick={deposit}
                  disabled={isPending || !depositAmount}
                  className="rounded-md bg-gradient-to-r from-accent to-accent-2 px-4 py-2 text-sm text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  Deposit
                </button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Withdraw amount (USDC, idle liquidity only)</label>
            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-accent"
                placeholder="0.00"
              />
              <button
                onClick={withdraw}
                disabled={isPending || !withdrawAmount}
                className="rounded-md border border-border px-4 py-2 text-sm transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
              >
                Withdraw
              </button>
            </div>
          </div>

          <button
            onClick={claimRewards}
            disabled={isPending || pending === 0n}
            className="rounded-md border border-border px-4 py-2 text-sm transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
          >
            Claim {Number(formatUnits(pending, 18)).toFixed(4)} RENT
          </button>

          {isPending && <p className="text-sm text-muted">Confirm in wallet…</p>}
          {isConfirming && <p className="text-sm text-muted">Waiting for confirmation…</p>}
          {isConfirmed && <p className="text-sm text-green-600 dark:text-green-400">Confirmed.</p>}
          {writeError && <p className="text-sm text-red-600 dark:text-red-400">{writeError.message}</p>}
        </div>
      )}
    </div>
  );
}
