export interface CurrencyMeta {
  symbol: string;
  name: string;
  countries: string;
  /** ISO 3166-1 alpha-2 (lowercase) for FlagCDN — e.g. us, il, eu */
  countryCode: string;
}

/** Core currencies always pinned in the settings bar. */
export const CORE_CURRENCY_CODES = ['ILS', 'USD', 'EUR', 'GBP'] as const;
export type CoreCurrencyCode = (typeof CORE_CURRENCY_CODES)[number];

/**
 * Major global currencies for the in-app library (alphabetically keyed).
 * Conversion rates for all ISO codes come from the exchange-rate API cache.
 */
export const CURRENCY_DICTIONARY = {
  AED: { symbol: 'د.إ', name: 'UAE Dirham', countries: 'United Arab Emirates', countryCode: 'ae' },
  AFN: { symbol: '؋', name: 'Afghan Afghani', countries: 'Afghanistan', countryCode: 'af' },
  ALL: { symbol: 'L', name: 'Albanian Lek', countries: 'Albania', countryCode: 'al' },
  ARS: { symbol: '$', name: 'Argentine Peso', countries: 'Argentina', countryCode: 'ar' },
  AUD: { symbol: '$', name: 'Australian Dollar', countries: 'Australia', countryCode: 'au' },
  BDT: { symbol: '৳', name: 'Bangladeshi Taka', countries: 'Bangladesh', countryCode: 'bd' },
  BGN: { symbol: 'лв', name: 'Bulgarian Lev', countries: 'Bulgaria', countryCode: 'bg' },
  BHD: { symbol: 'BD', name: 'Bahraini Dinar', countries: 'Bahrain', countryCode: 'bh' },
  BND: { symbol: '$', name: 'Brunei Dollar', countries: 'Brunei', countryCode: 'bn' },
  BOB: { symbol: 'Bs', name: 'Bolivian Boliviano', countries: 'Bolivia', countryCode: 'bo' },
  BRL: { symbol: 'R$', name: 'Brazilian Real', countries: 'Brazil', countryCode: 'br' },
  BWP: { symbol: 'P', name: 'Botswana Pula', countries: 'Botswana', countryCode: 'bw' },
  CAD: { symbol: '$', name: 'Canadian Dollar', countries: 'Canada', countryCode: 'ca' },
  CHF: { symbol: 'CHF', name: 'Swiss Franc', countries: 'Switzerland', countryCode: 'ch' },
  CLP: { symbol: '$', name: 'Chilean Peso', countries: 'Chile', countryCode: 'cl' },
  CNY: { symbol: '¥', name: 'Chinese Yuan', countries: 'China', countryCode: 'cn' },
  COP: { symbol: '$', name: 'Colombian Peso', countries: 'Colombia', countryCode: 'co' },
  CZK: { symbol: 'Kč', name: 'Czech Koruna', countries: 'Czech Republic', countryCode: 'cz' },
  DKK: { symbol: 'kr', name: 'Danish Krone', countries: 'Denmark', countryCode: 'dk' },
  DZD: { symbol: 'DA', name: 'Algerian Dinar', countries: 'Algeria', countryCode: 'dz' },
  EGP: { symbol: 'E£', name: 'Egyptian Pound', countries: 'Egypt', countryCode: 'eg' },
  ETB: { symbol: 'Br', name: 'Ethiopian Birr', countries: 'Ethiopia', countryCode: 'et' },
  EUR: { symbol: '€', name: 'Euro', countries: 'Eurozone', countryCode: 'eu' },
  GBP: { symbol: '£', name: 'British Pound', countries: 'United Kingdom', countryCode: 'gb' },
  GEL: { symbol: '₾', name: 'Georgian Lari', countries: 'Georgia', countryCode: 'ge' },
  GHS: { symbol: '₵', name: 'Ghanaian Cedi', countries: 'Ghana', countryCode: 'gh' },
  HKD: { symbol: '$', name: 'Hong Kong Dollar', countries: 'Hong Kong', countryCode: 'hk' },
  HRK: { symbol: 'kn', name: 'Croatian Kuna', countries: 'Croatia', countryCode: 'hr' },
  HUF: { symbol: 'Ft', name: 'Hungarian Forint', countries: 'Hungary', countryCode: 'hu' },
  IDR: { symbol: 'Rp', name: 'Indonesian Rupiah', countries: 'Indonesia', countryCode: 'id' },
  ILS: { symbol: '₪', name: 'Israeli Shekel', countries: 'Israel', countryCode: 'il' },
  INR: { symbol: '₹', name: 'Indian Rupee', countries: 'India', countryCode: 'in' },
  IQD: { symbol: 'IQD', name: 'Iraqi Dinar', countries: 'Iraq', countryCode: 'iq' },
  IRR: { symbol: 'IRR', name: 'Iranian Rial', countries: 'Iran', countryCode: 'ir' },
  ISK: { symbol: 'kr', name: 'Icelandic Króna', countries: 'Iceland', countryCode: 'is' },
  JMD: { symbol: '$', name: 'Jamaican Dollar', countries: 'Jamaica', countryCode: 'jm' },
  JOD: { symbol: 'JD', name: 'Jordanian Dinar', countries: 'Jordan', countryCode: 'jo' },
  JPY: { symbol: '¥', name: 'Japanese Yen', countries: 'Japan', countryCode: 'jp' },
  KES: { symbol: 'KSh', name: 'Kenyan Shilling', countries: 'Kenya', countryCode: 'ke' },
  KHR: { symbol: '៛', name: 'Cambodian Riel', countries: 'Cambodia', countryCode: 'kh' },
  KRW: { symbol: '₩', name: 'South Korean Won', countries: 'South Korea', countryCode: 'kr' },
  KWD: { symbol: 'KD', name: 'Kuwaiti Dinar', countries: 'Kuwait', countryCode: 'kw' },
  KZT: { symbol: '₸', name: 'Kazakhstani Tenge', countries: 'Kazakhstan', countryCode: 'kz' },
  LBP: { symbol: 'L£', name: 'Lebanese Pound', countries: 'Lebanon', countryCode: 'lb' },
  LKR: { symbol: 'Rs', name: 'Sri Lankan Rupee', countries: 'Sri Lanka', countryCode: 'lk' },
  MAD: { symbol: 'DH', name: 'Moroccan Dirham', countries: 'Morocco', countryCode: 'ma' },
  MMK: { symbol: 'K', name: 'Myanmar Kyat', countries: 'Myanmar', countryCode: 'mm' },
  MXN: { symbol: '$', name: 'Mexican Peso', countries: 'Mexico', countryCode: 'mx' },
  MYR: { symbol: 'RM', name: 'Malaysian Ringgit', countries: 'Malaysia', countryCode: 'my' },
  NGN: { symbol: '₦', name: 'Nigerian Naira', countries: 'Nigeria', countryCode: 'ng' },
  NOK: { symbol: 'kr', name: 'Norwegian Krone', countries: 'Norway', countryCode: 'no' },
  NPR: { symbol: 'Rs', name: 'Nepalese Rupee', countries: 'Nepal', countryCode: 'np' },
  NZD: { symbol: '$', name: 'New Zealand Dollar', countries: 'New Zealand', countryCode: 'nz' },
  OMR: { symbol: 'OMR', name: 'Omani Rial', countries: 'Oman', countryCode: 'om' },
  PEN: { symbol: 'S/', name: 'Peruvian Sol', countries: 'Peru', countryCode: 'pe' },
  PHP: { symbol: '₱', name: 'Philippine Peso', countries: 'Philippines', countryCode: 'ph' },
  PKR: { symbol: 'Rs', name: 'Pakistani Rupee', countries: 'Pakistan', countryCode: 'pk' },
  PLN: { symbol: 'zł', name: 'Polish Złoty', countries: 'Poland', countryCode: 'pl' },
  QAR: { symbol: 'QR', name: 'Qatari Riyal', countries: 'Qatar', countryCode: 'qa' },
  RON: { symbol: 'lei', name: 'Romanian Leu', countries: 'Romania', countryCode: 'ro' },
  RSD: { symbol: 'din', name: 'Serbian Dinar', countries: 'Serbia', countryCode: 'rs' },
  RUB: { symbol: '₽', name: 'Russian Ruble', countries: 'Russia', countryCode: 'ru' },
  SAR: { symbol: 'SR', name: 'Saudi Riyal', countries: 'Saudi Arabia', countryCode: 'sa' },
  SEK: { symbol: 'kr', name: 'Swedish Krona', countries: 'Sweden', countryCode: 'se' },
  SGD: { symbol: '$', name: 'Singapore Dollar', countries: 'Singapore', countryCode: 'sg' },
  THB: { symbol: '฿', name: 'Thai Baht', countries: 'Thailand', countryCode: 'th' },
  TND: { symbol: 'DT', name: 'Tunisian Dinar', countries: 'Tunisia', countryCode: 'tn' },
  TRY: { symbol: '₺', name: 'Turkish Lira', countries: 'Turkey', countryCode: 'tr' },
  TWD: { symbol: 'NT$', name: 'New Taiwan Dollar', countries: 'Taiwan', countryCode: 'tw' },
  TZS: { symbol: 'TSh', name: 'Tanzanian Shilling', countries: 'Tanzania', countryCode: 'tz' },
  UAH: { symbol: '₴', name: 'Ukrainian Hryvnia', countries: 'Ukraine', countryCode: 'ua' },
  UGX: { symbol: 'USh', name: 'Ugandan Shilling', countries: 'Uganda', countryCode: 'ug' },
  USD: { symbol: '$', name: 'US Dollar', countries: 'United States', countryCode: 'us' },
  UYU: { symbol: '$U', name: 'Uruguayan Peso', countries: 'Uruguay', countryCode: 'uy' },
  VND: { symbol: '₫', name: 'Vietnamese Dong', countries: 'Vietnam', countryCode: 'vn' },
  ZAR: { symbol: 'R', name: 'South African Rand', countries: 'South Africa', countryCode: 'za' },
} as const satisfies Record<string, CurrencyMeta>;

