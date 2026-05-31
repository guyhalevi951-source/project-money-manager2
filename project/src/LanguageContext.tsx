import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { dirByLang, t, type Dir, type Lang, type TranslationKey } from './translations';
import { translateText } from './services/translationService';

interface LanguageContextValue {
  lang: Lang;
  dir: Dir;
  setLang: (next: Lang) => void;
  keepOriginalValues: boolean;
  setKeepOriginalValues: (next: boolean) => void;
  tr: (key: TranslationKey) => string;
  getUserContent: (text: string) => string;
  isUserContentLoading: (text: string) => boolean;
  ensureUserContent: (text: string) => Promise<void>;
  ensureUserContents: (texts: string[]) => Promise<void>;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

const LANGUAGE_STORAGE_KEY = 'money-manager-language';
const KEEP_ORIGINAL_VALUES_STORAGE_KEY = 'money-manager-keep-original-values';

const hasHebrew = (text: string) => /[\u0590-\u05FF]/.test(text);
const detectSourceLang = (text: string): Lang => (hasHebrew(text) ? 'he' : 'en');
const translationKey = (text: string, fromLang: Lang, toLang: Lang) =>
  `${fromLang}|${toLang}|${text}`;

function getInitialLang(): Lang {
  const fromStorage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (fromStorage === 'he' || fromStorage === 'en') return fromStorage;
  const browserLang = navigator.language.toLowerCase();
  return browserLang.startsWith('he') ? 'he' : 'en';
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => getInitialLang());
  const [keepOriginalValues, setKeepOriginalValues] = useState<boolean>(() => {
    const fromStorage = window.localStorage.getItem(KEEP_ORIGINAL_VALUES_STORAGE_KEY);
    return fromStorage === 'true';
  });
  const [translatedMap, setTranslatedMap] = useState<Record<string, string>>({});
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const dir = dirByLang[lang];

  useEffect(() => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  }, [lang]);

  useEffect(() => {
    window.localStorage.setItem(KEEP_ORIGINAL_VALUES_STORAGE_KEY, String(keepOriginalValues));
  }, [keepOriginalValues]);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang, dir]);

  const ensureUserContent = useCallback(
    async (text: string) => {
      const raw = text.trim();
      if (!raw || keepOriginalValues) return;

      const fromLang = detectSourceLang(raw);
      if (fromLang === lang) return;

      const key = translationKey(raw, fromLang, lang);
      if (translatedMap[key] || loadingMap[key]) return;

      setLoadingMap((prev) => ({ ...prev, [key]: true }));
      try {
        const translated = await translateText(raw, fromLang, lang);
        setTranslatedMap((prev) => ({ ...prev, [key]: translated }));
      } finally {
        setLoadingMap((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }
    },
    [keepOriginalValues, lang, translatedMap, loadingMap],
  );

  const ensureUserContents = useCallback(
    async (texts: string[]) => {
      const tasks = Array.from(new Set(texts.filter(Boolean))).map((text) => ensureUserContent(text));
      await Promise.all(tasks);
    },
    [ensureUserContent],
  );

  const getUserContent = useCallback(
    (text: string) => {
      const raw = text.trim();
      if (!raw || keepOriginalValues) return text;
      const fromLang = detectSourceLang(raw);
      if (fromLang === lang) return text;
      const key = translationKey(raw, fromLang, lang);
      return translatedMap[key] ?? text;
    },
    [keepOriginalValues, lang, translatedMap],
  );

  const isUserContentLoading = useCallback(
    (text: string) => {
      const raw = text.trim();
      if (!raw || keepOriginalValues) return false;
      const fromLang = detectSourceLang(raw);
      if (fromLang === lang) return false;
      const key = translationKey(raw, fromLang, lang);
      return Boolean(loadingMap[key]);
    },
    [keepOriginalValues, lang, loadingMap],
  );

  const value = useMemo<LanguageContextValue>(
    () => ({
      lang,
      dir,
      setLang,
      keepOriginalValues,
      setKeepOriginalValues,
      tr: (key) => t(lang, key),
      getUserContent,
      isUserContentLoading,
      ensureUserContent,
      ensureUserContents,
    }),
    [
      lang,
      dir,
      keepOriginalValues,
      getUserContent,
      isUserContentLoading,
      ensureUserContent,
      ensureUserContents,
    ],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}

interface LocalizedUserTextProps {
  text: string;
  className?: string;
}

export function LocalizedUserText({ text, className = '' }: LocalizedUserTextProps) {
  const { ensureUserContent, getUserContent, isUserContentLoading } = useLanguage();
  const display = getUserContent(text);
  const loading = isUserContentLoading(text);

  useEffect(() => {
    void ensureUserContent(text);
  }, [text, ensureUserContent]);

  return (
    <span className={`${className} ${loading ? 'opacity-80 transition-opacity' : ''}`.trim()}>
      {display}
    </span>
  );
}
