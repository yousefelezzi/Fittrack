/**
 * The end-of-session report: totals for the session just done and how they
 * compare with the last one. Shared by the web and mobile clients (mobile
 * imports it through its Metro config). Pure JS only.
 *
 * Only working sets with reps count (warm-ups and skipped sets don't). A
 * unilateral set is one set; its reps are both sides added up.
 */
import { toKg, fromKg } from './weightUnits';

// Log Workout's sets ({ reps, weight } or { left, right }) → performed sets,
// each a list of entries in kg ({ reps, kg, side }).
const entriesOf = (ex) => ex.sets
  .filter((s) => !s.warmup)
  .map((s) => (s.left ? [['left', s.left], ['right', s.right]] : [[null, s]])
    .map(([side, v]) => ({ reps: Number(v.reps) || 0, kg: toKg(v.weight, ex.unit), side }))
    .filter((v) => v.reps > 0))
  .filter((sides) => sides.length);

// Saved sets (kg, one entry per side) → the same shape.
const loggedEntriesOf = (sets = []) => {
  const out = [];
  for (const s of sets) {
    if (s.warmup || !(s.reps > 0)) continue;
    const entry = { reps: s.reps, kg: Number(s.weight) || 0, side: s.side || null };
    // A right entry belongs to the left one just before it.
    if (s.side === 'right' && out.length && out[out.length - 1].side === 'left') out[out.length - 1].push(entry);
    else out.push(Object.assign([entry], { side: s.side }));
  }
  return out;
};

const totalsOf = (setGroups) => ({
  sets: setGroups.length,
  reps: setGroups.reduce((n, g) => n + g.reduce((m, v) => m + v.reps, 0), 0),
  volume: setGroups.reduce((n, g) => n + g.reduce((m, v) => m + v.reps * v.kg, 0), 0),
  topKg: Math.max(0, ...setGroups.flat().map((v) => v.kg)),
});

/** Totals of a saved workout: { sets, reps, volume (kg), minutes }. */
export function loggedWorkoutTotals(workout) {
  const groups = (workout?.exercises || []).flatMap((e) => loggedEntriesOf(e.sets));
  const t = totalsOf(groups);
  return { sets: t.sets, reps: t.reps, volume: t.volume, minutes: workout?.duration || 0 };
}

/**
 * The workout to compare with: the latest one with the same name (e.g. the same
 * plan day), else the latest that shares an exercise with this session, else none.
 */
export function pickPreviousWorkout(workouts = [], name, exerciseIds = []) {
  const ids = new Set(exerciseIds.map(String));
  return workouts.find((w) => w.name === name)
    || workouts.find((w) => (w.exercises || []).some((e) => ids.has(String(e.exercise?._id ?? e.exercise))))
    || null;
}

/**
 * @param exercises  Log Workout's exercises ({ exercise, unit, sets })
 * @param seconds    session time
 * @param previous   the workout to compare with (from pickPreviousWorkout), or null
 * @param lastSets   { [exerciseId]: sets from GET /workouts/last/:id } — the last
 *                   time each exercise was done
 * @returns {{ totals, change, exercises: [{ name, unit, sets, reps, topWeight, isFirst, setRows }] }}
 *   Volume is in kg; weights are in the exercise's unit. Each exercise's
 *   setRows compare set n with set n last time (side with side for unilateral
 *   exercises): [{ number, entries: [{ side, reps, weight, change: { reps, weight } | null }] }].
 *   A change is null when there's nothing to compare with.
 */
export function buildSessionReport({ exercises, seconds, previous, lastSets = {} }) {
  // An exercise split by "do it later" appears twice; report it once.
  const merged = [];
  for (const ex of exercises) {
    const id = String(ex.exercise._id);
    const same = merged.find((m) => m.id === id);
    if (same) same.groups.push(...entriesOf(ex));
    else merged.push({ id, name: ex.exercise.name, unit: ex.unit || 'kg', groups: entriesOf(ex) });
  }
  const done = merged.filter((m) => m.groups.length);

  const all = totalsOf(done.flatMap((m) => m.groups));
  const totals = { sets: all.sets, reps: all.reps, volume: all.volume, minutes: Math.max(1, Math.round(seconds / 60)) };
  const prev = previous ? loggedWorkoutTotals(previous) : null;
  const change = prev && {
    sets: totals.sets - prev.sets,
    reps: totals.reps - prev.reps,
    volume: totals.volume - prev.volume,
    minutes: prev.minutes ? totals.minutes - prev.minutes : null,
  };

  return {
    totals,
    change,
    previousName: previous?.name ?? null,
    previousDate: previous?.date ?? null,
    exercises: done.map((m) => {
      const now = totalsOf(m.groups);
      const previousSets = loggedEntriesOf(lastSets[m.id] || []);
      const inUnit = (kg) => fromKg(kg, m.unit);
      const setRows = m.groups.map((group, i) => {
        const prevGroup = previousSets[i];
        return {
          number: i + 1,
          entries: group.map((e, k) => {
            // Same side last time, or the same position if sides don't line up.
            const prev = prevGroup && (prevGroup.find((p) => p.side && p.side === e.side) || prevGroup[k]);
            return {
              side: e.side,
              reps: e.reps,
              weight: inUnit(e.kg),
              change: prev ? { reps: e.reps - prev.reps, weight: Math.round((inUnit(e.kg) - inUnit(prev.kg)) * 10) / 10 } : null,
            };
          }),
        };
      });
      return {
        name: m.name,
        unit: m.unit,
        sets: now.sets,
        reps: now.reps,
        topWeight: inUnit(now.topKg),
        isFirst: previousSets.length === 0,
        setRows,
      };
    }),
  };
}

/** "+3", "−1.5", "±0" — for a change; '' when there's nothing to compare. */
export const formatChange = (n) => {
  if (n == null || Number.isNaN(n)) return '';
  const r = Math.round(n * 10) / 10;
  return r > 0 ? `+${r.toLocaleString()}` : r < 0 ? `−${Math.abs(r).toLocaleString()}` : '±0';
};

/** 'up' | 'down' | 'same' | null, for colouring a change. */
export const changeTone = (n) => (n == null ? null : n > 0 ? 'up' : n < 0 ? 'down' : 'same');
