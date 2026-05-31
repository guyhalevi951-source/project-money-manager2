import { normalizeCustomHex, isCustomHexColor } from '../categories';

const STORAGE_KEY = 'saved_colors';

function readRaw(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string' && isCustomHexColor(item));
  } catch {
    return [];
  }
}

export function getSavedColors(): string[] {
  return readRaw().map(normalizeCustomHex);
}

export function saveColor(hex: string): string[] {
  const normalized = normalizeCustomHex(hex);
  if (!isCustomHexColor(normalized)) return getSavedColors();

  const current = getSavedColors();
  if (current.includes(normalized)) return current;

  const next = [...current, normalized];
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function subscribeSavedColors(onChange: (colors: string[]) => void): () => void {
  const handler = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) onChange(getSavedColors());
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}
