import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnet, sepolia } from "viem/chains";
import { collateralVaultAbi } from "./abi/collateralVault.js";
import { lendingPoolAbi } from "./abi/lendingPool.js";
import { config } from "./config.js";

const POLL_INTERVAL_MS = 5_000;

const arcClient = createPublicClient({ chain: arcTestnet, transport: http(config.arcTestnetRpcUrl) });

const relayerAccount = privateKeyToAccount(config.relayerPrivateKey);
const sepoliaPublicClient = createPublicClient({ chain: sepolia, transport: http(config.sepoliaRpcUrl) });
const sepoliaWalletClient = createWalletClient({
  account: relayerAccount,
  chain: sepolia,
  transport: http(config.sepoliaRpcUrl),
});

export const RELAYER_ADDRESS = relayerAccount.address;

/**
 * Polls Arc Testnet for LoanRepaid/LoanDefaulted events on LendingPool and relays the outcome
 * to the CollateralVault on Sepolia (unlockCollateral / seizeCollateral). In-memory
 * last-processed-block tracking only — a real deployment should persist this so a restart
 * doesn't reprocess or skip a range; the vault's onlyRelayer + NotLocked guard makes replays
 * safe (a second unlock/seize call on an already-settled deposit just reverts) but not silent.
 */
export async function startRelayer() {
  let fromBlock = await arcClient.getBlockNumber();
  console.log(`[relayer] watching LendingPool ${config.lendingPoolAddress} on Arc from block ${fromBlock}`);
  console.log(`[relayer] relaying to CollateralVault ${config.collateralVaultAddress} on Sepolia as ${RELAYER_ADDRESS}`);

  while (true) {
    try {
      const latest = await arcClient.getBlockNumber();
      if (latest >= fromBlock) {
        await processRange(fromBlock, latest);
        fromBlock = latest + 1n;
      }
    } catch (err) {
      console.error("[relayer] poll error:", err);
    }
    await sleep(POLL_INTERVAL_MS);
  }
}

async function processRange(fromBlock: bigint, toBlock: bigint) {
  const [repaidLogs, defaultedLogs] = await Promise.all([
    arcClient.getContractEvents({
      address: config.lendingPoolAddress,
      abi: lendingPoolAbi,
      eventName: "LoanRepaid",
      fromBlock,
      toBlock,
    }),
    arcClient.getContractEvents({
      address: config.lendingPoolAddress,
      abi: lendingPoolAbi,
      eventName: "LoanDefaulted",
      fromBlock,
      toBlock,
    }),
  ]);

  for (const log of repaidLogs) {
    const { loanId, borrower } = log.args;
    if (loanId === undefined) continue;
    try {
      const loan = await arcClient.readContract({
        address: config.lendingPoolAddress,
        abi: lendingPoolAbi,
        functionName: "loans",
        args: [loanId],
      });
      const sepoliaDepositId = loan[7];
      console.log(`[relayer] LoanRepaid #${loanId} by ${borrower} -> unlocking deposit ${sepoliaDepositId}`);
      await unlockOnSepolia(sepoliaDepositId);
    } catch (err) {
      console.error(`[relayer] failed to relay repay for loan #${loanId}:`, err);
    }
  }

  for (const log of defaultedLogs) {
    const { loanId, borrower, sepoliaDepositId, treasury } = log.args;
    if (loanId === undefined || sepoliaDepositId === undefined || treasury === undefined) continue;
    try {
      console.log(`[relayer] LoanDefaulted #${loanId} by ${borrower} -> seizing deposit ${sepoliaDepositId} to ${treasury}`);
      await seizeOnSepolia(sepoliaDepositId, treasury);
    } catch (err) {
      console.error(`[relayer] failed to relay default for loan #${loanId}:`, err);
    }
  }
}

async function unlockOnSepolia(depositId: `0x${string}`) {
  const { request } = await sepoliaPublicClient.simulateContract({
    account: relayerAccount,
    address: config.collateralVaultAddress,
    abi: collateralVaultAbi,
    functionName: "unlockCollateral",
    args: [depositId],
  });
  const hash = await sepoliaWalletClient.writeContract(request);
  console.log(`[relayer] unlockCollateral tx: ${hash}`);
}

async function seizeOnSepolia(depositId: `0x${string}`, treasury: `0x${string}`) {
  const { request } = await sepoliaPublicClient.simulateContract({
    account: relayerAccount,
    address: config.collateralVaultAddress,
    abi: collateralVaultAbi,
    functionName: "seizeCollateral",
    args: [depositId, treasury],
  });
  const hash = await sepoliaWalletClient.writeContract(request);
  console.log(`[relayer] seizeCollateral tx: ${hash}`);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Allow running standalone via `npm run relayer`.
if (process.argv[1]?.endsWith("relayer.ts") || process.argv[1]?.endsWith("relayer.js")) {
  startRelayer().catch((err) => {
    console.error("[relayer] fatal error:", err);
    process.exit(1);
  });
}
