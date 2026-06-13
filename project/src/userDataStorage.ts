import { type User } from 'firebase/auth';
import { roundMoney } from './services/money';
import { normalizeStoredOriginalCurrency } from './services/displayCurrencyUtils';

export interface StoredExpense {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  originalAmount?: number;
  originalCurrency?: string;
  /** Commission % baked into `amount` when this record was converted (0 = none). */
  appliedFeePercent?: number;
  /** True when a manual exchange-rate override was used to convert this record. */
  manualRateUsed?: boolean;
  /** Persistent override: ignore manual rates, resolve from the date-scoped API rate. */
  manualRateDisabled?: boolean;
  /** Persistent override: drop any conversion fee multiplier for this record. */
  feeDisabled?: boolean;
}

/** Normalize amounts, currency codes, and legacy override flag names on load. */
export function normalizeStoredExpense(expense: StoredExpense): StoredExpense {
  const legacy = expense as StoredExpense & {
    disableManualRate?: boolean;
    disableFee?: boolean;
  };
  return {
    ...expense,
    amount: roundMoney(Number(expense.amount ?? 0)),
    originalAmount:
      expense.originalAmount != null ? roundMoney(Number(expense.originalAmount)) : undefined,
    originalCurrency:
      expense.originalCurrency != null
        ? normalizeStoredOriginalCurrency(expense.originalCurrency)
        : undefined,
    manualRateDisabled: Boolean(legacy.manualRateDisabled ?? legacy.disableManualRate),
    feeDisabled: Boolean(legacy.feeDisabled ?? legacy.disableFee),
  };
}

export interface StoredCustomCategory {
  value: string;
  label: string;
  color: string;
  iconName: string;
  /** True when this category mirrors a linked personal budget in the main budget. */
  isLinkedBudget?: boolean;
  /** Personal budget id that owns this linked category. */
  sourceBudgetId?: string;
  /** Display-currency allocation amount from the personal budget form. */
  amount?: number;
  amountCurrency?: string;
}

/** Immutable per-category baseline ({@link ImmutableMoney} record shape). */
export type SubBudgetOriginalMonthMap = Record<string, { amount: number; currency: string }>;

export interface UserAppData {
  expenses: StoredExpense[];
  customCategories: StoredCustomCategory[];
  budgetsByMonth: Record<string, number>;
  budgetOriginalByMonth: Record<string, { amount: number; currency: string }>;
  subBudgetsByMonth: Record<string, Record<string, number>>;
  /**
   * Immutable sub-budget baselines: monthKey -> categoryKey -> { amount, currency }.
   * Stores the exact value + currency the user typed per allocation so display can
   * project losslessly (zero-math reversion). `subBudgetsByMonth` stays the ILS
   * canonical ledger used for allocation math.
   */
  subBudgetsOriginalByMonth: Record<string, SubBudgetOriginalMonthMap>;
  autoTransferByMonth: Record<string, boolean>;
}

export const EMPTY_USER_APP_DATA: UserAppData = {
  expenses: [],
  customCategories: [],
  budgetsByMonth: {},
  budgetOriginalByMonth: {},
  subBudgetsByMonth: {},
  subBudgetsOriginalByMonth: {},
  autoTransferByMonth: {},
};

const LS_KEYS = {
  expenses: 'expenses',
  customCategories: 'customCategories',
  budgetsByMonth: 'budgetsByMonth',
  budgetOriginalByMonth: 'budgetOriginalByMonth',
  subBudgetsByMonth: 'subBudgetsByMonth',
  subBudgetsOriginalByMonth: 'subBudgetsOriginalByMonth',
  autoTransferByMonth: 'autoTransferByMonth',
  legacyBudget: 'monthlyBudget',
  legacySubBudgets: 'subBudgets',
} as const;

export const shouldSyncToFirestore = (user: User | null): user is User =>
  user !== null && !user.isAnonymous;

const pad2 = (n: number) => String(n).padStart(2, '0');
const monthKeyOfDate = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;

