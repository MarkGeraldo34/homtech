// Mirrors LendingPool.sol's tierAmounts (index 0..4 => $200..$600).
export const TIER_AMOUNTS_USD = [200, 300, 400, 500, 600] as const;

export function tierAmountUsd(tierIndex: number): number {
  const amount = TIER_AMOUNTS_USD[tierIndex];
  if (amount === undefined) throw new Error(`Invalid tierIndex: ${tierIndex}`);
  return amount;
}
