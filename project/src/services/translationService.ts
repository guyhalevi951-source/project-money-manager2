import type { Lang } from '../translations';

const translationCache: Record<string, string> = {};

const cacheKey = (text: string, fromLang: Lang, toLang: Lang) =>
  `${fromLang}|${toLang}|${text.trim()}`;

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

  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(normalized)}&langpair=${fromLang}|${toLang}`;
    const response = await fetch(url);
    if (!response.ok) return text;

    const data = (await response.json()) as {
      responseData?: { translatedText?: string };
    };
    const translated = data.responseData?.translatedText?.trim();
    if (!translated) return text;

    translationCache[key] = translated;
    return translated;
  } catch {
    return text;
  }
}
