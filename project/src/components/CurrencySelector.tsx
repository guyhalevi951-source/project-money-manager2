import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import { getCurrencyMeta, type CurrencyCode } from '../constants/currencies';
import { usePinnedCurrencies } from '../hooks/usePinnedCurrencies';
import CurrencyLibraryModal from './CurrencyLibraryModal';
import CurrencyFlag from './CurrencyFlag';
import {
  filterDropdownWrapperClass,
  filterFormControlClass,
  primaryActionSelectedChipClass,
} from '../styles/actionButtonStyles';

const triggerControlClass = `h-12 text-base ${filterFormControlClass}`;

interface CurrencySelectorProps {
  value: CurrencyCode;
  onChange: (code: CurrencyCode) => void;
  className?: string;
}

/**
 * Compact currency trigger (flag + symbol + code) with dropdown grid —
 * same pattern as the expense form / dashboard pickers.
 */
export default function CurrencySelector({ value, onChange, className = '' }: CurrencySelectorProps) {
  const { tr } = useLanguage();
  const pinnedCurrencies = usePinnedCurrencies();
  const [menuOpen, setMenuOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const selectedMeta = useMemo(() => getCurrencyMeta(value), [value]);

  const isTemporaryCurrency = useMemo(
    () => !pinnedCurrencies.includes(value),
    [pinnedCurrencies, value],
  );

  const selectableCurrencies = useMemo(() => {
    if (!isTemporaryCurrency) return pinnedCurrencies;
    return [...pinnedCurrencies, value];
  }, [pinnedCurrencies, value, isTemporaryCurrency]);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  const handleSelect = useCallback(
    (code: CurrencyCode) => {
      onChange(code);
      closeMenu();
    },
    [onChange, closeMenu],
  );

  const handleOpenLibrary = useCallback(() => {
    closeMenu();
    setLibraryOpen(true);
  }, [closeMenu]);

  useEffect(() => {
    if (!menuOpen) return;

    const handlePointerDownOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) return;
      closeMenu();
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu();
    };

    document.addEventListener('pointerdown', handlePointerDownOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDownOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [menuOpen, closeMenu]);

  return (
    <div className={`relative shrink-0 ${className}`}>
      <div ref={menuRef} className="relative z-20">
        <button
          type="button"
          dir="ltr"
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-label={tr('currencyLabel')}
          aria-haspopup="listbox"
          aria-expanded={menuOpen}
          className={`${triggerControlClass} flex items-center gap-1.5 px-2.5 sm:gap-2 sm:px-3 text-sm font-medium tabular-nums active:scale-[0.98] whitespace-nowrap ${
            isTemporaryCurrency
              ? 'border-violet-500/50 text-violet-100 ring-1 ring-violet-500/25'
              : 'hover:brightness-110'
          } ${menuOpen ? 'border-emerald-500/60 ring-2 ring-emerald-500/25' : ''}`}
        >
          <CurrencyFlag countryCode={selectedMeta.countryCode} size="sm" alt={selectedMeta.name} />
          <span className="font-semibold">{selectedMeta.symbol}</span>
          <span className="text-[var(--color-category-5-muted)]">{value}</span>
          <ChevronDown
            className={`h-3.5 w-3.5 shrink-0 text-[var(--color-category-5-muted)] transition-transform duration-200 ${
              menuOpen ? 'rotate-180' : ''
            }`}
            aria-hidden
          />
        </button>

        {menuOpen && (
          <div
            role="listbox"
            aria-label={tr('currencyLabel')}
            dir="ltr"
            className={`absolute top-full start-0 z-30 mt-1.5 w-[min(100vw-2rem,15.5rem)] p-1.5 ${filterDropdownWrapperClass}`}
          >
            <div className="flex flex-wrap gap-1.5">
              {selectableCurrencies.map((code) => {
                const meta = getCurrencyMeta(code);
                const selected = value === code;
                return (
                  <button
                    key={code}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => handleSelect(code)}
                    className={`min-w-[3.25rem] flex-1 basis-[calc(25%-0.5rem)] py-2 rounded-lg text-xs font-semibold tabular-nums transition-all active:scale-[0.98] flex flex-col items-center justify-center ${
                      selected
                        ? primaryActionSelectedChipClass
                        : 'text-[var(--color-category-5-muted)] hover:text-[var(--color-category-5)] hover:bg-white/5'
                    }`}
                  >
                    <CurrencyFlag countryCode={meta.countryCode} size="xs" alt={meta.name} />
                    <span className="block leading-none mt-0.5">{meta.symbol}</span>
                    <span className="block text-[9px] font-medium opacity-80 mt-0.5 leading-none">{code}</span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={handleOpenLibrary}
                aria-label={tr('currencyLibraryTitle')}
                className="min-w-[3.25rem] flex-1 basis-[calc(25%-0.5rem)] py-2 rounded-lg text-xs font-semibold transition-all active:scale-[0.98] border border-dashed border-[var(--surface-input-border)] text-[var(--color-category-5-muted)] hover:text-[var(--color-category-5)] hover:bg-white/5"
              >
                <Plus className="w-4 h-4 mx-auto" strokeWidth={2.25} />
                <span className="block text-[9px] font-medium opacity-80 mt-0.5">+</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <CurrencyLibraryModal
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        mode="expense"
        onExpenseCurrencySelect={(code) => {
          onChange(code);
          setLibraryOpen(false);
        }}
      />
    </div>
  );
}
