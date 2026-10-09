/**
 * Cardio activities and their MET values by intensity (Compendium of Physical
 * Activities). Same list as client-web/src/utils/cardio.js.
 * kcal = MET × kg × hours; `net` leaves out the 1 MET burned anyway at rest.
 */
const ACTIVITIES = {
  walking:     { label: 'Walking',          met: [3.0, 3.8, 5.0] },
  running:     { label: 'Running',          met: [8.3, 9.8, 11.8] },
  cycling:     { label: 'Cycling',          met: [4.0, 6.8, 10.0] },
  bike:        { label: 'Stationary bike',  met: [3.5, 6.8, 8.8] },
  rowing:      { label: 'Rowing machine',   met: [4.8, 7.0, 8.5] },
  elliptical:  { label: 'Elliptical',       met: [4.0, 5.0, 6.8] },
  stairs:      { label: 'Stair climber',    met: [4.0, 8.8, 9.5] },
  swimming:    { label: 'Swimming',         met: [5.8, 8.3, 9.8] },
  hiking:      { label: 'Hiking',           met: [5.3, 6.0, 7.8] },
  jumprope:    { label: 'Jump rope',        met: [8.8, 11.8, 12.3] },
  hiit:        { label: 'HIIT / circuit',   met: [4.3, 8.0, 10.0] },
  sports:      { label: 'Team sports',      met: [6.0, 7.5, 9.0] },
  racket:      { label: 'Racket sports',    met: [5.0, 7.0, 8.0] },
  dancing:     { label: 'Dancing',          met: [4.5, 5.5, 7.3] },
  other:       { label: 'Other cardio',     met: [4.0, 6.0, 8.0] },
};
const INTENSITIES = ['easy', 'moderate', 'hard'];
const DEFAULT_KG = 75;

/** { gross, net } kcal for a cardio session ({ activity, intensity, minutes }). */
function cardioCalories({ activity, intensity, minutes }, kg) {
  const met = (ACTIVITIES[activity] || ACTIVITIES.other).met[Math.max(0, INTENSITIES.indexOf(intensity))];
  const hours = (Number(minutes) || 0) / 60;
  const weight = kg > 0 ? kg : DEFAULT_KG;
  return { gross: met * weight * hours, net: (met - 1) * weight * hours };
}

module.exports = { ACTIVITIES, INTENSITIES, cardioCalories };
