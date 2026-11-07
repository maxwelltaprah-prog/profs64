// Credit arithmetic. One credit is worth $0.03 of model cost.
export const USD_PER_CREDIT = 0.03;
export const MIN_CHARGE_CREDITS = 0.1;
/** A request is refused before any model call when the balance is below this. */
export const MIN_BALANCE_TO_START = 1;

// Rounds up to two decimals so the service never charges less than the cost, with a tiny
// tolerance so 0.09 / 0.03 (3.0000000000000004 in floating point) does not become 3.01.
export function creditsForCost(usd: number): number {
  if (!Number.isFinite(usd) || usd <= 0) return MIN_CHARGE_CREDITS;
  const hundredths = Math.ceil((usd / USD_PER_CREDIT) * 100 - 1e-9);
  return Math.max(MIN_CHARGE_CREDITS, hundredths / 100);
}

// Used only when the provider reports no token usage. Deliberately over-counts (3 characters per
// token; English text and code are nearer 4) so a missing report never makes a request free.
export function estimateTokensFromChars(chars: number): number {
  if (!Number.isFinite(chars) || chars <= 0) return 0;
  return Math.ceil(chars / 3);
}
