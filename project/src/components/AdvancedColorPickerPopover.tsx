import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clamp01, hexToHsv, hsvToHex } from '../utils/colorUtils';

interface AdvancedColorPickerPopoverProps {
  open: boolean;
  color: string;
  onChange: (hex: string) => void;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
}

/** Standard hue strip: Red(0) → Yellow(60) → Green(120) → Cyan(180) → Blue(240) → Magenta(300) → Red(360) */
const HUE_TRACK_GRADIENT =
  'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)';

export default function AdvancedColorPickerPopover({
  open,
  color,
  onChange,
  onClose,
  anchorRef,
}: AdvancedColorPickerPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const sbRef = useRef<HTMLDivElement>(null);
  const [hsv, setHsv] = useState(() => hexToHsv(color));
  const [draftHex, setDraftHex] = useState(color.toUpperCase());

  const hue = Math.round(hsv.h);
  const pureHueCss = `hsl(${hue} 100% 50%)`;

  useEffect(() => {
    if (!open) return;
    const next = hexToHsv(color);
    setHsv(next);
    setDraftHex(color.toUpperCase());
  }, [open, color]);

  const commitHsv = useCallback(
    (next: { h: number; s: number; v: number }) => {
      const normalized = {
        h: ((next.h % 360) + 360) % 360,
        s: clamp01(next.s),
        v: clamp01(next.v),
      };
      setHsv(normalized);
      const hex = hsvToHex(normalized.h, normalized.s, normalized.v);
      setDraftHex(hex);
      onChange(hex);
    },
    [onChange],
  );

  const pickFromSurface = useCallback(
    (clientX: number, clientY: number) => {
      const rect = sbRef.current?.getBoundingClientRect();
      if (!rect) return;
      const s = clamp01((clientX - rect.left) / rect.width);
      const v = clamp01(1 - (clientY - rect.top) / rect.height);
      setHsv((prev) => {
        const next = { ...prev, s, v };
        const hex = hsvToHex(next.h, next.s, next.v);
        setDraftHex(hex);
        onChange(hex);
        return next;
      });
    },
    [onChange],
  );

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open, onClose, anchorRef]);

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
          className="absolute top-full mt-2 start-0 z-50 w-[min(100%,17.5rem)] rounded-2xl border border-gray-700/80 bg-gray-900/95 backdrop-blur-xl shadow-2xl shadow-black/50 p-4"
          role="dialog"
          aria-label="Advanced color picker"
        >
          {/* Force LTR so hue slider value 0–360 aligns with left→right gradient (fixes RTL inversion). */}
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
                  commitHsv({ ...hsv, h });
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
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
