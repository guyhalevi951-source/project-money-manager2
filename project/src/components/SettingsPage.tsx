import { ArrowLeft, ArrowRight, ChevronDown, ChevronUp, Coins, Languages, SlidersHorizontal } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { useSettingsPersistence } from '../context/SettingsPersistenceContext';
import SettingsSyncStatusBadge from './SettingsSyncStatusBadge';
import { useLanguage } from '../LanguageContext';
import { writePreferredLanguage } from '../services/authLanguagePreference';
import DisplayCurrencySelector from './DisplayCurrencySelector';
import ExchangeRateSimulator from './ExchangeRateSimulator';
import {
  MasterCategoryPanel,
  MasterCategoryPanelBody,
  SubCategorySectionBody,
  SubCategorySectionCard,
  SubCardNestedStack,
  subCardMasterCategoryStackClass,
  subCardNestedAccordionTriggerClass,
} from './SubCardNestedStack';
import type { ExpenseCurrency } from '../services/exchangeRateService';
import {
  filterBarContainerClass,
  filterBarInactiveTabClass,
  primaryActionActivePillClass,
  utilityNavIconButtonClass,
} from '../styles/actionButtonStyles';
import { themeCategoryProps } from '../services/buttonThemeService';
import {
  monochromeDepthIconBadgeClass,
  monochromeInlineIconClass,
  monochromeToggleThumbClass,
  monochromeToggleTrackOffClass,
  monochromeToggleTrackOnClass,
  SETTINGS_PROFILE_CURSOR_ENFORCEMENT,
  SETTINGS_PROFILE_SCOPE_ATTR,
  themeAntiClipVisibleClass,
  themeCardLgClass,
  themeTextMutedClass,
  themeTextSubtleClass,
  typographyTitleClass,
} from '../styles/themeSurfaceStyles';

/**
 * FUTURE-PROOF COMPONENT MAPPING RULE (v1.2.0):
 * ${SETTINGS_PROFILE_CURSOR_ENFORCEMENT}
 *
 * Depth stack: L1 MasterCategoryPanel (Cat 6) → L2 SubCategorySectionCard (Cat 7) →
 * L3 surfacePanelClass/subCardSmClass → Cat 4 surfaceInput* → Cat 5 typography*.
 * Dynamic toggles persist via LanguageContext → Firebase (registered) / localStorage (guest).
 */

type MainSection = 'general' | 'currencies';
type CurrencySubSection = 'display' | 'exchange' | 'manual-rate' | 'commissions';

interface SettingsPageProps {
  onBack: () => void;
  recentExpenseCurrencies: ExpenseCurrency[];
  initialCurrencySections?: CurrencySubSection[] | null;
}