export type CurrencyCode = keyof typeof CURRENCY_DICTIONARY;
export type ExpenseCurrency = CurrencyCode;

const CORE_SET = new Set<string>(CORE_CURRENCY_CODES);

/** Library entries: all dictionary currencies except the 4 core pinned defaults. */
export const LIBRARY_CURRENCY_CODES = (Object.keys(CURRENCY_DICTIONARY) as CurrencyCode[])
  .filter((code) => !CORE_SET.has(code))
  .sort((a, b) => a.localeCompare(b));

export function isIsoCurrencyCode(code: string): boolean {
  return /^[A-Z]{3}$/.test(code);
}

export function isSupportedCurrency(code: string): code is CurrencyCode {
  return code in CURRENCY_DICTIONARY;
}

export function isCoreCurrency(code: string): code is CoreCurrencyCode {
  return CORE_SET.has(code);
}

export function getCurrencyMeta(code: string): CurrencyMeta {
  if (isSupportedCurrency(code)) return CURRENCY_DICTIONARY[code];
  return { symbol: code, name: code, countries: '', countryCode: '' };
}

export function currencySymbol(code: string): string {
  return getCurrencyMeta(code).symbol;
}

export function currencyCountryCode(code: string): string {
  return getCurrencyMeta(code).countryCode;
}

