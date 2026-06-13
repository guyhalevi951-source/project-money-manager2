import { useCallback } from 'react';
import type { CurrencyCode, ExpenseCurrency } from '../constants/currencies';
import { surfaceInputClass } from '../styles/themeSurfaceStyles';
import { useCurrencyInput } from '../hooks/useCurrencyInput';
import {
  createImmutableMoney,
  type ImmutableMoney,
} from '../services/immutableMoney';
import CurrencySelector from './CurrencySelector';

export interface CurrencyInputProps {
  /** Immutable baseline value (null = empty field). */
  value: ImmutableMoney | null;
  /** Emits the immutable baseline on commit, or null when cleared. */
  onChange: (money: ImmutableMoney | null) => void;
  /** Currency the amount is typed in. */
  currency: ExpenseCurrency;
  /** Currency change handler (hidden when `lockCurrency`). */
  onCurrencyChange?: (currency: ExpenseCurrency) => void;
  lockCurrency?: boolean;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  inputMode?: 'decimal' | 'numeric';
  'aria-label'?: string;
}

/**
 * MANDATORY reusable money input for the Immutable Source-of-Truth architecture.
 *
 * Any feature that accepts a monetary value MUST use this component (or the
 * headless `useCurrencyInput` hook). It captures the exact typed amount + chosen
 * currency and emits an {@link ImmutableMoney} baseline — it performs NO exchange
 * math. Projection into other currencies is a pure display concern handled by
 * `projectMoney` in `services/immutableMoney.ts`.
 *
 * Mobile-first: large touch targets, `inputMode` numeric keypad, full-width
 * layout, and the shared themed `CurrencySelector` for currency choice.
 */
export default function CurrencyInput({
  value,
  onChange,
  currency,
  onCurrencyChange,
  lockCurrency = false,
  placeholder,
  className = '',
  inputClassName = '',
  inputMode = 'decimal',
  'aria-label': ariaLabel,
}: CurrencyInputProps) {
  const { draft, setDraft, commit, onFocus, onBlur } = useCurrencyInput({
    value,
    currency,
    onCommit: onChange,
  });

  const handleCurrencyChange = useCallback(
    (next: CurrencyCode) => {
      onCurrencyChange?.(next);
      // Re-stamp the existing typed amount under the newly chosen currency so the
      // baseline currency always matches what the user sees. No conversion: the
      // number the user typed is preserved verbatim under the new currency.
      if (value != null && value.originalAmount > 0) {
        onChange(createImmutableMoney(value.originalAmount, next));
      }
    },
    [onCurrencyChange, onChange, value],
  );

  return (
    <div className={`flex w-full items-stretch gap-2 ${className}`.trim()}>
      <input
        type="text"
        inputMode={inputMode}
        value={draft}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={(event) => setDraft(event.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            (event.target as HTMLInputElement).blur();
          }
        }}
        className={`h-12 min-w-0 flex-1 px-4 text-base tabular-nums ${surfaceInputClass} ${inputClassName}`.trim()}
      />
      {!lockCurrency && (
        <CurrencySelector
          value={currency}
          onChange={handleCurrencyChange}
          className="shrink-0"
        />
      )}
    </div>
  );
}
