// Shared by the web and mobile clients (mobile imports it through its Metro config).

import { formatWeight } from './weightUnits';

/**
 * Working sets (a unilateral left + right pair counts once; warm-ups are
 * counted separately), total volume in kg and best set per exercise. `bestLabel`
 * is the best set in the unit the exercise was logged in, e.g. "135lb × 8".
 */
export function summarizeWorkout(workout) {
  const exercises = (workout?.exercises || []).map((ex) => {
    const all = ex.sets || [];
    const sets = all.filter((s) => !s.warmup);
    const best = sets.reduce((b, s) => (!b || s.weight > b.weight || (s.weight === b.weight && s.reps > b.reps) ? s : b), null);
    const unit = ex.weightUnit === 'lb' ? 'lb' : 'kg';
    return {
      name: ex.exercise?.name ?? 'Exercise',
      images: ex.exercise?.images || [],
      sets: sets.filter((s) => s.side !== 'right').length,
      warmups: all.filter((s) => s.warmup && s.side !== 'right').length,
      unit,
      best,
      bestLabel: best ? `${formatWeight(best.weight, unit)} × ${best.reps}` : null,
    };
  });
  const volume = (workout?.exercises || []).reduce((sum, ex) => sum + (ex.sets || [])
    .reduce((t, s) => (s.warmup ? t : t + (s.weight || 0) * (s.reps || 0)), 0), 0);
  const sets = exercises.reduce((n, e) => n + e.sets, 0);
  return { exercises, volume: Math.round(volume), sets };
}

/** One logged set as text in the exercise's unit: "Warm-up 40kg × 10", "L 20kg × 12 @ 2 RIR". */
export function setLabel(s, unit = 'kg') {
  const side = s.side ? (s.side === 'left' ? 'L ' : 'R ') : '';
  const rir = !s.warmup && s.rir != null ? ` @ ${s.rir} RIR` : '';
  return `${s.warmup ? 'Warm-up ' : ''}${side}${formatWeight(s.weight, unit)} × ${s.reps}${rir}`;
}

/** Working sets in a workout, each unilateral entry counted (as History lists them). */
export const workingSetCount = (workout) => (workout?.exercises || [])
  .reduce((n, e) => n + (e.sets || []).filter((s) => !s.warmup).length, 0);
