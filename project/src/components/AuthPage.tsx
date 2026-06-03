import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, Loader2, UserRound, Globe } from 'lucide-react';
import appLogo from '../assets/app-logo.png';
import {
  isFirebaseConfigured,
  signInWithEmail,
  signInWithGoogle,
  signInWithFacebook,
  signInWithTwitter,
  signInAsGuest,
  signUpWithEmail,
} from '../firebase';
import { mapAuthError, validateAuthForm } from '../authErrors';
import { useLanguage } from '../LanguageContext';
import type { Lang } from '../translations';
import {
  clearAuthPageLang,
  resolveAuthPageInitialLang,
  writeAuthPageLang,
  writeGuestLang,
  writePendingAuthLang,
  writePreferredLanguage,
} from '../services/authLanguagePreference';

type AuthMode = 'login' | 'signup';
type LoadingAction = 'email' | 'google' | 'facebook' | 'twitter' | 'guest' | null;

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

interface FloatingFieldProps {
  id: string;
  type: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  disabled?: boolean;
}

function FloatingField({
  id,
  type,
  label,
  value,
  onChange,
  autoComplete,
  disabled,
}: FloatingFieldProps) {
  const Icon = type === 'password' ? Lock : Mail;

  return (
    <div className="relative">
      <Icon className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 pointer-events-none z-10" />
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder=" "
        autoComplete={autoComplete}
        disabled={disabled}
        className="peer w-full rounded-xl bg-slate-950/80 border border-slate-700/80 text-slate-100 pr-12 pl-4 pt-6 pb-2.5 text-base outline-none transition-all duration-200 focus:border-emerald-500/70 focus:ring-2 focus:ring-emerald-500/25 focus:shadow-[0_0_20px_rgba(16,185,129,0.15)] disabled:opacity-60"
      />
      <label
        htmlFor={id}
        className="absolute right-12 top-4 text-slate-400 text-sm transition-all duration-200 pointer-events-none peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-focus:top-2 peer-focus:text-xs peer-focus:text-emerald-400 peer-[:not(:placeholder-shown)]:top-2 peer-[:not(:placeholder-shown)]:text-xs"
      >
        {label}
      </label>
    </div>
  );
}

interface SocialButtonProps {
  onClick: () => void;
  disabled: boolean;
  loading: boolean;
  icon: React.ReactNode;
  label?: string;
  className: string;
  ariaLabel?: string;
  signInWithText?: string;
}

function SocialButton({
  onClick,
  disabled,
  loading,
  icon,
  label,
  className,
  ariaLabel,
  signInWithText,
}: SocialButtonProps) {
  const text = signInWithText ?? label;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`w-full py-3.5 rounded-xl font-medium transition-all active:scale-[0.98] disabled:opacity-60 flex flex-row items-center justify-center gap-3 ${className}`}
    >
      {text != null && <span>{text}</span>}
      {loading ? <Loader2 className="w-5 h-5 animate-spin shrink-0" /> : icon}
    </button>
  );
}

const SOCIAL_AUTH_ACTIONS = new Set<LoadingAction>(['google', 'facebook', 'twitter']);

