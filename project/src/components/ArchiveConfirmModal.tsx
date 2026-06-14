/**
 * Archive Confirmation Modal
 *
 * Shown before explicitly deleting an active manual rate or commission.
 * User picks "Yes, save to archive" (preserves data for future prompts)
 * or "No, delete without saving" (destructive, no archive entry created).
 */

import { Archive, Trash2 } from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import {
  surfaceModalLgClass,
  typographyBodyClass,
  typographyTitleClass,
} from '../styles/themeSurfaceStyles';

interface ArchiveConfirmModalProps {
  open: boolean;
  /** Called when the user chooses "Yes – save to archive then delete". */
  onConfirmArchive: () => void;
  /** Called when the user chooses "No – delete without saving". */
  onConfirmDelete: () => void;
  /** Called if the user dismisses (backdrop click or Escape). */
  onCancel: () => void;
}

export default function ArchiveConfirmModal({
  open,
  onConfirmArchive,
  onConfirmDelete,
  onCancel,
}: ArchiveConfirmModalProps) {
  const { tr, dir } = useLanguage();

  if (!open) return null;

  return (
    <div
      dir={dir}
      className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="archive-confirm-modal-title"
    >
      {/* Backdrop */}
      <button
        type="button"
        onClick={onCancel}
        aria-label={tr('close')}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
      />

      {/* Panel */}
      <div
        className={`relative w-full sm:max-w-sm ${surfaceModalLgClass}`}
        style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
      >
        {/* Icon + title */}
        <div className="flex items-start gap-3 px-5 pt-5 pb-4">
          <Archive className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" aria-hidden />
          <div className="min-w-0 flex-1">
            <h2
              id="archive-confirm-modal-title"
              className={`text-base font-bold leading-snug sm:text-lg ${typographyTitleClass}`}
            >
              {tr('archiveConfirmTitle')}
            </h2>
            <p className={`mt-2 text-sm leading-relaxed ${typographyBodyClass}`}>
              {tr('archiveConfirmBody')}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 px-5 pb-1">
          {/* Yes – archive + delete */}
          <button
            type="button"
            onClick={onConfirmArchive}
            className="inline-flex min-h-[2.75rem] w-full items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/15 px-4 py-2.5 text-sm font-semibold text-amber-300 transition-colors hover:bg-amber-500/25 active:scale-[.98]"
          >
            <Archive className="h-4 w-4 shrink-0" aria-hidden />
            {tr('archiveConfirmYes')}
          </button>

          {/* No – destructive delete */}
          <button
            type="button"
            onClick={onConfirmDelete}
            className="inline-flex min-h-[2.75rem] w-full items-center justify-center gap-2 rounded-xl border border-rose-500/35 bg-rose-500/10 px-4 py-2.5 text-sm font-semibold text-rose-300 transition-colors hover:bg-rose-500/20 active:scale-[.98]"
          >
            <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
            {tr('archiveConfirmNo')}
          </button>
        </div>
      </div>
    </div>
  );
}
