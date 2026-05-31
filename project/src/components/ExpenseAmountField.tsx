import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Loader2, Plus } from 'lucide-react';
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
import CurrencyFlag from './CurrencyFlag';

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
  const [isCurrencyMenuOpen, setIsCurrencyMenuOpen] = useState(false);
  const currencyMenuRef = useRef<HTMLDivElement>(null);

  const needsRates = currency !== 'ILS';
  const initialCachedRates = getCachedExchangeRates();

  const [rates, setRates] = useState<ExchangeRates | null>(() =>
    needsRates ? initialCachedRates : null,
  );
  const [loading, setLoading] = useState(() => needsRates && !initialCachedRates);
  const [error, setError] = useState(false);

  const selectedMeta = useMemo(() => getCurrencyMeta(currency), [currency]);

  const isTemporaryCurrency = useMemo(
    () => !pinnedCurrencies.includes(currency),
    [pinnedCurrencies, currency],
  );

  const selectableCurrencies = useMemo(() => {
    if (!isTemporaryCurrency) return pinnedCurrencies;
    return [...pinnedCurrencies, currency];
  }, [pinnedCurrencies, currency, isTemporaryCurrency]);

  const closeCurrencyMenu = useCallback(() => {
    setIsCurrencyMenuOpen(false);
  }, []);

  const handleSelectCurrency = useCallback(
    (code: CurrencyCode) => {
      onCurrencyChange(code);
      closeCurrencyMenu();
    },
    [onCurrencyChange, closeCurrencyMenu],
  );

  const handleOpenLibrary = useCallback(() => {
    closeCurrencyMenu();
    setLibraryOpen(true);
  }, [closeCurrencyMenu]);

  useEffect(() => {
    if (!isCurrencyMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (currencyMenuRef.current?.contains(target)) return;
      closeCurrencyMenu();
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeCurrencyMenu();
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isCurrencyMenuOpen, closeCurrencyMenu]);

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

      <div dir="ltr" className="flex gap-2 min-w-0">
        <div ref={currencyMenuRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setIsCurrencyMenuOpen((prev) => !prev)}
            aria-label={tr('currencyLabel')}
            aria-haspopup="listbox"
            aria-expanded={isCurrencyMenuOpen}
            className={`flex items-center gap-2 px-3 py-3 rounded-xl border text-sm font-medium tabular-nums transition-all active:scale-[0.98] min-w-[6.5rem] ${
              isTemporaryCurrency
                ? 'bg-neutral-800 border-violet-500/50 text-violet-100 ring-1 ring-violet-500/25'
                : 'bg-neutral-800 border-neutral-700 text-neutral-100 hover:border-neutral-600'
            } ${isCurrencyMenuOpen ? 'border-emerald-500/60 ring-2 ring-emerald-500/25' : ''}`}
          >
            <CurrencyFlag countryCode={selectedMeta.countryCode} size="sm" alt={selectedMeta.name} />
            <span className="font-semibold">{selectedMeta.symbol}</span>
            <span className="text-neutral-300">{currency}</span>
            <ChevronDown
              className={`w-3.5 h-3.5 shrink-0 text-neutral-400 transition-transform duration-200 ${
                isCurrencyMenuOpen ? 'rotate-180' : ''
              }`}
              aria-hidden
            />
          </button>

          {isCurrencyMenuOpen && (
            <div
              role="listbox"
              aria-label={tr('currencyLabel')}
              className="absolute top-full start-0 z-50 mt-1.5 w-[min(100vw-2rem,15.5rem)] rounded-xl border border-neutral-700/90 bg-neutral-900 shadow-xl shadow-black/50 p-1.5"
            >
              <div className="flex flex-wrap gap-1.5">
                {selectableCurrencies.map((code) => {
                  const meta = getCurrencyMeta(code);
                  const selected = currency === code;
                  const isTemp = isTemporaryCurrency && code === currency;

                  return (
                    <button
                      key={code}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => handleSelectCurrency(code)}
                      className={`min-w-[3.25rem] flex-1 basis-[calc(25%-0.5rem)] py-2 rounded-lg text-xs font-semibold tabular-nums transition-all active:scale-[0.98] flex flex-col items-center justify-center ${
                        selected
                          ? isTemp
                            ? 'bg-violet-500 text-white shadow-md shadow-violet-500/30 ring-1 ring-violet-400/40'
                            : 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
                          : 'text-neutral-300 hover:text-white hover:bg-neutral-800/80'
                      }`}
                    >
                      <CurrencyFlag countryCode={meta.countryCode} size="xs" alt={meta.name} />
                      <span className="block leading-none mt-0.5">{meta.symbol}</span>
                      <span className="block text-[9px] font-medium opacity-80 mt-0.5 leading-none">{code}</span>
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={handleOpenLibrary}
                  aria-label={tr('currencyLibraryTitle')}
                  className="min-w-[3.25rem] flex-1 basis-[calc(25%-0.5rem)] py-2 rounded-lg text-xs font-semibold transition-all active:scale-[0.98] border border-dashed border-neutral-600/80 text-neutral-300 hover:text-white hover:bg-neutral-800/80 hover:border-neutral-500"
                >
                  <Plus className="w-4 h-4 mx-auto" strokeWidth={2.25} />
                  <span className="block text-[9px] font-medium opacity-80 mt-0.5">+</span>
                </button>
              </div>
            </div>
          )}
        </div>

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

      <CurrencyLibraryModal
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        mode="expense"
        onExpenseCurrencySelect={handleExpenseCurrencyFromLibrary}
      />
    </div>
  );
}
