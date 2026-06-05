import { useCallback, useEffect, useRef, useState } from 'react';
import {
  formatMoneyInputValue,
  parseMoneyInput,
  sanitizeMoneyInputDraft,
} from '../services/money';

interface MoneyAmountInputProps {
  /** Committed numeric value from parent state. */
  value: number;
  /** Called on blur / Enter with parsed amount, or null when cleared to zero. */
  onCommit: (amount: number | null) => void;
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
  className = '',
  placeholder,
  inputMode = 'decimal',
  'aria-label': ariaLabel,
}: MoneyAmountInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(() => formatMoneyInputValue(value));
  const isFocusedRef = useRef(false);

  useEffect(() => {
    if (isFocusedRef.current) return;
    setDraft(formatMoneyInputValue(value));
  }, [value]);

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
      setDraft(formatMoneyInputValue(value));
      return;
    }
    onCommit(parsed);
    setDraft(formatMoneyInputValue(parsed));
  }, [draft, onCommit, value]);

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