/** Master category body — opacity only so rounded-2xl perimeter stays intact. */
const masterCategoryBodyMotion = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.2, ease: 'easeOut' as const },
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
  initialCurrencySections,
}: SettingsPageProps) {
  const { tr, lang, dir, setLang, keepOriginalValues, setKeepOriginalValues } = useLanguage();
  const { rehydrateGuestSettings } = useSettingsPersistence();

  useEffect(() => {
    rehydrateGuestSettings();
  }, [rehydrateGuestSettings]);
  const BackIcon = dir === 'rtl' ? ArrowRight : ArrowLeft;

  const [mainOpen, setMainOpen] = useState<Set<MainSection>>(() =>
    initialCurrencySections?.length ? new Set(['currencies']) : new Set(),
  );
  const [currencySubOpen, setCurrencySubOpen] = useState<Set<CurrencySubSection>>(
    () => new Set(initialCurrencySections ?? []),
  );

  const isMainOpen = useCallback((section: MainSection) => mainOpen.has(section), [mainOpen]);
  const toggleMain = useCallback(
    (section: MainSection) => toggleSetMember(section, setMainOpen),
    [],
  );

  const isCurrencySubOpen = useCallback(
    (section: CurrencySubSection) => currencySubOpen.has(section),
    [currencySubOpen],
  );
  const toggleCurrencySub = useCallback(
    (section: CurrencySubSection) => toggleSetMember(section, setCurrencySubOpen),
    [],
  );

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
      className={`space-y-6 p-4 sm:space-y-8 sm:p-6 ${themeCardLgClass} ${themeAntiClipVisibleClass}`}
      {...{ [SETTINGS_PROFILE_SCOPE_ATTR]: '' }}
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
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className={`text-2xl font-bold tracking-tight sm:text-3xl ${typographyTitleClass}`}>
              {tr('settings')}
            </h2>
            <SettingsSyncStatusBadge />
          </div>
          <p className={`mt-0.5 text-sm ${themeTextMutedClass}`}>{tr('settingsPageSubtitle')}</p>
        </div>
      </div>

      <section className={subCardMasterCategoryStackClass}>
        {/* מטבעות — master rounded enclosure (header + sub-category capsules) */}
        <MasterCategoryPanel expanded={isMainOpen('currencies')} {...themeCategoryProps('mainCard')}>
          <button
            type="button"
            onClick={() => toggleMain('currencies')}
            aria-expanded={isMainOpen('currencies')}
            className={subCardNestedAccordionTriggerClass}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className={monochromeDepthIconBadgeClass}>
                  <Coins className="h-5 w-5" />
                </div>
                <div className="min-w-0 text-start">
                  <h3 className={`truncate text-base font-semibold sm:text-lg ${typographyTitleClass}`}>
                    {tr('settingsSectionCurrencies')}
                  </h3>
                  <p className={`mt-0.5 text-xs sm:text-sm ${themeTextMutedClass}`}>
                    {tr('settingsSectionCurrenciesDesc')}
                  </p>
                </div>
              </div>
              {isMainOpen('currencies') ? (
                <ChevronDown className={`h-5 w-5 shrink-0 ${themeTextMutedClass}`} />
              ) : (
                <ChevronUp className={`h-5 w-5 shrink-0 ${themeTextMutedClass}`} />
              )}
            </div>
          </button>

          <AnimatePresence initial={false}>
            {isMainOpen('currencies') && (
              <motion.div key="settings-main-currencies" {...masterCategoryBodyMotion}>
                <MasterCategoryPanelBody>
                  <SubCardNestedStack variant="capsuleOnMain">
                  <SubCategorySectionCard>
                    <button
                      type="button"
                      onClick={() => toggleCurrencySub('display')}
                      aria-expanded={isCurrencySubOpen('display')}
                      className={subCardNestedAccordionTriggerClass}
                      {...themeCategoryProps('subCard')}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 text-start">
                          <h4 className={`truncate text-sm font-semibold sm:text-base ${typographyTitleClass}`}>
                            {tr('displayCurrency')}
                          </h4>
                          <p className={`mt-0.5 text-xs ${themeTextMutedClass}`}>{tr('displayCurrencyDescription')}</p>
                        </div>
                        {isCurrencySubOpen('display') ? (
                          <ChevronDown className={`h-5 w-5 shrink-0 ${themeTextMutedClass}`} />
                        ) : (
                          <ChevronUp className={`h-5 w-5 shrink-0 ${themeTextMutedClass}`} />
                        )}
                      </div>
                    </button>
                    <AnimatePresence initial={false}>
                      {isCurrencySubOpen('display') && (
                        <motion.div key="settings-currency-display" {...currencySubPanelMotion} className="h-fit">
                          <SubCategorySectionBody>
                            <DisplayCurrencySelector recentExpenseCurrencies={recentExpenseCurrencies} />
                          </SubCategorySectionBody>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </SubCategorySectionCard>

                  <SubCategorySectionCard>
                    <button
                      type="button"
                      onClick={() => toggleCurrencySub('exchange')}
                      aria-expanded={isCurrencySubOpen('exchange')}
                      className={subCardNestedAccordionTriggerClass}
                      {...themeCategoryProps('subCard')}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1 text-start">
                          <div className="flex min-w-0 items-center gap-2">
                            <SlidersHorizontal className={monochromeInlineIconClass} />
                            <h4 className={`truncate text-sm font-semibold sm:text-base ${typographyTitleClass}`}>
                              {tr('settingsCurrencySubExchange')}
                            </h4>
                          </div>
                          <p className={`mt-0.5 text-xs ${themeTextMutedClass}`}>{tr('settingsCurrencySubExchangeDesc')}</p>
                        </div>
                        {isCurrencySubOpen('exchange') ? (
                          <ChevronDown className={`h-5 w-5 shrink-0 ${themeTextMutedClass}`} />
                        ) : (
                          <ChevronUp className={`h-5 w-5 shrink-0 ${themeTextMutedClass}`} />
                        )}
                      </div>
                    </button>
                    <AnimatePresence initial={false}>
                      {isCurrencySubOpen('exchange') && (
                        <motion.div key="settings-currency-exchange" {...currencySubPanelMotion} className="h-fit text-start">
                          <SubCategorySectionBody>
                            <ExchangeRateSimulator
                              section="exchange"
                              recentExpenseCurrencies={recentExpenseCurrencies}
                            />
                          </SubCategorySectionBody>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </SubCategorySectionCard>

                  <SubCategorySectionCard>
                    <button
                      type="button"
                      onClick={() => toggleCurrencySub('manual-rate')}
                      aria-expanded={isCurrencySubOpen('manual-rate')}
                      className={subCardNestedAccordionTriggerClass}
                      {...themeCategoryProps('subCard')}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1 text-start">
                          <div className="flex min-w-0 items-center gap-2">
                            <SlidersHorizontal className={monochromeInlineIconClass} />
                            <h4 className={`truncate text-sm font-semibold sm:text-base ${typographyTitleClass}`}>
                              {tr('settingsCurrencySubManualRate')}
                            </h4>
                          </div>
                          <p className={`mt-0.5 text-xs ${themeTextMutedClass}`}>{tr('settingsCurrencySubManualRateDesc')}</p>
                        </div>
                        {isCurrencySubOpen('manual-rate') ? (
                          <ChevronDown className={`h-5 w-5 shrink-0 ${themeTextMutedClass}`} />
                        ) : (
                          <ChevronUp className={`h-5 w-5 shrink-0 ${themeTextMutedClass}`} />
                        )}
                      </div>
                    </button>
                    <AnimatePresence initial={false}>
                      {isCurrencySubOpen('manual-rate') && (
                        <motion.div key="settings-currency-manual-rate" {...currencySubPanelMotion} className="h-fit text-start">
                          <SubCategorySectionBody>
                            <ExchangeRateSimulator
                              section="manual-rate"
                              recentExpenseCurrencies={recentExpenseCurrencies}
                            />
                          </SubCategorySectionBody>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </SubCategorySectionCard>

                  <SubCategorySectionCard>
                    <button
                      type="button"
                      onClick={() => toggleCurrencySub('commissions')}
                      aria-expanded={isCurrencySubOpen('commissions')}
                      className={subCardNestedAccordionTriggerClass}
                      {...themeCategoryProps('subCard')}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1 text-start">
                          <div className="flex min-w-0 items-center gap-2">
                            <SlidersHorizontal className={monochromeInlineIconClass} />
                            <h4 className={`truncate text-sm font-semibold sm:text-base ${typographyTitleClass}`}>
                              {tr('settingsCurrencySubCommissions')}
                            </h4>
                          </div>
                          <p className={`mt-0.5 text-xs ${themeTextMutedClass}`}>{tr('settingsCurrencySubCommissionsDesc')}</p>
                        </div>
                        {isCurrencySubOpen('commissions') ? (
                          <ChevronDown className={`h-5 w-5 shrink-0 ${themeTextMutedClass}`} />
                        ) : (
                          <ChevronUp className={`h-5 w-5 shrink-0 ${themeTextMutedClass}`} />
                        )}
                      </div>
                    </button>
                    <AnimatePresence initial={false}>
                      {isCurrencySubOpen('commissions') && (
                        <motion.div key="settings-currency-commissions" {...currencySubPanelMotion} className="h-fit text-start">
                          <SubCategorySectionBody>
                            <ExchangeRateSimulator
                              section="commissions"
                              recentExpenseCurrencies={recentExpenseCurrencies}
                            />
                          </SubCategorySectionBody>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </SubCategorySectionCard>
                  </SubCardNestedStack>
                </MasterCategoryPanelBody>
              </motion.div>
            )}
          </AnimatePresence>
        </MasterCategoryPanel>

        {/* הגדרות כלליות */}
        <MasterCategoryPanel expanded={isMainOpen('general')} {...themeCategoryProps('mainCard')}>
          <button
            type="button"
            onClick={() => toggleMain('general')}
            aria-expanded={isMainOpen('general')}
            className={subCardNestedAccordionTriggerClass}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className={monochromeDepthIconBadgeClass}>
                  <Languages className="h-5 w-5" />
                </div>
                <div className="min-w-0 text-start">
                  <h3 className={`truncate text-base font-semibold sm:text-lg ${typographyTitleClass}`}>
                    {tr('settingsSectionGeneral')}
                  </h3>
                  <p className={`mt-0.5 text-xs sm:text-sm ${themeTextMutedClass}`}>
                    {tr('settingsSectionGeneralDesc')}
                  </p>
                </div>
              </div>
              {isMainOpen('general') ? (
                <ChevronDown className={`h-5 w-5 shrink-0 ${themeTextMutedClass}`} />
              ) : (
                <ChevronUp className={`h-5 w-5 shrink-0 ${themeTextMutedClass}`} />
              )}
            </div>
          </button>

          <AnimatePresence initial={false}>
            {isMainOpen('general') && (
              <motion.div key="settings-main-general" {...masterCategoryBodyMotion}>
                <MasterCategoryPanelBody>
                  <SubCardNestedStack variant="capsuleOnMain">
                  <SubCategorySectionCard>
                    <div aria-labelledby="settings-language-heading">
                      <h4 id="settings-language-heading" className={`text-sm font-semibold sm:text-base ${typographyTitleClass}`}>
                        {tr('language')}
                      </h4>
                      <p className={`mt-1 text-xs sm:text-sm ${themeTextMutedClass}`}>{tr('languageDescription')}</p>
                      <div className={`mt-3 inline-flex w-full ${filterBarContainerClass}`}>
                        <button
                          type="button"
                          onClick={() => selectLanguage('he')}
                          className={`flex-1 py-2.5 text-sm transition-all sm:py-3 ${
                            lang === 'he'
                              ? primaryActionActivePillClass
                              : filterBarInactiveTabClass
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
                              : filterBarInactiveTabClass
                          }`}
                        >
                          {tr('english')}
                        </button>
                      </div>
                    </div>
                  </SubCategorySectionCard>

                  <SubCategorySectionCard>
                    <div>
                      <p className={`mb-3 text-xs font-medium uppercase tracking-wide ${themeTextSubtleClass}`}>
                        {tr('translationOptions')}
                      </p>
                      <div className="flex items-center justify-between gap-4 border-t border-[var(--color-sub-cards-divider)] pt-4 sm:pt-5">
                        <div className="min-w-0">
                          <p className={`text-sm leading-relaxed ${typographyTitleClass}`}>{tr('keepOriginalValuesLabel')}</p>
                          <p className={`mt-1 text-xs leading-relaxed ${themeTextMutedClass}`}>{tr('keepOriginalValuesHint')}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setKeepOriginalValues(!keepOriginalValues)}
                          role="switch"
                          aria-checked={keepOriginalValues}
                          aria-label={tr('keepOriginalValuesLabel')}
                          className={
                            keepOriginalValues ? monochromeToggleTrackOnClass : monochromeToggleTrackOffClass
                          }
                        >
                          <span
                            className={`${monochromeToggleThumbClass} ${
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
                  </SubCategorySectionCard>
                  </SubCardNestedStack>
                </MasterCategoryPanelBody>
              </motion.div>
            )}
          </AnimatePresence>
        </MasterCategoryPanel>
      </section>
    </motion.div>
  );
}
