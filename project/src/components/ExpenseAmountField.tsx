import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Loader2, Plus } from 'lucide-react';
import { LtrNumeric, useLanguage } from '../LanguageContext';
import { getCurrencyMeta, type CurrencyCode } from '../constants/currencies';
import { usePinnedCurrencies } from '../hooks/usePinnedCurrencies';
import { formatAmountWithSymbol } from '../services/displayCurrencyUtils';
import {
  listActiveCurrencyCommissions,
  subscribeCurrencyCommissionsUpdated,
} from '../services/currencyCommissionService';
import {
  fetchExchangeRates,
  getCachedExchangeRates,
  hasExchangeRate,
  type ExchangeRates,
} from '../services/exchangeRateService';
import { listActiveManualExchangeOverrides } from '../services/manualExchangeOverrideService';
import {
  processTransactionWithUserRules,
  toActiveExchangeRatesFromSnapshot,
  toActiveFeesFromCommissionEntries,
} from '../services/transactionProcessingService';
import CurrencyLibraryModal from './CurrencyLibraryModal';
import CurrencyFlag from './CurrencyFlag';
import CurrencyDetectionBanner from './CurrencyDetectionBanner';
import { currencyUtilityButtonLgClass, primaryActionSelectedChipClass } from '../styles/actionButtonStyles';
import {
  detectLocalCurrency,
  isDetectedCurrencyAccepted,
} from '../services/currencyDetectionService';
import {
  getCurrencyAutoDetectPref,
  setCurrencyAutoDetectPref,
} from '../services/currencyDetectionPreference';

const expenseFormControlClass =
  'h-12 rounded-xl border border-neutral-700 bg-neutral-800 text-neutral-100 text-base transition-all outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30';

const AMOUNT_INPUT_MAX_LENGTH = 14;

/** Horizontal padding (px-4 × 2) plus breathing room so digits never clip. */
const AMOUNT_INPUT_WIDTH_EXTRA_PX = 56;
const AMOUNT_INPUT_MIN_WIDTH_PX = 80;

/** Width grows with digit count; `ch` matches tabular-nums on the input. */
function getAmountInputWidth(amount: string): { width: string; minWidth: string; maxWidth: string } {
  const charCount = amount.length > 0 ? amount.length : 1;
  return {
    width: `calc(${charCount}ch + ${AMOUNT_INPUT_WIDTH_EXTRA_PX}px)`,
    minWidth: `${AMOUNT_INPUT_MIN_WIDTH_PX}px`,
    maxWidth: '100%',
  };
}

interface ExpenseAmountFieldProps {
  amount: string;
  currency: CurrencyCode;
  onAmountChange: (value: string) => void;
  onCurrencyChange: (currency: CurrencyCode) => void;
  onRatesReadyChange?: (ready: boolean) => void;
  lockToDisplayCurrency?: boolean;
  onOpenExchangeRatesSettings?: () => void;
}

