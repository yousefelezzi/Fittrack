/**
 * Exercise types and what a set of each records. Shared by the web and mobile
 * clients (mobile imports it through its Metro config). Pure JS only.
 *
 *   dynamic    — reps × weight, with reps in reserve (RIR)
 *   yielding   — isometric hold against a load: seconds held × weight, with
 *                seconds in reserve (SIR)
 *   overcoming — isometric push/pull against something that doesn't move:
 *                bursts, seconds per burst, rest between bursts
 *
 * Log Workout keeps a set's values under the keys below (weights in the
 * exercise's kg/lb unit); the server stores them as reps/weight/rir,
 * duration/weight/sir, or bursts/burstSeconds/burstRest (weights in kg).
 */
import { toKg, fromKg } from './weightUnits';

export const EXERCISE_TYPES = [
  ['dynamic', 'Dynamic', 'Reps × weight, like most exercises'],
  ['yielding', 'Yielding isometric', 'Hold a position against a load (plank, wall sit): logged in seconds'],
  ['overcoming', 'Overcoming isometric', "Push or pull against something that doesn't move, in short bursts"],
];
export const TYPE_LABEL = Object.fromEntries(EXERCISE_TYPES.map(([k, l]) => [k, l]));

export const typeOf = (exercise) => (exercise?.type === 'yielding' || exercise?.type === 'overcoming' ? exercise.type : 'dynamic');

/**
 * The three numbers logged per set, in order. `amount` is what must be above 0
 * for the set to count; `effort` is optional (blank = not recorded); `weight`
 * is shown in the exercise's unit.
 */
export const SET_FIELDS = {
  dynamic: [
    { key: 'reps', label: 'Reps', amount: true },
    { key: 'weight', label: 'Weight', weight: true },
    { key: 'rir', label: 'RIR', effort: true, max: 10, hint: 'Reps in reserve: how many more reps you could have done' },
  ],
  yielding: [
    { key: 'seconds', label: 'Seconds', short: 'Sec', amount: true },
    { key: 'weight', label: 'Weight', weight: true },
    { key: 'sir', label: 'SIR', effort: true, max: 600, hint: 'Seconds in reserve: how much longer you could have held' },
  ],
  overcoming: [
    { key: 'bursts', label: 'Bursts', amount: true },
    { key: 'burstSeconds', label: 'Sec/burst', short: 'Sec', hint: 'How long each burst lasts' },
    { key: 'burstRest', label: 'Rest', hint: 'Seconds of rest between bursts' },
  ],
};
export const fieldsOf = (exercise) => SET_FIELDS[typeOf(exercise)];
export const amountKey = (exercise) => fieldsOf(exercise)[0].key;
/** Fields that can be left blank. */
export const OPTIONAL_FIELDS = new Set(['rir', 'sir', 'restTime']);

/** A new set's values for an exercise type. */
export const DEFAULT_VALUES = {
  dynamic: { reps: 10, weight: 0, rir: '' },
  yielding: { seconds: 30, weight: 0, sir: '' },
  overcoming: { bursts: 5, burstSeconds: 3, burstRest: 10 },
};

const num = (v) => (v === '' || v == null ? null : Number(v));

/** Log Workout values → the fields the server stores (weight converted to kg). */
export function toSavedFields(exercise, v, unit) {
  const type = typeOf(exercise);
  const effort = (x) => (x !== '' && x != null && Number.isFinite(Number(x)) ? Number(x) : undefined);
  if (type === 'yielding') {
    return { duration: Math.round(Number(v.seconds) || 0), weight: toKg(v.weight, unit), ...(effort(v.sir) != null && { sir: effort(v.sir) }) };
  }
  if (type === 'overcoming') {
    return {
      bursts: Math.round(Number(v.bursts) || 0),
      ...(num(v.burstSeconds) != null && { burstSeconds: Math.round(num(v.burstSeconds)) }),
      ...(num(v.burstRest) != null && { burstRest: Math.round(num(v.burstRest)) }),
    };
  }
  return { reps: Number(v.reps), weight: toKg(v.weight, unit), ...(effort(v.rir) != null && { rir: effort(v.rir) }) };
}

/** A saved set → Log Workout values in `unit`. The effort (RIR/SIR) is left blank. */
export function fromSavedFields(exercise, s, unit) {
  const type = typeOf(exercise);
  if (type === 'yielding') return { seconds: s.duration ?? 0, weight: fromKg(s.weight, unit), sir: '' };
  if (type === 'overcoming') {
    return { bursts: s.bursts ?? 0, burstSeconds: s.burstSeconds ?? DEFAULT_VALUES.overcoming.burstSeconds, burstRest: s.burstRest ?? DEFAULT_VALUES.overcoming.burstRest };
  }
  return { reps: s.reps, weight: fromKg(s.weight, unit), rir: '' };
}

/** How much was done in a saved set: reps, seconds held or bursts. */
export const savedAmount = (exercise, s) => {
  const type = typeOf(exercise);
  return Number(type === 'yielding' ? s.duration : type === 'overcoming' ? s.bursts : s.reps) || 0;
};

/** The unit of a set's amount, for labels: 'reps', 's' or 'bursts'. */
export const amountUnit = (exercise) => ({ dynamic: 'reps', yielding: 's', overcoming: 'bursts' })[typeOf(exercise)];
