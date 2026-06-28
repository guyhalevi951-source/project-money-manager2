import { getCurrencyMeta, type ExpenseCurrency } from '../constants/currencies';
import { LtrNumeric, useLanguage } from '../LanguageContext';
import { getCachedExchangeRates } from '../services/exchangeRateService';
import {
  formatStoredExpenseDisplayView,
  resolveStoredExpenseDisplayView,
  type StoredExpenseDisplayFields,
  type StoredExpenseDisplayView,
} from '../services/expenseConversionService';
import {
  formatExpenseDisplayAmount,
  resolveExpenseDisplayAmount,
} from '../services/displayCurrencyUtils';
import { isCapsuleV2, resolveAutonomousExpenseDisplay } from '../services/expenseTimeCapsuleEngine';
import { typographyBodyClass, typographyMutedClass } from '../styles/themeSurfaceStyles';
import CurrencyFlag from './CurrencyFlag';

interface ExpenseAmountDisplayProps {
  expense: StoredExpenseDisplayFields;
  variant?: 'table' | 'card';
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

/**
 * Convert an `AutonomousDisplayResult` to the `StoredExpenseDisplayView` shape so
 * both v1 and v2 expenses render through the same JSX branch.
 */
function autonomousResultToView(
  result: ReturnType<typeof resolveAutonomousExpenseDisplay>,
  expense: StoredExpenseDisplayFields,
  displayCurrency: ExpenseCurrency,
): StoredExpenseDisplayView {
  const hasOriginal =
    expense.originalAmount != null &&
    expense.originalAmount > 0 &&
    Boolean(expense.originalCurrency?.trim());
  const showSecondaryLine =
    hasOriginal && expense.originalCurrency?.trim().toUpperCase() !== displayCurrency;

  return {
    ledgerIlsAmount: result.ledgerIlsAmount,
    primaryDisplayAmount: result.primaryAmount,
    showManualBadge: result.manualActive,
    showFeeBadge: result.feeActive,
    showDualRateToggle: false,
    showSecondaryLine: showSecondaryLine || displayCurrency !== 'ILS',
    manualRateSelected: result.manualActive,
  };
}

export default function ExpenseAmountDisplay({
  expense,
  variant = 'table',
}: ExpenseAmountDisplayProps) {
  const { displayCurrency, exchangeRates, tr } = useLanguage();
  const rates = exchangeRates ?? getCachedExchangeRates();

  // Route v2 capsule expenses through the autonomous engine (no live rate calls).
  // v1 expenses continue to use the existing snapshot resolver as a fallback.
  const capsule = expense.creationTimeCapsule;
  const useEngine = isCapsuleV2(capsule);

  const view: StoredExpenseDisplayView = useEngine
    ? autonomousResultToView(
        resolveAutonomousExpenseDisplay(expense, displayCurrency, capsule),
        expense,
        displayCurrency,
      )
    : resolveStoredExpenseDisplayView(expense, displayCurrency, rates);

  let primary: string;
  let secondary: string;
  let secondaryFlagCode: ExpenseCurrency | undefined;

  if (useEngine) {
    primary = formatExpenseDisplayAmount(view.primaryDisplayAmount, displayCurrency);
    const ilsAmountForSecondary =
      displayCurrency === 'ILS' ? view.primaryDisplayAmount : view.ledgerIlsAmount;
    const formatted = resolveExpenseDisplayAmount(
      ilsAmountForSecondary,
      displayCurrency,
      rates,
      expense.originalAmount,
      expense.originalCurrency,
    );
    secondary = formatted.secondary;
    secondaryFlagCode = formatted.secondaryFlagCode;
  } else {
    const formatted = formatStoredExpenseDisplayView(view, expense, displayCurrency, rates);
    primary = formatted.primary;
    secondary = formatted.secondary;
    secondaryFlagCode = formatted.secondaryFlagCode;
  }

  const equivalentLine = view.showSecondaryLine ? secondary : undefined;
  const manualBadgeLabel = view.showManualBadge ? tr('expenseManualRateBadge') : undefined;
  const feeBadgeLabel = view.showFeeBadge ? tr('expenseFeeBadge') : undefined;
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
        equivalentLine || hasBadges ? 'gap-0.5' : 'gap-0',
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
    </div>
  );
}
