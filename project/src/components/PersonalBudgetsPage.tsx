import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Briefcase,
  Calendar,
  Car,
  Check,
  ChevronRight,
  Coffee,
  Gift,
  Home,
  Palette,
  Plane,
  Plus,
  ShoppingCart,
  Wallet,
  type LucideProps,
} from 'lucide-react';
import { isCustomHexColor, normalizeCustomHex } from '../categories';
import { useLanguage, LtrNumeric } from '../LanguageContext';
import {
  primaryActionButtonClass,
  primaryActionDisabled,
  primaryActionSelectedChipClass,
  primaryActionButtonBorderedClass,
  utilityNavButtonLgClass,
  filterDropdownWrapperClass,
} from '../styles/actionButtonStyles';
import {
  computeFloatingAnchorPosition,
  dashedEmptyStateClass,
  monochromeToastPanelClass,
  subCardListRowClass,
  subCardOptionRowClass,
  surfaceInputClass,
  surfaceInputLgClass,
  surfaceModalLgClass,
  themeCardClass,
  themeFloatingHostClass,
  themeFloatingOverlayClass,
  themeTextClass,
  themeTextMutedClass,
  typographyLabelClass,
  typographyTitleClass,
} from '../styles/themeSurfaceStyles';
import AdvancedColorPickerPopover from './AdvancedColorPickerPopover';
import CurrencySelector from './CurrencySelector';
import { formatAmountWithSymbol } from '../services/displayCurrencyUtils';
import type { ExpenseCurrency } from '../services/exchangeRateService';
import type { CurrencyCode } from '../constants/currencies';
import { parseMoneyInput, roundMoney, sanitizeMoneyInputDraft } from '../services/money';
import {
  type BudgetSettingsInitMode,
  type PersonalBudgetMeta,
  type PersonalBudgetStatus,
} from '../services/budgetArchitecture';
import {
  budgetDebug,
  snapshotRegistryTotalsForLog,
} from '../services/budgetDebugTrace';

const BUDGET_COLOR_OPTIONS = [
  { id: 'emerald', hex: '#10B981' },
  { id: 'blue', hex: '#3B82F6' },
  { id: 'indigo', hex: '#6366F1' },
  { id: 'violet', hex: '#8B5CF6' },
  { id: 'amber', hex: '#F59E0B' },
  { id: 'rose', hex: '#F43F5E' },
  { id: 'teal', hex: '#14B8A6' },
  { id: 'cyan', hex: '#06B6D4' },
] as const;

const BUDGET_ICON_OPTIONS: { id: string; Icon: ComponentType<LucideProps> }[] = [
  { id: 'plane', Icon: Plane },
  { id: 'car', Icon: Car },
  { id: 'house', Icon: Home },
  { id: 'gift', Icon: Gift },
  { id: 'shopping-cart', Icon: ShoppingCart },
  { id: 'wallet', Icon: Wallet },
  { id: 'coffee', Icon: Coffee },
  { id: 'briefcase', Icon: Briefcase },
];

const ICON_BY_ID = Object.fromEntries(BUDGET_ICON_OPTIONS.map((o) => [o.id, o.Icon]));

const CONIC_GRADIENT =
  'conic-gradient(from 180deg, #ff0000, #ff8000, #ffff00, #00ff00, #00ffff, #0080ff, #8000ff, #ff0080, #ff0000)';

const PICKER_TRIGGER_CLASS =
  'h-12 w-12 shrink-0 transition-all duration-200 active:scale-95 outline-none focus-visible:ring-2 focus-visible:ring-[var(--btn-primary-bg)]/50';

const BUDGET_AMOUNT_INPUT_CLASS = `h-14 min-h-[3.5rem] w-full py-3 text-lg ${surfaceInputClass}`;