export function normalizeCustomCurrencies(raw: unknown): CurrencyCode[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const result: CurrencyCode[] = [];
  for (const item of raw) {
    if (typeof item !== 'string' || !isSupportedCurrency(item) || isCoreCurrency(item)) continue;
    if (seen.has(item)) continue;
    seen.add(item);
    result.push(item);
  }
  return result;
}

export function normalizeDisplayCurrency(raw: unknown): CurrencyCode {
  if (typeof raw === 'string' && isSupportedCurrency(raw)) return raw;
  if (typeof raw === 'string' && isIsoCurrencyCode(raw)) return raw as CurrencyCode;
  return 'ILS';
}

export const CORE_DISPLAY_CURRENCIES = CORE_CURRENCY_CODES.map((code) => ({
  code,
  symbol: CURRENCY_DICTIONARY[code].symbol,
  countryCode: CURRENCY_DICTIONARY[code].countryCode,
  label: code,
}));

export function matchesCurrencySearch(code: CurrencyCode, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const meta = CURRENCY_DICTIONARY[code];
  return (
    code.toLowerCase().includes(q) ||
    meta.name.toLowerCase().includes(q) ||
    meta.countries.toLowerCase().includes(q) ||
    meta.symbol.toLowerCase().includes(q) ||
    meta.symbol.includes(query.trim()) ||
    meta.countryCode.includes(q)
  );
}

export function filterLibraryCurrencies(query: string): CurrencyCode[] {
  const trimmed = query.trim();
  if (!trimmed) return LIBRARY_CURRENCY_CODES;
  return LIBRARY_CURRENCY_CODES.filter((code) => matchesCurrencySearch(code, trimmed));
}
