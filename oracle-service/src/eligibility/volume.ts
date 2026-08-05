import { config } from "../config.js";

const COVALENT_BASE_URL = "https://api.covalenthq.com/v1";
const MAX_PAGES_PER_CHAIN = 20; // safety cap so a very active wallet can't spin this forever

/**
 * Sums a wallet's transaction volume (in USD) on a single chain since `sinceDate`, using
 * Covalent/GoldRush's transactions_v3 endpoint. Transactions come back newest-first, so we
 * page until we cross `sinceDate` and then stop.
 *
 * NOTE: verify this endpoint shape against the current GoldRush docs (https://goldrush.dev) —
 * API surfaces evolve. `value_quote` is Covalent's USD-at-tx-time valuation of the native
 * value moved; swap in a different field/endpoint here if their schema has changed.
 */
async function getChainVolumeUsd(chainName: string, address: string, sinceDate: Date): Promise<number> {
  let total = 0;
  let pageNumber = 0;

  while (pageNumber < MAX_PAGES_PER_CHAIN) {
    const url = `${COVALENT_BASE_URL}/${chainName}/address/${address}/transactions_v3/page/${pageNumber}/`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${config.covalentApiKey}` },
    });

    if (!res.ok) {
      if (res.status === 404) return total; // chain doesn't recognize the address / no activity
      throw new Error(`Covalent request failed for ${chainName} (page ${pageNumber}): ${res.status} ${res.statusText}`);
    }

    const json = (await res.json()) as {
      data?: { items?: Array<{ block_signed_at: string; value_quote: number | null }> };
    };
    const items = json.data?.items ?? [];
    if (items.length === 0) break;

    let crossedCutoff = false;
    for (const tx of items) {
      const txDate = new Date(tx.block_signed_at);
      if (txDate < sinceDate) {
        crossedCutoff = true;
        break;
      }
      total += tx.value_quote ?? 0;
    }

    if (crossedCutoff) break;
    pageNumber += 1;
  }

  return total;
}

/**
 * Sums a wallet's transaction volume (in USD) across every chain in `config.volumeCheckChains`
 * over the trailing `windowDays`. This stands in for the "33 EVM chains" requirement — the exact
 * chain list is provider-determined (see VOLUME_CHECK_CHAINS in .env.example).
 */
export async function getCrossChainVolumeUsd(address: string, windowDays = 365): Promise<number> {
  if (!config.covalentApiKey) {
    throw new Error("COVALENT_API_KEY is not set — cannot run the cross-chain volume check");
  }

  const sinceDate = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  const perChainVolumes = await Promise.all(
    config.volumeCheckChains.map((chain) => getChainVolumeUsd(chain, address, sinceDate))
  );

  return perChainVolumes.reduce((sum, v) => sum + v, 0);
}
