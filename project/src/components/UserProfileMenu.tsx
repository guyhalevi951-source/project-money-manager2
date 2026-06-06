import { useLanguage } from '../LanguageContext';
import { DEFAULT_GUEST_AVATAR_URL, sanitizeAvatarUrl } from '../services/avatarService';

interface UserProfileMenuProps {
  avatarUrl: string;
  onOpenProfile: () => void;
}

export default function UserProfileMenu({ avatarUrl, onOpenProfile }: UserProfileMenuProps) {
  const { tr } = useLanguage();
  const safeAvatarUrl = sanitizeAvatarUrl(avatarUrl, DEFAULT_GUEST_AVATAR_URL);

  return (
    <button
      type="button"
      onClick={() => onOpenProfile()}
      aria-label={tr('profile')}
      className="h-10 w-10 cursor-pointer overflow-hidden rounded-full border-2 border-slate-700 shadow-md shadow-black/30 transition-opacity hover:opacity-80 hover:border-emerald-500/50 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
    >
      <img
        src={safeAvatarUrl}
        alt=""
        className="h-full w-full bg-slate-800 object-cover"
        width={40}
        height={40}
        onError={(e) => {
          e.currentTarget.src = DEFAULT_GUEST_AVATAR_URL;
        }}
      />
    </button>
  );
}
