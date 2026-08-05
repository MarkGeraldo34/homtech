import { Alchemy, AssetTransfersCategory, Network, SortingOrder } from "alchemy-sdk";
import { config } from "../config.js";

const alchemy = new Alchemy({
  apiKey: config.alchemyApiKey,
  network: Network.ETH_MAINNET,
});

export interface NftEligibility {
  owned: boolean;
  estimatedValueUsd: number | null;
  heldSinceDate: Date | null;
  heldDays: number | null;
}

let cachedEthUsdPrice: { price: number; fetchedAt: number } | null = null;
const ETH_PRICE_CACHE_MS = 60_000;

/** Public, no-auth CoinGecko price lookup — swap for a paid feed if you need higher reliability. */
async function getEthUsdPrice(): Promise<number> {
  if (cachedEthUsdPrice && Date.now() - cachedEthUsdPrice.fetchedAt < ETH_PRICE_CACHE_MS) {
    return cachedEthUsdPrice.price;
  }
  const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd");
  if (!res.ok) throw new Error(`CoinGecko price lookup failed: ${res.status} ${res.statusText}`);
  const json = (await res.json()) as { ethereum?: { usd?: number } };
  const price = json.ethereum?.usd;
  if (!price) throw new Error("CoinGecko response missing ETH/USD price");
  cachedEthUsdPrice = { price, fetchedAt: Date.now() };
  return price;
}

/**
 * Checks whether `owner` really owns `tokenId` on `nftContract` (Ethereum mainnet), estimates
 * its USD value from the collection's floor price, and finds how long the current owner has
 * held that specific token (via ERC-721 transfer history).
 */
export async function checkMainnetNft(owner: string, nftContract: string, tokenId: string): Promise<NftEligibility> {
  if (!config.alchemyApiKey) {
    throw new Error("ALCHEMY_API_KEY is not set — cannot run the mainnet NFT check");
  }

  const ownersResponse = await alchemy.nft.getOwnersForNft(nftContract, tokenId);
  const owned = ownersResponse.owners.some((o) => o.toLowerCase() === owner.toLowerCase());
  if (!owned) {
    return { owned: false, estimatedValueUsd: null, heldSinceDate: null, heldDays: null };
  }

  let estimatedValueUsd: number | null = null;
  try {
    const floor = await alchemy.nft.getFloorPrice(nftContract);
    const openSea = floor.openSea;
    if (openSea && "floorPrice" in openSea && typeof openSea.floorPrice === "number") {
      const ethUsd = await getEthUsdPrice();
      estimatedValueUsd = openSea.floorPrice * ethUsd;
    }
  } catch {
    estimatedValueUsd = null; // treated as "unknown", not "zero" — see checkTierEligibility
  }

  const transfers = await alchemy.core.getAssetTransfers({
    contractAddresses: [nftContract],
    toAddress: owner,
    category: [AssetTransfersCategory.ERC721],
    order: SortingOrder.DESCENDING,
    withMetadata: true,
  });

  const matching = transfers.transfers.find((t) => {
    const rawTokenId = t.tokenId ?? t.erc721TokenId;
    if (rawTokenId == null) return false;
    try {
      return BigInt(rawTokenId) === BigInt(tokenId);
    } catch {
      return false;
    }
  });

  const heldSinceDate = matching?.metadata?.blockTimestamp ? new Date(matching.metadata.blockTimestamp) : null;
  const heldDays = heldSinceDate ? Math.floor((Date.now() - heldSinceDate.getTime()) / (24 * 60 * 60 * 1000)) : null;

  return { owned, estimatedValueUsd, heldSinceDate, heldDays };
}
