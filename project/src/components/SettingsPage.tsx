import { ArrowLeft, ArrowRight, ChevronDown, ChevronUp, Coins, Languages, SlidersHorizontal } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { useLanguage } from '../LanguageContext';
import { writePreferredLanguage } from '../services/authLanguagePreference';
import DisplayCurrencySelector from './DisplayCurrencySelector';
import ExchangeRateSimulator from './ExchangeRateSimulator';
import type { ExpenseCurrency } from '../services/exchangeRateService';
import { primaryActionActivePillClass, utilityNavIconButtonClass } from '../styles/actionButtonStyles';

type MainSection = 'general' | 'currencies';
type CurrencySubSection = 'display' | 'exchange' | 'manual-rate' | 'commissions';

interface SettingsPageProps {
  onBack: () => void;
  recentExpenseCurrencies: ExpenseCurrency[];
  initialCurrencySections?: CurrencySubSection[] | null;
}

const panelMotion = {
  initial: { opacity: 0, height: 0 },
  animate: { opacity: 1, height: 'auto' },
  exit: { opacity: 0, height: 0 },
  transition: { duration: 0.22, ease: 'easeOut' as const },
};

/** Currency sub-panels: opacity only so height hugs content on mobile. */
const currencySubPanelMotion = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.2, ease: 'easeOut' as const },
};

function toggleSetMember<T>(key: T, setState: Dispatch<SetStateAction<Set<T>>>) {
  setState((prev) => {
    const next = new Set(prev);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    return next;
  });
}