export default function ExpenseAmountField({
  amount,
  currency,
  onAmountChange,
  onCurrencyChange,
  onRatesReadyChange,
  lockToDisplayCurrency = false,
  onOpenExchangeRatesSettings,
}: ExpenseAmountFieldProps) {
  const { tr, displayCurrency } = useLanguage();
  const inputCurrency = lockToDisplayCurrency ? displayCurrency : currency;
  const pinnedCurrencies = usePinnedCurrencies();
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [isCurrencyMenuOpen, setIsCurrencyMenuOpen] = useState(false);
  const [showDetectionPrompt, setShowDetectionPrompt] = useState(false);
  const [detectedCurrency, setDetectedCurrency] = useState<CurrencyCode | null>(null);
  const currencyMenuRef = useRef<HTMLDivElement>(null);
  const detectionRanRef = useRef(false);

  const needsRatesForStorage = inputCurrency !== 'ILS';
  const needsRatesForFetch = needsRatesForStorage || (!lockToDisplayCurrency && displayCurrency !== inputCurrency);
  const initialCachedRates = getCachedExchangeRates();

  const [rates, setRates] = useState<ExchangeRates | null>(() =>
    needsRatesForFetch ? initialCachedRates : null,
  );
  const [loading, setLoading] = useState(
    () => needsRatesForFetch && !initialCachedRates,
  );
  const [error, setError] = useState(false);
  const [commissionVersion, setCommissionVersion] = useState(0);

  const selectedMeta = useMemo(() => getCurrencyMeta(inputCurrency), [inputCurrency]);

  const isTemporaryCurrency = useMemo(
    () => !pinnedCurrencies.includes(inputCurrency),
    [pinnedCurrencies, inputCurrency],
  );

  const selectableCurrencies = useMemo(() => {
    if (!isTemporaryCurrency) return pinnedCurrencies;
    return [...pinnedCurrencies, inputCurrency];
  }, [pinnedCurrencies, inputCurrency, isTemporaryCurrency]);

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

    const handlePointerDownOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (currencyMenuRef.current?.contains(target)) return;
      closeCurrencyMenu();
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeCurrencyMenu();
    };

    document.addEventListener('pointerdown', handlePointerDownOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDownOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isCurrencyMenuOpen, closeCurrencyMenu]);

  useEffect(() => {
    if (!needsRatesForFetch) {
      setLoading(false);
      setError(false);
      onRatesReadyChange?.(true);
      return;
    }

    if (!needsRatesForStorage) {
      onRatesReadyChange?.(true);
    }

    const cached = getCachedExchangeRates();
    if (cached) {
      setRates(cached);
      setLoading(false);
      setError(false);
      if (needsRatesForStorage) onRatesReadyChange?.(true);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(false);
    if (needsRatesForStorage) onRatesReadyChange?.(false);

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
        if (needsRatesForStorage) onRatesReadyChange?.(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [needsRatesForFetch, needsRatesForStorage, onRatesReadyChange]);

  useEffect(() => {
    if (!needsRatesForFetch) return;
    const cached = getCachedExchangeRates();
    if (cached) {
      setRates(cached);
      setLoading(false);
      setError(false);
      if (needsRatesForStorage) onRatesReadyChange?.(true);
    }
  }, [inputCurrency, displayCurrency, needsRatesForFetch, needsRatesForStorage, onRatesReadyChange]);

  useEffect(
    () =>
      subscribeCurrencyCommissionsUpdated(() => {
        setCommissionVersion((version) => version + 1);
      }),
    [],
  );

  const parsedAmount = parseFloat(amount);

  const isMaxLengthReached = amount.length >= AMOUNT_INPUT_MAX_LENGTH;

  const handleAmountChange = useCallback(
    (value: string) => {
      if (value.length > AMOUNT_INPUT_MAX_LENGTH) return;
      onAmountChange(value);
    },
    [onAmountChange],
  );

  const showDisplayPreview = useMemo(
    () =>
      !isMaxLengthReached &&
      parsedAmount > 0 &&
      !lockToDisplayCurrency &&
      inputCurrency !== displayCurrency,
    [isMaxLengthReached, parsedAmount, lockToDisplayCurrency, inputCurrency, displayCurrency],
  );

  const activeFees = useMemo(
    () => toActiveFeesFromCommissionEntries(listActiveCurrencyCommissions()),
    [commissionVersion],
  );

  const processedPreview = useMemo(() => {
    if (!showDisplayPreview || !rates) return null;

    if (
      !hasExchangeRate(inputCurrency, rates) ||
      !hasExchangeRate(displayCurrency, rates)
    ) {
      return null;
    }

    const activeExchangeRates = toActiveExchangeRatesFromSnapshot(
      rates,
      listActiveManualExchangeOverrides(),
    );

    return processTransactionWithUserRules(
      parsedAmount,
      inputCurrency,
      displayCurrency,
      activeFees,
      activeExchangeRates,
      { displayCurrency },
    );
  }, [showDisplayPreview, rates, parsedAmount, inputCurrency, displayCurrency, activeFees]);

  const convertedDisplayAmount = processedPreview?.finalConvertedAmount ?? null;
  const activeCommissionPercent = processedPreview?.appliedFeePercentage ?? 0;

  const displayPreviewFormatted = useMemo(() => {
    if (convertedDisplayAmount == null) return null;
    const base = formatAmountWithSymbol(convertedDisplayAmount, displayCurrency);
    if (activeCommissionPercent > 0) {
      return `${base} ${tr('inclFeeShort')}`;
    }
    return base;
  }, [convertedDisplayAmount, displayCurrency, activeCommissionPercent, tr]);

  const amountInputSize = useMemo(() => getAmountInputWidth(amount), [amount]);

  const handleExpenseCurrencyFromLibrary = useCallback(
    (code: CurrencyCode) => {
      onCurrencyChange(code);
    },
    [onCurrencyChange],
  );

  useEffect(() => {
    if (lockToDisplayCurrency) return;
    if (detectionRanRef.current) return;
    detectionRanRef.current = true;

    const pref = getCurrencyAutoDetectPref();
    if (pref === 'never') return;

    let cancelled = false;

    void detectLocalCurrency().then((detected) => {
      if (
        cancelled ||
        !detected ||
        !isDetectedCurrencyAccepted(detected) ||
        detected === displayCurrency
      ) {
        return;
      }

      if (pref === 'always') {
        onCurrencyChange(detected);
        return;
      }

      setDetectedCurrency(detected);
      setShowDetectionPrompt(true);
    });

    return () => {
      cancelled = true;
    };
  }, [displayCurrency, onCurrencyChange, lockToDisplayCurrency]);

  const handleDetectionConfirm = useCallback(() => {
    if (detectedCurrency) onCurrencyChange(detectedCurrency);
    setShowDetectionPrompt(false);
  }, [detectedCurrency, onCurrencyChange]);

  const handleDetectionAlways = useCallback(() => {
    setCurrencyAutoDetectPref('always');
    if (detectedCurrency) onCurrencyChange(detectedCurrency);
    setShowDetectionPrompt(false);
  }, [detectedCurrency, onCurrencyChange]);

  const handleDetectionNever = useCallback(() => {
    setCurrencyAutoDetectPref('never');
    setShowDetectionPrompt(false);
  }, []);

  return (
    <div className="flex w-full shrink-0 flex-col sm:w-auto">
      <label className="block text-sm font-medium text-neutral-300 mb-2">{tr('amountLabel')}</label>

      <div dir="ltr" className="relative z-10 w-full sm:w-auto">
        <div className="relative z-10 flex w-full items-center gap-2 sm:w-auto">
          <div ref={currencyMenuRef} className="relative z-20 shrink-0">
            {lockToDisplayCurrency ? (
              <div
                aria-label={tr('currencyLabel')}
                className={`${expenseFormControlClass} flex shrink-0 items-center gap-1.5 px-2.5 sm:gap-2 sm:px-3 text-sm font-medium tabular-nums whitespace-nowrap bg-neutral-800 border-neutral-700 text-neutral-100`}
              >
                <CurrencyFlag countryCode={selectedMeta.countryCode} size="sm" alt={selectedMeta.name} />
                <span className="font-semibold">{selectedMeta.symbol}</span>
                <span className="text-neutral-300">{inputCurrency}</span>
              </div>
            ) : (
            <button
              type="button"
              onClick={() => setIsCurrencyMenuOpen((prev) => !prev)}
              aria-label={tr('currencyLabel')}
              aria-haspopup="listbox"
              aria-expanded={isCurrencyMenuOpen}
              className={`${expenseFormControlClass} flex shrink-0 items-center gap-1.5 px-2.5 sm:gap-2 sm:px-3 text-sm font-medium tabular-nums active:scale-[0.98] whitespace-nowrap ${
                isTemporaryCurrency
                  ? 'bg-neutral-800 border-violet-500/50 text-violet-100 ring-1 ring-violet-500/25'
                  : 'bg-neutral-800 border-neutral-700 text-neutral-100 hover:border-neutral-600'
              } ${isCurrencyMenuOpen ? 'border-emerald-500/60 ring-2 ring-emerald-500/25' : ''}`}
            >
              <CurrencyFlag countryCode={selectedMeta.countryCode} size="sm" alt={selectedMeta.name} />
              <span className="font-semibold">{selectedMeta.symbol}</span>
              <span className="text-neutral-300">{inputCurrency}</span>
              <ChevronDown
                className={`w-3.5 h-3.5 shrink-0 text-neutral-400 transition-transform duration-200 ${
                  isCurrencyMenuOpen ? 'rotate-180' : ''
                }`}
                aria-hidden
              />
            </button>
            )}

            {!lockToDisplayCurrency && isCurrencyMenuOpen && (
              <div
                role="listbox"
                aria-label={tr('currencyLabel')}
                className="absolute top-full start-0 z-30 mt-1.5 w-[min(100vw-2rem,15.5rem)] rounded-xl border border-neutral-700/90 bg-neutral-900 shadow-xl shadow-black/50 p-1.5"
              >
              <div className="flex flex-wrap gap-1.5">
                {selectableCurrencies.map((code) => {
                  const meta = getCurrencyMeta(code);
                  const selected = inputCurrency === code;

                  return (
                    <button
                      key={code}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => handleSelectCurrency(code)}
                      className={`min-w-[3.25rem] flex-1 basis-[calc(25%-0.5rem)] py-2 rounded-lg text-xs font-semibold tabular-nums transition-all active:scale-[0.98] flex flex-col items-center justify-center ${
                        selected
                          ? primaryActionSelectedChipClass
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
            onChange={(e) => handleAmountChange(e.target.value)}
            placeholder="0.00"
            style={{
              width: amountInputSize.width,
              minWidth: amountInputSize.minWidth,
              maxWidth: amountInputSize.maxWidth,
            }}
            className={`${expenseFormControlClass} box-border shrink-0 px-4 text-center tabular-nums placeholder-neutral-500 transition-[width] duration-150 ease-out ${
              isMaxLengthReached ? 'border-red-500/70 focus:border-red-500 focus:ring-red-500/30' : ''
            }`}
            aria-invalid={isMaxLengthReached}
            min="0"
            step="0.01"
            required
          />
          {onOpenExchangeRatesSettings && (
            <button
              type="button"
              onClick={onOpenExchangeRatesSettings}
              className={`h-12 ${currencyUtilityButtonLgClass}`}
              title={tr('settingsCurrencySubExchange')}
              aria-label={tr('settingsCurrencySubExchange')}
            >
              {tr('settingsCurrencySubExchange')}
            </button>
          )}
        </div>

        <AnimatePresence mode="wait">
          {isMaxLengthReached ? (
            <motion.p
              key="amount-max-length"
              initial={{ opacity: 0, y: -2 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="absolute start-0 top-full z-20 mt-1 text-xs text-red-500 pointer-events-none whitespace-nowrap"
              role="alert"
            >
              {tr('amountTooLarge')}
            </motion.p>
          ) : showDisplayPreview ? (
            <motion.p
              key={`${inputCurrency}-${displayCurrency}-${amount}`}
              initial={{ opacity: 0, y: -2 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="absolute start-0 top-full z-10 mt-1 max-w-[min(100vw-2rem,20rem)] truncate text-sm leading-snug text-neutral-400 pointer-events-none"
              aria-live="polite"
            >
              {loading ? (
                <span className="inline-flex items-center gap-1.5 text-neutral-500">
                  <Loader2 className="w-3 h-3 animate-spin shrink-0" aria-hidden />
                  {tr('loadingExchangeRates')}
                </span>
              ) : error ? (
                <span className="text-amber-400/80">{tr('exchangeRatesUnavailable')}</span>
              ) : displayPreviewFormatted ? (
                <span>
                  {tr('approxIlsPrefix')}{' '}
                  <LtrNumeric className="font-medium text-neutral-300/90 tabular-nums">
                    {displayPreviewFormatted}
                  </LtrNumeric>
                  {' '}
                  {tr('convertedToDisplayCurrency')}
                </span>
              ) : (
                <span className="text-amber-400/80">{tr('exchangeRatesUnavailable')}</span>
              )}
            </motion.p>
          ) : null}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {!lockToDisplayCurrency && showDetectionPrompt && detectedCurrency && (
          <CurrencyDetectionBanner
            detectedCurrency={detectedCurrency}
            onConfirmSwitch={handleDetectionConfirm}
            onAlwaysSwitch={handleDetectionAlways}
            onNeverAsk={handleDetectionNever}
          />
        )}
      </AnimatePresence>

      <CurrencyLibraryModal
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        mode="expense"
        onExpenseCurrencySelect={handleExpenseCurrencyFromLibrary}
      />
    </div>
  );
}
