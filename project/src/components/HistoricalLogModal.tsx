/**
 * Historical Rate & Fee Log Modal
 *
 * Displays the full archive of past manual-rate / fee configurations from
 * `historicalOverrideService` with real-time multi-filter search (date + currency)
 * and per-row deletion that evicts the entry from both localStorage and Firestore.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Globe, History, Pencil, RotateCcw, Search, Trash2, X } from 'lucide-react';
import { auth } from '../firebase';
import { LtrNumeric, useLanguage } from '../LanguageContext';
import {
  CORE_CURRENCY_CODES,
  getCurrencyMeta,
  type ExpenseCurrency,
} from '../constants/currencies';
import {
  GLOBAL_COMMISSION_CURRENCY,
  type CommissionCurrency,
} from '../services/currencyCommissionService';
import CurrencyFlag from './CurrencyFlag';
import {
  deleteHistoricalOverrideEntry,
  historicalDateInRange,
  historicalEntryKey,
  listHistoricalOverrides,
  subscribeHistoricalOverridesUpdated,
  updateHistoricalOverrideEntry,
  type HistoricalOverrideEntry,
} from '../services/historicalOverrideService';
import { deleteHistoricalOverrideFromCloud } from '../services/userFirebaseSync';
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

/** @deprecated Use HistoricalLogScope */
export type HistoricalLogDefaultType = HistoricalLogScope;

/** Which archived field to reactivate through the parent duration-save flow. */
export type HistoricalRestoreKind = 'rate' | 'fee';

interface HistoricalLogModalProps {
  open: boolean;
  onClose: () => void;
  /** Locks the modal to rates-only or fees-only; no cross-category UI. */
  defaultType: HistoricalLogScope;
  /**
   * Invoked when the user chooses to reactivate an archived entry.
   * Parent should populate form state and open the existing duration modal.
   */
  onRestore?: (entry: HistoricalOverrideEntry, kind: HistoricalRestoreKind) => void;
  /** Persist edits from edit mode (local storage + optional cloud sync in parent). */
  onUpdateEntry?: (
    previousEntry: HistoricalOverrideEntry,
    updatedEntry: HistoricalOverrideEntry,
  ) => void | Promise<void>;
}

interface HistoricalEditDraft {
  startDate: string;
  endDate: string;
  endForever: boolean;
  fromCurrency: ExpenseCurrency;
  toCurrency: ExpenseCurrency;
  manualRate: string;
  feePercent: string;
  feeCurrency: CommissionCurrency;
}

const RATE_CURRENCY_OPTIONS = CORE_CURRENCY_CODES as readonly ExpenseCurrency[];

const FEE_CURRENCY_OPTIONS: readonly CommissionCurrency[] = [
  GLOBAL_COMMISSION_CURRENCY,
  ...CORE_CURRENCY_CODES.filter((c) => c !== 'ILS'),
];

function entryMatchesScope(entry: HistoricalOverrideEntry, scope: HistoricalLogScope): boolean {
  if (scope === 'rate') {
    return entry.manualRate != null && entry.manualRate > 0;
  }
  return entry.feePercent != null && entry.feePercent > 0;
}

function resolveRestoreKind(
  entry: HistoricalOverrideEntry,
  scope: HistoricalLogScope,
): HistoricalRestoreKind | null {
  if (!entryMatchesScope(entry, scope)) return null;
  return scope;
}

function formatRateValue(rate: number): string {
  if (rate >= 1000) return rate.toFixed(2);
  if (rate >= 100) return rate.toFixed(3);
  if (rate >= 10) return rate.toFixed(4);
  return rate.toFixed(5);
}

/** Fee-only archive rows (no manual rate) — global ALL or a single expense currency. */
function isGlobalHistoricalFeeEntry(entry: HistoricalOverrideEntry): boolean {
  return (
    entry.fromCurrency === GLOBAL_COMMISSION_CURRENCY ||
    entry.toCurrency === GLOBAL_COMMISSION_CURRENCY
  );
}

