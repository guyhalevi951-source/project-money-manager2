/**
 * Dev-only budget sync tracing. Filter DevTools console with: MM-BUDGET-SYNC
 * Remove or set BUDGET_SYNC_DEBUG_ENABLED=false when debugging is complete.
 */
export const BUDGET_SYNC_DEBUG_ENABLED = import.meta.env.DEV;

const PREFIX = '[MM-BUDGET-SYNC]';

export type BudgetDebugStage =
  | 'create:start'
  | 'create:initialFinancial'
  | 'create:preEnterBudget'
  | 'create:postEnterBudget'
  | 'create:postEnterBudget:raf'
  | 'enterBudget:start'
  | 'enterBudget:resolved'
  | 'enterBudget:preApply'
  | 'applyAppData'
  | 'subscribeFinancial:incoming'
  | 'subscribeFinancial:rejected'
  | 'subscribeFinancial:applied'
  | 'subscribeFinancial:onMissing'
  | 'financialPersist'
  | 'financialSummary:render'
  | 'applyBudgetChange:start'
  | 'applyBudgetChange:registryPatch'
  | 'applyBudgetChange:registrySkipped'
  | 'patchRegistry'
  | 'subscribeRegistry:incoming'
  | 'personalBudgetsPage:render';

export function budgetDebug(
  stage: BudgetDebugStage,
  payload: Record<string, unknown>,
): void {
  if (!BUDGET_SYNC_DEBUG_ENABLED) return;
  console.log(`${PREFIX} ${stage}`, payload);
}

/** Shallow snapshot of financial fields for logs (avoids dumping full expense arrays). */
export function snapshotFinancialForLog(
  financial: {
    budgetsByMonth?: Record<string, number>;
    budgetOriginalByMonth?: Record<string, { amount: number; currency: string }>;
    autoTransferByMonth?: Record<string, boolean>;
    expenses?: unknown[];
    customCategories?: unknown[];
  } | null | undefined,
) {
  if (!financial) {
    return { budgetsByMonth: {}, budgetOriginalByMonth: {}, autoTransferByMonth: {} };
  }
  return {
    budgetsByMonth: financial.budgetsByMonth ?? {},
    budgetOriginalByMonth: financial.budgetOriginalByMonth ?? {},
    autoTransferByMonth: financial.autoTransferByMonth ?? {},
    expenseCount: financial.expenses?.length ?? 0,
    categoryCount: financial.customCategories?.length ?? 0,
  };
}

export function snapshotRegistryTotalsForLog(
  personal: Array<{ id: string; name: string; totalAmount: number }>,
) {
  return personal.map((b) => ({
    id: b.id.slice(-10),
    name: b.name,
    totalAmount: b.totalAmount,
  }));
}
