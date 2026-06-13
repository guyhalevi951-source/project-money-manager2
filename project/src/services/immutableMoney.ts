/**
 * ============================================================================
 *  IMMUTABLE BASE CURRENCY / SOURCE-OF-TRUTH ARCHITECTURE
 * ============================================================================
 *
 * This module is the permanent foundation for ALL monetary values in the app
 * (budgets, sub-budgets/categories, expenses/transactions, and every future
 * feature that accepts a money input).
 *
 * ── Business rules enforced here ──────────────────────────────────────────
 *
 * 1. IMMUTABLE SOURCE OF TRUTH
 *    Every monetary value is stored as the EXACT number the user typed plus the
 *    currency they typed it in: `{ originalAmount, originalCurrency }`. These
 *    fields are immutable — they are never recomputed, re-rounded, or rewritten
 *    by display logic. This eliminates "unmount/autosave stale-state" overwrites
 *    where exiting a screen could persist a converted (lossy) number.
 *
 * 2. ON-THE-FLY PROJECTIONS (NO CHAINED MATH)
 *    To show a value in another currency we ALWAYS project directly from the
 *    immutable baseline to the target — a single hop. Chained conversions
 *    (Expense ➜ Sub-budget ➜ Main budget) are forbidden: they accumulate
 *    floating-point drift (500 ➜ 499.99). `projectMoney` always starts from the
 *    baseline, never from a previously-projected value.
 *
 * 3. ZERO-MATH REVERSION
 *    When the active view currency equals the baseline currency, ALL exchange,
 *    fee and rounding math is bypassed and the exact stored `originalAmount` is
 *    returned. 500 ILS viewed in ILS is exactly 500 — guaranteed, with 0% loss.
 *
 * 4. HIERARCHICAL ROLLUPS
 *    Parent totals are computed by projecting EACH child from its own baseline
 *    into the parent's currency context, then summing — never by chaining a
 *    child's already-projected value through another conversion.
 *
 * 5. DYNAMIC FEES & SCOPED MANUAL RATES
 *    Conversion fees are applied dynamically at the destination step. Manual
 *    exchange overrides only affect projections while an explicit, currently
 *    active manual rate exists for that pair — they are NEVER baked into a
 *    baseline, so historical entries created before a manual rate are never
 *    retroactively altered.
 *
 * 6. FUTURE-PROOFING
 *    `ImmutableMoney` is the single global money shape. Flat `amount: number`
 *    fields are prohibited for NEW features — use `ImmutableMoney` + the shared
 *    `<CurrencyInput />` / `useCurrencyInput` mechanism so the data structure is
 *    enforced by construction.
 *
 * The projection math itself is delegated to the existing pure transaction
 * engine (`processTransactionWithUserRules`) so there is exactly ONE conversion
 * implementation in the app.
 * ============================================================================
 */

import {
  currencySymbol,
  isSupportedCurrency,
  type ExpenseCurrency,
} from '../constants/currencies';
import { symbolToCurrency } from './displayCurrencyUtils';
import {
  getCachedExchangeRates,
  type ExchangeRates,
} from './exchangeRateService';
import {
  listActiveCurrencyCommissions,
} from './currencyCommissionService';
import { listActiveManualExchangeOverrides } from './manualExchangeOverrideService';
import {
  convertAmountWithActiveRates,
  processTransactionWithUserRules,
  toActiveExchangeRatesFromSnapshot,
  toActiveFeesFromCommissionEntries,
  type ActiveExchangeRates,
  type ActiveFeeRule,
} from './transactionProcessingService';
import { roundMoney, smartRoundMoney } from './money';

/**
 * The immutable monetary baseline — the single source of truth for any amount.
 *
 * `originalAmount` is the exact value the user typed (2-decimal rounded once on
 * entry); `originalCurrency` is the currency it was typed in. Treat instances as
 * read-only: never mutate or recompute these fields after creation.
 */
export interface ImmutableMoney {
  readonly originalAmount: number;
  readonly originalCurrency: ExpenseCurrency;
}

/** Persisted shape of {@link ImmutableMoney} (Firebase / localStorage field names). */
export interface ImmutableMoneyRecord {
  originalAmount: number;
  originalCurrency: string;
}

/**
 * Create an {@link ImmutableMoney} baseline from a freshly typed user value.
 * The amount is rounded to 2 decimals exactly once, at the point of entry —
 * this is the only place a baseline amount is ever rounded.
 */
