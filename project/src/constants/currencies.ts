export interface CurrencyMeta {
  symbol: string;
  name: string;
  countries: string;
}

/** Core currencies always pinned in the settings bar. */
export const CORE_CURRENCY_CODES = ['ILS', 'USD', 'EUR', 'GBP'] as const;
export type CoreCurrencyCode = (typeof CORE_CURRENCY_CODES)[number];

/**
 * Major global currencies for the in-app library (alphabetically keyed).
 * Conversion rates for all ISO codes come from the exchange-rate API cache.
 */
export const CURRENCY_DICTIONARY = {
  AED: { symbol: 'د.إ', name: 'UAE Dirham', countries: 'United Arab Emirates' },
  AFN: { symbol: '؋', name: 'Afghan Afghani', countries: 'Afghanistan' },
  ALL: { symbol: 'L', name: 'Albanian Lek', countries: 'Albania' },
  ARS: { symbol: '$', name: 'Argentine Peso', countries: 'Argentina' },
  AUD: { symbol: '$', name: 'Australian Dollar', countries: 'Australia' },
  BDT: { symbol: '৳', name: 'Bangladeshi Taka', countries: 'Bangladesh' },
  BGN: { symbol: 'лв', name: 'Bulgarian Lev', countries: 'Bulgaria' },
  BHD: { symbol: 'BD', name: 'Bahraini Dinar', countries: 'Bahrain' },
  BND: { symbol: '$', name: 'Brunei Dollar', countries: 'Brunei' },
  BOB: { symbol: 'Bs', name: 'Bolivian Boliviano', countries: 'Bolivia' },
  BRL: { symbol: 'R$', name: 'Brazilian Real', countries: 'Brazil' },
  BWP: { symbol: 'P', name: 'Botswana Pula', countries: 'Botswana' },
  CAD: { symbol: '$', name: 'Canadian Dollar', countries: 'Canada' },
  CHF: { symbol: 'CHF', name: 'Swiss Franc', countries: 'Switzerland' },
  CLP: { symbol: '$', name: 'Chilean Peso', countries: 'Chile' },
  CNY: { symbol: '¥', name: 'Chinese Yuan', countries: 'China' },
  COP: { symbol: '$', name: 'Colombian Peso', countries: 'Colombia' },
  CZK: { symbol: 'Kč', name: 'Czech Koruna', countries: 'Czech Republic' },
  DKK: { symbol: 'kr', name: 'Danish Krone', countries: 'Denmark' },
  DZD: { symbol: 'DA', name: 'Algerian Dinar', countries: 'Algeria' },
  EGP: { symbol: 'E£', name: 'Egyptian Pound', countries: 'Egypt' },
  ETB: { symbol: 'Br', name: 'Ethiopian Birr', countries: 'Ethiopia' },
  EUR: { symbol: '€', name: 'Euro', countries: 'Eurozone' },
  GBP: { symbol: '£', name: 'British Pound', countries: 'United Kingdom' },
  GEL: { symbol: '₾', name: 'Georgian Lari', countries: 'Georgia' },
  GHS: { symbol: '₵', name: 'Ghanaian Cedi', countries: 'Ghana' },
  HKD: { symbol: '$', name: 'Hong Kong Dollar', countries: 'Hong Kong' },
  HRK: { symbol: 'kn', name: 'Croatian Kuna', countries: 'Croatia' },
  HUF: { symbol: 'Ft', name: 'Hungarian Forint', countries: 'Hungary' },
  IDR: { symbol: 'Rp', name: 'Indonesian Rupiah', countries: 'Indonesia' },
  ILS: { symbol: '₪', name: 'Israeli Shekel', countries: 'Israel' },
  INR: { symbol: '₹', name: 'Indian Rupee', countries: 'India' },
  IQD: { symbol: 'IQD', name: 'Iraqi Dinar', countries: 'Iraq' },
  IRR: { symbol: 'IRR', name: 'Iranian Rial', countries: 'Iran' },
  ISK: { symbol: 'kr', name: 'Icelandic Króna', countries: 'Iceland' },
  JMD: { symbol: '$', name: 'Jamaican Dollar', countries: 'Jamaica' },
  JOD: { symbol: 'JD', name: 'Jordanian Dinar', countries: 'Jordan' },
  JPY: { symbol: '¥', name: 'Japanese Yen', countries: 'Japan' },
  KES: { symbol: 'KSh', name: 'Kenyan Shilling', countries: 'Kenya' },
  KHR: { symbol: '៛', name: 'Cambodian Riel', countries: 'Cambodia' },
  KRW: { symbol: '₩', name: 'South Korean Won', countries: 'South Korea' },
  KWD: { symbol: 'KD', name: 'Kuwaiti Dinar', countries: 'Kuwait' },
  KZT: { symbol: '₸', name: 'Kazakhstani Tenge', countries: 'Kazakhstan' },
  LBP: { symbol: 'L£', name: 'Lebanese Pound', countries: 'Lebanon' },
  LKR: { symbol: 'Rs', name: 'Sri Lankan Rupee', countries: 'Sri Lanka' },
  MAD: { symbol: 'DH', name: 'Moroccan Dirham', countries: 'Morocco' },
  MMK: { symbol: 'K', name: 'Myanmar Kyat', countries: 'Myanmar' },
  MXN: { symbol: '$', name: 'Mexican Peso', countries: 'Mexico' },
  MYR: { symbol: 'RM', name: 'Malaysian Ringgit', countries: 'Malaysia' },
  NGN: { symbol: '₦', name: 'Nigerian Naira', countries: 'Nigeria' },
  NOK: { symbol: 'kr', name: 'Norwegian Krone', countries: 'Norway' },
  NPR: { symbol: 'Rs', name: 'Nepalese Rupee', countries: 'Nepal' },
  NZD: { symbol: '$', name: 'New Zealand Dollar', countries: 'New Zealand' },
  OMR: { symbol: 'OMR', name: 'Omani Rial', countries: 'Oman' },
  PEN: { symbol: 'S/', name: 'Peruvian Sol', countries: 'Peru' },
  PHP: { symbol: '₱', name: 'Philippine Peso', countries: 'Philippines' },
  PKR: { symbol: 'Rs', name: 'Pakistani Rupee', countries: 'Pakistan' },
  PLN: { symbol: 'zł', name: 'Polish Złoty', countries: 'Poland' },
  QAR: { symbol: 'QR', name: 'Qatari Riyal', countries: 'Qatar' },
  RON: { symbol: 'lei', name: 'Romanian Leu', countries: 'Romania' },
  RSD: { symbol: 'din', name: 'Serbian Dinar', countries: 'Serbia' },
  RUB: { symbol: '₽', name: 'Russian Ruble', countries: 'Russia' },
  SAR: { symbol: 'SR', name: 'Saudi Riyal', countries: 'Saudi Arabia' },
  SEK: { symbol: 'kr', name: 'Swedish Krona', countries: 'Sweden' },
  SGD: { symbol: '$', name: 'Singapore Dollar', countries: 'Singapore' },
  THB: { symbol: '฿', name: 'Thai Baht', countries: 'Thailand' },
  TND: { symbol: 'DT', name: 'Tunisian Dinar', countries: 'Tunisia' },
  TRY: { symbol: '₺', name: 'Turkish Lira', countries: 'Turkey' },
  TWD: { symbol: 'NT$', name: 'New Taiwan Dollar', countries: 'Taiwan' },
  TZS: { symbol: 'TSh', name: 'Tanzanian Shilling', countries: 'Tanzania' },
  UAH: { symbol: '₴', name: 'Ukrainian Hryvnia', countries: 'Ukraine' },
  UGX: { symbol: 'USh', name: 'Ugandan Shilling', countries: 'Uganda' },
  USD: { symbol: '$', name: 'US Dollar', countries: 'United States' },
  UYU: { symbol: '$U', name: 'Uruguayan Peso', countries: 'Uruguay' },
  VND: { symbol: '₫', name: 'Vietnamese Dong', countries: 'Vietnam' },
  ZAR: { symbol: 'R', name: 'South African Rand', countries: 'South Africa' },
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
  return { symbol: code, name: code, countries: '' };
}

export function currencySymbol(code: string): string {
  return getCurrencyMeta(code).symbol;
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
    meta.symbol.includes(query.trim())
  );
}

export function filterLibraryCurrencies(query: string): CurrencyCode[] {
  const trimmed = query.trim();
  if (!trimmed) return LIBRARY_CURRENCY_CODES;
  return LIBRARY_CURRENCY_CODES.filter((code) => matchesCurrencySearch(code, trimmed));
}
