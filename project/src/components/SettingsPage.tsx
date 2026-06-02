import { ArrowLeft, ArrowRight, ChevronDown, ChevronUp, Coins, Languages, SlidersHorizontal } from 'lucide-react';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useLanguage } from '../LanguageContext';
import { writePreferredLanguage } from '../services/authLanguagePreference';
import DisplayCurrencySelector from './DisplayCurrencySelector';
import type { ExpenseCurrency } from '../services/exchangeRateService';

interface SettingsPageProps {
  onBack: () => void;
  recentExpenseCurrencies: ExpenseCurrency[];
}

export default function SettingsPage({ onBack, recentExpenseCurrencies }: SettingsPageProps) {
  const {
    dir,
    lang,
    setLang,
    tr,
    keepOriginalValues,
    setKeepOriginalValues,
  } = useLanguage();

  const BackIcon = dir === 'rtl' ? ArrowRight : ArrowLeft;
  const [openMain, setOpenMain] = useState<null | 'general' | 'currencies'>(null);
  const [openCurrencySub, setOpenCurrencySub] = useState<null | 'display' | 'exchange'>(null);

  const toggleMain = (key: 'general' | 'currencies') => {
    setOpenMain((prev) => (prev === key ? null : key));
    if (key !== 'currencies') {
      setOpenCurrencySub(null);
    }
  };

  const toggleCurrencySub = (key: 'display' | 'exchange') => {
    setOpenCurrencySub((prev) => (prev === key ? null : key));
  };

  const selectLanguage = (next: 'he' | 'en') => {
    writePreferredLanguage(next);
    setLang(next);
  };

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

      <section className="space-y-3">
        <button
          type="button"
          onClick={() => toggleMain('currencies')}
          aria-expanded={openMain === 'currencies'}
          className="w-full cursor-pointer rounded-lg bg-gray-800 p-4 transition-colors hover:bg-gray-700"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-500/25 bg-violet-500/10">
                <Coins className="h-5 w-5 text-violet-400" />
              </div>
              <div className="min-w-0 text-start">
                <h3 className="truncate text-base font-semibold text-white sm:text-lg">מטבעות</h3>
                <p className="mt-0.5 text-xs text-gray-400 sm:text-sm">הגדרות מטבע תצוגה, שער חליפין ועמלות</p>
              </div>
            </div>
            {openMain === 'currencies' ? (
              <ChevronDown className="h-5 w-5 shrink-0 text-gray-300" />
            ) : (
              <ChevronUp className="h-5 w-5 shrink-0 text-gray-300" />
            )}
          </div>
        </button>

        {openMain === 'currencies' && (
          <div className="space-y-2 rounded-xl border border-gray-700/70 bg-gray-900/70 p-3 shadow-sm shadow-black/20 sm:p-4">
            <button
              type="button"
              onClick={() => toggleCurrencySub('display')}
              aria-expanded={openCurrencySub === 'display'}
              className="w-full cursor-pointer rounded-lg bg-gray-800 p-4 transition-colors hover:bg-gray-700"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 text-start">
                  <h4 className="truncate text-sm font-semibold text-white sm:text-base">{tr('displayCurrency')}</h4>
                  <p className="mt-0.5 text-xs text-gray-400">{tr('displayCurrencyDescription')}</p>
                </div>
                {openCurrencySub === 'display' ? (
                  <ChevronDown className="h-5 w-5 shrink-0 text-gray-300" />
                ) : (
                  <ChevronUp className="h-5 w-5 shrink-0 text-gray-300" />
                )}
              </div>
            </button>
            {openCurrencySub === 'display' && (
              <div className="rounded-lg border border-gray-700/60 bg-gray-950/40 p-4">
                <DisplayCurrencySelector recentExpenseCurrencies={recentExpenseCurrencies} />
              </div>
            )}

            <button
              type="button"
              onClick={() => toggleCurrencySub('exchange')}
              aria-expanded={openCurrencySub === 'exchange'}
              className="w-full cursor-pointer rounded-lg bg-gray-800 p-4 transition-colors hover:bg-gray-700"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4 shrink-0 text-violet-300" />
                  <h4 className="truncate text-sm font-semibold text-white sm:text-base">שער חליפין / עמלות</h4>
                </div>
                {openCurrencySub === 'exchange' ? (
                  <ChevronDown className="h-5 w-5 shrink-0 text-gray-300" />
                ) : (
                  <ChevronUp className="h-5 w-5 shrink-0 text-gray-300" />
                )}
              </div>
            </button>
            {openCurrencySub === 'exchange' && (
              <div className="rounded-lg border border-gray-700/60 bg-gray-950/40 p-4 text-start">
                <p className="text-sm text-gray-200">
                  ניהול שערי חליפין ועמלות מתבצע במסך המרת המטבע שבדף הבית.
                </p>
                <p className="mt-1 text-xs leading-relaxed text-gray-400">
                  שם ניתן להוסיף עמלה, לשמור שערים ידניים ולנהל ערכים שמורים.
                </p>
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={() => toggleMain('general')}
          aria-expanded={openMain === 'general'}
          className="w-full cursor-pointer rounded-lg bg-gray-800 p-4 transition-colors hover:bg-gray-700"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/25 bg-emerald-500/10">
                <Languages className="h-5 w-5 text-emerald-400" />
              </div>
              <div className="min-w-0 text-start">
                <h3 className="truncate text-base font-semibold text-white sm:text-lg">הגדרות כלליות</h3>
                <p className="mt-0.5 text-xs text-gray-400 sm:text-sm">שפה והתנהגות תרגום</p>
              </div>
            </div>
            {openMain === 'general' ? (
              <ChevronDown className="h-5 w-5 shrink-0 text-gray-300" />
            ) : (
              <ChevronUp className="h-5 w-5 shrink-0 text-gray-300" />
            )}
          </div>
        </button>

        {openMain === 'general' && (
          <div className="space-y-2 rounded-xl border border-gray-700/70 bg-gray-900/70 p-3 shadow-sm shadow-black/20 sm:p-4">
            <div
              aria-labelledby="settings-language-heading"
              className="rounded-lg border border-gray-700/60 bg-gray-950/40 p-4"
            >
              <h4 id="settings-language-heading" className="text-sm font-semibold text-white sm:text-base">
                {tr('language')}
              </h4>
              <p className="mt-1 text-xs text-gray-400 sm:text-sm">{tr('languageDescription')}</p>
              <div className="mt-3 inline-flex w-full rounded-2xl border border-gray-700 bg-gray-950/80 p-1">
                <button
                  type="button"
                  onClick={() => selectLanguage('he')}
                  className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all sm:py-3 ${
                    lang === 'he'
                      ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
                      : 'text-gray-300 hover:bg-gray-800/80 hover:text-white'
                  }`}
                >
                  {tr('hebrew')}
                </button>
                <button
                  type="button"
                  onClick={() => selectLanguage('en')}
                  className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all sm:py-3 ${
                    lang === 'en'
                      ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
                      : 'text-gray-300 hover:bg-gray-800/80 hover:text-white'
                  }`}
                >
                  {tr('english')}
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-gray-700/60 bg-gray-950/40 p-4">
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                {tr('translationOptions')}
              </p>
              <div className="rounded-xl border border-gray-700/50 bg-gray-950/50 px-4 py-3.5">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm leading-relaxed text-gray-200">{tr('keepOriginalValuesLabel')}</p>
                    <p className="mt-1 text-xs leading-relaxed text-gray-500">{tr('keepOriginalValuesHint')}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setKeepOriginalValues(!keepOriginalValues)}
                    role="switch"
                    aria-checked={keepOriginalValues}
                    aria-label={tr('keepOriginalValuesLabel')}
                    className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-all ${
                      keepOriginalValues
                        ? 'border-emerald-400/70 bg-emerald-500/80'
                        : 'border-gray-600 bg-gray-800'
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
          </div>
        )}
      </section>
    </motion.div>
  );
}
