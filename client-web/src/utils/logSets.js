/**
 * Sets as Log Workout edits them. Shared by the web and mobile clients (mobile
 * imports it through its Metro config). Pure JS only.
 *
 * A set is { reps, weight, rir } or, for unilateral exercises (one arm/leg at a
 * time), { left: { reps, weight, rir }, right: { reps, weight, rir } }; either
 * can have restTime. Isometric exercises use other values in place of reps,
 * weight and RIR (seconds held / bursts: see exerciseTypes.js). Warm-up sets
 * have `warmup: true` and no RIR — they don't count toward stats. Each exercise
 * has a unit (ex.unit, 'kg' | 'lb'); weights are typed in it and converted to
 * kg when saved.
 */
import { convertWeight } from './weightUnits';
import { typeOf, SET_FIELDS, DEFAULT_VALUES } from './exerciseTypes';

export const SIDES = ['left', 'right'];
export const isUnilateral = (exercise) => exercise?.laterality === 'unilateral';

/**
 * A new set for an exercise. `values` can hold any of the exercise type's
 * fields (reps/weight/rir, seconds/weight/sir, or bursts/burstSeconds/burstRest);
 * the rest take their defaults.
 */
export const makeSet = (exercise, { warmup = false, ...values } = {}) => {
  const type = typeOf(exercise);
  const one = {};
  for (const { key } of SET_FIELDS[type]) one[key] = values[key] !== undefined ? values[key] : DEFAULT_VALUES[type][key];
  const set = isUnilateral(exercise) ? { left: { ...one }, right: { ...one } } : one;
  return warmup && type === 'dynamic' ? { ...set, warmup: true } : set;
};

/** The values to carry over when a set changes exercise (e.g. swapping): all but the effort. */
const NOT_CARRIED = new Set(['rir', 'sir', 'left', 'right', 'warmup', 'restTime', 'side']);
export const setBasics = (set) => Object.fromEntries(Object.entries(set.left || set).filter(([k]) => !NOT_CARRIED.has(k)));

/**
 * A warm-up for an exercise ({ exercise, unit, sets }): about half the first
 * working set's weight, rounded to a plate step (2.5kg / 5lb).
 */
export const makeWarmup = (ex) => {
  // Only dynamic exercises have warm-ups.
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
