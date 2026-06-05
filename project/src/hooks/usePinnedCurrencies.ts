import { useMemo } from 'react';
import { useLanguage } from '../LanguageContext';
import { layoutToPinnedCodes } from '../services/currencyLayoutService';
import type { CurrencyCode } from '../constants/currencies';

/** Ordered display currencies (favorites first) from the user's layout preferences. */
export function usePinnedCurrencies(): CurrencyCode[] {
  const { currencyLayout } = useLanguage();

  return useMemo(() => layoutToPinnedCodes(currencyLayout), [currencyLayout]);
}
