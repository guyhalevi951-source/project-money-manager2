export type CommissionBypassOptions = {
  /** App display currency — expenses entered in this currency skip conversion fees. */
  displayCurrency?: string;
  /** Global ALL or explicit ILS fees still apply when from equals display currency. */
  ignoreDisplayCurrencyBypass?: boolean;
};

function normalizeCurrencyCode(currency: string): string {
  return currency.trim().toUpperCase();
}

/** Whether a commission should apply between two currencies (same-currency and display-currency bypass). */
export function shouldApplyCurrencyCommission(
  fromCurrency: string,
  toCurrency: string,
  options?: CommissionBypassOptions,
): boolean {
  const from = normalizeCurrencyCode(fromCurrency);
  const to = normalizeCurrencyCode(toCurrency);
  if (!from || !to) return false;
  if (from === to) return false;

  const display = options?.displayCurrency
    ? normalizeCurrencyCode(options.displayCurrency)
    : null;
  if (display && from === display && !options?.ignoreDisplayCurrencyBypass) return false;

  return true;
}

function effectiveCommissionPercent(
  commissionPercent: number,
  fromCurrency?: string,
  toCurrency?: string,
  options?: CommissionBypassOptions,
): number {
  if (!(commissionPercent > 0)) return 0;
  if (fromCurrency != null && toCurrency != null) {
    if (!shouldApplyCurrencyCommission(fromCurrency, toCurrency, options)) return 0;
  }
  return commissionPercent;
}

export function applyCommissionToAmount(
  amount: number,
  commissionPercent: number,
  fromCurrency?: string,
  toCurrency?: string,
  options?: CommissionBypassOptions,
): number {
  const percent = effectiveCommissionPercent(
    commissionPercent,
    fromCurrency,
    toCurrency,
    options,
  );
  if (!(percent > 0)) return amount;
  return amount * (1 + percent / 100);
}

/** Apply commission fee to a direct unit rate (1 from = rate × to). */
export function applyCommissionToRate(
  baseRate: number,
  commissionPercent: number,
  fromCurrency?: string,
  toCurrency?: string,
  options?: CommissionBypassOptions,
): number {
  return applyCommissionToAmount(baseRate, commissionPercent, fromCurrency, toCurrency, options);
}

/** Reduce ILS equivalent when a foreign-currency expense includes commission. */
export function applyCommissionToIlsAmount(
  ilsAmount: number,
  commissionPercent: number,
  fromCurrency?: string,
  toCurrency: string = 'ILS',
  options?: CommissionBypassOptions,
): number {
  return applyCommissionToAmount(ilsAmount, commissionPercent, fromCurrency, toCurrency, options);
}

export function parseCommissionPercentInput(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
}
