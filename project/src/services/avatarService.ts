export const GUEST_AVATAR_STORAGE_KEY = 'guest_avatar';
export const DEFAULT_GUEST_AVATAR_URL =
  'https://api.dicebear.com/8.x/fun-emoji/svg?seed=BlueSmile';

const isValidAvatarUrl = (value: string): boolean =>
  value.startsWith('https://') ||
  value.startsWith('http://') ||
  value.startsWith('/') ||
  value.startsWith('data:image/');

export const sanitizeAvatarUrl = (
  value: unknown,
  fallback: string = DEFAULT_GUEST_AVATAR_URL,
): string => {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed || trimmed === 'undefined' || trimmed === 'null' || trimmed === '[object Object]') {
    return fallback;
  }
  return isValidAvatarUrl(trimmed) ? trimmed : fallback;
};

export const getGuestAvatarFromStorage = (): string =>
  sanitizeAvatarUrl(window.localStorage.getItem(GUEST_AVATAR_STORAGE_KEY), DEFAULT_GUEST_AVATAR_URL);