export function createImmutableMoney(
  amount: number,
  currency: ExpenseCurrency,
): ImmutableMoney {
  const safeAmount = Number.isFinite(amount) && amount > 0 ? roundMoney(amount) : 0;
  return {
    originalAmount: safeAmount,
    originalCurrency: isSupportedCurrency(currency) ? currency : 'ILS',
  };
}

/** Runtime type guard for {@link ImmutableMoney} / {@link ImmutableMoneyRecord}. */
export function isImmutableMoney(value: unknown): value is ImmutableMoney {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.originalAmount === 'number' &&
    Number.isFinite(candidate.originalAmount) &&
    typeof candidate.originalCurrency === 'string' &&
    isSupportedCurrency(candidate.originalCurrency)
  );
}

/** Resolve a currency code OR symbol (e.g. "₪", "$") to a supported code, defaulting to ILS. */
export function resolveCurrencyCode(raw: string | undefined | null): ExpenseCurrency {
  if (!raw) return 'ILS';
  const trimmed = raw.trim();
  if (isSupportedCurrency(trimmed)) return trimmed;
  return symbolToCurrency(trimmed) ?? 'ILS';
}

/** Serialize an {@link ImmutableMoney} for persistence. */
export function toImmutableMoneyRecord(money: ImmutableMoney): ImmutableMoneyRecord {
  return { originalAmount: money.originalAmount, originalCurrency: money.originalCurrency };
}

/**
 * Read any persisted record into an {@link ImmutableMoney}.
 * Returns `null` when no positive baseline exists.
 */
export function fromImmutableMoneyRecord(
  record: Partial<ImmutableMoneyRecord> | null | undefined,
): ImmutableMoney | null {
  if (!record) return null;
  const amount = Number(record.originalAmount ?? 0);
  if (!(amount > 0)) return null;
  return createImmutableMoney(amount, resolveCurrencyCode(record.originalCurrency));
}

// ───────────────────────── Legacy adapters ─────────────────────────────────
// Existing documents predate this architecture. These adapters derive a lossless
// baseline from current storage so legacy data participates in the new pipeline
// without a destructive migration. For legacy values stored only as a flat ILS
// number, ILS *is* the immutable baseline currency (no information is lost: the
// number is exactly what was canonicalised at entry time).

/** Treat a flat ILS ledger number as its own immutable baseline. */
export function immutableFromIls(ilsAmount: number | undefined | null): ImmutableMoney {
  return createImmutableMoney(Number(ilsAmount ?? 0), 'ILS');
}

/**
 * Baseline for a stored expense. Prefers the typed original
 * (`originalAmount` + `originalCurrency`); falls back to the ILS `amount`.
 */
export function immutableFromExpense(expense: {
  amount: number;
  originalAmount?: number;
  originalCurrency?: string;
}): ImmutableMoney {
  if (
    expense.originalAmount != null &&
    expense.originalAmount > 0 &&
    expense.originalCurrency
  ) {
    return createImmutableMoney(
      expense.originalAmount,
      resolveCurrencyCode(expense.originalCurrency),
    );
  }
  return immutableFromIls(expense.amount);
}

/**
 * Baseline for a monthly budget. Prefers the typed display original
 * (`budgetOriginalByMonth[month]`); falls back to the ILS ledger value.
 */
export function immutableFromBudgetMonth(
  original: { amount: number; currency: string } | undefined,
  ilsLedgerAmount: number | undefined,
): ImmutableMoney {
  if (original && original.amount > 0) {
    return createImmutableMoney(original.amount, resolveCurrencyCode(original.currency));
  }
  return immutableFromIls(ilsLedgerAmount);
}

/** Baseline for a linked-budget custom category (`amount` + `amountCurrency`). */
export function immutableFromCustomCategory(category: {
  amount?: number;
  amountCurrency?: string;
}): ImmutableMoney | null {
  if (category.amount == null || !(category.amount > 0) || !category.amountCurrency) {
    return null;
  }
  return createImmutableMoney(category.amount, resolveCurrencyCode(category.amountCurrency));
}

// ───────────────────────── Projection engine ───────────────────────────────

/**
 * Snapshot of all data required to project a baseline into a target currency.
 * Build once per render/operation and reuse across many projections so every
 * value in a view shares the exact same rate + fee context.
 */
export interface MoneyProjectionContext {
  /** Spot rate table (defaults to the cached snapshot). */
  rates: ExchangeRates | null;
  /** Active commission rules (empty ⇒ no fees). */
  activeFees: ReadonlyArray<ActiveFeeRule>;
  /** Spot + currently-active manual pair overrides. */
  activeExchangeRates: ActiveExchangeRates;
  /** App display currency — drives fee-bypass semantics at the destination. */
  displayCurrency: ExpenseCurrency;
  /** Apply destination fees/commissions. Defaults to `true`. */
  applyFees: boolean;
}

