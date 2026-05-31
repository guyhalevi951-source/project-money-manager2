import {
  convertIlsToForeign,
  type ExpenseCurrency,
  type ExchangeRates,
} from './exchangeRateService';

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

  if (currency === 'USD') return `${sign}$${formatted}`;
  if (currency === 'EUR') return `${sign}€${formatted}`;
  if (currency === 'GBP') return `${sign}£${formatted}`;
  return `${sign}₪${formatted}`;
}

export function symbolToCurrency(symbol: string): ExpenseCurrency | null {
  if (symbol === '₪') return 'ILS';
  if (symbol === '$') return 'USD';
  if (symbol === '€') return 'EUR';
  if (symbol === '£') return 'GBP';
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
