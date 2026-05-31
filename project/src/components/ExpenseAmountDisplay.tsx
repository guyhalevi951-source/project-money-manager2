import { LtrNumeric, useLanguage } from '../LanguageContext';

interface ExpenseAmountDisplayProps {
  amount: number;
  originalAmount?: number;
  originalCurrency?: string;
  variant?: 'table' | 'card';
}

export default function ExpenseAmountDisplay({
  amount,
  originalAmount,
  originalCurrency,
  variant = 'table',
}: ExpenseAmountDisplayProps) {
  const { formatExpenseMoney } = useLanguage();
  const { primary, secondary } = formatExpenseMoney(amount, originalAmount, originalCurrency);

  const mainClass =
    variant === 'card'
      ? 'text-base font-semibold text-neutral-100'
      : 'text-lg font-semibold text-neutral-100';

  return (
    <div className={`flex flex-col ${variant === 'card' ? 'items-end' : 'items-start sm:items-end'} gap-0.5`}>
      <LtrNumeric className={`${mainClass} whitespace-nowrap`}>{primary}</LtrNumeric>
      {secondary && (
        <LtrNumeric className="text-xs text-neutral-500 whitespace-nowrap">{secondary}</LtrNumeric>
      )}
    </div>
  );
}