export default function AuthPage() {
  const { dir, tr, lang, setLang } = useLanguage();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loadingAction, setLoadingAction] = useState<LoadingAction>(null);

  const firebaseReady = isFirebaseConfigured();
  const loading = loadingAction !== null;
  const authLangHydratedRef = useRef(false);

  useEffect(() => {
    if (authLangHydratedRef.current) return;
    authLangHydratedRef.current = true;

    const initial = resolveAuthPageInitialLang();
    if (!initial) return;

    setLang(initial, { persist: false });
  }, [setLang]);

  const toggleAuthLanguage = () => {
    const next: Lang = lang === 'he' ? 'en' : 'he';
    writePreferredLanguage(next);
    writeAuthPageLang(next);
    setLang(next, { persist: false });
  };

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setError('');
  };

  const runAuth = async (action: LoadingAction, fn: () => Promise<unknown>) => {
    setError('');
    if (!firebaseReady) {
      setError(tr('authFirebaseMissing'));
      return;
    }

    if (action === 'guest') {
      writeGuestLang(lang);
      clearAuthPageLang();
    } else if (action != null && SOCIAL_AUTH_ACTIONS.has(action)) {
      writePendingAuthLang(lang);
    }

    setLoadingAction(action);
    try {
      await fn();
    } catch (err) {
      setError(mapAuthError(err, lang));
    } finally {
      setLoadingAction(null);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const validation = validateAuthForm(mode, email, password, lang);
    if (validation) {
      setError(validation);
      return;
    }

    await runAuth('email', async () => {
      if (mode === 'login') {
        await signInWithEmail(email, password);
      } else {
        await signUpWithEmail(email, password);
      }
    });
  };

  return (
    <div
      dir={dir}
      className="relative min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4 py-10"
      style={{ paddingTop: 'max(2.5rem, env(safe-area-inset-top))', paddingBottom: 'max(2.5rem, env(safe-area-inset-bottom))' }}
    >
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[28rem] h-[28rem] rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute bottom-0 end-0 w-72 h-72 rounded-full bg-indigo-600/10 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="relative w-full max-w-md"
      >
        {/* Glass card */}
        <div className="relative rounded-3xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-xl shadow-2xl shadow-black/50 p-6 sm:p-8">
          <button
            type="button"
            onClick={toggleAuthLanguage}
            disabled={loading}
            className="absolute z-10 top-4 end-4 flex flex-row items-center gap-1.5 rounded-full border border-white/10 bg-white/10 p-2 px-3 text-xs font-semibold uppercase tracking-wide text-slate-100 shadow-lg shadow-black/20 backdrop-blur-sm transition-colors hover:border-white/20 hover:bg-white/15 disabled:opacity-50 md:fixed md:z-20 md:top-[max(1.5rem,env(safe-area-inset-top))] md:end-[max(1.5rem,env(safe-area-inset-inline-end,0px))]"
            aria-label={tr('authSwitchLanguage')}
            title={tr('authSwitchLanguage')}
          >
            <Globe className="h-4 w-4 shrink-0 text-emerald-300/90" aria-hidden />
            <span>{lang === 'he' ? 'HE' : 'EN'}</span>
          </button>

          <div className="flex w-full max-w-full flex-col items-center text-center mb-8 pt-8 sm:pt-6 md:pt-0">
            <img
              src={appLogo}
              alt={tr('appName')}
              className="mb-4 aspect-square w-full max-w-[13.5rem] object-contain [image-rendering:crisp-edges]"
              style={{ imageRendering: '-webkit-optimize-contrast' } as import('react').CSSProperties}
              decoding="async"
              fetchPriority="high"
            />
            <h1 className="text-2xl font-bold text-slate-100">{tr('appName')}</h1>
            <p className="text-sm text-slate-400 mt-1">{tr('authSubtitle')}</p>
          </div>

          {/* Login / Sign up toggle */}
          <div className="flex p-1 rounded-2xl bg-slate-950/60 border border-slate-800 mb-6">
            {(['login', 'signup'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                className={`relative flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ${
                  mode === m ? 'text-slate-950' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {mode === m && (
                  <motion.span
                    layoutId="auth-mode-pill"
                    className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-teal-500 rounded-xl shadow-md shadow-emerald-500/30"
                    transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                  />
                )}
                <span className="relative z-10">{m === 'login' ? tr('authLogin') : tr('authSignup')}</span>
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.form
              key={mode}
              initial={{ opacity: 0, x: mode === 'login' ? -8 : 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: mode === 'login' ? 8 : -8 }}
              transition={{ duration: 0.22 }}
              onSubmit={handleEmailSubmit}
              className="space-y-4"
            >
              <FloatingField
                id="auth-email"
                type="email"
                label={tr('authEmail')}
                value={email}
                onChange={setEmail}
                autoComplete="email"
                disabled={loading}
              />
              <FloatingField
                id="auth-password"
                type="password"
                label={tr('authPassword')}
                value={password}
                onChange={setPassword}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                disabled={loading}
              />

              {mode === 'signup' && (
                <p className="text-xs text-slate-500 -mt-1">{tr('authPasswordHint')}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold shadow-lg shadow-emerald-500/25 hover:from-emerald-600 hover:to-teal-700 transition-all active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loadingAction === 'email' ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {tr('authWaiting')}
                  </>
                ) : mode === 'login' ? (
                  tr('authLoginCta')
                ) : (
                  tr('authCreateAccount')
                )}
              </button>
            </motion.form>
          </AnimatePresence>

          {error && (
            <p className="mt-4 text-sm text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2.5">
              {error}
            </p>
          )}

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-slate-800" />
            <span className="text-xs text-slate-500 shrink-0">{tr('authOr')}</span>
            <div className="flex-1 h-px bg-slate-800" />
          </div>

          <div className="space-y-3">
            <SocialButton
              onClick={() => runAuth('google', signInWithGoogle)}
              disabled={loading}
              loading={loadingAction === 'google'}
              icon={<GoogleIcon className="w-5 h-5 shrink-0" />}
              ariaLabel={`${tr('signInWith')} Google`}
              signInWithText={tr('signInWith')}
              className="bg-slate-950 border border-slate-700 text-slate-100 hover:bg-slate-900 hover:border-slate-600"
            />

            <SocialButton
              onClick={() => runAuth('facebook', signInWithFacebook)}
              disabled={loading}
              loading={loadingAction === 'facebook'}
              icon={<FacebookIcon className="w-5 h-5 shrink-0 text-white" />}
              ariaLabel={`${tr('signInWith')} Facebook`}
              signInWithText={tr('signInWith')}
              className="bg-[#1877F2] border border-[#1877F2] text-white hover:bg-[#166FE5] hover:border-[#166FE5] shadow-md shadow-[#1877F2]/20"
            />

            <SocialButton
              onClick={() => runAuth('twitter', signInWithTwitter)}
              disabled={loading}
              loading={loadingAction === 'twitter'}
              icon={<XIcon className="w-5 h-5 shrink-0 text-white" />}
              ariaLabel={`${tr('signInWith')} X`}
              signInWithText={tr('signInWith')}
              className="bg-black border border-neutral-800 text-white hover:bg-neutral-900 hover:border-neutral-700 shadow-md shadow-black/30"
            />

            <SocialButton
              onClick={() => runAuth('guest', signInAsGuest)}
              disabled={loading}
              loading={loadingAction === 'guest'}
              icon={<UserRound className="w-5 h-5 shrink-0 text-slate-400" />}
              label={tr('authGuest')}
              className="border border-slate-700/80 bg-slate-900/30 text-slate-300 hover:bg-slate-900/60 hover:border-emerald-500/40 hover:text-slate-100"
            />
          </div>

          {!firebaseReady && (
            <p className="mt-4 text-xs text-amber-400/90 text-center leading-relaxed">
              {tr('authFirebaseHint')}
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}
