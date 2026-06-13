import { getCurrencyMeta, type ExpenseCurrency } from '../constants/currencies';
import { LtrNumeric, useLanguage } from '../LanguageContext';
import { typographyBodyClass, typographyMutedClass } from '../styles/themeSurfaceStyles';
import CurrencyFlag from './CurrencyFlag';

interface ExpenseAmountDisplayProps {
  amount: number;
  originalAmount?: number;
  originalCurrency?: string;
  variant?: 'table' | 'card';
  /** When false, hides the `(≈ …)` equivalent line (e.g. expense currency matches display currency). */
  showSecondaryLine?: boolean;
}

/**
 * Secondary approximation row — flag matches the currency of the evaluated value inside the parens.
 * Format: `( ≈ L78 [Flag] )`
 */
function SecondaryConversionLine({
  line,
  flagCurrency,
  className,
}: {
  line: string;
  flagCurrency?: ExpenseCurrency;
  className: string;
}) {
  const approxMatch = line.match(/^\(≈\s(.+)\)$/);

  if (!approxMatch) {
    return <LtrNumeric className={`whitespace-nowrap ${className}`}>{line}</LtrNumeric>;
  }

  const amountText = approxMatch[1];
  const meta = flagCurrency ? getCurrencyMeta(flagCurrency) : null;

  return (
    <LtrNumeric className={`inline-flex items-center gap-x-1.5 whitespace-nowrap ${className}`}>
      <span>(≈</span>
      <span>{amountText}</span>
      {meta && <CurrencyFlag countryCode={meta.countryCode} size="text" alt="" />}
      <span>)</span>
    </LtrNumeric>
  );
}

export default function ExpenseAmountDisplay({
  amount,
  originalAmount,
  originalCurrency,
  variant = 'table',
  showSecondaryLine = true,
}: ExpenseAmountDisplayProps) {
  const { formatExpenseMoney } = useLanguage();
  const { primary, secondary, secondaryFlagCode } = formatExpenseMoney(
    amount,
    originalAmount,
    originalCurrency,
  );
  const equivalentLine = showSecondaryLine ? secondary : undefined;

  const mainClass =
    variant === 'card'
      ? `text-base font-semibold ${typographyBodyClass}`
      : `text-lg font-semibold ${typographyBodyClass}`;

  const secondaryClass = `text-xs ${typographyMutedClass}`;

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
        <SecondaryConversionLine
          line={equivalentLine}
          flagCurrency={secondaryFlagCode}
          className={secondaryClass}
        />
      )}
    </div>
  );
}
