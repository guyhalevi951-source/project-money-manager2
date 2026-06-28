import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Loader2, Plus } from 'lucide-react';
import { LtrNumeric, useLanguage } from '../LanguageContext';
import { getCurrencyMeta, type CurrencyCode } from '../constants/currencies';
import { usePinnedCurrencies } from '../hooks/usePinnedCurrencies';
import { formatAmountWithSymbol, formatExpenseDisplayAmount } from '../services/displayCurrencyUtils';
import {
  resolveCapsuleForeignDisplayAmount,
  resolveLiveForeignDisplayAmount,
  resolveManualRateFromCapsule,
  editDisplayPathsMatchSavedFeeState,
  resolvePersistedEditDisplayAmount,
  type ExpenseCreationTimeCapsule,
  type SavedExpenseDualSnapshotOverlay,
} from '../services/expenseConversionService';
import { isCapsuleV2, resolveAutonomousExpenseDisplay } from '../services/expenseTimeCapsuleEngine';
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
import {
  getAppliedCommissionPercentForPair,
  toActiveFeesFromCommissionEntries,
} from '../services/transactionProcessingService';
import {
  hasActiveManualOverrideForPair,
  subscribeManualOverridesUpdated,
} from '../services/manualExchangeOverrideService';
import CurrencyLibraryModal from './CurrencyLibraryModal';
import CurrencyFlag from './CurrencyFlag';
import {
  currencyUtilityButtonLgClass,
  filterDropdownWrapperClass,
  filterFormControlClass,
  primaryActionSelectedChipClass,
} from '../styles/actionButtonStyles';
import { typographyLabelClass, typographyMutedClass } from '../styles/themeSurfaceStyles';

const expenseFormControlClass = `h-12 text-base ${filterFormControlClass}`;

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
  /** Transaction date for conversion preview. */
  transactionDate?: string;
  /**
   * Snap currency + amount + rates button to the column end (right under the amount label).
   * Preview sub-text stacks below, left-aligned with the currency selector.
   */
  snapInputGroupToColumnEnd?: boolean;
  /** Edit modal: when true, preview uses spot rates only (manual override off). */
  previewManualRateDisabled?: boolean;
  /** Edit modal: when true, preview excludes commission fees. */
  previewFeeDisabled?: boolean;
  /**
   * Edit modal: when set, the upper `≈` preview reads manual rates + fees from this
   * frozen creation-time capsule instead of live global settings (sandbox isolation).
   */
  previewTimeCapsule?: ExpenseCreationTimeCapsule;
  /** Edit modal: frozen expense snapshot — restores saved display paths when amount/fee unchanged. */
  previewSavedDisplaySnapshot?: SavedExpenseDualSnapshotOverlay | null;
}

