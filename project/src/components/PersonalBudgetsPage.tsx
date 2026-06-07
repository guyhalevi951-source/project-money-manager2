import { useMemo, useState } from 'react';
import { Calendar, ChevronRight, Plus, Wallet } from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import {
  primaryActionButtonClass,
  primaryActionDisabled,
  utilityNavButtonLgClass,
} from '../styles/actionButtonStyles';
import {
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
} from '../services/budgetArchitecture';
import { parseMoneyInput } from '../services/money';

export interface CreatePersonalBudgetInput {
  name: string;
  startDate: string;
  endDate: string;
  totalAmount: number;
  settingsMode: BudgetSettingsInitMode;
  linkedBudgetId?: string;
  copiedFromBudgetId?: string;
}

interface PersonalBudgetsPageProps {
  budgets: PersonalBudgetMeta[];
  activeBudgetId: string | null;
  displayCurrency: ExpenseCurrency;
  onEnterBudget: (budgetId: string) => void;
  onCreateBudget: (input: CreatePersonalBudgetInput) => void;
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
  const [settingsMode, setSettingsMode] = useState<BudgetSettingsInitMode>('copy-default');
  const [linkedBudgetId, setLinkedBudgetId] = useState('');
  const [copiedFromBudgetId, setCopiedFromBudgetId] = useState('');

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
    const fmt = (iso: string) =>
      new Date(iso).toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    return `${fmt(meta.startDate)} – ${fmt(meta.endDate)}`;
  };

  const resetForm = () => {
    setName('');
    setStartDate('');
    setEndDate('');
    setTotalAmount(0);
    setSettingsMode('copy-default');
    setLinkedBudgetId('');
    setCopiedFromBudgetId('');
    setShowCreateForm(false);
  };

  const handleCreate = () => {
    const trimmedName = name.trim();
    if (!trimmedName || !startDate || !endDate) return;
    const amount = parseMoneyInput(String(totalAmount)) ?? totalAmount;
    if (amount < 0) return;
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
    });
    resetForm();
  };

  const canCreate =
    name.trim().length > 0 &&
    startDate.length > 0 &&
    endDate.length > 0 &&
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
          return (
            <button
              key={budget.id}
              type="button"
              onClick={() => onEnterBudget(budget.id)}
              className={`flex w-full items-center gap-4 rounded-xl border p-4 text-start transition-all hover:border-emerald-500/40 hover:bg-neutral-800/60 ${
                isActive
                  ? 'border-emerald-500/50 bg-emerald-950/20'
                  : 'border-neutral-700 bg-neutral-900/50'
              }`}
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                <Wallet className="h-5 w-5" />
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
              <ChevronRight className="h-5 w-5 shrink-0 text-neutral-500 rtl:rotate-180" />
            </button>
          );
        })}
      </div>

      {!showCreateForm ? (
        <button
          type="button"
          onClick={() => setShowCreateForm(true)}
          className={`flex min-h-[4.5rem] w-full items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-600 bg-neutral-900/30 text-sm font-medium text-neutral-400 transition-colors hover:border-emerald-500/40 hover:text-emerald-300 ${utilityNavButtonLgClass}`}
        >
          <Plus className="h-5 w-5" />
          {tr('createPersonalBudget')}
        </button>
      ) : (
        <div className={`${themeCardClass} space-y-4 p-4 sm:p-6`}>
          <h2 className={`text-base font-semibold ${typographyTitleClass}`}>
            {tr('createPersonalBudget')}
          </h2>

          <div>
            <label className={`mb-2 block text-sm font-medium ${typographyLabelClass}`}>
              {tr('budgetNameLabel')}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={tr('budgetNamePlaceholder')}
              className={`w-full ${surfaceInputLgClass}`}
            />
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

            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-neutral-700 p-3 hover:bg-neutral-800/50">
              <input
                type="radio"
                name="settingsMode"
                checked={settingsMode === 'copy-default'}
                onChange={() => setSettingsMode('copy-default')}
                className="mt-1 h-4 w-4 shrink-0"
              />
              <span className="text-sm text-neutral-300">{tr('budgetSettingsCopyDefault')}</span>
            </label>

            <label className="flex cursor-pointer flex-col gap-2 rounded-lg border border-neutral-700 p-3 hover:bg-neutral-800/50">
              <span className="flex items-start gap-3">
                <input
                  type="radio"
                  name="settingsMode"
                  checked={settingsMode === 'linked'}
                  onChange={() => setSettingsMode('linked')}
                  className="mt-1 h-4 w-4 shrink-0"
                />
                <span className="text-sm text-neutral-300">{tr('budgetSettingsLinked')}</span>
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

            <label className="flex cursor-pointer flex-col gap-2 rounded-lg border border-neutral-700 p-3 hover:bg-neutral-800/50">
              <span className="flex items-start gap-3">
                <input
                  type="radio"
                  name="settingsMode"
                  checked={settingsMode === 'copy-from'}
                  onChange={() => setSettingsMode('copy-from')}
                  className="mt-1 h-4 w-4 shrink-0"
                />
                <span className="text-sm text-neutral-300">{tr('budgetSettingsCopyFrom')}</span>
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
