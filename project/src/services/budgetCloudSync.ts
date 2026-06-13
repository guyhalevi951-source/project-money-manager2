import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  createDefaultMonthlyBudgetMeta,
  DEFAULT_MONTHLY_BUDGET_ID,
  EMPTY_BUDGET_REGISTRY,
  type BudgetRegistryState,
  type PersonalBudgetMeta,
  type SharedBudgetMeta,
} from './budgetArchitecture';
import {
  EMPTY_USER_APP_DATA,
  normalizeStoredExpense,
  parseSubBudgetsOriginalByMonth,
  type UserAppData,
} from '../userDataStorage';
import { roundMoney } from './money';

const REGISTRY_DOC_ID = 'data';

export type SnapshotMeta = { hasPendingWrites: boolean; exists: boolean };

const registryRef = (uid: string) => doc(db, 'users', uid, 'budget_registry', REGISTRY_DOC_ID);
const financialRef = (uid: string, budgetId: string) =>
  doc(db, 'users', uid, 'budget_financial', budgetId);
const legacyExpensesRef = (uid: string) => doc(db, 'users', uid, 'expenses', REGISTRY_DOC_ID);
const legacyCategoriesRef = (uid: string) => doc(db, 'users', uid, 'categories', REGISTRY_DOC_ID);

function parseRegistry(raw: Record<string, unknown> | undefined): BudgetRegistryState {
  if (!raw) return { ...EMPTY_BUDGET_REGISTRY };
  const personal = Array.isArray(raw.personal) ? (raw.personal as PersonalBudgetMeta[]) : [];
  const shared = Array.isArray(raw.shared) ? (raw.shared as SharedBudgetMeta[]) : [];
  return { personal, shared };
}

function parseFinancial(raw: Record<string, unknown> | undefined): UserAppData {
  if (!raw) return { ...EMPTY_USER_APP_DATA };
  return {
    expenses: Array.isArray(raw.expenses)
      ? raw.expenses.map((expense) => normalizeStoredExpense(expense as UserAppData['expenses'][number]))
      : [],
    customCategories: Array.isArray(raw.customCategories) ? raw.customCategories : [],
    budgetsByMonth:
      raw.budgetsByMonth && typeof raw.budgetsByMonth === 'object'
        ? Object.fromEntries(
            Object.entries(raw.budgetsByMonth as Record<string, number>).map(([k, v]) => [
              k,
              roundMoney(Number(v ?? 0)),
            ]),
          )
        : {},
    budgetOriginalByMonth:
      raw.budgetOriginalByMonth && typeof raw.budgetOriginalByMonth === 'object'
        ? (raw.budgetOriginalByMonth as UserAppData['budgetOriginalByMonth'])
        : {},
    subBudgetsByMonth:
      raw.subBudgetsByMonth && typeof raw.subBudgetsByMonth === 'object'
        ? (raw.subBudgetsByMonth as UserAppData['subBudgetsByMonth'])
        : {},
    subBudgetsOriginalByMonth: parseSubBudgetsOriginalByMonth(raw.subBudgetsOriginalByMonth),
    autoTransferByMonth:
      raw.autoTransferByMonth && typeof raw.autoTransferByMonth === 'object'
        ? (raw.autoTransferByMonth as UserAppData['autoTransferByMonth'])
        : {},
  };
}

export async function loadBudgetFinancialCloud(uid: string, budgetId: string): Promise<UserAppData> {
  const snap = await getDoc(financialRef(uid, budgetId));
  if (!snap.exists()) return { ...EMPTY_USER_APP_DATA };
  return parseFinancial(snap.data() as Record<string, unknown>);
}

export async function migrateLegacyFinancialToDefaultBudget(uid: string): Promise<BudgetRegistryState> {
  const [expSnap, catSnap] = await Promise.all([
    getDoc(legacyExpensesRef(uid)),
    getDoc(legacyCategoriesRef(uid)),
  ]);

  const financial: UserAppData = { ...EMPTY_USER_APP_DATA };
  if (expSnap.exists()) {
    const raw = expSnap.data() as Record<string, unknown>;
    financial.expenses = Array.isArray(raw.expenses) ? raw.expenses : [];
  }
  if (catSnap.exists()) {
    const catParsed = parseFinancial(catSnap.data() as Record<string, unknown>);
    financial.customCategories = catParsed.customCategories;
    financial.budgetsByMonth = catParsed.budgetsByMonth;
    financial.budgetOriginalByMonth = catParsed.budgetOriginalByMonth;
    financial.subBudgetsByMonth = catParsed.subBudgetsByMonth;
    financial.subBudgetsOriginalByMonth = catParsed.subBudgetsOriginalByMonth;
    financial.autoTransferByMonth = catParsed.autoTransferByMonth;
  }

  const registry: BudgetRegistryState = {
    personal: [createDefaultMonthlyBudgetMeta()],
    shared: [],
  };

  await saveBudgetFinancialCloud(uid, DEFAULT_MONTHLY_BUDGET_ID, financial);
  await saveBudgetRegistryCloud(uid, registry);
  return registry;
}

