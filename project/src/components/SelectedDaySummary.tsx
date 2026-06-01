import { LtrNumeric, useLanguage } from '../LanguageContext';

export interface SelectedDaySummaryPoint {
  iso: string;
  amount: number;
}

interface SelectedDaySummaryProps {
  point: SelectedDaySummaryPoint;
  formatDate: (iso: string, lang: 'he' | 'en') => string;
}

/** Fixed summary below the insights trend chart (replaces floating Recharts tooltip). */
export default function SelectedDaySummary({ point, formatDate }: SelectedDaySummaryProps) {
  const { tr, lang, dir, formatMoney } = useLanguage();

  return (
    <div
      dir={dir}
      role="status"
      aria-live="polite"
      className="mx-auto mt-4 w-full max-w-sm rounded-xl border border-sky-900/45 bg-[#0f172a]/95 px-4 py-3.5 text-center shadow-lg shadow-black/40 outline-none focus:outline-none focus-visible:outline-none"
    >
      <p className="text-sm leading-relaxed text-slate-400">
        {tr('date')}:{' '}
        <span className="font-medium text-slate-100">{formatDate(point.iso, lang)}</span>
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-400">
        {tr('amountIls')}:{' '}
        <LtrNumeric className="font-bold text-slate-100">{formatMoney(point.amount)}</LtrNumeric>
      </p>
    </div>
  );
}