function resolveHistoricalFeeCurrency(entry: HistoricalOverrideEntry): ExpenseCurrency | null {
  if (isGlobalHistoricalFeeEntry(entry)) return null;
  if (entry.fromCurrency === 'ILS') return entry.toCurrency;
  if (entry.toCurrency === 'ILS') return entry.fromCurrency;
  return entry.fromCurrency;
}

function formatDateRangeLabel(
  entry: HistoricalOverrideEntry,
  foreverLabel: string,
): string {
  if (entry.endDate === null) {
    return `${entry.startDate} ➡️ ${foreverLabel}`;
  }
  if (entry.startDate === entry.endDate) {
    return entry.startDate;
  }
  return `${entry.startDate} ➡️ ${entry.endDate}`;
}

function buildEditDraft(entry: HistoricalOverrideEntry, scope: HistoricalLogScope): HistoricalEditDraft {
  const feeCurrency: CommissionCurrency = isGlobalHistoricalFeeEntry(entry)
    ? GLOBAL_COMMISSION_CURRENCY
    : (resolveHistoricalFeeCurrency(entry) ?? entry.fromCurrency);

  return {
    startDate: entry.startDate,
    endDate: entry.endDate ?? entry.startDate,
    endForever: entry.endDate === null,
    fromCurrency: entry.fromCurrency,
    toCurrency: entry.toCurrency,
    manualRate:
      entry.manualRate != null && entry.manualRate > 0 ? formatRateValue(entry.manualRate) : '',
    feePercent:
      entry.feePercent != null && entry.feePercent > 0 ? entry.feePercent.toFixed(2) : '',
    feeCurrency,
  };
}

function buildFeeCurrencyPair(currency: CommissionCurrency): {
  fromCurrency: ExpenseCurrency;
  toCurrency: ExpenseCurrency;
} {
  if (currency === GLOBAL_COMMISSION_CURRENCY) {
    return { fromCurrency: 'ILS', toCurrency: 'USD' };
  }
  const code = currency as ExpenseCurrency;
  if (code === 'ILS') return { fromCurrency: 'ILS', toCurrency: 'USD' };
  if (code < 'ILS') return { fromCurrency: code, toCurrency: 'ILS' };
  return { fromCurrency: 'ILS', toCurrency: code };
}

function buildUpdatedEntryFromDraft(
  previous: HistoricalOverrideEntry,
  draft: HistoricalEditDraft,
  scope: HistoricalLogScope,
): HistoricalOverrideEntry | null {
  if (!draft.startDate) return null;
  if (!draft.endForever && !draft.endDate) return null;
  if (!draft.endForever && draft.startDate > draft.endDate) return null;

  const endDate = draft.endForever ? null : draft.endDate;

  if (scope === 'rate') {
    const rate = Number.parseFloat(draft.manualRate.replace(/,/g, ''));
    if (!Number.isFinite(rate) || rate <= 0) return null;
    if (draft.fromCurrency === draft.toCurrency) return null;

    return {
      ...previous,
      date: draft.startDate,
      startDate: draft.startDate,
      endDate,
      fromCurrency: draft.fromCurrency,
      toCurrency: draft.toCurrency,
      manualRate: rate,
      feePercent: previous.feePercent,
    };
  }

  const fee = Number.parseFloat(draft.feePercent.replace(/,/g, ''));
  if (!Number.isFinite(fee) || fee <= 0 || fee > 100) return null;

  const pair = isGlobalHistoricalFeeEntry(previous) && draft.feeCurrency === GLOBAL_COMMISSION_CURRENCY
    ? { fromCurrency: previous.fromCurrency, toCurrency: previous.toCurrency }
    : buildFeeCurrencyPair(draft.feeCurrency);

  return {
    ...previous,
    date: draft.startDate,
    startDate: draft.startDate,
    endDate,
    fromCurrency: pair.fromCurrency,
    toCurrency: pair.toCurrency,
    manualRate: null,
    feePercent: fee,
  };
}

