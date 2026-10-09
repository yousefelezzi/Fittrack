/**
 * Cardio activities and their MET values by intensity (Compendium of Physical
 * Activities); same list as server/utils/cardio.js. Shared by the web and
 * mobile clients. kcal = MET × kg × hours.
 */
export const CARDIO_ACTIVITIES = [
  ['walking', 'Walking', [3.0, 3.8, 5.0], true],
  ['running', 'Running', [8.3, 9.8, 11.8], true],
  ['cycling', 'Cycling', [4.0, 6.8, 10.0], true],
  ['bike', 'Stationary bike', [3.5, 6.8, 8.8], false],
  ['rowing', 'Rowing machine', [4.8, 7.0, 8.5], true],
  ['elliptical', 'Elliptical', [4.0, 5.0, 6.8], false],
  ['stairs', 'Stair climber', [4.0, 8.8, 9.5], false],
  ['swimming', 'Swimming', [5.8, 8.3, 9.8], true],
  ['hiking', 'Hiking', [5.3, 6.0, 7.8], true],
  ['jumprope', 'Jump rope', [8.8, 11.8, 12.3], false],
  ['hiit', 'HIIT / circuit', [4.3, 8.0, 10.0], false],
  ['sports', 'Team sports', [6.0, 7.5, 9.0], false],
  ['racket', 'Racket sports', [5.0, 7.0, 8.0], false],
  ['dancing', 'Dancing', [4.5, 5.5, 7.3], false],
  ['other', 'Other cardio', [4.0, 6.0, 8.0], false],
].map(([key, label, met, hasDistance]) => ({ key, label, met, hasDistance }));

export const INTENSITIES = [
  ['easy', 'Easy', 'Could chat the whole time'],
  ['moderate', 'Moderate', 'Breathing harder, short sentences'],
  ['hard', 'Hard', 'A few words at a time'],
];

const DEFAULT_KG = 75;
export const activityOf = (key) => CARDIO_ACTIVITIES.find((a) => a.key === key) || CARDIO_ACTIVITIES[CARDIO_ACTIVITIES.length - 1];

/** Estimated kcal for a session, to the nearest 5. */
export function cardioCalories({ activity, intensity, minutes }, kg) {
  const met = activityOf(activity).met[Math.max(0, INTENSITIES.findIndex(([k]) => k === intensity))];
  return Math.round((met * (kg > 0 ? kg : DEFAULT_KG) * ((Number(minutes) || 0) / 60)) / 5) * 5;
}

const KM_PER_MI = 1.609344;
/** Distance in the user's unit (body weight in lb → miles). */
export const distanceUnit = (user) => (user?.bodyWeightUnit === 'lb' ? 'mi' : 'km');
export const toKm = (value, unit) => (value === '' || value == null ? null : Number(value) * (unit === 'mi' ? KM_PER_MI : 1));
export const fromKm = (km, unit) => (km == null ? null : Math.round((km / (unit === 'mi' ? KM_PER_MI : 1)) * 100) / 100);

/** "5:32 /km" pace for walking/running-type activities, or ''. */
export function paceText(minutes, km, unit) {
  const d = fromKm(km, unit);
  if (!d || !minutes) return '';
  const per = minutes / d;
  return `${Math.floor(per)}:${String(Math.round((per % 1) * 60)).padStart(2, '0')} /${unit}`;
}
