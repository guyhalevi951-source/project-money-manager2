import { listActiveCurrencyCommissions } from './currencyCommissionService';
import type { ExchangeRates, ExpenseCurrency } from './exchangeRateService';
import { listActiveManualExchangeOverrides } from './manualExchangeOverrideService';
import {
  processTransactionWithUserRules,
  toActiveExchangeRatesFromSnapshot,
  toActiveFeesFromCommissionEntries,
} from './transactionProcessingService';

export type ConvertExpenseToIlsOptions = {
  displayCurrency?: ExpenseCurrency;
};

function buildAppProcessingContext(rates: ExchangeRates) {
  return {
    activeFees: toActiveFeesFromCommissionEntries(listActiveCurrencyCommissions()),
    activeExchangeRates: toActiveExchangeRatesFromSnapshot(
      rates,
      listActiveManualExchangeOverrides(),
    ),
  };
}

/**
 * Converts a home-page expense amount to ILS, applying any saved commission for that currency.
 * Thin adapter over `processTransactionWithUserRules` using current app fee/rate snapshots.
 */
export function convertExpenseAmountToIls(
  amount: number,
  currency: string,
  rates: ExchangeRates,
  options?: ConvertExpenseToIlsOptions,
): number | null {
  const { activeFees, activeExchangeRates } = buildAppProcessingContext(rates);
  const result = processTransactionWithUserRules(
    amount,
    currency,
    'ILS',
    activeFees,
    activeExchangeRates,
    { displayCurrency: options?.displayCurrency ?? 'ILS' },
  );
  return result?.finalConvertedAmount ?? null;
}
