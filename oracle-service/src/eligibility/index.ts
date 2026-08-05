import { config } from "../config.js";
import { checkMainnetNft } from "./nft.js";
import { tierAmountUsd } from "./tiers.js";
import { getCrossChainVolumeUsd } from "./volume.js";

export interface EligibilityResult {
  eligible: boolean;
  tierIndex: number;
  tierAmountUsd: number;
  reasons: string[];
  details: {
    volumeUsdTrailing12Months: number;
    nftOwned: boolean;
    nftEstimatedValueUsd: number | null;
    nftHeldDays: number | null;
  };
}

/**
 * Runs the three tier-eligibility checks from the spec against tier `tierIndex`:
 *   1. trailing-12-month cross-chain wallet volume > tier amount
 *   2. owns `nftContract`/`tokenId` on Ethereum mainnet, worth > tier amount, held >= MIN_NFT_HOLD_DAYS
 *   3. (the 15% upfront interest requirement is enforced on-chain by LendingPool.claimLoan, not here)
 */
export async function checkTierEligibility(
  borrower: string,
  tierIndex: number,
  nftContract: string,
  tokenId: string
): Promise<EligibilityResult> {
  const threshold = tierAmountUsd(tierIndex);
  const reasons: string[] = [];

  const [volumeUsd, nft] = await Promise.all([
    getCrossChainVolumeUsd(borrower),
    checkMainnetNft(borrower, nftContract, tokenId),
  ]);

  if (volumeUsd <= threshold) {
    reasons.push(
      `Cross-chain volume $${volumeUsd.toFixed(2)} over the past 12 months does not exceed the $${threshold} tier threshold.`
    );
  }

  if (!nft.owned) {
    reasons.push(`Borrower does not currently own token ${tokenId} on ${nftContract}.`);
  } else {
    if (nft.estimatedValueUsd === null) {
      reasons.push("Could not determine the NFT's estimated USD value (no floor price data available).");
    } else if (nft.estimatedValueUsd <= threshold) {
      reasons.push(
        `NFT's estimated value $${nft.estimatedValueUsd.toFixed(2)} does not exceed the $${threshold} tier threshold.`
      );
    }

    if (nft.heldDays === null) {
      reasons.push("Could not determine how long the borrower has held this NFT (no transfer history found).");
    } else if (nft.heldDays < config.minNftHoldDays) {
      reasons.push(`NFT has been held for ${nft.heldDays} days, below the required ${config.minNftHoldDays} days.`);
    }
  }

  return {
    eligible: reasons.length === 0,
    tierIndex,
    tierAmountUsd: threshold,
    reasons,
    details: {
      volumeUsdTrailing12Months: volumeUsd,
      nftOwned: nft.owned,
      nftEstimatedValueUsd: nft.estimatedValueUsd,
      nftHeldDays: nft.heldDays,
    },
  };
}
