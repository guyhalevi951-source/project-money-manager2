import { currencySymbol } from '../constants/currencies';
import { EMPTY_USER_APP_DATA, type UserAppData } from '../userDataStorage';
import type { PersonalBudgetMeta } from './budgetArchitecture';
import {
  convertDisplayAmountToLedgerCurrency,
  convertLedgerAmountToDisplayCurrency,
  symbolToCurrency,
} from './displayCurrencyUtils';
import {
  convertAmountViaIls,
  fetchExchangeRates,
  getCachedExchangeRates,
  type ExchangeRates,
  type ExpenseCurrency,
} from './exchangeRateService';
import { roundMoney, smartRoundMoney } from './money';
import {
  buildMoneyProjectionContext,
  immutableFromBudgetMonth,
  projectMoney,
} from './immutableMoney';

export function hasMonthlyBudgetData(financial: UserAppData): boolean {
  const hasIls = Object.values(financial.budgetsByMonth).some((value) => (value ?? 0) > 0);
  const hasOriginal = Object.values(financial.budgetOriginalByMonth).some(
    (entry) => (entry?.amount ?? 0) > 0,
  );
  return hasIls || hasOriginal;
}

/** True when the financial document carries any persisted payload (not an empty shell). */
export function hasPersistedFinancialPayload(financial: UserAppData): boolean {
  return (
    hasMonthlyBudgetData(financial) ||
    financial.expenses.length > 0 ||
    financial.customCategories.length > 0 ||
    Object.keys(financial.subBudgetsByMonth).length > 0
  );
}

export function resolveBudgetFinancialForEntry(
  budgetId: string,
  cache: Record<string, UserAppData>,
  loadLocal: (id: string) => UserAppData,
): UserAppData {
  const fromCache = cache[budgetId];
  const fromLocal = loadLocal(budgetId);
  if (fromCache && hasPersistedFinancialPayload(fromCache)) return fromCache;
  if (hasPersistedFinancialPayload(fromLocal)) return fromLocal;
  return fromCache ?? fromLocal;
}

/** Short-lived guard — only blocks stale empty Firestore snapshots during currency conversion. */
export const FINANCIAL_CONVERSION_GUARD_MS = 8_000;

export function armFinancialConversionGuard(
  guards: Record<string, number>,
  budgetId: string,
): void {
  guards[budgetId] = Date.now() + FINANCIAL_CONVERSION_GUARD_MS;
}

export function clearFinancialConversionGuard(
  guards: Record<string, number>,
  budgetId: string,
): void {
  delete guards[budgetId];
}

export function isFinancialConversionGuardActive(
  guards: Record<string, number>,
  budgetId: string,
): boolean {
  const expiresAt = guards[budgetId];
  return expiresAt != null && Date.now() < expiresAt;
}

export function shouldRejectEmptyIncomingFinancial(
  cached: UserAppData | undefined,
  incoming: UserAppData,
  meta: { exists: boolean },
  conversionGuardActive: boolean,
): boolean {
  const incomingEmpty = !hasPersistedFinancialPayload(incoming);
  if (!incomingEmpty) return false;

  const cachedHasData = cached != null && hasPersistedFinancialPayload(cached);
  if (!cachedHasData) return false;

  // Firestore doc missing — keep hydrated local/cache until a real document arrives.
  if (!meta.exists) return true;

  // During currency conversion, ignore transient empty snapshots while cloud write settles.
  if (conversionGuardActive) return true;

  // Protect seeded monthly allocations from stale empty cloud snapshots (e.g. post-create race).
  return hasMonthlyBudgetData(cached);
}

/** Reject Firestore snapshots that lag behind a fresher local/cache write (navigation race). */
export function shouldRejectStaleIncomingFinancial(
  cached: UserAppData | undefined,
  incoming: UserAppData,
  localWriteAt: number | undefined,
  subscribedAt: number,
): boolean {
  if (!cached || !hasPersistedFinancialPayload(cached)) return false;
  if (!hasPersistedFinancialPayload(incoming)) return false;
  if (!localWriteAt || localWriteAt < subscribedAt) return false;

  const cacheBudgets = JSON.stringify(cached.budgetsByMonth ?? {});
  const incomingBudgets = JSON.stringify(incoming.budgetsByMonth ?? {});
  const cacheOriginal = JSON.stringify(cached.budgetOriginalByMonth ?? {});
  const incomingOriginal = JSON.stringify(incoming.budgetOriginalByMonth ?? {});
  const cacheExpenses = JSON.stringify(cached.expenses ?? []);
  const incomingExpenses = JSON.stringify(incoming.expenses ?? []);

  return (
    cacheBudgets !== incomingBudgets ||
    cacheOriginal !== incomingOriginal ||
    cacheExpenses !== incomingExpenses
  );
}

