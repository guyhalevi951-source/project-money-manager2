import { X } from 'lucide-react';
import { useLanguage } from '../LanguageContext';

interface CommissionSaveModalProps {
  open: boolean;
  onClose: () => void;
  onSave24h: () => void;
  onSaveForever: () => void;
  savingForever: boolean;
  errorMessage: string | null;
}

export default function CommissionSaveModal({
  open,
  onClose,
  onSave24h,
  onSaveForever,
  savingForever,
  errorMessage,
}: CommissionSaveModalProps) {
  const { tr, dir } = useLanguage();

  if (!open) return null;

  return (
    <div
      dir={dir}
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="commission-save-modal-title"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={tr('close')}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />

      <div
        className="relative w-full sm:max-w-md rounded-t-3xl border border-violet-500/25 bg-neutral-900 p-5 shadow-2xl shadow-black/60 sm:rounded-3xl sm:p-6"
        style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
      >
        <div className="mb-1 flex items-start gap-3">
          <h2
            id="commission-save-modal-title"
            className="min-w-0 flex-1 text-base font-bold leading-snug text-neutral-100 sm:text-lg"
          >
            {tr('exchangeRateSaveCommission')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-neutral-500 transition-colors hover:bg-neutral-800 hover:text-neutral-200"
            aria-label={tr('close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-2 text-sm leading-relaxed text-neutral-400">
          {tr('exchangeRateSaveCommissionDesc')}
        </p>

        {errorMessage && <p className="mt-3 text-xs text-rose-300">{errorMessage}</p>}

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[2.75rem] flex-1 rounded-xl border border-neutral-600 bg-neutral-900 px-3.5 text-sm font-medium text-neutral-200 transition-colors hover:bg-neutral-800"
          >
            {tr('cancel')}
          </button>
          <button
            type="button"
            onClick={onSave24h}
            className="min-h-[2.75rem] flex-1 rounded-xl border border-sky-500/40 bg-sky-500/15 px-3.5 text-sm font-medium text-sky-200 transition-colors hover:bg-sky-500/25"
          >
            {tr('exchangeRateSave24h')}
          </button>
          <button
            type="button"
            disabled={savingForever}
            onClick={onSaveForever}
            className="min-h-[2.75rem] flex-1 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3.5 text-sm font-medium text-emerald-200 transition-colors hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {tr('exchangeRateSaveForever')}
          </button>
        </div>
      </div>
    </div>
  );
}
