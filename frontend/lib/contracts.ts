import { zeroAddress } from "viem";

export const TIER_LABELS = ["$200", "$300", "$400", "$500", "$600"] as const;
export const TIER_COUNT = TIER_LABELS.length;

function envAddress(name: string): `0x${string}` {
  const value = process.env[name];
  if (!value) {
    // Fall back to the zero address in dev so the app still renders before contracts are
    // deployed/configured; reads/writes against it will simply fail until env vars are set.
    return zeroAddress;
  }
  return value as `0x${string}`;
}

export const LENDING_POOL_ADDRESS = envAddress("NEXT_PUBLIC_LENDING_POOL_ADDRESS");
export const COLLATERAL_VAULT_ADDRESS = envAddress("NEXT_PUBLIC_COLLATERAL_VAULT_ADDRESS");
export const USDC_ADDRESS = envAddress("NEXT_PUBLIC_ARC_USDC_ADDRESS");

export const ORACLE_SERVICE_URL = process.env.NEXT_PUBLIC_ORACLE_SERVICE_URL || "http://localhost:8787";
