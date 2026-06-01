import type { Lang } from '../translations';

/** Survives logout; used by login screen and profile language sync. */
export const PREFERRED_LANGUAGE_STORAGE_KEY = 'preferred_language';

export const GUEST_LANG_STORAGE_KEY = 'guest_lang';
export const PENDING_AUTH_LANG_STORAGE_KEY = 'pending_auth_lang';
export const AUTH_PAGE_LANG_STORAGE_KEY = 'auth_page_lang';
export const GUEST_LANG_ACTIVE_FLAG = 'guest_lang_active';

function readSessionLang(key: string): Lang | null {
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw === 'he' || raw === 'en' ? raw : null;
  } catch {
    return null;
  }
}

function writeSessionLang(key: string, lang: Lang): void {
  try {
    window.sessionStorage.setItem(key, lang);
  } catch {
    // Ignore quota / private mode errors.
  }
}

export function readGuestLang(): Lang | null {
  return readSessionLang(GUEST_LANG_STORAGE_KEY);
}

export function writeGuestLang(lang: Lang): void {
  writeSessionLang(GUEST_LANG_STORAGE_KEY, lang);
}

export function readAuthPageLang(): Lang | null {
  return readSessionLang(AUTH_PAGE_LANG_STORAGE_KEY);
}

export function writeAuthPageLang(lang: Lang): void {
  writeSessionLang(AUTH_PAGE_LANG_STORAGE_KEY, lang);
}

export function clearAuthPageLang(): void {
  try {
    window.sessionStorage.removeItem(AUTH_PAGE_LANG_STORAGE_KEY);
  } catch {
    // Ignore.
  }
}

export function writePendingAuthLang(lang: Lang): void {
  writeSessionLang(PENDING_AUTH_LANG_STORAGE_KEY, lang);
}

export function consumePendingAuthLang(): Lang | null {
  const pending = readSessionLang(PENDING_AUTH_LANG_STORAGE_KEY);
  try {
    window.sessionStorage.removeItem(PENDING_AUTH_LANG_STORAGE_KEY);
  } catch {
    // Ignore.
  }
  return pending;
}

export function setGuestLangActive(active: boolean): void {
  try {
    if (active) {
      window.sessionStorage.setItem(GUEST_LANG_ACTIVE_FLAG, '1');
    } else {
      window.sessionStorage.removeItem(GUEST_LANG_ACTIVE_FLAG);
    }
  } catch {
    // Ignore.
  }
}

export function isGuestLangActive(): boolean {
  try {
    return window.sessionStorage.getItem(GUEST_LANG_ACTIVE_FLAG) === '1';
  } catch {
    return false;
  }
}

function readLocalLang(key: string): Lang | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === 'he' || raw === 'en' ? raw : null;
  } catch {
    return null;
  }
}

function writeLocalLang(key: string, lang: Lang): void {
  try {
    window.localStorage.setItem(key, lang);
  } catch {
    // Ignore quota / private mode errors.
  }
}

export function readPreferredLanguage(): Lang | null {
  return readLocalLang(PREFERRED_LANGUAGE_STORAGE_KEY);
}

export function writePreferredLanguage(lang: Lang): void {
  writeLocalLang(PREFERRED_LANGUAGE_STORAGE_KEY, lang);
}

export function resolveAuthPageInitialLang(): Lang | null {
  return readAuthPageLang() ?? readGuestLang() ?? readPreferredLanguage();
}
