import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Pencil, RefreshCw, X } from 'lucide-react';
import type { User as FirebaseUser } from 'firebase/auth';
import { useLanguage } from '../LanguageContext';
import { formatTranslation } from '../translations';
import { DEFAULT_GUEST_AVATAR_URL, sanitizeAvatarUrl } from '../services/avatarService';
import { primaryActionButtonClass, utilityNavIconButtonClass } from '../styles/actionButtonStyles';
import {
  themeCardLgClass,
  themeCardMutedClass,
  themeTextClass,
  themeTextMutedClass,
  themeTextSubtleClass,
} from '../styles/themeSurfaceStyles';
import ButtonGroupColorPicker from './ButtonGroupColorPicker';
import PageThemePicker from './PageThemePicker';
import {
  applyThemeCSS,
  BUTTON_GROUP_META,
  DEFAULT_THEME_PREFERENCES,
  getButtonChoiceLabel,
  getGroupColorChoice,
  PAGE_THEME_META,
  themePreferencesEqual,
  type ButtonGroupKey,
  type PageThemeMode,
  type ThemePreferences,
} from '../services/buttonThemeService';

interface ProfilePageProps {
  user: FirebaseUser;
  userName: string;
  currentAvatarUrl: string;
  googleAvatarUrl: string | null;
  onBack: () => void;
  onSaveAvatar: (avatarUrl: string) => Promise<void>;
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

const GROUP_ORDER: ButtonGroupKey[] = ['primary', 'currency', 'nav', 'filter'];

const GROUP_ICONS: Record<ButtonGroupKey, string> = {
  primary: '⚡',
  currency: '💱',
  nav: '🧭',
  filter: '📝',
};

export default function ProfilePage({
  user,
  userName,
  currentAvatarUrl,
  googleAvatarUrl,
  onBack,
  onSaveAvatar,
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
  const [themeSaveState, setThemeSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setDraftTheme({
      ...themePreferences,
      buttons: { ...themePreferences.buttons },
    });
  }, [themePreferences]);

  useEffect(() => {
    applyThemeCSS(draftTheme);
  }, [draftTheme]);

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
    setDraftTheme((prev) =>
      group === 'filter'
        ? { ...prev, filterGroupColor: choice }
        : { ...prev, buttons: { ...prev.buttons, [group]: choice } },
    );
  }, []);

  const handlePageModeChange = useCallback((mode: PageThemeMode) => {
    setDraftTheme((prev) => ({ ...prev, pageMode: mode }));
  }, []);

  const handlePageCustomHexChange = useCallback((hex: string) => {
    setDraftTheme((prev) => ({ ...prev, pageMode: 'custom', pageCustomHex: hex }));
  }, []);

  const handleSaveTheme = () => {
    if (themeSaveState === 'saving') return;
    setThemeSaveState('saving');
    setThemePreferences(draftTheme);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => {
      setThemeSaveState('saved');
      savedTimerRef.current = setTimeout(() => setThemeSaveState('idle'), 1800);
    }, 200);
  };

  const handleResetTheme = () => {
    setDraftTheme({
      ...DEFAULT_THEME_PREFERENCES,
      buttons: { ...DEFAULT_THEME_PREFERENCES.buttons },
    });
  };

  const isDirty = !themePreferencesEqual(draftTheme, themePreferences);

  const pageModeLabel =
    draftTheme.pageMode === 'custom'
      ? isHe
        ? PAGE_THEME_META.custom.labelHe
        : PAGE_THEME_META.custom.labelEn
      : isHe
        ? PAGE_THEME_META[draftTheme.pageMode].labelHe
        : PAGE_THEME_META[draftTheme.pageMode].labelEn;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      {/* ── Avatar / profile card ───────────────────────────────────────── */}
      <div className={`w-full p-5 sm:p-8 ${themeCardLgClass}`}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className={`text-xl font-bold sm:text-2xl ${themeTextClass}`}>{tr('profile')}</h2>
          <button
            type="button"
            onClick={onBack}
            className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--page-border)] bg-[var(--page-surface-muted)] ${themeTextMutedClass} transition-colors hover:bg-[var(--page-border)]`}
            aria-label={tr('close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col items-center text-center">
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
              className="h-24 w-24 rounded-full border-4 border-emerald-500/40 object-cover shadow-lg shadow-black/35 sm:h-32 sm:w-32"
              onError={(e) => {
                e.currentTarget.src = DEFAULT_GUEST_AVATAR_URL;
                setSelectedAvatar(DEFAULT_GUEST_AVATAR_URL);
              }}
            />
            <span className={`absolute -bottom-1 -right-1 inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--page-border)] bg-[var(--page-surface-muted)] ${themeTextClass} shadow-md transition-colors group-hover:bg-[var(--page-border)]`}>
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

      {/* ── Color theme customization card ──────────────────────────────── */}
      <div className={`w-full p-5 sm:p-6 ${themeCardLgClass}`}>
        <div className="mb-1 flex items-start justify-between gap-3">
          <div>
            <h3 className={`text-base font-bold sm:text-lg ${themeTextClass}`}>
              {tr('profileColorThemeTitle')}
            </h3>
            <p className={`mt-0.5 text-xs sm:text-sm ${themeTextMutedClass}`}>
              {tr('profileColorThemeDesc')}
            </p>
          </div>
          <button
            type="button"
            onClick={handleResetTheme}
            title={tr('profileColorThemeReset')}
            className={`mt-0.5 h-8 w-8 shrink-0 ${utilityNavIconButtonClass}`}
            aria-label={tr('profileColorThemeReset')}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="mt-5 flex flex-col gap-4">
          {/* Global page theme */}
          <div className={`rounded-2xl p-4 ${themeCardMutedClass}`}>
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
          </div>

          {/* Button groups */}
          {GROUP_ORDER.map((groupKey) => {
            const meta = BUTTON_GROUP_META[groupKey];
            const currentChoice = getGroupColorChoice(draftTheme, groupKey);

            return (
              <div key={groupKey} className={`rounded-2xl p-4 ${themeCardMutedClass}`}>
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
              </div>
            );
          })}
        </div>

        <div className="mt-5 flex items-center justify-end gap-3">
          {themeSaveState === 'saved' && (
            <span className="flex items-center gap-1.5 text-sm text-emerald-400">
              <Check className="h-4 w-4" strokeWidth={2.5} />
              {tr('profileColorThemeSaved')}
            </span>
          )}
          <button
            type="button"
            onClick={handleSaveTheme}
            disabled={!isDirty && themeSaveState === 'idle'}
            className={[
              'inline-flex min-h-[2.75rem] min-w-[10rem] items-center justify-center gap-2 px-5 py-2.5 text-sm',
              primaryActionButtonClass,
              !isDirty && themeSaveState === 'idle' ? 'cursor-not-allowed opacity-50' : '',
            ].join(' ')}
          >
            {themeSaveState === 'saving'
              ? tr('profileColorThemeSaving')
              : tr('profileColorThemeSave')}
          </button>
        </div>
      </div>

      {/* ── Avatar picker modal ─────────────────────────────────────────── */}
      {pickerOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4">
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
                  className={`relative rounded-xl border p-1 transition-all ${
                    selectedAvatar === avatarUrl
                      ? 'border-indigo-500 bg-indigo-500/10 ring-1 ring-indigo-400/40'
                      : 'border-[var(--page-border)] bg-[var(--page-surface-muted)] hover:border-indigo-700/50'
                  }`}
                  title={
                    index === 0 && googleAvatarUrl
                      ? tr('profileGmailPhotoTitle')
                      : tr('profilePresetAvatarTitle')
                  }
                >
                  <img
                    src={avatarUrl}
                    alt=""
                    className="h-16 w-16 rounded-lg object-cover sm:h-20 sm:w-20"
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
