import { useLanguage, LtrNumeric } from '../LanguageContext';
import { formatAmountWithSymbol } from '../services/displayCurrencyUtils';

interface DisplayMoneyProps {
  /** Stored ledger amount in ILS. */
  amount: number;
  className?: string;
}

export default function DisplayMoney({ amount, className = '' }: DisplayMoneyProps) {
  const { formatMoney } = useLanguage();

  return (
    <LtrNumeric className={`whitespace-nowrap ${className}`.trim()}>{formatMoney(amount)}</LtrNumeric>
  );
}

interface DisplayCurrencyAmountProps {
  /**
   * An amount that is ALREADY expressed in the active display currency (i.e. it
   * was projected from an immutable baseline by the visualization layer). Unlike
   * {@link DisplayMoney}, this performs NO ILS→display conversion — it only
   * formats with the active currency symbol and clean 2-decimal rounding.
   *
   * Use this for chart centers, legends, tooltips and rollup stats whose datasets
   * are computed via {@link useDisplayProjection} so the visuals match the text.
   */
  amount: number;
  className?: string;
}

export function DisplayCurrencyAmount({ amount, className = '' }: DisplayCurrencyAmountProps) {
  const { displayCurrency } = useLanguage();
  return (
    <LtrNumeric className={`whitespace-nowrap ${className}`.trim()}>
      {formatAmountWithSymbol(amount, displayCurrency, {
        forceTwoDecimals: displayCurrency !== 'ILS',
      })}
    </LtrNumeric>
  );
}
