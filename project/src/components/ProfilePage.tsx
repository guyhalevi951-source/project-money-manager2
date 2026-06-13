import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Palette,
  LogOut,
  Pencil,
  RefreshCw,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import type { User as FirebaseUser } from 'firebase/auth';
import { useLanguage } from '../LanguageContext';
import { formatTranslation } from '../translations';
import { DEFAULT_GUEST_AVATAR_URL, sanitizeAvatarUrl } from '../services/avatarService';
import { primaryActionButtonClass, utilityNavIconButtonClass } from '../styles/actionButtonStyles';
import {
  monochromeAvatarPickerIdleClass,
  monochromeAvatarPickerSelectedClass,
  monochromeAvatarRingClass,
  monochromeDepthIconBadgeClass,
  monochromeModalScrimClass,
  monochromeToastPanelClass,
  SETTINGS_PROFILE_CURSOR_ENFORCEMENT,
  SETTINGS_PROFILE_SCOPE_ATTR,
  themeCardLgClass,
  themeTextClass,
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
 * Theme drafts persist via setThemePreferences → Firebase (registered) / localStorage (guest).
 */
import { themeCategoryProps } from '../services/buttonThemeService';
import ButtonGroupColorPicker from './ButtonGroupColorPicker';
import PageThemePicker from './PageThemePicker';
import {
  MasterCategoryPanel,
  MasterCategoryPanelBody,
  SubCategorySectionBody,
  SubCategorySectionCard,
  SubCardNestedStack,
  subCardMasterCategoryStackClass,
  subCardNestedAccordionTriggerClass,
} from './SubCardNestedStack';
import SettingsSyncStatusBadge from './SettingsSyncStatusBadge';
import {
  applyThemeCSS,
  BUTTON_GROUP_META,
  DEFAULT_DARK_THEME_PREFERENCES,
  DEFAULT_LIGHT_THEME_PREFERENCES,
  getButtonChoiceLabel,
  getGroupColorChoice,
  PAGE_THEME_META,
  patchThemePreferencesPageMode,
  themePreferencesEqual,
  type ButtonGroupKey,
  type PageThemeMode,
  type ThemePreferences,
} from '../services/buttonThemeService';
import { SETTINGS_SYNC_DEBOUNCE_MS } from '../services/settingsPersistenceEngine';
import type { ExpenseCurrency } from '../services/exchangeRateService';
import ProfileSettingsSections, { type ProfileCurrencySubSection } from './ProfileSettingsSections';

function createFreshDefaultTheme(pageMode: PageThemeMode): ThemePreferences {
  const base = pageMode === 'light' ? DEFAULT_LIGHT_THEME_PREFERENCES : DEFAULT_DARK_THEME_PREFERENCES;
  return {
    ...base,
    buttons: { ...base.buttons },
  };
}

type ThemeResetFeedback = 'idle' | 'reset';

interface ProfilePageProps {
  user: FirebaseUser;
  userName: string;
  currentAvatarUrl: string;
  googleAvatarUrl: string | null;
  onBack: () => void;
  onSaveAvatar: (avatarUrl: string) => Promise<void>;
  onLogout: () => void;
  recentExpenseCurrencies: ExpenseCurrency[];
  initialCurrencySections?: ProfileCurrencySubSection[] | null;
}

const PRESET_AVATARS = [
  'https://api.dicebear.com/8.x/fun-emoji/svg?seed=Mint',
  'https://api.dicebear.com/8.x/fun-emoji/svg?seed=Spark',
  'https://api.dicebear.com/8.x/fun-emoji/svg?seed=Nova',
  'https://api.dicebear.com/8.x/fun-emoji/svg?seed=Coral',
  'https://api.dicebear.com/8.x/fun-emoji/svg?seed=Aurora',
  'https://api.dicebear.com/8.x/fun-emoji/svg?seed=River',
  'https://api.dicebear.com/8.x/fun-emoji/svg?seed=Leaf',
  'https://api.dicebear.com/8.x/fun-emoji/svg?seed=Neon',
];

const GROUP_ORDER: ButtonGroupKey[] = [
  'primary',
  'currency',
  'nav',
  'filter',
  'text',
  'mainCard',
  'subCard',
];

const GROUP_ICONS: Record<ButtonGroupKey, string> = {
  primary: '⚡',
  currency: '💱',
  nav: '🧭',
  filter: '📝',
  text: '✍️',
  mainCard: '🃏',
  subCard: '🧩',
};

type ThemeAccordionSection = 'page' | 'buttons';

/** Sub-category body inside a section capsule — opacity only so rounded frame stays intact. */
const subCategoryPanelMotion = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.18, ease: 'easeOut' as const },
};