export default function SettingsPage({
  onBack,
  recentExpenseCurrencies,
  initialCurrencySections = null,
}: SettingsPageProps) {
  const {
    dir,
    lang,
    setLang,
    tr,
    keepOriginalValues,
    setKeepOriginalValues,
  } = useLanguage();

  const BackIcon = dir === 'rtl' ? ArrowRight : ArrowLeft;
  const [openMainSections, setOpenMainSections] = useState<Set<MainSection>>(() => new Set());
  const [openCurrencySubs, setOpenCurrencySubs] = useState<Set<CurrencySubSection>>(() => new Set());

  const isMainOpen = useCallback((key: MainSection) => openMainSections.has(key), [openMainSections]);
  const isCurrencySubOpen = useCallback(
    (key: CurrencySubSection) => openCurrencySubs.has(key),
    [openCurrencySubs],
  );

  useEffect(() => {
    if (!initialCurrencySections?.length) return;
    setOpenMainSections((prev) => {
      const next = new Set(prev);
      next.add('currencies');
      return next;
    });
    setOpenCurrencySubs((prev) => {
      const next = new Set(prev);
      initialCurrencySections.forEach((key) => next.add(key));
      return next;
    });
  }, [initialCurrencySections]);

  const toggleMain = (key: MainSection) => {
    toggleSetMember(key, setOpenMainSections);
  };

  const toggleCurrencySub = (key: CurrencySubSection) => {
    toggleSetMember(key, setOpenCurrencySubs);
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
          className={`shrink-0 w-11 h-11 ${utilityNavIconButtonClass}`}
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
          aria-expanded={isMainOpen('currencies')}
          className="w-full cursor-pointer rounded-lg bg-gray-800 p-4 transition-colors hover:bg-gray-700"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-500/25 bg-violet-500/10">
                <Coins className="h-5 w-5 text-violet-400" />
              </div>
              <div className="min-w-0 text-start">
                <h3 className="truncate text-base font-semibold text-white sm:text-lg">{tr('settingsSectionCurrencies')}</h3>
                <p className="mt-0.5 text-xs text-gray-400 sm:text-sm">{tr('settingsSectionCurrenciesDesc')}</p>
              </div>
            </div>
            {isMainOpen('currencies') ? (
              <ChevronDown className="h-5 w-5 shrink-0 text-gray-300" />
            ) : (
              <ChevronUp className="h-5 w-5 shrink-0 text-gray-300" />
            )}
          </div>
        </button>

        <AnimatePresence initial={false}>
          {isMainOpen('currencies') && (
            <motion.div
              key="settings-main-currencies"
              {...panelMotion}
              className="overflow-visible space-y-4 rounded-xl border border-gray-700/70 bg-gray-900/70 p-3 shadow-sm shadow-black/20 sm:p-4"
            >
            <button
              type="button"
              onClick={() => toggleCurrencySub('display')}
              aria-expanded={isCurrencySubOpen('display')}
              className="w-full cursor-pointer rounded-lg bg-gray-800 p-4 transition-colors hover:bg-gray-700"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 text-start">
                  <h4 className="truncate text-sm font-semibold text-white sm:text-base">{tr('displayCurrency')}</h4>
                  <p className="mt-0.5 text-xs text-gray-400">{tr('displayCurrencyDescription')}</p>
                </div>
                {isCurrencySubOpen('display') ? (
                  <ChevronDown className="h-5 w-5 shrink-0 text-gray-300" />
                ) : (
                  <ChevronUp className="h-5 w-5 shrink-0 text-gray-300" />
                )}
              </div>
            </button>
            <AnimatePresence initial={false}>
              {isCurrencySubOpen('display') && (
                <motion.div
                  key="settings-currency-display"
                  {...currencySubPanelMotion}
                  className="h-fit overflow-visible rounded-lg border border-gray-700/60 bg-gray-950/40 p-4"
                >
                  <DisplayCurrencySelector recentExpenseCurrencies={recentExpenseCurrencies} />
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="button"
              onClick={() => toggleCurrencySub('exchange')}
              aria-expanded={isCurrencySubOpen('exchange')}
              className="w-full cursor-pointer rounded-lg bg-gray-800 p-4 transition-colors hover:bg-gray-700"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1 text-start">
                  <div className="flex min-w-0 items-center gap-2">
                    <SlidersHorizontal className="h-4 w-4 shrink-0 text-blue-300" />
                    <h4 className="truncate text-sm font-semibold text-white sm:text-base">
                      {tr('settingsCurrencySubExchange')}
                    </h4>
                  </div>
                  <p className="mt-0.5 text-xs text-gray-400">{tr('settingsCurrencySubExchangeDesc')}</p>
                </div>
                {isCurrencySubOpen('exchange') ? (
                  <ChevronDown className="h-5 w-5 shrink-0 text-gray-300" />
                ) : (
                  <ChevronUp className="h-5 w-5 shrink-0 text-gray-300" />
                )}
              </div>
            </button>
            <AnimatePresence initial={false}>
              {isCurrencySubOpen('exchange') && (
                <motion.div
                  key="settings-currency-exchange"
                  {...currencySubPanelMotion}
                  className="h-fit overflow-visible rounded-lg border border-gray-700/60 bg-gray-950/40 p-2 text-start sm:p-3"
                >
                  <ExchangeRateSimulator
                    section="exchange"
                    recentExpenseCurrencies={recentExpenseCurrencies}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="button"
              onClick={() => toggleCurrencySub('manual-rate')}
              aria-expanded={isCurrencySubOpen('manual-rate')}
              className="w-full cursor-pointer rounded-lg bg-gray-800 p-4 transition-colors hover:bg-gray-700"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1 text-start">
                  <div className="flex min-w-0 items-center gap-2">
                    <SlidersHorizontal className="h-4 w-4 shrink-0 text-purple-400" />
                    <h4 className="truncate text-sm font-semibold text-white sm:text-base">
                      {tr('settingsCurrencySubManualRate')}
                    </h4>
                  </div>
                  <p className="mt-0.5 text-xs text-gray-400">{tr('settingsCurrencySubManualRateDesc')}</p>
                </div>
                {isCurrencySubOpen('manual-rate') ? (
                  <ChevronDown className="h-5 w-5 shrink-0 text-gray-300" />
                ) : (
                  <ChevronUp className="h-5 w-5 shrink-0 text-gray-300" />
                )}
              </div>
            </button>
            <AnimatePresence initial={false}>
              {isCurrencySubOpen('manual-rate') && (
                <motion.div
                  key="settings-currency-manual-rate"
                  {...currencySubPanelMotion}
                  className="h-fit overflow-visible rounded-lg border border-gray-700/60 bg-gray-950/40 p-4 text-start sm:p-3"
                >
                  <ExchangeRateSimulator
                    section="manual-rate"
                    recentExpenseCurrencies={recentExpenseCurrencies}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="button"
              onClick={() => toggleCurrencySub('commissions')}
              aria-expanded={isCurrencySubOpen('commissions')}
              className="w-full cursor-pointer rounded-lg bg-gray-800 p-4 transition-colors hover:bg-gray-700"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1 text-start">
                  <div className="flex min-w-0 items-center gap-2">
                    <SlidersHorizontal className="h-4 w-4 shrink-0 text-purple-400" />
                    <h4 className="truncate text-sm font-semibold text-white sm:text-base">
                      {tr('settingsCurrencySubCommissions')}
                    </h4>
                  </div>
                  <p className="mt-0.5 text-xs text-gray-400">{tr('settingsCurrencySubCommissionsDesc')}</p>
                </div>
                {isCurrencySubOpen('commissions') ? (
                  <ChevronDown className="h-5 w-5 shrink-0 text-gray-300" />
                ) : (
                  <ChevronUp className="h-5 w-5 shrink-0 text-gray-300" />
                )}
              </div>
            </button>
            <AnimatePresence initial={false}>
              {isCurrencySubOpen('commissions') && (
                <motion.div
                  key="settings-currency-commissions"
                  {...currencySubPanelMotion}
                  className="h-fit overflow-visible rounded-lg border border-gray-700/60 bg-gray-950/40 p-4 text-start sm:p-3"
                >
                  <ExchangeRateSimulator
                    section="commissions"
                    recentExpenseCurrencies={recentExpenseCurrencies}
                  />
                </motion.div>
              )}
            </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          type="button"
          onClick={() => toggleMain('general')}
          aria-expanded={isMainOpen('general')}
          className="w-full cursor-pointer rounded-lg bg-gray-800 p-4 transition-colors hover:bg-gray-700"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/25 bg-emerald-500/10">
                <Languages className="h-5 w-5 text-emerald-400" />
              </div>
              <div className="min-w-0 text-start">
                <h3 className="truncate text-base font-semibold text-white sm:text-lg">{tr('settingsSectionGeneral')}</h3>
                <p className="mt-0.5 text-xs text-gray-400 sm:text-sm">{tr('settingsSectionGeneralDesc')}</p>
              </div>
            </div>
            {isMainOpen('general') ? (
              <ChevronDown className="h-5 w-5 shrink-0 text-gray-300" />
            ) : (
              <ChevronUp className="h-5 w-5 shrink-0 text-gray-300" />
            )}
          </div>
        </button>

        <AnimatePresence initial={false}>
          {isMainOpen('general') && (
            <motion.div
              key="settings-main-general"
              {...panelMotion}
              className="overflow-visible space-y-2 rounded-xl border border-gray-700/70 bg-gray-900/70 p-3 shadow-sm shadow-black/20 sm:p-4"
            >
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
                  className={`flex-1 py-2.5 text-sm transition-all sm:py-3 ${
                    lang === 'he'
                      ? primaryActionActivePillClass
                      : 'rounded-xl text-gray-300 hover:bg-gray-800/80 hover:text-white'
                  }`}
                >
                  {tr('hebrew')}
                </button>
                <button
                  type="button"
                  onClick={() => selectLanguage('en')}
                  className={`flex-1 py-2.5 text-sm transition-all sm:py-3 ${
                    lang === 'en'
                      ? primaryActionActivePillClass
                      : 'rounded-xl text-gray-300 hover:bg-gray-800/80 hover:text-white'
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
                        ? 'border-indigo-400/70 bg-indigo-500/80'
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
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </motion.div>
  );
}
