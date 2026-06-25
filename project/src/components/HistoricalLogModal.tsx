/**
 * Historical Log Modal — archive-only view.
 *
 * Shows only INACTIVE (archived) manual rate / commission entries.
 * Active entries live in the Simulator panel and do NOT appear here.
 *
 * Per row: currency pair / value, a Reactivate button (clones entry back to
 * active), and a permanent-delete button.  No active-toggle UI.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Globe, RotateCcw, Search, Trash2, X } from 'lucide-react';
import { auth } from '../firebase';
import { useLanguage } from '../LanguageContext';
import { CORE_CURRENCY_CODES, getCurrencyMeta, type ExpenseCurrency } from '../constants/currencies';
import {
  GLOBAL_COMMISSION_CURRENCY,
  type CommissionCurrency,
  type CurrencyCommissionEntry,
  deleteCurrencyCommission,
  listArchivedCurrencyCommissions,
  subscribeCurrencyCommissionsUpdated,
} from '../services/currencyCommissionService';
import {
  type ManualExchangeOverrideEntry,
  deleteManualExchangeOverride,
  listArchivedManualExchangeOverrides,
  subscribeManualOverridesUpdated,
} from '../services/manualExchangeOverrideService';
import {
  deleteManualExchangeOverrideFromCloud,
  deleteCurrencyCommissionFromCloud,
  shouldSyncToFirestore,
} from '../services/userFirebaseSync';
import CurrencyFlag from './CurrencyFlag';
import {
  surfaceInputSmClass,
  surfaceModalLgClass,
  themeTextMutedClass,
  typographyLabelClass,
  typographyTitleClass,
} from '../styles/themeSurfaceStyles';
import {
  utilityIconButtonGhostClass,
  utilityNavCompactButtonClass,
} from '../styles/actionButtonStyles';

/** Locked display scope — each modal instance shows exactly one category. */
export type HistoricalLogScope = 'rate' | 'fee';

/** @deprecated kept for call-site compatibility */
export type HistoricalLogDefaultType = HistoricalLogScope;
/** @deprecated kept for call-site compatibility */
export type HistoricalRestoreKind = 'rate' | 'fee';

interface HistoricalLogModalProps {
  open: boolean;
  onClose: () => void;
  /** Locks the modal to rates-only or fees-only; no cross-category UI. */
  defaultType: HistoricalLogScope;
  /** Called when the user reactivates an archived manual rate. */
  onRestoreRate?: (entry: ManualExchangeOverrideEntry) => void;
  /** Called when the user reactivates an archived commission fee. */
  onRestoreFee?: (entry: CurrencyCommissionEntry) => void;
}

// Keep these exported so older callers compile without errors
export const RATE_CURRENCY_OPTIONS = CORE_CURRENCY_CODES as readonly ExpenseCurrency[];
export const FEE_CURRENCY_OPTIONS: readonly CommissionCurrency[] = [
  GLOBAL_COMMISSION_CURRENCY,
  ...CORE_CURRENCY_CODES.filter((c) => c !== 'ILS'),
];

// ── Rate entry row ─────────────────────────────────────────────────────────

function RateEntryRow({
  entry,
  onReactivate,
  onDelete,
}: {
  entry: ManualExchangeOverrideEntry;
  onReactivate: (entry: ManualExchangeOverrideEntry) => void;
  onDelete: (entry: ManualExchangeOverrideEntry) => void;
}) {
  const { tr, dir } = useLanguage();
  const baseMeta = getCurrencyMeta(entry.baseCurrency);
  const quoteMeta = getCurrencyMeta(entry.quoteCurrency);

  const rateDisplay =
    entry.rate > 0
      ? `1 ${entry.baseCurrency} = ${entry.rate.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 6,
        })} ${entry.quoteCurrency}`
      : '—';

  return (
    <div
      dir={dir}
      className="flex items-center gap-3 rounded-xl border border-[var(--color-sub-cards-border)] bg-[var(--color-depth-inner)] p-3 transition-colors"
    >
      {/* Currency pair */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div className="flex shrink-0 items-center gap-1">
          <CurrencyFlag countryCode={baseMeta.countryCode} size="sm" alt={entry.baseCurrency} />
          <CurrencyFlag countryCode={quoteMeta.countryCode} size="sm" alt={entry.quoteCurrency} />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`truncate text-sm font-semibold ${typographyLabelClass}`}>
            {entry.baseCurrency} / {entry.quoteCurrency}
          </p>
          <p className={`truncate text-xs ${themeTextMutedClass}`} dir="ltr">
            {rateDisplay}
          </p>
        </div>
      </div>

      {/* Reactivate */}
      <button
        type="button"
        onClick={() => onReactivate(entry)}
        className="inline-flex min-h-[2rem] shrink-0 items-center justify-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-medium text-emerald-300 transition-all hover:border-emerald-500/50 hover:bg-emerald-500/20 active:scale-95"
        aria-label={tr('historicalLogRestoreEntry')}
        title={tr('historicalLogRestoreEntry')}
      >
        <RotateCcw className="h-3.5 w-3.5" aria-hidden />
        <span className="hidden sm:inline">{tr('historicalLogRestoreEntry')}</span>
      </button>

      {/* Permanent delete */}
      <button
        type="button"
        onClick={() => onDelete(entry)}
        className={`shrink-0 ${utilityIconButtonGhostClass}`}
        aria-label={tr('rateLogDeleteEntry')}
        title={tr('rateLogDeleteEntry')}
      >
        <Trash2 className="h-4 w-4 text-rose-400" />
      </button>
    </div>
  );
}