export default function ExpenseAmountField({
  amount,
  currency,
  onAmountChange,
  onCurrencyChange,
  onRatesReadyChange,
  lockToDisplayCurrency = false,
  onOpenExchangeRatesSettings,
  transactionDate,
  snapInputGroupToColumnEnd = false,
  previewManualRateDisabled = false,
  previewFeeDisabled = false,
  previewTimeCapsule,
  previewSavedDisplaySnapshot,
}: ExpenseAmountFieldProps) {
  const { tr, displayCurrency } = useLanguage();
  const displayMeta = getCurrencyMeta(displayCurrency);
  const inputCurrency = lockToDisplayCurrency ? displayCurrency : currency;
  const pinnedCurrencies = usePinnedCurrencies();
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [isCurrencyMenuOpen, setIsCurrencyMenuOpen] = useState(false);
  const currencyMenuRef = useRef<HTMLDivElement>(null);

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
  const [manualOverrideVersion, setManualOverrideVersion] = useState(0);

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

  useEffect(
    () =>
      subscribeManualOverridesUpdated(() => {
        setManualOverrideVersion((version) => version + 1);
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

  const convertedDisplayAmount = useMemo(() => {
    if (!showDisplayPreview || !rates) return null;

    // 1. v2 capsule: use the autonomous engine — no live rate calls.
    if (previewTimeCapsule != null && isCapsuleV2(previewTimeCapsule)) {
      const engineResult = resolveAutonomousExpenseDisplay(
        {
          amount: parsedAmount,
          originalAmount: parsedAmount,
          originalCurrency: inputCurrency,
          manualRateUsed: !previewManualRateDisabled,
          feeApplied: !previewFeeDisabled,
          displayAmountInManual: previewSavedDisplaySnapshot?.displayAmountInManual,
          displayAmountInSpot: previewSavedDisplaySnapshot?.displayAmountInSpot,
          amountInManual: previewSavedDisplaySnapshot?.amountInManual ?? undefined,
          amountInSpot: previewSavedDisplaySnapshot?.amountInSpot,
          appliedFeePercent: previewSavedDisplaySnapshot?.appliedFeePercent,
          creationTimeCapsule: previewTimeCapsule,
        },
        displayCurrency,
        previewTimeCapsule,
        {
          manualRateUsed: !previewManualRateDisabled,
          feeApplied: !previewFeeDisabled,
        },
      );
      return engineResult.primaryAmount > 0 ? engineResult.primaryAmount : null;
    }

    if (
      !hasExchangeRate(inputCurrency, rates) ||
      !hasExchangeRate(displayCurrency, rates)
    ) {
      return null;
    }

    // 2. Persisted display snapshot 1:1 hydration (v1 capsule path)
    if (
      previewSavedDisplaySnapshot &&
      editDisplayPathsMatchSavedFeeState(parsedAmount, previewFeeDisabled, previewSavedDisplaySnapshot)
    ) {
      const persisted = resolvePersistedEditDisplayAmount(
        previewSavedDisplaySnapshot,
        previewManualRateDisabled,
      );
      if (persisted != null) return persisted;
    }

    // 3. v1 capsule: use frozen capsule manual rates with live spot
    if (previewTimeCapsule != null) {
      return resolveCapsuleForeignDisplayAmount(
        parsedAmount,
        inputCurrency,
        displayCurrency,
        rates,
        previewTimeCapsule,
        {
          manualRateDisabled: previewManualRateDisabled,
          feeDisabled: previewFeeDisabled,
        },
      );
    }

    // 4. No capsule: fully live conversion (new expense form)
    return resolveLiveForeignDisplayAmount(
      parsedAmount,
      inputCurrency,
      displayCurrency,
      rates,
      {
        manualRateDisabled: previewManualRateDisabled,
        feeDisabled: previewFeeDisabled,
      },
    );
  }, [
    showDisplayPreview,
    rates,
    parsedAmount,
    inputCurrency,
    displayCurrency,
    commissionVersion,
    manualOverrideVersion,
    previewManualRateDisabled,
    previewFeeDisabled,
    previewTimeCapsule,
    previewSavedDisplaySnapshot,
  ]);

  const activeCommissionPercent = useMemo(() => {
    if (previewFeeDisabled || convertedDisplayAmount == null || !rates) return 0;
    const activeFees =
      previewTimeCapsule != null
        ? previewTimeCapsule.fees
        : toActiveFeesFromCommissionEntries(listActiveCurrencyCommissions());
    return getAppliedCommissionPercentForPair(
      activeFees,
      inputCurrency,
      displayCurrency,
      displayCurrency,
    );
  }, [convertedDisplayAmount, inputCurrency, displayCurrency, commissionVersion, rates, previewFeeDisabled, previewTimeCapsule]);

  const convertedAmountFormatted = useMemo(() => {
    if (convertedDisplayAmount == null) return null;
    if (previewTimeCapsule != null) {
      return formatExpenseDisplayAmount(convertedDisplayAmount, displayCurrency);
    }
    return formatAmountWithSymbol(convertedDisplayAmount, displayCurrency);
  }, [convertedDisplayAmount, displayCurrency, previewTimeCapsule]);

  /**
   * True only when a manual rate is genuinely active for the CURRENT pair
   * (inputCurrency → displayCurrency), respecting the pairSpecific scope of each entry.
   */
  const hasActivePairManualOverride = useMemo(() => {
    if (previewManualRateDisabled || !showDisplayPreview) return false;
    if (previewTimeCapsule != null) {
      return resolveManualRateFromCapsule(previewTimeCapsule, inputCurrency, displayCurrency) != null;
    }
    return hasActiveManualOverrideForPair(inputCurrency, displayCurrency);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    manualOverrideVersion,
    showDisplayPreview,
    inputCurrency,
    displayCurrency,
    previewManualRateDisabled,
    previewTimeCapsule,
  ]);

  const amountInputSize = useMemo(() => getAmountInputWidth(amount), [amount]);

  const handleExpenseCurrencyFromLibrary = useCallback(
    (code: CurrencyCode) => {
      onCurrencyChange(code);
    },
    [onCurrencyChange],
  );

  const inputRowClassName = `relative z-10 flex min-w-0 items-center gap-2 ${
    snapInputGroupToColumnEnd ? 'w-fit max-w-full shrink-0' : 'w-full flex-wrap'
  }`;

  const previewMotionClassName = `flex min-w-0 flex-col items-start gap-1 text-sm leading-snug text-neutral-400 ${
    snapInputGroupToColumnEnd ? 'w-full max-w-full' : 'w-full flex-wrap items-center justify-end gap-x-1.5 gap-y-1'
  }`;

  const controlsStackClassName = snapInputGroupToColumnEnd
    ? 'ml-auto flex w-fit max-w-full min-w-0 flex-col gap-2'
    : 'flex min-w-0 flex-col gap-2';

  const controlsOuterClassName = snapInputGroupToColumnEnd
    ? 'w-full min-w-0'
    : 'flex min-w-0 flex-col gap-2';

  return (
    <div className="flex w-full min-w-0 flex-col">
      <label className={`block text-sm font-medium mb-2 ${typographyLabelClass}`}>{tr('amountLabel')}</label>

      <div className={controlsOuterClassName} dir={snapInputGroupToColumnEnd ? 'ltr' : undefined}>
        <div className={controlsStackClassName}>
        <div dir="ltr" className={inputRowClassName}>
          <div ref={currencyMenuRef} className="relative z-20 shrink-0">
            {lockToDisplayCurrency ? (
              <div
                aria-label={tr('currencyLabel')}
                className={`${expenseFormControlClass} flex shrink-0 items-center gap-1.5 px-2.5 sm:gap-2 sm:px-3 text-sm font-medium tabular-nums whitespace-nowrap`}
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
                  ? 'border-violet-500/50 text-violet-100 ring-1 ring-violet-500/25'
                  : 'hover:brightness-110'
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
                className={`absolute top-full start-0 z-30 mt-1.5 w-[min(100vw-2rem,15.5rem)] p-1.5 ${filterDropdownWrapperClass}`}
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
                          : 'text-[var(--color-category-5-muted)] hover:text-[var(--color-category-5)] hover:bg-white/5'
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
                  className="min-w-[3.25rem] flex-1 basis-[calc(25%-0.5rem)] py-2 rounded-lg text-xs font-semibold transition-all active:scale-[0.98] border border-dashed border-[var(--surface-input-border)] text-[var(--color-category-5-muted)] hover:text-[var(--color-category-5)] hover:bg-white/5"
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
              className={`h-12 shrink-0 ${currencyUtilityButtonLgClass}`}
              title={tr('settingsCurrencySubExchange')}
              aria-label={tr('settingsCurrencySubExchange')}
            >
              {tr('settingsCurrencySubExchange')}
            </button>
          )}
        </div>

        <AnimatePresence mode="wait">
          {!isMaxLengthReached && showDisplayPreview && (
            <motion.div
              key={`${inputCurrency}-${displayCurrency}-${amount}-${previewManualRateDisabled}-${previewFeeDisabled}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              dir="ltr"
              className={previewMotionClassName}
              aria-live="polite"
            >
              {loading ? (
                <span className="inline-flex items-center gap-1.5 text-neutral-500">
                  <Loader2 className="w-3 h-3 animate-spin shrink-0" aria-hidden />
                  {tr('loadingExchangeRates')}
                </span>
              ) : error ? (
                <span className="text-amber-400/80">{tr('exchangeRatesUnavailable')}</span>
              ) : convertedAmountFormatted ? (
                <>
                  <span className="inline-flex shrink-0 items-center gap-x-1.5">
                    <CurrencyFlag countryCode={displayMeta.countryCode} size="text" alt="" />
                    <LtrNumeric className="font-medium tabular-nums text-neutral-300/90 whitespace-nowrap">
                      ≈ {convertedAmountFormatted}
                    </LtrNumeric>
                    {activeCommissionPercent > 0 && (
                      <span className="shrink-0 whitespace-nowrap text-neutral-500 text-xs">
                        {tr('inclFeeShort')}
                      </span>
                    )}
                  </span>
                  {hasActivePairManualOverride && (
                    <span className={`shrink-0 whitespace-nowrap text-xs text-amber-400/75 ${typographyMutedClass}`}>
                      {tr('expenseManualRateActiveReminder')}
                    </span>
                  )}
                </>
              ) : (
                <span className="text-amber-400/80">{tr('exchangeRatesUnavailable')}</span>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        </div>
      </div>

      {isMaxLengthReached && (
        <p
          className={`mt-1.5 text-xs text-red-500 whitespace-nowrap ${
            snapInputGroupToColumnEnd ? 'ml-auto w-fit max-w-full' : ''
          }`}
          role="alert"
          dir="ltr"
        >
          {tr('amountTooLarge')}
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
