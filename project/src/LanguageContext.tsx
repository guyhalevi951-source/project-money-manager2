import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { dirByLang, localizeCategoryLabel, t, type Dir, type Lang, type TranslationKey } from './translations';
import { lookupFallbackTranslation, translateText } from './services/translationService';
import {
  fetchExchangeRates,
  getCachedExchangeRates,
  type ExpenseCurrency,
  type ExchangeRates,
} from './services/exchangeRateService';
import {
  appendSavedColor,
} from './services/userFirebaseSync';
import { getSavedColors as getLocalSavedColors } from './services/savedColorsService';
import {
  formatMoneyFromIls,
  resolveExpenseDisplayAmount,
  type ExpenseDisplayAmount,
} from './services/displayCurrencyUtils';

interface LanguageContextValue {
  lang: Lang;
  dir: Dir;
  setLang: (next: Lang) => void;
  keepOriginalValues: boolean;
  setKeepOriginalValues: (next: boolean) => void;
  displayCurrency: ExpenseCurrency;
  setDisplayCurrency: (next: ExpenseCurrency) => void;
  savedColors: string[];
  saveSavedColor: (hex: string) => string[];
  setSavedColors: (colors: string[]) => void;
  settingsPersistence: 'local' | 'cloud';
  setSettingsPersistence: (mode: 'local' | 'cloud') => void;
  applySettingsFromCloud: (settings: {
    lang: Lang;
    keepOriginalValues: boolean;
    displayCurrency: ExpenseCurrency;
    saved_colors: string[];
  }) => void;
  formatMoney: (ilsAmount: number) => string;
  formatExpenseMoney: (
    ilsAmount: number,
    originalAmount?: number,
    originalCurrency?: string,
  ) => ExpenseDisplayAmount;
  tr: (key: TranslationKey) => string;
  getUserContent: (text: string) => string;
  isUserContentLoading: (text: string) => boolean;
  ensureUserContent: (text: string) => Promise<void>;
  ensureUserContents: (texts: string[]) => Promise<void>;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

const LANGUAGE_STORAGE_KEY = 'money-manager-language';
const KEEP_ORIGINAL_VALUES_STORAGE_KEY = 'money-manager-keep-original-values';
const DISPLAY_CURRENCY_STORAGE_KEY = 'money-manager-display-currency';

const VALID_DISPLAY_CURRENCIES: ExpenseCurrency[] = ['ILS', 'USD', 'EUR', 'GBP'];

function getInitialDisplayCurrency(): ExpenseCurrency {
  const fromStorage = window.localStorage.getItem(DISPLAY_CURRENCY_STORAGE_KEY);
  if (fromStorage && VALID_DISPLAY_CURRENCIES.includes(fromStorage as ExpenseCurrency)) {
    return fromStorage as ExpenseCurrency;
  }
  return 'ILS';
}

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

function resolveUserContent(
  text: string,
  lang: Lang,
  keepOriginalValues: boolean,
  translatedMap: Record<string, string>,
): string {
  const raw = text.trim();
  if (!raw || keepOriginalValues) return text;

  const fromLang = detectSourceLang(raw);
  if (fromLang === lang) return text;

  const localizedBuiltin = localizeCategoryLabel(raw, lang);
  if (localizedBuiltin !== raw) return localizedBuiltin;

  const fallback = lookupFallbackTranslation(raw, fromLang, lang);
  if (fallback) return fallback;

  const key = translationKey(raw, fromLang, lang);
  return translatedMap[key] ?? text;
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => getInitialLang());
  const [keepOriginalValues, setKeepOriginalValues] = useState<boolean>(() => {
    const fromStorage = window.localStorage.getItem(KEEP_ORIGINAL_VALUES_STORAGE_KEY);
    return fromStorage === 'true';
  });
  const [displayCurrency, setDisplayCurrency] = useState<ExpenseCurrency>(() =>
    getInitialDisplayCurrency(),
  );
  const [savedColors, setSavedColors] = useState<string[]>(() => getLocalSavedColors());
  const [settingsPersistence, setSettingsPersistence] = useState<'local' | 'cloud'>('local');
  const [exchangeRates, setExchangeRates] = useState<ExchangeRates | null>(() =>
    getCachedExchangeRates(),
  );
  const [translatedMap, setTranslatedMap] = useState<Record<string, string>>({});
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const translatedMapRef = useRef(translatedMap);
  const loadingMapRef = useRef(loadingMap);
  const dir = dirByLang[lang];

