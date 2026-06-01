import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpDown, ChevronDown, Copy, Plus, Settings2, Trash2 } from 'lucide-react';
import { auth } from '../firebase';
import { LtrNumeric, useLanguage } from '../LanguageContext';
import { usePinnedCurrencies } from '../hooks/usePinnedCurrencies';
import {
  getCurrencyMeta,
  isCoreCurrency,
  type CurrencyCode,
  type ExpenseCurrency,
} from '../constants/currencies';
import CommissionSaveModal from './CommissionSaveModal';
import CurrencyFlag from './CurrencyFlag';
import CurrencyLibraryModal from './CurrencyLibraryModal';
import {
  applyCommissionToRate,
  parseCommissionPercentInput,
} from '../services/commissionMath';
import {
  getActiveCurrencyCommissionPercent,
  listActiveCurrencyCommissions,
  removeCloudCurrencyCommissionLocal,
  removeLocalCurrencyCommission,
  saveCurrencyCommission24h,
  subscribeCurrencyCommissionsUpdated,
  upsertCloudCurrencyCommission,
  type CurrencyCommissionEntry,
} from '../services/currencyCommissionService';
import {
  computeDirectUnitRateFromIlsPivot,
  fetchExchangeRates,
  fetchHistoricalDirectRateSnapshot,
  getLocalTodayIso,
  needsNetworkHistoricalFetch,
  peekHistoricalDirectRateSnapshot,
} from '../services/exchangeRateService';
import {
  listActiveManualExchangeOverrides,
  removeCloudManualExchangeOverride,
  removeLocalManualExchangeOverride,
  saveManualExchangeOverride24h,
  subscribeManualOverridesUpdated,
  upsertCloudManualExchangeOverride,
  type ManualExchangeOverrideEntry,
} from '../services/manualExchangeOverrideService';
import {
  deleteManualExchangeOverrideFromCloud,
  deleteCurrencyCommissionFromCloud,
  saveCurrencyCommissionToCloud,
  saveManualExchangeOverrideToCloud,
} from '../services/userFirebaseSync';

interface ExchangeRateSimulatorProps {
  recentExpenseCurrencies: ExpenseCurrency[];
}

type SelectorTarget = 'main' | 'secondary';
type SavePromptState = 'hidden' | 'shown' | 'saved';

const controlBaseClass =
  'h-12 rounded-xl border border-neutral-700 bg-neutral-800 px-3 text-sm text-neutral-100 transition-all outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 active:scale-[0.98]';

const toIsoDateLocal = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const yesterdayIso = (): string => {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return toIsoDateLocal(date);
};

function formatRate(rate: number): string {
  if (!Number.isFinite(rate)) return '-';
  if (rate >= 1000) return rate.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return rate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 });
}

function getDefaultSecondaryCurrency(
  mainCurrency: CurrencyCode,
  recentExpenseCurrencies: ExpenseCurrency[],
): CurrencyCode {
  return recentExpenseCurrencies.find((code) => code !== mainCurrency) ?? mainCurrency;
}

function parsePositiveAmount(value: string): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function formatAmountForInput(amount: number): string {
  if (!Number.isFinite(amount)) return '';
  const rounded = Math.round(amount * 1_000_000) / 1_000_000;
  return String(rounded);
}

function replaceTokens(template: string, tokens: Record<string, string | number>): string {
  return Object.entries(tokens).reduce((result, [key, value]) => {
    const pattern = new RegExp(`\\{${key}\\}`, 'g');
    return result.replace(pattern, String(value));
  }, template);
}

interface SessionOverride {
  baseCurrency: ExpenseCurrency;
  quoteCurrency: ExpenseCurrency;
  rate: number;
  dateIso: string;
  updatedAt: number;
}

type ManagementEntry =
  | { kind: 'session'; data: SessionOverride }
  | { kind: 'stored'; data: ManualExchangeOverrideEntry };

