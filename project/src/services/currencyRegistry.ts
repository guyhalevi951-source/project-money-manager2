/** @deprecated Import from `../constants/currencies` instead. */
export {
  CORE_CURRENCY_CODES,
  CORE_DISPLAY_CURRENCIES,
  CURRENCY_DICTIONARY,
  CURRENCY_DICTIONARY as CURRENCY_META,
  LIBRARY_CURRENCY_CODES,
  LIBRARY_CURRENCY_CODES as EXTENDED_CURRENCIES_SORTED,
  type CoreCurrencyCode,
  type CurrencyCode,
  type CurrencyMeta,
  type ExpenseCurrency,
  currencySymbol,
  filterLibraryCurrencies,
  getCurrencyMeta,
  isCoreCurrency,
  isIsoCurrencyCode,
  isSupportedCurrency,
  matchesCurrencySearch,
  normalizeCustomCurrencies,
  normalizeDisplayCurrency,
} from '../constants/currencies';

import {
  CURRENCY_DICTIONARY,
  LIBRARY_CURRENCY_CODES,
  type CoreCurrencyCode,
  type CurrencyCode,
} from '../constants/currencies';

export type ExtendedCurrencyCode = Exclude<CurrencyCode, CoreCurrencyCode>;

export const EXTENDED_CURRENCY_CODES = LIBRARY_CURRENCY_CODES;

export const ALL_CURRENCY_CODES = Object.keys(CURRENCY_DICTIONARY) as CurrencyCode[];

export const ALL_FOREIGN_CURRENCY_CODES = ALL_CURRENCY_CODES.filter((code) => code !== 'ILS');

export const EXTENDED_CURRENCY_LIBRARY = Object.fromEntries(
  LIBRARY_CURRENCY_CODES.map((code) => [code, CURRENCY_DICTIONARY[code]]),
) as Record<ExtendedCurrencyCode, (typeof CURRENCY_DICTIONARY)[CurrencyCode]>;
