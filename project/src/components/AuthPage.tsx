import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, Mail, Lock, Loader2 } from 'lucide-react';
import {
  isFirebaseConfigured,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
} from '../firebase';
import { mapAuthError, validateAuthForm } from '../authErrors';

type AuthMode = 'login' | 'signup';

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

export default function AuthPage() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const firebaseReady = isFirebaseConfigured();

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setError('');
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const validation = validateAuthForm(mode, email, password);
    if (validation) {
      setError(validation);
      return;
    }

    if (!firebaseReady) {
      setError('Firebase לא מוגדר. הוסף את משתני הסביבה בקובץ .env');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        await signInWithEmail(email, password);
      } else {
        await signUpWithEmail(email, password);
      }
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    if (!firebaseReady) {
      setError('Firebase לא מוגדר. הוסף את משתני הסביבה בקובץ .env');
      return;
    }
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4 py-10"
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
        <div className="rounded-3xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-xl shadow-2xl shadow-black/50 p-6 sm:p-8">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-3 rounded-2xl shadow-lg shadow-emerald-500/25 mb-4">
              <Wallet className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-100">מנהל התקציב שלי</h1>
            <p className="text-sm text-slate-400 mt-1">נהל הוצאות בצורה חכמה ובטוחה</p>
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
                <span className="relative z-10">{m === 'login' ? 'כניסה' : 'הרשמה'}</span>
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
                label="אימייל"
                value={email}
                onChange={setEmail}
                autoComplete="email"
                disabled={loading}
              />
              <FloatingField
                id="auth-password"
                type="password"
                label="סיסמה"
                value={password}
                onChange={setPassword}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                disabled={loading}
              />

              {mode === 'signup' && (
                <p className="text-xs text-slate-500 -mt-1">הסיסמה חייבת להכיל לפחות 6 תווים</p>
              )}

              {error && (
                <p className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2.5">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold shadow-lg shadow-emerald-500/25 hover:from-emerald-600 hover:to-teal-700 transition-all active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    ממתין...
                  </>
                ) : mode === 'login' ? (
                  'כניסה לחשבון'
                ) : (
                  'יצירת חשבון'
                )}
              </button>
            </motion.form>
          </AnimatePresence>

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-slate-800" />
            <span className="text-xs text-slate-500 shrink-0">או</span>
            <div className="flex-1 h-px bg-slate-800" />
          </div>

          <button
            type="button"
            onClick={handleGoogle}
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 font-medium hover:bg-slate-900 hover:border-slate-600 transition-all active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-3"
          >
            <GoogleIcon className="w-5 h-5 shrink-0" />
            המשך עם Google
          </button>

          {!firebaseReady && (
            <p className="mt-4 text-xs text-amber-400/90 text-center leading-relaxed">
              הגדר את משתני VITE_FIREBASE_* בקובץ .env (ראה .env.example)
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}
