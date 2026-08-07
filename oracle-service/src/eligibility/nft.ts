import { Alchemy, Network } from "alchemy-sdk";
import { config } from "../config.js";

const alchemy = new Alchemy({
  apiKey: config.alchemyApiKey,
  network: Network.ETH_MAINNET,
});

/** Trailing window over which an NFT's floor value must have stayed above the tier threshold. */
export const NFT_VALUE_LOOKBACK_DAYS = 180;

export interface NftEligibility {
  owned: boolean;
  estimatedValueUsd: number | null;
  sustainedMinValueUsd: number | null;
  sustainedValueCoveredDays: number | null;
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

interface FloorPriceHistory {
  minUsd: number;
  coveredDays: number;
}

/**
 * Looks up the CoinGecko NFT collection id for `nftContract` (Ethereum) and pulls its trailing
 * `NFT_VALUE_LOOKBACK_DAYS` of daily USD floor-price history, returning the minimum floor price
 * seen and how many days of history were actually available. Public, no-auth CoinGecko NFT API —
 * swap for a paid feed if you need higher reliability. Returns null (treated as "unknown", not
 * "zero" — see checkTierEligibility) if CoinGecko has no data for this collection.
 */
async function getFloorPriceHistoryUsd(nftContract: string): Promise<FloorPriceHistory | null> {
  try {
    const contractRes = await fetch(
      `https://api.coingecko.com/api/v3/nfts/ethereum/contract/${nftContract.toLowerCase()}`
    );
    if (!contractRes.ok) return null;
    const contractJson = (await contractRes.json()) as { id?: string };
    if (!contractJson.id) return null;

    const chartRes = await fetch(
      `https://api.coingecko.com/api/v3/nfts/${contractJson.id}/market_chart?vs_currency=usd&days=${NFT_VALUE_LOOKBACK_DAYS}`
    );
    if (!chartRes.ok) return null;
    const chartJson = (await chartRes.json()) as { floor_price_usd?: [number, number][] };
    const points = chartJson.floor_price_usd ?? [];
    if (points.length === 0) return null;

    const prices = points.map(([, price]) => price).filter((p) => typeof p === "number" && p > 0);
    if (prices.length === 0) return null;

    const oldestTimestampMs = Math.min(...points.map(([ts]) => ts));
    const coveredDays = Math.floor((Date.now() - oldestTimestampMs) / (24 * 60 * 60 * 1000));

    return { minUsd: Math.min(...prices), coveredDays };
  } catch {
    return null;
  }
}

/**
 * Checks whether `owner` really owns `tokenId` on `nftContract` (Ethereum mainnet), estimates its
 * current USD value from the collection's floor price, and checks whether that floor value has
 * stayed above water for the trailing `NFT_VALUE_LOOKBACK_DAYS` (no minimum hold duration — a
 * recently-acquired NFT is fine as long as its collection's value has held up).
 */
export async function checkMainnetNft(owner: string, nftContract: string, tokenId: string): Promise<NftEligibility> {
  if (!config.alchemyApiKey) {
    throw new Error("ALCHEMY_API_KEY is not set — cannot run the mainnet NFT check");
  }

  const ownersResponse = await alchemy.nft.getOwnersForNft(nftContract, tokenId);
  const owned = ownersResponse.owners.some((o) => o.toLowerCase() === owner.toLowerCase());
  if (!owned) {
    return { owned: false, estimatedValueUsd: null, sustainedMinValueUsd: null, sustainedValueCoveredDays: null };
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

  const history = await getFloorPriceHistoryUsd(nftContract);

  return {
    owned,
    estimatedValueUsd,
    sustainedMinValueUsd: history?.minUsd ?? null,
    sustainedValueCoveredDays: history?.coveredDays ?? null,
  };
}
