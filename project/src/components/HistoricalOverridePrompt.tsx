/**
 * Inline confirmation banner shown when the user picks a past date + currency
 * that has archived historical rate/fee override(s).
 *
 * Appears between the Date field and the Submit button in both the Add Expense
 * form and the Edit Expense modal.
 */

import { motion } from 'framer-motion';
import { History } from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import { formatTranslation } from '../translations';
import { type HistoricalOverrideEntry } from '../services/historicalOverrideService';
import {
  primaryActionButtonSemiboldClass,
  utilityNavCompactButtonClass,
} from '../styles/actionButtonStyles';
import { themeTextMutedClass } from '../styles/themeSurfaceStyles';

/** User choice when both historical rate and fee are available. */
export type HistoricalOverrideApplyChoice = 'both' | 'rateOnly' | 'feeOnly' | 'none';

/** Split lookup result for rate vs fee archived overrides. */
export interface HistoricalOverrideBannerContext {
  rateEntry: HistoricalOverrideEntry | null;
  feeEntry: HistoricalOverrideEntry | null;
}

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

type HistoricalOverridePromptProps =
  | {
      /** Legacy single-entry prompt (edit expense modal). */
      entry: HistoricalOverrideEntry;
      onApply: () => void;
      onDismiss: () => void;
      context?: never;
      onChoice?: never;
    }
  | {
      /** Split rate/fee context (new expense form). */
      context: HistoricalOverrideBannerContext;
      onChoice: (choice: HistoricalOverrideApplyChoice) => void;
      entry?: never;
      onApply?: never;
      onDismiss?: never;
    };

export default function HistoricalOverridePrompt(props: HistoricalOverridePromptProps) {
  const { tr, lang } = useLanguage();

  if (props.entry) {
    return <LegacyHistoricalOverridePrompt entry={props.entry} onApply={props.onApply} onDismiss={props.onDismiss} />;
  }

  const { context, onChoice } = props;
  const mode = resolveHistoricalOverridePromptMode(context);
  if (!mode) return null;

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

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {mode === 'both' ? (
          <>
            <button
              type="button"
              onClick={() => onChoice('both')}
              className={`rounded-lg px-3.5 py-2 text-xs sm:text-sm ${primaryActionButtonSemiboldClass}`}
            >
              {tr('historicalOverridePromptApplyBoth')}
            </button>
            <button
              type="button"
              onClick={() => onChoice('rateOnly')}
              className={`rounded-lg px-3.5 py-2 text-xs sm:text-sm ${utilityNavCompactButtonClass}`}
            >
              {tr('historicalOverridePromptApplyRateOnly')}
            </button>
            <button
              type="button"
              onClick={() => onChoice('feeOnly')}
              className={`rounded-lg px-3.5 py-2 text-xs sm:text-sm ${utilityNavCompactButtonClass}`}
            >
              {tr('historicalOverridePromptApplyFeeOnly')}
            </button>
            <button
              type="button"
              onClick={() => onChoice('none')}
              className={`rounded-lg px-3.5 py-2 text-xs sm:text-sm font-medium transition-all active:scale-[0.98] hover:text-neutral-200 hover:bg-white/10 ${themeTextMutedClass}`}
            >
              {tr('historicalOverridePromptApplyNone')}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() =>
                onChoice(mode === 'feeOnly' ? 'feeOnly' : 'rateOnly')
              }
              className={`rounded-lg px-3.5 py-2 text-xs sm:text-sm ${primaryActionButtonSemiboldClass}`}
            >
              {tr('historicalOverridePromptApply')}
            </button>
            <button
              type="button"
              onClick={() => onChoice('none')}
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

function LegacyHistoricalOverridePrompt({
  entry,
  onApply,
  onDismiss,
}: {
  entry: HistoricalOverrideEntry;
  onApply: () => void;
  onDismiss: () => void;
}) {
  const { tr, lang } = useLanguage();

  const hasRate = entry.manualRate != null && entry.manualRate > 0;
  const hasFee = entry.feePercent != null && entry.feePercent > 0;

  let whatKey: 'historicalOverridePromptManualRate' | 'historicalOverridePromptFee' | 'historicalOverridePromptBoth';
  if (hasRate && hasFee) whatKey = 'historicalOverridePromptBoth';
  else if (hasFee) whatKey = 'historicalOverridePromptFee';
  else whatKey = 'historicalOverridePromptManualRate';

  const what = tr(whatKey);
  const promptText = formatTranslation(lang, 'historicalOverridePromptText', { what });

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      role="alertdialog"
      aria-labelledby="historical-override-title-legacy"
      className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3.5 py-3 shadow-sm shadow-black/20"
    >
      <p
        id="historical-override-title-legacy"
        className="flex items-start gap-2 text-sm leading-snug text-amber-100/95"
      >
        <History className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden />
        <span>{promptText}</span>
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onApply}
          className={`rounded-lg px-3.5 py-2 text-xs sm:text-sm ${primaryActionButtonSemiboldClass}`}
        >
          {tr('historicalOverridePromptApply')}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className={`rounded-lg px-3.5 py-2 text-xs sm:text-sm font-medium transition-all active:scale-[0.98] hover:text-neutral-200 hover:bg-white/10 ${themeTextMutedClass}`}
        >
          {hasFee && !hasRate ? tr('historicalOverridePromptDismissFee') : tr('historicalOverridePromptDismiss')}
        </button>
      </div>
    </motion.div>
  );
}
