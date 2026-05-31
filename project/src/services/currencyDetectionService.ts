import {
  CURRENCY_DICTIONARY,
  isSupportedCurrency,
  type CurrencyCode,
} from '../constants/currencies';

/** EU member states → EUR when IP returns ISO country code. */
const EUROZONE_COUNTRY_CODES = new Set([
  'AT', 'BE', 'CY', 'DE', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'IE', 'IT', 'LT', 'LU',
  'LV', 'MT', 'NL', 'PT', 'SI', 'SK',
]);

const COUNTRY_CODE_TO_CURRENCY: Record<string, CurrencyCode> = (() => {
  const map: Record<string, CurrencyCode> = {};
  for (const code of Object.keys(CURRENCY_DICTIONARY) as CurrencyCode[]) {
    const cc = CURRENCY_DICTIONARY[code].countryCode.toUpperCase();
    if (cc === 'EU') continue;
    if (!map[cc]) map[cc] = code;
  }
  for (const cc of EUROZONE_COUNTRY_CODES) {
    map[cc] = 'EUR';
  }
  map.GB = 'GBP';
  map.UK = 'GBP';
  map.US = 'USD';
  map.IL = 'ILS';
  return map;
})();

const TIMEZONE_TO_CURRENCY: Record<string, CurrencyCode> = {
  'Asia/Jerusalem': 'ILS',
  'Asia/Tel_Aviv': 'ILS',
  'America/New_York': 'USD',
  'America/Chicago': 'USD',
  'America/Denver': 'USD',
  'America/Los_Angeles': 'USD',
  'America/Phoenix': 'USD',
  'America/Toronto': 'CAD',
  'America/Vancouver': 'CAD',
  'Europe/London': 'GBP',
  'Europe/Paris': 'EUR',
  'Europe/Berlin': 'EUR',
  'Europe/Rome': 'EUR',
  'Europe/Madrid': 'EUR',
  'Europe/Amsterdam': 'EUR',
  'Europe/Brussels': 'EUR',
  'Europe/Vienna': 'EUR',
  'Europe/Zurich': 'CHF',
  'Europe/Warsaw': 'PLN',
  'Europe/Prague': 'CZK',
  'Europe/Stockholm': 'SEK',
  'Europe/Oslo': 'NOK',
  'Europe/Copenhagen': 'DKK',
  'Europe/Helsinki': 'EUR',
  'Europe/Athens': 'EUR',
  'Europe/Bucharest': 'RON',
  'Europe/Istanbul': 'TRY',
  'Asia/Tokyo': 'JPY',
  'Asia/Seoul': 'KRW',
  'Asia/Shanghai': 'CNY',
  'Asia/Hong_Kong': 'HKD',
  'Asia/Singapore': 'SGD',
  'Asia/Bangkok': 'THB',
  'Asia/Dubai': 'AED',
  'Australia/Sydney': 'AUD',
  'Australia/Melbourne': 'AUD',
  'Pacific/Auckland': 'NZD',
};

function normalizeCountryCode(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length < 2) return null;
  return raw.trim().toUpperCase().slice(0, 2);
}

export function currencyFromCountryCode(countryCode: string): CurrencyCode | null {
  const cc = normalizeCountryCode(countryCode);
  if (!cc) return null;
  const mapped = COUNTRY_CODE_TO_CURRENCY[cc];
  return mapped && isSupportedCurrency(mapped) ? mapped : null;
}

export function isDetectedCurrencyAccepted(code: string): code is CurrencyCode {
  return isSupportedCurrency(code);
}

export function detectCurrencyFromTimezone(): CurrencyCode | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz) return null;

    const direct = TIMEZONE_TO_CURRENCY[tz];
    if (direct) return direct;

    if (tz.startsWith('Europe/') && tz !== 'Europe/London') {
      return 'EUR';
    }
    if (tz.startsWith('America/') && !tz.includes('Toronto') && !tz.includes('Vancouver')) {
      return 'USD';
    }
  } catch {
    return null;
  }
  return null;
}

interface IpCurrencyPayload {
  country_code?: string;
  country?: string;
  currency?: string;
}

async function detectCurrencyFromIp(): Promise<CurrencyCode | null> {
  try {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 6000);

    const response = await fetch('https://ipapi.co/json/', {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    window.clearTimeout(timeout);

    if (!response.ok) return null;

    const data = (await response.json()) as IpCurrencyPayload;

    const fromCountry = data.country_code
      ? currencyFromCountryCode(data.country_code)
      : null;
    if (fromCountry) return fromCountry;

    const currencyRaw = typeof data.currency === 'string' ? data.currency.toUpperCase() : '';
    if (currencyRaw && isSupportedCurrency(currencyRaw)) {
      return currencyRaw;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Hybrid local currency detection: IP geolocation with timezone fallback.
 * When both agree, that code is returned; otherwise IP wins, then timezone.
 */
export async function detectLocalCurrency(): Promise<CurrencyCode | null> {
  const [fromIp, fromTz] = await Promise.all([
    detectCurrencyFromIp(),
    Promise.resolve(detectCurrencyFromTimezone()),
  ]);

  if (fromIp && fromTz && fromIp === fromTz) return fromIp;
  if (fromIp) return fromIp;
  if (fromTz) return fromTz;
  return null;
}
