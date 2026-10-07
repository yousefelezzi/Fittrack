/**
 * Pre-filling an exercise in Log Workout with what was logged last time.
 * Shared by the web and mobile clients (mobile imports it through its Metro
 * config). Pure JS only.
 *
 * Logged sets come from GET /workouts/last/:exerciseId: one entry per set, and
 * for unilateral exercises a 'left' entry then a 'right' entry per set.
 * Log Workout's sets are { reps, weight, rir } or, for unilateral exercises,
 * { left: { reps, weight, rir }, right: { reps, weight, rir } }, plus
 * `warmup: true` for warm-up sets.
 * RIR is left blank: how close to failure a set was is decided on the day.
 * Logged weights are kg; they're filled in `unit` (what was used last time).
 * Isometric exercises fill seconds held or bursts instead (exerciseTypes.js).
 */
import { fromSavedFields } from './exerciseTypes';

/**
 * The last workout's sets in Log Workout's shape for `exercise`, or [] if
 * there's nothing to copy. Warm-ups come back as warm-ups. Works even if the
 * exercise has since changed between unilateral and bilateral.
 */
export function setsFromLastWorkout(exercise, logged = [], unit = 'kg') {
  if (!logged.length) return [];
  const side = (s) => fromSavedFields(exercise, s, unit);
  const tag = (set, s) => (s.warmup ? { ...set, warmup: true } : set);
  const unilateral = exercise?.laterality === 'unilateral';

  if (!unilateral) {
    // Logged per side before: one set per left entry (or per lone right one).
    const sets = [];
    for (let i = 0; i < logged.length; i++) {
      const s = logged[i];
      if (s.side === 'left' && logged[i + 1]?.side === 'right') i++;
      sets.push(tag(side(s), s));
    }
    return sets;
  }

  // Pair each left entry with the right one after it; a lone side (or a set
  // logged before sides existed) fills both.
  const sets = [];
  for (let i = 0; i < logged.length; i++) {
    const s = logged[i];
    const next = logged[i + 1];
    if (s.side === 'left' && next?.side === 'right') {
      sets.push(tag({ left: side(s), right: side(next) }, s));
      i++;
    } else {
      sets.push(tag({ left: side(s), right: side(s) }, s));
    }
  }
  return sets;
}
