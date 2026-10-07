// Shared by the web and mobile clients (mobile imports it through its Metro config).

import { formatWeight } from './weightUnits';
import { typeOf, savedAmount } from './exerciseTypes';

/**
 * Working sets (a unilateral left + right pair counts once; warm-ups are
 * counted separately), total volume in kg and best set per exercise. `bestLabel`
 * is the best set in the unit the exercise was logged in, e.g. "135lb × 8"; for
 * isometrics, the longest hold ("45s hold") or the most bursts ("6 bursts").
 * Volume (weight × reps) only comes from dynamic exercises.
 */
export function summarizeWorkout(workout) {
  const exercises = (workout?.exercises || []).map((ex) => {
    const all = ex.sets || [];
    const sets = all.filter((s) => !s.warmup);
    const type = typeOf(ex.exercise);
    const amount = (s) => savedAmount(ex.exercise, s);
    const best = type === 'dynamic'
      ? sets.reduce((b, s) => (!b || s.weight > b.weight || (s.weight === b.weight && s.reps > b.reps) ? s : b), null)
      : sets.reduce((b, s) => (!b || amount(s) > amount(b) || (amount(s) === amount(b) && s.weight > b.weight) ? s : b), null);
    const unit = ex.weightUnit === 'lb' ? 'lb' : 'kg';
    return {
      name: ex.exercise?.name ?? 'Exercise',
      images: ex.exercise?.images || [],
      sets: sets.filter((s) => s.side !== 'right').length,
      warmups: all.filter((s) => s.warmup && s.side !== 'right').length,
      unit,
      best,
      bestLabel: !best ? null
        : type === 'yielding' ? `${best.weight > 0 ? `${formatWeight(best.weight, unit)} × ` : ''}${best.duration}s hold`
          : type === 'overcoming' ? `${best.bursts} bursts`
            : `${formatWeight(best.weight, unit)} × ${best.reps}`,
    };
  });
  const volume = (workout?.exercises || []).reduce((sum, ex) => sum + (ex.sets || [])
    .reduce((t, s) => (s.warmup ? t : t + (s.weight || 0) * (s.reps || 0)), 0), 0);
  const sets = exercises.reduce((n, e) => n + e.sets, 0);
  return { exercises, volume: Math.round(volume), sets };
}

/**
 * One logged set as text in the exercise's unit: "Warm-up 40kg × 10",
 * "L 20kg × 12 @ 2 RIR", "10kg × 45s hold @ 5s in reserve", "6 × 3s bursts, 10s rest".
 */
export function setLabel(s, unit = 'kg', exercise) {
  const side = s.side ? (s.side === 'left' ? 'L ' : 'R ') : '';
  const type = typeOf(exercise);
  if (type === 'yielding') {
    const sir = s.sir != null ? ` @ ${s.sir}s in reserve` : '';
    return `${side}${s.weight > 0 ? `${formatWeight(s.weight, unit)} × ` : ''}${s.duration ?? 0}s hold${sir}`;
  }
  if (type === 'overcoming') {
    const rest = s.burstRest != null ? `, ${s.burstRest}s rest` : '';
    return `${side}${s.bursts ?? 0} × ${s.burstSeconds ?? '?'}s bursts${rest}`;
  }
  const rir = !s.warmup && s.rir != null ? ` @ ${s.rir} RIR` : '';
  return `${s.warmup ? 'Warm-up ' : ''}${side}${formatWeight(s.weight, unit)} × ${s.reps}${rir}`;
}

/** Working sets in a workout, each unilateral entry counted (as History lists them). */
export const workingSetCount = (workout) => (workout?.exercises || [])
  .reduce((n, e) => n + (e.sets || []).filter((s) => !s.warmup).length, 0);

/** The set a 1RM estimate came from: "100kg × 5 @ 1 RIR", or a hold: "20kg × 16s hold @ 2s in reserve". */
export function oneRepMaxSourceLabel(fromSet) {
  if (fromSet.duration != null) {
    return `${fromSet.weight}kg × ${fromSet.duration}s hold${fromSet.sir != null ? ` @ ${fromSet.sir}s in reserve` : ''}`;
  }
  return `${fromSet.weight}kg × ${fromSet.reps}${fromSet.rir ? ` @ ${fromSet.rir} RIR` : ''}`;
}
