import type { Lang } from '../translations';

const translationCache: Record<string, string> = {};

const cacheKey = (text: string, fromLang: Lang, toLang: Lang) =>
  `${fromLang}|${toLang}|${text.trim()}`;

/** Immediate client-side fallback when the API fails or returns the source text. */
const FALLBACK_HE_TO_EN: Record<string, string> = {
  כלב: 'Dog',
  לשן: 'Dental',
  תחבורה: 'Transport',
  מזון: 'Food',
  קניות: 'Shopping',
  חשמל: 'Electricity',
  מים: 'Water',
  אינטרנט: 'Internet',
  טלפון: 'Phone',
  ביטוח: 'Insurance',
  חינוך: 'Education',
  מתנות: 'Gifts',
  חיסכון: 'Savings',
};

const FALLBACK_EN_TO_HE: Record<string, string> = Object.fromEntries(
  Object.entries(FALLBACK_HE_TO_EN).map(([he, en]) => [en.toLowerCase(), he]),
);

export function lookupFallbackTranslation(
  text: string,
  fromLang: Lang,
  toLang: Lang,
): string | null {
  const normalized = text.trim();
  if (!normalized || fromLang === toLang) return null;

  if (fromLang === 'he' && toLang === 'en') {
    return FALLBACK_HE_TO_EN[normalized] ?? null;
  }
  if (fromLang === 'en' && toLang === 'he') {
    return FALLBACK_EN_TO_HE[normalized.toLowerCase()] ?? null;
  }
  return null;
}

const isUnchangedTranslation = (source: string, translated: string) => {
  const a = source.trim().toLowerCase();
  const b = translated.trim().toLowerCase();
  return a === b || b === `${a}.`;
};

export async function translateText(
  text: string,
  fromLang: Lang,
  toLang: Lang,
): Promise<string> {
  const normalized = text.trim();
  if (!normalized) return text;
  if (fromLang === toLang) return text;

  const key = cacheKey(normalized, fromLang, toLang);
  if (translationCache[key]) {
    return translationCache[key];
  }

  const fallback = lookupFallbackTranslation(normalized, fromLang, toLang);
  if (fallback) {
    translationCache[key] = fallback;
    return fallback;
  }

  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(normalized)}&langpair=${fromLang}|${toLang}`;
    const response = await fetch(url);
    if (!response.ok) {
      return normalized;
    }

    const data = (await response.json()) as {
      responseData?: { translatedText?: string };
    };
    const translated = data.responseData?.translatedText?.trim();
    if (!translated || isUnchangedTranslation(normalized, translated)) {
      const retryFallback = lookupFallbackTranslation(normalized, fromLang, toLang);
      if (retryFallback) {
        translationCache[key] = retryFallback;
        return retryFallback;
      }
      return normalized;
    }

    translationCache[key] = translated;
    return translated;
  } catch {
    const retryFallback = lookupFallbackTranslation(normalized, fromLang, toLang);
    if (retryFallback) {
      translationCache[key] = retryFallback;
      return retryFallback;
    }
    return normalized;
  }
}
