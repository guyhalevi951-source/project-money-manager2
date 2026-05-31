import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { LtrNumeric, useLanguage } from '../LanguageContext';
import {
  convertForeignToIls,
  EXPENSE_CURRENCIES,
  fetchExchangeRates,
  getCachedExchangeRates,
  type ExpenseCurrency,
  type ExchangeRates,
} from '../services/exchangeRateService';

interface ExpenseAmountFieldProps {
  amount: string;
  currency: ExpenseCurrency;
  onAmountChange: (value: string) => void;
  onCurrencyChange: (currency: ExpenseCurrency) => void;
  onRatesReadyChange?: (ready: boolean) => void;
}

export default function ExpenseAmountField({
  amount,
  currency,
  onAmountChange,
  onCurrencyChange,
  onRatesReadyChange,
}: ExpenseAmountFieldProps) {
  const { tr } = useLanguage();
  const needsRates = currency !== 'ILS';
  const initialCachedRates = getCachedExchangeRates();

  const [rates, setRates] = useState<ExchangeRates | null>(() =>
    needsRates ? initialCachedRates : null,
  );
  const [loading, setLoading] = useState(() => needsRates && !initialCachedRates);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!needsRates) {
      setLoading(false);
      setError(false);
      onRatesReadyChange?.(true);
      return;
    }

    const cached = getCachedExchangeRates();
    if (cached) {
      setRates(cached);
      setLoading(false);
      setError(false);
      onRatesReadyChange?.(true);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(false);
    onRatesReadyChange?.(false);

    void fetchExchangeRates()
      .then((nextRates) => {
        if (cancelled) return;
        setRates(nextRates);
        setError(false);
        onRatesReadyChange?.(true);
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
        onRatesReadyChange?.(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [needsRates, onRatesReadyChange]);

  const parsedAmount = parseFloat(amount);
  const convertedIls = useMemo(() => {
    if (!needsRates || !rates || !(parsedAmount > 0)) return null;
    return convertForeignToIls(parsedAmount, currency, rates);
  }, [needsRates, rates, parsedAmount, currency]);

  const showPreview = needsRates && parsedAmount > 0;

  return (
    <div className="min-w-0">
      <label className="block text-sm font-medium text-neutral-300 mb-2">{tr('amountLabel')}</label>
      <div dir="ltr" className="flex gap-2 min-w-0">
        <select
          value={currency}
          onChange={(e) => onCurrencyChange(e.target.value as ExpenseCurrency)}
          aria-label={tr('currencyLabel')}
          className="w-[5.25rem] sm:w-[5.75rem] shrink-0 px-2.5 sm:px-3 py-3 rounded-xl bg-neutral-800 border border-neutral-700 text-neutral-100 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 outline-none transition-all text-sm font-medium tabular-nums"
        >
          {EXPENSE_CURRENCIES.map((item) => (
            <option key={item.code} value={item.code}>
              {item.symbol} {item.label}
            </option>
          ))}
        </select>
        <input
          type="number"
          inputMode="decimal"
          value={amount}
          onChange={(e) => onAmountChange(e.target.value)}
          placeholder="0.00"
          className="flex-1 min-w-0 px-4 py-3 rounded-xl bg-neutral-800 border border-neutral-700 text-neutral-100 placeholder-neutral-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 outline-none transition-all text-base tabular-nums"
          min="0"
          step="0.01"
          required
        />
      </div>

      {showPreview && (
        <p className="mt-1.5 min-h-[1.125rem] text-xs leading-snug">
          {loading ? (
            <span className="inline-flex items-center gap-1.5 text-neutral-500">
              <Loader2 className="w-3 h-3 animate-spin shrink-0" aria-hidden />
              {tr('loadingExchangeRates')}
            </span>
          ) : error ? (
            <span className="text-amber-400/90">{tr('exchangeRatesUnavailable')}</span>
          ) : convertedIls != null ? (
            <span className="text-emerald-400/90">
              {tr('approxIlsPrefix')}{' '}
              <LtrNumeric className="font-medium text-emerald-300">
                ₪
                {convertedIls.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </LtrNumeric>
            </span>
          ) : null}
        </p>
      )}
    </div>
  );
}
