/**
 * ============================================================================
 *  Time Capsule Autonomous State Engine — v2
 * ============================================================================
 *
 * For any expense stored with `ExpenseCreationTimeCapsuleV2` (version: 2), ALL
 * display-currency conversions route exclusively through this engine. It never
 * calls live exchange-rate services, live manual-override lookups, or live
 * commission queries — only the frozen market-rate matrix and the immutable
 * manual/fee rules captured at save time are used.
 *
 * Public API
 * ──────────
 *  captureExpenseTimeCapsuleV2     save-time capture (create + date-change re-capture)
 *  refreshMarketMatrixOnly          date-change matrix refresh (manual/fees immutable)
 *  resolveAutonomousExpenseDisplay  single resolver for all render consumers (Rules 2–4)
 *  isCapsuleV2                      re-exported type guard
 *
 * Rules implemented
 * ─────────────────
 *  Rule 2  Cascading triangulation (display-currency switch via frozen matrix)
 *  Rule 3  Identical-currency safeguard (originalCurrency === displayCurrency)
 *  Rule 4  Multi-manual-rate priority (pairStates direct match → most-recent)
 * ============================================================================
 */

import { roundMoney } from './money';
import {
  captureExpenseTimeCapsule,
  isCapsuleV2,
  resolveManualRateFromCapsule,
  resolveFeePercentFromCapsule,
  type ExpenseCreationTimeCapsule,
  type ExpenseCreationTimeCapsuleV2,
  type ExpenseMarketRateMatrix,
  type ExpensePairModifierState,
  type StoredExpenseDisplayFields,
} from './expenseConversionService';
import {
  buildRateKey,
  sliceRateCacheForDate,
  ensureHistoricalRatesForDate,
} from './rateCacheService';
import type { ExpenseCurrency } from '../constants/currencies';

// Re-export the type guard so callers only need one import.
export { isCapsuleV2 };

// ── Capture ──────────────────────────────────────────────────────────────────

/**
 * Create a v2 capsule by:
 *  1. Capturing the entire active manual/fee environment (same as v1).
 *  2. Slicing the unified rate cache for `transactionDate` into a frozen matrix.
 *  3. Storing initial `pairStates` for Rule 1 / Rule 4 bookkeeping.
 */
export function captureExpenseTimeCapsuleV2(
  transactionDate: string,
  initialPairStates: ExpensePairModifierState[] = [],
): ExpenseCreationTimeCapsuleV2 {
  const base = captureExpenseTimeCapsule();
  const entries = sliceRateCacheForDate(transactionDate);
  const marketMatrix: ExpenseMarketRateMatrix = {
    transactionDate,
    capturedAt: Date.now(),
    entries,
  };
  return {
    ...base,
    version: 2,
    transactionDate,
    marketMatrix,
    pairStates: initialPairStates,
  };
}

// ── Matrix refresh ────────────────────────────────────────────────────────────

/**
 * Re-freeze market rates for a new `transactionDate` (called only when the
 * expense's date field changes during an edit). Everything else — `manualRates`,
 * `fees`, `pairStates` — stays byte-identical per the immutability spec.
 */
export async function refreshMarketMatrixOnly(
  capsule: ExpenseCreationTimeCapsuleV2,
  newTransactionDate: string,
  pairs: ReadonlyArray<{ from: ExpenseCurrency; to: ExpenseCurrency }>,
): Promise<ExpenseCreationTimeCapsuleV2> {
  const entries = await ensureHistoricalRatesForDate(newTransactionDate, pairs);
  return {
    ...capsule,
    transactionDate: newTransactionDate,
    marketMatrix: {
      transactionDate: newTransactionDate,
      capturedAt: Date.now(),
      entries,
    },
    // manualRates, fees, pairStates: UNCHANGED
  };
}

// ── CapsuleRateProvider (internal) ────────────────────────────────────────────

/**
 * Read the API spot rate (1 `from` = rate × `to`) from a frozen matrix.
 * Checks the direct key first, then the inverse pair. Returns null when the
 * pair has no API rate in the matrix — callers must handle the null gracefully.
 */
function getMatrixSpotRate(
  matrix: ExpenseMarketRateMatrix,
  from: ExpenseCurrency,
  to: ExpenseCurrency,
): number | null {
  if (from === to) return 1;
  const date = matrix.transactionDate;
  const direct = matrix.entries[buildRateKey(date, from, to)];
  if (direct?.apiRate != null && direct.apiRate > 0) return direct.apiRate;
  const inverse = matrix.entries[buildRateKey(date, to, from)];
  if (inverse?.apiRate != null && inverse.apiRate > 0) return 1 / inverse.apiRate;
  return null;
}