export default function ExchangeRateSimulator({
  recentExpenseCurrencies,
}: ExchangeRateSimulatorProps) {
  const { tr, dir, lang, displayCurrency, customCurrencies, replaceCustomCurrencies } = useLanguage();
  const pinnedCurrencies = usePinnedCurrencies();

  const [mainCurrency, setMainCurrency] = useState<CurrencyCode>(displayCurrency);
  const [secondaryCurrency, setSecondaryCurrency] = useState<CurrencyCode>(() =>
    getDefaultSecondaryCurrency(displayCurrency, recentExpenseCurrencies),
  );
  const [dateIso, setDateIso] = useState<string>(() => yesterdayIso());
  const [openSelector, setOpenSelector] = useState<SelectorTarget | null>(null);
  const [libraryTarget, setLibraryTarget] = useState<SelectorTarget | null>(null);

  const [manualExpanded, setManualExpanded] = useState(false);
  const [managementExpanded, setManagementExpanded] = useState(false);
  const [mainAmountInput, setMainAmountInput] = useState('1');
  const [secondaryAmountInput, setSecondaryAmountInput] = useState('');
  const [sessionOverride, setSessionOverride] = useState<SessionOverride | null>(null);
  const [savePrompt, setSavePrompt] = useState<SavePromptState>('hidden');
  const [cloudSaving, setCloudSaving] = useState(false);
  const [cloudError, setCloudError] = useState<string | null>(null);

  const [resolvedRate, setResolvedRate] = useState<number | null>(null);
  const [historicalRateUpdatedAt, setHistoricalRateUpdatedAt] = useState<number | null>(null);
  const [todayMarketRate, setTodayMarketRate] = useState<number | null>(null);
  const [loadingRate, setLoadingRate] = useState(false);
  const [storedOverrides, setStoredOverrides] = useState<ManualExchangeOverrideEntry[]>(() =>
    listActiveManualExchangeOverrides(),
  );
  const [, setClockTick] = useState(Date.now());
  const [commissionExpanded, setCommissionExpanded] = useState(false);
  const [commissionPercentInput, setCommissionPercentInput] = useState('2.5');
  const [commissionSaveModalOpen, setCommissionSaveModalOpen] = useState(false);
  const [commissionSaveError, setCommissionSaveError] = useState<string | null>(null);
  const [commissionCloudSaving, setCommissionCloudSaving] = useState(false);
  const [commissionManagementExpanded, setCommissionManagementExpanded] = useState(false);
  const [storedCommissions, setStoredCommissions] = useState<CurrencyCommissionEntry[]>(() =>
    listActiveCurrencyCommissions(),
  );
  const [copyFeedback, setCopyFeedback] = useState(false);

  const selectorContainerRef = useRef<HTMLDivElement>(null);
  const shouldSeedSecondaryRef = useRef(true);
  const rateContextKeyRef = useRef('');
  const historicalFetchIdRef = useRef(0);

  const formatRemainingTime = useCallback(
    (expiresAt: number): string => {
      const diffMs = Math.max(0, expiresAt - Date.now());
      const totalMinutes = Math.ceil(diffMs / 60000);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      return replaceTokens(tr('exchangeRateRemainingTime'), { hours, minutes });
    },
    [tr],
  );

  const applyUnitRateOverride = useCallback(
    (unitRate: number) => {
      if (!(unitRate > 0) || mainCurrency === secondaryCurrency) return;
      setSessionOverride({
        baseCurrency: mainCurrency,
        quoteCurrency: secondaryCurrency,
        rate: unitRate,
        dateIso,
        updatedAt: Date.now(),
      });
      setResolvedRate(unitRate);
      setHistoricalRateUpdatedAt(Date.now());
      setSavePrompt('shown');
      setCloudError(null);
    },
    [dateIso, mainCurrency, secondaryCurrency],
  );

  const formatHistoricalRateUpdatedLabel = useCallback(
    (timestamp: number): string => {
      const time = new Date(timestamp).toLocaleTimeString(lang === 'he' ? 'he-IL' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      return replaceTokens(tr('exchangeRateLastUpdated'), { time });
    },
    [lang, tr],
  );

  const clearManualOverrideState = useCallback(() => {
    setSessionOverride(null);
    setSavePrompt('hidden');
    setCloudError(null);
  }, []);

  const refreshStoredOverrides = useCallback(() => {
    setStoredOverrides(listActiveManualExchangeOverrides());
  }, []);

  const refreshStoredCommissions = useCallback(() => {
    setStoredCommissions(listActiveCurrencyCommissions());
  }, []);

  useEffect(() => {
    setMainCurrency(displayCurrency);
  }, [displayCurrency]);

  useEffect(() => {
    setSecondaryCurrency((current) => {
      if (current !== mainCurrency) return current;
      return getDefaultSecondaryCurrency(mainCurrency, recentExpenseCurrencies);
    });
  }, [mainCurrency, recentExpenseCurrencies]);

  useEffect(() => {
    setSessionOverride(null);
    setMainAmountInput('1');
    setSecondaryAmountInput('');
    setSavePrompt('hidden');
    setCloudError(null);
    shouldSeedSecondaryRef.current = true;
  }, [mainCurrency, secondaryCurrency]);

  useEffect(() => {
    setSessionOverride(null);
    setSavePrompt('hidden');
    setCloudError(null);
    shouldSeedSecondaryRef.current = true;
  }, [dateIso]);

  const activeSessionRate = useMemo(() => {
    if (
      sessionOverride &&
      sessionOverride.baseCurrency === mainCurrency &&
      sessionOverride.quoteCurrency === secondaryCurrency &&
      sessionOverride.dateIso === dateIso &&
      sessionOverride.rate > 0
    ) {
      return sessionOverride.rate;
    }
    return null;
  }, [dateIso, mainCurrency, secondaryCurrency, sessionOverride]);

  useEffect(() => {
    const rateContextKey = `${dateIso}|${mainCurrency}|${secondaryCurrency}|${sessionOverride?.rate ?? resolvedRate ?? ''}|${commissionExpanded}|${commissionPercentInput}`;
    if (rateContextKeyRef.current !== rateContextKey) {
      rateContextKeyRef.current = rateContextKey;
      shouldSeedSecondaryRef.current = true;
    }
  }, [
    dateIso,
    mainCurrency,
    secondaryCurrency,
    resolvedRate,
    sessionOverride?.rate,
    commissionExpanded,
    commissionPercentInput,
  ]);

  useEffect(() => {
    if (mainCurrency === secondaryCurrency) return;

    const unitRate =
      sessionOverride &&
      sessionOverride.baseCurrency === mainCurrency &&
      sessionOverride.quoteCurrency === secondaryCurrency &&
      sessionOverride.dateIso === dateIso
        ? sessionOverride.rate
        : resolvedRate;

    if (unitRate == null || !(unitRate > 0)) return;
    if (!shouldSeedSecondaryRef.current) return;

    const mainAmount = parsePositiveAmount(mainAmountInput) ?? 1;
    const commissionPercent =
      commissionExpanded && parseCommissionPercentInput(commissionPercentInput) > 0
        ? parseCommissionPercentInput(commissionPercentInput)
        : getActiveCurrencyCommissionPercent(secondaryCurrency) ?? 0;
    const conversionRate = applyCommissionToRate(unitRate, commissionPercent);
    setSecondaryAmountInput(formatAmountForInput(mainAmount * conversionRate));
    shouldSeedSecondaryRef.current = false;
  }, [
    resolvedRate,
    mainCurrency,
    secondaryCurrency,
    sessionOverride,
    mainAmountInput,
    dateIso,
    commissionExpanded,
    commissionPercentInput,
  ]);

  useEffect(() => {
    const fetchId = ++historicalFetchIdRef.current;
    let cancelled = false;

    const applyResolvedRate = (rate: number | null, fetchedAt: number | null) => {
      if (cancelled || fetchId !== historicalFetchIdRef.current) return;
      setResolvedRate(rate);
      if (fetchedAt != null) {
        setHistoricalRateUpdatedAt(fetchedAt);
      }
      setLoadingRate(false);
      shouldSeedSecondaryRef.current = true;
    };

    if (mainCurrency === secondaryCurrency) {
      applyResolvedRate(1, Date.now());
      return () => {
        cancelled = true;
      };
    }

    if (activeSessionRate != null) {
      applyResolvedRate(activeSessionRate, sessionOverride?.updatedAt ?? Date.now());
      return () => {
        cancelled = true;
      };
    }

    const cachedSnapshot = peekHistoricalDirectRateSnapshot(dateIso, mainCurrency, secondaryCurrency);
    if (cachedSnapshot.rate != null) {
      applyResolvedRate(cachedSnapshot.rate, cachedSnapshot.fetchedAt);
    } else {
      setHistoricalRateUpdatedAt(null);
      setLoadingRate(true);
    }

    const shouldFetchFromNetwork = needsNetworkHistoricalFetch(dateIso, mainCurrency, secondaryCurrency);
    if (!shouldFetchFromNetwork) {
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      try {
        const snapshot = await fetchHistoricalDirectRateSnapshot(
          dateIso,
          mainCurrency,
          secondaryCurrency,
        );
        applyResolvedRate(snapshot.rate, snapshot.fetchedAt);
      } catch {
        applyResolvedRate(null, null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [dateIso, mainCurrency, secondaryCurrency, activeSessionRate, sessionOverride?.updatedAt]);

  useEffect(() => {
    const fetchTodayMarketRate = async () => {
      if (mainCurrency === secondaryCurrency) {
        setTodayMarketRate(1);
        return;
      }

      const liveRates = await fetchExchangeRates().catch(() => null);
      if (!liveRates) {
        setTodayMarketRate(null);
        return;
      }

      const marketRate = computeDirectUnitRateFromIlsPivot(
        mainCurrency,
        secondaryCurrency,
        liveRates.ilsToForeign,
      );
      setTodayMarketRate(marketRate != null && marketRate > 0 ? marketRate : null);
    };

    void fetchTodayMarketRate();
  }, [mainCurrency, secondaryCurrency]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (selectorContainerRef.current?.contains(target)) return;
      setOpenSelector(null);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  useEffect(() => {
    refreshStoredOverrides();
    const unsub = subscribeManualOverridesUpdated(() => refreshStoredOverrides());
    return unsub;
  }, [refreshStoredOverrides]);

  const syncCommissionInputFromStorage = useCallback((currency: CurrencyCode) => {
    const savedPercent = getActiveCurrencyCommissionPercent(currency);
    if (savedPercent != null) {
      setCommissionPercentInput(String(savedPercent));
    }
  }, []);

  useEffect(() => {
    syncCommissionInputFromStorage(secondaryCurrency);
  }, [secondaryCurrency, syncCommissionInputFromStorage]);

  useEffect(() => {
    const unsub = subscribeCurrencyCommissionsUpdated(() => {
      refreshStoredCommissions();
      syncCommissionInputFromStorage(secondaryCurrency);
      shouldSeedSecondaryRef.current = true;
    });
    return unsub;
  }, [secondaryCurrency, syncCommissionInputFromStorage, refreshStoredCommissions]);

  useEffect(() => {
    if (!commissionManagementExpanded) return;
    const timer = window.setInterval(() => {
      refreshStoredCommissions();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [commissionManagementExpanded, refreshStoredCommissions]);

  useEffect(() => {
    if (!managementExpanded) return;
    const timer = window.setInterval(() => {
      setClockTick(Date.now());
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [managementExpanded]);

  const selectableCurrencies = useMemo(() => {
    const all = new Set<CurrencyCode>([...pinnedCurrencies, mainCurrency, secondaryCurrency]);
    return Array.from(all);
  }, [mainCurrency, pinnedCurrencies, secondaryCurrency]);

  const managementEntries = useMemo<ManagementEntry[]>(() => {
    const items: ManagementEntry[] = storedOverrides.map((entry) => ({ kind: 'stored', data: entry }));

    if (
      sessionOverride &&
      !storedOverrides.some(
        (entry) =>
          entry.baseCurrency === sessionOverride.baseCurrency &&
          entry.quoteCurrency === sessionOverride.quoteCurrency,
      )
    ) {
      items.unshift({ kind: 'session', data: sessionOverride });
    }

    return items.sort((a, b) => {
      const aTime = a.kind === 'session' ? a.data.updatedAt : a.data.updatedAt;
      const bTime = b.kind === 'session' ? b.data.updatedAt : b.data.updatedAt;
      return bTime - aTime;
    });
  }, [sessionOverride, storedOverrides]);

  const pinTemporaryCurrency = useCallback(
    (code: CurrencyCode) => {
      if (isCoreCurrency(code) || customCurrencies.includes(code)) return;
      replaceCustomCurrencies([...customCurrencies, code]);
    },
    [customCurrencies, replaceCustomCurrencies],
  );

  const handleSwap = useCallback(() => {
    const prevMain = mainCurrency;
    const prevSecondary = secondaryCurrency;
    const prevMainAmount = mainAmountInput;
    const prevSecondaryAmount = secondaryAmountInput;

    setMainCurrency(prevSecondary);
    setSecondaryCurrency(prevMain);
    setMainAmountInput(prevSecondaryAmount || '1');
    setSecondaryAmountInput(prevMainAmount);

    setSessionOverride((prev) => {
      if (!prev) return prev;
      if (!(prev.rate > 0)) return prev;
      return {
        baseCurrency: prevSecondary,
        quoteCurrency: prevMain,
        rate: 1 / prev.rate,
        dateIso,
        updatedAt: Date.now(),
      };
    });
  }, [mainCurrency, secondaryCurrency, mainAmountInput, secondaryAmountInput, dateIso]);

  const applySelectorValue = useCallback((target: SelectorTarget, code: CurrencyCode) => {
    if (target === 'main') {
      setMainCurrency(code);
    } else {
      setSecondaryCurrency(code);
    }
    setOpenSelector(null);
  }, []);

  const handleLibraryPick = useCallback(
    (code: CurrencyCode) => {
      if (!libraryTarget) return;
      applySelectorValue(libraryTarget, code);
      setLibraryTarget(null);
    },
    [applySelectorValue, libraryTarget],
  );

  const handleMainAmountChange = useCallback(
    (value: string) => {
      setMainAmountInput(value);
      shouldSeedSecondaryRef.current = false;

      const mainAmount = parsePositiveAmount(value);
      if (mainAmount == null) {
        clearManualOverrideState();
        return;
      }

      const hasActiveSession =
        sessionOverride?.baseCurrency === mainCurrency &&
        sessionOverride?.quoteCurrency === secondaryCurrency &&
        sessionOverride?.dateIso === dateIso;

      const unitRate = hasActiveSession ? sessionOverride.rate : resolvedRate;

      if (unitRate != null && unitRate > 0) {
        const typed = parseCommissionPercentInput(commissionPercentInput);
        const commissionPercent =
          commissionExpanded && typed > 0
            ? typed
            : getActiveCurrencyCommissionPercent(secondaryCurrency) ?? 0;
        const conversionRate = applyCommissionToRate(unitRate, commissionPercent);
        setSecondaryAmountInput(formatAmountForInput(mainAmount * conversionRate));
        return;
      }

      const secondaryAmount = parsePositiveAmount(secondaryAmountInput);
      if (secondaryAmount != null) {
        applyUnitRateOverride(secondaryAmount / mainAmount);
      }
    },
    [
      applyUnitRateOverride,
      clearManualOverrideState,
      mainCurrency,
      secondaryCurrency,
      secondaryAmountInput,
      sessionOverride,
      resolvedRate,
      dateIso,
      commissionExpanded,
      commissionPercentInput,
    ],
  );

  const handleSecondaryAmountChange = useCallback(
    (value: string) => {
      setSecondaryAmountInput(value);
      shouldSeedSecondaryRef.current = false;

      const secondaryAmount = parsePositiveAmount(value);
      if (secondaryAmount == null) {
        clearManualOverrideState();
        return;
      }

      const mainAmount = parsePositiveAmount(mainAmountInput) ?? 1;
      if (mainAmount <= 0) return;

      applyUnitRateOverride(secondaryAmount / mainAmount);
    },
    [applyUnitRateOverride, clearManualOverrideState, mainAmountInput],
  );

  const persistManualRate24h = useCallback(() => {
    if (!sessionOverride || sessionOverride.rate <= 0) return;
    saveManualExchangeOverride24h(
      sessionOverride.baseCurrency,
      sessionOverride.quoteCurrency,
      sessionOverride.rate,
    );
    setSavePrompt('saved');
    setSessionOverride(null);
    setMainAmountInput('1');
    setSecondaryAmountInput('');
    shouldSeedSecondaryRef.current = true;
    refreshStoredOverrides();
  }, [refreshStoredOverrides, sessionOverride]);

  const persistManualRateForever = useCallback(async () => {
    if (!sessionOverride || sessionOverride.rate <= 0) return;
    const currentUser = auth.currentUser;
    if (!currentUser || currentUser.isAnonymous) {
      setCloudError(tr('exchangeRateForeverSignedInOnly'));
      return;
    }

    setCloudSaving(true);
    setCloudError(null);
    try {
      upsertCloudManualExchangeOverride(
        sessionOverride.baseCurrency,
        sessionOverride.quoteCurrency,
        sessionOverride.rate,
      );
      await saveManualExchangeOverrideToCloud(
        currentUser.uid,
        sessionOverride.baseCurrency,
        sessionOverride.quoteCurrency,
        sessionOverride.rate,
      );
      setSavePrompt('saved');
      setSessionOverride(null);
      setMainAmountInput('1');
      setSecondaryAmountInput('');
      shouldSeedSecondaryRef.current = true;
    } catch {
      setCloudError(tr('exchangeRateCloudSaveFailed'));
    } finally {
      setCloudSaving(false);
    }
  }, [sessionOverride, tr]);

  const cancelOverride = useCallback(
    async (entry: ManagementEntry) => {
      if (entry.kind === 'session') {
        setSessionOverride(null);
        setMainAmountInput('1');
        setSecondaryAmountInput('');
        setSavePrompt('hidden');
        shouldSeedSecondaryRef.current = true;
        return;
      }

      if (entry.data.source === 'local_24h') {
        removeLocalManualExchangeOverride(entry.data.baseCurrency, entry.data.quoteCurrency);
        refreshStoredOverrides();
        return;
      }

      const currentUser = auth.currentUser;
      if (!currentUser || currentUser.isAnonymous) {
        setCloudError(tr('exchangeRateForeverCancelSignedInOnly'));
        return;
      }
      try {
        removeCloudManualExchangeOverride(entry.data.baseCurrency, entry.data.quoteCurrency);
        await deleteManualExchangeOverrideFromCloud(
          currentUser.uid,
          entry.data.baseCurrency,
          entry.data.quoteCurrency,
        );
      } catch {
        setCloudError(tr('exchangeRateCloudCancelFailed'));
      }
    },
    [refreshStoredOverrides, tr],
  );

  const effectiveUnitRate = useMemo(() => {
    if (
      sessionOverride &&
      sessionOverride.baseCurrency === mainCurrency &&
      sessionOverride.quoteCurrency === secondaryCurrency &&
      sessionOverride.dateIso === dateIso &&
      sessionOverride.rate > 0
    ) {
      return sessionOverride.rate;
    }
    return resolvedRate;
  }, [dateIso, mainCurrency, secondaryCurrency, sessionOverride, resolvedRate]);

  const currenciesToPin = useMemo(() => {
    const codes = new Set<CurrencyCode>();
    if (!pinnedCurrencies.includes(mainCurrency)) codes.add(mainCurrency);
    if (!pinnedCurrencies.includes(secondaryCurrency)) codes.add(secondaryCurrency);
    return Array.from(codes);
  }, [mainCurrency, pinnedCurrencies, secondaryCurrency]);

  const activeCommissionPercent = useMemo(() => {
    const typed = parseCommissionPercentInput(commissionPercentInput);
    if (commissionExpanded && typed > 0) return typed;
    return getActiveCurrencyCommissionPercent(secondaryCurrency) ?? 0;
  }, [commissionExpanded, commissionPercentInput, secondaryCurrency]);

  const commissionActive = activeCommissionPercent > 0;

  const displayUnitRate = useMemo(() => {
    if (effectiveUnitRate == null || !(effectiveUnitRate > 0)) return null;
    return applyCommissionToRate(effectiveUnitRate, activeCommissionPercent);
  }, [effectiveUnitRate, activeCommissionPercent]);

  const summaryMainAmount = parsePositiveAmount(mainAmountInput) ?? 1;
  const showUnitRateLine =
    Math.abs(summaryMainAmount - 1) > 1e-9 && displayUnitRate != null && displayUnitRate > 0;
  const summarySecondaryAmount = useMemo(() => {
    const typedSecondary = parsePositiveAmount(secondaryAmountInput);
    if (displayUnitRate != null && displayUnitRate > 0) {
      return summaryMainAmount * displayUnitRate;
    }
    return typedSecondary;
  }, [secondaryAmountInput, displayUnitRate, summaryMainAmount]);

  const copyConvertedAmount = useCallback(async () => {
    if (summarySecondaryAmount == null || !(summarySecondaryAmount > 0)) return;
    const text = formatRate(summarySecondaryAmount);
    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback(true);
      window.setTimeout(() => setCopyFeedback(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }, [summarySecondaryAmount]);

  const toggleCommissionPanel = useCallback(() => {
    setCommissionExpanded((prev) => {
      if (!prev) {
        const saved = getActiveCurrencyCommissionPercent(secondaryCurrency);
        setCommissionPercentInput(saved != null ? String(saved) : '2.5');
        shouldSeedSecondaryRef.current = true;
      }
      return !prev;
    });
  }, [secondaryCurrency]);

  const persistCommission24h = useCallback(() => {
    const percent = parseCommissionPercentInput(commissionPercentInput);
    if (!(percent > 0)) return;
    saveCurrencyCommission24h(secondaryCurrency, percent);
    refreshStoredCommissions();
    setCommissionSaveModalOpen(false);
    setCommissionSaveError(null);
  }, [commissionPercentInput, refreshStoredCommissions, secondaryCurrency]);

  const persistCommissionForever = useCallback(async () => {
    const percent = parseCommissionPercentInput(commissionPercentInput);
    if (!(percent > 0)) return;

    const currentUser = auth.currentUser;
    if (!currentUser || currentUser.isAnonymous) {
      setCommissionSaveError(tr('exchangeRateForeverSignedInOnly'));
      return;
    }

    setCommissionCloudSaving(true);
    setCommissionSaveError(null);
    try {
      upsertCloudCurrencyCommission(secondaryCurrency, percent);
      await saveCurrencyCommissionToCloud(currentUser.uid, secondaryCurrency, percent);
      refreshStoredCommissions();
      setCommissionSaveModalOpen(false);
    } catch {
      setCommissionSaveError(tr('exchangeRateCloudSaveFailed'));
    } finally {
      setCommissionCloudSaving(false);
    }
  }, [commissionPercentInput, refreshStoredCommissions, secondaryCurrency, tr]);

  const deleteCommission = useCallback(
    async (entry: CurrencyCommissionEntry) => {
      if (entry.source === 'local_24h') {
        removeLocalCurrencyCommission(entry.currency);
        refreshStoredCommissions();
        if (entry.currency === secondaryCurrency) {
          syncCommissionInputFromStorage(secondaryCurrency);
          shouldSeedSecondaryRef.current = true;
        }
        return;
      }

      const currentUser = auth.currentUser;
      if (!currentUser || currentUser.isAnonymous) {
        setCloudError(tr('exchangeRateForeverCancelSignedInOnly'));
        return;
      }

      try {
        removeCloudCurrencyCommissionLocal(entry.currency);
        await deleteCurrencyCommissionFromCloud(currentUser.uid, entry.currency);
        refreshStoredCommissions();
        if (entry.currency === secondaryCurrency) {
          syncCommissionInputFromStorage(secondaryCurrency);
          shouldSeedSecondaryRef.current = true;
        }
      } catch {
        setCloudError(tr('exchangeRateCloudCancelFailed'));
      }
    },
    [refreshStoredCommissions, secondaryCurrency, syncCommissionInputFromStorage, tr],
  );

  const rateComparison = useMemo(() => {
    const todayIso = getLocalTodayIso();
    if (dateIso === todayIso) return null;
    if (!(effectiveUnitRate != null && effectiveUnitRate > 0)) return null;
    if (!(todayMarketRate != null && todayMarketRate > 0)) return null;

    const rawDeltaPercent = ((effectiveUnitRate - todayMarketRate) / todayMarketRate) * 100;
    if (!Number.isFinite(rawDeltaPercent)) return null;

    const roundedDelta = Number(rawDeltaPercent.toFixed(2));
    if (roundedDelta === 0) return null;

    const trend: 'up' | 'down' = roundedDelta > 0 ? 'up' : 'down';
    const sign = roundedDelta > 0 ? '+' : '';
    return {
      trend,
      percentText: `${sign}${roundedDelta.toFixed(2)}%`,
      contextText: tr('exchangeRateVsToday'),
    };
  }, [dateIso, effectiveUnitRate, todayMarketRate, tr]);

  const renderSelector = (target: SelectorTarget, code: CurrencyCode, label: string) => {
    const meta = getCurrencyMeta(code);
    const isOpen = openSelector === target;

    return (
      <div className="relative min-w-0 flex-1">
        <label className="mb-1.5 block text-xs font-medium text-neutral-400">{label}</label>
        <button
          type="button"
          onClick={() => setOpenSelector((prev) => (prev === target ? null : target))}
          className={`${controlBaseClass} flex w-full items-center justify-between gap-2`}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <span dir="ltr" className="flex min-w-0 items-center gap-2">
            <CurrencyFlag countryCode={meta.countryCode} size="sm" alt={meta.name} />
            <span className="truncate font-semibold">{code}</span>
          </span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-neutral-400 transition-transform ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {isOpen && (
          <div
            role="listbox"
            className="absolute z-40 mt-1.5 max-h-64 w-full overflow-y-auto rounded-xl border border-neutral-700 bg-neutral-900 p-1.5 shadow-xl shadow-black/40"
          >
            {selectableCurrencies.map((currency) => (
              <button
                key={`${target}-${currency}`}
                type="button"
                role="option"
                onClick={() => applySelectorValue(target, currency)}
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-sm transition-colors ${
                  code === currency
                    ? 'bg-emerald-500/20 text-emerald-200'
                    : 'text-neutral-200 hover:bg-neutral-800'
                }`}
              >
                <span dir="ltr" className="flex items-center gap-2">
                  <CurrencyFlag
                    countryCode={getCurrencyMeta(currency).countryCode}
                    size="xs"
                    alt={getCurrencyMeta(currency).name}
                  />
                  {currency}
                </span>
                {code === currency && (
                  <span className="text-xs text-emerald-300">{tr('exchangeRateActive')}</span>
                )}
              </button>
            ))}

            <button
              type="button"
              onClick={() => {
                setLibraryTarget(target);
                setOpenSelector(null);
              }}
              className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-neutral-600 py-2 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white"
            >
              <Plus className="h-4 w-4" />
              {tr('exchangeRateAddCurrency')}
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      dir={dir}
      className="mt-5 rounded-2xl border border-blue-900/35 bg-gradient-to-b from-slate-950/80 to-slate-900/70 p-4 sm:p-5"
    >
      <h4 className="text-sm font-semibold text-blue-200">{tr('exchangeRateTitle')}</h4>

      <div ref={selectorContainerRef} className="mt-3 space-y-3">
        <div className="flex flex-col items-stretch gap-2.5 sm:flex-row sm:items-end">
          {renderSelector('main', mainCurrency, tr('exchangeRateMainCurrency'))}

          <div className="flex shrink-0 flex-col justify-end">
            <span
              className="mb-1.5 block text-xs font-medium text-transparent select-none"
              aria-hidden="true"
            >
              &nbsp;
            </span>
            <button
              type="button"
              onClick={handleSwap}
              className="h-12 w-12 rounded-xl border border-neutral-700 bg-neutral-800 text-neutral-200 transition-all hover:border-emerald-500/40 hover:text-emerald-300 active:scale-[0.98]"
              aria-label={tr('exchangeRateSwapCurrencies')}
              title={tr('exchangeRateSwapCurrencies')}
            >
              <ArrowUpDown className="mx-auto h-4 w-4 rotate-90" />
            </button>
          </div>

          {renderSelector('secondary', secondaryCurrency, tr('exchangeRateSecondaryCurrency'))}
        </div>

        <div className="grid grid-cols-1 gap-2 transition-all duration-300 ease-in-out sm:grid-cols-[minmax(0,auto)_minmax(0,1fr)] sm:items-start sm:gap-1.5">
          <div className="flex w-full flex-col sm:w-max">
            <label className="mb-1.5 block w-full text-start text-xs font-medium text-neutral-400">
              {tr('date')}
            </label>
            <div className="w-full">
              <input
                type="date"
                value={dateIso}
                onChange={(event) => setDateIso(event.target.value)}
                max={toIsoDateLocal(new Date())}
                className={`${controlBaseClass} w-full text-center [color-scheme:dark]`}
              />
            </div>
            <div className="mt-2 space-y-1.5">
              <div className="flex w-max flex-row items-center gap-2">
                {currenciesToPin.map((code) => (
                  <button
                    key={`pin-${code}`}
                    type="button"
                    onClick={() => pinTemporaryCurrency(code)}
                    className="shrink-0 whitespace-nowrap rounded-lg border border-violet-500/45 bg-violet-500/10 px-2.5 py-1.5 text-xs font-medium text-violet-200 transition-all hover:bg-violet-500/20 active:scale-[0.98]"
                  >
                    {replaceTokens(tr('exchangeRatePinCurrency'), { code })}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={toggleCommissionPanel}
                  aria-expanded={commissionExpanded}
                  className="shrink-0 whitespace-nowrap rounded-lg border border-violet-500/45 bg-violet-500/10 px-2.5 py-1.5 text-xs font-medium text-violet-200 transition-all hover:bg-violet-500/20 active:scale-[0.98]"
                >
                  {tr('exchangeRateAddCommission')}
                </button>
                {commissionExpanded && (
                  <button
                    type="button"
                    onClick={() => {
                      setCommissionSaveError(null);
                      setCommissionSaveModalOpen(true);
                    }}
                    className="shrink-0 whitespace-nowrap rounded-lg border border-violet-500/45 bg-violet-500/10 px-2.5 py-1.5 text-xs font-medium text-violet-200 transition-all hover:bg-violet-500/20 active:scale-[0.98]"
                  >
                    {tr('exchangeRateSaveCommission')}
                  </button>
                )}
              </div>
              {commissionExpanded && (
                <div className="mt-1 w-full">
                  <div className="flex max-w-xs items-center gap-2">
                    <label
                      htmlFor="exchange-rate-commission-percent"
                      className="shrink-0 text-xs font-medium text-neutral-400"
                    >
                      {tr('exchangeRateCommissionPercent')}
                    </label>
                    <input
                      id="exchange-rate-commission-percent"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      max="100"
                      step="0.1"
                      value={commissionPercentInput}
                      onChange={(event) => {
                        setCommissionPercentInput(event.target.value);
                        shouldSeedSecondaryRef.current = true;
                      }}
                      className="h-8 w-16 rounded-lg border border-neutral-700 bg-neutral-800 px-2 text-xs text-neutral-100 outline-none transition-all focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/25 [color-scheme:dark]"
                      aria-label={tr('exchangeRateCommissionPercent')}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex min-w-0 flex-1 flex-col items-start transition-all duration-300 ease-in-out">
            <label className="mb-1.5 block w-full text-start text-xs font-medium text-neutral-400">
              {tr('exchangeRateConversionCalculation')}
            </label>
            <div className="min-h-12 w-full flex-1 rounded-xl border border-blue-900/40 bg-blue-950/25 px-3 py-2.5 text-sm text-blue-100 transition-all duration-300 ease-in-out">
            {loadingRate ? (
              <span className="text-blue-200/80">{tr('exchangeRateLoadingHistorical')}</span>
            ) : (
              <div className="flex min-h-[5.5rem] items-stretch gap-1 sm:gap-2">
                <div className="flex min-w-0 w-full flex-1 flex-col items-start justify-center gap-0.5">
                  <div
                    dir="ltr"
                    className="inline-flex max-w-full flex-row flex-nowrap items-center gap-x-2 self-start"
                  >
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="any"
                      value={mainAmountInput}
                      onChange={(event) => handleMainAmountChange(event.target.value)}
                      className="h-10 w-24 min-w-[4.5rem] shrink-0 rounded-lg border border-blue-800/60 bg-blue-950/50 px-2.5 text-sm font-semibold text-blue-50 outline-none transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 [color-scheme:dark]"
                      aria-label={tr('exchangeRateMainAmountLabel')}
                    />
                    <span dir="ltr" className="shrink-0 font-semibold text-blue-100">
                      {mainCurrency}
                    </span>
                    <span className="shrink-0 text-blue-300/80" aria-hidden>
                      =
                    </span>
                    <LtrNumeric className="shrink-0 text-base font-semibold leading-none text-blue-50">
                      {summarySecondaryAmount != null ? formatRate(summarySecondaryAmount) : '-'}
                    </LtrNumeric>
                    <span dir="ltr" className="shrink-0 text-base font-semibold leading-none text-blue-100">
                      {secondaryCurrency}
                    </span>
                    <button
                      type="button"
                      onClick={() => void copyConvertedAmount()}
                      disabled={summarySecondaryAmount == null || !(summarySecondaryAmount > 0)}
                      className="inline-flex size-[1em] shrink-0 items-center justify-center rounded border border-blue-800/60 bg-blue-950/50 text-blue-200 transition-all hover:border-blue-700/80 hover:bg-blue-900/50 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label={tr('exchangeRateCopyAmount')}
                      title={copyFeedback ? tr('exchangeRateCopied') : tr('exchangeRateCopyAmount')}
                    >
                      <Copy className="size-[0.65em]" strokeWidth={2.25} aria-hidden />
                    </button>
                  </div>
                  {historicalRateUpdatedAt != null && (
                    <p className="w-full self-start text-start text-xs leading-snug text-blue-200/75">
                      {formatHistoricalRateUpdatedLabel(historicalRateUpdatedAt)}
                    </p>
                  )}
                  {showUnitRateLine && displayUnitRate != null && (
                    <p className="mt-0.5 w-full self-start text-start text-xs text-blue-200/75">
                      <LtrNumeric>
                        {replaceTokens(
                          commissionActive
                            ? tr('exchangeRateUnitRateLineInclFee')
                            : tr('exchangeRateUnitRateLine'),
                          {
                            mainCurrency,
                            secondaryCurrency,
                            rate: formatRate(displayUnitRate),
                          },
                        )}
                      </LtrNumeric>
                    </p>
                  )}
                </div>
                {rateComparison && (
                  <div className="ms-auto flex shrink-0 items-center gap-2 self-center py-2 sm:gap-2.5">
                    <div className="flex min-h-[4.5rem] flex-col justify-center">
                      <LtrNumeric
                        className={`whitespace-nowrap text-4xl font-black leading-none ${
                          rateComparison.trend === 'up' ? 'text-emerald-400' : 'text-rose-500'
                        }`}
                      >
                        {rateComparison.percentText}
                      </LtrNumeric>
                      <span className="mt-1 text-xl font-semibold leading-tight text-neutral-100">
                        {rateComparison.contextText}
                      </span>
                    </div>
                    <span
                      aria-hidden
                      className={`text-[4rem] leading-none ${
                        rateComparison.trend === 'up' ? 'text-emerald-500' : 'text-rose-600'
                      }`}
                    >
                      {rateComparison.trend === 'up' ? '⬆' : '⬇'}
                    </span>
                  </div>
                )}
              </div>
            )}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setManualExpanded((prev) => !prev)}
              aria-expanded={manualExpanded}
              className="inline-flex min-h-[2.75rem] flex-1 items-center justify-between rounded-xl border border-neutral-700 bg-neutral-900 px-3.5 text-sm font-medium text-neutral-200 transition-colors hover:bg-neutral-800"
            >
              {tr('exchangeRateSetManualRate')}
              <ChevronDown
                className={`h-4 w-4 text-neutral-400 transition-transform ${
                  manualExpanded ? 'rotate-180' : ''
                }`}
              />
            </button>

            <button
              type="button"
              onClick={() => setManagementExpanded((prev) => !prev)}
              aria-expanded={managementExpanded}
              className="inline-flex min-h-[2.75rem] items-center gap-1.5 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3.5 text-sm font-medium text-amber-100 transition-colors hover:bg-amber-500/20"
            >
              <Settings2 className="h-4 w-4" />
              {tr('exchangeRateManageManual')}
            </button>

            <button
              type="button"
              onClick={() => setCommissionManagementExpanded((prev) => !prev)}
              aria-expanded={commissionManagementExpanded}
              className="inline-flex min-h-[2.75rem] items-center gap-1.5 rounded-xl border border-violet-500/35 bg-violet-500/10 px-3.5 text-sm font-medium text-violet-100 transition-colors hover:bg-violet-500/20"
            >
              <Settings2 className="h-4 w-4" />
              {tr('exchangeRateManageCommissions')}
            </button>
          </div>

          {manualExpanded && (
            <div className="mt-3 space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                  <label className="mb-1.5 block text-xs font-medium text-neutral-400">
                    {tr('exchangeRateMainAmountLabel')}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="any"
                      value={mainAmountInput}
                      onChange={(event) => handleMainAmountChange(event.target.value)}
                      className={`${controlBaseClass} w-full`}
                      aria-label={tr('exchangeRateMainAmountLabel')}
                    />
                    <span dir="ltr" className="shrink-0 text-sm font-semibold text-neutral-200">
                      {mainCurrency}
                    </span>
                  </div>
                </div>

                <div className="hidden shrink-0 pb-3 text-sm font-medium text-neutral-500 sm:block" aria-hidden>
                  =
                </div>

                <div className="min-w-0 flex-1">
                  <label className="mb-1.5 block text-xs font-medium text-neutral-400">
                    {tr('exchangeRateSecondaryAmountLabel')}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="any"
                      value={secondaryAmountInput}
                      onChange={(event) => handleSecondaryAmountChange(event.target.value)}
                      placeholder={tr('exchangeRateRatePlaceholder')}
                      className={`${controlBaseClass} w-full`}
                      aria-label={tr('exchangeRateSecondaryAmountLabel')}
                    />
                    <span dir="ltr" className="shrink-0 text-sm font-semibold text-neutral-200">
                      {secondaryCurrency}
                    </span>
                  </div>
                </div>
              </div>

              {sessionOverride && (
                <p className="text-xs text-neutral-500">
                  <LtrNumeric>
                    {replaceTokens(tr('exchangeRateUnitRateLine'), {
                      mainCurrency,
                      secondaryCurrency,
                      rate: formatRate(sessionOverride.rate),
                    })}
                  </LtrNumeric>
                </p>
              )}

              {savePrompt !== 'hidden' && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
                  <p className="text-xs text-amber-100">{tr('exchangeRateSavePrompt')}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSavePrompt('hidden')}
                      className="rounded-lg border border-neutral-600 bg-neutral-900 px-2.5 py-1.5 text-xs text-neutral-200 transition-colors hover:bg-neutral-800"
                    >
                      {tr('exchangeRateSaveNo')}
                    </button>
                    <button
                      type="button"
                      onClick={persistManualRate24h}
                      className="rounded-lg border border-sky-500/40 bg-sky-500/15 px-2.5 py-1.5 text-xs font-medium text-sky-200 transition-colors hover:bg-sky-500/25"
                    >
                      {tr('exchangeRateSave24h')}
                    </button>
                    <button
                      type="button"
                      disabled={cloudSaving}
                      onClick={() => void persistManualRateForever()}
                      className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1.5 text-xs font-medium text-emerald-200 transition-colors hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {tr('exchangeRateSaveForever')}
                    </button>
                  </div>
                  {savePrompt === 'saved' && (
                    <p className="mt-2 text-[11px] text-emerald-200">{tr('exchangeRateSavedSuccess')}</p>
                  )}
                </div>
              )}
              {cloudError && <p className="text-xs text-rose-300">{cloudError}</p>}
            </div>
          )}

          {commissionManagementExpanded && (
            <div className="mt-3 rounded-xl border border-violet-500/25 bg-violet-500/5 p-3">
              <p className="text-xs text-violet-200/80">{tr('exchangeRateActiveCommissions')}</p>
              <div className="mt-2 space-y-2">
                {storedCommissions.length === 0 ? (
                  <p className="text-sm text-neutral-500">{tr('exchangeRateNoActiveCommissions')}</p>
                ) : (
                  storedCommissions.map((entry) => {
                    const meta = getCurrencyMeta(entry.currency);
                    let validityText = tr('exchangeRateSave24h');
                    if (entry.source === 'cloud') {
                      validityText = tr('exchangeRateValidForeverCloud');
                    } else if (entry.expiresAt != null) {
                      validityText = formatRemainingTime(entry.expiresAt);
                    }

                    return (
                      <div
                        key={`commission-${entry.currency}-${entry.source}`}
                        className="flex flex-col gap-2 rounded-lg border border-violet-500/20 bg-neutral-950/60 p-2.5 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <p dir="ltr" className="flex items-center gap-2 text-sm font-medium text-neutral-200">
                            <CurrencyFlag countryCode={meta.countryCode} size="xs" alt={meta.name} />
                            {entry.currency}
                          </p>
                          <p className="text-xs text-neutral-400">
                            <LtrNumeric>
                              {replaceTokens(tr('exchangeRateCommissionEntry'), {
                                currency: entry.currency,
                                percent: entry.percent,
                              })}
                            </LtrNumeric>
                          </p>
                          <p className="text-[11px] text-neutral-500">{validityText}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void deleteCommission(entry)}
                          className="inline-flex min-h-[2.25rem] items-center justify-center gap-1.5 rounded-lg border border-rose-500/35 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-200 transition-colors hover:bg-rose-500/20"
                          aria-label={tr('exchangeRateDeleteCommission')}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                          {tr('exchangeRateDeleteCommission')}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {managementExpanded && (
            <div className="mt-3 rounded-xl border border-neutral-700 bg-neutral-900/70 p-3">
              <p className="text-xs text-neutral-400">{tr('exchangeRateActiveOverrides')}</p>
              <div className="mt-2 space-y-2">
                {managementEntries.length === 0 ? (
                  <p className="text-sm text-neutral-500">{tr('exchangeRateNoActiveOverrides')}</p>
                ) : (
                  managementEntries.map((entry, index) => {
                    const base = entry.data.baseCurrency;
                    const quote = entry.data.quoteCurrency;
                    const rate = entry.data.rate;
                    let validityText = tr('exchangeRateValidSession');

                    if (entry.kind === 'stored') {
                      if (entry.data.source === 'cloud') {
                        validityText = tr('exchangeRateValidForeverCloud');
                      } else {
                        validityText = entry.data.expiresAt != null
                          ? formatRemainingTime(entry.data.expiresAt)
                          : tr('exchangeRateValidUnlimited');
                      }
                    }

                    return (
                      <div
                        key={`${entry.kind}-${base}-${quote}-${index}`}
                        className="flex flex-col gap-2 rounded-lg border border-neutral-700/80 bg-neutral-950/60 p-2.5 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <p dir="ltr" className="text-sm font-medium text-neutral-200">
                            {base} {'->'} {quote}
                          </p>
                          <p className="text-xs text-neutral-400">
                            <LtrNumeric>
                              {replaceTokens(tr('exchangeRateUnitRateLine'), {
                                mainCurrency: base,
                                secondaryCurrency: quote,
                                rate: formatRate(rate),
                              })}
                            </LtrNumeric>
                          </p>
                          <p className="text-[11px] text-neutral-500">{validityText}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void cancelOverride(entry)}
                          className="min-h-[2.25rem] rounded-lg border border-rose-500/35 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-200 transition-colors hover:bg-rose-500/20"
                        >
                          {tr('cancel')}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <CommissionSaveModal
        open={commissionSaveModalOpen}
        onClose={() => {
          setCommissionSaveModalOpen(false);
          setCommissionSaveError(null);
        }}
        onSave24h={persistCommission24h}
        onSaveForever={() => void persistCommissionForever()}
        savingForever={commissionCloudSaving}
        errorMessage={commissionSaveError}
      />

      <CurrencyLibraryModal
        open={libraryTarget !== null}
        onClose={() => setLibraryTarget(null)}
        mode="expense"
        onExpenseCurrencySelect={handleLibraryPick}
      />
    </div>
  );
}
