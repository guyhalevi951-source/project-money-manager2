import { LtrNumeric, useLanguage } from '../LanguageContext';

interface ExpenseAmountDisplayProps {
  amount: number;
  originalAmount?: number;
  originalCurrency?: string;
  variant?: 'table' | 'card';
  /** When false, hides the `(≈ …)` equivalent line (e.g. expense currency matches display currency). */
  showSecondaryLine?: boolean;
}

export default function ExpenseAmountDisplay({
  amount,
  originalAmount,
  originalCurrency,
  variant = 'table',
  showSecondaryLine = true,
}: ExpenseAmountDisplayProps) {
  const { formatExpenseMoney } = useLanguage();
  const { primary, secondary } = formatExpenseMoney(amount, originalAmount, originalCurrency);
  const equivalentLine = showSecondaryLine ? secondary : undefined;

  const mainClass =
    variant === 'card'
      ? 'text-base font-semibold text-neutral-100'
      : 'text-lg font-semibold text-neutral-100';

  return (
    <div
      className={[
        'flex flex-col justify-center',
        variant === 'card' ? 'items-end' : 'items-start sm:items-end',
        equivalentLine ? 'gap-0.5' : 'gap-0',
      ].join(' ')}
    >
      <LtrNumeric className={`${mainClass} whitespace-nowrap`}>{primary}</LtrNumeric>
      {equivalentLine && (
        <LtrNumeric className="text-xs text-neutral-500 whitespace-nowrap">{equivalentLine}</LtrNumeric>
      )}
    </div>
  );
}
