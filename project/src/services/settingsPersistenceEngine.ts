import type { User } from 'firebase/auth';
import { auth } from '../firebase';
import {
  EMPTY_USER_SETTINGS,
  loadLegacySettingsFromLocalStorage,
  parseUserSettingsRecord,
  saveSettingsToCloud,
  shouldSyncToFirestore,
  type UserSettings,
} from './userFirebaseSync';
import { saveThemePreferencesToStorage } from './buttonThemeService';
import { readPreferredLanguage } from './authLanguagePreference';

/**
 * SECURITY & UX GUARDRAIL: Multi-user device isolation is mandatory. Registered accounts
 * must read/write exclusively from/to Firebase. Guest profiles must read/write exclusively
 * from/to LocalStorage. A session transition must completely isolate the data streams to
 * ensure no preference bleed or layout contamination occurs.
 */

/** Standardized guest preferences blob — unauthenticated sessions only. */
export const GUEST_PREFERENCES_LS_KEY = 'app_guest_preferences';

/** Keys that belong to the guest preference namespace and must survive registered logout. */
export const GUEST_PREFERENCE_STORAGE_KEYS = [
  GUEST_PREFERENCES_LS_KEY,
  'guest_theme_preferences',
  'guest_text_theme',
  'guest_avatar',
  'preferred_language',
] as const;

/** Debounce window for cloud/local persistence writes. */
export const SETTINGS_SYNC_DEBOUNCE_MS = 500;

export type SettingsPersistenceRoute = 'cloud' | 'local';

export type SettingsSyncStatus = 'idle' | 'hydrating' | 'saving' | 'saved' | 'error';

export type AuthSessionKind = 'none' | 'guest' | 'registered';

export interface SettingsPersistenceSnapshot {
  lang: UserSettings['lang'];
  keepOriginalValues: boolean;
  displayCurrency: UserSettings['displayCurrency'];
  saved_colors: string[];
  custom_currencies: UserSettings['custom_currencies'];
  currency_layout: UserSettings['currency_layout'];
  themePreferences: UserSettings['themePreferences'];
}

/** Classify the active auth session for persistence routing. */
export function classifyAuthSession(user: User | null): AuthSessionKind {
  if (!user) return 'none';
  if (user.isAnonymous) return 'guest';
  return 'registered';
}

/** True only when guest LocalStorage may be read or written. */
export function canAccessGuestPreferencesStorage(user: User | null): boolean {
  return !shouldSyncToFirestore(user);
}

/** Resolve persistence route from the current Firebase Auth session. */
export function resolveSettingsPersistenceRoute(user: User | null): SettingsPersistenceRoute {
  return shouldSyncToFirestore(user) ? 'cloud' : 'local';
}

/** Clean-slate defaults while waiting for a registered user's Firebase snapshot. */
export function getIsolatedCloudSessionSeed(): UserSettings {
  return {
    ...EMPTY_USER_SETTINGS,
    themePreferences: { ...EMPTY_USER_SETTINGS.themePreferences },
  };
}

/** Build a normalized settings snapshot from live UI state. */
export function buildSettingsPersistenceSnapshot(
  snapshot: SettingsPersistenceSnapshot,
): UserSettings {
  return {
    lang: snapshot.lang,
    keepOriginalValues: snapshot.keepOriginalValues,
    displayCurrency: snapshot.displayCurrency,
    saved_colors: snapshot.saved_colors,
    custom_currencies: snapshot.custom_currencies,
    currency_layout: snapshot.currency_layout,
    themePreferences: snapshot.themePreferences,
  };
}

/**
 * Guest hydration — reads guest namespace only.
 * Registered sessions must never call this; they receive cloud defaults instead.
 */
export function hydrateGuestSettings(user: User | null = auth.currentUser): UserSettings {
  if (!canAccessGuestPreferencesStorage(user)) {
    return getIsolatedCloudSessionSeed();
  }

  try {
    const blob = window.localStorage.getItem(GUEST_PREFERENCES_LS_KEY);
    if (blob) {
      return parseUserSettingsRecord(JSON.parse(blob));
    }
  } catch {
    // Fall through to legacy keys.
  }

  const legacy = loadLegacySettingsFromLocalStorage();
  const preferred = readPreferredLanguage();
  if (preferred === 'he' || preferred === 'en') {
    return { ...legacy, lang: preferred };
  }
  return legacy;
}

/** Mirror settings into legacy localStorage keys (theme-boot.js + backward compatibility). */
function mirrorGuestSettingsToLegacyKeys(settings: UserSettings): void {
  window.localStorage.setItem('money-manager-language', settings.lang);
  window.localStorage.setItem(
    'money-manager-keep-original-values',
    String(settings.keepOriginalValues),
  );
  window.localStorage.setItem('money-manager-display-currency', settings.displayCurrency);
  window.localStorage.setItem('saved_colors', JSON.stringify(settings.saved_colors));
  window.localStorage.setItem(
    'money-manager-custom-currencies',
    JSON.stringify(settings.custom_currencies),
  );
  window.localStorage.setItem(
    'money-manager-currency-layout',
    JSON.stringify(settings.currency_layout),
  );
  saveThemePreferencesToStorage(settings.themePreferences);
}

/** Persist guest/anonymous settings to local browser storage. */
export function persistGuestSettings(
  settings: UserSettings,
  user: User | null = auth.currentUser,
): void {
  if (!canAccessGuestPreferencesStorage(user)) return;

  try {
    window.localStorage.setItem(GUEST_PREFERENCES_LS_KEY, JSON.stringify(settings));
    mirrorGuestSettingsToLegacyKeys(settings);
  } catch {
    // Storage unavailable — non-fatal.
  }
}

/** Route-aware persistence — Firestore for registered users, LocalStorage for guests. */
export async function persistSettingsWithRoute(
  user: User | null,
  settings: UserSettings,
): Promise<void> {
  const route = resolveSettingsPersistenceRoute(user);
  if (route === 'cloud') {
    const currentUser = auth.currentUser;
    if (!currentUser || currentUser.isAnonymous) return;
    await saveSettingsToCloud(currentUser.uid, settings);
    return;
  }
  persistGuestSettings(settings, user);
}

export type ApplySettingsFn = (settings: UserSettings) => void;

/** Reset in-memory UI to cloud-session defaults — ignores device guest layout. */
export function applyIsolatedCloudSessionSeed(apply: ApplySettingsFn): void {
  apply(getIsolatedCloudSessionSeed());
}

/** After logout, re-hydrate exclusively from the guest LocalStorage namespace. */
export function rehydrateIsolatedGuestSession(apply: ApplySettingsFn): void {
  apply(hydrateGuestSettings(null));
}

/** Detect meaningful auth-session transitions (login, logout, guest ↔ registered). */
export function didAuthSessionChange(
  previous: User | null,
  next: User | null,
): boolean {
  if (previous === next) return false;
  if (!previous || !next) return true;
  if (previous.uid !== next.uid) return true;
  if (previous.isAnonymous !== next.isAnonymous) return true;
  return false;
}
