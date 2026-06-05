import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUpDown, ChevronDown, Copy, Plus, Trash2 } from 'lucide-react';
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
import ManualRateSaveModal from './ManualRateSaveModal';
import {
  primaryActionButtonClass,
  utilityNavCompactButtonClass,
  utilityNavDropdownSelectedClass,
  utilityNavIconButtonClass,
} from '../styles/actionButtonStyles';
import CurrencyFlag from './CurrencyFlag';
import CurrencyLibraryModal from './CurrencyLibraryModal';
import { applyCommissionToRate, parseCommissionPercentInput } from '../services/commissionMath';
import {
  getAppliedCommissionPercentForPair,
  resolveCommissionBypassOptions,
  toActiveFeesFromCommissionEntries,
} from '../services/transactionProcessingService';
import {
  getSavedCommissionPercentForCurrency,
  GLOBAL_COMMISSION_CURRENCY,
  isGlobalCommissionCurrency,
  listActiveCurrencyCommissions,
  removeCloudCurrencyCommissionLocal,
  removeLocalCurrencyCommission,
  saveCurrencyCommission24h,
  subscribeCurrencyCommissionsUpdated,
  upsertCloudCurrencyCommission,
  type CommissionCurrency,
  type CurrencyCommissionEntry,
} from '../services/currencyCommissionService';
import {
  clearHistoricalDirectRateCache,
  computeDirectUnitRateFromIlsPivot,
  fetchExchangeRates,
  fetchHistoricalDirectRateSnapshot,
  getLocalTodayIso,
  peekHistoricalDirectRateSnapshot,
} from '../services/exchangeRateService';
import {
  getActiveManualExchangeOverrideSnapshot,
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

export type ExchangeRateSimulatorSection = 'exchange' | 'manual-rate' | 'commissions';

interface ExchangeRateSimulatorProps {
  section: ExchangeRateSimulatorSection;
  recentExpenseCurrencies: ExpenseCurrency[];
}

type SelectorTarget = 'main' | 'secondary' | 'commission';
type SavePromptState = 'hidden' | 'shown' | 'saved';

const controlBaseClass =
  'h-12 rounded-xl border border-neutral-700 bg-neutral-800 px-3 text-sm text-neutral-100 transition-all outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 active:scale-[0.98]';

const staticFormCardClass =
  'rounded-xl border border-slate-700/60 bg-slate-950/50 p-3.5 sm:p-4 space-y-4';

const staticListCardClass =
  'rounded-xl border border-slate-700/60 bg-slate-900/40 p-3 sm:p-4';

/** Cap for in-panel selectors; commission portal uses viewport-aware maxHeight. */
const COMMISSION_DROPDOWN_MAX_PX = 240;
const currencySelectorDropdownClass =
  'z-50 max-h-60 overflow-y-auto overscroll-contain touch-pan-y rounded-xl border border-neutral-700 bg-neutral-900 p-1.5 shadow-xl shadow-black/40 [-webkit-overflow-scrolling:touch]';

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

/** Shrinks conversion summary text on narrow screens when the full line gets long. */
function getConversionRowFontSizePx(displayCharacterCount: number): number {
  return Math.round(Math.max(11, Math.min(16, 18 - Math.max(0, displayCharacterCount - 10) * 0.5)));
}

function buildConversionSummaryLine(
  amountInput: string,
  mainCurrency: string,
  secondaryAmount: number | null | undefined,
  secondaryCurrency: string,
): { displayText: string; characterCount: number } {
  const amountStr = amountInput.trim() || '1';
  const resultText =
    secondaryAmount != null && Number.isFinite(secondaryAmount) && secondaryAmount > 0
      ? formatRate(secondaryAmount)
      : '-';
  const displayText = `${amountStr} ${mainCurrency} = ${resultText} ${secondaryCurrency}`;
  return { displayText, characterCount: displayText.length };
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

function formatSavedCommissionPercent(percent: number): string {
  const rounded = Math.round(percent * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
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
  section,
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

  const [mainAmountInput, setMainAmountInput] = useState('1');
  const [secondaryAmountInput, setSecondaryAmountInput] = useState('');
  const [sessionOverride, setSessionOverride] = useState<SessionOverride | null>(null);
  const [, setSavePrompt] = useState<SavePromptState>('hidden');
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
  const [commissionTargetCurrency, setCommissionTargetCurrency] = useState<CommissionCurrency>(
    () => (displayCurrency !== 'ILS' ? displayCurrency : 'USD'),
  );
  const [commissionPercentInput, setCommissionPercentInput] = useState('2.5');
  const [commissionSaveModalOpen, setCommissionSaveModalOpen] = useState(false);
  const [commissionSaveError, setCommissionSaveError] = useState<string | null>(null);
  const [manualRateSaveModalOpen, setManualRateSaveModalOpen] = useState(false);
  const [manualRateSaveError, setManualRateSaveError] = useState<string | null>(null);
  const [commissionCloudSaving, setCommissionCloudSaving] = useState(false);
  const [storedCommissions, setStoredCommissions] = useState<CurrencyCommissionEntry[]>(() =>
    listActiveCurrencyCommissions(),
  );
  const activeFees = useMemo(
    () => toActiveFeesFromCommissionEntries(storedCommissions),
    [storedCommissions],
  );
  const applyDraftCommissionPercent = section === 'commissions';
  const [copyFeedback, setCopyFeedback] = useState(false);

  const selectorContainerRef = useRef<HTMLDivElement>(null);
  const commissionSelectorContainerRef = useRef<HTMLDivElement>(null);
  const commissionTriggerRef = useRef<HTMLButtonElement>(null);
  const commissionDropdownPortalRef = useRef<HTMLDivElement>(null);
  const [commissionDropdownLayout, setCommissionDropdownLayout] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const shouldSeedSecondaryRef = useRef(true);
  const rateContextKeyRef = useRef('');
  const historicalFetchIdRef = useRef(0);
  const todayMarketFetchIdRef = useRef(0);
  const historicalContextKeyRef = useRef<string | null>(null);

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
      if (section === 'exchange') {
        setSavePrompt('shown');
      }
      setCloudError(null);
    },
    [dateIso, mainCurrency, secondaryCurrency, section],
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

  const activeStoredManualOverride = useMemo(
    () => getActiveManualExchangeOverrideSnapshot(mainCurrency, secondaryCurrency),
    [mainCurrency, secondaryCurrency, storedOverrides],
  );

  const activeStoredManualRate = activeStoredManualOverride?.rate ?? null;

  const isManualRateActive =
    mainCurrency !== secondaryCurrency &&
    (activeSessionRate != null || activeStoredManualRate != null);

  useEffect(() => {
    const rateContextKey = `${dateIso}|${mainCurrency}|${secondaryCurrency}|${sessionOverride?.rate ?? resolvedRate ?? ''}|${applyDraftCommissionPercent}|${commissionPercentInput}`;
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
    applyDraftCommissionPercent,
    commissionPercentInput,
  ]);

  useEffect(() => {
    if (mainCurrency === secondaryCurrency) return;

    const unitRate =
      activeSessionRate != null
        ? activeSessionRate
        : activeStoredManualRate != null
          ? activeStoredManualRate
          : resolvedRate;

    if (unitRate == null || !(unitRate > 0)) return;
    if (!shouldSeedSecondaryRef.current) return;

    const mainAmount = parsePositiveAmount(mainAmountInput) ?? 1;
    const commissionPercent = getAppliedCommissionPercentForPair(
      activeFees,
      mainCurrency,
      secondaryCurrency,
      displayCurrency,
      applyDraftCommissionPercent && parseCommissionPercentInput(commissionPercentInput) > 0
        ? parseCommissionPercentInput(commissionPercentInput)
        : undefined,
    );
    const conversionRate = applyCommissionToRate(
      unitRate,
      commissionPercent,
      mainCurrency,
      secondaryCurrency,
      resolveCommissionBypassOptions(activeFees, mainCurrency, displayCurrency),
    );
    setSecondaryAmountInput(formatAmountForInput(mainAmount * conversionRate));
    shouldSeedSecondaryRef.current = false;
  }, [
    resolvedRate,
    mainCurrency,
    secondaryCurrency,
    activeSessionRate,
    activeStoredManualRate,
    mainAmountInput,
    dateIso,
    applyDraftCommissionPercent,
    commissionPercentInput,
    activeFees,
    displayCurrency,
  ]);

  useEffect(() => {
    const fetchId = ++historicalFetchIdRef.current;
    let cancelled = false;
    const historicalContextKey = `${dateIso}|${mainCurrency}|${secondaryCurrency}`;

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

    if (activeStoredManualRate != null) {
      applyResolvedRate(
        activeStoredManualRate,
        activeStoredManualOverride?.updatedAt ?? Date.now(),
      );
      return () => {
        cancelled = true;
      };
    }

    const prevContextKey = historicalContextKeyRef.current;
    if (prevContextKey != null && prevContextKey !== historicalContextKey) {
      clearHistoricalDirectRateCache(dateIso, mainCurrency, secondaryCurrency);
    }
    historicalContextKeyRef.current = historicalContextKey;

    const cachedSnapshot = peekHistoricalDirectRateSnapshot(dateIso, mainCurrency, secondaryCurrency);
    if (cachedSnapshot.rate != null) {
      applyResolvedRate(cachedSnapshot.rate, cachedSnapshot.fetchedAt);
    } else {
      setHistoricalRateUpdatedAt(null);
      setLoadingRate(true);
    }

    void (async () => {
      try {
        const snapshot = await fetchHistoricalDirectRateSnapshot(
          dateIso,
          mainCurrency,
          secondaryCurrency,
          { bypassCache: true },
        );
        applyResolvedRate(snapshot.rate, snapshot.fetchedAt);
      } catch (error) {
        console.error('Trend fetch error (historical snapshot):', error, {
          pair: `${mainCurrency}/${secondaryCurrency}`,
          dateIso,
        });
        applyResolvedRate(cachedSnapshot.rate, cachedSnapshot.fetchedAt);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    dateIso,
    mainCurrency,
    secondaryCurrency,
    activeSessionRate,
    activeStoredManualRate,
    activeStoredManualOverride?.updatedAt,
    sessionOverride?.updatedAt,
  ]);

  useEffect(() => {
    const fetchId = ++todayMarketFetchIdRef.current;
    let cancelled = false;

    if (mainCurrency === secondaryCurrency) {
      setTodayMarketRate(1);
      return () => {
        cancelled = true;
      };
    }

    setTodayMarketRate(null);

    void (async () => {
      try {
        const liveRates = await fetchExchangeRates();
        if (cancelled || fetchId !== todayMarketFetchIdRef.current) return;

        const marketRate = computeDirectUnitRateFromIlsPivot(
          mainCurrency,
          secondaryCurrency,
          liveRates.ilsToForeign,
        );
        setTodayMarketRate(marketRate != null && marketRate > 0 ? marketRate : null);
      } catch (error) {
        console.error('Trend fetch error (today market rate):', error, {
          pair: `${mainCurrency}/${secondaryCurrency}`,
        });
        if (!cancelled && fetchId === todayMarketFetchIdRef.current) {
          setTodayMarketRate(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mainCurrency, secondaryCurrency]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (selectorContainerRef.current?.contains(target)) return;
      if (commissionSelectorContainerRef.current?.contains(target)) return;
      if (commissionDropdownPortalRef.current?.contains(target)) return;
      setOpenSelector(null);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  useEffect(() => {
    if (openSelector !== 'commission') {
      setCommissionDropdownLayout(null);
      return;
    }

    const updatePosition = () => {
      const trigger = commissionTriggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const gap = 6;
      const edgePad = 16;
      const viewport = window.visualViewport;
      const viewportTop = viewport?.offsetTop ?? 0;
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const viewportBottom = viewportTop + viewportHeight;

      const spaceBelow = viewportBottom - rect.bottom - gap - edgePad;
      const spaceAbove = rect.top - viewportTop - gap - edgePad;
      const openUpward = spaceBelow < 100 && spaceAbove > spaceBelow;

      const maxHeight = Math.min(
        COMMISSION_DROPDOWN_MAX_PX,
        Math.max(80, openUpward ? spaceAbove : spaceBelow),
      );
      const top = openUpward
        ? Math.max(viewportTop + edgePad, rect.top - gap - maxHeight)
        : rect.bottom + gap;

      setCommissionDropdownLayout({
        top,
        left: rect.left,
        width: rect.width,
        maxHeight,
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    const visualViewport = window.visualViewport;
    visualViewport?.addEventListener('resize', updatePosition);
    visualViewport?.addEventListener('scroll', updatePosition);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      visualViewport?.removeEventListener('resize', updatePosition);
      visualViewport?.removeEventListener('scroll', updatePosition);
    };
  }, [openSelector, section]);

  useEffect(() => {
    refreshStoredOverrides();
    const unsub = subscribeManualOverridesUpdated(() => refreshStoredOverrides());
    return unsub;
  }, [refreshStoredOverrides]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      refreshStoredOverrides();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [refreshStoredOverrides]);

  const syncCommissionInputFromStorage = useCallback((currency: CommissionCurrency) => {
    const savedPercent = getSavedCommissionPercentForCurrency(currency);
    if (savedPercent != null) {
      setCommissionPercentInput(String(savedPercent));
    }
  }, []);

  const applyCommissionTarget = useCallback((currency: CommissionCurrency) => {
    setCommissionTargetCurrency(currency);
    const savedPercent = getSavedCommissionPercentForCurrency(currency);
    setCommissionPercentInput(savedPercent != null ? String(savedPercent) : '2.5');
    setOpenSelector(null);
    shouldSeedSecondaryRef.current = true;
  }, []);

  useEffect(() => {
    if (section !== 'commissions') return;
    syncCommissionInputFromStorage(commissionTargetCurrency);
  }, [section, commissionTargetCurrency, syncCommissionInputFromStorage]);

  useEffect(() => {
    const unsub = subscribeCurrencyCommissionsUpdated(() => {
      refreshStoredCommissions();
      if (section === 'commissions') {
        syncCommissionInputFromStorage(commissionTargetCurrency);
      }
      shouldSeedSecondaryRef.current = true;
    });
    return unsub;
  }, [
    section,
    commissionTargetCurrency,
    syncCommissionInputFromStorage,
    refreshStoredCommissions,
  ]);

  useEffect(() => {
    if (section !== 'commissions') return;
    const timer = window.setInterval(() => {
      refreshStoredCommissions();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [section, refreshStoredCommissions]);

  useEffect(() => {
    if (section !== 'manual-rate') return;
    const timer = window.setInterval(() => {
      setClockTick(Date.now());
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [section]);

  const selectableCurrencies = useMemo(() => {
    const all = new Set<CurrencyCode>([...pinnedCurrencies, mainCurrency, secondaryCurrency]);
    return Array.from(all);
  }, [mainCurrency, pinnedCurrencies, secondaryCurrency]);

  const commissionSelectableCurrencies = useMemo(() => {
    const all = new Set<CurrencyCode>([
      'ILS',
      ...pinnedCurrencies,
      ...recentExpenseCurrencies,
      mainCurrency,
      secondaryCurrency,
    ]);
    return Array.from(all).sort((a, b) => a.localeCompare(b));
  }, [mainCurrency, pinnedCurrencies, recentExpenseCurrencies, secondaryCurrency]);

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
    shouldSeedSecondaryRef.current = true;
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
      if (libraryTarget === 'commission') {
        applyCommissionTarget(code);
      } else {
        applySelectorValue(libraryTarget, code);
      }
      setLibraryTarget(null);
    },
    [applyCommissionTarget, applySelectorValue, libraryTarget],
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

      const unitRate =
        activeSessionRate != null
          ? activeSessionRate
          : activeStoredManualRate != null
            ? activeStoredManualRate
            : resolvedRate;

      if (unitRate != null && unitRate > 0) {
        const typed = parseCommissionPercentInput(commissionPercentInput);
        const commissionPercent = getAppliedCommissionPercentForPair(
          activeFees,
          mainCurrency,
          secondaryCurrency,
          displayCurrency,
          applyDraftCommissionPercent && typed > 0 ? typed : undefined,
        );
        const conversionRate = applyCommissionToRate(
          unitRate,
          commissionPercent,
          mainCurrency,
          secondaryCurrency,
          resolveCommissionBypassOptions(activeFees, mainCurrency, displayCurrency),
        );
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
      activeSessionRate,
      activeStoredManualRate,
      resolvedRate,
      applyDraftCommissionPercent,
      commissionPercentInput,
      activeFees,
      displayCurrency,
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

  const effectiveUnitRate = useMemo(() => {
    if (activeSessionRate != null) return activeSessionRate;
    if (activeStoredManualRate != null) return activeStoredManualRate;
    return resolvedRate;
  }, [activeSessionRate, activeStoredManualRate, resolvedRate]);

  const sameCurrencyManualRate = mainCurrency === secondaryCurrency;

  const resolveManualRateForSave = useCallback((): number | null => {
    if (sameCurrencyManualRate) return null;

    if (
      sessionOverride &&
      sessionOverride.baseCurrency === mainCurrency &&
      sessionOverride.quoteCurrency === secondaryCurrency &&
      sessionOverride.rate > 0
    ) {
      return sessionOverride.rate;
    }

    const mainAmount = parsePositiveAmount(mainAmountInput);
    const secondaryAmount = parsePositiveAmount(secondaryAmountInput);
    if (
      mainAmount != null &&
      secondaryAmount != null &&
      mainAmount > 0 &&
      secondaryAmount > 0
    ) {
      return secondaryAmount / mainAmount;
    }

    if (effectiveUnitRate != null && effectiveUnitRate > 0) {
      return effectiveUnitRate;
    }

    return null;
  }, [
    sameCurrencyManualRate,
    sessionOverride,
    mainCurrency,
    secondaryCurrency,
    mainAmountInput,
    secondaryAmountInput,
    effectiveUnitRate,
  ]);

  const canSaveManualRate = useMemo(() => {
    if (sameCurrencyManualRate) return false;
    const rate = resolveManualRateForSave();
    return rate != null && rate > 0;
  }, [sameCurrencyManualRate, resolveManualRateForSave]);

  const resetManualRateEntryFields = useCallback(() => {
    setSessionOverride(null);
    setMainAmountInput('1');
    setSecondaryAmountInput('');
    shouldSeedSecondaryRef.current = true;
  }, []);

  const persistManualRate24h = useCallback(() => {
    const rate = resolveManualRateForSave();
    if (rate == null) return;

    saveManualExchangeOverride24h(mainCurrency, secondaryCurrency, rate);
    setManualRateSaveModalOpen(false);
    setManualRateSaveError(null);
    if (section === 'exchange') {
      setSavePrompt('saved');
    }
    resetManualRateEntryFields();
    refreshStoredOverrides();
  }, [
    resolveManualRateForSave,
    mainCurrency,
    secondaryCurrency,
    section,
    resetManualRateEntryFields,
    refreshStoredOverrides,
  ]);

  const persistManualRateForever = useCallback(async () => {
    const rate = resolveManualRateForSave();
    if (rate == null) return;

    const currentUser = auth.currentUser;
    if (!currentUser || currentUser.isAnonymous) {
      setManualRateSaveError(tr('exchangeRateForeverSignedInOnly'));
      return;
    }

    setCloudSaving(true);
    setManualRateSaveError(null);
    setCloudError(null);
    try {
      upsertCloudManualExchangeOverride(mainCurrency, secondaryCurrency, rate);
      await saveManualExchangeOverrideToCloud(
        currentUser.uid,
        mainCurrency,
        secondaryCurrency,
        rate,
      );
      setManualRateSaveModalOpen(false);
      if (section === 'exchange') {
        setSavePrompt('saved');
      }
      resetManualRateEntryFields();
      refreshStoredOverrides();
    } catch {
      setManualRateSaveError(tr('exchangeRateCloudSaveFailed'));
    } finally {
      setCloudSaving(false);
    }
  }, [
    resolveManualRateForSave,
    mainCurrency,
    secondaryCurrency,
    section,
    resetManualRateEntryFields,
    refreshStoredOverrides,
    tr,
  ]);

  const openManualRateSaveModal = useCallback(() => {
    if (!canSaveManualRate) return;
    setManualRateSaveError(null);
    setManualRateSaveModalOpen(true);
  }, [canSaveManualRate]);

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

  const currenciesToPin = useMemo(() => {
    const codes = new Set<CurrencyCode>();
    if (!pinnedCurrencies.includes(mainCurrency)) codes.add(mainCurrency);
    if (!pinnedCurrencies.includes(secondaryCurrency)) codes.add(secondaryCurrency);
    return Array.from(codes);
  }, [mainCurrency, pinnedCurrencies, secondaryCurrency]);

  const activeCommissionPercent = useMemo(() => {
    const typed = parseCommissionPercentInput(commissionPercentInput);
    return getAppliedCommissionPercentForPair(
      activeFees,
      mainCurrency,
      secondaryCurrency,
      displayCurrency,
      applyDraftCommissionPercent && typed > 0 ? typed : undefined,
    );
  }, [
    activeFees,
    applyDraftCommissionPercent,
    commissionPercentInput,
    mainCurrency,
    secondaryCurrency,
    displayCurrency,
  ]);

  const isFeeApplied = section === 'exchange' && activeCommissionPercent > 0;

  const displayUnitRate = useMemo(() => {
    if (effectiveUnitRate == null || !(effectiveUnitRate > 0)) return null;
    return applyCommissionToRate(
      effectiveUnitRate,
      activeCommissionPercent,
      mainCurrency,
      secondaryCurrency,
      resolveCommissionBypassOptions(activeFees, mainCurrency, displayCurrency),
    );
  }, [
    activeFees,
    effectiveUnitRate,
    activeCommissionPercent,
    mainCurrency,
    secondaryCurrency,
    displayCurrency,
  ]);

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

  const conversionSummaryLayout = useMemo(() => {
    const { characterCount } = buildConversionSummaryLine(
      mainAmountInput,
      mainCurrency,
      summarySecondaryAmount,
      secondaryCurrency,
    );
    const fontSizePx = getConversionRowFontSizePx(characterCount);
    const amountStr = mainAmountInput.trim() || '1';
    return {
      fontSizePx,
      inputFontSizePx: Math.max(12, fontSizePx),
      inputWidthCh: Math.min(11, Math.max(4, amountStr.length + 1)),
    };
  }, [mainAmountInput, mainCurrency, summarySecondaryAmount, secondaryCurrency]);

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

  const persistCommission24h = useCallback(() => {
    const percent = parseCommissionPercentInput(commissionPercentInput);
    if (!(percent > 0)) return;
    saveCurrencyCommission24h(commissionTargetCurrency, percent);
    refreshStoredCommissions();
    setCommissionSaveModalOpen(false);
    setCommissionSaveError(null);
  }, [commissionPercentInput, commissionTargetCurrency, refreshStoredCommissions]);

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
      upsertCloudCurrencyCommission(commissionTargetCurrency, percent);
      await saveCurrencyCommissionToCloud(currentUser.uid, commissionTargetCurrency, percent);
      refreshStoredCommissions();
      setCommissionSaveModalOpen(false);
    } catch {
      setCommissionSaveError(tr('exchangeRateCloudSaveFailed'));
    } finally {
      setCommissionCloudSaving(false);
    }
  }, [commissionPercentInput, commissionTargetCurrency, refreshStoredCommissions, tr]);

  const deleteCommission = useCallback(
    async (entry: CurrencyCommissionEntry) => {
      if (entry.source === 'local_24h') {
        removeLocalCurrencyCommission(entry.currency);
        refreshStoredCommissions();
        if (entry.currency === commissionTargetCurrency) {
          syncCommissionInputFromStorage(commissionTargetCurrency);
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
        if (entry.currency === commissionTargetCurrency) {
          syncCommissionInputFromStorage(commissionTargetCurrency);
          shouldSeedSecondaryRef.current = true;
        }
      } catch {
        setCloudError(tr('exchangeRateCloudCancelFailed'));
      }
    },
    [commissionTargetCurrency, refreshStoredCommissions, syncCommissionInputFromStorage, tr],
  );

  const rateComparison = useMemo(() => {
    if (isManualRateActive) return null;
    const todayIso = getLocalTodayIso();
    if (dateIso === todayIso) return null;
    if (loadingRate) return null;
    if (!(effectiveUnitRate != null && effectiveUnitRate > 0)) return null;
    if (!(todayMarketRate != null && todayMarketRate > 0)) return null;

    const rawDeltaPercent = ((effectiveUnitRate - todayMarketRate) / todayMarketRate) * 100;
    if (!Number.isFinite(rawDeltaPercent)) return null;

    const roundedDelta = Number(rawDeltaPercent.toFixed(2));
    if (roundedDelta === 0) return null;
    if (Math.abs(roundedDelta) > 500) return null;

    const trend: 'up' | 'down' = roundedDelta > 0 ? 'up' : 'down';
    const sign = roundedDelta > 0 ? '+' : '';
    return {
      trend,
      percentText: `${sign}${roundedDelta.toFixed(2)}%`,
      contextText: tr('exchangeRateVsToday'),
    };
  }, [dateIso, effectiveUnitRate, isManualRateActive, loadingRate, todayMarketRate, tr]);

  const showNoTrendData = useMemo(() => {
    if (isManualRateActive) return false;
    const todayIso = getLocalTodayIso();
    if (dateIso === todayIso) return false;
    if (loadingRate) return false;
    if (rateComparison) return false;
    if (mainCurrency === secondaryCurrency) return false;
    if (!(effectiveUnitRate != null && effectiveUnitRate > 0)) return false;
    return true;
  }, [
    dateIso,
    effectiveUnitRate,
    isManualRateActive,
    loadingRate,
    mainCurrency,
    rateComparison,
    secondaryCurrency,
  ]);

  const renderCommissionCurrencySelector = () => {
    const isGlobal = isGlobalCommissionCurrency(commissionTargetCurrency);
    const code = commissionTargetCurrency;
    const meta = isGlobal ? null : getCurrencyMeta(code);
    const isOpen = openSelector === 'commission';

    const dropdownMenu = (
      <>
        {commissionSelectableCurrencies.map((currency) => (
          <button
            key={`commission-${currency}`}
            type="button"
            role="option"
            onClick={() => applyCommissionTarget(currency)}
            className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-sm transition-colors ${
              !isGlobal && code === currency
                ? utilityNavDropdownSelectedClass
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
            {!isGlobal && code === currency && (
              <span className="text-xs text-indigo-300">{tr('exchangeRateActive')}</span>
            )}
          </button>
        ))}

        <button
          type="button"
          role="option"
          onClick={() => applyCommissionTarget(GLOBAL_COMMISSION_CURRENCY)}
          className={`mt-1 flex w-full items-center justify-between rounded-lg border-t border-neutral-700/80 px-2.5 py-2 text-sm transition-colors ${
            isGlobal
              ? utilityNavDropdownSelectedClass
              : 'text-neutral-200 hover:bg-neutral-800'
          }`}
        >
          <span className="font-medium">{tr('exchangeRateCommissionGlobalCurrency')}</span>
          {isGlobal && <span className="text-xs text-indigo-300">{tr('exchangeRateActive')}</span>}
        </button>

        <button
          type="button"
          onClick={() => {
            setLibraryTarget('commission');
            setOpenSelector(null);
          }}
          className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-neutral-600 py-2 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white"
        >
          <Plus className="h-4 w-4" />
          {tr('exchangeRateAddCurrency')}
        </button>
      </>
    );

    return (
      <div className="relative min-w-0 overflow-visible">
        <label className="mb-1.5 block text-xs font-medium text-neutral-400">
          {tr('exchangeRateCommissionCurrencyLabel')}
        </label>
        <button
          ref={commissionTriggerRef}
          type="button"
          onClick={() => setOpenSelector((prev) => (prev === 'commission' ? null : 'commission'))}
          className={`${controlBaseClass} flex w-full items-center justify-between gap-2`}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <span dir="ltr" className="flex min-w-0 items-center gap-2">
            {isGlobal ? (
              <span className="truncate font-semibold">{tr('exchangeRateCommissionGlobalCurrency')}</span>
            ) : (
              <>
                <CurrencyFlag countryCode={meta!.countryCode} size="sm" alt={meta!.name} />
                <span className="truncate font-semibold">{code}</span>
              </>
            )}
          </span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-neutral-400 transition-transform ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {isOpen &&
          commissionDropdownLayout &&
          createPortal(
            <div
              ref={commissionDropdownPortalRef}
              role="listbox"
              className={`fixed overflow-y-auto overscroll-contain touch-pan-y ${currencySelectorDropdownClass}`}
              style={{
                top: commissionDropdownLayout.top,
                left: commissionDropdownLayout.left,
                width: commissionDropdownLayout.width,
                maxHeight: commissionDropdownLayout.maxHeight,
              }}
            >
              {dropdownMenu}
            </div>,
            document.body,
          )}
      </div>
    );
  };

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
            className={`absolute mt-1.5 w-full ${currencySelectorDropdownClass}`}
          >
            {selectableCurrencies.map((currency) => (
              <button
                key={`${target}-${currency}`}
                type="button"
                role="option"
                onClick={() => applySelectorValue(target, currency)}
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-sm transition-colors ${
                  code === currency
                    ? utilityNavDropdownSelectedClass
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
                  <span className="text-xs text-indigo-300">{tr('exchangeRateActive')}</span>
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

  const renderManualOverridesList = () => (
    <div className={`h-fit overflow-visible ${staticListCardClass}`}>
      <p className="text-xs font-medium text-slate-300">{tr('exchangeRateActiveOverrides')}</p>
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
  );

  const renderCommissionsList = () => (
    <div className={`h-fit overflow-visible ${staticListCardClass}`}>
      <p className="text-xs font-medium text-slate-300">{tr('exchangeRateActiveCommissions')}</p>
      <div className="mt-2 space-y-2">
        {storedCommissions.length === 0 ? (
          <p className="text-sm text-neutral-500">{tr('exchangeRateNoActiveCommissions')}</p>
        ) : (
          storedCommissions.map((entry) => {
            const isGlobal = isGlobalCommissionCurrency(entry.currency);
            const meta = isGlobal ? null : getCurrencyMeta(entry.currency);
            let validityText = tr('exchangeRateSave24h');
            if (entry.source === 'cloud') {
              validityText = tr('exchangeRateValidForeverCloud');
            } else if (entry.expiresAt != null) {
              validityText = formatRemainingTime(entry.expiresAt);
            }

            return (
              <div
                key={`commission-${entry.currency}-${entry.source}`}
                className="flex flex-col gap-2 rounded-lg border border-slate-700/60 bg-slate-950/60 p-2.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p dir="ltr" className="flex items-center gap-2 text-sm font-medium text-neutral-200">
                    {isGlobal ? (
                      <span>{tr('exchangeRateCommissionGlobalCurrency')}</span>
                    ) : (
                      <>
                        <CurrencyFlag countryCode={meta!.countryCode} size="xs" alt={meta!.name} />
                        {entry.currency}
                      </>
                    )}
                  </p>
                  <p className="text-xs text-neutral-400">
                    <LtrNumeric>
                      {replaceTokens(
                        isGlobal
                          ? tr('exchangeRateCommissionEntryGlobal')
                          : tr('exchangeRateCommissionEntry'),
                        {
                          currency: entry.currency,
                          percent: entry.percent,
                        },
                      )}
                    </LtrNumeric>
                  </p>
                  <p className="text-[11px] text-neutral-500">{validityText}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void deleteCommission(entry)}
                  className="inline-flex min-h-[2.25rem] w-full items-center justify-center gap-1.5 rounded-lg border border-rose-500/35 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-200 transition-colors hover:bg-rose-500/20 sm:w-auto"
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
  );

  if (section === 'manual-rate') {
    return (
      <div dir={dir} className="h-fit max-w-full space-y-4 overflow-visible">
        <div className={staticFormCardClass}>
          <div ref={selectorContainerRef} className="space-y-3">
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
                  disabled={sameCurrencyManualRate}
                  className={`h-12 w-12 ${utilityNavIconButtonClass}`}
                  aria-label={tr('exchangeRateSwapCurrencies')}
                  title={tr('exchangeRateSwapCurrencies')}
                >
                  <ArrowUpDown className="mx-auto h-4 w-4 rotate-90" />
                </button>
              </div>

              {renderSelector('secondary', secondaryCurrency, tr('exchangeRateSecondaryCurrency'))}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <label className="mb-1.5 block text-xs font-medium text-neutral-400">
                  {tr('exchangeRateMainAmountLabel')}
                </label>
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
              </div>

              <div className="hidden shrink-0 pb-3 text-sm font-medium text-neutral-500 sm:block" aria-hidden>
                =
              </div>

              <div className="min-w-0 flex-1">
                <label className="mb-1.5 block text-xs font-medium text-neutral-400">
                  {tr('exchangeRateSecondaryAmountLabel')}
                </label>
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
              </div>
            </div>

            {sessionOverride && !sameCurrencyManualRate && (
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

            {cloudError && <p className="text-xs text-rose-300">{cloudError}</p>}

            {sameCurrencyManualRate && (
              <p className="text-start text-xs text-rose-400" role="alert">
                {tr('exchangeRateSameCurrencyError')}
              </p>
            )}
          </div>

          <div className="flex justify-stretch border-t border-slate-700/50 pt-4 sm:justify-end">
            <button
              type="button"
              onClick={openManualRateSaveModal}
              disabled={!canSaveManualRate}
              className={`w-full min-h-[2.75rem] px-5 py-2.5 text-sm sm:w-auto disabled:cursor-not-allowed disabled:opacity-60 ${primaryActionButtonClass}`}
            >
              {tr('exchangeRateSaveManualRate')}
            </button>
          </div>
        </div>

        {renderManualOverridesList()}

        <ManualRateSaveModal
          open={manualRateSaveModalOpen}
          onClose={() => {
            setManualRateSaveModalOpen(false);
            setManualRateSaveError(null);
          }}
          onSave24h={persistManualRate24h}
          onSaveForever={() => void persistManualRateForever()}
          savingForever={cloudSaving}
          errorMessage={manualRateSaveError}
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

  if (section === 'commissions') {
    return (
      <div dir={dir} className="h-fit max-w-full space-y-4 overflow-visible">
        <div className={staticFormCardClass}>
          <div
            ref={commissionSelectorContainerRef}
            className={`relative grid h-fit w-full grid-cols-1 gap-3 overflow-visible sm:max-w-md sm:grid-cols-2 ${
              openSelector === 'commission' ? 'z-30' : ''
            }`}
          >
            <div className="min-w-0 overflow-visible sm:col-span-1">
              {renderCommissionCurrencySelector()}
            </div>
            <div className="flex min-h-0 flex-col justify-end gap-1.5 sm:col-span-1">
              <label
                htmlFor="exchange-rate-commission-percent-commissions"
                className="text-xs font-medium text-neutral-400"
              >
                {tr('exchangeRateCommissionPercent')}
              </label>
              <input
                id="exchange-rate-commission-percent-commissions"
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
                className={`${controlBaseClass} min-w-0 w-full`}
                aria-label={tr('exchangeRateCommissionPercent')}
              />
            </div>
          </div>

          <div className="flex justify-stretch border-t border-slate-700/50 pt-4 sm:justify-end">
            <button
              type="button"
              onClick={() => {
                setCommissionSaveError(null);
                setCommissionSaveModalOpen(true);
              }}
              className={`w-full min-h-[2.75rem] px-5 py-2.5 text-sm sm:w-auto ${primaryActionButtonClass}`}
            >
              {tr('exchangeRateSaveCommission')}
            </button>
          </div>
        </div>

        {renderCommissionsList()}

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

  return (
    <div
      dir={dir}
      className="max-w-full overflow-hidden rounded-2xl border border-blue-900/35 bg-gradient-to-b from-slate-950/80 to-slate-900/70 p-4 sm:p-5"
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
              className={`h-12 w-12 ${utilityNavIconButtonClass}`}
              aria-label={tr('exchangeRateSwapCurrencies')}
              title={tr('exchangeRateSwapCurrencies')}
            >
              <ArrowUpDown className="mx-auto h-4 w-4 rotate-90" />
            </button>
          </div>

          {renderSelector('secondary', secondaryCurrency, tr('exchangeRateSecondaryCurrency'))}
        </div>

        <div className="grid min-w-0 max-w-full grid-cols-1 gap-2 transition-all duration-300 ease-in-out sm:grid-cols-[minmax(0,auto)_minmax(0,1fr)] sm:items-start sm:gap-1.5">
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
            <div className="mt-2 flex w-full flex-col flex-wrap items-stretch gap-2 md:flex-row md:items-center">
              {currenciesToPin.map((code) => (
                <button
                  key={`pin-${code}`}
                  type="button"
                  onClick={() => pinTemporaryCurrency(code)}
                  className={utilityNavCompactButtonClass}
                >
                  {replaceTokens(tr('exchangeRatePinCurrency'), { code })}
                </button>
              ))}
            </div>
          </div>

          <div className="flex min-w-0 flex-1 flex-col items-start transition-all duration-300 ease-in-out">
            <label className="mb-1.5 block w-full text-start text-xs font-medium text-neutral-400">
              {tr('exchangeRateConversionCalculation')}
            </label>
            <div className="min-h-12 w-full max-w-full flex-1 overflow-hidden rounded-xl border border-blue-900/40 bg-blue-950/25 px-3 py-2.5 text-sm text-blue-100 transition-all duration-300 ease-in-out">
            {loadingRate ? (
              <span className="text-blue-200/80">{tr('exchangeRateLoadingHistorical')}</span>
            ) : (
              <div className="flex min-h-[5.5rem] w-full flex-col flex-wrap items-start gap-2 md:flex-row md:items-center">
                <div className="flex min-w-0 w-full flex-1 flex-col items-start gap-0.5">
                  <div className="flex w-full min-w-0 justify-start">
                    <div
                      dir="ltr"
                      className="inline-flex min-w-0 max-w-full flex-row items-center justify-start gap-2 overflow-hidden whitespace-nowrap md:text-base"
                      style={{ fontSize: `${conversionSummaryLayout.fontSizePx}px` }}
                    >
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="any"
                      value={mainAmountInput}
                      onChange={(event) => handleMainAmountChange(event.target.value)}
                      style={{
                        fontSize: `${conversionSummaryLayout.inputFontSizePx}px`,
                        width: `${conversionSummaryLayout.inputWidthCh}ch`,
                      }}
                      className="h-[2em] min-w-[3rem] max-w-[7rem] shrink-0 rounded-lg border border-blue-800/60 bg-blue-950/50 px-1.5 font-semibold leading-none text-blue-50 outline-none transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 [color-scheme:dark]"
                      aria-label={tr('exchangeRateMainAmountLabel')}
                    />
                    <span dir="ltr" className="shrink-0 font-semibold leading-none text-blue-100">
                      {mainCurrency}
                    </span>
                    <span className="shrink-0 leading-none text-blue-300/80" aria-hidden>
                      =
                    </span>
                    <LtrNumeric className="min-w-0 shrink font-semibold leading-none text-blue-50">
                      {summarySecondaryAmount != null ? formatRate(summarySecondaryAmount) : '-'}
                    </LtrNumeric>
                    <span dir="ltr" className="shrink-0 font-semibold leading-none text-blue-100">
                      {secondaryCurrency}
                    </span>
                    <button
                      type="button"
                      onClick={() => void copyConvertedAmount()}
                      disabled={summarySecondaryAmount == null || !(summarySecondaryAmount > 0)}
                      className="inline-flex h-[1.35em] w-[1.35em] shrink-0 items-center justify-center rounded border border-blue-800/60 bg-blue-950/50 text-blue-200 transition-all hover:border-blue-700/80 hover:bg-blue-900/50 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label={tr('exchangeRateCopyAmount')}
                      title={copyFeedback ? tr('exchangeRateCopied') : tr('exchangeRateCopyAmount')}
                    >
                      <Copy className="h-[0.7em] w-[0.7em]" strokeWidth={2.25} aria-hidden />
                    </button>
                    </div>
                  </div>
                  {historicalRateUpdatedAt != null && (
                    <p className="w-full self-start text-start text-xs leading-snug text-blue-200/75">
                      {formatHistoricalRateUpdatedLabel(historicalRateUpdatedAt)}
                    </p>
                  )}
                  {isFeeApplied && (
                    <div className="mt-2 flex w-full flex-col gap-1">
                      <p className="text-xs leading-snug text-amber-200/80">
                        {replaceTokens(tr('exchangeRateCurrencyFeeNotice'), {
                          percent: formatSavedCommissionPercent(activeCommissionPercent),
                        })}
                      </p>
                      {showUnitRateLine && displayUnitRate != null && (
                        <p className="w-full max-w-full break-words text-start text-xs text-blue-200/75">
                          <LtrNumeric className="break-words">
                            {replaceTokens(tr('exchangeRateUnitRateLineInclFee'), {
                              mainCurrency,
                              secondaryCurrency,
                              rate: formatRate(displayUnitRate),
                            })}
                          </LtrNumeric>
                        </p>
                      )}
                    </div>
                  )}
                </div>
                {isManualRateActive && (
                  <div className="flex w-full shrink-0 flex-row items-center justify-center self-stretch py-2 md:ms-auto md:w-auto md:justify-end">
                    <span className="text-sm font-semibold leading-tight text-yellow-500 md:text-base">
                      {tr('exchangeRateManualActive')}
                    </span>
                  </div>
                )}
                {rateComparison && (
                  <div className="flex w-full shrink-0 flex-row items-center justify-center gap-2 self-stretch whitespace-nowrap py-2 md:ms-auto md:w-auto md:justify-end md:gap-2.5">
                    <span className="text-sm font-semibold leading-tight text-neutral-100 md:text-xl">
                      {rateComparison.contextText}
                    </span>
                    <span
                      aria-hidden
                      className={`text-3xl leading-none md:text-[4rem] ${
                        rateComparison.trend === 'up' ? 'text-emerald-500' : 'text-rose-600'
                      }`}
                    >
                      {rateComparison.trend === 'up' ? '⬆' : '⬇'}
                    </span>
                    <LtrNumeric
                      className={`text-2xl font-black leading-none md:text-4xl ${
                        rateComparison.trend === 'up' ? 'text-emerald-400' : 'text-rose-500'
                      }`}
                    >
                      {rateComparison.percentText}
                    </LtrNumeric>
                  </div>
                )}
                {showNoTrendData && (
                  <p className="w-full max-w-full shrink-0 self-stretch py-2 text-end text-xs leading-snug text-blue-200/60 md:ms-auto md:max-w-[9rem] md:self-center">
                    {tr('exchangeRateNoTrendData')}
                  </p>
                )}
              </div>
            )}
            </div>
          </div>
        </div>
      </div>

      <CurrencyLibraryModal
        open={libraryTarget !== null}
        onClose={() => setLibraryTarget(null)}
        mode="expense"
        onExpenseCurrencySelect={handleLibraryPick}
      />
    </div>
  );
}
