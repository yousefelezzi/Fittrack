/**
 * Sets as Log Workout edits them. Shared by the web and mobile clients (mobile
 * imports it through its Metro config). Pure JS only.
 *
 * A set is { reps, weight, rir } or, for unilateral exercises (one arm/leg at a
 * time), { left: { reps, weight, rir }, right: { reps, weight, rir } }; either
 * can have restTime. Warm-up sets have `warmup: true` and no RIR — they don't
 * count toward stats. Each exercise has a unit (ex.unit, 'kg' | 'lb'); weights
 * are typed in it and converted to kg when saved.
 */
import { convertWeight } from './weightUnits';

export const SIDES = ['left', 'right'];
export const isUnilateral = (exercise) => exercise?.laterality === 'unilateral';

export const makeSet = (exercise, { reps = 10, weight = 0, rir = '', warmup = false } = {}) => {
  const set = isUnilateral(exercise)
    ? { left: { reps, weight, rir }, right: { reps, weight, rir } }
    : { reps, weight, rir };
  return warmup ? { ...set, warmup: true } : set;
};

/** Reps/weight to carry over when a set changes exercise (e.g. swapping). */
export const setBasics = (set) => (set.left ? { reps: set.left.reps, weight: set.left.weight } : { reps: set.reps, weight: set.weight });

/**
 * A warm-up for an exercise ({ exercise, unit, sets }): about half the first
 * working set's weight, rounded to a plate step (2.5kg / 5lb).
 */
export const makeWarmup = (ex) => {
  const first = ex.sets.find((st) => !st.warmup);
  const step = ex.unit === 'lb' ? 5 : 2.5;
  const weight = first ? Math.round(((Number(setBasics(first).weight) || 0) * 0.5) / step) * step : 0;
  return makeSet(ex.exercise, { reps: 10, weight, warmup: true });
};

/** Where a new warm-up goes: after any warm-ups already at the start. */
export const warmupInsertIndex = (sets) => { let i = 0; while (sets[i]?.warmup) i++; return i; };

/** Every weight in a set re-expressed in another unit (same load). */
export const convertSet = (set, from, to) => {
  const conv = (v) => ({ ...v, weight: convertWeight(v.weight, from, to) });
  return set.left ? { ...set, left: conv(set.left), right: conv(set.right) } : conv(set);
};

/** An exercise with all its weights switched to `unit`. */
export const withUnit = (ex, unit) => (ex.unit === unit ? ex
  : { ...ex, unit, sets: ex.sets.map((st) => convertSet(st, ex.unit || 'kg', unit)) });

/** "W" for a warm-up, else the working-set number (warm-ups aren't counted). */
export const setNumber = (sets, idx) => (sets[idx]?.warmup ? 'W' : sets.slice(0, idx + 1).filter((st) => !st.warmup).length);
