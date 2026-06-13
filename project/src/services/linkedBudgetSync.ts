import {
  DEFAULT_MONTHLY_BUDGET_ID,
  type BudgetRegistryState,
  type PersonalBudgetMeta,
} from './budgetArchitecture';
import {
  EMPTY_USER_APP_DATA,
  type StoredCustomCategory,
  type StoredExpense,
  type UserAppData,
} from '../userDataStorage';
import { roundMoney } from './money';
import type { ExpenseCurrency } from './currencyRegistry';

/** Marker persisted on months with no sub-budget allocations (matches App.tsx convention). */
const SUB_BUDGET_MONTH_MARKER = '__sb_init__';

export function buildLinkedCategoryId(personalBudgetId: string): string {
  return `linked:${personalBudgetId}`;
}

function markSubBudgetMonthInitialized(monthMap: Record<string, number>): Record<string, number> {
  const hasPositive = Object.keys(monthMap).some(
    (key) =>
      key !== SUB_BUDGET_MONTH_MARKER &&
      key !== '__general__' &&
      (monthMap[key] ?? 0) > 0,
  );
  if (hasPositive) {
    const next = { ...monthMap };
    delete next[SUB_BUDGET_MONTH_MARKER];
    return next;
  }
  return { [SUB_BUDGET_MONTH_MARKER]: 0 };
}

export interface InjectLinkedBudgetParams {
  personalBudgetId: string;
  name: string;
  totalAmountIls: number;
  totalAmountDisplay: number;
  displayCurrency: ExpenseCurrency;
  icon: string;
  color: string;
  monthKey: string;
}

function buildLinkedCategory(
  params: InjectLinkedBudgetParams,
  linkedCategoryId: string,
): StoredCustomCategory {
  return {
    value: linkedCategoryId,
    label: params.name,
    color: params.color,
    iconName: params.icon,
    isLinkedBudget: true,
    sourceBudgetId: params.personalBudgetId,
    amount: roundMoney(params.totalAmountDisplay),
    amountCurrency: params.displayCurrency,
  };
}

/**
 * Dual-write: inject (or upsert) a linked personal budget as a sub-budget category
 * inside the default monthly (main) budget financial payload.
 */
export function injectLinkedBudgetIntoMainFinancial(
  mainFinancial: UserAppData,
  params: InjectLinkedBudgetParams,
): { financial: UserAppData; linkedCategoryId: string } {
  const linkedCategoryId = buildLinkedCategoryId(params.personalBudgetId);
  const linkedCategory = buildLinkedCategory(params, linkedCategoryId);

  const nextCategories = mainFinancial.customCategories.some((c) => c.value === linkedCategoryId)
    ? mainFinancial.customCategories.map((c) =>
        c.value === linkedCategoryId ? linkedCategory : c,
      )
    : [...mainFinancial.customCategories, linkedCategory];

  const monthMap = mainFinancial.subBudgetsByMonth[params.monthKey] ?? {};
  const allocated = roundMoney(params.totalAmountIls);
  const nextMonthMap =
    allocated > 0
      ? markSubBudgetMonthInitialized({
          ...monthMap,
          [linkedCategoryId]: allocated,
        })
      : {
          ...monthMap,
          [linkedCategoryId]: allocated,
        };

  return {
    linkedCategoryId,
    financial: {
      ...mainFinancial,
      customCategories: nextCategories,
      subBudgetsByMonth: {
        ...mainFinancial.subBudgetsByMonth,
        [params.monthKey]: nextMonthMap,
      },
    },
  };
}

export function resolveLinkedBudgetMeta(
  budgetId: string,
  registry: BudgetRegistryState,
): PersonalBudgetMeta | null {
  const meta = registry.personal.find((b) => b.id === budgetId);
  if (!meta?.isLinkedToMain || !meta.linkedCategoryId) return null;
  return meta;
}

export function buildMirroredExpenseId(sourceBudgetId: string, sourceExpenseId: string): string {
  return `mirror:${sourceBudgetId}:${sourceExpenseId}`;
}

/**
 * Dual-write: clone an expense into the main budget, assigned to the
 * linked sub-budget category created during budget registration.
 */
export function buildMirroredExpense(
  sourceExpense: StoredExpense,
  sourceBudgetId: string,
  linkedCategoryId: string,
): StoredExpense {
  return {
    ...sourceExpense,
    id: buildMirroredExpenseId(sourceBudgetId, sourceExpense.id),
    category: linkedCategoryId,
  };
}

export function mirrorExpenseIntoMainFinancial(
  mainFinancial: UserAppData,
  mirroredExpense: StoredExpense,
): UserAppData {
  return {
    ...mainFinancial,
    expenses: [mirroredExpense, ...mainFinancial.expenses],
  };
}

export function loadMainBudgetFinancial(
  financialCache: Record<string, UserAppData>,
  loadLocal: (budgetId: string) => UserAppData,
): UserAppData {
  return (
    financialCache[DEFAULT_MONTHLY_BUDGET_ID] ??
    loadLocal(DEFAULT_MONTHLY_BUDGET_ID) ??
    { ...EMPTY_USER_APP_DATA }
  );
}
