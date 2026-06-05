export const roundMoney = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

export const sanitizeMoneyNumber = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return roundMoney(value);
};

export const sumMoney = (values: readonly number[]): number =>
  values.reduce((sum, value) => roundMoney(sum + sanitizeMoneyNumber(value)), 0);

/** Strip invalid characters while the user is typing a decimal amount. */
export function sanitizeMoneyInputDraft(raw: string): string {
  const normalized = raw.replace(/,/g, '.').replace(/[^\d.]/g, '');
  const dotIndex = normalized.indexOf('.');
  if (dotIndex === -1) return normalized;
  const whole = normalized.slice(0, dotIndex);
  const fraction = normalized.slice(dotIndex + 1).replace(/\./g, '');
  return `${whole}.${fraction}`;
}

/** Parse a draft money string; returns null for empty or incomplete input. */
export function parseMoneyInput(raw: string): number | null {
  const trimmed = sanitizeMoneyInputDraft(raw.trim());
  if (trimmed === '' || trimmed === '.') return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return roundMoney(parsed);
}

/** Format a stored amount for display inside a text input. */
export function formatMoneyInputValue(amount: number): string {
  if (!(amount > 0)) return '';
  return String(amount);
}