// ── Fee entry row ──────────────────────────────────────────────────────────

function FeeEntryRow({
  entry,
  onReactivate,
  onDelete,
}: {
  entry: CurrencyCommissionEntry;
  onReactivate: (entry: CurrencyCommissionEntry) => void;
  onDelete: (entry: CurrencyCommissionEntry) => void;
}) {
  const { tr, dir } = useLanguage();
  const isGlobal = entry.currency === GLOBAL_COMMISSION_CURRENCY;
  const meta = isGlobal ? null : getCurrencyMeta(entry.currency as ExpenseCurrency);

  return (
    <div
      dir={dir}
      className="flex items-center gap-3 rounded-xl border border-[var(--color-sub-cards-border)] bg-[var(--color-depth-inner)] p-3 transition-colors"
    >
      {/* Currency */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div className="shrink-0">
          {isGlobal ? (
            <Globe className="h-5 w-5 text-neutral-400" aria-hidden />
          ) : meta ? (
            <CurrencyFlag countryCode={meta.countryCode} size="sm" alt={entry.currency} />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className={`truncate text-sm font-semibold ${typographyLabelClass}`}>
            {isGlobal ? tr('historicalLogFeeAllCurrencies') : entry.currency}
          </p>
          <p className={`truncate text-xs ${themeTextMutedClass}`} dir="ltr">
            {entry.percent.toFixed(2)}%
          </p>
        </div>
      </div>

      {/* Reactivate */}
      <button
        type="button"
        onClick={() => onReactivate(entry)}
        className="inline-flex min-h-[2rem] shrink-0 items-center justify-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-medium text-emerald-300 transition-all hover:border-emerald-500/50 hover:bg-emerald-500/20 active:scale-95"
        aria-label={tr('historicalLogRestoreEntry')}
        title={tr('historicalLogRestoreEntry')}
      >
        <RotateCcw className="h-3.5 w-3.5" aria-hidden />
        <span className="hidden sm:inline">{tr('historicalLogRestoreEntry')}</span>
      </button>

      {/* Permanent delete */}
      <button
        type="button"
        onClick={() => onDelete(entry)}
        className={`shrink-0 ${utilityIconButtonGhostClass}`}
        aria-label={tr('rateLogDeleteEntry')}
        title={tr('rateLogDeleteEntry')}
      >
        <Trash2 className="h-4 w-4 text-rose-400" />
      </button>
    </div>
  );
}

// ── Main modal ─────────────────────────────────────────────────────────────

export default function HistoricalLogModal({
  open,
  onClose,
  defaultType,
  onRestoreRate,
  onRestoreFee,
}: HistoricalLogModalProps) {
  const { tr, dir } = useLanguage();
  const scope = defaultType;

  const [rateEntries, setRateEntries] = useState<ManualExchangeOverrideEntry[]>([]);
  const [feeEntries, setFeeEntries] = useState<CurrencyCommissionEntry[]>([]);
  const [currencyFilter, setCurrencyFilter] = useState('');
  const [deletedToast, setDeletedToast] = useState(false);
  const [reactivatedToast, setReactivatedToast] = useState(false);

  const refreshRates = useCallback(() => setRateEntries(listArchivedManualExchangeOverrides()), []);
  const refreshFees = useCallback(() => setFeeEntries(listArchivedCurrencyCommissions()), []);

  useEffect(() => {
    if (!open) return;
    refreshRates();
    refreshFees();
  }, [open, refreshRates, refreshFees]);

  useEffect(() => {
    if (!open) return;
    const unsubRates = subscribeManualOverridesUpdated(refreshRates);
    const unsubFees = subscribeCurrencyCommissionsUpdated(refreshFees);
    return () => {
      unsubRates();
      unsubFees();
    };
  }, [open, refreshRates, refreshFees]);

  const filterText = currencyFilter.trim().toUpperCase().slice(0, 5);

  const filteredRates = useMemo(() => {
    if (!filterText) return rateEntries;
    return rateEntries.filter(
      (e) => e.baseCurrency.includes(filterText) || e.quoteCurrency.includes(filterText),
    );
  }, [rateEntries, filterText]);

  const filteredFees = useMemo(() => {
    if (!filterText) return feeEntries;
    return feeEntries.filter((e) => String(e.currency).includes(filterText));
  }, [feeEntries, filterText]);

  const showDeletedToast = useCallback(() => {
    setDeletedToast(true);
    setTimeout(() => setDeletedToast(false), 2200);
  }, []);

  const showReactivatedToast = useCallback(() => {
    setReactivatedToast(true);
    setTimeout(() => setReactivatedToast(false), 2200);
  }, []);

  // ── Rate handlers ────────────────────────────────────────────────────────

  const handleReactivateRate = useCallback(
    (entry: ManualExchangeOverrideEntry) => {
      onRestoreRate?.(entry);
      showReactivatedToast();
    },
    [onRestoreRate, showReactivatedToast],
  );

  const handleDeleteRate = useCallback(
    async (entry: ManualExchangeOverrideEntry) => {
      deleteManualExchangeOverride(entry.id);
      showDeletedToast();
      const currentUser = auth.currentUser;
      if (shouldSyncToFirestore(currentUser)) {
        await deleteManualExchangeOverrideFromCloud(
          currentUser.uid,
          entry.baseCurrency,
          entry.quoteCurrency,
        ).catch(() => {});
      }
    },
    [showDeletedToast],
  );

  // ── Fee handlers ─────────────────────────────────────────────────────────

  const handleReactivateFee = useCallback(
    (entry: CurrencyCommissionEntry) => {
      onRestoreFee?.(entry);
      showReactivatedToast();
    },
    [onRestoreFee, showReactivatedToast],
  );

  const handleDeleteFee = useCallback(
    async (entry: CurrencyCommissionEntry) => {
      deleteCurrencyCommission(entry.id);
      showDeletedToast();
      const currentUser = auth.currentUser;
      if (shouldSyncToFirestore(currentUser)) {
        await deleteCurrencyCommissionFromCloud(currentUser.uid, entry.currency).catch(() => {});
      }
    },
    [showDeletedToast],
  );

  if (!open) return null;

  const title = scope === 'rate' ? tr('rateLogTitle') : tr('rateLogTitleFees');
  const isEmpty = scope === 'rate' ? filteredRates.length === 0 : filteredFees.length === 0;
  const hasEntries = scope === 'rate' ? rateEntries.length > 0 : feeEntries.length > 0;
  const emptyKey = hasEntries && filterText ? 'rateLogEmptyFiltered' : 'rateLogEmpty';

  return (
    <div
      dir={dir}
      className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rate-log-modal-title"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={tr('close')}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />

      <div
        className={`relative flex max-h-[85dvh] w-full flex-col border border-[var(--color-sub-cards-border)] sm:max-w-lg ${surfaceModalLgClass}`}
        style={{ paddingBottom: 'max(0px, env(safe-area-inset-bottom))' }}
      >
        {/* Header */}
        <div className="flex shrink-0 items-start gap-3 border-b border-[var(--color-sub-cards-border)] p-5">
          <h2
            id="rate-log-modal-title"
            className={`min-w-0 flex-1 text-base font-bold leading-snug sm:text-lg ${typographyTitleClass}`}
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className={`shrink-0 ${utilityIconButtonGhostClass}`}
            aria-label={tr('close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Currency filter */}
        <div className="shrink-0 border-b border-[var(--color-sub-cards-border)] p-3 sm:p-4">
          <div className="relative">
            <Search
              className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500"
              aria-hidden
            />
            <input
              type="text"
              value={currencyFilter}
              onChange={(e) => setCurrencyFilter(e.target.value)}
              placeholder={tr('rateLogFilterCurrency')}
              maxLength={6}
              className={`w-full ps-9 pe-3 ${surfaceInputSmClass}`}
              aria-label={tr('rateLogFilterCurrency')}
            />
          </div>
        </div>

        {/* Entries list */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4">
          {isEmpty ? (
            <p className={`py-8 text-center text-sm ${themeTextMutedClass}`}>{tr(emptyKey)}</p>
          ) : (
            <div className="flex flex-col gap-2">
              {scope === 'rate'
                ? filteredRates.map((entry) => (
                    <RateEntryRow
                      key={entry.id}
                      entry={entry}
                      onReactivate={handleReactivateRate}
                      onDelete={(e) => void handleDeleteRate(e)}
                    />
                  ))
                : filteredFees.map((entry) => (
                    <FeeEntryRow
                      key={entry.id}
                      entry={entry}
                      onReactivate={handleReactivateFee}
                      onDelete={(e) => void handleDeleteFee(e)}
                    />
                  ))}
            </div>
          )}
        </div>

        {/* Close footer */}
        <div className="shrink-0 border-t border-[var(--color-sub-cards-border)] p-3 sm:p-4">
          <button
            type="button"
            onClick={onClose}
            className={`w-full min-h-[2.75rem] px-4 text-sm ${utilityNavCompactButtonClass}`}
          >
            {tr('close')}
          </button>
        </div>

        {/* Toasts */}
        <AnimatePresence>
          {deletedToast && (
            <motion.div
              key="deleted-toast"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none absolute bottom-20 left-1/2 -translate-x-1/2 rounded-full bg-neutral-800 px-4 py-2 text-xs font-medium text-white shadow-lg"
            >
              {tr('rateLogDeletedToast')}
            </motion.div>
          )}
          {reactivatedToast && (
            <motion.div
              key="reactivated-toast"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none absolute bottom-20 left-1/2 -translate-x-1/2 rounded-full bg-emerald-900/90 px-4 py-2 text-xs font-medium text-emerald-200 shadow-lg"
            >
              {tr('historicalLogRestoreEntry')}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
