import { FirebaseError } from 'firebase/app';
import type { Lang } from './translations';

/** Maps Firebase Auth error codes to friendly Hebrew messages. */
export function mapAuthError(error: unknown, lang: Lang = 'he'): string {
  const code =
    error instanceof FirebaseError
      ? error.code
      : typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code: string }).code)
        : '';

  const heMessages: Record<string, string> = {
    'auth/email-already-in-use': 'כתובת האימייל כבר רשומה במערכת',
    'auth/invalid-email': 'כתובת האימייל אינה תקינה',
    'auth/user-disabled': 'החשבון הושבת. פנה לתמיכה',
    'auth/user-not-found': 'לא נמצא משתמש עם אימייל זה',
    'auth/wrong-password': 'סיסמה שגויה',
    'auth/invalid-credential': 'אימייל או סיסמה שגויים',
    'auth/weak-password': 'הסיסמה חלשה מדי — נדרשים לפחות 6 תווים',
    'auth/too-many-requests': 'יותר מדי ניסיונות. נסה שוב מאוחר יותר',
    'auth/popup-closed-by-user': 'חלון ההתחברות נסגר לפני השלמת התהליך',
    'auth/popup-blocked': 'חלון הקופץ נחסם. אפשר קופצים בדפדפן ונסה שוב',
    'auth/cancelled-popup-request': 'בקשת ההתחברות בוטלה. נסה שוב',
    'auth/account-exists-with-different-credential': 'כבר קיים חשבון עם אימייל זה בשיטת התחברות אחרת',
    'auth/network-request-failed': 'בעיית רשת. בדוק את החיבור לאינטרנט',
    'auth/operation-not-allowed': 'שיטת ההתחברות אינה מופעלת בפרויקט Firebase',
    'auth/admin-restricted-operation': 'כניסה כאורח אינה מופעלת. הפעל Anonymous Auth ב-Firebase Console',
    fallback: 'אירעה שגיאה. נסה שוב',
  };

  const enMessages: Record<string, string> = {
    'auth/email-already-in-use': 'This email is already registered',
    'auth/invalid-email': 'Invalid email address',
    'auth/user-disabled': 'This account is disabled',
    'auth/user-not-found': 'No user found with this email',
    'auth/wrong-password': 'Wrong password',
    'auth/invalid-credential': 'Incorrect email or password',
    'auth/weak-password': 'Password is too weak (min 6 characters)',
    'auth/too-many-requests': 'Too many attempts. Try again later',
    'auth/popup-closed-by-user': 'Sign-in popup was closed before completing',
    'auth/popup-blocked': 'Popup blocked. Enable popups and try again',
    'auth/cancelled-popup-request': 'Sign-in request was canceled. Try again',
    'auth/account-exists-with-different-credential':
      'An account already exists with this email using a different sign-in method',
    'auth/network-request-failed': 'Network error. Check your internet connection',
    'auth/operation-not-allowed': 'This sign-in method is not enabled in Firebase',
    'auth/admin-restricted-operation':
      'Guest sign-in is not enabled. Enable Anonymous Auth in Firebase Console',
    fallback: 'Something went wrong. Please try again',
  };

  const messages = lang === 'en' ? enMessages : heMessages;
  switch (code) {
    case 'auth/email-already-in-use':
      return messages['auth/email-already-in-use'];
    case 'auth/invalid-email':
      return messages['auth/invalid-email'];
    case 'auth/user-disabled':
      return messages['auth/user-disabled'];
    case 'auth/user-not-found':
      return messages['auth/user-not-found'];
    case 'auth/wrong-password':
      return messages['auth/wrong-password'];
    case 'auth/invalid-credential':
      return messages['auth/invalid-credential'];
    case 'auth/weak-password':
      return messages['auth/weak-password'];
    case 'auth/too-many-requests':
      return messages['auth/too-many-requests'];
    case 'auth/popup-closed-by-user':
      return messages['auth/popup-closed-by-user'];
    case 'auth/popup-blocked':
      return messages['auth/popup-blocked'];
    case 'auth/cancelled-popup-request':
      return messages['auth/cancelled-popup-request'];
    case 'auth/account-exists-with-different-credential':
      return messages['auth/account-exists-with-different-credential'];
    case 'auth/network-request-failed':
      return messages['auth/network-request-failed'];
    case 'auth/operation-not-allowed':
      return messages['auth/operation-not-allowed'];
    case 'auth/admin-restricted-operation':
      return messages['auth/admin-restricted-operation'];
    default:
      return messages.fallback;
  }
}

export const validateAuthForm = (
  mode: 'login' | 'signup',
  email: string,
  password: string,
  lang: Lang = 'he'
): string | null => {
  const m = lang === 'en'
    ? {
        enterEmail: 'Please enter an email address',
        invalidEmail: 'Invalid email address',
        enterPassword: 'Please enter a password',
        passwordMin: 'Password must contain at least 6 characters',
        signupPasswordMin: 'Sign-up requires at least 6 characters',
      }
    : {
        enterEmail: 'יש להזין כתובת אימייל',
        invalidEmail: 'כתובת האימייל אינה תקינה',
        enterPassword: 'יש להזין סיסמה',
        passwordMin: 'הסיסמה חייבת להכיל לפחות 6 תווים',
        signupPasswordMin: 'להרשמה נדרשת סיסמה באורך 6 תווים לפחות',
      };
  const trimmed = email.trim();
  if (!trimmed) return m.enterEmail;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return m.invalidEmail;
  if (!password) return m.enterPassword;
  if (password.length < 6) return m.passwordMin;
  if (mode === 'signup' && password.length < 6) return m.signupPasswordMin;
  return null;
};