  const applySettingsFromCloud = useCallback(
    (settings: {
      lang: Lang;
      keepOriginalValues: boolean;
      displayCurrency: ExpenseCurrency;
      saved_colors: string[];
    }) => {
      setLang(settings.lang);
      setKeepOriginalValues(settings.keepOriginalValues);
      setDisplayCurrency(settings.displayCurrency);
      setSavedColors(settings.saved_colors);
    },
    [],
  );

  const saveSavedColor = useCallback(
    (hex: string) => {
      const next = appendSavedColor(savedColors, hex);
      setSavedColors(next);
      if (settingsPersistence === 'local') {
        window.localStorage.setItem('saved_colors', JSON.stringify(next));
      }
      return next;
    },
    [savedColors, settingsPersistence],
  );

  useEffect(() => {
    translatedMapRef.current = translatedMap;
  }, [translatedMap]);

  useEffect(() => {
    loadingMapRef.current = loadingMap;
  }, [loadingMap]);

  useEffect(() => {
    if (settingsPersistence !== 'local') return;
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  }, [lang, settingsPersistence]);

  useEffect(() => {
    if (settingsPersistence !== 'local') return;
    window.localStorage.setItem(KEEP_ORIGINAL_VALUES_STORAGE_KEY, String(keepOriginalValues));
  }, [keepOriginalValues, settingsPersistence]);

  useEffect(() => {
    if (settingsPersistence !== 'local') return;
    window.localStorage.setItem(DISPLAY_CURRENCY_STORAGE_KEY, displayCurrency);
  }, [displayCurrency, settingsPersistence]);

  useEffect(() => {
    const cached = getCachedExchangeRates();
    if (cached) {
      setExchangeRates(cached);
      return;
    }

    let cancelled = false;
    void fetchExchangeRates()
      .then((rates) => {
        if (!cancelled) setExchangeRates(rates);
      })
      .catch(() => {
        // Keep showing ILS fallback via formatMoneyFromIls when rates are unavailable.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang, dir]);

  const formatMoney = useCallback(
    (ilsAmount: number) =>
      formatMoneyFromIls(ilsAmount, displayCurrency, exchangeRates ?? getCachedExchangeRates()),
    [displayCurrency, exchangeRates],
  );

  const formatExpenseMoney = useCallback(
    (ilsAmount: number, originalAmount?: number, originalCurrency?: string) =>
      resolveExpenseDisplayAmount(
        ilsAmount,
        displayCurrency,
        exchangeRates ?? getCachedExchangeRates(),
        originalAmount,
        originalCurrency,
      ),
    [displayCurrency, exchangeRates],
  );

  const ensureUserContent = useCallback(
    async (text: string) => {
      const raw = text.trim();
      if (!raw || keepOriginalValues) return;

      const fromLang = detectSourceLang(raw);
      if (fromLang === lang) return;

      const localizedBuiltin = localizeCategoryLabel(raw, lang);
      if (localizedBuiltin !== raw) return;

      if (lookupFallbackTranslation(raw, fromLang, lang)) return;

      const key = translationKey(raw, fromLang, lang);
      if (translatedMapRef.current[key] || loadingMapRef.current[key]) return;

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
    [keepOriginalValues, lang],
  );

  const ensureUserContents = useCallback(
    async (texts: string[]) => {
      const tasks = Array.from(new Set(texts.filter(Boolean))).map((item) => ensureUserContent(item));
      await Promise.all(tasks);
    },
    [ensureUserContent],
  );

  const getUserContent = useCallback(
    (text: string) => resolveUserContent(text, lang, keepOriginalValues, translatedMap),
    [keepOriginalValues, lang, translatedMap],
  );

  const isUserContentLoading = useCallback(
    (text: string) => {
      const raw = text.trim();
      if (!raw || keepOriginalValues) return false;
      const fromLang = detectSourceLang(raw);
      if (fromLang === lang) return false;
      if (localizeCategoryLabel(raw, lang) !== raw) return false;
      if (lookupFallbackTranslation(raw, fromLang, lang)) return false;
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
      displayCurrency,
      setDisplayCurrency,
      savedColors,
      saveSavedColor,
      setSavedColors,
      settingsPersistence,
      setSettingsPersistence,
      applySettingsFromCloud,
      formatMoney,
      formatExpenseMoney,
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
      displayCurrency,
      savedColors,
      saveSavedColor,
      settingsPersistence,
      applySettingsFromCloud,
      formatMoney,
      formatExpenseMoney,
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

/** Keeps currency symbols and numbers in logical order inside RTL layouts. */
export function LtrNumeric({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      dir="ltr"
      className={`inline-block [unicode-bidi:isolate] tabular-nums ${className}`.trim()}
    >
      {children}
    </span>
  );
}
