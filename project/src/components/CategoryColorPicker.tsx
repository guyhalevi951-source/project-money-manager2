import { Check } from 'lucide-react';
import { COLOR_OPTIONS, hexForColor } from '../categories';
import { useLanguage } from '../LanguageContext';
import { localizeColorName } from '../translations';

interface CategoryColorPickerProps {
  value: string;
  onChange: (colorClass: string) => void;
  label?: string;
}

export default function CategoryColorPicker({
  value,
  onChange,
  label,
}: CategoryColorPickerProps) {
  const { lang, tr } = useLanguage();
  const resolvedLabel = label ?? tr('color');

  return (
    <div>
      <label className="block text-xs font-medium text-neutral-300 mb-2">{resolvedLabel}</label>
      <div className="flex flex-wrap gap-2">
        {COLOR_OPTIONS.map((c) => {
          const selected = value === c.class;
          const hex = hexForColor(c.class);
          return (
            <button
              key={c.class}
              type="button"
              onClick={() => onChange(c.class)}
              title={localizeColorName(c.name, lang)}
              aria-label={localizeColorName(c.name, lang)}
              aria-pressed={selected}
              className={`relative shrink-0 w-10 h-10 rounded-full ${c.class} transition-all duration-200 active:scale-95 ${
                selected
                  ? 'ring-2 ring-white ring-offset-2 ring-offset-neutral-900'
                  : 'opacity-90 hover:opacity-100 hover:ring-1 hover:ring-white/40'
              }`}
              style={
                selected ? { boxShadow: `0 0 12px ${hex}66` } : undefined
              }
            >
              {selected && (
                <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <Check className="w-4 h-4 text-white drop-shadow-md" strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
