import { useLanguage } from '../LanguageContext';
import { DisplayCurrencyAmount } from './DisplayMoney';
import { subCardClass, typographyBodyClass, typographyMutedClass } from '../styles/themeSurfaceStyles';

export interface SelectedDaySummaryPoint {
  iso: string;
  /** Amount ALREADY projected into the active display currency. */
  amount: number;
}

interface SelectedDaySummaryProps {
  point: SelectedDaySummaryPoint;
  formatDate: (iso: string, lang: 'he' | 'en') => string;
}

/** Fixed summary below the insights trend chart (replaces floating Recharts tooltip). */
export default function SelectedDaySummary({ point, formatDate }: SelectedDaySummaryProps) {
  const { tr, lang, dir } = useLanguage();

  return (
    <div
      dir={dir}
      role="status"
      aria-live="polite"
      className={`mx-auto mt-4 w-full max-w-sm px-4 py-3.5 text-center shadow-lg shadow-black/40 outline-none focus:outline-none focus-visible:outline-none ${subCardClass}`}
    >
      <p className={`text-sm leading-relaxed ${typographyMutedClass}`}>
        {tr('date')}:{' '}
        <span className={`font-medium ${typographyBodyClass}`}>{formatDate(point.iso, lang)}</span>
      </p>
      <p className={`mt-1.5 text-sm leading-relaxed ${typographyMutedClass}`}>
        {tr('amountIls')}:{' '}
        <DisplayCurrencyAmount amount={point.amount} className={`font-bold ${typographyBodyClass}`} />
      </p>
    </div>
  );
}
