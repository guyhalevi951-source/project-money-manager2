import { applyCommissionToIlsAmount } from './commissionMath';
import { getActiveCurrencyCommissionPercent } from './currencyCommissionService';
import {
  convertForeignToIls,
  type ExchangeRates,
} from './exchangeRateService';

/**
 * Converts a home-page expense amount to ILS, applying any saved commission for that currency.
 * Matches the exchange calculator: `ILS = spot_ILS × (1 + commission%)`.
 */
export function convertExpenseAmountToIls(
  amount: number,
  currency: string,
  rates: ExchangeRates,
): number | null {
  if (!(amount > 0)) return null;
  if (currency === 'ILS') return amount;

  const converted = convertForeignToIls(amount, currency, rates);
  if (converted == null) return null;

  const commissionPercent = getActiveCurrencyCommissionPercent(currency) ?? 0;
  return applyCommissionToIlsAmount(converted, commissionPercent);
}
