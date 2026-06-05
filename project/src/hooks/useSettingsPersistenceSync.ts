import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import type { User } from 'firebase/auth';
import {
  applyIsolatedCloudSessionSeed,
  buildSettingsPersistenceSnapshot,
  classifyAuthSession,
  didAuthSessionChange,
  persistSettingsWithRoute,
  rehydrateIsolatedGuestSession,
  resolveSettingsPersistenceRoute,
  SETTINGS_SYNC_DEBOUNCE_MS,
  type SettingsPersistenceSnapshot,
  type SettingsSyncStatus,
} from '../services/settingsPersistenceEngine';
import { shouldSyncToFirestore } from '../services/userFirebaseSync';

/**
 * CRITICAL SYNC RULE: Interface states cannot rely solely on component memory.
 * All UI modifications within configuration scopes must trigger the persistent router
 * wrapper: Firebase for registered members, LocalStorage for guest users.
 */

export interface UseSettingsPersistenceSyncOptions extends SettingsPersistenceSnapshot {
  user: User | null;
  authReady: boolean;
  dataReady: boolean;
  settingsCloudReady: boolean;
  settingsPersistence: 'local' | 'cloud';
  skipNextSaveRef: MutableRefObject<boolean>;
  applySettingsFromCloud: (settings: SettingsPersistenceSnapshot & {
    button_theme?: SettingsPersistenceSnapshot['themePreferences']['buttons'];
  }) => void;
  /** When true, re-run guest hydration (e.g. Settings/Profile route opened). */
  hydrationTrigger?: boolean;
}

export interface SettingsPersistenceSyncValue {
  syncStatus: SettingsSyncStatus;
  isHydrated: boolean;
  persistenceRoute: ReturnType<typeof resolveSettingsPersistenceRoute>;
  sessionKind: ReturnType<typeof classifyAuthSession>;
  rehydrateGuestSettings: () => void;
}

export function useSettingsPersistenceSync(
  options: UseSettingsPersistenceSyncOptions,
): SettingsPersistenceSyncValue {
  const {
    user,
    authReady,
    dataReady,
    settingsCloudReady,
    settingsPersistence,
    skipNextSaveRef,
    applySettingsFromCloud,
    hydrationTrigger = true,
    lang,
    keepOriginalValues,
    displayCurrency,
    saved_colors,
    custom_currencies,
    currency_layout,
    themePreferences,
  } = options;

  const [syncStatus, setSyncStatus] = useState<SettingsSyncStatus>('idle');
  const [isHydrated, setIsHydrated] = useState(false);
  const savedResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistGenerationRef = useRef(0);
  const previousUserRef = useRef<User | null>(null);
  const persistenceRoute = resolveSettingsPersistenceRoute(user);
  const sessionKind = classifyAuthSession(user);

  const clearSavedResetTimer = useCallback(() => {
    if (savedResetTimerRef.current) {
      window.clearTimeout(savedResetTimerRef.current);
      savedResetTimerRef.current = null;
    }
  }, []);

  const markSaved = useCallback(() => {
    clearSavedResetTimer();
    setSyncStatus('saved');
    savedResetTimerRef.current = setTimeout(() => {
      setSyncStatus('idle');
      savedResetTimerRef.current = null;
    }, 2000);
  }, [clearSavedResetTimer]);

  const cancelPendingPersistence = useCallback(() => {
    persistGenerationRef.current += 1;
    clearSavedResetTimer();
  }, [clearSavedResetTimer]);

  const rehydrateGuestSettings = useCallback(() => {
    if (shouldSyncToFirestore(user)) return;
    setSyncStatus('hydrating');
    rehydrateIsolatedGuestSession(applySettingsFromCloud);
    setIsHydrated(true);
    setSyncStatus('idle');
  }, [applySettingsFromCloud, user]);

  const isolateForRegisteredSession = useCallback(() => {
    cancelPendingPersistence();
    skipNextSaveRef.current = true;
    setIsHydrated(false);
    setSyncStatus('idle');
    applyIsolatedCloudSessionSeed(applySettingsFromCloud);
  }, [applySettingsFromCloud, cancelPendingPersistence, skipNextSaveRef]);

  useEffect(() => {
    if (!authReady) return;

    const previous = previousUserRef.current;
    if (didAuthSessionChange(previous, user)) {
      cancelPendingPersistence();
      skipNextSaveRef.current = true;

      if (shouldSyncToFirestore(user)) {
        isolateForRegisteredSession();
      } else {
        rehydrateGuestSettings();
      }
    }

    previousUserRef.current = user;
  }, [
    authReady,
    cancelPendingPersistence,
    isolateForRegisteredSession,
    rehydrateGuestSettings,
    skipNextSaveRef,
    user,
  ]);

  useEffect(() => {
    if (!authReady || !hydrationTrigger) return;
    if (shouldSyncToFirestore(user)) {
      return;
    }
    if (isHydrated) return;
    rehydrateGuestSettings();
  }, [authReady, hydrationTrigger, isHydrated, rehydrateGuestSettings, user?.uid]);

  useEffect(() => {
    if (!authReady || !dataReady || !isHydrated) return;

    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }

    if (settingsPersistence === 'cloud') {
      if (!user || user.isAnonymous || !settingsCloudReady) return;
    } else if (shouldSyncToFirestore(user)) {
      return;
    }

    const generation = ++persistGenerationRef.current;
    setSyncStatus('saving');

    const timer = window.setTimeout(() => {
      if (generation !== persistGenerationRef.current) return;

      const snapshot = buildSettingsPersistenceSnapshot({
        lang,
        keepOriginalValues,
        displayCurrency,
        saved_colors,
        custom_currencies,
        currency_layout,
        themePreferences,
      });

      void persistSettingsWithRoute(user, snapshot)
        .then(() => {
          if (generation !== persistGenerationRef.current) return;
          markSaved();
        })
        .catch(() => {
          if (generation !== persistGenerationRef.current) return;
          setSyncStatus('error');
        });
    }, SETTINGS_SYNC_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    authReady,
    currency_layout,
    custom_currencies,
    dataReady,
    displayCurrency,
    isHydrated,
    keepOriginalValues,
    lang,
    markSaved,
    saved_colors,
    settingsCloudReady,
    settingsPersistence,
    skipNextSaveRef,
    themePreferences,
    user,
  ]);

  useEffect(() => {
    if (!authReady || !shouldSyncToFirestore(user)) return;
    if (settingsCloudReady) {
      setIsHydrated(true);
    }
  }, [authReady, settingsCloudReady, user]);

  useEffect(() => () => clearSavedResetTimer(), [clearSavedResetTimer]);

  return {
    syncStatus,
    isHydrated,
    persistenceRoute,
    sessionKind,
    rehydrateGuestSettings,
  };
}
