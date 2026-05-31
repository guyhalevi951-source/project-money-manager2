import { useEffect, useRef, useState } from 'react';
import { LogOut, Settings, User, X } from 'lucide-react';
import type { User as FirebaseUser } from 'firebase/auth';
import { useLanguage } from '../LanguageContext';

interface UserProfileMenuProps {
  user: FirebaseUser;
  userName: string;
  onLogout: () => void;
}

export default function UserProfileMenu({ user, userName, onLogout }: UserProfileMenuProps) {
  const { lang, dir, setLang, tr, keepOriginalValues, setKeepOriginalValues } = useLanguage();
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const avatarUrl =
    user.photoURL ??
    `https://api.dicebear.com/8.x/fun-emoji/svg?seed=${encodeURIComponent(user.uid)}`;

  useEffect(() => {
    if (!open && !settingsOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        setSettingsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        setSettingsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open, settingsOpen]);

  return (
    <div ref={containerRef} className="relative z-30">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={tr('profile')}
        className="w-10 h-10 rounded-full overflow-hidden border-2 border-slate-700 hover:border-emerald-500/50 cursor-pointer transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 shadow-md shadow-black/30"
      >
        <img
          src={avatarUrl}
          alt=""
          className="w-full h-full object-cover bg-slate-800"
          width={40}
          height={40}
        />
      </button>

      <div
        role="menu"
        aria-hidden={!open}
        className={`absolute top-full mt-2 end-0 w-56 rounded-2xl bg-neutral-900/95 border border-neutral-700/80 shadow-2xl shadow-black/50 backdrop-blur-md overflow-hidden transition-all duration-200 origin-top z-50 ${
          open
            ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 scale-95 -translate-y-1 pointer-events-none'
        }`}
      >
        <div className="px-4 py-3">
          <p className="text-sm font-medium text-neutral-100 truncate">
            {tr('greetingPrefix')}, {userName}
          </p>
        </div>

        <div className="h-px bg-neutral-800" />

        <div className="p-2">
          <button
            type="button"
            role="menuitem"
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-neutral-300 hover:bg-neutral-800 transition-colors"
          >
            <User className="w-4 h-4 shrink-0 text-neutral-500" />
            <span className="flex-1 text-right">{tr('profile')}</span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setSettingsOpen(true);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-neutral-300 hover:bg-neutral-800 transition-colors"
          >
            <Settings className="w-4 h-4 shrink-0 text-neutral-500" />
            <span className="flex-1 text-right">{tr('settings')}</span>
          </button>
        </div>

        <div className="h-px bg-neutral-800" />

        <div className="p-2">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-rose-300 hover:bg-rose-500/15 border border-transparent hover:border-rose-500/30 transition-all"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span className="flex-1 text-right">{tr('logout')}</span>
          </button>
        </div>
      </div>

      <div
        dir={dir}
        className={`fixed inset-0 z-[70] transition-all duration-200 ${
          settingsOpen ? 'pointer-events-auto' : 'pointer-events-none'
        }`}
        aria-hidden={!settingsOpen}
      >
        <button
          type="button"
          onClick={() => setSettingsOpen(false)}
          className={`absolute inset-0 bg-black/65 backdrop-blur-sm transition-opacity ${
            settingsOpen ? 'opacity-100' : 'opacity-0'
          }`}
          aria-label={tr('close')}
        />

        <div
          className={`absolute ${
            dir === 'rtl' ? 'left-4 right-4 sm:left-auto sm:right-6' : 'left-4 right-4 sm:right-auto sm:left-6'
          } top-20 w-auto sm:w-[26rem] rounded-3xl border border-gray-700/80 bg-gray-900/90 backdrop-blur-xl shadow-2xl shadow-black/60 p-5 sm:p-6 transition-all duration-200 ${
            settingsOpen ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-2 scale-95'
          }`}
          role="dialog"
          aria-modal="true"
          aria-label={tr('settings')}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-semibold text-white">{tr('settings')}</h3>
              <p className="text-xs text-gray-400 mt-1">{tr('languageDescription')}</p>
            </div>
            <button
              type="button"
              onClick={() => setSettingsOpen(false)}
              className="text-gray-500 hover:text-gray-200 hover:bg-gray-800 p-2 rounded-lg transition-colors"
              aria-label={tr('close')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-5 rounded-2xl border border-gray-700/70 bg-gray-900/70 p-4">
            <p className="text-sm font-medium text-gray-100 mb-3">{tr('language')}</p>
            <div className="inline-flex w-full rounded-2xl bg-gray-950/80 border border-gray-700 p-1">
              <button
                type="button"
                onClick={() => setLang('he')}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  lang === 'he'
                    ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
                    : 'text-gray-300 hover:text-white hover:bg-gray-800/80'
                }`}
              >
                {tr('hebrew')}
              </button>
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  lang === 'en'
                    ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
                    : 'text-gray-300 hover:text-white hover:bg-gray-800/80'
                }`}
              >
                {tr('english')}
              </button>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-gray-700/70 bg-gray-900/70 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-gray-200 leading-relaxed">
                {tr('keepOriginalValuesLabel')}
              </p>
              <button
                type="button"
                onClick={() => setKeepOriginalValues(!keepOriginalValues)}
                role="switch"
                aria-checked={keepOriginalValues}
                className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-all ${
                  keepOriginalValues
                    ? 'bg-emerald-500/80 border-emerald-400/70'
                    : 'bg-gray-800 border-gray-600'
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
    </div>
  );
}
