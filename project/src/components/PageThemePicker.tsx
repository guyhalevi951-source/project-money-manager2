import { useRef, useState } from 'react';
import { Check, Palette } from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import {
  PAGE_THEME_META,
  type PageThemeMode,
} from '../services/buttonThemeService';
import { normalizeCustomHex } from '../categories';
import { themeFloatingHostClass } from '../styles/themeSurfaceStyles';
import AdvancedColorPickerPopover from './AdvancedColorPickerPopover';

interface PageThemePickerProps {
  mode: PageThemeMode;
  customHex: string;
  onModeChange: (mode: PageThemeMode) => void;
  onCustomHexChange: (hex: string) => void;
}

const PAGE_MODES: PageThemeMode[] = ['dark', 'light', 'custom'];

const CONIC_GRADIENT =
  'conic-gradient(from 180deg, #ff0000, #ff8000, #ffff00, #00ff00, #00ffff, #0080ff, #8000ff, #ff0080, #ff0000)';

export default function PageThemePicker({
  mode,
  customHex,
  onModeChange,
  onCustomHexChange,
}: PageThemePickerProps) {
  const { tr, lang } = useLanguage();
  const [customOpen, setCustomOpen] = useState(false);
  const customButtonRef = useRef<HTMLButtonElement>(null);
  const isHe = lang === 'he';
  const normalizedCustom = normalizeCustomHex(customHex);

  return (
    <div className={themeFloatingHostClass}>
      <div
        className="flex flex-wrap gap-2.5"
        role="radiogroup"
        aria-label={tr('profilePageThemeTitle')}
      >
        {PAGE_MODES.slice(0, 2).map((pageMode) => {
          const meta = PAGE_THEME_META[pageMode];
          const selected = mode === pageMode;
          return (
            <button
              key={pageMode}
              type="button"
              role="radio"
              aria-checked={selected}
              title={isHe ? meta.labelHe : meta.labelEn}
              onClick={() => {
                setCustomOpen(false);
                onModeChange(pageMode);
              }}
              className={[
                'relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all sm:h-10 sm:w-10',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40',
                selected
                  ? 'ring-2 ring-white ring-offset-2 ring-offset-[var(--page-surface-muted)] scale-110'
                  : 'opacity-70 hover:opacity-100 hover:scale-105',
              ].join(' ')}
              style={{ backgroundColor: meta.swatch }}
              aria-label={isHe ? meta.labelHe : meta.labelEn}
            >
              {selected && (
                <Check className="h-4 w-4 text-white drop-shadow-md" strokeWidth={3} />
              )}
            </button>
          );
        })}

        <button
          ref={customButtonRef}
          type="button"
          role="radio"
          aria-checked={mode === 'custom'}
          aria-expanded={customOpen}
          title={isHe ? PAGE_THEME_META.custom.labelHe : PAGE_THEME_META.custom.labelEn}
          aria-label={isHe ? PAGE_THEME_META.custom.labelHe : PAGE_THEME_META.custom.labelEn}
          onClick={() => {
            onModeChange('custom');
            setCustomOpen((prev) => !prev);
          }}
          className={[
            'relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all sm:h-10 sm:w-10',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40',
            mode === 'custom' || customOpen
              ? 'ring-2 ring-white ring-offset-2 ring-offset-[var(--page-surface-muted)] scale-110'
              : 'opacity-95 hover:opacity-100 hover:scale-105',
          ].join(' ')}
          style={{
            background: mode === 'custom' ? normalizedCustom : CONIC_GRADIENT,
            boxShadow: mode === 'custom' ? `0 0 12px ${normalizedCustom}66` : undefined,
          }}
        >
          <span className="absolute inset-[3px] flex items-center justify-center rounded-full bg-black/35 backdrop-blur-[1px]">
            {mode === 'custom' ? (
              <Check className="h-4 w-4 text-white drop-shadow-md" strokeWidth={3} />
            ) : (
              <Palette className="h-3.5 w-3.5 text-white/90 drop-shadow" />
            )}
          </span>
        </button>
      </div>

      <AdvancedColorPickerPopover
        open={customOpen}
        color={normalizedCustom}
        onApply={(hex) => {
          onModeChange('custom');
          onCustomHexChange(normalizeCustomHex(hex));
          setCustomOpen(false);
        }}
        onCancel={() => setCustomOpen(false)}
        anchorRef={customButtonRef}
      />
    </div>
  );
}
