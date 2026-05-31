import { ArrowLeft, ArrowRight, Coins, Languages } from 'lucide-react';
import { motion } from 'framer-motion';
import { useEffect } from 'react';
import { useLanguage } from '../LanguageContext';
import DisplayCurrencySelector from './DisplayCurrencySelector';

interface SettingsPageProps {
  onBack: () => void;
}

export default function SettingsPage({ onBack }: SettingsPageProps) {
  const {
    dir,
    lang,
    setLang,
    tr,
    keepOriginalValues,
    setKeepOriginalValues,
  } = useLanguage();

  const BackIcon = dir === 'rtl' ? ArrowRight : ArrowLeft;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      className="space-y-6 sm:space-y-8"
    >
      <div className="flex items-center gap-3 sm:gap-4">
        <button
          type="button"
          onClick={onBack}
          className="shrink-0 w-11 h-11 flex items-center justify-center rounded-xl border border-neutral-700/80 bg-neutral-900/80 text-neutral-300 hover:text-neutral-100 hover:bg-neutral-800 hover:border-neutral-600 transition-all active:scale-95"
          aria-label={tr('backToApp')}
        >
          <BackIcon className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <h2 className="text-2xl sm:text-3xl font-bold text-neutral-100 tracking-tight">
            {tr('settings')}
          </h2>
          <p className="text-sm text-neutral-500 mt-0.5">{tr('settingsPageSubtitle')}</p>
        </div>
      </div>

      <section
        aria-labelledby="settings-language-heading"
        className="rounded-2xl border border-gray-700/70 bg-gray-900/70 backdrop-blur-xl shadow-lg shadow-black/20 p-5 sm:p-6"
      >
        <div className="flex items-start gap-3 mb-5">
          <div className="shrink-0 w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center">
            <Languages className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="min-w-0">
            <h3 id="settings-language-heading" className="text-base sm:text-lg font-semibold text-white">
              {tr('language')}
            </h3>
            <p className="text-xs sm:text-sm text-gray-400 mt-1">{tr('languageDescription')}</p>
          </div>
        </div>

        <div className="inline-flex w-full rounded-2xl bg-gray-950/80 border border-gray-700 p-1">
          <button
            type="button"
            onClick={() => setLang('he')}
            className={`flex-1 py-2.5 sm:py-3 rounded-xl text-sm font-semibold transition-all ${
              lang === 'he'
                ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
                : 'text-gray-300 hover:text-white hover:bg-gray-800/80'
            }`}
          >
            {tr('hebrew')}
          </button>
          <button
            type="button"
            onClick={() => setLang('en')}
            className={`flex-1 py-2.5 sm:py-3 rounded-xl text-sm font-semibold transition-all ${
              lang === 'en'
                ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
                : 'text-gray-300 hover:text-white hover:bg-gray-800/80'
            }`}
          >
            {tr('english')}
          </button>
        </div>

        <div className="mt-5 pt-5 border-t border-gray-700/60">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-3">
            {tr('translationOptions')}
          </p>
          <div className="rounded-xl border border-gray-700/50 bg-gray-950/50 px-4 py-3.5">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm text-gray-200 leading-relaxed">{tr('keepOriginalValuesLabel')}</p>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">{tr('keepOriginalValuesHint')}</p>
              </div>
              <button
                type="button"
                onClick={() => setKeepOriginalValues(!keepOriginalValues)}
                role="switch"
                aria-checked={keepOriginalValues}
                aria-label={tr('keepOriginalValuesLabel')}
                className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-all ${
                  keepOriginalValues
                    ? 'bg-emerald-500/80 border-emerald-400/70'
                    : 'bg-gray-800 border-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                    keepOriginalValues
                      ? dir === 'rtl'
                        ? '-translate-x-0.5'
                        : 'translate-x-[1.25rem]'
                      : dir === 'rtl'
                        ? '-translate-x-[1.25rem]'
                        : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="settings-currency-heading"
        className="rounded-2xl border border-gray-700/70 bg-gray-900/70 backdrop-blur-xl shadow-lg shadow-black/20 p-5 sm:p-6"
      >
        <div className="flex items-start gap-3 mb-5">
          <div className="shrink-0 w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-500/20 flex items-center justify-center">
            <Coins className="w-5 h-5 text-violet-400" />
          </div>
          <div className="min-w-0">
            <h3 id="settings-currency-heading" className="text-base sm:text-lg font-semibold text-white">
              {tr('displayCurrency')}
            </h3>
            <p className="text-xs sm:text-sm text-gray-400 mt-1">{tr('displayCurrencyDescription')}</p>
          </div>
        </div>

        <DisplayCurrencySelector />
      </section>
    </motion.div>
  );
}