export interface BuildMoneyProjectionContextOptions {
  rates?: ExchangeRates | null;
  applyFees?: boolean;
}

/**
 * Build a {@link MoneyProjectionContext} from the app's current active state.
 *
 * Only CURRENTLY ACTIVE manual overrides and commissions are captured — expired
 * 24h overrides are already filtered out upstream. Because baselines never store
 * a rate, manual overrides only ever influence live projection (rule #5) and can
 * never retroactively rewrite a historical entry.
 */
export function buildMoneyProjectionContext(
  displayCurrency: ExpenseCurrency,
  options?: BuildMoneyProjectionContextOptions,
): MoneyProjectionContext {
  const rates = options?.rates ?? getCachedExchangeRates();
  const activeFees = toActiveFeesFromCommissionEntries(listActiveCurrencyCommissions());
  const activeExchangeRates = rates
    ? toActiveExchangeRatesFromSnapshot(rates, listActiveManualExchangeOverrides())
    : { ilsToForeign: {}, manualPairs: [] };
  return {
    rates,
    activeFees,
    activeExchangeRates,
    displayCurrency,
    applyFees: options?.applyFees ?? true,
  };
}

/**
 * Project an immutable baseline into `targetCurrency`.
 *
 * - ZERO-MATH REVERSION: baseline currency === target ⇒ returns `originalAmount`
 *   exactly (no rates, no fees, no extra rounding).
 * - Otherwise a SINGLE direct hop from the baseline to the target is performed
 *   via the shared transaction engine (fees applied at the destination when
 *   `applyFees`). ILS results are smart-rounded so near-integer drift snaps
 *   cleanly; foreign results use standard 2-decimal rounding.
 *
 * Returns `null` only when a conversion is required but no rate is available.
 */
export function projectMoney(
  base: ImmutableMoney,
  targetCurrency: ExpenseCurrency,
  ctx: MoneyProjectionContext,
): number | null {
  if (!(base.originalAmount > 0)) return 0;

  // Rule #3 — Zero-math reversion.
  if (base.originalCurrency === targetCurrency) {
    return base.originalAmount;
  }

  if (!ctx.rates) return null;

  if (ctx.applyFees) {
    const processed = processTransactionWithUserRules(
      base.originalAmount,
      base.originalCurrency,
      targetCurrency,
      ctx.activeFees,
      ctx.activeExchangeRates,
      { displayCurrency: ctx.displayCurrency },
    );
    if (processed == null) return null;
    return targetCurrency === 'ILS'
      ? smartRoundMoney(processed.finalConvertedAmount)
      : roundMoney(processed.finalConvertedAmount);
  }

  const converted = convertAmountWithActiveRates(
    base.originalAmount,
    base.originalCurrency,
    targetCurrency,
    ctx.activeExchangeRates,
  );
  if (converted == null) return null;
  return targetCurrency === 'ILS' ? smartRoundMoney(converted) : roundMoney(converted);
}

/**
 * Hierarchical rollup (rule #4): project EACH child from its own baseline into
 * `targetCurrency`, then sum. No child is ever chained through another
 * conversion. Children that cannot be projected (missing rate) are skipped.
 * The final sum is rounded once (smart-round for ILS).
 */
export function sumMoneyProjections(
  bases: ReadonlyArray<ImmutableMoney>,
  targetCurrency: ExpenseCurrency,
  ctx: MoneyProjectionContext,
): number {
  let total = 0;
  for (const base of bases) {
    const projected = projectMoney(base, targetCurrency, ctx);
    if (projected != null) total += projected;
  }
  return targetCurrency === 'ILS' ? smartRoundMoney(total) : roundMoney(total);
}

/**
 * Convenience: project a baseline and format it as a plain number string-safe
 * value, returning the baseline's own amount when projection is unavailable.
 * Prefer {@link projectMoney} when you need to distinguish "no rate" (null).
 */
export function projectMoneyOrBaseline(
  base: ImmutableMoney,
  targetCurrency: ExpenseCurrency,
  ctx: MoneyProjectionContext,
): number {
  const projected = projectMoney(base, targetCurrency, ctx);
  return projected ?? base.originalAmount;
}

/** Symbol for an {@link ImmutableMoney}'s baseline currency (display helper). */
export function immutableMoneyCurrencySymbol(money: ImmutableMoney): string {
  return currencySymbol(money.originalCurrency);
}
