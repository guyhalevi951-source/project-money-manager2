import {
  CORE_CURRENCY_CODES,
  isCoreCurrency,
  type CoreCurrencyCode,
  type CurrencyCode,
  type ExpenseCurrency,
  normalizeCustomCurrencies,
} from '../constants/currencies';

export interface CurrencyLayoutItem {
  code: CurrencyCode;
  isFavorite: boolean;
  order: number;
}

export const CURRENCY_LAYOUT_STORAGE_KEY = 'money-manager-currency-layout';

function normalizeLayoutItem(raw: unknown): CurrencyLayoutItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const code = (raw as { code?: unknown }).code;
  const isFavorite = (raw as { isFavorite?: unknown }).isFavorite;
  const order = (raw as { order?: unknown }).order;
  if (typeof code !== 'string' || !/^[A-Z]{3}$/.test(code)) return null;
  if (typeof isFavorite !== 'boolean') return null;
  if (typeof order !== 'number' || !Number.isFinite(order)) return null;
  return { code: code as CurrencyCode, isFavorite, order };
}

export function normalizeCurrencyLayout(raw: unknown): CurrencyLayoutItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(normalizeLayoutItem)
    .filter((item): item is CurrencyLayoutItem => item != null);
}

/** Default: core quartet favorited; custom currencies are regular. */
export function buildDefaultCurrencyLayout(customCurrencies: ExpenseCurrency[] = []): CurrencyLayoutItem[] {
  const items: CurrencyLayoutItem[] = CORE_CURRENCY_CODES.map((code, index) => ({
    code,
    isFavorite: true,
    order: index,
  }));

  const extras = customCurrencies.filter((code) => !isCoreCurrency(code));
  extras.forEach((code, index) => {
    items.push({
      code,
      isFavorite: false,
      order: CORE_CURRENCY_CODES.length + index,
    });
  });

  return items;
}

export function deriveCustomCurrenciesFromLayout(layout: CurrencyLayoutItem[]): ExpenseCurrency[] {
  return normalizeCustomCurrencies(
    layout
      .map((item) => item.code)
      .filter((code) => !isCoreCurrency(code)),
  );
}

/** Merge saved layout with current custom list (add missing, drop removed customs). */
export function reconcileCurrencyLayout(
  layout: CurrencyLayoutItem[],
  customCurrencies: ExpenseCurrency[],
): CurrencyLayoutItem[] {
  const customSet = new Set(customCurrencies);
  const byCode = new Map<CurrencyCode, CurrencyLayoutItem>();

  for (const item of layout) {
    if (isCoreCurrency(item.code) || customSet.has(item.code as ExpenseCurrency)) {
      byCode.set(item.code, item);
    }
  }

  CORE_CURRENCY_CODES.forEach((code, index) => {
    if (!byCode.has(code)) {
      byCode.set(code, { code, isFavorite: true, order: index });
    }
  });

  let nextOrder = byCode.size;
  for (const code of customCurrencies) {
    if (!byCode.has(code)) {
      byCode.set(code, { code, isFavorite: false, order: nextOrder++ });
    }
  }

  return normalizeLayoutOrder(Array.from(byCode.values()));
}

export function getInitialCurrencyLayout(customCurrencies: ExpenseCurrency[]): CurrencyLayoutItem[] {
  try {
    const raw = window.localStorage.getItem(CURRENCY_LAYOUT_STORAGE_KEY);
    if (raw) {
      const parsed = normalizeCurrencyLayout(JSON.parse(raw));
      if (parsed.length > 0) {
        return reconcileCurrencyLayout(parsed, customCurrencies);
      }
    }
  } catch {
    // fall through to default
  }
  return buildDefaultCurrencyLayout(customCurrencies);
}

