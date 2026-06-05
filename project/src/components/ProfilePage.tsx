import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Pencil, RefreshCw, X } from 'lucide-react';
import type { User as FirebaseUser } from 'firebase/auth';
import { useLanguage } from '../LanguageContext';
import { formatTranslation } from '../translations';
import { DEFAULT_GUEST_AVATAR_URL, sanitizeAvatarUrl } from '../services/avatarService';
import { primaryActionButtonClass, utilityNavIconButtonClass } from '../styles/actionButtonStyles';
import {
  ALL_PRESETS,
  applyButtonThemeCSS,
  BUTTON_GROUP_META,
  DEFAULT_BUTTON_THEME,
  type ButtonGroupKey,
  type ButtonGroupTheme,
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

const GROUP_ORDER: ButtonGroupKey[] = ['primary', 'currency', 'nav'];

const GROUP_ICONS: Record<ButtonGroupKey, string> = {
  primary: '⚡',
  currency: '💱',
  nav: '🧭',
};

export default function ProfilePage({
  user,
  userName,
  currentAvatarUrl,
  googleAvatarUrl,
  onBack,
  onSaveAvatar,
}: ProfilePageProps) {
  const { tr, lang, buttonTheme, setButtonTheme } = useLanguage();
  const [selectedAvatar, setSelectedAvatar] = useState(
    sanitizeAvatarUrl(currentAvatarUrl, DEFAULT_GUEST_AVATAR_URL),
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Draft theme — changes are previewed live via CSS vars but only committed on "Save".
  const [draftTheme, setDraftTheme] = useState<ButtonGroupTheme>(() => ({ ...buttonTheme }));
  const [themeSaveState, setThemeSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // If the app theme changes externally (e.g. cloud sync), sync the draft.
  useEffect(() => {
    setDraftTheme({ ...buttonTheme });
  }, [buttonTheme]);

  // Preview draft changes in real time without committing to context yet.
  useEffect(() => {
    applyButtonThemeCSS(draftTheme);
  }, [draftTheme]);

  // On unmount, revert CSS vars to committed context theme if the user didn't save.
  const buttonThemeRef = useRef(buttonTheme);
  useEffect(() => {
    buttonThemeRef.current = buttonTheme;
  });
  useEffect(() => {
    return () => {
      applyButtonThemeCSS(buttonThemeRef.current);
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

  const handlePickPreset = useCallback((group: ButtonGroupKey, presetId: string) => {
    setDraftTheme((prev) => ({ ...prev, [group]: presetId }));
  }, []);

  const handleSaveTheme = () => {
    if (themeSaveState === 'saving') return;
    setThemeSaveState('saving');
    // Apply + commit to context (persists to localStorage / triggers cloud sync in App.tsx).
    setButtonTheme(draftTheme);
    // Show flash feedback.
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => {
      setThemeSaveState('saved');
      savedTimerRef.current = setTimeout(() => setThemeSaveState('idle'), 1800);
    }, 200);
  };

  const handleResetTheme = () => {
    setDraftTheme({ ...DEFAULT_BUTTON_THEME });
  };

  const isDirty =
    draftTheme.primary !== buttonTheme.primary ||
    draftTheme.currency !== buttonTheme.currency ||
    draftTheme.nav !== buttonTheme.nav;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      {/* ── Avatar / profile card ───────────────────────────────────────── */}
      <div className="w-full rounded-3xl border border-neutral-800 bg-neutral-900 p-5 shadow-2xl shadow-black/30 sm:p-8">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold text-neutral-100 sm:text-2xl">{tr('profile')}</h2>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-700 bg-neutral-800 text-neutral-200 transition-colors hover:bg-neutral-700"
            aria-label={tr('close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col items-center text-center">
          <p className="mb-6 text-lg font-semibold text-neutral-100">{welcome}</p>
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
            <span className="absolute -bottom-1 -right-1 inline-flex h-9 w-9 items-center justify-center rounded-full border border-neutral-700 bg-neutral-800 text-neutral-100 shadow-md transition-colors group-hover:bg-neutral-700">
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
      <div className="w-full rounded-3xl border border-neutral-800 bg-neutral-900 p-5 shadow-xl shadow-black/25 sm:p-6">
        {/* Header */}
        <div className="mb-1 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-neutral-100 sm:text-lg">
              {tr('profileColorThemeTitle')}
            </h3>
            <p className="mt-0.5 text-xs text-neutral-400 sm:text-sm">{tr('profileColorThemeDesc')}</p>
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
          {GROUP_ORDER.map((groupKey) => {
            const meta = BUTTON_GROUP_META[groupKey];
            const presets = ALL_PRESETS[groupKey];
            const currentId = draftTheme[groupKey];
            const isHe = lang === 'he';

            return (
              <div
                key={groupKey}
                className="rounded-2xl border border-neutral-800 bg-neutral-800/50 p-4"
              >
                {/* Group header */}
                <div className="mb-3 flex items-start gap-2">
                  <span className="mt-0.5 text-base leading-none" aria-hidden="true">
                    {GROUP_ICONS[groupKey]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-neutral-100">
                      {isHe ? meta.labelHe : meta.labelEn}
                    </p>
                    <p className="mt-0.5 text-xs text-neutral-400 leading-relaxed">
                      {isHe ? meta.descHe : meta.descEn}
                    </p>
                  </div>
                </div>

                {/* Swatch grid */}
                <div className="flex flex-wrap gap-2.5" role="radiogroup" aria-label={isHe ? meta.labelHe : meta.labelEn}>
                  {Object.values(presets).map((preset) => {
                    const isSelected = preset.id === currentId;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        title={isHe ? preset.labelHe : preset.labelEn}
                        onClick={() => handlePickPreset(groupKey, preset.id)}
                        className={[
                          'group relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all sm:h-10 sm:w-10',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40',
                          isSelected
                            ? 'ring-2 ring-white ring-offset-2 ring-offset-neutral-800 scale-110'
                            : 'opacity-70 hover:opacity-100 hover:scale-105',
                        ].join(' ')}
                        style={{ backgroundColor: preset.swatch }}
                        aria-label={isHe ? preset.labelHe : preset.labelEn}
                      >
                        {isSelected && (
                          <Check className="h-4 w-4 text-white drop-shadow-md" strokeWidth={3} />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Selected preset label */}
                <p className="mt-2 text-xs text-neutral-500">
                  {isHe
                    ? presets[currentId]?.labelHe
                    : presets[currentId]?.labelEn}
                </p>
              </div>
            );
          })}
        </div>

        {/* Save row */}
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
            disabled={!isDirty && themeSaveState !== 'idle'}
            className={[
              'inline-flex min-h-[2.75rem] min-w-[10rem] items-center justify-center gap-2 px-5 py-2.5 text-sm',
              primaryActionButtonClass,
              !isDirty && themeSaveState === 'idle'
                ? 'opacity-50 cursor-not-allowed'
                : '',
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
          <div className="w-full max-w-xl rounded-2xl border border-neutral-700 bg-neutral-900 p-5 shadow-2xl shadow-black/60 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-neutral-100 sm:text-lg">{tr('profileChooseAvatar')}</h3>
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
                      : 'border-neutral-700 bg-neutral-800 hover:border-indigo-700/50'
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
