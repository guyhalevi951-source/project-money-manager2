import { Plus, X, Check } from 'lucide-react';
import { ICON_OPTIONS, resolveIcon, DEFAULT_CATEGORY_COLOR } from '../categories';
import CategoryColorPicker from './CategoryColorPicker';
import CategoryColorChip from './CategoryColorChip';
import { useLanguage } from '../LanguageContext';

interface CreateCategoryFormProps {
  name: string;
  onNameChange: (value: string) => void;
  color: string;
  onColorChange: (colorClass: string) => void;
  iconName: string;
  onIconChange: (iconName: string) => void;
  error?: string;
  onSubmit: () => void;
  onCancel: () => void;
}

export default function CreateCategoryForm({
  name,
  onNameChange,
  color,
  onColorChange,
  iconName,
  onIconChange,
  error,
  onSubmit,
  onCancel,
}: CreateCategoryFormProps) {
  const { tr } = useLanguage();
  const PreviewIcon = resolveIcon(iconName);

  return (
    <div className="w-full sm:w-96 max-w-full rounded-2xl border border-emerald-500/30 bg-neutral-800/80 p-5 shadow-lg shadow-black/30 space-y-4">
      <div>
        <label className="block text-xs font-medium text-neutral-300 mb-2">{tr('categoryName')}</label>
        <input
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onSubmit();
            }
          }}
          placeholder={tr('categoryNamePlaceholder')}
          autoFocus
          className="w-full px-4 py-3 rounded-xl bg-neutral-900 border border-neutral-700 text-neutral-100 placeholder-neutral-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 outline-none transition-all text-base"
        />
      </div>

      <CategoryColorPicker value={color} onChange={onColorChange} />

      <div>
        <label className="block text-xs font-medium text-neutral-300 mb-2">{tr('icon')}</label>
        <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
          {ICON_OPTIONS.map((o) => {
            const IconComp = o.icon;
            const selected = iconName === o.name;
            return (
              <button
                key={o.name}
                type="button"
                onClick={() => onIconChange(o.name)}
                aria-label={o.name}
                aria-pressed={selected}
                className={`relative w-11 h-11 rounded-xl flex items-center justify-center transition-all active:scale-95 ${
                  selected
                    ? 'bg-emerald-500 text-white ring-2 ring-emerald-400 ring-offset-2 ring-offset-neutral-900'
                    : 'bg-neutral-900 text-neutral-400 border border-neutral-700 hover:border-emerald-500/60 hover:text-emerald-400'
                }`}
              >
                <IconComp className="w-5 h-5" />
                {selected && (
                  <span className="absolute -top-1 -end-1 w-4 h-4 rounded-full bg-white flex items-center justify-center shadow">
                    <Check className="w-2.5 h-2.5 text-emerald-600" strokeWidth={3} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-neutral-700/80">
        <span className="text-xs text-neutral-400 w-full sm:w-auto">{tr('preview')}</span>
        <CategoryColorChip color={color || DEFAULT_CATEGORY_COLOR} icon={PreviewIcon}>
          {name.trim() || tr('newCategory')}
        </CategoryColorChip>
      </div>

      {error && <p className="text-rose-400 text-xs">{error}</p>}

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={onSubmit}
          className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-4 py-3 rounded-xl text-sm font-semibold hover:from-emerald-600 hover:to-teal-700 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          {tr('addCategory')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="shrink-0 text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 p-3 rounded-xl border border-neutral-700 hover:border-rose-500/40 transition-all"
          title={tr('cancel')}
          aria-label={tr('cancel')}
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
