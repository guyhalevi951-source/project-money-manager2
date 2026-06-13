import {
  CORE_CURRENCY_CODES,
  CURRENCY_DICTIONARY,
  currencySymbol,
  isSupportedCurrency,
  type CurrencyCode,
  type ExpenseCurrency,
} from '../constants/currencies';
import {
  convertForeignToIls,
  convertIlsToForeign,
  type ExchangeRates,
} from './exchangeRateService';
import { roundMoney, smartRoundMoney } from './money';

export interface ExpenseDisplayAmount {
  primary: string;
  secondary?: string;
  /** Currency of the evaluated value inside `secondary` — drives inline flag binding. */
  secondaryFlagCode?: ExpenseCurrency;
}

function formatNumeric(amount: number, forceTwoDecimals = false): string {
  return roundMoney(amount).toLocaleString(undefined, {
    minimumFractionDigits: forceTwoDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  });
}

export interface AmountDisplayParts {
  sign: string;
  symbol: string;
  amount: string;
  currency: ExpenseCurrency;
}

export function formatAmountParts(
  amount: number,
  currency: ExpenseCurrency,
  options?: { forceTwoDecimals?: boolean },
): AmountDisplayParts {
  return {
    sign: amount < 0 ? '-' : '',
    symbol: currencySymbol(currency),
    amount: formatNumeric(Math.abs(amount), options?.forceTwoDecimals ?? false),
    currency,
  };
}

export function formatAmountWithSymbol(
  amount: number,
  currency: ExpenseCurrency,
  options?: { forceTwoDecimals?: boolean },
): string {
  const { sign, symbol, amount: formatted } = formatAmountParts(amount, currency, options);
  return `${sign}${symbol}${formatted}`;
}

/**
 * ILS ledger → display currency.
 * Returns a standard 2dp-rounded display value; does NOT snap to integer
 * (127.38 GBP must stay 127.38, not collapse to 127).
 */
export function convertLedgerAmountToDisplayCurrency(
  ilsAmount: number,
  displayCurrency: ExpenseCurrency,
  rates: ExchangeRates | null,
): number | null {
  if (!(ilsAmount > 0)) return null;
  if (displayCurrency === 'ILS') return roundMoney(ilsAmount);
  if (!rates) return null;
  // convertIlsToForeign already applies roundMoney internally
  return convertIlsToForeign(ilsAmount, displayCurrency, rates);
}

/**
 * Display currency → ILS ledger.
 * Applies smartRoundMoney so near-integer results snap cleanly
 * (e.g. 499.96 from 127.38 GBP → 500 ILS).
 */
export function convertDisplayAmountToLedgerCurrency(
  displayAmount: number,
  displayCurrency: ExpenseCurrency,
  rates: ExchangeRates | null,
): number | null {
  if (!(displayAmount > 0)) return null;
  if (displayCurrency === 'ILS') return smartRoundMoney(displayAmount);
  if (!rates) return null;
  // convertForeignToIls already applies smartRoundMoney internally
  return convertForeignToIls(displayAmount, displayCurrency, rates);
}

export interface BudgetMonthOriginal {
  amount: number;
  currency: string;
}

/**
 * Resolve a monthly budget amount in display currency — mirrors App.tsx
 * `budgetStatusDisplayAmount` (prefer matching original snapshot, else convert ILS ledger).
 */
export function resolveBudgetMonthDisplayAmount(
  ilsAmount: number,
  original: BudgetMonthOriginal | undefined,
  displayCurrency: ExpenseCurrency,
  rates: ExchangeRates | null,
): number | null {
  if (original && original.amount > 0) {
    const originalCurrency = (symbolToCurrency(original.currency) ??
      original.currency) as ExpenseCurrency;
    if (originalCurrency === displayCurrency) {
      return roundMoney(original.amount);
    }
  }
  return convertLedgerAmountToDisplayCurrency(ilsAmount, displayCurrency, rates);
}

export function formatMoneyPartsFromIls(
  ilsAmount: number,
  displayCurrency: ExpenseCurrency,
  rates: ExchangeRates | null,
): AmountDisplayParts {
  const displayAmount = convertLedgerAmountToDisplayCurrency(ilsAmount, displayCurrency, rates);
  if (displayAmount == null) {
    return formatAmountParts(ilsAmount, 'ILS');
  }
  return formatAmountParts(displayAmount, displayCurrency, {
    forceTwoDecimals: displayCurrency !== 'ILS',
  });
}

