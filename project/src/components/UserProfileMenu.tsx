import { useEffect, useRef, useState } from 'react';
import { LogOut, User } from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import { DEFAULT_GUEST_AVATAR_URL, sanitizeAvatarUrl } from '../services/avatarService';

interface UserProfileMenuProps {
  avatarUrl: string;
  onOpenProfile: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
}

export default function UserProfileMenu({
  avatarUrl,
  onOpenProfile,
  onOpenSettings,
  onLogout,
}: UserProfileMenuProps) {
  const { tr } = useLanguage();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const safeAvatarUrl = sanitizeAvatarUrl(avatarUrl, DEFAULT_GUEST_AVATAR_URL);

  useEffect(() => {
    if (!isProfileMenuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsProfileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isProfileMenuOpen]);

  return (
    <div ref={containerRef} className="relative z-30">
      <button
        type="button"
        onClick={() => setIsProfileMenuOpen((prev) => !prev)}
        aria-expanded={isProfileMenuOpen}
        aria-haspopup="menu"
        aria-label={tr('profile')}
        className="h-10 w-10 cursor-pointer overflow-hidden rounded-full border-2 border-slate-700 shadow-md shadow-black/30 transition-all hover:border-emerald-500/50 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
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

      <div
        role="menu"
        aria-hidden={!isProfileMenuOpen}
        className={`absolute end-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-md border border-gray-700 bg-gray-800 py-1 shadow-lg transition-all duration-200 ${
          isProfileMenuOpen
            ? 'pointer-events-auto translate-y-0 scale-100 opacity-100'
            : 'pointer-events-none -translate-y-1 scale-95 opacity-0'
        }`}
      >
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            setIsProfileMenuOpen(false);
            onOpenProfile();
          }}
          className="flex w-full items-center gap-2.5 px-3 py-2 text-right text-sm text-neutral-200 transition-colors hover:bg-neutral-700"
        >
          <User className="h-4 w-4 shrink-0 text-neutral-400" />
          <span className="flex-1">{tr('profile')}</span>
        </button>
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            setIsProfileMenuOpen(false);
            onOpenSettings();
          }}
          className="flex w-full items-center gap-2.5 px-3 py-2 text-right text-sm text-neutral-200 transition-colors hover:bg-neutral-700"
        >
          <User className="h-4 w-4 shrink-0 text-neutral-400" />
          <span className="flex-1">{tr('settings')}</span>
        </button>
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            setIsProfileMenuOpen(false);
            onLogout();
          }}
          className="flex w-full items-center gap-2.5 px-3 py-2 text-right text-sm text-rose-300 transition-colors hover:bg-rose-500/15"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span className="flex-1">התנתקות</span>
        </button>
      </div>
    </div>
  );
}
