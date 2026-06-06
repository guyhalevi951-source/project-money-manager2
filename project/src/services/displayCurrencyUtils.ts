import {
  CURRENCY_DICTIONARY,
  currencySymbol,
  isSupportedCurrency,
  type CurrencyCode,
  type ExpenseCurrency,
} from '../constants/currencies';
import { convertIlsToForeign, type ExchangeRates } from './exchangeRateService';
import { roundMoney } from './money';

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

export function formatMoneyPartsFromIls(
  ilsAmount: number,
  displayCurrency: ExpenseCurrency,
  rates: ExchangeRates | null,
): AmountDisplayParts {
  if (displayCurrency === 'ILS') {
    return formatAmountParts(ilsAmount, 'ILS');
  }

  if (!rates) {
    return formatAmountParts(ilsAmount, 'ILS');
  }

  const converted = convertIlsToForeign(ilsAmount, displayCurrency, rates);
  if (converted == null) {
    return formatAmountParts(ilsAmount, 'ILS');
  }

  return formatAmountParts(roundMoney(converted), displayCurrency, { forceTwoDecimals: true });
}

export function symbolToCurrency(symbol: string): ExpenseCurrency | null {
  const trimmed = symbol.trim();
  if (isSupportedCurrency(trimmed)) return trimmed;

  for (const [code, meta] of Object.entries(CURRENCY_DICTIONARY) as [
    CurrencyCode,
    { symbol: string },
  ][]) {
    if (meta.symbol === trimmed) return code;
  }
  return null;
}

export function formatMoneyFromIls(
  ilsAmount: number,
  displayCurrency: ExpenseCurrency,
  rates: ExchangeRates | null,
): string {
  if (displayCurrency === 'ILS') {
    return formatAmountWithSymbol(ilsAmount, 'ILS');
  }

  if (!rates) {
    return formatAmountWithSymbol(ilsAmount, 'ILS');
  }

  const converted = convertIlsToForeign(ilsAmount, displayCurrency, rates);
  if (converted == null) {
    return formatAmountWithSymbol(ilsAmount, 'ILS');
  }

  const rounded = roundMoney(converted);
  return formatAmountWithSymbol(rounded, displayCurrency, { forceTwoDecimals: true });
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
  const originalCode = hasOriginal ? symbolToCurrency(originalCurrency!) : null;
  const originalFormatted = hasOriginal
    ? `${originalCurrency}${formatNumeric(originalAmount!, false)}`
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
