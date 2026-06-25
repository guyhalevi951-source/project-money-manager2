/**
 * Rate & Fee Log Modal (formerly Historical Log)
 *
 * Displays all saved manual rate / commission entries with isActive toggle
 * and delete. No date columns, no date filters — purely status-bound records.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Globe, Search, Trash2, X } from 'lucide-react';
import { auth } from '../firebase';
import { useLanguage } from '../LanguageContext';
import { CORE_CURRENCY_CODES, getCurrencyMeta, type ExpenseCurrency } from '../constants/currencies';
import {
  GLOBAL_COMMISSION_CURRENCY,
  type CommissionCurrency,
  type CurrencyCommissionEntry,
  deleteCurrencyCommission,
  listAllCurrencyCommissions,
  setCurrencyCommissionActive,
  subscribeCurrencyCommissionsUpdated,
} from '../services/currencyCommissionService';
import {
  type ManualExchangeOverrideEntry,
  deleteManualExchangeOverride,
  listAllManualExchangeOverrides,
  setManualOverrideActive,
  subscribeManualOverridesUpdated,
} from '../services/manualExchangeOverrideService';
import {
  deleteManualExchangeOverrideFromCloud,
  deleteCurrencyCommissionFromCloud,
  saveManualExchangeOverrideToCloud,
  saveCurrencyCommissionToCloud,
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
}

const RATE_CURRENCY_OPTIONS = CORE_CURRENCY_CODES as readonly ExpenseCurrency[];

const FEE_CURRENCY_OPTIONS: readonly CommissionCurrency[] = [
  GLOBAL_COMMISSION_CURRENCY,
  ...CORE_CURRENCY_CODES.filter((c) => c !== 'ILS'),
];

// ── Toggle switch component ────────────────────────────────────────────────

function ActiveToggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={[
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500',
        checked ? 'bg-emerald-500' : 'bg-neutral-600',
      ].join(' ')}
    >
      <span
        aria-hidden
        className={[
          'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow ring-0 transition-transform duration-200 ease-in-out',
          checked ? 'translate-x-4' : 'translate-x-0',
        ].join(' ')}
      />
    </button>
  );
}

// ── Rate entry row ─────────────────────────────────────────────────────────

function RateEntryRow({
  entry,
  onToggle,
  onDelete,
}: {
  entry: ManualExchangeOverrideEntry;
  onToggle: (id: string, active: boolean) => void;
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
      className={[
        'flex items-center gap-3 rounded-xl border p-3 transition-colors',
        entry.isActive
          ? 'border-[var(--color-sub-cards-border)] bg-[var(--color-sub-cards)]'
          : 'border-[var(--color-sub-cards-border)] bg-[var(--color-depth-inner)] opacity-60',
      ].join(' ')}
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

      {/* Active toggle */}
      <ActiveToggle
        checked={entry.isActive}
        onChange={(v) => onToggle(entry.id, v)}
        label={tr('rateLogActiveToggle')}
      />

      {/* Delete */}
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
  onToggle,
  onDelete,
}: {
  entry: CurrencyCommissionEntry;
  onToggle: (id: string, active: boolean) => void;
  onDelete: (entry: CurrencyCommissionEntry) => void;
}) {
  const { tr, dir } = useLanguage();
  const isGlobal = entry.currency === GLOBAL_COMMISSION_CURRENCY;
  const meta = isGlobal ? null : getCurrencyMeta(entry.currency as ExpenseCurrency);

  return (
    <div
      dir={dir}
      className={[
        'flex items-center gap-3 rounded-xl border p-3 transition-colors',
        entry.isActive
          ? 'border-[var(--color-sub-cards-border)] bg-[var(--color-sub-cards)]'
          : 'border-[var(--color-sub-cards-border)] bg-[var(--color-depth-inner)] opacity-60',
      ].join(' ')}
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

      {/* Active toggle */}
      <ActiveToggle
        checked={entry.isActive}
        onChange={(v) => onToggle(entry.id, v)}
        label={tr('rateLogActiveToggle')}
      />

      {/* Delete */}
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

export default function HistoricalLogModal({ open, onClose, defaultType }: HistoricalLogModalProps) {
  const { tr, dir } = useLanguage();
  const scope = defaultType;

  const [rateEntries, setRateEntries] = useState<ManualExchangeOverrideEntry[]>([]);
  const [feeEntries, setFeeEntries] = useState<CurrencyCommissionEntry[]>([]);
  const [currencyFilter, setCurrencyFilter] = useState('');
  const [deletedToast, setDeletedToast] = useState(false);

  const refreshRates = useCallback(() => setRateEntries(listAllManualExchangeOverrides()), []);
  const refreshFees = useCallback(() => setFeeEntries(listAllCurrencyCommissions()), []);

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
      (e) =>
        e.baseCurrency.includes(filterText) ||
        e.quoteCurrency.includes(filterText),
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

  // ── Rate handlers ────────────────────────────────────────────────────────

  const handleToggleRate = useCallback(async (id: string, active: boolean) => {
    setManualOverrideActive(id, active);
    const currentUser = auth.currentUser;
    if (shouldSyncToFirestore(currentUser)) {
      const entry = listAllManualExchangeOverrides().find((e) => e.id === id);
      if (entry) {
        await saveManualExchangeOverrideToCloud(
          currentUser.uid,
          entry.baseCurrency,
          entry.quoteCurrency,
          entry.rate,
          entry.pairSpecific,
          active,
        ).catch(() => {});
      }
    }
  }, []);

  const handleDeleteRate = useCallback(async (entry: ManualExchangeOverrideEntry) => {
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
  }, [showDeletedToast]);

  // ── Fee handlers ─────────────────────────────────────────────────────────

  const handleToggleFee = useCallback(async (id: string, active: boolean) => {
    setCurrencyCommissionActive(id, active);
    const currentUser = auth.currentUser;
    if (shouldSyncToFirestore(currentUser)) {
      const entry = listAllCurrencyCommissions().find((e) => e.id === id);
      if (entry) {
        await saveCurrencyCommissionToCloud(
          currentUser.uid,
          entry.currency,
          entry.percent,
          active,
        ).catch(() => {});
      }
    }
  }, []);

  const handleDeleteFee = useCallback(async (entry: CurrencyCommissionEntry) => {
    deleteCurrencyCommission(entry.id);
    showDeletedToast();
    const currentUser = auth.currentUser;
    if (shouldSyncToFirestore(currentUser)) {
      await deleteCurrencyCommissionFromCloud(currentUser.uid, entry.currency).catch(() => {});
    }
  }, [showDeletedToast]);

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
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" aria-hidden />
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
            <p className={`py-8 text-center text-sm ${themeTextMutedClass}`}>
              {tr(emptyKey)}
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {scope === 'rate'
                ? filteredRates.map((entry) => (
                    <RateEntryRow
                      key={entry.id}
                      entry={entry}
                      onToggle={(id, active) => void handleToggleRate(id, active)}
                      onDelete={(e) => void handleDeleteRate(e)}
                    />
                  ))
                : filteredFees.map((entry) => (
                    <FeeEntryRow
                      key={entry.id}
                      entry={entry}
                      onToggle={(id, active) => void handleToggleFee(id, active)}
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

        {/* Deleted toast */}
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
        </AnimatePresence>
      </div>
    </div>
  );
}
