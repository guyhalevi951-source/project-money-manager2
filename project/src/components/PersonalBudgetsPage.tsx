import { useMemo, useState, type ComponentType } from 'react';
import {
  Briefcase,
  Calendar,
  Car,
  ChevronRight,
  Coffee,
  Gift,
  Home,
  Plane,
  Plus,
  ShoppingCart,
  Wallet,
  type LucideProps,
} from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import {
  primaryActionButtonClass,
  primaryActionDisabled,
  utilityNavButtonLgClass,
} from '../styles/actionButtonStyles';
import {
  dashedEmptyStateClass,
  subCardListRowClass,
  subCardOptionRowClass,
  surfaceInputClass,
  surfaceInputLgClass,
  themeCardClass,
  themeTextClass,
  themeTextMutedClass,
  typographyLabelClass,
  typographyTitleClass,
} from '../styles/themeSurfaceStyles';
import MoneyAmountInput from './MoneyAmountInput';
import DisplayMoney from './DisplayMoney';
import type { ExpenseCurrency } from '../services/exchangeRateService';
import {
  type BudgetSettingsInitMode,
  type PersonalBudgetMeta,
  type PersonalBudgetStatus,
} from '../services/budgetArchitecture';
import { parseMoneyInput } from '../services/money';

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

export interface CreatePersonalBudgetInput {
  name: string;
  startDate: string;
  endDate: string;
  totalAmount: number;
  settingsMode: BudgetSettingsInitMode;
  linkedBudgetId?: string;
  copiedFromBudgetId?: string;
  icon: string;
  color: string;
  isLinkedToMain: boolean;
  keepAfterDates: boolean | null;
  status: PersonalBudgetStatus;
}

interface PersonalBudgetsPageProps {
  budgets: PersonalBudgetMeta[];
  activeBudgetId: string | null;
  displayCurrency: ExpenseCurrency;
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
  onEnterBudget,
  onCreateBudget,
}: PersonalBudgetsPageProps) {
  const { tr, lang } = useLanguage();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [totalAmount, setTotalAmount] = useState(0);
  const [color, setColor] = useState<string>(BUDGET_COLOR_OPTIONS[0].hex);
  const [icon, setIcon] = useState<string>('wallet');
  const [settingsMode, setSettingsMode] = useState<BudgetSettingsInitMode>('copy-default');
  const [linkedBudgetId, setLinkedBudgetId] = useState('');
  const [copiedFromBudgetId, setCopiedFromBudgetId] = useState('');
  const [isLinkedToMain, setIsLinkedToMain] = useState(false);
  const [keepAfterDates, setKeepAfterDates] = useState(true);

  const hasDateRange = startDate.length > 0 && endDate.length > 0;

  const sortedBudgets = useMemo(
    () =>
      [...budgets].sort((a, b) => {
        if (a.isDefaultMonthly) return -1;
        if (b.isDefaultMonthly) return 1;
        return b.createdAt - a.createdAt;
      }),
    [budgets],
  );

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

  const resetForm = () => {
    setName('');
    setStartDate('');
    setEndDate('');
    setTotalAmount(0);
    setColor(BUDGET_COLOR_OPTIONS[0].hex);
    setIcon('wallet');
    setSettingsMode('copy-default');
    setLinkedBudgetId('');
    setCopiedFromBudgetId('');
    setIsLinkedToMain(false);
    setKeepAfterDates(true);
    setShowCreateForm(false);
  };

  const handleCreate = () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    const amount = parseMoneyInput(String(totalAmount)) ?? totalAmount;
    if (amount <= 0) return;
    if (settingsMode === 'linked' && !linkedBudgetId) return;
    if (settingsMode === 'copy-from' && !copiedFromBudgetId) return;

    onCreateBudget({
      name: trimmedName,
      startDate,
      endDate,
      totalAmount: amount,
      settingsMode,
      linkedBudgetId: settingsMode === 'linked' ? linkedBudgetId : undefined,
      copiedFromBudgetId: settingsMode === 'copy-from' ? copiedFromBudgetId : undefined,
      icon,
      color,
      isLinkedToMain,
      keepAfterDates: hasDateRange ? keepAfterDates : null,
      status: 'active',
    });
    resetForm();
  };

  const canCreate =
    name.trim().length > 0 &&
    totalAmount > 0 &&
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
                    <DisplayMoney amount={budget.totalAmount} className="inline-block" />
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

          {/* Row: Budget Name → Color → Icon */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <label className={`mb-2 block text-sm font-medium ${typographyLabelClass}`}>
                {tr('budgetNameLabel')}
                <RequiredMark />
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={tr('budgetNamePlaceholder')}
                className={`w-full ${surfaceInputLgClass}`}
                required
              />
            </div>

            <div className="shrink-0">
              <span className={`mb-2 block text-sm font-medium ${typographyLabelClass}`}>
                {tr('budgetColorLabel')}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {BUDGET_COLOR_OPTIONS.map((option) => {
                  const selected = color === option.hex;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setColor(option.hex)}
                      aria-label={option.id}
                      aria-pressed={selected}
                      className={[
                        'h-9 w-9 rounded-full border-2 transition-transform active:scale-95',
                        selected
                          ? 'border-white ring-2 ring-offset-2 ring-offset-[var(--main-card-surface-bg)] scale-105'
                          : 'border-transparent hover:scale-105',
                      ].join(' ')}
                      style={{
                        backgroundColor: option.hex,
                        ...(selected ? { ringColor: option.hex } : {}),
                      }}
                    />
                  );
                })}
              </div>
            </div>

            <div className="shrink-0">
              <span className={`mb-2 block text-sm font-medium ${typographyLabelClass}`}>
                {tr('budgetIconLabel')}
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {BUDGET_ICON_OPTIONS.map(({ id, Icon }) => {
                  const selected = icon === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setIcon(id)}
                      aria-label={id}
                      aria-pressed={selected}
                      className={[
                        'flex h-9 w-9 items-center justify-center rounded-xl border transition-all active:scale-95',
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
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={`mb-2 block text-sm font-medium ${typographyLabelClass}`}>
                {tr('budgetStartDateLabel')}
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={`w-full ${surfaceInputLgClass} px-3`}
              />
            </div>
            <div>
              <label className={`mb-2 block text-sm font-medium ${typographyLabelClass}`}>
                {tr('budgetEndDateLabel')}
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={`w-full ${surfaceInputLgClass} px-3`}
              />
            </div>
          </div>

          <div>
            <label className={`mb-2 block text-sm font-medium ${typographyLabelClass}`}>
              {tr('budgetTotalAmountLabel')}
              <RequiredMark />
            </label>
            <MoneyAmountInput
              value={totalAmount}
              displayCurrency={displayCurrency}
              onCommit={(amount) => setTotalAmount(amount ?? 0)}
              className={`w-full max-w-xs ${surfaceInputClass}`}
            />
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
                onChange={() => setSettingsMode('copy-default')}
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
                  onChange={() => setSettingsMode('linked')}
                  className="mt-1 h-4 w-4 shrink-0"
                />
                <span className={`text-sm ${themeTextClass}`}>{tr('budgetSettingsLinked')}</span>
              </span>
              {settingsMode === 'linked' && (
                <select
                  value={linkedBudgetId}
                  onChange={(e) => setLinkedBudgetId(e.target.value)}
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
                  onChange={() => setSettingsMode('copy-from')}
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
    </div>
  );
}
