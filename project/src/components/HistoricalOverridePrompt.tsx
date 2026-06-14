/**
 * Inline confirmation banner shown when the user picks a past date + currency
 * that has archived historical rate/fee override(s).
 *
 * Appears between the Date field and the Submit button in both the Add Expense
 * form and the Edit Expense modal.
 */

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { History } from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import { formatTranslation } from '../translations';
import {
  resolveBannerCheckboxDefaults,
  type HistoricalOverrideAutomationApplyMode,
  type HistoricalOverrideBannerContext,
  type HistoricalOverrideBannerOptions,
} from '../services/historicalOverrideService';
import {
  primaryActionButtonSemiboldClass,
  utilityNavCompactButtonClass,
} from '../styles/actionButtonStyles';
import { themeTextMutedClass } from '../styles/themeSurfaceStyles';

/** User choice when historical rate and/or fee are available. */
export type HistoricalOverrideApplyChoice = HistoricalOverrideAutomationApplyMode;

export type HistoricalOverridePromptMode = 'rateOnly' | 'feeOnly' | 'both';

export function resolveHistoricalOverridePromptMode(
  context: HistoricalOverrideBannerContext,
): HistoricalOverridePromptMode | null {
  const hasRate =
    context.rateEntry != null && context.rateEntry.manualRate != null && context.rateEntry.manualRate > 0;
  const hasFee =
    context.feeEntry != null &&
    context.feeEntry.feePercent != null &&
    context.feeEntry.feePercent > 0;

  if (hasRate && hasFee) return 'both';
  if (hasFee) return 'feeOnly';
  if (hasRate) return 'rateOnly';
  return null;
}

type HistoricalOverridePromptProps = {
  context: HistoricalOverrideBannerContext;
  onChoice: (
    choice: HistoricalOverrideApplyChoice,
    options: HistoricalOverrideBannerOptions,
  ) => void;
  /** Live checkbox state for parent submit handler (automation persist without re-clicking buttons). */
  onOptionsChange?: (options: HistoricalOverrideBannerOptions) => void;
};

function HistoricalOverrideAutomationCheckboxes({
  applyAutomatically,
  hideBannerPermanently,
  onApplyAutomaticallyChange,
  onHideBannerChange,
}: {
  applyAutomatically: boolean;
  hideBannerPermanently: boolean;
  onApplyAutomaticallyChange: (checked: boolean) => void;
  onHideBannerChange: (checked: boolean) => void;
}) {
  const { tr } = useLanguage();

  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-amber-500/15 pt-3">
      <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-snug text-amber-100/90">
        <input
          type="checkbox"
          checked={applyAutomatically}
          onChange={(e) => onApplyAutomaticallyChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-amber-500/40 bg-black/20 text-amber-400 focus:ring-amber-500/30"
        />
        <span>{tr('historicalOverridePromptSaveForFuture')}</span>
      </label>
      <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-snug text-amber-100/90">
        <input
          type="checkbox"
          checked={hideBannerPermanently}
          onChange={(e) => onHideBannerChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-amber-500/40 bg-black/20 text-amber-400 focus:ring-amber-500/30"
        />
        <span>{tr('historicalOverridePromptHideBanner')}</span>
      </label>
    </div>
  );
}

export default function HistoricalOverridePrompt({
  context,
  onChoice,
  onOptionsChange,
}: HistoricalOverridePromptProps) {
  const { tr, lang } = useLanguage();

  const mode = resolveHistoricalOverridePromptMode(context);
  const checkboxDefaults = useMemo(() => resolveBannerCheckboxDefaults(context), [context]);
  const [applyAutomatically, setApplyAutomatically] = useState(checkboxDefaults.applyAutomatically);
  const [hideBannerPermanently, setHideBannerPermanently] = useState(
    checkboxDefaults.hideBannerPermanently,
  );

  useEffect(() => {
    setApplyAutomatically(checkboxDefaults.applyAutomatically);
    setHideBannerPermanently(checkboxDefaults.hideBannerPermanently);
  }, [checkboxDefaults]);

  useEffect(() => {
    onOptionsChange?.({
      applyAutomatically,
      hideBannerPermanently,
    });
  }, [applyAutomatically, hideBannerPermanently, onOptionsChange]);

  if (!mode) return null;

  const bannerOptions: HistoricalOverrideBannerOptions = {
    applyAutomatically,
    hideBannerPermanently,
  };

  const promptText =
    mode === 'both'
      ? tr('historicalOverridePromptBothMatrixText')
      : mode === 'feeOnly'
        ? tr('historicalOverridePromptFeeOnlyText')
        : formatTranslation(lang, 'historicalOverridePromptText', {
            what: tr('historicalOverridePromptManualRate'),
          });

  const dismissLabel =
    mode === 'feeOnly' ? tr('historicalOverridePromptDismissFee') : tr('historicalOverridePromptDismiss');

  const handleChoice = (choice: HistoricalOverrideApplyChoice) => {
    // Form injection is handled by the parent onChoice; checkboxes only affect persisted flags.
    onChoice(choice, bannerOptions);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      role="alertdialog"
      aria-labelledby="historical-override-title"
      className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3.5 py-3 shadow-sm shadow-black/20"
    >
      <p
        id="historical-override-title"
        className="flex items-start gap-2 text-sm leading-snug text-amber-100/95"
      >
        <History className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden />
        <span>{promptText}</span>
      </p>

      <HistoricalOverrideAutomationCheckboxes
        applyAutomatically={applyAutomatically}
        hideBannerPermanently={hideBannerPermanently}
        onApplyAutomaticallyChange={setApplyAutomatically}
        onHideBannerChange={setHideBannerPermanently}
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {mode === 'both' ? (
          <>
            <button
              type="button"
              onClick={() => handleChoice('both')}
              className={`rounded-lg px-3.5 py-2 text-xs sm:text-sm ${primaryActionButtonSemiboldClass}`}
            >
              {tr('historicalOverridePromptApplyBoth')}
            </button>
            <button
              type="button"
              onClick={() => handleChoice('rateOnly')}
              className={`rounded-lg px-3.5 py-2 text-xs sm:text-sm ${utilityNavCompactButtonClass}`}
            >
              {tr('historicalOverridePromptApplyRateOnly')}
            </button>
            <button
              type="button"
              onClick={() => handleChoice('feeOnly')}
              className={`rounded-lg px-3.5 py-2 text-xs sm:text-sm ${utilityNavCompactButtonClass}`}
            >
              {tr('historicalOverridePromptApplyFeeOnly')}
            </button>
            <button
              type="button"
              onClick={() => handleChoice('none')}
              className={`rounded-lg px-3.5 py-2 text-xs sm:text-sm font-medium transition-all active:scale-[0.98] hover:text-neutral-200 hover:bg-white/10 ${themeTextMutedClass}`}
            >
              {tr('historicalOverridePromptApplyNone')}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => handleChoice(mode === 'feeOnly' ? 'feeOnly' : 'rateOnly')}
              className={`rounded-lg px-3.5 py-2 text-xs sm:text-sm ${primaryActionButtonSemiboldClass}`}
            >
              {tr('historicalOverridePromptApply')}
            </button>
            <button
              type="button"
              onClick={() => handleChoice('none')}
              className={`rounded-lg px-3.5 py-2 text-xs sm:text-sm font-medium transition-all active:scale-[0.98] hover:text-neutral-200 hover:bg-white/10 ${themeTextMutedClass}`}
            >
              {dismissLabel}
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
}
