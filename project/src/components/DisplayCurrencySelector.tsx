import { memo, useCallback, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, X } from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import { usePinnedCurrencies } from '../hooks/usePinnedCurrencies';
import {
  CORE_CURRENCY_CODES,
  getCurrencyMeta,
  isCoreCurrency,
  type CoreCurrencyCode,
  type CurrencyCode,
} from '../constants/currencies';
import CurrencyLibraryModal from './CurrencyLibraryModal';

const DEFAULT_DISPLAY_CURRENCY: CoreCurrencyCode = 'ILS';

function CurrencyPinSaveConfirmModal({
  open,
  onConfirm,
  onDiscard,
}: {
  open: boolean;
  onConfirm: () => void;
  onDiscard: () => void;
}) {
  const { tr, dir } = useLanguage();

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4"
        role="presentation"
      >
        <button
          type="button"
          aria-label={tr('close')}
          className="absolute inset-0 bg-black/65 backdrop-blur-sm"
          onClick={onDiscard}
        />

        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          dir={dir}
          role="dialog"
          aria-modal="true"
          aria-labelledby="currency-pin-save-title"
          className="relative w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl border border-gray-700/80 bg-gray-900/95 backdrop-blur-xl shadow-2xl shadow-black/50 p-5 sm:p-6"
        >
          <p id="currency-pin-save-title" className="text-base sm:text-lg font-semibold text-white leading-relaxed">
            {tr('currencySavePinnedConfirm')}
          </p>

          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={onDiscard}
              className="px-4 py-3 rounded-xl text-sm font-medium text-gray-200 border border-gray-600/80 bg-gray-950/50 hover:bg-gray-800/80 hover:text-white transition-all active:scale-[0.98]"
            >
              {tr('currencyConfirmDiscard')}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="px-4 py-3 rounded-xl text-sm font-semibold text-white border border-emerald-400/50 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-md shadow-emerald-500/20 transition-all active:scale-[0.98]"
            >
              {tr('currencyConfirmSave')}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function DisplayCurrencySelector() {
  const {
    tr,
    displayCurrency,
    setDisplayCurrency,
    customCurrencies,
    replaceCustomCurrencies,
  } = useLanguage();

  const pinnedCurrenciesFromContext = usePinnedCurrencies();

  const [libraryOpen, setLibraryOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [tempCustomCurrencies, setTempCustomCurrencies] = useState<CurrencyCode[]>([]);
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);

  const stagedCustomCurrencies = editMode ? tempCustomCurrencies : customCurrencies;

  const pinnedCurrencies = useMemo(() => {
    if (!editMode) return pinnedCurrenciesFromContext;
    const core = [...CORE_CURRENCY_CODES];
    const extra = stagedCustomCurrencies.filter(
      (code) => !core.includes(code as CoreCurrencyCode),
    );
    return [...core, ...extra] as CurrencyCode[];
  }, [editMode, pinnedCurrenciesFromContext, stagedCustomCurrencies]);

  const isTemporarySelection = useMemo(
    () => !pinnedCurrencies.includes(displayCurrency),
    [displayCurrency, pinnedCurrencies],
  );

  const handleEnterEditMode = useCallback(() => {
    setTempCustomCurrencies([...customCurrencies]);
    setEditMode(true);
  }, [customCurrencies]);

  const handleFinishEditMode = useCallback(() => {
    setSaveConfirmOpen(true);
  }, []);

  const handleDiscardChanges = useCallback(() => {
    setSaveConfirmOpen(false);
    setEditMode(false);
    setTempCustomCurrencies([]);
  }, []);

  const handleConfirmSave = useCallback(() => {
    const nextCustom = [...tempCustomCurrencies];
    const removedActivePinned =
      customCurrencies.includes(displayCurrency) &&
      !nextCustom.includes(displayCurrency) &&
      !isCoreCurrency(displayCurrency);

    replaceCustomCurrencies(nextCustom);

    if (removedActivePinned) {
      setDisplayCurrency(DEFAULT_DISPLAY_CURRENCY);
    }

    setSaveConfirmOpen(false);
    setEditMode(false);
    setTempCustomCurrencies([]);
  }, [
    tempCustomCurrencies,
    customCurrencies,
    displayCurrency,
    replaceCustomCurrencies,
    setDisplayCurrency,
  ]);

  const handleRemoveCustom = useCallback((code: CurrencyCode, event: React.MouseEvent) => {
    event.stopPropagation();
    setTempCustomCurrencies((prev) => prev.filter((item) => item !== code));
  }, []);

  const handleSelect = useCallback(
    (code: CurrencyCode) => {
      if (editMode) return;
      setDisplayCurrency(code);
    },
    [editMode, setDisplayCurrency],
  );

  const handleToggleEditMode = useCallback(() => {
    if (editMode) {
      handleFinishEditMode();
    } else {
      handleEnterEditMode();
    }
  }, [editMode, handleEnterEditMode, handleFinishEditMode]);

  return (
    <>
      <div className="flex items-center justify-end mb-3">
        <button
          type="button"
          onClick={handleToggleEditMode}
          aria-pressed={editMode}
          className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium border transition-all active:scale-[0.98] ${
            editMode
              ? 'border-amber-400/50 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25'
              : 'border-gray-600/80 bg-gray-950/50 text-gray-300 hover:text-white hover:bg-gray-800/80 hover:border-gray-500'
          }`}
        >
          {editMode ? tr('currencyFinishEditMode') : tr('currencyEditMode')}
        </button>
      </div>

      {isTemporarySelection && !editMode && (
        <div
          dir="ltr"
          className="mb-3 rounded-xl border border-violet-500/30 bg-violet-500/10 px-3.5 py-2.5 text-sm text-violet-100"
        >
          <span className="font-medium tabular-nums">{displayCurrency}</span>
          <span className="text-violet-200/90"> — {getCurrencyMeta(displayCurrency).name}</span>
          <span className="block text-xs text-violet-300/80 mt-0.5">{tr('currencyTemporaryActive')}</span>
        </div>
      )}

      <motion.div
        layout
        dir="ltr"
        className={`flex flex-wrap gap-1.5 sm:gap-2 rounded-2xl bg-gray-950/80 border p-1.5 sm:p-2 transition-colors duration-200 ${
          editMode ? 'border-amber-500/40 ring-1 ring-amber-500/20' : 'border-gray-700'
        }`}
      >
        {pinnedCurrencies.map((code) => {
          const meta = getCurrencyMeta(code);
          const selected = !editMode && displayCurrency === code;
          const isCustom = !isCoreCurrency(code);
          const showRemove = editMode && isCustom;

          return (
            <div
              key={code}
              className="relative min-w-[4.25rem] flex-1 basis-[calc(25%-0.5rem)] sm:basis-[calc(20%-0.5rem)]"
            >
              {showRemove && (
                <button
                  type="button"
                  aria-label={`${tr('cancel')} ${code}`}
                  onClick={(event) => handleRemoveCustom(code, event)}
                  className="absolute -top-1.5 -end-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full border border-gray-600/90 bg-gray-900 text-gray-300 shadow-md shadow-black/40 hover:bg-red-500/90 hover:border-red-400/80 hover:text-white transition-all active:scale-90"
                >
                  <X className="h-3 w-3" strokeWidth={2.75} />
                </button>
              )}

              <button
                type="button"
                onClick={() => handleSelect(code)}
                disabled={editMode}
                className={`w-full py-3 sm:py-3.5 rounded-xl text-sm sm:text-base font-semibold tabular-nums transition-all ${
                  editMode
                    ? 'cursor-default opacity-95 text-gray-200 bg-gray-800/60'
                    : `active:scale-[0.98] ${
                        selected
                          ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
                          : 'text-gray-300 hover:text-white hover:bg-gray-800/80'
                      }`
                } ${showRemove ? 'ring-1 ring-amber-500/25' : ''}`}
                aria-pressed={selected}
              >
                <span className="block">{meta.symbol}</span>
                <span className="block text-[10px] sm:text-xs font-medium opacity-80 mt-0.5">{code}</span>
              </button>
            </div>
          );
        })}

        {!editMode && (
          <button
            type="button"
            onClick={() => setLibraryOpen(true)}
            aria-label={tr('currencyLibraryTitle')}
            className={`min-w-[4.25rem] flex-1 basis-[calc(25%-0.5rem)] sm:basis-[calc(20%-0.5rem)] py-3 sm:py-3.5 rounded-xl text-sm sm:text-base font-semibold transition-all active:scale-[0.98] border border-dashed ${
              libraryOpen
                ? 'border-emerald-400/60 bg-emerald-500/10 text-emerald-300'
                : 'border-gray-600/80 text-gray-300 hover:text-white hover:bg-gray-800/80 hover:border-gray-500'
            }`}
          >
            <Plus className="w-5 h-5 sm:w-6 sm:h-6 mx-auto" strokeWidth={2.25} />
            <span className="block text-[10px] sm:text-xs font-medium opacity-80 mt-0.5">+</span>
          </button>
        )}
      </motion.div>

      <CurrencyLibraryModal open={libraryOpen} onClose={() => setLibraryOpen(false)} mode="display" />

      <CurrencyPinSaveConfirmModal
        open={saveConfirmOpen}
        onConfirm={handleConfirmSave}
        onDiscard={handleDiscardChanges}
      />
    </>
  );
}

export default memo(DisplayCurrencySelector);
