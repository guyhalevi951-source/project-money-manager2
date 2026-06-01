export function applyCommissionToAmount(amount: number, commissionPercent: number): number {
  if (!(commissionPercent > 0)) return amount;
  return amount * (1 + commissionPercent / 100);
}

/** Apply commission fee to a direct unit rate (1 from = rate × to). */
export function applyCommissionToRate(baseRate: number, commissionPercent: number): number {
  return applyCommissionToAmount(baseRate, commissionPercent);
}

/** Reduce ILS equivalent when a foreign-currency expense includes commission. */
export function applyCommissionToIlsAmount(ilsAmount: number, commissionPercent: number): number {
  return applyCommissionToAmount(ilsAmount, commissionPercent);
}

export function parseCommissionPercentInput(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
}