/** Favorites first (by order), then regular (by order). */
export function sortCurrencyLayout(layout: CurrencyLayoutItem[]): CurrencyLayoutItem[] {
  const favorites = layout
    .filter((item) => item.isFavorite)
    .sort((a, b) => a.order - b.order);
  const regular = layout
    .filter((item) => !item.isFavorite)
    .sort((a, b) => a.order - b.order);
  return [...favorites, ...regular];
}

export function layoutToPinnedCodes(layout: CurrencyLayoutItem[]): CurrencyCode[] {
  return sortCurrencyLayout(layout).map((item) => item.code);
}

export function normalizeLayoutOrder(layout: CurrencyLayoutItem[]): CurrencyLayoutItem[] {
  const sorted = sortCurrencyLayout(layout);
  const favorites = sorted.filter((item) => item.isFavorite);
  const regular = sorted.filter((item) => !item.isFavorite);

  return [
    ...favorites.map((item, index) => ({ ...item, order: index })),
    ...regular.map((item, index) => ({ ...item, order: index })),
  ];
}

export function toggleLayoutFavorite(
  layout: CurrencyLayoutItem[],
  code: CurrencyCode,
): CurrencyLayoutItem[] {
  const item = layout.find((entry) => entry.code === code);
  if (!item) return layout;

  const nextFavorite = !item.isFavorite;
  const favorites = layout.filter((entry) => entry.isFavorite && entry.code !== code);
  const regular = layout.filter((entry) => !entry.isFavorite && entry.code !== code);

  if (nextFavorite) {
    favorites.push({ ...item, isFavorite: true, order: favorites.length });
    return normalizeLayoutOrder([...favorites, ...regular]);
  }

  regular.unshift({ ...item, isFavorite: false, order: 0 });
  return normalizeLayoutOrder([...favorites, ...regular]);
}

export function removeFromLayout(layout: CurrencyLayoutItem[], code: CurrencyCode): CurrencyLayoutItem[] {
  const item = layout.find((entry) => entry.code === code);
  if (!item || item.isFavorite) return layout;
  return normalizeLayoutOrder(layout.filter((entry) => entry.code !== code));
}

export function reorderLayoutSection(
  layout: CurrencyLayoutItem[],
  section: 'favorites' | 'regular',
  sourceIndex: number,
  destinationIndex: number,
): CurrencyLayoutItem[] {
  const favorites = sortCurrencyLayout(layout).filter((item) => item.isFavorite);
  const regular = sortCurrencyLayout(layout).filter((item) => !item.isFavorite);
  const target = section === 'favorites' ? favorites : regular;

  if (
    sourceIndex < 0 ||
    destinationIndex < 0 ||
    sourceIndex >= target.length ||
    destinationIndex >= target.length ||
    sourceIndex === destinationIndex
  ) {
    return layout;
  }

  const reordered = [...target];
  const [moved] = reordered.splice(sourceIndex, 1);
  reordered.splice(destinationIndex, 0, moved);

  const nextSection = reordered.map((item, index) => ({ ...item, order: index }));
  const other =
    section === 'favorites'
      ? regular.map((item, index) => ({ ...item, order: index }))
      : favorites.map((item, index) => ({ ...item, order: index }));

  return section === 'favorites'
    ? normalizeLayoutOrder([...nextSection, ...other])
    : normalizeLayoutOrder([...other, ...nextSection]);
}

export function addCurrencyToLayout(
  layout: CurrencyLayoutItem[],
  code: CurrencyCode,
): CurrencyLayoutItem[] {
  if (layout.some((item) => item.code === code)) return layout;
  const regular = sortCurrencyLayout(layout).filter((item) => !item.isFavorite);
  const favorites = sortCurrencyLayout(layout).filter((item) => item.isFavorite);
  regular.push({ code, isFavorite: false, order: regular.length });
  return normalizeLayoutOrder([...favorites, ...regular]);
}

export function isCoreCurrencyCode(code: CurrencyCode): code is CoreCurrencyCode {
  return isCoreCurrency(code);
}
