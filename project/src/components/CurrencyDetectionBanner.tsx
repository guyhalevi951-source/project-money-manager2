import { motion } from 'framer-motion';
import { MapPin } from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import { primaryActionButtonSemiboldClass } from '../styles/actionButtonStyles';
import { getCurrencyMeta, type CurrencyCode } from '../constants/currencies';
import CurrencyFlag from './CurrencyFlag';

interface CurrencyDetectionBannerProps {
  detectedCurrency: CurrencyCode;
  onConfirmSwitch: () => void;
  onAlwaysSwitch: () => void;
  onNeverAsk: () => void;
}

export default function CurrencyDetectionBanner({
  detectedCurrency,
  onConfirmSwitch,
  onAlwaysSwitch,
  onNeverAsk,
}: CurrencyDetectionBannerProps) {
  const { tr } = useLanguage();
  const meta = getCurrencyMeta(detectedCurrency);
  const promptText = tr('currencyDetectionPrompt').replace('{currency}', detectedCurrency);

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      role="alertdialog"
      aria-labelledby="currency-detection-title"
      className="mt-3 rounded-xl border border-sky-500/25 bg-sky-500/10 px-3.5 py-3 shadow-sm shadow-black/20"
    >
      <p
        id="currency-detection-title"
        className="flex items-start gap-2 text-sm leading-snug text-sky-100/95"
      >
        <MapPin className="w-4 h-4 shrink-0 text-sky-400 mt-0.5" aria-hidden />
        <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1">
          <span>{promptText}</span>
          <CurrencyFlag countryCode={meta.countryCode} size="xs" alt={meta.name} />
        </span>
      </p>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <button
          type="button"
          onClick={onConfirmSwitch}
          className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm ${primaryActionButtonSemiboldClass}`}
        >
          {tr('currencyDetectionConfirm')}
        </button>
        <button
          type="button"
          onClick={onAlwaysSwitch}
          className="px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium text-neutral-200 border border-neutral-600/80 bg-neutral-900/60 hover:bg-neutral-800/80 hover:text-white transition-all active:scale-[0.98]"
        >
          {tr('currencyDetectionAlways')}
        </button>
        <button
          type="button"
          onClick={onNeverAsk}
          className="px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium text-neutral-500 hover:text-rose-300 hover:bg-rose-500/10 transition-all active:scale-[0.98]"
        >
          {tr('currencyDetectionNever')}
        </button>
      </div>
    </motion.div>
  );
}
