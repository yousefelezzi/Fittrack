/**
 * Plateau detector: exercises that haven't gone up at all in the past month.
 *
 * For each exercise done at least MIN_SESSIONS times in the last WINDOW_DAYS,
 * with the first of those at least MIN_SPAN_DAYS ago (so there's a month to
 * judge), each session gets a score:
 *   - weighted: its best estimated 1RM (reps in reserve count; holds use
 *     2 seconds = 1 rep, see oneRepMax.js) — so more weight, more reps or fewer
 *     reps in reserve all count as progress
 *   - unweighted: its best reps (or seconds held)
 * It's a plateau when no later session in the window beat the first one.
 * Warm-ups don't count; overcoming isometrics aren't tracked.
 */
const { estimateOneRepMax, asRepSet } = require('./oneRepMax');

const WINDOW_DAYS = 30;
const MIN_SESSIONS = 3;
const MIN_SPAN_DAYS = 21;
const DAY = 86400000;

/** A session's score for an exercise, and what it measures. */
function sessionScore(sets, type) {
  const working = sets.filter((s) => !s.warmup).map((s) => asRepSet(s, type)).filter(Boolean);
  if (!working.length) return null;
  const weighted = working.some((s) => Number(s.weight) > 0);
  if (weighted) {
    const best = Math.max(0, ...working.map(estimateOneRepMax));
    return best > 0 ? { value: best, kind: 'e1rm' } : null;
  }
  const best = Math.max(0, ...working.map((s) => Number(s.reps) || 0));
  return best > 0 ? { value: best, kind: type === 'yielding' ? 'seconds' : 'reps' } : null;
}

/**
 * @param sessions workouts from the last WINDOW_DAYS, oldest first, with
 *                 exercises.exercise populated ({ _id, name, type })
 * @returns [{ exerciseId, name, kind, best, first, last, sessions, since }] — kind
 *   'e1rm' (kg), 'reps' or 'seconds' (seconds held, as reps × 2 already undone)
 */
function findPlateaus(sessions, now = new Date()) {
  const byExercise = new Map();
  for (const s of sessions) {
    const seenThisSession = new Map();
    for (const ex of s.exercises || []) {
      const e = ex.exercise;
      if (!e?._id || e.type === 'overcoming') continue;
      const id = String(e._id);
      // An exercise split by "do it later" is one session.
      seenThisSession.set(id, { exercise: e, sets: [...(seenThisSession.get(id)?.sets || []), ...(ex.sets || [])] });
    }
    for (const [id, { exercise, sets }] of seenThisSession) {
      const score = sessionScore(sets, exercise.type);
      if (!score) continue;
      if (!byExercise.has(id)) byExercise.set(id, { exercise, points: [] });
      byExercise.get(id).points.push({ date: s.date, ...score });
    }
  }

  const out = [];
  for (const [id, { exercise, points }] of byExercise) {
    // Compare like with like (a lift that became bodyweight, or the reverse, is skipped).
    const kind = points[0].kind;
    if (points.some((p) => p.kind !== kind) || points.length < MIN_SESSIONS) continue;
    if (now - new Date(points[0].date) < MIN_SPAN_DAYS * DAY) continue;
    const first = points[0].value;
    const laterBest = Math.max(...points.slice(1).map((p) => p.value));
    if (laterBest > first + 1e-6) continue; // went up at some point
    const toShow = (v) => (kind === 'seconds' ? Math.round(v * 2) : Math.round(v * 10) / 10);
    out.push({
      exerciseId: id,
      name: exercise.name,
      kind,
      first: toShow(first),
      best: toShow(Math.max(first, laterBest)),
      last: toShow(points[points.length - 1].value),
      sessions: points.length,
      since: points[0].date,
    });
  }
  return out.sort((a, b) => b.sessions - a.sessions);
}

module.exports = { findPlateaus, WINDOW_DAYS, MIN_SESSIONS, MIN_SPAN_DAYS };