/**
 * Triangulate `from → to` via the ILS pivot using only frozen matrix rates.
 * Covers F2F (non-ILS pairs) without any live API call.
 */
function triangulateViaIls(
  matrix: ExpenseMarketRateMatrix,
  from: ExpenseCurrency,
  to: ExpenseCurrency,
): number | null {
  if (from === to) return 1;
  const direct = getMatrixSpotRate(matrix, from, to);
  if (direct != null) return direct;
  if (from === 'ILS' || to === 'ILS') return null;
  // F2F: from → ILS → to
  const fromIls = getMatrixSpotRate(matrix, from, 'ILS');
  const ilsTo = getMatrixSpotRate(matrix, 'ILS', to);
  if (fromIls == null || ilsTo == null) return null;
  return fromIls * ilsTo;
}

// ── Rule 4 — Multi-manual-rate priority ──────────────────────────────────────

/**
 * Determine which `ExpensePairModifierState` entry should drive the manual path
 * for a given `originalCurrency → targetDisplay` pair.
 *
 * Priority 1: pairStates entry where `from === originalCurrency`,
 *             `displayCurrency === targetDisplay`, and `manualRateUsed === true`.
 * Priority 2: Among remaining `manualRateUsed` entries, the one with the
 *             highest `lastModifiedAt` (most recently activated by the user).
 *
 * Returns null when no manual entry exists.
 */
function selectActiveManualPair(
  capsule: ExpenseCreationTimeCapsuleV2,
  originalCurrency: ExpenseCurrency,
  targetDisplay: ExpenseCurrency,
): ExpensePairModifierState | null {
  const states = capsule.pairStates;
  if (!states || states.length === 0) return null;

  // Priority 1: exact pair match
  const direct = states.find(
    (s) =>
      s.from === originalCurrency &&
      s.displayCurrency === targetDisplay &&
      s.manualRateUsed,
  );
  if (direct) return direct;

  // Priority 2: most recently modified manual entry (any displayCurrency)
  const manualEntries = states.filter((s) => s.manualRateUsed);
  if (manualEntries.length === 0) return null;
  return manualEntries.reduce((best, curr) =>
    curr.lastModifiedAt > best.lastModifiedAt ? curr : best,
  );
}

// ── Autonomous display resolver ───────────────────────────────────────────────

export interface AutonomousDisplayResult {
  /** Amount expressed in `targetDisplayCurrency`. */
  primaryAmount: number;
  /** ILS canonical ledger amount. */
  ledgerIlsAmount: number;
  /** Whether the manual rate path is driving the display. */
  manualActive: boolean;
  /** Whether a commission fee is included in `primaryAmount`. */
  feeActive: boolean;
  /** Which resolution algorithm produced `primaryAmount`. */
  triangulationPath: 'direct' | 'manual' | 'fee-only' | 'spot';
  /** The base pair driving the conversion. */
  sourcePair: { from: ExpenseCurrency; to: ExpenseCurrency };
}

/**
 * Resolve the primary display amount for a saved expense using ONLY its frozen
 * v2 capsule. No live exchange-rate calls, no live manual-override lookups, no
 * live commission queries.
 *
 * Implements:
 *  Rule 2 — Cascading triangulation via frozen matrix when display currency changes
 *  Rule 3 — Identical-currency safeguard: return `originalAmount` directly
 *  Rule 4 — Multi-manual priority via `pairStates` (direct match → most-recent)
 *
 * Falls back gracefully when the matrix lacks a rate for a given pair (returns
 * the stored ILS ledger amount instead of throwing).
 */
