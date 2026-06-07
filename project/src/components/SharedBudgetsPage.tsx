import { Plus, Users } from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import { utilityNavButtonLgClass } from '../styles/actionButtonStyles';
import { themeTextMutedClass, typographyTitleClass } from '../styles/themeSurfaceStyles';

export default function SharedBudgetsPage() {
  const { tr } = useLanguage();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div>
        <h1 className={`text-xl font-bold sm:text-2xl ${typographyTitleClass}`}>
          {tr('sharedBudgetsTitle')}
        </h1>
        <p className={`mt-1 text-sm ${themeTextMutedClass}`}>{tr('sharedBudgetsSubtitle')}</p>
      </div>

      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-600 bg-neutral-900/30 px-6 py-14 text-center">
        <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-violet-500/15 text-violet-400">
          <Users className="h-7 w-7" />
        </span>
        <p className={`max-w-sm text-sm ${themeTextMutedClass}`}>{tr('sharedBudgetsEmpty')}</p>
        <button
          type="button"
          disabled
          className={`mt-6 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm opacity-50 ${utilityNavButtonLgClass}`}
        >
          <Plus className="h-4 w-4" />
          {tr('sharedBudgetsAddJoin')}
        </button>
      </div>
    </div>
  );
}