export function loadFromLocalStorage(): UserAppData {
  const thisMonth = monthKeyOfDate(new Date());
  const data: UserAppData = { ...EMPTY_USER_APP_DATA };

  const savedExpenses = localStorage.getItem(LS_KEYS.expenses);
  if (savedExpenses) {
    data.expenses = (JSON.parse(savedExpenses) as StoredExpense[]).map(normalizeStoredExpense);
  }

  const savedCategories = localStorage.getItem(LS_KEYS.customCategories);
  if (savedCategories) {
    data.customCategories = JSON.parse(savedCategories) as StoredCustomCategory[];
  }

  const savedBudgets = localStorage.getItem(LS_KEYS.budgetsByMonth);
  const legacyBudget = localStorage.getItem(LS_KEYS.legacyBudget);
  if (savedBudgets) {
    const parsed = JSON.parse(savedBudgets) as Record<string, number>;
    data.budgetsByMonth = Object.fromEntries(
      Object.entries(parsed).map(([month, amount]) => [month, roundMoney(Number(amount ?? 0))]),
    );
  } else if (legacyBudget) {
    data.budgetsByMonth = { [thisMonth]: roundMoney(parseFloat(legacyBudget)) };
  }

  const savedBudgetOriginalByMonth = localStorage.getItem(LS_KEYS.budgetOriginalByMonth);
  if (savedBudgetOriginalByMonth) {
    const parsed = JSON.parse(savedBudgetOriginalByMonth) as Record<
      string,
      { amount: number; currency: string }
    >;
    data.budgetOriginalByMonth = Object.fromEntries(
      Object.entries(parsed).map(([month, value]) => [
        month,
        { ...value, amount: roundMoney(Number(value?.amount ?? 0)) },
      ]),
    );
  }

  const savedSubByMonth = localStorage.getItem(LS_KEYS.subBudgetsByMonth);
  const legacySub = localStorage.getItem(LS_KEYS.legacySubBudgets);
  if (savedSubByMonth) {
    const parsed = JSON.parse(savedSubByMonth) as Record<string, Record<string, number>>;
    data.subBudgetsByMonth = Object.fromEntries(
      Object.entries(parsed).map(([month, map]) => [
        month,
        Object.fromEntries(
          Object.entries(map ?? {}).map(([key, amount]) => [key, roundMoney(Number(amount ?? 0))]),
        ),
      ]),
    );
  } else if (legacySub) {
    const parsed = JSON.parse(legacySub) as Record<string, number>;
    data.subBudgetsByMonth = {
      [thisMonth]: Object.fromEntries(
        Object.entries(parsed).map(([key, amount]) => [key, roundMoney(Number(amount ?? 0))]),
      ),
    };
  }

  const savedSubOriginalByMonth = localStorage.getItem(LS_KEYS.subBudgetsOriginalByMonth);
  if (savedSubOriginalByMonth) {
    data.subBudgetsOriginalByMonth = parseSubBudgetsOriginalByMonth(
      JSON.parse(savedSubOriginalByMonth),
    );
  }

  const savedAutoTransferByMonth = localStorage.getItem(LS_KEYS.autoTransferByMonth);
  if (savedAutoTransferByMonth) {
    data.autoTransferByMonth = JSON.parse(savedAutoTransferByMonth) as Record<string, boolean>;
  }

  return data;
}

/** Normalize a raw sub-budget baseline map (rounds amounts, drops malformed entries). */
export function parseSubBudgetsOriginalByMonth(
  raw: unknown,
): Record<string, SubBudgetOriginalMonthMap> {
  if (!raw || typeof raw !== 'object') return {};
  const source = raw as Record<string, Record<string, { amount?: unknown; currency?: unknown }>>;
  return Object.fromEntries(
    Object.entries(source).map(([month, map]) => [
      month,
      Object.fromEntries(
        Object.entries(map ?? {})
          .filter(([, value]) => value && typeof value === 'object')
          .map(([key, value]) => [
            key,
            {
              amount: roundMoney(Number(value?.amount ?? 0)),
              currency: typeof value?.currency === 'string' ? value.currency : 'ILS',
            },
          ]),
      ),
    ]),
  );
}

export function saveToLocalStorage(data: UserAppData): void {
  localStorage.setItem(LS_KEYS.expenses, JSON.stringify(data.expenses));
  localStorage.setItem(LS_KEYS.customCategories, JSON.stringify(data.customCategories));
  localStorage.setItem(LS_KEYS.budgetsByMonth, JSON.stringify(data.budgetsByMonth));
  localStorage.setItem(LS_KEYS.budgetOriginalByMonth, JSON.stringify(data.budgetOriginalByMonth));
  localStorage.setItem(LS_KEYS.subBudgetsByMonth, JSON.stringify(data.subBudgetsByMonth));
  localStorage.setItem(
    LS_KEYS.subBudgetsOriginalByMonth,
    JSON.stringify(data.subBudgetsOriginalByMonth ?? {}),
  );
  localStorage.setItem(LS_KEYS.autoTransferByMonth, JSON.stringify(data.autoTransferByMonth));
}
