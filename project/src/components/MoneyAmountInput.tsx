import { useCallback, useEffect, useRef, useState } from 'react';
import type { ExpenseCurrency } from '../constants/currencies';
import {
  convertForeignToIls,
  convertIlsToForeign,
  getCachedExchangeRates,
  type ExchangeRates,
} from '../services/exchangeRateService';
import {
  formatMoneyInputValue,
  parseMoneyInput,
  roundMoney,
  sanitizeMoneyInputDraft,
} from '../services/money';

interface MoneyAmountInputProps {
  /** Committed numeric value from parent state (ILS ledger). */
  value: number;
  /** Called on blur / Enter with parsed amount, or null when cleared to zero. */
  onCommit: (amount: number | null) => void;
  /** When set, the field edits amounts in this currency while parent state stays in ILS. */
  displayCurrency?: ExpenseCurrency;
  exchangeRates?: ExchangeRates | null;
  className?: string;
  placeholder?: string;
  inputMode?: 'decimal' | 'numeric';
  'aria-label'?: string;
}

function ledgerToDisplayAmount(
  ilsAmount: number,
  displayCurrency: ExpenseCurrency | undefined,
  rates: ExchangeRates | null,
): number {
  if (!displayCurrency || displayCurrency === 'ILS' || !(ilsAmount > 0)) return ilsAmount;
  const converted = convertIlsToForeign(ilsAmount, displayCurrency, rates);
  return converted == null ? ilsAmount : roundMoney(converted);
}

function displayToLedgerAmount(
  displayAmount: number,
  displayCurrency: ExpenseCurrency | undefined,
  rates: ExchangeRates | null,
): number | null {
  if (!displayCurrency || displayCurrency === 'ILS') return roundMoney(displayAmount);
  const converted = convertForeignToIls(displayAmount, displayCurrency, rates);
  return converted == null ? null : roundMoney(converted);
}

/**
 * Text-based money input that keeps a local draft while typing.
 * Parent state is updated only on blur or Enter — never mid-keystroke.
 */
export default function MoneyAmountInput({
  value,
  onCommit,
  displayCurrency,
  exchangeRates = null,
  className = '',
  placeholder,
  inputMode = 'decimal',
  'aria-label': ariaLabel,
}: MoneyAmountInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const rates = exchangeRates ?? getCachedExchangeRates();
  const displayValue = ledgerToDisplayAmount(value, displayCurrency, rates);
  const [draft, setDraft] = useState(() => formatMoneyInputValue(displayValue));
  const isFocusedRef = useRef(false);

  useEffect(() => {
    if (isFocusedRef.current) return;
    setDraft(formatMoneyInputValue(ledgerToDisplayAmount(value, displayCurrency, rates)));
  }, [value, displayCurrency, rates]);

  const commitDraft = useCallback(() => {
    const parsed = parseMoneyInput(draft);
    if (parsed === null) {
      if (draft.trim() === '' || draft.trim() === '.') {
        if (value > 0) {
          onCommit(null);
        }
        setDraft('');
        return;
      }
      setDraft(formatMoneyInputValue(displayValue));
      return;
    }
    const ledgerAmount = displayToLedgerAmount(parsed, displayCurrency, rates);
    if (ledgerAmount == null) {
      setDraft(formatMoneyInputValue(displayValue));
      return;
    }
    onCommit(ledgerAmount);
    setDraft(
      formatMoneyInputValue(ledgerToDisplayAmount(ledgerAmount, displayCurrency, rates)),
    );
  }, [draft, displayCurrency, displayValue, onCommit, rates, value]);

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
