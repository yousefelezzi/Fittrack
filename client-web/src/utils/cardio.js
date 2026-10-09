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

const level = (intensity) => Math.max(0, INTENSITIES.findIndex(([k]) => k === intensity));
// A session's time per intensity: its segments (live sessions) or its minutes at its intensity.
const stretchesOf = ({ intensity, minutes, segments }) => (segments?.length
  ? segments : [{ intensity, seconds: (Number(minutes) || 0) * 60 }]);

/** Estimated kcal for a session ({ activity, intensity, minutes } or { activity, segments }), to the nearest 5. */
export function cardioCalories(session, kg) {
  const mets = activityOf(session.activity).met;
  const kcal = stretchesOf(session).reduce((n, s) => n + mets[level(s.intensity)] * (kg > 0 ? kg : DEFAULT_KG) * ((Number(s.seconds) || 0) / 3600), 0);
  return Math.round(kcal / 5) * 5;
}

// Steps per minute (easy / moderate / hard) for cardio a phone or watch also
// counts as steps; same as server/utils/cardio.js.
const CADENCE = { walking: [100, 115, 130], hiking: [100, 110, 120], running: [155, 165, 175] };

/** Steps a session most likely shows up as in the step count (0 for cycling, rowing…). */
export function cardioSteps(session) {
  const c = CADENCE[session.activity];
  return c ? Math.round(stretchesOf(session).reduce((n, s) => n + c[level(s.intensity)] * ((Number(s.seconds) || 0) / 60), 0)) : 0;
}

/** Note shown for cardio that overlaps the step count. */
export const STEP_OVERLAP_NOTE = (steps) => `Includes about ${steps.toLocaleString()} steps. Your step count already adds those to your calorie goal, so this session only adds what it burns beyond them.`;

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

// ── Live sessions ─────────────────────────────────────────────────────────────
// State: { activity, customActivity, name, startedAt, intensity, running,
// stretchStart (ms), segments: [{ intensity, seconds }] }. Times are ms epoch,
// so it survives a reload (the page keeps it in storage).

/** A new live session, running from `now`. */
export const startLive = ({ activity, customActivity = null, name, intensity = 'moderate' }, now = Date.now()) => ({
  activity, customActivity, name, intensity, startedAt: now, running: true, stretchStart: now, segments: [],
});

// The running stretch added to the segments (joined to the last one if it's the same intensity).
function closeStretch(st, now) {
  if (!st.running) return st;
  const seconds = Math.max(0, (now - st.stretchStart) / 1000);
  const segments = [...st.segments];
  const last = segments[segments.length - 1];
  if (last && last.intensity === st.intensity) segments[segments.length - 1] = { ...last, seconds: last.seconds + seconds };
  else if (seconds > 0) segments.push({ intensity: st.intensity, seconds });
  return { ...st, segments, stretchStart: now };
}

/** Seconds done so far (paused time not counted). */
export const liveSeconds = (st, now = Date.now()) => st.segments.reduce((n, s) => n + s.seconds, 0)
  + (st.running ? Math.max(0, (now - st.stretchStart) / 1000) : 0);
export const pauseLive = (st, now = Date.now()) => ({ ...closeStretch(st, now), running: false });
export const resumeLive = (st, now = Date.now()) => ({ ...st, running: true, stretchStart: now });
/** Switch intensity; the time so far stays at the old one. */
export const setLiveIntensity = (st, intensity, now = Date.now()) => ({ ...closeStretch(st, now), intensity });
/** The finished session's segments (whole seconds). */
export const finishLive = (st, now = Date.now()) => closeStretch(st, now).segments
  .map((s) => ({ intensity: s.intensity, seconds: Math.round(s.seconds) })).filter((s) => s.seconds > 0);

/** "1:02:05" / "12:34". */
export function formatClock(total) {
  const s = Math.max(0, Math.floor(total));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/** The latest earlier session of the same activity (your own one by id), or null. */
export const previousSession = (list = [], { activity, customActivity }) => list.find((s) => (customActivity
  ? String(s.customActivity) === String(customActivity)
  : s.activity === activity && !s.customActivity)) || null;

const secondsOf = (s) => s.seconds ?? (s.minutes || 0) * 60;

/**
 * The end-of-session report: { seconds, distance (in `unit`), pace (seconds per
 * unit), calories, byIntensity: [{ intensity, label, seconds, pct }], change: {
 * seconds, distance, pace, calories } | null } compared with `previous`.
 */
export function cardioReport({ activity, segments, distanceKm }, previous, kg, unit) {
  const seconds = segments.reduce((n, s) => n + s.seconds, 0);
  const calories = cardioCalories({ activity, segments }, kg);
  const distance = fromKm(distanceKm, unit);
  const pace = distance ? seconds / distance : null;
  const byIntensity = INTENSITIES.map(([k, label]) => {
    const t = segments.filter((s) => s.intensity === k).reduce((n, s) => n + s.seconds, 0);
    return { intensity: k, label, seconds: t, pct: seconds ? Math.round((t / seconds) * 100) : 0 };
  }).filter((x) => x.seconds > 0);
  let change = null;
  if (previous) {
    const prevSeconds = secondsOf(previous);
    const prevDistance = fromKm(previous.distanceKm, unit);
    change = {
      seconds: seconds - prevSeconds,
      distance: distance != null && prevDistance != null ? Math.round((distance - prevDistance) * 100) / 100 : null,
      pace: pace && prevDistance ? pace - prevSeconds / prevDistance : null,
      calories: calories - (previous.calories ?? cardioCalories(previous, kg)),
    };
  }
  return { seconds, distance, pace, calories, byIntensity, change };
}

/** "5:32" for a pace in seconds per km / mi. */
export const formatPace = (sec) => (sec ? `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}` : '');
