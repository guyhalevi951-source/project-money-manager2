import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { LtrNumeric, useLanguage } from '../LanguageContext';
import { getCurrencyMeta, type CurrencyCode } from '../constants/currencies';
import { usePinnedCurrencies } from '../hooks/usePinnedCurrencies';
import {
  convertForeignToIls,
  fetchExchangeRates,
  getCachedExchangeRates,
  type ExchangeRates,
} from '../services/exchangeRateService';
import CurrencyLibraryModal from './CurrencyLibraryModal';

interface ExpenseAmountFieldProps {
  amount: string;
  currency: CurrencyCode;
  onAmountChange: (value: string) => void;
  onCurrencyChange: (currency: CurrencyCode) => void;
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
  const pinnedCurrencies = usePinnedCurrencies();
  const [libraryOpen, setLibraryOpen] = useState(false);

  const needsRates = currency !== 'ILS';
  const initialCachedRates = getCachedExchangeRates();

  const [rates, setRates] = useState<ExchangeRates | null>(() =>
    needsRates ? initialCachedRates : null,
  );
  const [loading, setLoading] = useState(() => needsRates && !initialCachedRates);
  const [error, setError] = useState(false);

  const isTemporaryCurrency = useMemo(
    () => !pinnedCurrencies.includes(currency),
    [pinnedCurrencies, currency],
  );

  const selectableCurrencies = useMemo(() => {
    if (!isTemporaryCurrency) return pinnedCurrencies;
    return [...pinnedCurrencies, currency];
  }, [pinnedCurrencies, currency, isTemporaryCurrency]);

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

  useEffect(() => {
    if (currency === 'ILS') return;
    const cached = getCachedExchangeRates();
    if (cached) {
      setRates(cached);
      setLoading(false);
      setError(false);
      onRatesReadyChange?.(true);
    }
  }, [currency, onRatesReadyChange]);

  const parsedAmount = parseFloat(amount);
  const convertedIls = useMemo(() => {
    if (!needsRates || !rates || !(parsedAmount > 0)) return null;
    return convertForeignToIls(parsedAmount, currency, rates);
  }, [needsRates, rates, parsedAmount, currency]);

  const showPreview = needsRates && parsedAmount > 0;

  const handleExpenseCurrencyFromLibrary = useCallback(
    (code: CurrencyCode) => {
      onCurrencyChange(code);
    },
    [onCurrencyChange],
  );

  return (
    <div className="min-w-0">
      <label className="block text-sm font-medium text-neutral-300 mb-2">{tr('amountLabel')}</label>

      <div
        dir="ltr"
        className="flex flex-wrap gap-1.5 mb-2 rounded-xl bg-neutral-900/50 border border-neutral-800 p-1.5"
      >
        {selectableCurrencies.map((code) => {
          const meta = getCurrencyMeta(code);
          const selected = currency === code;
          const isTemp = isTemporaryCurrency && code === currency;

          return (
            <button
              key={code}
              type="button"
              onClick={() => onCurrencyChange(code)}
              aria-pressed={selected}
              className={`min-w-[3.25rem] flex-1 basis-[calc(20%-0.5rem)] py-2 rounded-lg text-xs font-semibold tabular-nums transition-all active:scale-[0.98] ${
                selected
                  ? isTemp
                    ? 'bg-violet-500 text-white shadow-md shadow-violet-500/30 ring-1 ring-violet-400/40'
                    : 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
                  : 'text-neutral-300 hover:text-white hover:bg-neutral-800/80'
              }`}
            >
              <span className="block">{meta.symbol}</span>
              <span className="block text-[9px] font-medium opacity-80 mt-0.5">{code}</span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setLibraryOpen(true)}
          aria-label={tr('currencyLibraryTitle')}
          className={`min-w-[3.25rem] flex-1 basis-[calc(20%-0.5rem)] py-2 rounded-lg text-xs font-semibold transition-all active:scale-[0.98] border border-dashed ${
            libraryOpen
              ? 'border-emerald-400/60 bg-emerald-500/10 text-emerald-300'
              : 'border-neutral-600/80 text-neutral-300 hover:text-white hover:bg-neutral-800/80 hover:border-neutral-500'
          }`}
        >
          <Plus className="w-4 h-4 mx-auto" strokeWidth={2.25} />
          <span className="block text-[9px] font-medium opacity-80 mt-0.5">+</span>
        </button>
      </div>

      <input
        type="number"
        inputMode="decimal"
        value={amount}
        onChange={(e) => onAmountChange(e.target.value)}
        placeholder="0.00"
        className="w-full px-4 py-3 rounded-xl bg-neutral-800 border border-neutral-700 text-neutral-100 placeholder-neutral-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 outline-none transition-all text-base tabular-nums"
        min="0"
        step="0.01"
        required
      />

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

      <CurrencyLibraryModal
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        mode="expense"
        onExpenseCurrencySelect={handleExpenseCurrencyFromLibrary}
      />
    </div>
  );
}
