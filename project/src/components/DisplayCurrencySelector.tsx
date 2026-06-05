import { memo, useCallback, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DraggableProvidedDragHandleProps,
  type DropResult,
} from '@hello-pangea/dnd';
import { Plus, Star, X } from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import { usePinnedCurrencies } from '../hooks/usePinnedCurrencies';
import {
  getCurrencyMeta,
  isCoreCurrency,
  type CoreCurrencyCode,
  type CurrencyCode,
} from '../constants/currencies';
import {
  layoutToPinnedCodes,
  normalizeLayoutOrder,
  removeFromLayout,
  reorderLayoutSection,
  sortCurrencyLayout,
  toggleLayoutFavorite,
  type CurrencyLayoutItem,
} from '../services/currencyLayoutService';
import CurrencyLibraryModal from './CurrencyLibraryModal';
import CurrencyFlag from './CurrencyFlag';

const DEFAULT_DISPLAY_CURRENCY: CoreCurrencyCode = 'ILS';
const FAVORITES_DROPPABLE_TYPE = 'FAVORITES';
const REGULAR_DROPPABLE_TYPE = 'REGULAR';

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

const currencyCellClass =
  'absolute inset-0 flex flex-col items-center justify-center rounded-xl text-sm sm:text-base font-semibold tabular-nums transition-all min-h-0';

interface CurrencyCellProps {
  code: CurrencyCode;
  editMode: boolean;
  selected: boolean;
  isFavorite: boolean;
  onSelect: (code: CurrencyCode) => void;
  onToggleFavorite: (code: CurrencyCode, event: React.MouseEvent) => void;
  onRemove: (code: CurrencyCode, event: React.MouseEvent) => void;
  dragHandleProps?: DraggableProvidedDragHandleProps | null;
  isDragging?: boolean;
}

function CurrencyCell({
  code,
  editMode,
  selected,
  isFavorite,
  onSelect,
  onToggleFavorite,
  onRemove,
  dragHandleProps,
  isDragging,
}: CurrencyCellProps) {
  const { tr } = useLanguage();
  const meta = getCurrencyMeta(code);
  const isCustom = !isCoreCurrency(code);
  const showRemove = editMode && isCustom && !isFavorite;

  return (
    <div className={`relative aspect-square min-w-0 ${isDragging ? 'z-50' : ''}`}>
      {editMode && (
        <button
          type="button"
          aria-label={isFavorite ? tr('currencyRemoveFavorite') : tr('currencyAddFavorite')}
          aria-pressed={isFavorite}
          onClick={(event) => onToggleFavorite(code, event)}
          onPointerDown={(event) => event.stopPropagation()}
          className="absolute top-0 start-0 z-20 flex h-6 w-6 items-center justify-center rounded-full transition-all active:scale-90"
        >
          <Star
            className={`h-3.5 w-3.5 ${
              isFavorite
                ? 'fill-yellow-400 text-yellow-400'
                : 'fill-transparent text-gray-400 hover:text-yellow-300/80'
            }`}
            strokeWidth={2}
          />
        </button>
      )}

      {showRemove && (
        <button
          type="button"
          aria-label={`${tr('cancel')} ${code}`}
          onClick={(event) => onRemove(code, event)}
          onPointerDown={(event) => event.stopPropagation()}
          className="absolute -top-1.5 -end-1.5 z-20 flex h-5 w-5 items-center justify-center rounded-full border border-gray-600/90 bg-gray-900 text-gray-300 shadow-md shadow-black/40 hover:bg-red-500/90 hover:border-red-400/80 hover:text-white transition-all active:scale-90"
        >
          <X className="h-3 w-3" strokeWidth={2.75} />
        </button>
      )}

      <button
        type="button"
        onClick={() => onSelect(code)}
        disabled={editMode}
        {...(editMode && dragHandleProps ? dragHandleProps : {})}
        className={`${currencyCellClass} ${editMode ? 'pt-1 touch-none select-none' : ''} ${
          editMode
            ? `cursor-grab active:cursor-grabbing text-gray-200 bg-gray-800/60 ring-1 ring-amber-500/25 ${
                isDragging
                  ? 'scale-105 rotate-2 shadow-2xl shadow-black/50 opacity-90 ring-2 ring-amber-400/70 z-50'
                  : 'opacity-95'
              }`
            : `active:scale-[0.98] ${
                selected
                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30 ring-1 ring-emerald-400/40'
                  : 'text-gray-300 bg-gray-800/40 hover:text-white hover:bg-gray-800/80'
              }`
        }`}
        aria-pressed={selected}
      >
        <CurrencyFlag countryCode={meta.countryCode} size="xs" alt={meta.name} />
        <span className="text-xs sm:text-sm leading-none mt-0.5">{meta.symbol}</span>
        <span className="text-[9px] sm:text-[10px] font-medium opacity-80 mt-0.5 leading-none">{code}</span>
      </button>
    </div>
  );
}

function CurrencyZoneHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 px-0.5 mb-1.5">
      <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wide text-amber-200/90">
        {title}
      </span>
      <span className="h-px flex-1 bg-amber-500/20" aria-hidden="true" />
    </div>
  );
}

interface DisplayCurrencySelectorProps {
  recentExpenseCurrencies?: CurrencyCode[];
}

function DisplayCurrencySelector({ recentExpenseCurrencies: _recentExpenseCurrencies }: DisplayCurrencySelectorProps) {
  const {
    tr,
    displayCurrency,
    setDisplayCurrency,
    currencyLayout,
    replaceCurrencyLayout,
  } = useLanguage();

  const pinnedCurrenciesFromContext = usePinnedCurrencies();

  const [libraryOpen, setLibraryOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [tempLayout, setTempLayout] = useState<CurrencyLayoutItem[]>([]);
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);

  const activeLayout = editMode ? tempLayout : currencyLayout;
  const sortedLayout = useMemo(() => sortCurrencyLayout(activeLayout), [activeLayout]);
  const favoriteItems = useMemo(
    () => sortedLayout.filter((item) => item.isFavorite),
    [sortedLayout],
  );
  const regularItems = useMemo(
    () => sortedLayout.filter((item) => !item.isFavorite),
    [sortedLayout],
  );

  const pinnedCurrencies = useMemo(() => {
    if (!editMode) return pinnedCurrenciesFromContext;
    return layoutToPinnedCodes(tempLayout);
  }, [editMode, pinnedCurrenciesFromContext, tempLayout]);

  const isTemporarySelection = useMemo(
    () => !pinnedCurrencies.includes(displayCurrency),
    [displayCurrency, pinnedCurrencies],
  );

  const handleEnterEditMode = useCallback(() => {
    setTempLayout(normalizeLayoutOrder([...currencyLayout]));
    setEditMode(true);
  }, [currencyLayout]);

  const handleFinishEditMode = useCallback(() => {
    setSaveConfirmOpen(true);
  }, []);

  const handleDiscardChanges = useCallback(() => {
    setSaveConfirmOpen(false);
    setEditMode(false);
    setTempLayout([]);
  }, []);

  const handleConfirmSave = useCallback(() => {
    const normalized = normalizeLayoutOrder(tempLayout);
    const nextPinned = layoutToPinnedCodes(normalized);
    const removedActivePinned =
      !nextPinned.includes(displayCurrency) && !isCoreCurrency(displayCurrency);

    replaceCurrencyLayout(normalized);

    if (removedActivePinned) {
      setDisplayCurrency(DEFAULT_DISPLAY_CURRENCY);
    }

    setSaveConfirmOpen(false);
    setEditMode(false);
    setTempLayout([]);
  }, [tempLayout, displayCurrency, replaceCurrencyLayout, setDisplayCurrency]);

  const handleRemoveCustom = useCallback((code: CurrencyCode, event: React.MouseEvent) => {
    event.stopPropagation();
    setTempLayout((prev) => normalizeLayoutOrder(removeFromLayout(prev, code)));
  }, []);

  const handleToggleFavorite = useCallback((code: CurrencyCode, event: React.MouseEvent) => {
    event.stopPropagation();
    setTempLayout((prev) => normalizeLayoutOrder(toggleLayoutFavorite(prev, code)));
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

  const handleDragEnd = useCallback((result: DropResult) => {
    const { source, destination } = result;
    if (!destination) return;
    if (source.droppableId !== destination.droppableId) return;
    if (source.index === destination.index) return;

    const section = source.droppableId as 'favorites' | 'regular';
    setTempLayout((prev) =>
      normalizeLayoutOrder(reorderLayoutSection(prev, section, source.index, destination.index)),
    );
  }, []);

  const renderEditableZone = (
    items: CurrencyLayoutItem[],
    droppableId: 'favorites' | 'regular',
    droppableType: string,
  ) => (
    <Droppable droppableId={droppableId} type={droppableType}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          className={`currency-dnd-grid grid grid-cols-5 gap-1.5 sm:gap-2 rounded-xl p-1 -m-1 min-h-[2.75rem] transition-colors duration-150 ${
            snapshot.isDraggingOver
              ? 'bg-amber-500/10 ring-1 ring-amber-400/30'
              : items.length === 0
                ? 'border border-dashed border-amber-500/15'
                : ''
          }`}
        >
          {items.map((item, index) => (
            <Draggable key={item.code} draggableId={item.code} index={index}>
              {(draggableProvided, draggableSnapshot) => (
                <div
                  ref={draggableProvided.innerRef}
                  {...draggableProvided.draggableProps}
                  style={draggableProvided.draggableProps.style}
                  className={`min-w-0 aspect-square ${draggableSnapshot.isDragging ? 'z-50' : ''}`}
                >
                  <CurrencyCell
                    code={item.code}
                    editMode
                    selected={false}
                    isFavorite={item.isFavorite}
                    onSelect={handleSelect}
                    onToggleFavorite={handleToggleFavorite}
                    onRemove={handleRemoveCustom}
                    dragHandleProps={draggableProvided.dragHandleProps}
                    isDragging={draggableSnapshot.isDragging}
                  />
                </div>
              )}
            </Draggable>
          ))}
          {provided.placeholder}
        </div>
      )}
    </Droppable>
  );

  const gridContent = editMode ? (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="space-y-3">
        <section aria-label={tr('currencyFavoritesZone')}>
          <CurrencyZoneHeader title={tr('currencyFavoritesZone')} />
          {renderEditableZone(favoriteItems, 'favorites', FAVORITES_DROPPABLE_TYPE)}
        </section>

        <section aria-label={tr('currencyRegularZone')}>
          <CurrencyZoneHeader title={tr('currencyRegularZone')} />
          {renderEditableZone(regularItems, 'regular', REGULAR_DROPPABLE_TYPE)}
        </section>
      </div>
    </DragDropContext>
  ) : (
    <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
      {sortedLayout.map((item) => (
        <CurrencyCell
          key={item.code}
          code={item.code}
          editMode={false}
          selected={displayCurrency === item.code}
          isFavorite={item.isFavorite}
          onSelect={handleSelect}
          onToggleFavorite={handleToggleFavorite}
          onRemove={handleRemoveCustom}
        />
      ))}

      <div className="relative aspect-square min-w-0">
        <button
          type="button"
          onClick={() => setLibraryOpen(true)}
          aria-label={tr('currencyLibraryTitle')}
          className={`${currencyCellClass} active:scale-[0.98] text-gray-300 bg-gray-800/40 hover:text-white hover:bg-gray-800/80 ${
            libraryOpen ? 'ring-1 ring-emerald-400/40 text-emerald-300' : ''
          }`}
        >
          <Plus className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2.25} />
        </button>
      </div>
    </div>
  );

  return (
    <>
      <div className="flex flex-col items-end gap-1 mb-3">
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
        {editMode && (
          <p className="text-[10px] sm:text-xs text-amber-300/70">{tr('currencyDragHint')}</p>
        )}
      </div>

      {isTemporarySelection && !editMode && (
        <div
          dir="ltr"
          className="mb-3 rounded-xl border border-violet-500/30 bg-violet-500/10 px-3.5 py-2.5 text-sm text-violet-100"
        >
          <span className="inline-flex items-center gap-2 font-medium tabular-nums">
            <CurrencyFlag
              countryCode={getCurrencyMeta(displayCurrency).countryCode}
              size="sm"
              alt={getCurrencyMeta(displayCurrency).name}
            />
            {displayCurrency}
          </span>
          <span className="text-violet-200/90"> — {getCurrencyMeta(displayCurrency).name}</span>
          <span className="block text-xs text-violet-300/80 mt-0.5">{tr('currencyTemporaryActive')}</span>
        </div>
      )}

      <motion.div
        layout
        dir="ltr"
        className={`rounded-2xl bg-gray-950/80 border p-1.5 sm:p-2 transition-colors duration-200 ${
          editMode ? 'border-amber-500/40 ring-1 ring-amber-500/20' : 'border-gray-700'
        }`}
      >
        {gridContent}
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
