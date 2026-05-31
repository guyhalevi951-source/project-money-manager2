import {
  CURRENCY_DICTIONARY,
  currencySymbol,
  isSupportedCurrency,
  type CurrencyCode,
  type ExpenseCurrency,
} from '../constants/currencies';
import { convertIlsToForeign, type ExchangeRates } from './exchangeRateService';

export interface ExpenseDisplayAmount {
  primary: string;
  secondary?: string;
}

function formatNumeric(amount: number): string {
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export function formatAmountWithSymbol(amount: number, currency: ExpenseCurrency): string {
  const formatted = formatNumeric(Math.abs(amount));
  const sign = amount < 0 ? '-' : '';
  return `${sign}${currencySymbol(currency)}${formatted}`;
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

  const rounded = Math.round(converted * 100) / 100;
  return formatAmountWithSymbol(rounded, displayCurrency);
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
    ? `${originalCurrency}${formatNumeric(originalAmount!)}`
    : null;

  if (displayCurrency === 'ILS') {
    return {
      primary: formatAmountWithSymbol(ilsAmount, 'ILS'),
      secondary: originalFormatted ? `(≈ ${originalFormatted})` : undefined,
    };
  }

  let primaryValue: number;

  if (hasOriginal && originalCode === displayCurrency) {
    primaryValue = originalAmount!;
  } else if (rates) {
    const converted = convertIlsToForeign(ilsAmount, displayCurrency, rates);
    primaryValue =
      converted != null ? Math.round(converted * 100) / 100 : ilsAmount;
  } else {
    primaryValue = ilsAmount;
  }

  const primary = formatAmountWithSymbol(primaryValue, displayCurrency);

  let secondary: string | undefined;
  if (hasOriginal && originalCode === displayCurrency) {
    secondary = `(≈ ${formatAmountWithSymbol(ilsAmount, 'ILS')})`;
  } else if (hasOriginal && originalFormatted) {
    secondary = `(≈ ${originalFormatted})`;
  } else {
    secondary = `(≈ ${formatAmountWithSymbol(ilsAmount, 'ILS')})`;
  }

  if (secondary && primary === secondary.replace(/^\(≈ /, '').replace(/\)$/, '')) {
    secondary = undefined;
  }

  return { primary, secondary };
}
