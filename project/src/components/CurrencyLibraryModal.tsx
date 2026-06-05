import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, X } from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import {
  filterLibraryCurrencies,
  getCurrencyMeta,
  type CurrencyCode,
} from '../constants/currencies';
import CurrencyFlag from './CurrencyFlag';
import { primaryActionButtonBorderedClass, utilityNavButtonLgClass } from '../styles/actionButtonStyles';

export type CurrencyLibraryMode = 'display' | 'expense';

export interface CurrencyLibraryModalProps {
  open: boolean;
  onClose: () => void;
  /** Where the modal was opened from — controls confirm action behavior. */
  mode?: CurrencyLibraryMode;
  /** Called when a currency is chosen in `expense` mode (temporary or pinned). */
  onExpenseCurrencySelect?: (code: CurrencyCode) => void;
}

type Step = 'list' | 'confirm';

export default function CurrencyLibraryModal({
  open,
  onClose,
  mode = 'display',
  onExpenseCurrencySelect,
}: CurrencyLibraryModalProps) {
  const { tr, setDisplayCurrency, addCustomCurrency } = useLanguage();
  const [step, setStep] = useState<Step>('list');
  const [selectedCode, setSelectedCode] = useState<CurrencyCode | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!open) {
      setStep('list');
      setSelectedCode(null);
      setSearchQuery('');
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (step === 'confirm') {
          setStep('list');
          setSelectedCode(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, step]);

  const filteredCurrencies = useMemo(
    () => filterLibraryCurrencies(searchQuery),
    [searchQuery],
  );

  const selectedMeta = useMemo(
    () => (selectedCode ? getCurrencyMeta(selectedCode) : null),
    [selectedCode],
  );

  const handleSelectCurrency = useCallback((code: CurrencyCode) => {
    setSelectedCode(code);
    setStep('confirm');
  }, []);

  const handleUseTemporarily = useCallback(() => {
    if (!selectedCode) return;

    if (mode === 'expense') {
      onExpenseCurrencySelect?.(selectedCode);
    } else {
      setDisplayCurrency(selectedCode);
    }

    onClose();
  }, [selectedCode, mode, onExpenseCurrencySelect, setDisplayCurrency, onClose]);

  const handleAddToInterface = useCallback(() => {
    if (!selectedCode) return;

    addCustomCurrency(selectedCode);

    if (mode === 'expense') {
      onExpenseCurrencySelect?.(selectedCode);
    }

    onClose();
  }, [selectedCode, mode, addCustomCurrency, onExpenseCurrencySelect, onClose]);

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
        role="presentation"
        onClick={onClose}
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-hidden="true" />

        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.98 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="currency-library-title"
          className="relative w-full sm:max-w-lg max-h-[min(88vh,680px)] flex flex-col rounded-t-2xl sm:rounded-2xl border border-gray-700/80 bg-gray-900/95 backdrop-blur-xl shadow-2xl shadow-black/50"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-4 border-b border-gray-700/60 shrink-0">
            <div className="min-w-0">
              <h2 id="currency-library-title" className="text-base sm:text-lg font-semibold text-white">
                {tr('currencyLibraryTitle')}
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {mode === 'expense' ? tr('currencyLibrarySubtitleExpense') : tr('currencyLibrarySubtitle')}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 w-10 h-10 flex items-center justify-center rounded-xl border border-gray-600/80 bg-gray-950/50 text-gray-300 hover:text-white hover:bg-gray-800 transition-all active:scale-95"
              aria-label={tr('close')}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {step === 'list' ? (
            <>
              <div className="px-3 sm:px-4 pt-3 pb-2 shrink-0">
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder={tr('currencySearchPlaceholder')}
                    aria-label={tr('currencySearchPlaceholder')}
                    autoComplete="off"
                    className="w-full rounded-xl border border-gray-600/80 bg-gray-950/70 ps-10 pe-4 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/50 transition-shadow"
                  />
                </div>
                <p className="text-[11px] text-gray-500 mt-2 px-0.5">
                  {filteredCurrencies.length} {tr('currencySearchResults')}
                </p>
              </div>

              <ul className="overflow-y-auto overscroll-contain px-3 sm:px-4 pb-3 space-y-1.5 flex-1 min-h-0">
                {filteredCurrencies.length === 0 ? (
                  <li className="py-8 text-center text-sm text-gray-500">{tr('currencySearchEmpty')}</li>
                ) : (
                  filteredCurrencies.map((code) => {
                    const meta = getCurrencyMeta(code);
                    return (
                      <li key={code}>
                        <button
                          type="button"
                          onClick={() => handleSelectCurrency(code)}
                          className="w-full text-start rounded-xl border border-gray-700/50 bg-gray-950/40 hover:bg-gray-800/60 hover:border-gray-600/70 px-3.5 py-3 transition-all active:scale-[0.99]"
                        >
                          <div className="flex items-center gap-3">
                            <span
                              dir="ltr"
                              className="shrink-0 w-11 h-11 rounded-xl bg-gray-800/80 border border-gray-700/60 flex flex-col items-center justify-center gap-1 text-white tabular-nums"
                            >
                              <CurrencyFlag countryCode={meta.countryCode} size="md" alt={meta.name} />
                              <span className="text-[11px] font-semibold leading-none">{meta.symbol}</span>
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <CurrencyFlag countryCode={meta.countryCode} size="sm" alt="" />
                                <span className="font-semibold text-white tabular-nums">{code}</span>
                                <span className="text-sm text-gray-400">—</span>
                                <span className="text-sm text-gray-300">{meta.name}</span>
                              </div>
                              <p className="text-xs text-gray-500 mt-1">
                                {tr('currencyCountriesLabel')}: {meta.countries}
                              </p>
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            </>
          ) : (
            selectedCode &&
            selectedMeta && (
              <div className="px-4 sm:px-5 py-5 space-y-5 flex-1 overflow-y-auto">
                <div className="rounded-xl border border-gray-700/60 bg-gray-950/50 p-4">
                  <div className="flex items-center gap-3">
                    <span
                      dir="ltr"
                      className="shrink-0 w-14 h-14 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex flex-col items-center justify-center gap-1.5 text-white"
                    >
                      <CurrencyFlag countryCode={selectedMeta.countryCode} size="lg" alt={selectedMeta.name} />
                      <span className="text-sm font-bold leading-none">{selectedMeta.symbol}</span>
                    </span>
                    <div>
                      <p className="flex items-center gap-2 text-lg font-semibold text-white tabular-nums">
                        <CurrencyFlag countryCode={selectedMeta.countryCode} size="sm" alt="" />
                        {selectedCode}
                      </p>
                      <p className="text-sm text-gray-300">{selectedMeta.name}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {tr('currencyCountriesLabel')}: {selectedMeta.countries}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={handleUseTemporarily}
                    className={`px-3 py-3 text-sm ${utilityNavButtonLgClass}`}
                  >
                    {mode === 'expense' ? tr('currencyUseForExpense') : tr('currencyUseTemporarily')}
                  </button>
                  <button
                    type="button"
                    onClick={handleAddToInterface}
                    className={`px-3 py-3 text-sm ${primaryActionButtonBorderedClass}`}
                  >
                    {tr('currencyAddToInterface')}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setStep('list');
                    setSelectedCode(null);
                  }}
                  className="w-full text-sm text-gray-400 hover:text-gray-200 transition-colors py-2"
                >
                  {tr('currencyBackToList')}
                </button>
              </div>
            )
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