function HistoryRow({
  entry,
  scope,
  editMode,
  isEditing,
  editDraft,
  editError,
  onDelete,
  onRestore,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDraftChange,
  deletingKey,
}: {
  entry: HistoricalOverrideEntry;
  scope: HistoricalLogScope;
  editMode: boolean;
  isEditing: boolean;
  editDraft: HistoricalEditDraft | null;
  editError: string | null;
  onDelete: (entry: HistoricalOverrideEntry) => void;
  onRestore?: (entry: HistoricalOverrideEntry, kind: HistoricalRestoreKind) => void;
  onStartEdit: (entry: HistoricalOverrideEntry) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDraftChange: (patch: Partial<HistoricalEditDraft>) => void;
  deletingKey: string | null;
}) {
  const { tr } = useLanguage();
  const rowKey = historicalEntryKey(entry);
  const isDeleting = deletingKey === rowKey;
  const restoreKind = !editMode && onRestore ? resolveRestoreKind(entry, scope) : null;

  const fromMeta = getCurrencyMeta(entry.fromCurrency);
  const toMeta = getCurrencyMeta(entry.toCurrency);

  const hasRate = entry.manualRate != null && entry.manualRate > 0;
  const hasFee = entry.feePercent != null && entry.feePercent > 0;
  const isFeeOnlyEntry = hasFee && !hasRate;
  const feeCurrency = isFeeOnlyEntry ? resolveHistoricalFeeCurrency(entry) : null;
  const isGlobalFee = isFeeOnlyEntry && isGlobalHistoricalFeeEntry(entry);

  const draft = isEditing ? editDraft : null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: isDeleting ? 0.4 : 1, y: 0 }}
      exit={{ opacity: 0, x: 24, transition: { duration: 0.18 } }}
      transition={{ duration: 0.18 }}
      className="flex flex-col gap-3 rounded-xl border border-neutral-700/60 bg-neutral-950/60 p-3 sm:flex-row sm:items-center sm:gap-4"
    >
      {/* Date badge / date range editors */}
      <div className="flex shrink-0 flex-col gap-1.5 sm:w-[8.5rem]">
        {isEditing && draft ? (
          <>
            <input
              type="date"
              value={draft.startDate}
              onChange={(e) => onDraftChange({ startDate: e.target.value })}
              aria-label={tr('historicalLogStartDate')}
              className={`w-full [color-scheme:dark] ${surfaceInputSmClass}`}
            />
            <div className="flex items-center gap-1">
              <input
                type="date"
                value={draft.endForever ? '' : draft.endDate}
                disabled={draft.endForever}
                onChange={(e) => onDraftChange({ endDate: e.target.value, endForever: false })}
                aria-label={tr('historicalLogEndDate')}
                className={`min-w-0 flex-1 [color-scheme:dark] disabled:opacity-50 ${surfaceInputSmClass}`}
              />
            </div>
            <label className="flex items-center gap-1.5 text-[10px] text-neutral-400">
              <input
                type="checkbox"
                checked={draft.endForever}
                onChange={(e) =>
                  onDraftChange({
                    endForever: e.target.checked,
                    endDate: e.target.checked ? draft.startDate : draft.endDate,
                  })
                }
                className="rounded border-neutral-600"
              />
              {tr('historicalLogEndDateForever')}
            </label>
          </>
        ) : (
          <span
            dir="ltr"
            className="inline-flex shrink-0 items-center rounded-lg border border-neutral-700/60 bg-neutral-800/60 px-2.5 py-1 font-mono text-[11px] font-semibold tabular-nums text-neutral-300"
          >
            {formatDateRangeLabel(entry, tr('historicalLogEndDateForever'))}
          </span>
        )}
      </div>

      {/* Currency pair (rates) or isolated fee currency */}
      <div dir="ltr" className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {isEditing && draft ? (
            scope === 'fee' ? (
              <select
                value={draft.feeCurrency}
                onChange={(e) =>
                  onDraftChange({ feeCurrency: e.target.value as CommissionCurrency })
                }
                className={`min-w-[7rem] ${surfaceInputSmClass}`}
                aria-label={tr('historicalLogFilterCurrency')}
              >
                {FEE_CURRENCY_OPTIONS.map((code) => (
                  <option key={code} value={code}>
                    {code === GLOBAL_COMMISSION_CURRENCY
                      ? tr('historicalLogFeeAllCurrencies')
                      : code}
                  </option>
                ))}
              </select>
            ) : (
              <>
                <select
                  value={draft.fromCurrency}
                  onChange={(e) =>
                    onDraftChange({ fromCurrency: e.target.value as ExpenseCurrency })
                  }
                  className={`min-w-[5rem] ${surfaceInputSmClass}`}
                  aria-label={tr('exchangeRateMainCurrency')}
                >
                  {RATE_CURRENCY_OPTIONS.map((code) => (
                    <option key={`from-${code}`} value={code}>{code}</option>
                  ))}
                </select>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-neutral-500" aria-hidden />
                <select
                  value={draft.toCurrency}
                  onChange={(e) =>
                    onDraftChange({ toCurrency: e.target.value as ExpenseCurrency })
                  }
                  className={`min-w-[5rem] ${surfaceInputSmClass}`}
                  aria-label={tr('exchangeRateSecondaryCurrency')}
                >
                  {RATE_CURRENCY_OPTIONS.map((code) => (
                    <option key={`to-${code}`} value={code}>{code}</option>
                  ))}
                </select>
              </>
            )
          ) : isFeeOnlyEntry ? (
            isGlobalFee ? (
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-200">
                <Globe className="h-4 w-4 shrink-0 text-sky-300" aria-hidden />
                <span>{tr('historicalLogFeeAllCurrencies')}</span>
              </span>
            ) : feeCurrency ? (
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-200">
                <CurrencyFlag
                  countryCode={getCurrencyMeta(feeCurrency).countryCode}
                  size="xs"
                  alt={getCurrencyMeta(feeCurrency).name}
                />
                <span dir="ltr">{feeCurrency}</span>
              </span>
            ) : null
          ) : (
            <>
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-200">
                <CurrencyFlag countryCode={fromMeta.countryCode} size="xs" alt={fromMeta.name} />
                <span dir="ltr">{entry.fromCurrency}</span>
              </span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-neutral-500" aria-hidden />
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-200">
                <CurrencyFlag countryCode={toMeta.countryCode} size="xs" alt={toMeta.name} />
                <span dir="ltr">{entry.toCurrency}</span>
              </span>
            </>
          )}
        </div>

        {/* Rate & fee chips / edit inputs */}
        <div className="flex flex-wrap items-center gap-2">
          {isEditing && draft ? (
            scope === 'rate' ? (
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={draft.manualRate}
                onChange={(e) => onDraftChange({ manualRate: e.target.value })}
                aria-label={tr('historicalLogRate')}
                className={`min-w-[6rem] ${surfaceInputSmClass}`}
              />
            ) : (
              <input
                type="number"
                inputMode="decimal"
                min="0"
                max="100"
                step="0.1"
                value={draft.feePercent}
                onChange={(e) => onDraftChange({ feePercent: e.target.value })}
                aria-label={tr('historicalLogFee')}
                className={`min-w-[5rem] ${surfaceInputSmClass}`}
              />
            )
          ) : (
            <>
              {hasRate && (
                <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-300">
                  <span className={themeTextMutedClass + ' text-[10px]'}>{tr('historicalLogRate')}</span>
                  <LtrNumeric className="font-semibold tabular-nums">
                    {formatRateValue(entry.manualRate!)}
                  </LtrNumeric>
                </span>
              )}
              {hasFee && (
                <span className="inline-flex items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[11px] font-medium text-violet-300">
                  <span className={themeTextMutedClass + ' text-[10px]'}>{tr('historicalLogFee')}</span>
                  <LtrNumeric className="font-semibold tabular-nums">
                    {entry.feePercent!.toFixed(2)}%
                  </LtrNumeric>
                </span>
              )}
            </>
          )}
        </div>

        {isEditing && editError && (
          <p className="text-[11px] text-rose-300" role="alert">{editError}</p>
        )}
      </div>

      {/* Row actions */}
      <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
        {isEditing ? (
          <>
            <button
              type="button"
              onClick={onSaveEdit}
              disabled={isDeleting}
              className="inline-flex min-h-[2.25rem] items-center justify-center rounded-lg border border-sky-500/35 bg-sky-500/15 px-3 py-1.5 text-xs font-semibold text-sky-200 transition-colors hover:bg-sky-500/25 disabled:opacity-40"
            >
              {tr('historicalLogSaveEntry')}
            </button>
            <button
              type="button"
              onClick={onCancelEdit}
              disabled={isDeleting}
              className="inline-flex min-h-[2.25rem] items-center justify-center rounded-lg border border-neutral-600/50 bg-neutral-800/40 px-3 py-1.5 text-xs font-medium text-neutral-300 transition-colors hover:bg-neutral-800/70 disabled:opacity-40"
            >
              {tr('historicalLogCancelEdit')}
            </button>
          </>
        ) : editMode ? (
          <button
            type="button"
            onClick={() => onStartEdit(entry)}
            disabled={isDeleting}
            aria-label={tr('historicalLogEditRow')}
            className="inline-flex min-h-[2.25rem] items-center justify-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs font-medium text-amber-200 transition-all hover:border-amber-500/50 hover:bg-amber-500/20 disabled:opacity-40"
          >
            <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="hidden sm:inline">{tr('historicalLogEditRow')}</span>
          </button>
        ) : (
          <>
            {restoreKind && (
              <button
                type="button"
                onClick={() => onRestore!(entry, restoreKind)}
                disabled={isDeleting}
                aria-label={tr('historicalLogRestoreEntry')}
                title={tr('historicalLogRestoreEntry')}
                className="inline-flex min-h-[2.25rem] items-center justify-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-medium text-emerald-300 transition-all hover:border-emerald-500/50 hover:bg-emerald-500/20 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <RotateCcw className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="hidden sm:inline">{tr('historicalLogRestoreEntry')}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onDelete(entry)}
              disabled={isDeleting}
              aria-label={tr('historicalLogDeleteEntry')}
              className="flex items-center justify-center rounded-lg border border-rose-500/30 bg-rose-500/10 p-2 text-rose-300 transition-all hover:border-rose-500/50 hover:bg-rose-500/20 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
}

export default function HistoricalLogModal({
  open,
  onClose,
  defaultType,
  onRestore,
  onUpdateEntry,
}: HistoricalLogModalProps) {
  const { tr, dir } = useLanguage();

  const [entries, setEntries] = useState<HistoricalOverrideEntry[]>([]);
  const [filterDate, setFilterDate] = useState('');
  const [filterCurrency, setFilterCurrency] = useState('');
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [deletedToast, setDeletedToast] = useState(false);
  const [updatedToast, setUpdatedToast] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<HistoricalOverrideEntry | null>(null);
  const [editDraft, setEditDraft] = useState<HistoricalEditDraft | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const modalTitleKey =
    defaultType === 'rate' ? 'historicalLogTitleRates' : 'historicalLogTitleFees';

  const clearEditState = useCallback(() => {
    setEditingKey(null);
    setEditingEntry(null);
    setEditDraft(null);
    setEditError(null);
  }, []);

  // Refresh entries from service.
  const refreshEntries = useCallback(() => {
    setEntries(listHistoricalOverrides());
  }, []);

  // Load on open and subscribe to changes.
  useEffect(() => {
    if (!open) return;
    refreshEntries();
    setFilterDate('');
    setFilterCurrency('');
    setEditMode(false);
    clearEditState();
    return subscribeHistoricalOverridesUpdated(refreshEntries);
  }, [open, refreshEntries, clearEditState]);

  /** Entries locked to the modal's category — never mixed across rate/fee. */
  const scopedEntries = useMemo(
    () => entries.filter((e) => entryMatchesScope(e, defaultType)),
    [entries, defaultType],
  );

  // Real-time filtered list within the locked scope (descending by date, then updatedAt).
  const filtered = useMemo(() => {
    const normalizedCurrency = filterCurrency.trim().toUpperCase();
    const normalizedDate = filterDate.trim();

    return scopedEntries.filter((e) => {
      const matchDate = !normalizedDate || historicalDateInRange(normalizedDate, e);
      const matchCurrency =
        !normalizedCurrency ||
        e.fromCurrency.includes(normalizedCurrency) ||
        e.toCurrency.includes(normalizedCurrency);
      return matchDate && matchCurrency;
    });
  }, [scopedEntries, filterDate, filterCurrency]);

  const hasFilters = filterDate.trim() !== '' || filterCurrency.trim() !== '';

  const clearFilters = useCallback(() => {
    setFilterDate('');
    setFilterCurrency('');
  }, []);

  const showDeletedToast = useCallback(() => {
    setDeletedToast(true);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setDeletedToast(false), 2200);
  }, []);

  const showUpdatedToast = useCallback(() => {
    setUpdatedToast(true);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setUpdatedToast(false), 2200);
  }, []);

  const handleToggleEditMode = useCallback(() => {
    setEditMode((prev) => {
      if (prev) clearEditState();
      return !prev;
    });
  }, [clearEditState]);

  const handleStartEdit = useCallback(
    (entry: HistoricalOverrideEntry) => {
      const key = historicalEntryKey(entry);
      setEditingKey(key);
      setEditingEntry(entry);
      setEditDraft(buildEditDraft(entry, defaultType));
      setEditError(null);
    },
    [defaultType],
  );

  const handleDraftChange = useCallback((patch: Partial<HistoricalEditDraft>) => {
    setEditDraft((prev) => (prev ? { ...prev, ...patch } : prev));
    setEditError(null);
  }, []);

  const handleCancelEdit = useCallback(() => {
    clearEditState();
  }, [clearEditState]);

  const handleSaveEdit = useCallback(async () => {
    if (!editingEntry || !editDraft) return;

    if (!editDraft.endForever && editDraft.startDate > editDraft.endDate) {
      setEditError(tr('historicalLogDateRangeInvalid'));
      return;
    }

    const updated = buildUpdatedEntryFromDraft(editingEntry, editDraft, defaultType);
    if (!updated) {
      setEditError(tr('historicalLogDateRangeInvalid'));
      return;
    }

    if (onUpdateEntry) {
      await onUpdateEntry(editingEntry, updated).catch(() => {});
    } else {
      const ok = updateHistoricalOverrideEntry(editingEntry, updated);
      if (!ok) {
        setEditError(tr('historicalLogDateRangeInvalid'));
        return;
      }
    }

    clearEditState();
    showUpdatedToast();
  }, [
    editingEntry,
    editDraft,
    defaultType,
    onUpdateEntry,
    clearEditState,
    showUpdatedToast,
    tr,
  ]);

  const handleRestore = useCallback(
    (entry: HistoricalOverrideEntry, kind: HistoricalRestoreKind) => {
      onRestore?.(entry, kind);
    },
    [onRestore],
  );

  const handleDelete = useCallback(
    async (entry: HistoricalOverrideEntry) => {
      const rowKey = historicalEntryKey(entry);
      setDeletingKey(rowKey);

      deleteHistoricalOverrideEntry(entry);

      const currentUser = auth.currentUser;
      if (currentUser && !currentUser.isAnonymous) {
        await deleteHistoricalOverrideFromCloud(currentUser.uid, entry).catch(() => {});
      }

      setDeletingKey(null);
      showDeletedToast();
    },
    [showDeletedToast],
  );

  if (!open) return null;

  const isEmpty = scopedEntries.length === 0;
  const isEmptyFiltered = !isEmpty && filtered.length === 0;

  return (
    <div
      dir={dir}
      className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="historical-log-modal-title"
    >
      {/* Backdrop */}
      <button
        type="button"
        onClick={onClose}
        aria-label={tr('close')}
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
      />

      {/* Modal panel */}
      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className={`relative flex w-full flex-col sm:max-w-xl ${surfaceModalLgClass}`}
        style={{
          maxHeight: 'min(92dvh, 680px)',
          paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))',
        }}
      >
        {/* Header */}
        <div className="flex shrink-0 items-start gap-3 border-b border-white/8 px-5 pt-5 pb-4">
          <History className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" aria-hidden />
          <h2
            id="historical-log-modal-title"
            className={`min-w-0 flex-1 text-base font-bold leading-snug sm:text-lg ${typographyTitleClass}`}
          >
            {tr(modalTitleKey)}
          </h2>
          <button
            type="button"
            onClick={handleToggleEditMode}
            aria-pressed={editMode}
            className={`shrink-0 inline-flex min-h-[2.25rem] items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
              editMode
                ? 'border-amber-500/50 bg-amber-500/20 text-amber-200'
                : 'border-neutral-600/50 bg-neutral-800/40 text-neutral-300 hover:bg-neutral-800/70'
            }`}
          >
            <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>{tr('historicalLogEditMode')}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className={`shrink-0 ${utilityIconButtonGhostClass}`}
            aria-label={tr('close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Filter bar */}
        {!isEmpty && (
          <div className="flex shrink-0 flex-wrap gap-2 border-b border-white/8 px-5 py-3">
            {/* Date filter */}
            <div className="relative flex min-w-[7rem] flex-1 items-center">
              <Search
                className="pointer-events-none absolute start-2.5 h-3.5 w-3.5 text-neutral-500"
                aria-hidden
              />
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                aria-label={tr('historicalLogFilterDate')}
                placeholder={tr('historicalLogFilterDate')}
                className={`w-full ps-8 [color-scheme:dark] ${surfaceInputSmClass}`}
              />
            </div>

            {/* Currency filter */}
            <div className="relative flex min-w-[7rem] flex-1 items-center">
              <Search
                className="pointer-events-none absolute start-2.5 h-3.5 w-3.5 text-neutral-500"
                aria-hidden
              />
              <input
                type="text"
                value={filterCurrency}
                onChange={(e) => setFilterCurrency(e.target.value)}
                maxLength={5}
                aria-label={tr('historicalLogFilterCurrency')}
                placeholder={tr('historicalLogFilterCurrency')}
                className={`w-full ps-8 uppercase ${surfaceInputSmClass}`}
              />
            </div>

            {/* Clear filters */}
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className={`shrink-0 ${utilityNavCompactButtonClass}`}
              >
                {tr('historicalLogClearFilters')}
              </button>
            )}
          </div>
        )}

        {/* Scrollable list */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {isEmpty ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <History className="h-10 w-10 text-neutral-600" aria-hidden />
              <p className={`text-sm ${themeTextMutedClass}`}>{tr('historicalLogEmpty')}</p>
            </div>
          ) : isEmptyFiltered ? (
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
              <Search className="h-8 w-8 text-neutral-600" aria-hidden />
              <p className={`text-sm ${themeTextMutedClass}`}>{tr('historicalLogEmptyFiltered')}</p>
              <button
                type="button"
                onClick={clearFilters}
                className={`text-xs ${utilityNavCompactButtonClass}`}
              >
                {tr('historicalLogClearFilters')}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {/* Entry count context */}
              <p className={`mb-1 text-xs ${typographyLabelClass}`}>
                {filtered.length} / {scopedEntries.length}
              </p>

              <AnimatePresence initial={false}>
                {filtered.map((entry) => {
                  const rowKey = historicalEntryKey(entry);
                  return (
                    <HistoryRow
                      key={rowKey}
                      entry={entry}
                      scope={defaultType}
                      editMode={editMode}
                      isEditing={editingKey === rowKey}
                      editDraft={editingKey === rowKey ? editDraft : null}
                      editError={editingKey === rowKey ? editError : null}
                      onDelete={(e) => void handleDelete(e)}
                      onRestore={!editMode && onRestore ? handleRestore : undefined}
                      onStartEdit={handleStartEdit}
                      onSaveEdit={() => void handleSaveEdit()}
                      onCancelEdit={handleCancelEdit}
                      onDraftChange={handleDraftChange}
                      deletingKey={deletingKey}
                    />
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Toast notifications */}
        <AnimatePresence>
          {deletedToast && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.18 }}
              className="pointer-events-none absolute inset-x-4 bottom-4 flex justify-center"
            >
              <span className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-300 shadow-lg shadow-black/30">
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                {tr('historicalLogDeletedToast')}
              </span>
            </motion.div>
          )}
          {updatedToast && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.18 }}
              className="pointer-events-none absolute inset-x-4 bottom-4 flex justify-center"
            >
              <span className="inline-flex items-center gap-2 rounded-xl border border-sky-500/30 bg-sky-500/15 px-4 py-2 text-sm font-medium text-sky-300 shadow-lg shadow-black/30">
                <Pencil className="h-3.5 w-3.5" aria-hidden />
                {tr('historicalLogUpdatedToast')}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
