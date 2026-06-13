import { useCallback, useEffect, useRef, useState } from 'react';
import type { ExpenseCurrency } from '../constants/currencies';
import {
  convertDisplayAmountToLedgerCurrency,
  convertLedgerAmountToDisplayCurrency,
} from '../services/displayCurrencyUtils';
import { getCachedExchangeRates, type ExchangeRates } from '../services/exchangeRateService';
import {
  formatMoneyInputValue,
  parseMoneyInput,
  sanitizeMoneyInputDraft,
} from '../services/money';

interface MoneyAmountInputProps {
  /** Committed numeric value from parent state (ILS ledger). */
  value: number;
  /** Called on blur / Enter with parsed amount, or null when cleared to zero. */
  onCommit: (amount: number | null) => void;
  /**
   * Immutable Source-of-Truth baseline (the exact amount + currency the user
   * typed). When its currency matches the active display currency the field
   * renders the baseline amount with ZERO conversion math (lossless reversion),
   * eliminating round-trip precision drift / flashing decimals.
   */
  baseline?: { amount: number; currency: ExpenseCurrency } | null;
  /**
   * Reports the immutable baseline on commit (typed amount + active display
   * currency), or null when cleared. Lets the parent persist the Source of Truth
   * alongside the ILS ledger.
   */
  onCommitOriginal?: (original: { amount: number; currency: ExpenseCurrency } | null) => void;
  /** When set, the field edits amounts in this currency while parent state stays in ILS. */
  displayCurrency?: ExpenseCurrency;
  exchangeRates?: ExchangeRates | null;
  className?: string;
  placeholder?: string;
  inputMode?: 'decimal' | 'numeric';
  'aria-label'?: string;
}

/**
 * Text-based money input that keeps a local draft while typing.
 * Parent state is updated only on blur or Enter — never mid-keystroke.
 */
export default function MoneyAmountInput({
  value,
  onCommit,
  baseline = null,
  onCommitOriginal,
  displayCurrency,
  exchangeRates = null,
  className = '',
  placeholder,
  inputMode = 'decimal',
  'aria-label': ariaLabel,
}: MoneyAmountInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const rates = exchangeRates ?? getCachedExchangeRates();
  const activeCurrency = displayCurrency ?? 'ILS';

  // Zero-math reversion: when the baseline currency matches the active display
  // currency, show the exact typed amount instead of re-projecting the ILS ledger.
  const resolveDisplayValue = (ledger: number): number => {
    if (baseline && baseline.currency === activeCurrency) return baseline.amount;
    return convertLedgerAmountToDisplayCurrency(ledger, activeCurrency, rates) ?? ledger;
  };

  const displayValue = resolveDisplayValue(value);
  const [draft, setDraft] = useState(() => formatMoneyInputValue(displayValue));
  const isFocusedRef = useRef(false);

  useEffect(() => {
    if (isFocusedRef.current) return;
    setDraft(formatMoneyInputValue(resolveDisplayValue(value)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, displayCurrency, rates, baseline?.amount, baseline?.currency]);

  const commitDraft = useCallback(() => {
    const parsed = parseMoneyInput(draft);
    if (parsed === null) {
      if (draft.trim() === '' || draft.trim() === '.') {
        if (value > 0) {
          onCommit(null);
          onCommitOriginal?.(null);
        }
        setDraft('');
        return;
      }
      setDraft(formatMoneyInputValue(displayValue));
      return;
    }
    const ledgerAmount = convertDisplayAmountToLedgerCurrency(parsed, activeCurrency, rates);
    if (ledgerAmount == null) {
      setDraft(formatMoneyInputValue(displayValue));
      return;
    }
    onCommit(ledgerAmount);
    // Persist the exact typed value + active currency as the immutable baseline.
    onCommitOriginal?.({ amount: parsed, currency: activeCurrency });
    // Baseline-driven fields echo the exact typed value (zero-math); legacy
    // ledger-only fields re-project the rounded ILS ledger as before.
    setDraft(
      formatMoneyInputValue(
        onCommitOriginal
          ? parsed
          : convertLedgerAmountToDisplayCurrency(ledgerAmount, activeCurrency, rates) ?? ledgerAmount,
      ),
    );
  }, [draft, activeCurrency, displayValue, onCommit, onCommitOriginal, rates, value]);

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode={inputMode}
      value={draft}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onFocus={() => {
        isFocusedRef.current = true;
      }}
      onChange={(e) => {
        setDraft(sanitizeMoneyInputDraft(e.target.value));
      }}
      onBlur={() => {
        isFocusedRef.current = false;
        commitDraft();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          inputRef.current?.blur();
        }
      }}
      className={className}
    />
  );
}
