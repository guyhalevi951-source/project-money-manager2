import { type User } from 'firebase/auth';
import { roundMoney } from './services/money';

export interface StoredExpense {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  originalAmount?: number;
  originalCurrency?: string;
}

export interface StoredCustomCategory {
  value: string;
  label: string;
  color: string;
  iconName: string;
}

export interface UserAppData {
  expenses: StoredExpense[];
  customCategories: StoredCustomCategory[];
  budgetsByMonth: Record<string, number>;
  budgetOriginalByMonth: Record<string, { amount: number; currency: string }>;
  subBudgetsByMonth: Record<string, Record<string, number>>;
  autoTransferByMonth: Record<string, boolean>;
}

export const EMPTY_USER_APP_DATA: UserAppData = {
  expenses: [],
  customCategories: [],
  budgetsByMonth: {},
  budgetOriginalByMonth: {},
  subBudgetsByMonth: {},
  autoTransferByMonth: {},
};

const LS_KEYS = {
  expenses: 'expenses',
  customCategories: 'customCategories',
  budgetsByMonth: 'budgetsByMonth',
  budgetOriginalByMonth: 'budgetOriginalByMonth',
  subBudgetsByMonth: 'subBudgetsByMonth',
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
    data.expenses = (JSON.parse(savedExpenses) as StoredExpense[]).map((expense) => ({
      ...expense,
      amount: roundMoney(Number(expense.amount ?? 0)),
      originalAmount:
        expense.originalAmount != null ? roundMoney(Number(expense.originalAmount)) : undefined,
    }));
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

  const savedAutoTransferByMonth = localStorage.getItem(LS_KEYS.autoTransferByMonth);
  if (savedAutoTransferByMonth) {
    data.autoTransferByMonth = JSON.parse(savedAutoTransferByMonth) as Record<string, boolean>;
  }

  return data;
}

export function saveToLocalStorage(data: UserAppData): void {
  localStorage.setItem(LS_KEYS.expenses, JSON.stringify(data.expenses));
  localStorage.setItem(LS_KEYS.customCategories, JSON.stringify(data.customCategories));
  localStorage.setItem(LS_KEYS.budgetsByMonth, JSON.stringify(data.budgetsByMonth));
  localStorage.setItem(LS_KEYS.budgetOriginalByMonth, JSON.stringify(data.budgetOriginalByMonth));
  localStorage.setItem(LS_KEYS.subBudgetsByMonth, JSON.stringify(data.subBudgetsByMonth));
  localStorage.setItem(LS_KEYS.autoTransferByMonth, JSON.stringify(data.autoTransferByMonth));
}
