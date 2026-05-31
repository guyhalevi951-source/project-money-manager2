import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';
import { clamp01, hexToHsv, hsvToHex } from '../utils/colorUtils';
import { getSavedColors, saveColor } from '../services/savedColorsService';
import { isCustomHexColor, normalizeCustomHex } from '../categories';
import { useLanguage } from '../LanguageContext';

interface AdvancedColorPickerPopoverProps {
  open: boolean;
  color: string;
  onApply: (hex: string) => void;
  onCancel: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
}

/** Standard hue strip: Red(0) → Yellow(60) → Green(120) → Cyan(180) → Blue(240) → Magenta(300) → Red(360) */
const HUE_TRACK_GRADIENT =
  'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)';

function resolvePickerHex(color: string): string {
  if (isCustomHexColor(color)) return normalizeCustomHex(color);
  return normalizeCustomHex(color.startsWith('#') ? color : '#10B981');
}

export default function AdvancedColorPickerPopover({
  open,
  color,
  onApply,
  onCancel,
  anchorRef,
}: AdvancedColorPickerPopoverProps) {
  const { tr } = useLanguage();
  const popoverRef = useRef<HTMLDivElement>(null);
  const sbRef = useRef<HTMLDivElement>(null);

  const [hsv, setHsv] = useState(() => hexToHsv(resolvePickerHex(color)));
  const [draftHex, setDraftHex] = useState(() => resolvePickerHex(color));
  const [savedColors, setSavedColors] = useState<string[]>(() => getSavedColors());

  const hue = Math.round(hsv.h);
  const pureHueCss = `hsl(${hue} 100% 50%)`;

  useEffect(() => {
    if (!open) return;
    const startHex = resolvePickerHex(color);
    const nextHsv = hexToHsv(startHex);
    setHsv(nextHsv);
    setDraftHex(startHex);
    setSavedColors(getSavedColors());
  }, [open, color]);

  const updateDraft = useCallback((next: { h: number; s: number; v: number }) => {
    const normalized = {
      h: ((next.h % 360) + 360) % 360,
      s: clamp01(next.s),
      v: clamp01(next.v),
    };
    setHsv(normalized);
    setDraftHex(hsvToHex(normalized.h, normalized.s, normalized.v));
  }, []);

  const pickFromSurface = useCallback(
    (clientX: number, clientY: number) => {
      const rect = sbRef.current?.getBoundingClientRect();
      if (!rect) return;
      const s = clamp01((clientX - rect.left) / rect.width);
      const v = clamp01(1 - (clientY - rect.top) / rect.height);
      setHsv((prev) => {
        const next = { ...prev, s, v };
        setDraftHex(hsvToHex(next.h, next.s, next.v));
        return next;
      });
    },
    [],
  );

  const handleCancel = useCallback(() => {
    onCancel();
  }, [onCancel]);

  const handleUse = useCallback(() => {
    onApply(draftHex);
  }, [draftHex, onApply]);

  const handleSave = useCallback(() => {
    const nextSaved = saveColor(draftHex);
    setSavedColors(nextSaved);
    onApply(draftHex);
  }, [draftHex, onApply]);

  const selectSavedColor = useCallback((hex: string) => {
    const normalized = normalizeCustomHex(hex);
    setDraftHex(normalized);
    setHsv(hexToHsv(normalized));
  }, []);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      handleCancel();
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleCancel();
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open, anchorRef, handleCancel]);

  const handleSurfacePointer = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    pickFromSurface(event.clientX, event.clientY);

    const handleMove = (moveEvent: PointerEvent) => {
      pickFromSurface(moveEvent.clientX, moveEvent.clientY);
    };
    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={popoverRef}
          initial={{ opacity: 0, y: -6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.98 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="absolute top-full mt-2 start-0 z-50 w-[min(100%,19.5rem)] rounded-2xl border border-gray-700/80 bg-gray-900/95 backdrop-blur-xl shadow-2xl shadow-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={tr('customColorAdvanced')}
        >
          <div dir="ltr" className="space-y-3">
            <div
              ref={sbRef}
              className="relative h-36 w-full rounded-xl overflow-hidden cursor-crosshair touch-none ring-1 ring-white/10"
              style={{
                background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${pureHueCss})`,
              }}
              onPointerDown={handleSurfacePointer}
            >
              <span
                className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-lg shadow-black/40"
                style={{
                  left: `${hsv.s * 100}%`,
                  top: `${(1 - hsv.v) * 100}%`,
                  backgroundColor: draftHex,
                }}
              />
            </div>

            <div>
              <input
                type="range"
                min={0}
                max={360}
                step={1}
                value={Math.round(hsv.h)}
                onChange={(event) => {
                  const h = Number(event.target.value);
                  updateDraft({ ...hsv, h });
                }}
                className="advanced-hue-slider w-full h-3 appearance-none rounded-full cursor-pointer"
                style={{ background: HUE_TRACK_GRADIENT }}
                aria-label="Hue"
              />
            </div>

            <div className="flex items-center gap-3">
              <span
                className="h-10 w-10 shrink-0 rounded-xl ring-1 ring-white/20 shadow-inner"
                style={{ backgroundColor: draftHex }}
              />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] uppercase tracking-wide text-gray-500">HEX</p>
                <p className="font-mono text-sm text-gray-100 truncate">{draftHex}</p>
              </div>
            </div>

            <div className="pt-1 border-t border-gray-700/60">
              <p className="text-xs font-medium text-gray-400 mb-2">{tr('savedColorsTitle')}</p>
              {savedColors.length === 0 ? (
                <p className="text-[11px] text-gray-500 leading-relaxed">{tr('savedColorsEmpty')}</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {savedColors.map((hex) => {
                    const selected = draftHex === hex;
                    return (
                      <button
                        key={hex}
                        type="button"
                        onClick={() => selectSavedColor(hex)}
                        aria-label={hex}
                        aria-pressed={selected}
                        className={`relative shrink-0 w-8 h-8 rounded-full transition-all active:scale-95 ${
                          selected
                            ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-900'
                            : 'hover:ring-1 hover:ring-white/40'
                        }`}
                        style={{
                          backgroundColor: hex,
                          boxShadow: selected ? `0 0 10px ${hex}66` : undefined,
                        }}
                      >
                        {selected && (
                          <Check className="absolute inset-0 m-auto w-3.5 h-3.5 text-white drop-shadow" strokeWidth={3} />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1">
              <button
                type="button"
                onClick={handleCancel}
                className="px-2 py-2.5 rounded-xl text-xs sm:text-sm font-medium text-gray-300 border border-gray-600/80 bg-gray-950/50 hover:bg-gray-800/80 hover:text-white transition-all active:scale-[0.98]"
              >
                {tr('cancel')}
              </button>
              <button
                type="button"
                onClick={handleUse}
                className="px-2 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white border border-emerald-500/40 bg-emerald-500/20 hover:bg-emerald-500/35 transition-all active:scale-[0.98]"
              >
                {tr('colorUse')}
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-2 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white border border-emerald-400/50 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-md shadow-emerald-500/20 transition-all active:scale-[0.98]"
              >
                {tr('colorSave')}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
