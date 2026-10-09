/**
 * Workout-day and supplement reminders: settings and today's dates. Shared by
 * the web and mobile clients (mobile imports it through its Metro config).
 * Pure JS only.
 */

/** Mon…Sun as [weekday (0 = Sunday), short label]. */
export const WEEK = [[1, 'Mon'], [2, 'Tue'], [3, 'Wed'], [4, 'Thu'], [5, 'Fri'], [6, 'Sat'], [0, 'Sun']];

const DEFAULTS = { workout: { enabled: false, time: '08:00' }, supplements: { enabled: false, time: '20:00' } };

/** The user's reminder settings, with defaults filled in. */
export function remindersOf(user) {
  const r = user?.reminders || {};
  return {
    workout: { ...DEFAULTS.workout, ...(r.workout || {}) },
    supplements: { ...DEFAULTS.supplements, ...(r.supplements || {}) },
  };
}

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Query for GET /reminders/today: the local date, weekday and the day's start and end. */
export function todayParams(now = new Date()) {
  const from = new Date(now); from.setHours(0, 0, 0, 0);
  const to = new Date(now); to.setHours(23, 59, 59, 999);
  return { date: ymd(now), weekday: now.getDay(), from: from.toISOString(), to: to.toISOString() };
}

/** 'HH:mm' → { hour, minute }. */
export const parseTime = (time) => {
  const [h, m] = String(time || '').split(':').map(Number);
  return { hour: h || 0, minute: m || 0 };
};

/** Whether `time` ('HH:mm') has passed today. */
export function timePassed(time, now = new Date()) {
  const { hour, minute } = parseTime(time);
  return now.getHours() * 60 + now.getMinutes() >= hour * 60 + minute;
}

/** "8:00 AM"-style label for a time, in 12- or 24-hour form like the device. */
export function formatTime(time) {
  const { hour, minute } = parseTime(time);
  const d = new Date(2000, 0, 1, hour, minute);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/** "Mon, Wed, Fri" / "Every day" / "No days". */
export function daysText(days = []) {
  if (!days.length) return 'No days';
  if (days.length === 7) return 'Every day';
  return WEEK.filter(([d]) => days.includes(d)).map(([, l]) => l).join(', ');
}

/**
 * Today's reminder cards for the dashboard, from GET /reminders/today:
 * [{ kind: 'workout' | 'supplements', text }], once each reminder's time has passed.
 */
export function dueReminders(status, now = new Date()) {
  if (!status) return [];
  const r = remindersOf(status);
  const out = [];
  if (r.workout.enabled && status.workoutDay && !status.workedOut && timePassed(r.workout.time, now)) {
    out.push({ kind: 'workout', text: "It's a workout day and you haven't trained yet." });
  }
  const left = status.supplements.total - status.supplements.taken;
  if (r.supplements.enabled && left > 0 && timePassed(r.supplements.time, now)) {
    out.push({ kind: 'supplements', text: `${left} supplement${left === 1 ? '' : 's'} left to tick off today.` });
  }
  return out;
}
