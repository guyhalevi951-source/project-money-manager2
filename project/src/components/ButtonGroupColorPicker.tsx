import { useRef, useState } from 'react';
import { Check, Palette } from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import {
  ALL_PRESETS,
  isCustomColorChoice,
  type ButtonGroupKey,
} from '../services/buttonThemeService';
import { normalizeCustomHex } from '../categories';
import AdvancedColorPickerPopover from './AdvancedColorPickerPopover';

interface ButtonGroupColorPickerProps {
  group: ButtonGroupKey;
  value: string;
  onChange: (choice: string) => void;
}

const CONIC_GRADIENT =
  'conic-gradient(from 180deg, #ff0000, #ff8000, #ffff00, #00ff00, #00ffff, #0080ff, #8000ff, #ff0080, #ff0000)';

export default function ButtonGroupColorPicker({
  group,
  value,
  onChange,
}: ButtonGroupColorPickerProps) {
  const { lang } = useLanguage();
  const [customOpen, setCustomOpen] = useState(false);
  const customButtonRef = useRef<HTMLButtonElement>(null);
  const presets = ALL_PRESETS[group];
  const customSelected = isCustomColorChoice(value);
  const customHex = customSelected
    ? normalizeCustomHex(value)
    : Object.values(presets)[0]?.swatch ?? '#6366F1';
  const isHe = lang === 'he';

  return (
    <div className="relative">
      <div
        className="flex flex-wrap gap-2.5"
        role="radiogroup"
        aria-label={isHe ? 'בחירת צבע' : 'Color choice'}
      >
        {Object.values(presets).map((preset) => {
          const selected = value === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              role="radio"
              aria-checked={selected}
              title={isHe ? preset.labelHe : preset.labelEn}
              onClick={() => {
                setCustomOpen(false);
                onChange(preset.id);
              }}
              className={[
                'group relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all sm:h-10 sm:w-10',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40',
                selected
                  ? 'ring-2 ring-white ring-offset-2 ring-offset-[var(--page-surface-muted)] scale-110'
                  : 'opacity-70 hover:opacity-100 hover:scale-105',
              ].join(' ')}
              style={{ backgroundColor: preset.swatch }}
              aria-label={isHe ? preset.labelHe : preset.labelEn}
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
          aria-checked={customSelected}
          aria-expanded={customOpen}
          title={isHe ? 'בחירת צבע חופשית' : 'Free color picker'}
          aria-label={isHe ? 'בחירת צבע חופשית' : 'Free color picker'}
          onClick={() => setCustomOpen((prev) => !prev)}
          className={[
            'relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all sm:h-10 sm:w-10',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40',
            customSelected || customOpen
              ? 'ring-2 ring-white ring-offset-2 ring-offset-[var(--page-surface-muted)] scale-110'
              : 'opacity-95 hover:opacity-100 hover:scale-105',
          ].join(' ')}
          style={{
            background: CONIC_GRADIENT,
            boxShadow: customSelected ? `0 0 12px ${customHex}66` : undefined,
          }}
        >
          <span className="absolute inset-[3px] flex items-center justify-center rounded-full bg-black/35 backdrop-blur-[1px]">
            {customSelected ? (
              <Check className="h-4 w-4 text-white drop-shadow-md" strokeWidth={3} />
            ) : (
              <Palette className="h-3.5 w-3.5 text-white/90 drop-shadow" />
            )}
          </span>
        </button>
      </div>

      <AdvancedColorPickerPopover
        open={customOpen}
        color={customSelected ? customHex : Object.values(presets)[0]?.swatch ?? '#6366F1'}
        onApply={(hex) => {
          onChange(normalizeCustomHex(hex));
          setCustomOpen(false);
        }}
        onCancel={() => setCustomOpen(false)}
        anchorRef={customButtonRef}
      />
    </div>
  );
}
