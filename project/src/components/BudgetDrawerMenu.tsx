import { useEffect, useRef } from 'react';
import { Menu, User, Users } from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import { utilityNavMenuToggleClass } from '../styles/actionButtonStyles';
import type { AppShellView } from '../services/budgetArchitecture';

interface BudgetDrawerMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (view: AppShellView) => void;
}

export default function BudgetDrawerMenu({ open, onOpenChange, onNavigate }: BudgetDrawerMenuProps) {
  const { tr } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onOpenChange(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open, onOpenChange]);

  return (
    <div ref={containerRef} className="relative z-40">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={tr('budgetDrawerToggle')}
        className={`inline-flex h-10 w-10 items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${utilityNavMenuToggleClass}`}
      >
        <Menu className="h-5 w-5" />
      </button>

      <div
        role="menu"
        aria-hidden={!open}
        className={`absolute end-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-neutral-700 bg-neutral-900 py-1 shadow-xl transition-all duration-200 ${
          open
            ? 'pointer-events-auto translate-y-0 scale-100 opacity-100'
            : 'pointer-events-none -translate-y-1 scale-95 opacity-0'
        }`}
      >
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            onOpenChange(false);
            onNavigate('personal-budgets');
          }}
          className="flex w-full items-center gap-2.5 px-4 py-3 text-sm text-neutral-200 transition-colors hover:bg-neutral-800"
        >
          <User className="h-4 w-4 shrink-0 text-emerald-400" />
          <span className="flex-1 text-start">{tr('personalBudgetsTitle')}</span>
        </button>
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            onOpenChange(false);
            onNavigate('shared-budgets');
          }}
          className="flex w-full items-center gap-2.5 px-4 py-3 text-sm text-neutral-200 transition-colors hover:bg-neutral-800"
        >
          <Users className="h-4 w-4 shrink-0 text-violet-400" />
          <span className="flex-1 text-start">{tr('sharedBudgetsTitle')}</span>
        </button>
      </div>
    </div>
  );
}
