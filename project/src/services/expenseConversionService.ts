import { applyCommissionToIlsAmount } from './commissionMath';
import { getActiveCurrencyCommissionPercent } from './currencyCommissionService';
import {
  convertForeignToIls,
  type ExchangeRates,
  type ExpenseCurrency,
} from './exchangeRateService';

export type ConvertExpenseToIlsOptions = {
  displayCurrency?: ExpenseCurrency;
};

/**
 * Converts a home-page expense amount to ILS, applying any saved commission for that currency.
 * Matches the exchange calculator: `ILS = spot_ILS × (1 + commission%)`.
 * Skips commission when the expense currency matches ILS, display currency, or needs no FX fee.
 */
export function convertExpenseAmountToIls(
  amount: number,
  currency: string,
  rates: ExchangeRates,
  options?: ConvertExpenseToIlsOptions,
): number | null {
  if (!(amount > 0)) return null;
  if (currency === 'ILS') return amount;

  const converted = convertForeignToIls(amount, currency, rates);
  if (converted == null) return null;

  const displayCurrency = options?.displayCurrency ?? 'ILS';
  const commissionPercent = getActiveCurrencyCommissionPercent(currency) ?? 0;
  return applyCommissionToIlsAmount(converted, commissionPercent, currency, 'ILS', {
    displayCurrency,
  });
}