function addOneDayToIsoDate(iso: string): string {
  const [y, m, d] = iso.split('-').map((part) => parseInt(part, 10));
  const date = new Date(y, (m || 1) - 1, d || 1);
  date.setDate(date.getDate() + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

interface BudgetFormPickerPopoverProps {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  ariaLabel: string;
  estimatedHeightPx?: number;
  children: ReactNode;
}

function BudgetFormPickerPopover({
  open,
  onClose,
  anchorRef,
  ariaLabel,
  estimatedHeightPx = 220,
  children,
}: BudgetFormPickerPopoverProps) {
  const { dir } = useLanguage();
  const popoverRef = useRef<HTMLDivElement>(null);
  const [anchorPosition, setAnchorPosition] = useState({ top: 0, left: 0, width: 240 });

  const updateAnchorPosition = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    setAnchorPosition(
      computeFloatingAnchorPosition(anchor, {
        dir,
        estimatedHeightPx,
        maxWidthPx: 260,
      }),
    );
  }, [anchorRef, dir, estimatedHeightPx]);

  useLayoutEffect(() => {
    if (!open) return;
    updateAnchorPosition();
    const handleReposition = () => updateAnchorPosition();
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);
    return () => {
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [open, updateAnchorPosition]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open, anchorRef, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          ref={popoverRef}
          initial={{ opacity: 0, y: -6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.98 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className={`${themeFloatingOverlayClass} p-3 shadow-xl shadow-black/40 ${filterDropdownWrapperClass}`}
          style={{
            top: anchorPosition.top,
            left: anchorPosition.left,
            width: anchorPosition.width,
          }}
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export interface CreatePersonalBudgetInput {
  name: string;
  startDate: string;
  endDate: string;
  totalAmount: number;
  displayCurrency: ExpenseCurrency;
  settingsMode: BudgetSettingsInitMode;
  linkedBudgetId?: string;
  copiedFromBudgetId?: string;
  icon: string;
  color: string;
  isLinkedToMain: boolean;
  keepAfterDates: boolean | null;
  status: PersonalBudgetStatus;
  updateTargetBudgetCurrency?: boolean;
}

interface PersonalBudgetsPageProps {
  budgets: PersonalBudgetMeta[];
  activeBudgetId: string | null;
  displayCurrency: ExpenseCurrency;
  getBudgetDisplayCurrency: (budgetId: string) => ExpenseCurrency;
  onEnterBudget: (budgetId: string) => void;
  onCreateBudget: (input: CreatePersonalBudgetInput) => void;
}

function RequiredMark() {
  return (
    <span className="text-rose-500" aria-hidden>
      {' '}
      *
    </span>
  );
}

export default function PersonalBudgetsPage({
  budgets,
  activeBudgetId,
  displayCurrency,
  getBudgetDisplayCurrency,
  onEnterBudget,
  onCreateBudget,
}: PersonalBudgetsPageProps) {
  const { tr, lang, dir } = useLanguage();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [totalAmountInput, setTotalAmountInput] = useState('');
  const [color, setColor] = useState<string>(BUDGET_COLOR_OPTIONS[0].hex);
  const [icon, setIcon] = useState<string>('wallet');
  const [settingsMode, setSettingsMode] = useState<BudgetSettingsInitMode>('copy-default');
  const [linkedBudgetId, setLinkedBudgetId] = useState('');
  const [copiedFromBudgetId, setCopiedFromBudgetId] = useState('');
  const [isLinkedToMain, setIsLinkedToMain] = useState(false);
  const [keepAfterDates, setKeepAfterDates] = useState(true);
  const [formDisplayCurrency, setFormDisplayCurrency] = useState<ExpenseCurrency>(displayCurrency);
  const [updateTargetBudgetCurrency, setUpdateTargetBudgetCurrency] = useState(false);
  const [currencyConflictOpen, setCurrencyConflictOpen] = useState(false);
  const [dateToastVisible, setDateToastVisible] = useState(false);
  const [colorPopoverOpen, setColorPopoverOpen] = useState(false);
  const [iconPopoverOpen, setIconPopoverOpen] = useState(false);
  const [advancedColorOpen, setAdvancedColorOpen] = useState(false);
  const colorTriggerRef = useRef<HTMLButtonElement>(null);
  const iconTriggerRef = useRef<HTMLButtonElement>(null);
  const startDateInputRef = useRef<HTMLInputElement>(null);
  const endDateInputRef = useRef<HTMLInputElement>(null);
  const dateToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currencyConflictContextRef = useRef<'radio' | 'budget' | 'currency'>('radio');
  const pendingLinkedBudgetIdRef = useRef('');
  const pendingFormDisplayCurrencyRef = useRef<ExpenseCurrency | null>(null);
  const previousSettingsModeRef = useRef<BudgetSettingsInitMode>('copy-default');
  const previousLinkedBudgetIdRef = useRef('');
  const previousFormDisplayCurrencyRef = useRef<ExpenseCurrency>(displayCurrency);

  useEffect(() => {
    if (showCreateForm) {
      setFormDisplayCurrency(displayCurrency);
    }
  }, [showCreateForm, displayCurrency]);

  useEffect(() => {
    return () => {
      if (dateToastTimerRef.current) clearTimeout(dateToastTimerRef.current);
    };
  }, []);

  const closeAllPickers = useCallback(() => {
    setColorPopoverOpen(false);
    setIconPopoverOpen(false);
    setAdvancedColorOpen(false);
  }, []);

  const isCustomColor = isCustomHexColor(color);
  const displayColorHex = isCustomColor ? normalizeCustomHex(color) : color;

  const openColorPopover = () => {
    setIconPopoverOpen(false);
    setAdvancedColorOpen(false);
    setColorPopoverOpen((prev) => !prev);
  };

  const openIconPopover = () => {
    setColorPopoverOpen(false);
    setAdvancedColorOpen(false);
    setIconPopoverOpen((prev) => !prev);
  };

  const openAdvancedColorPicker = () => {
    setColorPopoverOpen(false);
    setAdvancedColorOpen(true);
  };

  const parsedTotalAmount = useMemo(
    () => parseMoneyInput(totalAmountInput.trim()) ?? 0,
    [totalAmountInput],
  );

  const hasDateRange = startDate.length > 0 && endDate.length > 0;

  const minEndDate = useMemo(
    () => (startDate.length > 0 ? addOneDayToIsoDate(startDate) : undefined),
    [startDate],
  );

  const showStartDateFirstToast = useCallback(() => {
    setDateToastVisible(true);
    if (dateToastTimerRef.current) clearTimeout(dateToastTimerRef.current);
    dateToastTimerRef.current = setTimeout(() => setDateToastVisible(false), 2800);
  }, []);

  const handleStartDateChange = (value: string) => {
    setStartDate(value);
    if (value && endDate && endDate < addOneDayToIsoDate(value)) {
      setEndDate('');
    }
  };

  const handleEndDateIntercept = () => {
    if (startDate.length > 0) return;
    showStartDateFirstToast();
    endDateInputRef.current?.blur();
    startDateInputRef.current?.focus();
  };

  const clearCurrencyConflictPending = useCallback(() => {
    pendingLinkedBudgetIdRef.current = '';
    pendingFormDisplayCurrencyRef.current = null;
    currencyConflictContextRef.current = 'radio';
  }, []);

  const resolveConflictTargetBudgetId = useCallback((): string => {
    if (currencyConflictContextRef.current === 'budget') {
      return pendingLinkedBudgetIdRef.current;
    }
    return linkedBudgetId;
  }, [linkedBudgetId]);

  const openCurrencyConflictIfNeeded = useCallback(
    (
      targetBudgetId: string,
      context: 'radio' | 'budget' | 'currency',
      pending?: { linkedBudgetId?: string; formDisplayCurrency?: ExpenseCurrency },
    ): boolean => {
      if (!targetBudgetId) return false;

      const currencyToCompare = pending?.formDisplayCurrency ?? formDisplayCurrency;
      const targetCurrency = getBudgetDisplayCurrency(targetBudgetId);
      if (currencyToCompare === targetCurrency) return false;

      currencyConflictContextRef.current = context;
      previousSettingsModeRef.current = settingsMode;
      previousLinkedBudgetIdRef.current = linkedBudgetId;
      previousFormDisplayCurrencyRef.current = formDisplayCurrency;
      pendingLinkedBudgetIdRef.current = pending?.linkedBudgetId ?? targetBudgetId;
      pendingFormDisplayCurrencyRef.current = pending?.formDisplayCurrency ?? null;
      setCurrencyConflictOpen(true);
      return true;
    },
    [formDisplayCurrency, getBudgetDisplayCurrency, linkedBudgetId, settingsMode],
  );

  const applySettingsMode = useCallback(
    (
      mode: BudgetSettingsInitMode,
      options?: {
        updateTargetCurrency?: boolean;
        adoptTargetCurrency?: boolean;
        targetBudgetId?: string;
      },
    ) => {
      if (options?.adoptTargetCurrency) {
        const targetId = options.targetBudgetId ?? linkedBudgetId;
        if (targetId) {
          setFormDisplayCurrency(getBudgetDisplayCurrency(targetId));
        }
        setUpdateTargetBudgetCurrency(false);
      } else if (options?.updateTargetCurrency) {
        setUpdateTargetBudgetCurrency(true);
      } else {
        setUpdateTargetBudgetCurrency(false);
      }
      setSettingsMode(mode);
    },
    [getBudgetDisplayCurrency, linkedBudgetId],
  );

  const handleSettingsModeChange = (mode: BudgetSettingsInitMode) => {
    if (mode !== 'linked') {
      applySettingsMode(mode);
      return;
    }
    if (openCurrencyConflictIfNeeded(linkedBudgetId, 'radio')) return;
    applySettingsMode('linked');
  };

  const handleLinkedBudgetChange = (nextId: string) => {
    if (nextId === linkedBudgetId) return;
    if (!nextId) {
      setLinkedBudgetId('');
      setUpdateTargetBudgetCurrency(false);
      return;
    }
    if (openCurrencyConflictIfNeeded(nextId, 'budget', { linkedBudgetId: nextId })) return;
    setLinkedBudgetId(nextId);
    setUpdateTargetBudgetCurrency(false);
  };

  const handleFormDisplayCurrencyChange = (code: ExpenseCurrency) => {
    if (code === formDisplayCurrency) return;
    if (settingsMode === 'linked' && linkedBudgetId) {
      if (openCurrencyConflictIfNeeded(linkedBudgetId, 'currency', { formDisplayCurrency: code })) {
        return;
      }
    }
    setFormDisplayCurrency(code);
    if (settingsMode === 'linked') {
      setUpdateTargetBudgetCurrency(false);
    }
  };

  const handleCurrencyConflictKeepTarget = () => {
    const targetId = resolveConflictTargetBudgetId();
    if (!targetId) {
      setCurrencyConflictOpen(false);
      clearCurrencyConflictPending();
      return;
    }

    if (currencyConflictContextRef.current === 'budget') {
      setLinkedBudgetId(targetId);
    }

    applySettingsMode('linked', { adoptTargetCurrency: true, targetBudgetId: targetId });
    setCurrencyConflictOpen(false);
    clearCurrencyConflictPending();
  };

  const handleCurrencyConflictChangeTarget = () => {
    const targetId = resolveConflictTargetBudgetId();

    if (currencyConflictContextRef.current === 'budget' && targetId) {
      setLinkedBudgetId(targetId);
    }
    if (
      currencyConflictContextRef.current === 'currency' &&
      pendingFormDisplayCurrencyRef.current
    ) {
      setFormDisplayCurrency(pendingFormDisplayCurrencyRef.current);
    }

    applySettingsMode('linked', { updateTargetCurrency: true, targetBudgetId: targetId });
    setCurrencyConflictOpen(false);
    clearCurrencyConflictPending();
  };

  const handleCurrencyConflictCancel = () => {
    setSettingsMode(previousSettingsModeRef.current);
    setLinkedBudgetId(previousLinkedBudgetIdRef.current);
    setFormDisplayCurrency(previousFormDisplayCurrencyRef.current);
    setUpdateTargetBudgetCurrency(false);
    setCurrencyConflictOpen(false);
    clearCurrencyConflictPending();
  };

  const sortedBudgets = useMemo(
    () =>
      [...budgets].sort((a, b) => {
        if (a.isDefaultMonthly) return -1;
        if (b.isDefaultMonthly) return 1;
        return b.createdAt - a.createdAt;
      }),
    [budgets],
  );

  useEffect(() => {
    budgetDebug('personalBudgetsPage:render', {
      budgetCount: sortedBudgets.length,
      totals: snapshotRegistryTotalsForLog(sortedBudgets),
      activeBudgetId: activeBudgetId?.slice(-10) ?? null,
      stateSource: 'props.budgets from App budgetRegistry.personal (NOT local cache)',
    });
  }, [sortedBudgets, activeBudgetId]);

  const budgetLabel = (meta: PersonalBudgetMeta) =>
    meta.isDefaultMonthly ? tr('monthlyDefaultBudgetName') : meta.name;

  const formatDateRange = (meta: PersonalBudgetMeta) => {
    if (!meta.startDate || !meta.endDate) {
      return tr('budgetNoDateRange');
    }
    const fmt = (iso: string) =>
      new Date(iso).toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    return `${fmt(meta.startDate)} – ${fmt(meta.endDate)}`;
  };

  const resolveBudgetIcon = (iconId?: string) => ICON_BY_ID[iconId ?? 'wallet'] ?? Wallet;
  const SelectedIcon = resolveBudgetIcon(icon);

  const resetForm = () => {
    setName('');
    setStartDate('');
    setEndDate('');
    setTotalAmountInput('');
    setColor(BUDGET_COLOR_OPTIONS[0].hex);
    setIcon('wallet');
    setSettingsMode('copy-default');
    setLinkedBudgetId('');
    setCopiedFromBudgetId('');
    setIsLinkedToMain(false);
    setKeepAfterDates(true);
    setFormDisplayCurrency(displayCurrency);
    setUpdateTargetBudgetCurrency(false);
    setCurrencyConflictOpen(false);
    clearCurrencyConflictPending();
    closeAllPickers();
    setShowCreateForm(false);
  };

  const handleCreate = () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    // Parse directly from the input draft (display currency) — avoids MoneyAmountInput ILS commit mismatch.
    const parsed = parseMoneyInput(totalAmountInput.trim());
    if (parsed == null || !(parsed > 0)) return;
    const amount = roundMoney(parsed);

    if (settingsMode === 'linked' && !linkedBudgetId) return;
    if (settingsMode === 'copy-from' && !copiedFromBudgetId) return;

    onCreateBudget({
      name: trimmedName,
      startDate,
      endDate,
      totalAmount: amount,
      displayCurrency: formDisplayCurrency,
      settingsMode,
      linkedBudgetId: settingsMode === 'linked' ? linkedBudgetId : undefined,
      copiedFromBudgetId: settingsMode === 'copy-from' ? copiedFromBudgetId : undefined,
      icon,
      color,
      isLinkedToMain,
      keepAfterDates: hasDateRange ? keepAfterDates : null,
      status: 'active',
      updateTargetBudgetCurrency:
        settingsMode === 'linked' && updateTargetBudgetCurrency ? true : undefined,
    });
    resetForm();
  };

  const canCreate =
    name.trim().length > 0 &&
    parsedTotalAmount > 0 &&
    (settingsMode !== 'linked' || linkedBudgetId.length > 0) &&
    (settingsMode !== 'copy-from' || copiedFromBudgetId.length > 0);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div>
        <h1 className={`text-xl font-bold sm:text-2xl ${typographyTitleClass}`}>
          {tr('personalBudgetsTitle')}
        </h1>
        <p className={`mt-1 text-sm ${themeTextMutedClass}`}>{tr('personalBudgetsSubtitle')}</p>
      </div>

      <div className="space-y-3">
        {sortedBudgets.map((budget) => {
          const isActive = activeBudgetId === budget.id;
          const BudgetIcon = resolveBudgetIcon(budget.icon);
          const accentColor = budget.color ?? BUDGET_COLOR_OPTIONS[0].hex;
          return (
            <button
              key={budget.id}
              type="button"
              onClick={() => onEnterBudget(budget.id)}
              className={`${subCardListRowClass} flex items-center gap-4 ${
                isActive ? 'border-emerald-500/50 bg-[var(--btn-filter-hover)]' : ''
              }`}
            >
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: `${accentColor}22`, color: accentColor }}
              >
                <BudgetIcon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-base font-semibold ${themeTextClass}`}>
                  {budgetLabel(budget)}
                </span>
                <span className={`mt-0.5 flex items-center gap-1.5 text-xs ${themeTextMutedClass}`}>
                  <Calendar className="h-3.5 w-3.5 shrink-0" />
                  {formatDateRange(budget)}
                </span>
                {budget.totalAmount > 0 && (
                  <span className={`mt-1 block text-xs ${themeTextMutedClass}`}>
                    {tr('totalBudgetLabel')}:{' '}
                    <LtrNumeric className="inline-block whitespace-nowrap">
                      {formatAmountWithSymbol(
                        budget.totalAmount,
                        getBudgetDisplayCurrency(budget.id) as CurrencyCode,
                      )}
                    </LtrNumeric>
                  </span>
                )}
              </span>
              <ChevronRight className={`h-5 w-5 shrink-0 rtl:rotate-180 ${themeTextMutedClass}`} />
            </button>
          );
        })}
      </div>

      {!showCreateForm ? (
        <button
          type="button"
          onClick={() => setShowCreateForm(true)}
          className={`flex min-h-[4.5rem] w-full items-center justify-center gap-2 text-sm font-medium transition-colors hover:border-emerald-500/40 ${dashedEmptyStateClass} ${themeTextMutedClass}`}
        >
          <Plus className="h-5 w-5" />
          {tr('createPersonalBudget')}
        </button>
      ) : (
        <div className={`${themeCardClass} space-y-4 p-4 sm:p-6`}>
          <h2 className={`text-base font-semibold ${typographyTitleClass}`}>
            {tr('createPersonalBudget')}
          </h2>

          {/* Row (RTL): Budget Name → Color trigger → Icon trigger — aligned label baseline */}
          <div>
            <div className="mb-2 flex flex-row items-baseline gap-3">
              <label className={`min-w-0 flex-1 text-sm font-medium ${typographyLabelClass}`}>
                {tr('budgetNameLabel')}
                <RequiredMark />
              </label>
              <span
                className={`w-12 shrink-0 text-center text-sm font-medium leading-none ${typographyLabelClass}`}
              >
                {tr('budgetColorLabel')}
              </span>
              <span
                className={`w-12 shrink-0 text-center text-sm font-medium leading-none ${typographyLabelClass}`}
              >
                {tr('budgetIconLabel')}
              </span>
            </div>
            <div className="flex flex-row items-center gap-3">
              <div className="min-w-0 flex-1">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={tr('budgetNamePlaceholder')}
                  className={`w-full ${surfaceInputLgClass}`}
                  required
                />
              </div>

              <div className={`${themeFloatingHostClass} shrink-0`}>
                <button
                ref={colorTriggerRef}
                type="button"
                onClick={openColorPopover}
                aria-label={tr('budgetColorLabel')}
                aria-expanded={colorPopoverOpen}
                aria-haspopup="dialog"
                className={`${PICKER_TRIGGER_CLASS} rounded-full border-2 border-[var(--surface-input-border)] hover:scale-105 ${
                  colorPopoverOpen ? 'ring-2 ring-offset-2 ring-offset-[var(--main-card-surface-bg)]' : ''
                }`}
                style={{
                  backgroundColor: displayColorHex,
                  ...(colorPopoverOpen ? { ringColor: displayColorHex } : {}),
                }}
              />

              <BudgetFormPickerPopover
                open={colorPopoverOpen}
                onClose={() => setColorPopoverOpen(false)}
                anchorRef={colorTriggerRef}
                ariaLabel={tr('budgetColorLabel')}
                estimatedHeightPx={200}
              >
                <div className="grid grid-cols-4 gap-2">
                  {BUDGET_COLOR_OPTIONS.map((option) => {
                    const selected = color === option.hex;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => {
                          setColor(option.hex);
                          setColorPopoverOpen(false);
                        }}
                        aria-label={option.id}
                        aria-pressed={selected}
                        className={[
                          'relative mx-auto h-9 w-9 rounded-full border-2 transition-transform active:scale-95',
                          selected
                            ? 'border-white ring-2 ring-offset-2 ring-offset-[var(--surface-input-bg)] scale-105'
                            : 'border-transparent hover:scale-105',
                        ].join(' ')}
                        style={{
                          backgroundColor: option.hex,
                          ...(selected ? { ringColor: option.hex } : {}),
                        }}
                      >
                        {selected && (
                          <Check
                            className="absolute inset-0 m-auto h-3.5 w-3.5 text-white drop-shadow"
                            strokeWidth={3}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={openAdvancedColorPicker}
                  title={tr('customColorAdvanced')}
                  aria-label={tr('customColorAdvanced')}
                  className={`mt-3 flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition-all active:scale-[0.98] ${
                    isCustomColor
                      ? `${primaryActionSelectedChipClass} border-[var(--btn-primary-bg)]`
                      : 'border-[var(--surface-input-border)] bg-[var(--surface-input-bg)] text-[var(--color-category-5-muted)] hover:border-[var(--btn-primary-bg)]/40'
                  }`}
                >
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                    style={{ background: CONIC_GRADIENT }}
                  >
                    <Palette className="h-3.5 w-3.5 text-white drop-shadow" />
                  </span>
                  <span className={themeTextClass}>{tr('customColorAdvanced')}</span>
                </button>
              </BudgetFormPickerPopover>

              <AdvancedColorPickerPopover
                open={advancedColorOpen}
                color={displayColorHex}
                onApply={(hex) => {
                  setColor(hex);
                  setAdvancedColorOpen(false);
                }}
                onCancel={() => setAdvancedColorOpen(false)}
                anchorRef={colorTriggerRef}
              />
            </div>

            <div className={`${themeFloatingHostClass} shrink-0`}>
              <button
                ref={iconTriggerRef}
                type="button"
                onClick={openIconPopover}
                aria-label={tr('budgetIconLabel')}
                aria-expanded={iconPopoverOpen}
                aria-haspopup="dialog"
                className={`${PICKER_TRIGGER_CLASS} flex items-center justify-center rounded-xl border ${
                  iconPopoverOpen
                    ? 'border-[var(--btn-primary-bg)] bg-[var(--btn-primary-bg)]/15 text-[var(--btn-primary-bg)] ring-2 ring-[var(--btn-primary-bg)]/30'
                    : 'border-[var(--surface-input-border)] bg-[var(--surface-input-bg)] text-[var(--color-category-5-muted)] hover:border-[var(--btn-primary-bg)]/40'
                }`}
              >
                <SelectedIcon className="h-5 w-5" />
              </button>

              <BudgetFormPickerPopover
                open={iconPopoverOpen}
                onClose={() => setIconPopoverOpen(false)}
                anchorRef={iconTriggerRef}
                ariaLabel={tr('budgetIconLabel')}
                estimatedHeightPx={180}
              >
                <div className="grid grid-cols-4 gap-1.5">
                  {BUDGET_ICON_OPTIONS.map(({ id, Icon }) => {
                    const selected = icon === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => {
                          setIcon(id);
                          setIconPopoverOpen(false);
                        }}
                        aria-label={id}
                        aria-pressed={selected}
                        className={[
                          'flex h-10 w-10 items-center justify-center rounded-xl border transition-all active:scale-95',
                          selected
                            ? 'border-[var(--btn-primary-bg)] bg-[var(--btn-primary-bg)]/15 text-[var(--btn-primary-bg)]'
                            : 'border-[var(--surface-input-border)] bg-[var(--surface-input-bg)] text-[var(--color-category-5-muted)] hover:border-[var(--btn-primary-bg)]/40',
                        ].join(' ')}
                      >
                        <Icon className="h-4 w-4" />
                      </button>
                    );
                  })}
                </div>
              </BudgetFormPickerPopover>
            </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={`mb-2 block text-sm font-medium ${typographyLabelClass}`}>
                {tr('budgetStartDateLabel')}
              </label>
              <input
                ref={startDateInputRef}
                type="date"
                value={startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className={`w-full ${surfaceInputLgClass} px-3`}
              />
            </div>
            <div>
              <label className={`mb-2 block text-sm font-medium ${typographyLabelClass}`}>
                {tr('budgetEndDateLabel')}
              </label>
              <input
                ref={endDateInputRef}
                type="date"
                value={endDate}
                min={minEndDate}
                onChange={(e) => setEndDate(e.target.value)}
                onFocus={handleEndDateIntercept}
                className={`w-full ${surfaceInputLgClass} px-3`}
              />
            </div>
          </div>

          <div>
            <label className={`mb-2 block text-sm font-medium ${typographyLabelClass}`}>
              {tr('budgetTotalAmountLabel')}
              <RequiredMark />
            </label>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
              <input
                type="text"
                inputMode="decimal"
                value={totalAmountInput}
                onChange={(e) => setTotalAmountInput(sanitizeMoneyInputDraft(e.target.value))}
                placeholder={tr('enterAmount')}
                aria-label={tr('budgetTotalAmountLabel')}
                className={`max-w-md flex-1 ${BUDGET_AMOUNT_INPUT_CLASS}`}
              />
              <CurrencySelector
                value={formDisplayCurrency as CurrencyCode}
                onChange={(code) => handleFormDisplayCurrencyChange(code as ExpenseCurrency)}
                className="self-end sm:self-stretch sm:flex sm:items-end"
              />
            </div>
          </div>

          <fieldset className="space-y-3">
            <legend className={`mb-1 text-sm font-medium ${typographyLabelClass}`}>
              {tr('budgetSettingsInitTitle')}
            </legend>

            <label className={`flex cursor-pointer items-start gap-3 ${subCardOptionRowClass}`}>
              <input
                type="radio"
                name="settingsMode"
                checked={settingsMode === 'copy-default'}
                onChange={() => handleSettingsModeChange('copy-default')}
                className="mt-1 h-4 w-4 shrink-0"
              />
              <span className={`text-sm ${themeTextClass}`}>{tr('budgetSettingsCopyDefault')}</span>
            </label>

            <label className={`flex cursor-pointer flex-col gap-2 ${subCardOptionRowClass}`}>
              <span className="flex items-start gap-3">
                <input
                  type="radio"
                  name="settingsMode"
                  checked={settingsMode === 'linked'}
                  onChange={() => handleSettingsModeChange('linked')}
                  className="mt-1 h-4 w-4 shrink-0"
                />
                <span className={`text-sm ${themeTextClass}`}>{tr('budgetSettingsLinked')}</span>
              </span>
              {settingsMode === 'linked' && (
                <select
                  value={linkedBudgetId}
                  onChange={(e) => handleLinkedBudgetChange(e.target.value)}
                  className={`ms-7 w-full max-w-sm ${surfaceInputClass}`}
                >
                  <option value="">{tr('budgetSelectExisting')}</option>
                  {sortedBudgets.map((b) => (
                    <option key={b.id} value={b.id}>
                      {budgetLabel(b)}
                    </option>
                  ))}
                </select>
              )}
            </label>

            <label className={`flex cursor-pointer flex-col gap-2 ${subCardOptionRowClass}`}>
              <span className="flex items-start gap-3">
                <input
                  type="radio"
                  name="settingsMode"
                  checked={settingsMode === 'copy-from'}
                  onChange={() => handleSettingsModeChange('copy-from')}
                  className="mt-1 h-4 w-4 shrink-0"
                />
                <span className={`text-sm ${themeTextClass}`}>{tr('budgetSettingsCopyFrom')}</span>
              </span>
              {settingsMode === 'copy-from' && (
                <select
                  value={copiedFromBudgetId}
                  onChange={(e) => setCopiedFromBudgetId(e.target.value)}
                  className={`ms-7 w-full max-w-sm ${surfaceInputClass}`}
                >
                  <option value="">{tr('budgetSelectExisting')}</option>
                  {sortedBudgets.map((b) => (
                    <option key={b.id} value={b.id}>
                      {budgetLabel(b)}
                    </option>
                  ))}
                </select>
              )}
            </label>
          </fieldset>

          <div className="space-y-3 border-t border-[var(--color-sub-cards-border)] pt-4">
            <label className={`flex cursor-pointer items-start gap-3 ${subCardOptionRowClass}`}>
              <input
                type="checkbox"
                checked={isLinkedToMain}
                onChange={(e) => setIsLinkedToMain(e.target.checked)}
                className="mt-1 h-4 w-4 shrink-0 rounded border-[var(--surface-input-border)] text-emerald-500 focus:ring-emerald-500/30"
              />
              <span className={`text-sm ${themeTextClass}`}>{tr('budgetLinkToMain')}</span>
            </label>

            {hasDateRange && (
              <label className={`flex cursor-pointer items-start gap-3 ${subCardOptionRowClass}`}>
                <input
                  type="checkbox"
                  checked={keepAfterDates}
                  onChange={(e) => setKeepAfterDates(e.target.checked)}
                  className="mt-1 h-4 w-4 shrink-0 rounded border-[var(--surface-input-border)] text-emerald-500 focus:ring-emerald-500/30"
                />
                <span className={`text-sm ${themeTextClass}`}>{tr('budgetKeepAfterDates')}</span>
              </label>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={resetForm}
              className={`rounded-lg px-4 py-2 text-sm ${utilityNavButtonLgClass}`}
            >
              {tr('cancel')}
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={!canCreate}
              className={`rounded-lg px-4 py-2 text-sm ${primaryActionButtonClass} ${primaryActionDisabled}`}
            >
              {tr('createPersonalBudget')}
            </button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {dateToastVisible && (
          <motion.div
            key="budget-date-toast"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
            className={monochromeToastPanelClass}
            role="status"
            aria-live="polite"
          >
            {tr('budgetChooseStartDateFirst')}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {currencyConflictOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4"
            role="presentation"
          >
            <button
              type="button"
              aria-label={tr('cancel')}
              className="absolute inset-0 bg-black/65 backdrop-blur-sm"
              onClick={handleCurrencyConflictCancel}
            />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              dir={dir}
              role="dialog"
              aria-modal="true"
              aria-labelledby="budget-currency-conflict-title"
              className={`relative w-full max-w-md p-5 backdrop-blur-xl sm:rounded-2xl sm:p-6 ${surfaceModalLgClass}`}
            >
              <p
                id="budget-currency-conflict-title"
                className={`text-base font-semibold leading-relaxed sm:text-lg ${themeTextClass}`}
              >
                {tr('budgetCurrencyConflictMessage')}
              </p>
              <div className="mt-5 flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={handleCurrencyConflictKeepTarget}
                  className={`w-full px-4 py-3 text-sm ${utilityNavButtonLgClass}`}
                >
                  {tr('budgetCurrencyKeepTarget')}
                </button>
                <button
                  type="button"
                  onClick={handleCurrencyConflictChangeTarget}
                  className={`w-full px-4 py-3 text-sm ${primaryActionButtonBorderedClass}`}
                >
                  {tr('budgetCurrencyChangeTarget')}
                </button>
                <button
                  type="button"
                  onClick={handleCurrencyConflictCancel}
                  className={`w-full px-4 py-3 text-sm ${utilityNavButtonLgClass}`}
                >
                  {tr('cancel')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
