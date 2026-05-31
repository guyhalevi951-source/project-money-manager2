import { useEffect, useRef, useState } from 'react';
import { LogOut, Settings, User } from 'lucide-react';
import type { User as FirebaseUser } from 'firebase/auth';

interface UserProfileMenuProps {
  user: FirebaseUser;
  userName: string;
  onLogout: () => void;
}

export default function UserProfileMenu({ user, userName, onLogout }: UserProfileMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const avatarUrl =
    user.photoURL ??
    `https://api.dicebear.com/8.x/fun-emoji/svg?seed=${encodeURIComponent(user.uid)}`;

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative z-30">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="תפריט פרופיל"
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
          <p className="text-sm font-medium text-neutral-100 truncate">שלום, {userName}</p>
        </div>

        <div className="h-px bg-neutral-800" />

        <div className="p-2">
          <button
            type="button"
            role="menuitem"
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-neutral-300 hover:bg-neutral-800 transition-colors"
          >
            <User className="w-4 h-4 shrink-0 text-neutral-500" />
            <span className="flex-1 text-right">פרופיל</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-neutral-300 hover:bg-neutral-800 transition-colors"
          >
            <Settings className="w-4 h-4 shrink-0 text-neutral-500" />
            <span className="flex-1 text-right">הגדרות</span>
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
            <span className="flex-1 text-right">התנתק</span>
          </button>
        </div>
      </div>
    </div>
  );
}
