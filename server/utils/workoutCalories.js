/**
 * Calories burned in a saved workout, estimated from MET values (Compendium of
 * Physical Activities); same numbers as client-web/src/utils/workoutCalories.js.
 *
 * Time under load at 6 METs, recorded rest at 2 METs, and the rest of the
 * session (setting up, unrecorded rest) at 3.5 METs. kcal = MET × kg × hours.
 * `net` leaves out the 1 MET the body burns anyway (already in the resting /
 * everyday part of maintenance), for the calorie adjustment.
 */
const MET = { work: 6, rest: 2, mixed: 3.5 };
const DEFAULT_KG = 75;

const setWork = (s) => {
  if (s.bursts > 0) return s.bursts * ((s.burstSeconds || 0) + (s.burstRest || 0));
  if (s.duration > 0) return s.duration;
  return s.reps > 0 ? Math.max(20, s.reps * 3) : 0;
};

/** { gross, net, restSeconds } kcal for a saved session ({ duration (min), exercises[].sets }). */
function sessionCalories(session, kg) {
  const weight = kg > 0 ? kg : DEFAULT_KG;
  const sets = (session.exercises || []).flatMap((e) => e.sets || []);
  const rest = sets.reduce((n, s) => n + (s.restTime || 0), 0);
  const work = sets.reduce((n, s) => n + setWork(s), 0);
  const seconds = (session.duration || 0) * 60;
  const other = Math.max(0, seconds - rest - work);
  const gross = MET.work * work + MET.rest * rest + MET.mixed * other;
  const base = work + rest + other;
  const toKcal = (metSeconds) => (metSeconds / 3600) * weight;
  return { gross: toKcal(gross), net: toKcal(gross - base), restSeconds: rest };
}

module.exports = { sessionCalories, MET };
