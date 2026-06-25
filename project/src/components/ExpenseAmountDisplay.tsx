import { getCurrencyMeta, type ExpenseCurrency } from '../constants/currencies';
import { LtrNumeric, useLanguage } from '../LanguageContext';
import { typographyBodyClass, typographyMutedClass } from '../styles/themeSurfaceStyles';
import CurrencyFlag from './CurrencyFlag';

export interface DualRateMode {
  manualSelected: boolean;
  onSelectManual: () => void;
  onSelectSpot: () => void;
}

interface ExpenseAmountDisplayProps {
  amount: number;
  originalAmount?: number;
  originalCurrency?: string;
  variant?: 'table' | 'card';
  /** When false, hides the `(≈ …)` equivalent line (e.g. expense currency matches display currency). */
  showSecondaryLine?: boolean;
  /** Line 3 badge label shown when a manual exchange rate shaped this row (e.g. "✍️ שער ידני"). */
  manualBadgeLabel?: string;
  /** Line 3 badge label shown when a conversion fee was applied (e.g. "💳 כולל עמלה"). */
  feeBadgeLabel?: string;
  /** When provided, renders a Manual / Market segmented toggle below the amount. */
  dualRateMode?: DualRateMode;
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

/** Subtle, muted line-3 indicator (manual rate / fee) below the conversion line. */
function ModifierBadge({ label }: { label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-[var(--color-depth-inner)] px-2 py-0.5 text-[10px] font-medium leading-none ${typographyMutedClass}`}
    >
      {label}
    </span>
  );
}

/** Segmented Manual ↔ Market pill toggle rendered below the amount in history cards. */
function DualRateToggle({ manualSelected, onSelectManual, onSelectSpot }: DualRateMode) {
  const { tr } = useLanguage();
  return (
    <div className="mt-1 inline-flex overflow-hidden rounded-lg border border-neutral-700/80 text-[11px] font-medium">
      <button
        type="button"
        onClick={onSelectManual}
        className={`px-2 py-1 transition-colors ${
          manualSelected
            ? 'bg-amber-500/25 text-amber-300'
            : 'bg-transparent text-neutral-500 hover:text-neutral-300'
        }`}
      >
        {tr('expenseRateSwitchManual')}
      </button>
      <button
        type="button"
        onClick={onSelectSpot}
        className={`border-s border-neutral-700/80 px-2 py-1 transition-colors ${
          !manualSelected
            ? 'bg-blue-500/20 text-blue-300'
            : 'bg-transparent text-neutral-500 hover:text-neutral-300'
        }`}
      >
        {tr('expenseRateSwitchSpot')}
      </button>
    </div>
  );
}

export default function ExpenseAmountDisplay({
  amount,
  originalAmount,
  originalCurrency,
  variant = 'table',
  showSecondaryLine = true,
  manualBadgeLabel,
  feeBadgeLabel,
  dualRateMode,
}: ExpenseAmountDisplayProps) {
  const { formatExpenseMoney } = useLanguage();
  const { primary, secondary, secondaryFlagCode } = formatExpenseMoney(
    amount,
    originalAmount,
    originalCurrency,
  );
  const equivalentLine = showSecondaryLine ? secondary : undefined;
  const hasBadges = Boolean(manualBadgeLabel || feeBadgeLabel);

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
        equivalentLine || hasBadges || dualRateMode ? 'gap-0.5' : 'gap-0',
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
      {hasBadges && (
        <div
          className={[
            'mt-0.5 flex flex-wrap items-center gap-1',
            variant === 'card' ? 'justify-end' : 'justify-start sm:justify-end',
          ].join(' ')}
        >
          {manualBadgeLabel && <ModifierBadge label={manualBadgeLabel} />}
          {feeBadgeLabel && <ModifierBadge label={feeBadgeLabel} />}
        </div>
      )}
      {dualRateMode && <DualRateToggle {...dualRateMode} />}
    </div>
  );
}
