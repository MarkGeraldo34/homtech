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

// CoinGecko's NFT historical endpoint (nfts/{id}/market_chart) is Pro-only — the free public API
// 401s on it (error_code 10005, https://www.coingecko.com/en/api/pricing). Without a Pro key we
// fall back to reconstructing approximate past prices from the free contract-lookup endpoint's
// floor_price_{30d,60d,1y}_percentage_change fields instead — coarser (3 checkpoints instead of a
// daily series) but real signal at zero cost.
const COINGECKO_API_BASE = config.coingeckoApiKey
  ? "https://pro-api.coingecko.com/api/v3"
  : "https://api.coingecko.com/api/v3";

function coingeckoHeaders(): Record<string, string> {
  return config.coingeckoApiKey ? { "x-cg-pro-api-key": config.coingeckoApiKey } : {};
}

interface CoingeckoNftContract {
  floor_price?: { usd?: number };
  floor_price_30d_percentage_change?: { usd?: number };
  floor_price_60d_percentage_change?: { usd?: number };
  floor_price_1y_percentage_change?: { usd?: number };
}

/** Reconstructs the floor price `daysAgo` from `currentUsd` and a CoinGecko %-change field. */
function reconstructPastPrice(currentUsd: number, pctChange: number | undefined): number | null {
  if (typeof pctChange !== "number" || !Number.isFinite(pctChange) || pctChange <= -100) return null;
  const pastPrice = currentUsd / (1 + pctChange / 100);
  return pastPrice > 0 ? pastPrice : null;
}

/**
 * Approximates `NFT_VALUE_LOOKBACK_DAYS` of floor-price history for `nftContract` from CoinGecko's
 * free contract-lookup endpoint: reconstructs the floor price ~30/60/365 days ago from its
 * %-change fields and returns the lowest of those plus the current price, alongside the longest
 * checkpoint actually available (so callers can tell a thinly-traded collection with only a 30d
 * change from one with a full year of signal). Returns null (treated as "unknown", not "zero" —
 * see checkTierEligibility) if CoinGecko has no data at all for this collection.
 */
async function getApproximateFloorPriceHistoryUsd(nftContract: string): Promise<FloorPriceHistory | null> {
  try {
    const res = await fetch(`${COINGECKO_API_BASE}/nfts/ethereum/contract/${nftContract.toLowerCase()}`, {
      headers: coingeckoHeaders(),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as CoingeckoNftContract;
    const currentUsd = json.floor_price?.usd;
    if (typeof currentUsd !== "number" || currentUsd <= 0) return null;

    const checkpoints: [number, number | undefined][] = [
      [30, json.floor_price_30d_percentage_change?.usd],
      [60, json.floor_price_60d_percentage_change?.usd],
      [365, json.floor_price_1y_percentage_change?.usd],
    ];

    let minUsd = currentUsd;
    let coveredDays = 0;
    for (const [days, pctChange] of checkpoints) {
      const pastPrice = reconstructPastPrice(currentUsd, pctChange);
      if (pastPrice === null) continue;
      minUsd = Math.min(minUsd, pastPrice);
      coveredDays = Math.max(coveredDays, days);
    }

    return coveredDays > 0 ? { minUsd, coveredDays } : null;
  } catch {
    return null;
  }
}

/**
 * Pulls the CoinGecko NFT collection id for `nftContract` (Ethereum) and its trailing
 * `NFT_VALUE_LOOKBACK_DAYS` of USD floor-price history, returning the minimum floor price seen
 * and how many days of history were actually available. Uses CoinGecko's Pro daily-history
 * endpoint if COINGECKO_API_KEY is set (accurate), otherwise the free %-change approximation
 * above (coarser). Returns null (treated as "unknown", not "zero" — see checkTierEligibility) if
 * CoinGecko has no data for this collection.
 */
async function getFloorPriceHistoryUsd(nftContract: string): Promise<FloorPriceHistory | null> {
  if (!config.coingeckoApiKey) return getApproximateFloorPriceHistoryUsd(nftContract);

  try {
    const contractRes = await fetch(`${COINGECKO_API_BASE}/nfts/ethereum/contract/${nftContract.toLowerCase()}`, {
      headers: coingeckoHeaders(),
    });
    if (!contractRes.ok) return null;
    const contractJson = (await contractRes.json()) as { id?: string };
    if (!contractJson.id) return null;

    const chartRes = await fetch(
      `${COINGECKO_API_BASE}/nfts/${contractJson.id}/market_chart?vs_currency=usd&days=${NFT_VALUE_LOOKBACK_DAYS}`,
      { headers: coingeckoHeaders() }
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
