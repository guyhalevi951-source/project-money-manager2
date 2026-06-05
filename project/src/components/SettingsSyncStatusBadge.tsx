import { Check, Cloud, HardDrive, Loader2 } from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import { useOptionalSettingsPersistence } from '../context/SettingsPersistenceContext';
import { themeTextMutedClass, themeTextSubtleClass } from '../styles/themeSurfaceStyles';

export default function SettingsSyncStatusBadge({ className = '' }: { className?: string }) {
  const { tr } = useLanguage();
  const persistence = useOptionalSettingsPersistence();

  if (!persistence || persistence.syncStatus === 'idle' || persistence.syncStatus === 'hydrating') {
    return null;
  }

  const { syncStatus, persistenceRoute } = persistence;

  if (syncStatus === 'saving') {
    return (
      <span
        role="status"
        aria-live="polite"
        className={`inline-flex items-center gap-1.5 text-xs ${themeTextMutedClass} ${className}`.trim()}
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        {tr('settingsPrefsSyncSaving')}
      </span>
    );
  }

  if (syncStatus === 'saved') {
    return (
      <span
        role="status"
        aria-live="polite"
        className={`inline-flex items-center gap-1.5 text-xs text-emerald-400/90 ${className}`.trim()}
      >
        <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
        {tr('settingsPrefsSyncSaved')}
        {persistenceRoute === 'cloud' ? (
          <Cloud className="h-3 w-3 opacity-70" aria-hidden />
        ) : (
          <HardDrive className="h-3 w-3 opacity-70" aria-hidden />
        )}
      </span>
    );
  }

  return (
    <span
      role="status"
      aria-live="polite"
      className={`inline-flex items-center gap-1.5 text-xs text-rose-400/90 ${className}`.trim()}
    >
      {tr('settingsPrefsSyncError')}
      <span className={themeTextSubtleClass}>
        {persistenceRoute === 'cloud' ? '(cloud)' : '(local)'}
      </span>
    </span>
  );
}
