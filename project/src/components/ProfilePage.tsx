import { useEffect, useMemo, useState } from 'react';
import { Pencil, X } from 'lucide-react';
import type { User as FirebaseUser } from 'firebase/auth';
import { useLanguage } from '../LanguageContext';
import { formatTranslation } from '../translations';
import { DEFAULT_GUEST_AVATAR_URL, sanitizeAvatarUrl } from '../services/avatarService';
import { primaryActionButtonClass, utilityNavIconButtonClass } from '../styles/actionButtonStyles';

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

export default function ProfilePage({
  user,
  userName,
  currentAvatarUrl,
  googleAvatarUrl,
  onBack,
  onSaveAvatar,
}: ProfilePageProps) {
  const { tr, lang } = useLanguage();
  const [selectedAvatar, setSelectedAvatar] = useState(
    sanitizeAvatarUrl(currentAvatarUrl, DEFAULT_GUEST_AVATAR_URL),
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

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

  const handleSave = async () => {
    if (!selectedAvatar || saving) return;
    setSaving(true);
    try {
      await onSaveAvatar(selectedAvatar);
      setPickerOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center">
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
            onClick={handleSave}
            disabled={saving}
            className={`inline-flex min-h-[2.75rem] min-w-[10rem] items-center justify-center px-6 py-2.5 text-base disabled:cursor-not-allowed disabled:opacity-60 ${primaryActionButtonClass}`}
          >
            {saving ? tr('profileSaving') : tr('profileSave')}
          </button>
        </div>
      </div>

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