export function resolveSeedMonthKey(meta: PersonalBudgetMeta): string {
  if (meta.startDate && meta.startDate.length >= 7) {
    return meta.startDate.slice(0, 7);
  }
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function applyDisplayMonthAllocation(
  financial: UserAppData,
  monthKey: string,
  canonicalIls: number,
  toCurrency: ExpenseCurrency,
  rates: ExchangeRates,
): UserAppData {
  if (!(canonicalIls > 0)) return financial;

  const displayAmount = convertLedgerAmountToDisplayCurrency(canonicalIls, toCurrency, rates);
  if (displayAmount == null || displayAmount < 0) return financial;

  return {
    ...financial,
    budgetsByMonth: {
      ...financial.budgetsByMonth,
      [monthKey]: smartRoundMoney(canonicalIls),
    },
    budgetOriginalByMonth: {
      ...financial.budgetOriginalByMonth,
      [monthKey]: {
        amount: displayAmount,
        currency: toCurrency,
      },
    },
  };
}

function seedMonthlyBudgetFromRegistryTotal(
  financial: UserAppData,
  meta: PersonalBudgetMeta,
  registryTotalAmount: number,
  fromCurrency: ExpenseCurrency,
  toCurrency: ExpenseCurrency,
  rates: ExchangeRates,
): UserAppData {
  if (!(registryTotalAmount > 0)) return financial;

  const monthKey = resolveSeedMonthKey(meta);
  const existingIls = financial.budgetsByMonth[monthKey] ?? 0;
  const existingOriginal = financial.budgetOriginalByMonth[monthKey];
  if (existingIls > 0 || (existingOriginal?.amount ?? 0) > 0) {
    return financial;
  }

  let canonicalIls = convertDisplayAmountToLedgerCurrency(
    registryTotalAmount,
    fromCurrency,
    rates,
  );
  if (canonicalIls == null || !(canonicalIls > 0)) return financial;

  return applyDisplayMonthAllocation(financial, monthKey, canonicalIls, toCurrency, rates);
}

/**
 * Seed monthly allocations from the creation form (registry `totalAmount` + display currency).
 */
export async function buildInitialPersonalBudgetFinancial(
  totalAmount: number,
  formCurrency: ExpenseCurrency,
  startDate?: string,
): Promise<UserAppData> {
  if (!(totalAmount > 0)) {
    return { ...EMPTY_USER_APP_DATA };
  }

  const now = new Date();
  const monthKey =
    startDate?.slice(0, 7) ??
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const rates = getCachedExchangeRates() ?? (await fetchExchangeRates().catch(() => null));
  // convertDisplayAmountToLedgerCurrency applies smartRoundMoney, so the ILS
  // ledger is written with integer-snap for amounts like 500 ILS
  const ilsAmount =
    convertDisplayAmountToLedgerCurrency(totalAmount, formCurrency, rates) ??
    smartRoundMoney(totalAmount);

  return {
    ...EMPTY_USER_APP_DATA,
    budgetsByMonth: { [monthKey]: ilsAmount },
    budgetOriginalByMonth: {
      [monthKey]: {
        amount: roundMoney(totalAmount),
        currency: formCurrency,
      },
    },
  };
}

/**
 * Force form/registry monthly allocation onto financial payload.
 * MUST run after any `...spread` merges so the form amount is never overwritten by zeros.
 *
 * ILS ledger preservation: if `budgetsByMonth[monthKey]` already holds a non-zero
 * value we keep it intact — it is more precise than any value re-derived from a
 * rounded foreign display amount.  Only the `budgetOriginalByMonth` snapshot is
 * updated so the display label matches the current currency.
 */
export function overlayFormMonthlySeed(
  financial: UserAppData,
  monthKey: string,
  displayAmount: number,
  displayCurrency: ExpenseCurrency,
  ilsAmount: number,
): UserAppData {
  if (!(displayAmount > 0)) return financial;

  // Preserve the existing ILS ledger — never overwrite a precise canonical value
  // with one that was re-derived from a rounded foreign amount.
  const existingIls = financial.budgetsByMonth[monthKey] ?? 0;
  const finalIls = existingIls > 0 ? existingIls : smartRoundMoney(ilsAmount);

  return {
    ...financial,
    budgetsByMonth: {
      ...financial.budgetsByMonth,
      [monthKey]: finalIls,
    },
    budgetOriginalByMonth: {
      ...financial.budgetOriginalByMonth,
      [monthKey]: {
        amount: roundMoney(displayAmount),
        currency: displayCurrency,
      },
    },
  };
}

/** Overlay registry meta total onto the seed month — always wins over copied empty months. */
export function overlayPersonalBudgetFormSeed(
  financial: UserAppData,
  meta: PersonalBudgetMeta,
  displayCurrency: ExpenseCurrency,
  rates?: ExchangeRates | null,
): UserAppData {
  if (!(meta.totalAmount > 0)) return financial;

  const monthKey = resolveSeedMonthKey(meta);
  const resolvedRates = rates ?? getCachedExchangeRates();

  const ilsAmount =
    convertDisplayAmountToLedgerCurrency(meta.totalAmount, displayCurrency, resolvedRates) ??
    smartRoundMoney(meta.totalAmount);

  return overlayFormMonthlySeed(
    financial,
    monthKey,
    meta.totalAmount,
    displayCurrency,
    ilsAmount,
  );
}

/**
 * Project a monthly budget into `displayCurrency` from its IMMUTABLE baseline.
 *
 * Single source of truth for both the internal budget summary and the external
 * registry card, so the two can never diverge. The budget's typed baseline
 * (`budgetOriginalByMonth[month]`, falling back to the ILS ledger for legacy
 * data) is projected directly to the target via {@link projectMoney}:
 *  - currency matches  ⇒ exact `originalAmount` (zero-math reversion)
 *  - currency differs  ⇒ single direct hop, NO commission fees (a budget cap is
 *                        not a purchase, so fees must not distort it).
 */
export function projectBudgetMonthDisplayAmount(
  ilsLedgerAmount: number,
  original: { amount: number; currency: string } | undefined,
  displayCurrency: ExpenseCurrency,
  rates?: ExchangeRates | null,
): number | null {
  const base = immutableFromBudgetMonth(original, ilsLedgerAmount);
  if (!(base.originalAmount > 0)) return null;
  const ctx = buildMoneyProjectionContext(displayCurrency, {
    rates: rates ?? getCachedExchangeRates(),
    applyFees: false,
  });
  return projectMoney(base, displayCurrency, ctx);
}

/**
 * Registry card total in display currency — same resolution as internal budget
 * summary (delegates to {@link projectBudgetMonthDisplayAmount}).
 */
export function deriveRegistryTotalFromFinancialMonth(
  financial: UserAppData,
  monthKey: string,
  displayCurrency: ExpenseCurrency,
  rates?: ExchangeRates | null,
): number | null {
  return projectBudgetMonthDisplayAmount(
    financial.budgetsByMonth[monthKey] ?? 0,
    financial.budgetOriginalByMonth[monthKey],
    displayCurrency,
    rates,
  );
}

/**
 * When the financial doc lacks monthly data but registry meta has a total, seed from meta.
 */
export function ensurePersonalBudgetFinancialSeeded(
  financial: UserAppData,
  meta: PersonalBudgetMeta,
  displayCurrency: ExpenseCurrency,
  rates?: ExchangeRates | null,
): UserAppData {
  if (!(meta.totalAmount > 0)) return financial;
  return overlayPersonalBudgetFormSeed(financial, meta, displayCurrency, rates);
}

export function resolveFinancialViewMonthDate(
  financial: UserAppData,
  meta?: PersonalBudgetMeta | null,
): Date | null {
  if (meta?.startDate) {
    const [y, m, d] = meta.startDate.split('-').map(Number);
    if (y && m) return new Date(y, m - 1, d || 1);
  }

  const monthKeys = [
    ...new Set([
      ...Object.keys(financial.budgetsByMonth),
      ...Object.keys(financial.budgetOriginalByMonth),
    ]),
  ];
  if (monthKeys.length === 0) return null;

  monthKeys.sort();
  const [y, m] = monthKeys[0].split('-').map((n) => parseInt(n, 10));
  if (!y || !m) return null;
  return new Date(y, m - 1, 1);
}

/**
 * Convert a budget's stored financial payload when its display currency changes.
 * ILS ledger fields (`budgetsByMonth`, `subBudgetsByMonth`, expense `amount`) stay canonical;
 * display snapshots (`budgetOriginalByMonth`, expense originals, linked category amounts) update.
 */
export function convertBudgetFinancialToDisplayCurrency(
  financial: UserAppData,
  fromCurrency: ExpenseCurrency,
  toCurrency: ExpenseCurrency,
  rates: ExchangeRates,
): UserAppData {
  if (fromCurrency === toCurrency) return financial;

  const nextBudgetsByMonth = { ...financial.budgetsByMonth };
  const nextBudgetOriginalByMonth = { ...financial.budgetOriginalByMonth };

  const monthKeys = new Set([
    ...Object.keys(nextBudgetsByMonth),
    ...Object.keys(nextBudgetOriginalByMonth),
  ]);

  for (const monthKey of monthKeys) {
    // Canonical ILS ledger is the source of truth.  Only fall back to deriving
    // ILS from the display original when the ledger entry is genuinely absent.
    let ilsAmount = nextBudgetsByMonth[monthKey] ?? 0;

    if (!(ilsAmount > 0)) {
      const original = nextBudgetOriginalByMonth[monthKey];
      if (original?.amount > 0) {
        const sourceCurrency = (symbolToCurrency(original.currency) ??
          original.currency) as ExpenseCurrency;
        // convertDisplayAmountToLedgerCurrency applies smartRoundMoney internally
        const derivedIls = convertDisplayAmountToLedgerCurrency(
          original.amount,
          sourceCurrency,
          rates,
        );
        if (derivedIls != null && derivedIls > 0) {
          ilsAmount = derivedIls;
          // Populate the ledger so subsequent calls never re-derive
          nextBudgetsByMonth[monthKey] = ilsAmount;
        }
      }
    }

    if (!(ilsAmount > 0)) continue;

    const displayAmount = convertLedgerAmountToDisplayCurrency(ilsAmount, toCurrency, rates);
    if (displayAmount == null || displayAmount < 0) continue;

    nextBudgetOriginalByMonth[monthKey] = {
      amount: displayAmount,
      currency: toCurrency,
    };
  }

  const nextCustomCategories = financial.customCategories.map((category) => {
    if (category.amount == null || !category.amountCurrency) return category;
    const sourceCurrency = category.amountCurrency as ExpenseCurrency;
    // convertAmountViaIls already rounds internally (smartRound for ILS, roundMoney for others)
    const converted = convertAmountViaIls(
      category.amount,
      sourceCurrency,
      toCurrency,
      rates,
    );
    if (converted == null) return category;
    return {
      ...category,
      amount: converted,
      amountCurrency: toCurrency,
    };
  });

  const nextExpenses = financial.expenses.map((expense) => {
    if (!(expense.amount > 0)) return expense;
    if (!(expense.originalAmount != null && expense.originalAmount > 0)) {
      return expense;
    }
    const originalCode = expense.originalCurrency
      ? symbolToCurrency(expense.originalCurrency) ?? fromCurrency
      : fromCurrency;
    if (originalCode !== fromCurrency) return expense;

    const convertedOriginal = convertLedgerAmountToDisplayCurrency(
      expense.amount,
      toCurrency,
      rates,
    );
    if (convertedOriginal == null) return expense;

    return {
      ...expense,
      originalAmount: convertedOriginal,
      originalCurrency: toCurrency,
    };
  });

  return {
    ...financial,
    budgetsByMonth: nextBudgetsByMonth,
    budgetOriginalByMonth: nextBudgetOriginalByMonth,
    customCategories: nextCustomCategories,
    expenses: nextExpenses,
  };
}

export interface ConvertTargetBudgetFinancialOptions {
  registryMeta?: PersonalBudgetMeta | null;
  /** Registry `totalAmount` before the currency change (old display currency). */
  registryTotalAmountBefore?: number;
}

/**
 * Full target-budget financial conversion for conflict option 2.
 * Seeds monthly allocations from registry `totalAmount` when the financial doc is empty.
 */
export function convertTargetBudgetFinancialForCurrencyChange(
  financial: UserAppData,
  fromCurrency: ExpenseCurrency,
  toCurrency: ExpenseCurrency,
  rates: ExchangeRates,
  options?: ConvertTargetBudgetFinancialOptions,
): UserAppData {
  let next = convertBudgetFinancialToDisplayCurrency(
    financial,
    fromCurrency,
    toCurrency,
    rates,
  );

  const registryMeta = options?.registryMeta;
  const registryTotal = options?.registryTotalAmountBefore ?? 0;
  if (registryMeta && registryTotal > 0 && !hasMonthlyBudgetData(next)) {
    next = seedMonthlyBudgetFromRegistryTotal(
      next,
      registryMeta,
      registryTotal,
      fromCurrency,
      toCurrency,
      rates,
    );
  }

  return next;
}

export function convertRegistryBudgetTotalAmount(
  amount: number,
  fromCurrency: ExpenseCurrency,
  toCurrency: ExpenseCurrency,
  rates: ExchangeRates,
): number | null {
  if (!(amount > 0)) return amount;
  if (fromCurrency === toCurrency) return roundMoney(amount);

  const ilsAmount =
    convertDisplayAmountToLedgerCurrency(amount, fromCurrency, rates) ?? null;
  if (ilsAmount == null || !(ilsAmount > 0)) return null;
  return convertLedgerAmountToDisplayCurrency(ilsAmount, toCurrency, rates);
}
