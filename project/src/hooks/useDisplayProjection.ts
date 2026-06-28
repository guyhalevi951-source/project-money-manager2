import { useMemo } from 'react';
import { useLanguage } from '../LanguageContext';
import type { ExpenseCurrency } from '../constants/currencies';
import { getCachedExchangeRates } from '../services/exchangeRateService';
import { formatAmountWithSymbol } from '../services/displayCurrencyUtils';
import {
  buildMoneyProjectionContext,
  createImmutableMoney,
  immutableFromExpense,
  immutableFromIls,
  projectMoneyOrBaseline,
  resolveCurrencyCode,
  type ImmutableMoney,
} from '../services/immutableMoney';
import { isCapsuleV2, resolveAutonomousExpenseDisplay } from '../services/expenseTimeCapsuleEngine';

/** A baseline-aware money record ({ amount, currency } as typed). */
export interface OriginalMoneyLike {
  amount: number;
  currency: string;
}

/** A stored expense's baseline-bearing fields. */
export interface ExpenseLike {
  amount: number;
  originalAmount?: number;
  originalCurrency?: string;
  /** Allows v2 capsule routing for expenses that carry a frozen market matrix. */
  creationTimeCapsule?: import('../services/expenseConversionService').ExpenseCreationTimeCapsule;
  amountInManual?: number | null;
  amountInSpot?: number;
  displayAmountInManual?: number | null;
  displayAmountInSpot?: number;
  manualRateUsed?: boolean;
  feeApplied?: boolean;
  appliedFeePercent?: number;
}

/**
 * Centralized visualization projection layer for the Immutable Source-of-Truth
 * architecture.
 *
 * Every chart, donut, progress bar, legend, tooltip and rollup stat must compute
 * its dataset from amounts projected — in a single hop — from each entity's
 * immutable baseline into the *currently active display currency*, then format
 * with that currency's symbol. This guarantees the visuals are 100% consistent
 * with the on-screen text (which already reverts losslessly to the baseline),
 * with zero floating-point bleed.
 *
 * The whole helper bundle is memoized on `(displayCurrency, rates)` so switching
 * between ILS / USD / GBP / EUR triggers a single fast recompute.
 */
export interface DisplayProjection {
  /** Active app display currency. */
  displayCurrency: ExpenseCurrency;
  /** Project any immutable baseline into the active display currency. */
  project: (base: ImmutableMoney) => number;
  /** Project a stored expense via its `originalAmount`/`originalCurrency` baseline. */
  projectExpense: (expense: ExpenseLike) => number;
  /**
   * Project a typed baseline `{ amount, currency }`, falling back to its flat ILS
   * ledger value when no baseline exists (legacy data). Used for budgets/sub-budgets.
   */
  projectOriginalOrIls: (
    original: OriginalMoneyLike | null | undefined,
    ilsLedgerAmount: number,
  ) => number;
  /** Sum a list of expenses' projected (display-currency) amounts. */
  sumExpenses: (expenses: ReadonlyArray<ExpenseLike>) => number;
  /** Format an amount that is ALREADY in the active display currency. */
  format: (displayAmount: number) => string;
}

export function useDisplayProjection(): DisplayProjection {
  const { displayCurrency } = useLanguage();
  // Not reactive on its own; components re-render on data/state changes and pick
  // up fresh rates. Included in the memo key so a rate refresh recomputes cleanly.
  const rates = getCachedExchangeRates();

  return useMemo<DisplayProjection>(() => {
    const ctx = buildMoneyProjectionContext(displayCurrency, { rates, applyFees: false });

    const project = (base: ImmutableMoney): number =>
      projectMoneyOrBaseline(base, displayCurrency, ctx);

    const projectExpense = (expense: ExpenseLike): number => {
      // v2 capsule expenses are resolved autonomously from the frozen market matrix —
      // no live rate lookups, consistent with the history-row and edit-modal display.
      const capsule = expense.creationTimeCapsule;
      if (isCapsuleV2(capsule)) {
        return resolveAutonomousExpenseDisplay(expense, displayCurrency, capsule).primaryAmount;
      }
      return project(immutableFromExpense(expense));
    };

    const projectOriginalOrIls = (
      original: OriginalMoneyLike | null | undefined,
      ilsLedgerAmount: number,
    ): number => {
      const base =
        original && original.amount > 0
          ? createImmutableMoney(original.amount, resolveCurrencyCode(original.currency))
          : immutableFromIls(ilsLedgerAmount);
      return project(base);
    };

    const sumExpenses = (expenses: ReadonlyArray<ExpenseLike>): number =>
      expenses.reduce((sum, expense) => sum + projectExpense(expense), 0);

    const format = (displayAmount: number): string =>
      formatAmountWithSymbol(displayAmount, displayCurrency, {
        forceTwoDecimals: displayCurrency !== 'ILS',
      });

    return {
      displayCurrency,
      project,
      projectExpense,
      projectOriginalOrIls,
      sumExpenses,
      format,
    };
  }, [displayCurrency, rates]);
}
