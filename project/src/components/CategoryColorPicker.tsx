import { useRef, useState } from 'react';
import { Check, Palette } from 'lucide-react';
import {
  THEME_COLOR_PRESETS,
  hexForColor,
  isCustomHexColor,
  normalizeCustomHex,
} from '../categories';
import { useLanguage } from '../LanguageContext';
import { localizeColorName } from '../translations';
import AdvancedColorPickerPopover from './AdvancedColorPickerPopover';

interface CategoryColorPickerProps {
  value: string;
  onChange: (colorValue: string) => void;
  label?: string;
}

const CONIC_GRADIENT =
  'conic-gradient(from 180deg, #ff0000, #ff8000, #ffff00, #00ff00, #00ffff, #0080ff, #8000ff, #ff0080, #ff0000)';

export default function CategoryColorPicker({ value, onChange, label }: CategoryColorPickerProps) {
  const { lang, tr } = useLanguage();
  const [customOpen, setCustomOpen] = useState(false);
  const customButtonRef = useRef<HTMLButtonElement>(null);
  const resolvedLabel = label ?? tr('color');
  const customSelected = isCustomHexColor(value);
  const customHex = customSelected ? normalizeCustomHex(value) : hexForColor(THEME_COLOR_PRESETS[0].class);

  return (
    <div className="relative">
      <label className="block text-xs font-medium text-neutral-300 mb-2">{resolvedLabel}</label>
      <div className="flex flex-wrap items-center gap-2">
        {THEME_COLOR_PRESETS.map((preset) => {
          const selected = value === preset.class;
          const hex = hexForColor(preset.class);
          return (
            <button
              key={preset.class}
              type="button"
              onClick={() => {
                setCustomOpen(false);
                onChange(preset.class);
              }}
              title={localizeColorName(preset.name, lang)}
              aria-label={localizeColorName(preset.name, lang)}
              aria-pressed={selected}
              className={`relative shrink-0 w-10 h-10 rounded-full transition-all duration-200 active:scale-95 ${
                selected
                  ? 'ring-2 ring-white ring-offset-2 ring-offset-neutral-900'
                  : 'opacity-90 hover:opacity-100 hover:ring-1 hover:ring-white/40'
              }`}
              style={{
                backgroundColor: hex,
                boxShadow: selected ? `0 0 12px ${hex}66` : undefined,
              }}
            >
              {selected && (
                <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <Check className="w-4 h-4 text-white drop-shadow-md" strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}

        <button
          ref={customButtonRef}
          type="button"
          onClick={() => setCustomOpen((prev) => !prev)}
          title={tr('customColorAdvanced')}
          aria-label={tr('customColorAdvanced')}
          aria-expanded={customOpen}
          aria-pressed={customSelected}
          className={`relative shrink-0 w-10 h-10 rounded-full transition-all duration-200 active:scale-95 ${
            customSelected || customOpen
              ? 'ring-2 ring-white ring-offset-2 ring-offset-neutral-900'
              : 'opacity-95 hover:opacity-100 hover:ring-1 hover:ring-white/40'
          }`}
          style={{
            background: CONIC_GRADIENT,
            boxShadow: customSelected ? `0 0 12px ${customHex}66` : undefined,
          }}
        >
          <span className="absolute inset-[3px] rounded-full bg-neutral-950/35 backdrop-blur-[1px] flex items-center justify-center">
            {customSelected ? (
              <Check className="w-4 h-4 text-white drop-shadow-md" strokeWidth={3} />
            ) : (
              <Palette className="w-3.5 h-3.5 text-white/90 drop-shadow" />
            )}
          </span>
        </button>
      </div>

      <AdvancedColorPickerPopover
        open={customOpen}
        color={customSelected ? customHex : hexForColor(value)}
        onApply={(hex) => {
          onChange(hex);
          setCustomOpen(false);
        }}
        onCancel={() => setCustomOpen(false)}
        anchorRef={customButtonRef}
      />
    </div>
  );
}
