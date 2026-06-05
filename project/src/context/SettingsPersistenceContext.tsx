import { createContext, useContext, type ReactNode } from 'react';
import {
  useSettingsPersistenceSync,
  type SettingsPersistenceSyncValue,
  type UseSettingsPersistenceSyncOptions,
} from '../hooks/useSettingsPersistenceSync';

const SettingsPersistenceContext = createContext<SettingsPersistenceSyncValue | null>(null);

export function SettingsPersistenceProvider({
  children,
  ...options
}: UseSettingsPersistenceSyncOptions & { children: ReactNode }) {
  const value = useSettingsPersistenceSync(options);
  return (
    <SettingsPersistenceContext.Provider value={value}>
      {children}
    </SettingsPersistenceContext.Provider>
  );
}

export function useSettingsPersistence(): SettingsPersistenceSyncValue {
  const context = useContext(SettingsPersistenceContext);
  if (!context) {
    throw new Error('useSettingsPersistence must be used within SettingsPersistenceProvider');
  }
  return context;
}

/** Safe accessor for routes outside the provider (e.g. dashboard). */
export function useOptionalSettingsPersistence(): SettingsPersistenceSyncValue | null {
  return useContext(SettingsPersistenceContext);
}
