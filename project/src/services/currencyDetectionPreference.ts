export type CurrencyAutoDetectPref = 'ask' | 'always' | 'never';

export const CURRENCY_AUTO_DETECT_PREF_KEY = 'currency_auto_detect_pref';

const VALID_PREFS = new Set<CurrencyAutoDetectPref>(['ask', 'always', 'never']);

export function getCurrencyAutoDetectPref(): CurrencyAutoDetectPref {
  try {
    const raw = window.localStorage.getItem(CURRENCY_AUTO_DETECT_PREF_KEY);
    if (raw && VALID_PREFS.has(raw as CurrencyAutoDetectPref)) {
      return raw as CurrencyAutoDetectPref;
    }
  } catch {
    /* ignore */
  }
  return 'ask';
}

export function setCurrencyAutoDetectPref(pref: CurrencyAutoDetectPref): void {
  try {
    window.localStorage.setItem(CURRENCY_AUTO_DETECT_PREF_KEY, pref);
  } catch {
    /* ignore */
  }
}
