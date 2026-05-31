import { useMemo } from 'react';
import { useLanguage } from '../LanguageContext';
import {
  CORE_CURRENCY_CODES,
  type CoreCurrencyCode,
  type CurrencyCode,
} from '../constants/currencies';

/** Core display currencies plus user-pinned custom currencies (shared by Settings & Expense form). */
export function usePinnedCurrencies(): CurrencyCode[] {
  const { customCurrencies } = useLanguage();

  return useMemo(() => {
    const core = [...CORE_CURRENCY_CODES];
    const extra = customCurrencies.filter(
      (code) => !core.includes(code as CoreCurrencyCode),
    );
    return [...core, ...extra];
  }, [customCurrencies]);
}
