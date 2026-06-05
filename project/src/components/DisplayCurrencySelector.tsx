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
import {
  primaryActionButtonBorderedClass,
  primaryActionSelectedChipClass,
  utilityNavButtonClass,
  utilityNavButtonLgClass,
  utilityNavActiveTabClass,
} from '../styles/actionButtonStyles';

const DEFAULT_DISPLAY_CURRENCY: CoreCurrencyCode = 'ILS';

// Two separate droppable types so cross-zone drops are rejected by the library.
const FAVORITES_TYPE = 'FAVORITES';
const REGULAR_TYPE = 'REGULAR';

// ─── Save-confirm modal ───────────────────────────────────────────────────────

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
              className={`px-4 py-3 text-sm ${utilityNavButtonLgClass}`}
            >
              {tr('currencyConfirmDiscard')}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className={`px-4 py-3 text-sm ${primaryActionButtonBorderedClass}`}
            >
              {tr('currencyConfirmSave')}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Currency card ────────────────────────────────────────────────────────────

const cellInnerClass =
  'absolute inset-0 flex flex-col items-center justify-center rounded-xl text-sm sm:text-base font-semibold tabular-nums transition-all min-h-0';

interface CurrencyCellProps {
  code: CurrencyCode;
  editMode: boolean;
  selected: boolean;
  isFavorite: boolean;
  /** Drag-handle props are applied to the OUTER wrapper div, not the inner button. */
  dragHandleProps?: DraggableProvidedDragHandleProps | null;
  isDragging?: boolean;
  onSelect: (code: CurrencyCode) => void;
  onToggleFavorite: (code: CurrencyCode, e: React.MouseEvent) => void;
  onRemove: (code: CurrencyCode, e: React.MouseEvent) => void;
}

