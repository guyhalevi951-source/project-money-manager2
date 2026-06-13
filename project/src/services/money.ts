/** Standard 2 decimal-place financial rounding (EPSILON-safe). */
export const roundMoney = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

/**
 * Smart financial rounding for ILS ledger amounts.
 *
 * Applies standard 2dp rounding first, then snaps to the nearest integer when
 * the fractional part is within 0.05 % of the value.  This corrects accumulated
 * float drift produced by intermediate rounded conversions (e.g. ILS 500 →
 * GBP 127.38 → back-computed ILS 499.96 should be 500, not 499.96).
 *
 * Safe threshold proof:
 *   - 499.99 → diff 0.01 / 500 = 0.002 % < 0.05 % → snaps to 500  ✓
 *   - 500.10 → diff 0.10 / 500 = 0.020 % < 0.05 % → snaps to 500  ✓
 *   - 127.38 → diff 0.38 / 127 = 0.299 % > 0.05 % → stays 127.38  ✓
 *
 * Only use on ILS ledger writes, never on foreign display amounts.
 */
export const smartRoundMoney = (value: number): number => {
  const twoDecimal = Math.round((value + Number.EPSILON) * 100) / 100;
  const integer = Math.round(twoDecimal);
  const diff = Math.abs(twoDecimal - integer);
  if (diff === 0) return integer;
  return diff / Math.max(1, Math.abs(twoDecimal)) < 0.0005 ? integer : twoDecimal;
};

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
