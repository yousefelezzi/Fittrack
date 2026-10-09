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
const { stepBurn } = require('./steps');

// Steps per minute (easy / moderate / hard) for cardio that a phone or watch
// also counts as steps, so a day's goal doesn't count those calories twice.
const CADENCE = {
  walking: [100, 115, 130],
  hiking:  [100, 110, 120],
  running: [155, 165, 175],
};
const level = (intensity) => Math.max(0, INTENSITIES.indexOf(intensity));

/**
 * A session's time at each intensity: its `segments` ({ intensity, seconds },
 * from a live session) or all its minutes at its one intensity.
 */
const stretchesOf = ({ intensity, minutes, segments }) => (segments?.length
  ? segments.map((s) => ({ intensity: s.intensity, seconds: Number(s.seconds) || 0 }))
  : [{ intensity, seconds: (Number(minutes) || 0) * 60 }]);

/** Steps a session most likely shows up as in the step count (0 for cycling, rowing…). */
function cardioSteps(session) {
  const c = CADENCE[session.activity];
  if (!c) return 0;
  return Math.round(stretchesOf(session).reduce((n, s) => n + c[level(s.intensity)] * (s.seconds / 60), 0));
}

/**
 * A day's cardio calories (above resting) for the calorie goal, without the
 * part its steps already add: the steps the sessions contain are taken off,
 * but never more than the steps actually logged that day (a run without the
 * phone counts in full).
 */
function cardioNetAfterSteps(sessions, kg, stepsLogged) {
  const net = sessions.reduce((n, s) => n + cardioCalories(s, kg).net, 0);
  const overlap = Math.min(Number(stepsLogged) || 0, sessions.reduce((n, s) => n + cardioSteps(s), 0));
  return Math.max(0, net - stepBurn({ weight: kg > 0 ? kg : DEFAULT_KG }, overlap));
}

/** { gross, net } kcal for a cardio session ({ activity, intensity, minutes } or { activity, segments }). */
function cardioCalories(session, kg) {
  const mets = (ACTIVITIES[session.activity] || ACTIVITIES.other).met;
  const weight = kg > 0 ? kg : DEFAULT_KG;
  let gross = 0;
  let hours = 0;
  for (const s of stretchesOf(session)) {
    const h = s.seconds / 3600;
    gross += mets[level(s.intensity)] * weight * h;
    hours += h;
  }
  return { gross, net: gross - weight * hours };
}

module.exports = { ACTIVITIES, INTENSITIES, cardioCalories, cardioSteps, cardioNetAfterSteps };