/** Ambiguous symbols shared by many ISO codes — USD wins over ARS for `$`, etc. */
const SYMBOL_AMBIGUITY_PRIORITY: Partial<Record<string, readonly CurrencyCode[]>> = {
  '$': ['USD', 'AUD', 'CAD', 'NZD', 'SGD', 'MXN', 'CLP', 'COP', 'HKD', 'BND', 'BOB', 'ARS'],
  '¥': ['JPY', 'CNY'],
  kr: ['SEK', 'NOK', 'DKK', 'ISK'],
  Rs: ['INR', 'PKR', 'LKR', 'NPR'],
};

export function symbolToCurrency(
  symbol: string,
  preferredCode?: ExpenseCurrency,
): ExpenseCurrency | null {
  const trimmed = symbol.trim();
  if (isSupportedCurrency(trimmed)) return trimmed;

  const matches: CurrencyCode[] = [];
  for (const [code, meta] of Object.entries(CURRENCY_DICTIONARY) as [
    CurrencyCode,
    { symbol: string },
  ][]) {
    if (meta.symbol === trimmed) matches.push(code);
  }
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0];

  if (preferredCode && matches.includes(preferredCode)) return preferredCode;

  for (const core of CORE_CURRENCY_CODES) {
    if (matches.includes(core)) return core;
  }

  const priority = SYMBOL_AMBIGUITY_PRIORITY[trimmed];
  if (priority) {
    for (const code of priority) {
      if (matches.includes(code)) return code;
    }
  }

  return matches[0];
}

/** Normalize persisted `originalCurrency` — ISO codes pass through; legacy symbols resolve. */
export function normalizeStoredOriginalCurrency(raw: string): string {
  const trimmed = raw.trim();
  if (isSupportedCurrency(trimmed)) return trimmed;
  const resolved = symbolToCurrency(trimmed);
  return resolved ?? trimmed;
}

export function formatMoneyFromIls(
  ilsAmount: number,
  displayCurrency: ExpenseCurrency,
  rates: ExchangeRates | null,
): string {
  const displayAmount = convertLedgerAmountToDisplayCurrency(ilsAmount, displayCurrency, rates);
  if (displayAmount == null) {
    return formatAmountWithSymbol(ilsAmount, 'ILS');
  }
  return formatAmountWithSymbol(displayAmount, displayCurrency, {
    forceTwoDecimals: displayCurrency !== 'ILS',
  });
}

export function resolveExpenseDisplayAmount(
  ilsAmount: number,
  displayCurrency: ExpenseCurrency,
  rates: ExchangeRates | null,
  originalAmount?: number,
  originalCurrency?: string,
): ExpenseDisplayAmount {
  const hasOriginal =
    originalAmount != null && originalAmount > 0 && Boolean(originalCurrency?.trim());
  const originalCode = hasOriginal
    ? symbolToCurrency(originalCurrency!, displayCurrency)
    : null;
  const originalFormatted = hasOriginal
    ? `${currencySymbol(originalCode ?? originalCurrency!)}${formatNumeric(originalAmount!, false)}`
    : null;

  if (displayCurrency === 'ILS') {
    return {
      primary: formatAmountWithSymbol(ilsAmount, 'ILS'),
      secondary: originalFormatted ? `(≈ ${originalFormatted})` : undefined,
      secondaryFlagCode: originalCode ?? undefined,
    };
  }

  let primaryValue: number;
  let primaryForceTwoDecimals = false;

  if (hasOriginal && originalCode === displayCurrency) {
    primaryValue = originalAmount!;
  } else if (rates) {
    const converted = convertIlsToForeign(ilsAmount, displayCurrency, rates);
    primaryValue = converted != null ? roundMoney(converted) : ilsAmount;
    primaryForceTwoDecimals = converted != null;
  } else {
    primaryValue = ilsAmount;
  }

  const primary = formatAmountWithSymbol(primaryValue, displayCurrency, {
    forceTwoDecimals: primaryForceTwoDecimals,
  });

  let secondary: string | undefined;
  let secondaryFlagCode: ExpenseCurrency | undefined;

  if (hasOriginal && originalCode === displayCurrency) {
    secondary = `(≈ ${formatAmountWithSymbol(ilsAmount, 'ILS')})`;
    secondaryFlagCode = 'ILS';
  } else if (hasOriginal && originalFormatted) {
    secondary = `(≈ ${originalFormatted})`;
    secondaryFlagCode = originalCode ?? undefined;
  } else {
    secondary = `(≈ ${formatAmountWithSymbol(ilsAmount, 'ILS')})`;
    secondaryFlagCode = 'ILS';
  }

  if (secondary && primary === secondary.replace(/^\(≈ /, '').replace(/\)$/, '')) {
    secondary = undefined;
    secondaryFlagCode = undefined;
  }

  return { primary, secondary, secondaryFlagCode };
}