export async function loadBudgetRegistryCloud(uid: string): Promise<BudgetRegistryState> {
  const snap = await getDoc(registryRef(uid));
  if (!snap.exists()) return { ...EMPTY_BUDGET_REGISTRY };
  return parseRegistry(snap.data() as Record<string, unknown>);
}

export async function saveBudgetRegistryCloud(uid: string, registry: BudgetRegistryState): Promise<void> {
  await setDoc(
    registryRef(uid),
    { personal: registry.personal, shared: registry.shared, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export function subscribeBudgetRegistry(
  uid: string,
  onData: (registry: BudgetRegistryState, meta: SnapshotMeta) => void,
  onMissing?: () => void,
): Unsubscribe {
  return onSnapshot(
    registryRef(uid),
    (snap) => {
      if (!snap.exists()) {
        onMissing?.();
        onData({ ...EMPTY_BUDGET_REGISTRY }, { hasPendingWrites: snap.metadata.hasPendingWrites, exists: false });
        return;
      }
      onData(parseRegistry(snap.data() as Record<string, unknown>), {
        hasPendingWrites: snap.metadata.hasPendingWrites,
        exists: true,
      });
    },
    () => onMissing?.(),
  );
}

export function subscribeBudgetFinancial(
  uid: string,
  budgetId: string,
  onData: (data: UserAppData, meta: SnapshotMeta) => void,
  onMissing?: () => void,
): Unsubscribe {
  return onSnapshot(
    financialRef(uid, budgetId),
    (snap) => {
      if (!snap.exists()) {
        onMissing?.();
        onData({ ...EMPTY_USER_APP_DATA }, { hasPendingWrites: snap.metadata.hasPendingWrites, exists: false });
        return;
      }
      onData(parseFinancial(snap.data() as Record<string, unknown>), {
        hasPendingWrites: snap.metadata.hasPendingWrites,
        exists: true,
      });
    },
    () => onMissing?.(),
  );
}

function financialDocPayload(data: UserAppData) {
  return {
    expenses: data.expenses,
    customCategories: data.customCategories,
    budgetsByMonth: data.budgetsByMonth,
    budgetOriginalByMonth: data.budgetOriginalByMonth,
    subBudgetsByMonth: data.subBudgetsByMonth,
    subBudgetsOriginalByMonth: data.subBudgetsOriginalByMonth ?? {},
    autoTransferByMonth: data.autoTransferByMonth,
    updatedAt: serverTimestamp(),
  };
}

export async function saveBudgetFinancialCloud(
  uid: string,
  budgetId: string,
  data: UserAppData,
): Promise<void> {
  await setDoc(financialRef(uid, budgetId), financialDocPayload(data), { merge: true });
}

/**
 * Linked-budget creation dual-write: registry + personal financial + main financial
 * in a single Firestore batch so partial writes cannot orphan a linked sub-budget.
 */
export async function dualWriteLinkedBudgetCreationCloud(
  uid: string,
  registry: BudgetRegistryState,
  personalBudgetId: string,
  personalFinancial: UserAppData,
  mainFinancial: UserAppData,
): Promise<void> {
  const batch = writeBatch(db);
  batch.set(
    registryRef(uid),
    { personal: registry.personal, shared: registry.shared, updatedAt: serverTimestamp() },
    { merge: true },
  );
  batch.set(financialRef(uid, personalBudgetId), financialDocPayload(personalFinancial), {
    merge: true,
  });
  batch.set(financialRef(uid, DEFAULT_MONTHLY_BUDGET_ID), financialDocPayload(mainFinancial), {
    merge: true,
  });
  await batch.commit();
}

/**
 * Linked-budget expense dual-write: persist source + mirrored main expense in parallel.
 */
export async function dualWriteMirroredExpenseCloud(
  uid: string,
  sourceBudgetId: string,
  sourceFinancial: UserAppData,
  mainFinancial: UserAppData,
): Promise<void> {
  await Promise.all([
    saveBudgetFinancialCloud(uid, sourceBudgetId, sourceFinancial),
    saveBudgetFinancialCloud(uid, DEFAULT_MONTHLY_BUDGET_ID, mainFinancial),
  ]);
}
