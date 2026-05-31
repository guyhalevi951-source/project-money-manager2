import { FirebaseError } from 'firebase/app';

/** Maps Firebase Auth error codes to friendly Hebrew messages. */
export function mapAuthError(error: unknown): string {
  const code =
    error instanceof FirebaseError
      ? error.code
      : typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code: string }).code)
        : '';

  switch (code) {
    case 'auth/email-already-in-use':
      return 'כתובת האימייל כבר רשומה במערכת';
    case 'auth/invalid-email':
      return 'כתובת האימייל אינה תקינה';
    case 'auth/user-disabled':
      return 'החשבון הושבת. פנה לתמיכה';
    case 'auth/user-not-found':
      return 'לא נמצא משתמש עם אימייל זה';
    case 'auth/wrong-password':
      return 'סיסמה שגויה';
    case 'auth/invalid-credential':
      return 'אימייל או סיסמה שגויים';
    case 'auth/weak-password':
      return 'הסיסמה חלשה מדי — נדרשים לפחות 6 תווים';
    case 'auth/too-many-requests':
      return 'יותר מדי ניסיונות. נסה שוב מאוחר יותר';
    case 'auth/popup-closed-by-user':
      return 'חלון Google נסגר לפני השלמת ההתחברות';
    case 'auth/popup-blocked':
      return 'חלון הקופץ נחסם. אפשר קופצים בדפדפן ונסה שוב';
    case 'auth/network-request-failed':
      return 'בעיית רשת. בדוק את החיבור לאינטרנט';
    case 'auth/operation-not-allowed':
      return 'שיטת ההתחברות אינה מופעלת בפרויקט Firebase';
    default:
      return 'אירעה שגיאה. נסה שוב';
  }
}

export const validateAuthForm = (
  mode: 'login' | 'signup',
  email: string,
  password: string
): string | null => {
  const trimmed = email.trim();
  if (!trimmed) return 'יש להזין כתובת אימייל';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return 'כתובת האימייל אינה תקינה';
  if (!password) return 'יש להזין סיסמה';
  if (password.length < 6) return 'הסיסמה חייבת להכיל לפחות 6 תווים';
  if (mode === 'signup' && password.length < 6) return 'להרשמה נדרשת סיסמה באורך 6 תווים לפחות';
  return null;
};
