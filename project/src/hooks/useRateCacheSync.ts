import { useEffect, useRef } from 'react';
import type { User } from 'firebase/auth';
import type { ExpenseCurrency } from '../constants/currencies';
import {
  saveRateCacheToCloud,
  shouldSyncToFirestore,
  subscribeRateCache,
} from '../services/userFirebaseSync';
import {
  ensureRate,
  getRateCacheSnapshot,
  mergeRemoteRateCache,
  refreshStaleLiveRates,
  resetRateCacheMemory,
  subscribeRateCacheUpdated,
  syncManualRate,
} from '../services/rateCacheService';
import {
  listActiveManualExchangeOverrides,
  subscribeManualOverridesUpdated,
} from '../services/manualExchangeOverrideService';
import { getLocalTodayIso } from '../services/exchangeRateService';

const CLOUD_SAVE_DEBOUNCE_MS = 1500;

export interface UseRateCacheSyncOptions {
  user: User | null;
  authReady: boolean;
  /** App display currency — used to pre-warm direct-pair cache entries. */
  displayCurrency?: ExpenseCurrency;
  /** Pinned / favorite currencies for pair warm-up. */
  warmupCurrencies?: ReadonlyArray<ExpenseCurrency>;
}

function warmDirectPairCache(
  displayCurrency: ExpenseCurrency | undefined,
  warmupCurrencies: ReadonlyArray<ExpenseCurrency> | undefined,
): void {
  if (!displayCurrency) return;

  const today = getLocalTodayIso();
  const codes = new Set<ExpenseCurrency>([displayCurrency, ...(warmupCurrencies ?? [])]);

  for (const from of codes) {
    for (const to of codes) {
      if (from === to) continue;
      void ensureRate(today, from, to);
    }
  }
}

/**
 * Wires the offline-first rate-cache ledger to its persistence layers:
 *   • Authenticated members → Firebase (`rate_cache/data`), merged in both
 *     directions so freshly fetched API rates fan out across devices.
 *   • Guests → localStorage only (handled inside `rateCacheService`).
 *
 * It also (a) mirrors active manual overrides into the unified schema so the
 * ledger is self-describing, and (b) runs a background sweep that refreshes any
 * stale live-date API rate — even when a manual override is currently winning —
 * on mount, on reconnect, and on window focus.
 */
export function useRateCacheSync({
  user,
  authReady,
  displayCurrency,
  warmupCurrencies,
}: UseRateCacheSyncOptions): void {
  const cloudSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Mirror manual overrides into the ledger + background-refresh sweep ──
  useEffect(() => {
    if (!authReady) return;

    const mirrorManualRates = () => {
      const today = getLocalTodayIso();
      for (const entry of listActiveManualExchangeOverrides()) {
        syncManualRate(today, entry.baseCurrency, entry.quoteCurrency);
      }
    };

    const runRefresh = () => {
      mirrorManualRates();
      warmDirectPairCache(displayCurrency, warmupCurrencies);
      void refreshStaleLiveRates();
    };

    runRefresh();

    const unsubOverrides = subscribeManualOverridesUpdated(runRefresh);
    const onFocus = () => runRefresh();
    const onOnline = () => runRefresh();
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onOnline);

    return () => {
      unsubOverrides();
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onOnline);
    };
  }, [authReady, user?.uid, displayCurrency, warmupCurrencies]);

  // ── Firebase: subscribe (merge down) + debounced save (push up) ─────────
  useEffect(() => {
    if (!authReady || !shouldSyncToFirestore(user)) {
      resetRateCacheMemory();
      return;
    }

    const uid = user.uid;
    let cancelled = false;

    const unsubCloud = subscribeRateCache(uid, (remote, meta) => {
      if (cancelled || meta.hasPendingWrites) return;
      mergeRemoteRateCache(remote);
    });

    const scheduleCloudSave = () => {
      if (cloudSaveTimer.current) clearTimeout(cloudSaveTimer.current);
      cloudSaveTimer.current = setTimeout(() => {
        if (cancelled) return;
        void saveRateCacheToCloud(uid, getRateCacheSnapshot()).catch(() => {
          // Offline / transient — local cache remains authoritative; next change retries.
        });
      }, CLOUD_SAVE_DEBOUNCE_MS);
    };

    const unsubLocal = subscribeRateCacheUpdated(scheduleCloudSave);

    return () => {
      cancelled = true;
      unsubCloud();
      unsubLocal();
      if (cloudSaveTimer.current) {
        clearTimeout(cloudSaveTimer.current);
        cloudSaveTimer.current = null;
      }
    };
  }, [authReady, user]);
}
