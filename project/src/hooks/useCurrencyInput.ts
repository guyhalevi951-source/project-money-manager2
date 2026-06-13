import { useCallback, useMemo, useRef, useState } from 'react';
import type { ExpenseCurrency } from '../constants/currencies';
import {
  formatMoneyInputValue,
  parseMoneyInput,
  sanitizeMoneyInputDraft,
} from '../services/money';
import {
  createImmutableMoney,
  type ImmutableMoney,
} from '../services/immutableMoney';

export interface UseCurrencyInputOptions {
  /** Existing immutable baseline to seed/control the field (null = empty). */
  value: ImmutableMoney | null;
  /** Currency the value is entered in (controlled by the parent picker). */
  currency: ExpenseCurrency;
  /**
   * Emits the immutable baseline `{ originalAmount, originalCurrency }` whenever
   * the user commits a value, or `null` when the field is cleared.
   *
   * IMPORTANT: the value is stored EXACTLY as typed in `currency`. No exchange
   * math happens here — projection to other currencies is a display concern
   * handled by `projectMoney`.
   */
  onCommit: (money: ImmutableMoney | null) => void;
}

export interface UseCurrencyInputResult {
  draft: string;
  setDraft: (raw: string) => void;
  commit: () => void;
  onFocus: () => void;
  onBlur: () => void;
}

/**
 * Headless controller for an immutable money field.
 *
 * Keeps a local draft while typing and only emits an {@link ImmutableMoney}
 * baseline on commit (blur / Enter). This is the single mechanism every money
 * input in the app must use so the immutable source-of-truth contract is
 * enforced by construction — see `services/immutableMoney.ts`.
 */
export function useCurrencyInput({
  value,
  currency,
  onCommit,
}: UseCurrencyInputOptions): UseCurrencyInputResult {
  const baselineAmount = useMemo(
    () => (value && value.originalAmount > 0 ? value.originalAmount : 0),
    [value],
  );
  const [draft, setDraftState] = useState(() => formatMoneyInputValue(baselineAmount));
  const isFocusedRef = useRef(false);

  const setDraft = useCallback((raw: string) => {
    setDraftState(sanitizeMoneyInputDraft(raw));
  }, []);

  const commit = useCallback(() => {
    isFocusedRef.current = false;
    const parsed = parseMoneyInput(draft);
    if (parsed === null) {
      if (value != null) onCommit(null);
      setDraftState('');
      return;
    }
    const next = createImmutableMoney(parsed, currency);
    onCommit(next);
    setDraftState(formatMoneyInputValue(next.originalAmount));
  }, [draft, currency, value, onCommit]);

  const onFocus = useCallback(() => {
    isFocusedRef.current = true;
  }, []);

  const onBlur = useCallback(() => {
    commit();
  }, [commit]);

  // Re-seed the draft from the controlled baseline when not actively editing.
  const lastSeedRef = useRef<number>(baselineAmount);
  if (!isFocusedRef.current && lastSeedRef.current !== baselineAmount) {
    lastSeedRef.current = baselineAmount;
    setDraftState(formatMoneyInputValue(baselineAmount));
  }

  return { draft, setDraft, commit, onFocus, onBlur };
}
