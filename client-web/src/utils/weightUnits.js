/**
 * kg / lb for logged lifts. Shared by the web and mobile clients (mobile
 * imports it through its Metro config). Pure JS only.
 *
 * Weights are always stored in kg. Each logged exercise remembers the unit it
 * was entered in (weightUnit), so it's shown and pre-filled in that unit.
 */
export const KG_PER_LB = 0.45359237;
export const UNITS = ['kg', 'lb'];

const round1 = (n) => Math.round(n * 10) / 10;

/** A weight typed in `unit`, in kg (unrounded, so lb → kg → lb gives back the same number). */
export const toKg = (value, unit) => {
  const n = Number(value) || 0;
  return unit === 'lb' ? n * KG_PER_LB : n;
};

/** A stored kg weight in `unit`, to one decimal. */
export const fromKg = (kg, unit) => round1(unit === 'lb' ? (Number(kg) || 0) / KG_PER_LB : Number(kg) || 0);

/** Re-express a typed weight in another unit (same load), to one decimal. Blank stays blank. */
export const convertWeight = (value, from, to) => {
  if (value === '' || value == null || from === to) return value;
  return fromKg(toKg(value, from), to);
};

/** "60kg" / "132.3lb" for a stored kg weight. */
export const formatWeight = (kg, unit = 'kg') => `${fromKg(kg, unit)}${unit === 'lb' ? 'lb' : 'kg'}`;
