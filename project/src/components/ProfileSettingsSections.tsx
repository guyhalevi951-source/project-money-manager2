import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ChevronUp, Coins, Languages, SlidersHorizontal } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { useLanguage } from '../LanguageContext';
import { writePreferredLanguage } from '../services/authLanguagePreference';
import type { ExpenseCurrency } from '../services/exchangeRateService';
import { themeCategoryProps } from '../services/buttonThemeService';
import {
  filterBarContainerClass,
  filterBarInactiveTabClass,
  primaryActionActivePillClass,
} from '../styles/actionButtonStyles';
import {
  monochromeDepthIconBadgeClass,
  monochromeInlineIconClass,
  monochromeToggleThumbClass,
  monochromeToggleTrackOffClass,
  monochromeToggleTrackOnClass,
  themeTextMutedClass,
  themeTextSubtleClass,
  typographyTitleClass,
} from '../styles/themeSurfaceStyles';
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

export type ProfileCurrencySubSection = 'display' | 'exchange' | 'manual-rate' | 'commissions';
type MainSection = 'general' | 'currencies';

// ---------------------------------------------------------------------------
// Hash-based navigation config
// ---------------------------------------------------------------------------

/** Custom DOM event name for same-page Settings navigation. */
export const SETTINGS_NAVIGATE_EVENT = 'settings:navigate';

type HashTarget = {
  master: MainSection;
  sub?: ProfileCurrencySubSection;
};

/**
 * Maps a URL hash key (without `#`) to the accordion state that must be opened
 * and the element `id` that should be scrolled into view.
 *
 * Hash keys use the `settings-` prefix to avoid collision with any other anchors.
 * The element `id` equals the hash key exactly, so `document.getElementById(hashKey)` works.
 */
const SETTINGS_HASH_MAP: Readonly<Record<string, HashTarget>> = {
  'settings-currencies': { master: 'currencies' },
  'settings-display':    { master: 'currencies', sub: 'display' },
  'settings-exchange':   { master: 'currencies', sub: 'exchange' },
  'settings-manual-rate': { master: 'currencies', sub: 'manual-rate' },
  'settings-commissions': { master: 'currencies', sub: 'commissions' },
  'settings-general':    { master: 'general' },
};

const masterCategoryBodyMotion = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.2, ease: 'easeOut' as const },
};

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

interface ProfileSettingsSectionsProps {
  recentExpenseCurrencies: ExpenseCurrency[];
  initialCurrencySections?: ProfileCurrencySubSection[] | null;
}

