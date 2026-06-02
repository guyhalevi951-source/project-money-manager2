export const roundMoney = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

export const sanitizeMoneyNumber = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return roundMoney(value);
};

export const sumMoney = (values: readonly number[]): number =>
  values.reduce((sum, value) => roundMoney(sum + sanitizeMoneyNumber(value)), 0);