export function resolveAutonomousExpenseDisplay(
  expense: StoredExpenseDisplayFields,
  targetDisplayCurrency: ExpenseCurrency,
  capsule: ExpenseCreationTimeCapsuleV2,
  options?: {
    /** Override the expense's `manualRateUsed` toggle state (edit modal). */
    manualRateUsed?: boolean;
    /** Override the expense's `feeApplied` toggle state (edit modal). */
    feeApplied?: boolean;
  },
): AutonomousDisplayResult {
  const originalCurrency: ExpenseCurrency =
    expense.originalCurrency
      ? (expense.originalCurrency.trim().toUpperCase() as ExpenseCurrency)
      : 'ILS';

  const typedAmount =
    expense.originalAmount != null && expense.originalAmount > 0
      ? expense.originalAmount
      : expense.amount;

  const wantsManual = options?.manualRateUsed ?? (expense.manualRateUsed !== false);
  const wantsFee = options?.feeApplied ?? (expense.feeApplied === true);

  const matrix = capsule.marketMatrix;

  // ── Rule 3: Identical-currency safeguard ─────────────────────────────────
  if (originalCurrency === targetDisplayCurrency) {
    return {
      primaryAmount: roundMoney(typedAmount),
      ledgerIlsAmount: roundMoney(expense.amount),
      manualActive: false,
      feeActive: false,
      triangulationPath: 'direct',
      sourcePair: { from: originalCurrency, to: targetDisplayCurrency },
    };
  }

  // ── ILS canonical ledger ──────────────────────────────────────────────────
  let ledgerIlsAmount: number;
  if (originalCurrency === 'ILS') {
    ledgerIlsAmount = roundMoney(typedAmount);
  } else if (expense.amountInManual != null && expense.amountInSpot != null) {
    ledgerIlsAmount = roundMoney(
      wantsManual && expense.amountInManual != null
        ? expense.amountInManual
        : expense.amountInSpot,
    );
  } else {
    ledgerIlsAmount = roundMoney(expense.amount);
  }

  // ── Rule 2 path resolution ────────────────────────────────────────────────

  const feePercent = wantsFee
    ? (resolveFeePercentFromCapsule(capsule, originalCurrency) ?? 0)
    : 0;
  const feeActive = feePercent > 0;

  // ── Path A: Manual ────────────────────────────────────────────────────────
  const hasManualForPair =
    resolveManualRateFromCapsule(capsule, originalCurrency, targetDisplayCurrency) != null ||
    resolveManualRateFromCapsule(capsule, originalCurrency, 'ILS') != null;

  if (wantsManual && hasManualForPair) {
    // Rule 4: pick best pairState for this target
    const bestPair = selectActiveManualPair(capsule, originalCurrency, targetDisplayCurrency);

    // First, attempt to use the persisted display amount from pairStates
    if (bestPair != null) {
      const M = bestPair.displayCurrency;
      const manualAmountInM = bestPair.displayAmountInManual ?? null;

      if (manualAmountInM != null && manualAmountInM > 0) {
        let primaryAmount: number;
        if (M === targetDisplayCurrency) {
          primaryAmount = roundMoney(manualAmountInM);
        } else {
          // Triangulate M → targetDisplay via frozen spot
          const mRate = triangulateViaIls(matrix, M as ExpenseCurrency, targetDisplayCurrency);
          primaryAmount = mRate != null && mRate > 0
            ? roundMoney(manualAmountInM * mRate)
            : roundMoney(ledgerIlsAmount);
        }
        return {
          primaryAmount,
          ledgerIlsAmount,
          manualActive: true,
          feeActive,
          triangulationPath: 'manual',
          sourcePair: { from: originalCurrency, to: targetDisplayCurrency },
        };
      }
    }

    // Fallback: try stored expense display paths (from initial save, pairStates empty)
    if (expense.displayAmountInManual != null && expense.displayAmountInManual > 0) {
      // Stored displayAmountInManual is in the display currency at save time.
      // We use it as-is when targetDisplay matches; otherwise triangulate via matrix.
      // We don't know the exact save-time displayCurrency here, but if the current
      // target matches the snapshot, it's valid. For other targets, use the ILS path.
      if (targetDisplayCurrency !== 'ILS') {
        // Try: if displayAmountInManual can be directly used (same display currency context)
        // or triangulate from ILS ledger via manual rate
        const directManualRate = resolveManualRateFromCapsule(capsule, originalCurrency, targetDisplayCurrency);
        if (directManualRate != null && directManualRate > 0) {
          let rawAmount = typedAmount * directManualRate;
          if (feePercent > 0) rawAmount *= 1 + feePercent / 100;
          return {
            primaryAmount: roundMoney(rawAmount),
            ledgerIlsAmount,
            manualActive: true,
            feeActive,
            triangulationPath: 'manual',
            sourcePair: { from: originalCurrency, to: targetDisplayCurrency },
          };
        }

        // Via ILS pivot: compute manual ILS amount, then ILS → targetDisplay via matrix
        const manualIlsRate = resolveManualRateFromCapsule(capsule, originalCurrency, 'ILS');
        if (manualIlsRate != null && manualIlsRate > 0) {
          let manualIls = typedAmount * manualIlsRate;
          if (feePercent > 0) manualIls *= 1 + feePercent / 100;
          const ilsToTarget = triangulateViaIls(matrix, 'ILS', targetDisplayCurrency);
          if (ilsToTarget != null && ilsToTarget > 0) {
            return {
              primaryAmount: roundMoney(manualIls * ilsToTarget),
              ledgerIlsAmount,
              manualActive: true,
              feeActive,
              triangulationPath: 'manual',
              sourcePair: { from: originalCurrency, to: targetDisplayCurrency },
            };
          }
        }
      }
    }

    // Last resort: compute manual amount directly from capsule rate
    const manualRate =
      resolveManualRateFromCapsule(capsule, originalCurrency, targetDisplayCurrency) ??
      resolveManualRateFromCapsule(capsule, originalCurrency, 'ILS');

    if (manualRate != null && manualRate > 0) {
      let rawAmount = typedAmount * manualRate;
      if (feePercent > 0) rawAmount *= 1 + feePercent / 100;

      // If rate is to ILS but target is foreign, triangulate
      const manualCurrency = resolveManualRateFromCapsule(capsule, originalCurrency, targetDisplayCurrency) != null
        ? targetDisplayCurrency
        : 'ILS';

      if (manualCurrency === targetDisplayCurrency) {
        return {
          primaryAmount: roundMoney(rawAmount),
          ledgerIlsAmount,
          manualActive: true,
          feeActive,
          triangulationPath: 'manual',
          sourcePair: { from: originalCurrency, to: targetDisplayCurrency },
        };
      }

      // manualCurrency === 'ILS', target is foreign
      const ilsToTarget = triangulateViaIls(matrix, 'ILS', targetDisplayCurrency);
      if (ilsToTarget != null && ilsToTarget > 0) {
        return {
          primaryAmount: roundMoney(rawAmount * ilsToTarget),
          ledgerIlsAmount,
          manualActive: true,
          feeActive,
          triangulationPath: 'manual',
          sourcePair: { from: originalCurrency, to: targetDisplayCurrency },
        };
      }
    }
  }

  // ── Path B / C: Spot or Fee-only ─────────────────────────────────────────

  if (targetDisplayCurrency === 'ILS') {
    return {
      primaryAmount: ledgerIlsAmount,
      ledgerIlsAmount,
      manualActive: false,
      feeActive,
      triangulationPath: feeActive ? 'fee-only' : 'spot',
      sourcePair: { from: originalCurrency, to: targetDisplayCurrency },
    };
  }

  // Try persisted spot display snapshot
  if (!wantsManual && expense.displayAmountInSpot != null && expense.displayAmountInSpot > 0) {
    return {
      primaryAmount: roundMoney(expense.displayAmountInSpot),
      ledgerIlsAmount,
      manualActive: false,
      feeActive,
      triangulationPath: feeActive ? 'fee-only' : 'spot',
      sourcePair: { from: originalCurrency, to: targetDisplayCurrency },
    };
  }

  // Compute from frozen matrix via triangulation
  const spotRate = triangulateViaIls(matrix, originalCurrency, targetDisplayCurrency);
  if (spotRate != null && spotRate > 0) {
    let rawAmount = typedAmount * spotRate;
    if (feePercent > 0) rawAmount *= 1 + feePercent / 100;
    return {
      primaryAmount: roundMoney(rawAmount),
      ledgerIlsAmount,
      manualActive: false,
      feeActive,
      triangulationPath: feeActive ? 'fee-only' : 'spot',
      sourcePair: { from: originalCurrency, to: targetDisplayCurrency },
    };
  }

  // Ultimate fallback: ILS ledger amount (matrix lacks the rate for this pair)
  return {
    primaryAmount: ledgerIlsAmount,
    ledgerIlsAmount,
    manualActive: false,
    feeActive: false,
    triangulationPath: 'spot',
    sourcePair: { from: originalCurrency, to: targetDisplayCurrency },
  };
}

// ── Helper: build a pairState entry for a just-computed snapshot ──────────────

/**
 * Construct a `ExpensePairModifierState` from a freshly computed dual snapshot.
 * Used at save time to populate `capsule.pairStates` with the initial pair.
 */
export function buildPairState(
  from: ExpenseCurrency,
  displayCurrency: ExpenseCurrency,
  manualRateUsed: boolean,
  feeApplied: boolean,
  displayAmountInManual: number | null | undefined,
  displayAmountInSpot: number | undefined,
): ExpensePairModifierState {
  return {
    from,
    displayCurrency,
    manualRateUsed,
    feeApplied,
    displayAmountInManual: displayAmountInManual ?? null,
    displayAmountInSpot,
    lastModifiedAt: Date.now(),
  };
}
