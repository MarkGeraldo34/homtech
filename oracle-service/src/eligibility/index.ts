import { checkMainnetNft, NFT_VALUE_LOOKBACK_DAYS } from "./nft.js";
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
    nftSustainedMinValueUsd: number | null;
    nftSustainedValueCoveredDays: number | null;
  };
}

/**
 * Runs the three tier-eligibility checks from the spec against tier `tierIndex`:
 *   1. trailing-12-month cross-chain wallet volume > tier amount
 *   2. owns `nftContract`/`tokenId` on Ethereum mainnet, currently worth > tier amount, and its
 *      collection floor value has stayed above the tier amount for the trailing
 *      NFT_VALUE_LOOKBACK_DAYS (no minimum hold duration on the token itself)
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
      reasons.push("Could not determine the NFT's current estimated USD value (no floor price data available).");
    } else if (nft.estimatedValueUsd <= threshold) {
      reasons.push(
        `NFT's current estimated value $${nft.estimatedValueUsd.toFixed(2)} does not exceed the $${threshold} tier threshold.`
      );
    }

    if (nft.sustainedMinValueUsd === null || nft.sustainedValueCoveredDays === null) {
      reasons.push(
        `Could not determine the NFT collection's floor-price history for the trailing ${NFT_VALUE_LOOKBACK_DAYS} days (no data available).`
      );
    } else if (nft.sustainedValueCoveredDays < NFT_VALUE_LOOKBACK_DAYS) {
      reasons.push(
        `Only ${nft.sustainedValueCoveredDays} days of floor-price history are available, below the required ${NFT_VALUE_LOOKBACK_DAYS} days.`
      );
    } else if (nft.sustainedMinValueUsd <= threshold) {
      reasons.push(
        `NFT collection's floor value dropped to $${nft.sustainedMinValueUsd.toFixed(2)} at some point in the last ${NFT_VALUE_LOOKBACK_DAYS} days, which does not exceed the $${threshold} tier threshold.`
      );
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
      nftSustainedMinValueUsd: nft.sustainedMinValueUsd,
      nftSustainedValueCoveredDays: nft.sustainedValueCoveredDays,
    },
  };
}