export default function ProfileSettingsSections({
  recentExpenseCurrencies,
  initialCurrencySections,
}: ProfileSettingsSectionsProps) {
  const { tr, lang, dir, setLang, keepOriginalValues, setKeepOriginalValues } = useLanguage();

  const [mainOpen, setMainOpen] = useState<Set<MainSection>>(() => {
    const next = new Set<MainSection>();
    if (initialCurrencySections?.length) {
      next.add('currencies');
    }
    const hashKey = window.location.hash.replace(/^#/, '').trim();
    const hashTarget = hashKey ? SETTINGS_HASH_MAP[hashKey] : undefined;
    if (hashTarget) {
      next.add(hashTarget.master);
    }
    return next;
  });
  const [currencySubOpen, setCurrencySubOpen] = useState<Set<ProfileCurrencySubSection>>(() => {
    const next = new Set<ProfileCurrencySubSection>(initialCurrencySections ?? []);
    const hashKey = window.location.hash.replace(/^#/, '').trim();
    const hashTarget = hashKey ? SETTINGS_HASH_MAP[hashKey] : undefined;
    if (hashTarget?.sub) {
      next.add(hashTarget.sub);
    }
    return next;
  });

  useEffect(() => {
    if (!initialCurrencySections?.length) return;
    setMainOpen((prev) => new Set([...prev, 'currencies']));
    setCurrencySubOpen(new Set(initialCurrencySections));
  }, [initialCurrencySections]);

  // ---------------------------------------------------------------------------
  // Generic hash / anchor navigation
  // Handles both fresh mounts (URL already has a hash) and same-page navigation
  // (profile tab already visible — triggered via the SETTINGS_NAVIGATE_EVENT).
  // useLayoutEffect + instant scroll; first mount defers 50 ms so layout settles.
  // ---------------------------------------------------------------------------
  useLayoutEffect(() => {
    let mountTimer: ReturnType<typeof setTimeout> | undefined;

    function applyHash(hashKey: string): void {
      const target = SETTINGS_HASH_MAP[hashKey];
      if (!target) return;

      // Open master section (idempotent).
      setMainOpen((prev) =>
        prev.has(target.master) ? prev : new Set([...prev, target.master]),
      );
      // Open sub-section if required (idempotent).
      if (target.sub) {
        setCurrencySubOpen((prev) =>
          prev.has(target.sub!) ? prev : new Set([...prev, target.sub!]),
        );
      }

      const el = document.getElementById(hashKey);
      if (el) el.scrollIntoView({ behavior: 'auto', block: 'center' });
    }

    function scheduleHash(hashKey: string, deferLayout: boolean): void {
      if (!deferLayout) {
        applyHash(hashKey);
        return;
      }
      if (mountTimer !== undefined) clearTimeout(mountTimer);
      mountTimer = setTimeout(() => applyHash(hashKey), 50);
    }

    // First mount: brief buffer so accordions finish layout before scroll.
    const mountHash = window.location.hash.replace(/^#/, '').trim();
    if (mountHash) scheduleHash(mountHash, true);

    // Runtime navigation when profile is already visible — scroll immediately.
    function onNavigate(e: Event) {
      scheduleHash((e as CustomEvent<string>).detail, false);
    }
    window.addEventListener(SETTINGS_NAVIGATE_EVENT, onNavigate);

    return () => {
      window.removeEventListener(SETTINGS_NAVIGATE_EVENT, onNavigate);
      if (mountTimer !== undefined) clearTimeout(mountTimer);
    };
  }, []); // deps: none — state setters are stable; SETTINGS_HASH_MAP is module-level constant

  const isMainOpen = useCallback((section: MainSection) => mainOpen.has(section), [mainOpen]);
  const toggleMain = useCallback(
    (section: MainSection) => toggleSetMember(section, setMainOpen),
    [],
  );

  const isCurrencySubOpen = useCallback(
    (section: ProfileCurrencySubSection) => currencySubOpen.has(section),
    [currencySubOpen],
  );
  const toggleCurrencySub = useCallback(
    (section: ProfileCurrencySubSection) => toggleSetMember(section, setCurrencySubOpen),
    [],
  );

  const selectLanguage = (next: 'he' | 'en') => {
    writePreferredLanguage(next);
    setLang(next);
  };

  return (
    <section className={subCardMasterCategoryStackClass}>
      <MasterCategoryPanel
        id="settings-currencies"
        expanded={isMainOpen('currencies')}
        {...themeCategoryProps('mainCard')}
      >
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
            <motion.div key="profile-settings-currencies" {...masterCategoryBodyMotion}>
              <MasterCategoryPanelBody>
                <SubCardNestedStack variant="capsuleOnMain">
                  <SubCategorySectionCard id="settings-display">
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
                        <motion.div key="profile-currency-display" {...currencySubPanelMotion} className="h-fit">
                          <SubCategorySectionBody>
                            <DisplayCurrencySelector recentExpenseCurrencies={recentExpenseCurrencies} />
                          </SubCategorySectionBody>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </SubCategorySectionCard>

                  <SubCategorySectionCard id="settings-exchange">
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
                        <motion.div key="profile-currency-exchange" {...currencySubPanelMotion} className="h-fit text-start">
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

                  <SubCategorySectionCard id="settings-manual-rate">
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
                        <motion.div key="profile-currency-manual-rate" {...currencySubPanelMotion} className="h-fit text-start">
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

                  <SubCategorySectionCard id="settings-commissions">
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
                        <motion.div key="profile-currency-commissions" {...currencySubPanelMotion} className="h-fit text-start">
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

      <MasterCategoryPanel
        id="settings-general"
        expanded={isMainOpen('general')}
        {...themeCategoryProps('mainCard')}
      >
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
            <motion.div key="profile-settings-general" {...masterCategoryBodyMotion}>
              <MasterCategoryPanelBody>
                <SubCardNestedStack variant="capsuleOnMain">
                  <SubCategorySectionCard>
                    <div aria-labelledby="profile-settings-language-heading">
                      <h4 id="profile-settings-language-heading" className={`text-sm font-semibold sm:text-base ${typographyTitleClass}`}>
                        {tr('language')}
                      </h4>
                      <p className={`mt-1 text-xs sm:text-sm ${themeTextMutedClass}`}>{tr('languageDescription')}</p>
                      <div className={`mt-3 inline-flex w-full ${filterBarContainerClass}`}>
                        <button
                          type="button"
                          onClick={() => selectLanguage('he')}
                          className={`flex-1 py-2.5 text-sm transition-all sm:py-3 ${
                            lang === 'he' ? primaryActionActivePillClass : filterBarInactiveTabClass
                          }`}
                        >
                          {tr('hebrew')}
                        </button>
                        <button
                          type="button"
                          onClick={() => selectLanguage('en')}
                          className={`flex-1 py-2.5 text-sm transition-all sm:py-3 ${
                            lang === 'en' ? primaryActionActivePillClass : filterBarInactiveTabClass
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
  );
}