function CurrencyCell({
  code,
  editMode,
  selected,
  isFavorite,
  dragHandleProps,
  isDragging,
  onSelect,
  onToggleFavorite,
  onRemove,
}: CurrencyCellProps) {
  const { tr } = useLanguage();
  const meta = getCurrencyMeta(code);
  const isCustom = !isCoreCurrency(code);
  const showRemove = editMode && isCustom && !isFavorite;

  return (
    /**
     * FIX 1 – dragHandleProps live here on the div, never on a <button>.
     * Disabled <button> elements block pointer events in all browsers,
     * preventing @hello-pangea/dnd from seeing the mousedown/touchstart it
     * needs to start a drag.
     */
    <div
      className={`relative aspect-square min-w-0 select-none ${
        editMode ? 'cursor-grab active:cursor-grabbing touch-none' : ''
      } ${isDragging ? 'z-50' : ''}`}
      style={editMode ? { userSelect: 'none' } : undefined}
      {...(editMode && dragHandleProps ? dragHandleProps : {})}
    >
      {/* Star – stopPropagation on pointerDown prevents accidental drag start */}
      {editMode && (
        <button
          type="button"
          aria-label={isFavorite ? tr('currencyRemoveFavorite') : tr('currencyAddFavorite')}
          aria-pressed={isFavorite}
          onClick={(e) => onToggleFavorite(code, e)}
          onPointerDown={(e) => e.stopPropagation()}
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

      {/* Remove (×) – only for non-favorite custom currencies */}
      {showRemove && (
        <button
          type="button"
          aria-label={`${tr('cancel')} ${code}`}
          onClick={(e) => onRemove(code, e)}
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute -top-1.5 -end-1.5 z-20 flex h-5 w-5 items-center justify-center rounded-full border border-gray-600/90 bg-gray-900 text-gray-300 shadow-md shadow-black/40 hover:bg-red-500/90 hover:border-red-400/80 hover:text-white transition-all active:scale-90"
        >
          <X className="h-3 w-3" strokeWidth={2.75} />
        </button>
      )}

      {/**
       * FIX 2 – Remove `disabled={editMode}`.
       * The click handler already returns early when editMode is true,
       * so no selection happens. Keeping `disabled` here was blocking every
       * pointer event on the element, including the drag handle props above.
       */}
      <button
        type="button"
        onClick={() => onSelect(code)}
        onPointerDown={(e) => { if (editMode) e.stopPropagation(); }}
        tabIndex={editMode ? -1 : 0}
        className={`${cellInnerClass} ${editMode ? 'pt-1' : ''} ${
          editMode
            ? `text-gray-200 bg-gray-800/60 ring-1 ring-amber-500/25 pointer-events-none ${
                isDragging
                  ? 'scale-105 shadow-2xl shadow-black/50 opacity-90 ring-2 ring-amber-400/70'
                  : 'opacity-95'
              }`
            : `active:scale-[0.98] ${
                selected
                  ? primaryActionSelectedChipClass
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

// ─── Zone header ──────────────────────────────────────────────────────────────

function ZoneHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 px-0.5 mb-1.5">
      <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wide text-amber-200/90">
        {label}
      </span>
      <span className="h-px flex-1 bg-amber-500/20" aria-hidden="true" />
    </div>
  );
}

// ─── Droppable zone ───────────────────────────────────────────────────────────

function DroppableZone({
  droppableId,
  type,
  items,
  onSelect,
  onToggleFavorite,
  onRemove,
}: {
  droppableId: 'favorites' | 'regular';
  type: string;
  items: CurrencyLayoutItem[];
  onSelect: (code: CurrencyCode) => void;
  onToggleFavorite: (code: CurrencyCode, e: React.MouseEvent) => void;
  onRemove: (code: CurrencyCode, e: React.MouseEvent) => void;
}) {
  return (
    <Droppable droppableId={droppableId} type={type} direction="horizontal">
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          className={`flex flex-wrap gap-1.5 sm:gap-2 rounded-xl p-1 -m-1 min-h-[3.5rem] transition-colors duration-150 ${
            snapshot.isDraggingOver
              ? 'bg-amber-500/10 ring-1 ring-amber-400/30'
              : items.length === 0
                ? 'border border-dashed border-amber-500/20'
                : ''
          }`}
        >
          {items.map((item, index) => (
            <Draggable key={item.code} draggableId={item.code} index={index}>
              {(drag, dragSnapshot) => (
                <div
                  ref={drag.innerRef}
                  {...drag.draggableProps}
                  /**
                   * FIX 3 – Use w-[calc(20%-...)] flex item instead of a CSS
                   * grid child.  @hello-pangea/dnd calculates drop targets by
                   * measuring element bounding boxes; flex-wrap is reliable,
                   * CSS grid can confuse the measurement algorithm.
                   */
                  style={{
                    ...drag.draggableProps.style,
                    // ~20% wide minus the gap share so 5 items fit per row.
                    width: 'calc(20% - 4.8px)',
                    aspectRatio: '1 / 1',
                  }}
                  className={dragSnapshot.isDragging ? 'z-50' : ''}
                >
                  <CurrencyCell
                    code={item.code}
                    editMode
                    selected={false}
                    isFavorite={item.isFavorite}
                    dragHandleProps={drag.dragHandleProps}
                    isDragging={dragSnapshot.isDragging}
                    onSelect={onSelect}
                    onToggleFavorite={onToggleFavorite}
                    onRemove={onRemove}
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
}

// ─── Main component ───────────────────────────────────────────────────────────

interface DisplayCurrencySelectorProps {
  recentExpenseCurrencies?: CurrencyCode[];
}

function DisplayCurrencySelector({ recentExpenseCurrencies: _recent }: DisplayCurrencySelectorProps) {
  const {
    tr,
    displayCurrency,
    setDisplayCurrency,
    currencyLayout,
    replaceCurrencyLayout,
  } = useLanguage();

  const pinnedFromCtx = usePinnedCurrencies();

  const [libraryOpen, setLibraryOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [tempLayout, setTempLayout] = useState<CurrencyLayoutItem[]>([]);
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);

  const activeLayout = editMode ? tempLayout : currencyLayout;
  const sortedLayout = useMemo(() => sortCurrencyLayout(activeLayout), [activeLayout]);
  const favoriteItems = useMemo(() => sortedLayout.filter((i) => i.isFavorite), [sortedLayout]);
  const regularItems = useMemo(() => sortedLayout.filter((i) => !i.isFavorite), [sortedLayout]);

  const pinnedCurrencies = useMemo(
    () => (editMode ? layoutToPinnedCodes(tempLayout) : pinnedFromCtx),
    [editMode, tempLayout, pinnedFromCtx],
  );

  const isTemporarySelection = useMemo(
    () => !pinnedCurrencies.includes(displayCurrency),
    [displayCurrency, pinnedCurrencies],
  );

  // ── Edit-mode lifecycle ──────────────────────────────────────────────────

  const enterEditMode = useCallback(() => {
    setTempLayout(normalizeLayoutOrder([...currencyLayout]));
    setEditMode(true);
  }, [currencyLayout]);

  const finishEditMode = useCallback(() => setSaveConfirmOpen(true), []);

  const discardChanges = useCallback(() => {
    setSaveConfirmOpen(false);
    setEditMode(false);
    setTempLayout([]);
  }, []);

  const confirmSave = useCallback(() => {
    const normalized = normalizeLayoutOrder(tempLayout);
    const nextPinned = layoutToPinnedCodes(normalized);
    if (!nextPinned.includes(displayCurrency) && !isCoreCurrency(displayCurrency)) {
      setDisplayCurrency(DEFAULT_DISPLAY_CURRENCY);
    }
    replaceCurrencyLayout(normalized);
    setSaveConfirmOpen(false);
    setEditMode(false);
    setTempLayout([]);
  }, [tempLayout, displayCurrency, replaceCurrencyLayout, setDisplayCurrency]);

  const toggleEditMode = useCallback(() => {
    if (editMode) finishEditMode();
    else enterEditMode();
  }, [editMode, finishEditMode, enterEditMode]);

  // ── Card interactions ────────────────────────────────────────────────────

  const handleSelect = useCallback(
    (code: CurrencyCode) => {
      if (editMode) return;
      setDisplayCurrency(code);
    },
    [editMode, setDisplayCurrency],
  );

  const handleToggleFavorite = useCallback((code: CurrencyCode, e: React.MouseEvent) => {
    e.stopPropagation();
    setTempLayout((prev) => normalizeLayoutOrder(toggleLayoutFavorite(prev, code)));
  }, []);

  const handleRemove = useCallback((code: CurrencyCode, e: React.MouseEvent) => {
    e.stopPropagation();
    setTempLayout((prev) => normalizeLayoutOrder(removeFromLayout(prev, code)));
  }, []);

  // ── Drag end ─────────────────────────────────────────────────────────────

  const handleDragEnd = useCallback((result: DropResult) => {
    const { source, destination } = result;
    // Drop outside a valid zone, or cross-zone (different types prevent this
    // already, but guard here too), or no movement.
    if (!destination) return;
    if (source.droppableId !== destination.droppableId) return;
    if (source.index === destination.index) return;

    const section = source.droppableId as 'favorites' | 'regular';
    setTempLayout((prev) =>
      normalizeLayoutOrder(reorderLayoutSection(prev, section, source.index, destination.index)),
    );
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────

  const readonlyGrid = (
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
          onRemove={handleRemove}
        />
      ))}
      <div className="relative aspect-square min-w-0">
        <button
          type="button"
          onClick={() => setLibraryOpen(true)}
          aria-label={tr('currencyLibraryTitle')}
          className={`${cellInnerClass} active:scale-[0.98] text-gray-300 bg-gray-800/40 hover:text-white hover:bg-gray-800/80 ${
            libraryOpen ? 'ring-1 ring-indigo-400/40 text-indigo-300' : ''
          }`}
        >
          <Plus className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2.25} />
        </button>
      </div>
    </div>
  );

  const editGrid = (
    /**
     * FIX 4 – Wrap DragDropContext in a plain <div>, NOT a <motion.div layout>.
     * Framer Motion's FLIP engine intercepts the CSS transforms that
     * @hello-pangea/dnd applies to the dragged element, corrupting the
     * real-time position used for drop-target detection.
     */
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="space-y-3">
        <section aria-label={tr('currencyFavoritesZone')}>
          <ZoneHeader label={tr('currencyFavoritesZone')} />
          <DroppableZone
            droppableId="favorites"
            type={FAVORITES_TYPE}
            items={favoriteItems}
            onSelect={handleSelect}
            onToggleFavorite={handleToggleFavorite}
            onRemove={handleRemove}
          />
        </section>

        {favoriteItems.length > 0 && regularItems.length > 0 && (
          <div className="h-px bg-amber-500/25 mx-0.5" aria-hidden="true" />
        )}

        <section
          aria-label={tr('currencyRegularZone')}
          className={favoriteItems.length > 0 && regularItems.length > 0 ? 'pt-1' : ''}
        >
          <DroppableZone
            droppableId="regular"
            type={REGULAR_TYPE}
            items={regularItems}
            onSelect={handleSelect}
            onToggleFavorite={handleToggleFavorite}
            onRemove={handleRemove}
          />
        </section>
      </div>
    </DragDropContext>
  );

  return (
    <>
      {/* Edit-mode toggle */}
      <div className="flex flex-col items-end gap-1 mb-3">
        <button
          type="button"
          onClick={toggleEditMode}
          aria-pressed={editMode}
          className={`px-3.5 py-2 text-xs sm:text-sm ${
            editMode ? utilityNavActiveTabClass : utilityNavButtonClass
          }`}
        >
          {editMode ? tr('currencyFinishEditMode') : tr('currencyEditMode')}
        </button>
        {editMode && (
          <p className="text-[10px] sm:text-xs text-amber-300/70">{tr('currencyDragHint')}</p>
        )}
      </div>

      {/* Temporary-selection banner (read-only mode only) */}
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

      {/* Card grid – plain div in edit mode, motion.div in read mode */}
      {editMode ? (
        <div
          dir="ltr"
          className="rounded-2xl bg-gray-950/80 border border-amber-500/40 ring-1 ring-amber-500/20 p-1.5 sm:p-2"
        >
          {editGrid}
        </div>
      ) : (
        <motion.div
          layout
          dir="ltr"
          className="rounded-2xl bg-gray-950/80 border border-gray-700 p-1.5 sm:p-2"
        >
          {readonlyGrid}
        </motion.div>
      )}

      <CurrencyLibraryModal open={libraryOpen} onClose={() => setLibraryOpen(false)} mode="display" />

      <CurrencyPinSaveConfirmModal
        open={saveConfirmOpen}
        onConfirm={confirmSave}
        onDiscard={discardChanges}
      />
    </>
  );
}

export default memo(DisplayCurrencySelector);
