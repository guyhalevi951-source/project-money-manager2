import { type User } from 'firebase/auth';

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
  subBudgetsByMonth: Record<string, Record<string, number>>;
}

export const EMPTY_USER_APP_DATA: UserAppData = {
  expenses: [],
  customCategories: [],
  budgetsByMonth: {},
  subBudgetsByMonth: {},
};

const LS_KEYS = {
  expenses: 'expenses',
  customCategories: 'customCategories',
  budgetsByMonth: 'budgetsByMonth',
  subBudgetsByMonth: 'subBudgetsByMonth',
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
    data.expenses = JSON.parse(savedExpenses) as StoredExpense[];
  }

  const savedCategories = localStorage.getItem(LS_KEYS.customCategories);
  if (savedCategories) {
    data.customCategories = JSON.parse(savedCategories) as StoredCustomCategory[];
  }

  const savedBudgets = localStorage.getItem(LS_KEYS.budgetsByMonth);
  const legacyBudget = localStorage.getItem(LS_KEYS.legacyBudget);
  if (savedBudgets) {
    data.budgetsByMonth = JSON.parse(savedBudgets) as Record<string, number>;
  } else if (legacyBudget) {
    data.budgetsByMonth = { [thisMonth]: parseFloat(legacyBudget) };
  }

  const savedSubByMonth = localStorage.getItem(LS_KEYS.subBudgetsByMonth);
  const legacySub = localStorage.getItem(LS_KEYS.legacySubBudgets);
  if (savedSubByMonth) {
    data.subBudgetsByMonth = JSON.parse(savedSubByMonth) as Record<string, Record<string, number>>;
  } else if (legacySub) {
    data.subBudgetsByMonth = { [thisMonth]: JSON.parse(legacySub) as Record<string, number> };
  }

  return data;
}

export function saveToLocalStorage(data: UserAppData): void {
  localStorage.setItem(LS_KEYS.expenses, JSON.stringify(data.expenses));
  localStorage.setItem(LS_KEYS.customCategories, JSON.stringify(data.customCategories));
  localStorage.setItem(LS_KEYS.budgetsByMonth, JSON.stringify(data.budgetsByMonth));
  localStorage.setItem(LS_KEYS.subBudgetsByMonth, JSON.stringify(data.subBudgetsByMonth));
}