/** Master category body — opacity only so rounded-2xl perimeter stays intact. */
const masterCategoryBodyMotion = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.2, ease: 'easeOut' as const },
};

function MasterChevron({ open }: { open: boolean }) {
  return (
    <ChevronDown
      className={`h-5 w-5 shrink-0 ${themeTextMutedClass} transition-transform duration-300 ease-in-out ${
        open ? 'rotate-180' : 'rotate-0'
      }`}
      aria-hidden
    />
  );
}

export default function ProfilePage({
  user,
  userName,
  currentAvatarUrl,
  googleAvatarUrl,
  onBack: _onBack,
  onSaveAvatar,
  onLogout,
  recentExpenseCurrencies,
  initialCurrencySections,
}: ProfilePageProps) {
  const { tr, lang, themePreferences, setThemePreferences } = useLanguage();
  const [selectedAvatar, setSelectedAvatar] = useState(
    sanitizeAvatarUrl(currentAvatarUrl, DEFAULT_GUEST_AVATAR_URL),
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [draftTheme, setDraftTheme] = useState<ThemePreferences>(() => ({
    ...themePreferences,
    buttons: { ...themePreferences.buttons },
  }));
  const [themeResetState, setThemeResetState] = useState<ThemeResetFeedback>('idle');
  const [isThemeMasterOpen, setIsThemeMasterOpen] = useState(false);
  const [openThemeSections, setOpenThemeSections] = useState<Set<ThemeAccordionSection>>(() => new Set());
  const resetToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toggleThemeMaster = useCallback(() => {
    setIsThemeMasterOpen((prev) => !prev);
  }, []);

  const isThemeSectionOpen = useCallback(
    (key: ThemeAccordionSection) => openThemeSections.has(key),
    [openThemeSections],
  );

  const toggleThemeSection = useCallback((key: ThemeAccordionSection) => {
    setOpenThemeSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    setDraftTheme({
      ...themePreferences,
      buttons: { ...themePreferences.buttons },
    });
  }, [themePreferences]);

  useEffect(() => {
    applyThemeCSS(draftTheme);
  }, [draftTheme]);

  useEffect(() => {
    if (themePreferencesEqual(draftTheme, themePreferences)) return;
    const timer = window.setTimeout(() => {
      setThemePreferences({
        ...draftTheme,
        buttons: { ...draftTheme.buttons },
      });
    }, SETTINGS_SYNC_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [draftTheme, themePreferences, setThemePreferences]);

  const themePreferencesRef = useRef(themePreferences);
  useEffect(() => {
    themePreferencesRef.current = themePreferences;
  });
  useEffect(() => {
    return () => {
      applyThemeCSS(themePreferencesRef.current);
    };
  }, []);

  useEffect(() => {
    setSelectedAvatar(sanitizeAvatarUrl(currentAvatarUrl, DEFAULT_GUEST_AVATAR_URL));
  }, [currentAvatarUrl]);

  const avatarOptions = useMemo(() => {
    const options: string[] = [];
    if (googleAvatarUrl) options.push(googleAvatarUrl);
    if (currentAvatarUrl) options.push(currentAvatarUrl);
    options.push(...PRESET_AVATARS);

    const seen = new Set<string>();
    return options.filter((url) => {
      if (!url || seen.has(url)) return false;
      seen.add(url);
      return true;
    });
  }, [googleAvatarUrl, currentAvatarUrl]);

  const welcome = user.isAnonymous
    ? tr('profileWelcomeGuest')
    : formatTranslation(lang, 'profileWelcomeUser', { name: userName });

  const isHe = lang === 'he';

  const handleSaveAvatar = async () => {
    if (!selectedAvatar || saving) return;
    setSaving(true);
    try {
      await onSaveAvatar(selectedAvatar);
      setPickerOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleGroupColorChange = useCallback((group: ButtonGroupKey, choice: string) => {
    setDraftTheme((prev) => {
      if (group === 'filter') return { ...prev, filterGroupColor: choice };
      if (group === 'text') return { ...prev, textColor: choice };
      if (group === 'mainCard') return { ...prev, mainCardSurfaceColor: choice };
      if (group === 'subCard') return { ...prev, subCardColor: choice };
      return { ...prev, buttons: { ...prev.buttons, [group]: choice } };
    });
  }, []);

  const handlePageModeChange = useCallback((mode: PageThemeMode) => {
    setDraftTheme((prev) => patchThemePreferencesPageMode(prev, { pageMode: mode }));
  }, []);

  const handlePageCustomHexChange = useCallback((hex: string) => {
    setDraftTheme((prev) => patchThemePreferencesPageMode(prev, { pageMode: 'custom', pageCustomHex: hex }));
  }, []);

  const handleResetTheme = useCallback(() => {
    const defaults = createFreshDefaultTheme(draftTheme.pageMode);
    setDraftTheme(defaults);
    setThemePreferences(defaults);

    if (resetToastTimerRef.current) clearTimeout(resetToastTimerRef.current);
    setThemeResetState('reset');
    resetToastTimerRef.current = setTimeout(() => setThemeResetState('idle'), 2400);
  }, [setThemePreferences]);

  const pageModeLabel =
    draftTheme.pageMode === 'custom'
      ? isHe
        ? PAGE_THEME_META.custom.labelHe
        : PAGE_THEME_META.custom.labelEn
      : isHe
        ? PAGE_THEME_META[draftTheme.pageMode].labelHe
        : PAGE_THEME_META[draftTheme.pageMode].labelEn;

  return (
    <div className="relative mx-auto w-full max-w-3xl" {...{ [SETTINGS_PROFILE_SCOPE_ATTR]: '' }}>
      <div className="flex flex-col gap-3">
      {/* ── Profile card (always visible) ─────────────────────────────── */}
      <div className={`w-full ${themeCardLgClass}`}>
        <div className="flex justify-end px-5 pt-5 sm:px-8 sm:pt-6">
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            <LogOut className="h-4 w-4 shrink-0" aria-hidden />
            {tr('logout')}
          </button>
        </div>
        <div className="flex flex-col items-center px-5 pb-6 pt-2 text-center sm:px-8 sm:pb-8">
          <p className={`mb-6 text-lg font-semibold ${themeTextClass}`}>{welcome}</p>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="group relative mb-6 rounded-full"
            aria-label={tr('profileEditAvatarAria')}
          >
            <img
              src={selectedAvatar}
              alt=""
              className={`h-24 w-24 sm:h-32 sm:w-32 ${monochromeAvatarRingClass}`}
              onError={(e) => {
                e.currentTarget.src = DEFAULT_GUEST_AVATAR_URL;
                setSelectedAvatar(DEFAULT_GUEST_AVATAR_URL);
              }}
            />
            <span
              className={`absolute -bottom-1 -right-1 inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--page-border)] bg-[var(--page-surface-muted)] ${themeTextClass} shadow-md transition-colors group-hover:bg-[var(--page-border)]`}
            >
              <Pencil className="h-4 w-4" />
            </span>
          </button>

          <button
            type="button"
            onClick={handleSaveAvatar}
            disabled={saving}
            className={`inline-flex min-h-[2.75rem] min-w-[10rem] items-center justify-center px-6 py-2.5 text-base disabled:cursor-not-allowed disabled:opacity-60 ${primaryActionButtonClass}`}
          >
            {saving ? tr('profileSaving') : tr('profileSave')}
          </button>
        </div>
      </div>

      <hr className="my-6 border-gray-200 dark:border-gray-800" />

      <ProfileSettingsSections
        recentExpenseCurrencies={recentExpenseCurrencies}
        initialCurrencySections={initialCurrencySections}
      />

      {/* ── Color theme customization — master rounded enclosure ── */}
      <div className={subCardMasterCategoryStackClass}>
        <MasterCategoryPanel expanded={isThemeMasterOpen} {...themeCategoryProps('mainCard')}>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleThemeMaster}
              aria-expanded={isThemeMasterOpen}
              className={`min-w-0 flex-1 ${subCardNestedAccordionTriggerClass}`}
            >
              <div className="flex min-w-0 flex-1 items-center justify-between gap-3 text-start">
                <div className="min-w-0 flex-1">
                  <h3 className={`truncate text-base font-bold sm:text-lg ${themeTextClass}`}>
                    {tr('profileColorThemeTitle')}
                  </h3>
                  <p className={`mt-0.5 text-xs sm:text-sm ${themeTextMutedClass}`}>
                    {tr('profileColorThemeDesc')}
                  </p>
                </div>
                <MasterChevron open={isThemeMasterOpen} />
              </div>
            </button>
            <button
              type="button"
              onClick={handleResetTheme}
              title={tr('profileColorThemeReset')}
              className={`h-8 w-8 shrink-0 ${utilityNavIconButtonClass}`}
              aria-label={tr('profileColorThemeReset')}
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>

          <AnimatePresence initial={false}>
            {isThemeMasterOpen && (
              <motion.div key="theme-master-panel" {...masterCategoryBodyMotion}>
                <MasterCategoryPanelBody>
                  <SubCardNestedStack variant="capsuleOnMain">
                <SubCategorySectionCard>
                <button
                  type="button"
                  onClick={() => toggleThemeSection('page')}
                  aria-expanded={isThemeSectionOpen('page')}
                  className={subCardNestedAccordionTriggerClass}
                  {...themeCategoryProps('subCard')}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className={monochromeDepthIconBadgeClass}>
                        <Palette className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 text-start">
                        <h4 className={`truncate text-base font-semibold sm:text-lg ${typographyTitleClass}`}>
                          {tr('profileThemeAccordionPageTitle')}
                        </h4>
                        <p className={`mt-0.5 text-xs sm:text-sm ${themeTextMutedClass}`}>
                          {tr('profileThemeAccordionPageDesc')}
                        </p>
                      </div>
                    </div>
                    {isThemeSectionOpen('page') ? (
                      <ChevronDown className={`h-5 w-5 shrink-0 ${themeTextMutedClass}`} />
                    ) : (
                      <ChevronUp className={`h-5 w-5 shrink-0 ${themeTextMutedClass}`} />
                    )}
                  </div>
                </button>

                <AnimatePresence initial={false}>
                  {isThemeSectionOpen('page') && (
                    <motion.div key="profile-theme-page" {...subCategoryPanelMotion}>
                      <SubCategorySectionBody>
                        <div className="mb-3 flex items-start gap-2">
                          <span className="mt-0.5 text-base leading-none" aria-hidden="true">
                            🎨
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className={`text-sm font-semibold ${themeTextClass}`}>
                              {tr('profilePageThemeTitle')}
                            </p>
                            <p className={`mt-0.5 text-xs leading-relaxed ${themeTextMutedClass}`}>
                              {tr('profilePageThemeDesc')}
                            </p>
                          </div>
                        </div>

                        <PageThemePicker
                          mode={draftTheme.pageMode}
                          customHex={draftTheme.pageCustomHex}
                          onModeChange={handlePageModeChange}
                          onCustomHexChange={handlePageCustomHexChange}
                        />

                        <p className={`mt-2 text-xs ${themeTextSubtleClass}`}>{pageModeLabel}</p>
                      </SubCategorySectionBody>
                    </motion.div>
                  )}
                </AnimatePresence>
                </SubCategorySectionCard>

                <SubCategorySectionCard>
                <button
                  type="button"
                  onClick={() => toggleThemeSection('buttons')}
                  aria-expanded={isThemeSectionOpen('buttons')}
                  className={subCardNestedAccordionTriggerClass}
                  {...themeCategoryProps('subCard')}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className={monochromeDepthIconBadgeClass}>
                        <SlidersHorizontal className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 text-start">
                        <h4 className={`truncate text-base font-semibold sm:text-lg ${typographyTitleClass}`}>
                          {tr('profileThemeAccordionButtonsTitle')}
                        </h4>
                        <p className={`mt-0.5 text-xs sm:text-sm ${themeTextMutedClass}`}>
                          {tr('profileThemeAccordionButtonsDesc')}
                        </p>
                      </div>
                    </div>
                    {isThemeSectionOpen('buttons') ? (
                      <ChevronDown className={`h-5 w-5 shrink-0 ${themeTextMutedClass}`} />
                    ) : (
                      <ChevronUp className={`h-5 w-5 shrink-0 ${themeTextMutedClass}`} />
                    )}
                  </div>
                </button>

                </SubCategorySectionCard>

                <AnimatePresence initial={false}>
                  {isThemeSectionOpen('buttons') &&
                    GROUP_ORDER.map((groupKey) => {
                      const meta = BUTTON_GROUP_META[groupKey];
                      const currentChoice = getGroupColorChoice(draftTheme, groupKey);

                      return (
                        <motion.div key={`profile-theme-group-${groupKey}`} {...subCategoryPanelMotion}>
                          <SubCategorySectionCard>
                            <div className="mb-3 flex items-start gap-2">
                              <span className="mt-0.5 text-base leading-none" aria-hidden="true">
                                {GROUP_ICONS[groupKey]}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className={`text-sm font-semibold ${themeTextClass}`}>
                                  {isHe ? meta.labelHe : meta.labelEn}
                                </p>
                                <p className={`mt-0.5 text-xs leading-relaxed ${themeTextMutedClass}`}>
                                  {isHe ? meta.descHe : meta.descEn}
                                </p>
                              </div>
                            </div>

                            <ButtonGroupColorPicker
                              group={groupKey}
                              value={currentChoice}
                              onChange={(choice) => handleGroupColorChange(groupKey, choice)}
                            />

                            <p className={`mt-2 text-xs ${themeTextSubtleClass}`}>
                              {getButtonChoiceLabel(groupKey, currentChoice, lang)}
                            </p>
                          </SubCategorySectionCard>
                        </motion.div>
                      );
                    })}
                </AnimatePresence>
                  </SubCardNestedStack>

                  <div className="border-t border-[var(--main-card-surface-border)] pt-4 sm:pt-5">
                    <SettingsSyncStatusBadge />
                  </div>
                </MasterCategoryPanelBody>
              </motion.div>
            )}
          </AnimatePresence>
        </MasterCategoryPanel>
      </div>
      </div>

      <AnimatePresence>
        {themeResetState === 'reset' && (
          <motion.div
            key="profile-theme-reset-toast"
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className={monochromeToastPanelClass}
            style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            <span className="inline-flex items-center justify-center gap-2">
              <Check className="h-4 w-4 shrink-0" strokeWidth={2.5} />
              {tr('profileColorThemeResetSaved')}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Avatar picker modal ─────────────────────────────────────────── */}
      {pickerOpen && (
        <div className={monochromeModalScrimClass}>
          <div className={`w-full max-w-xl p-5 sm:p-6 ${themeCardLgClass}`}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className={`text-base font-semibold sm:text-lg ${themeTextClass}`}>
                {tr('profileChooseAvatar')}
              </h3>
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                className={`h-9 w-9 ${utilityNavIconButtonClass}`}
                aria-label={tr('profileCloseAvatarPickerAria')}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {avatarOptions.map((avatarUrl, index) => (
                <button
                  key={avatarUrl}
                  type="button"
                  onClick={() => setSelectedAvatar(avatarUrl)}
                  className={
                    selectedAvatar === avatarUrl
                      ? monochromeAvatarPickerSelectedClass
                      : monochromeAvatarPickerIdleClass
                  }
                  title={
                    index === 0 && googleAvatarUrl
                      ? tr('profileGmailPhotoTitle')
                      : tr('profilePresetAvatarTitle')
                  }
                >
                  <img
                    src={avatarUrl}
                    alt=""
                    className="h-16 w-16 rounded-xl object-cover sm:h-20 sm:w-20"
                    onError={(e) => {
                      e.currentTarget.src = DEFAULT_GUEST_AVATAR_URL;
                    }}
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
