/**
 * Calories burned in a workout, estimated from MET values (Compendium of
 * Physical Activities). Shared by the web and mobile clients; the server keeps
 * the same numbers in server/utils/workoutCalories.js.
 *
 * The time under load in the sets counts at 6 METs (vigorous resistance
 * training), recorded rest between sets at 2 METs, and the rest of the session
 * (setting up, moving between exercises, or rest that wasn't recorded) at
 * 3.5 METs (a resistance session overall). kcal = MET × kg × hours.
 */
export const MET = { work: 6, rest: 2, mixed: 3.5 };
export const DEFAULT_KG = 75; // when the profile has no weight

/** Seconds of actual work in one set (or one side): reps ≈ 3 s each, holds as timed, bursts with their gaps. */
export function workSeconds(type, v) {
  if (type === 'overcoming') return (Number(v.bursts) || 0) * ((Number(v.burstSeconds) || 0) + (Number(v.burstRest) || 0));
  if (type === 'yielding') return Number(v.duration ?? v.seconds) || 0;
  const reps = Number(v.reps) || 0;
  return reps > 0 ? Math.max(20, reps * 3) : 0;
}

/**
 * @param seconds      the session's length
 * @param restSeconds  rest recorded between sets (0 when none was)
 * @param work         seconds of work (from workSeconds)
 * @param kg           body weight
 * @returns {{ calories, restSeconds, estimatedWeight }} calories rounded to 5 kcal
 */
export function sessionCalories({ seconds = 0, restSeconds = 0, work = 0, kg }) {
  const weight = kg > 0 ? kg : DEFAULT_KG;
  const other = Math.max(0, (seconds || 0) - restSeconds - work);
  const metSeconds = MET.work * work + MET.rest * restSeconds + MET.mixed * other;
  return { calories: Math.round((metSeconds / 3600) * weight / 5) * 5, restSeconds, estimatedWeight: !(kg > 0) };
}

/** "12 min" / "45 s" for a rest total. */
export const formatRest = (s) => (s >= 60 ? `${Math.round(s / 60)} min` : `${Math.round(s)} s`);
