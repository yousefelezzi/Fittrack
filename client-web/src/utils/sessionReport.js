/**
 * The end-of-session report: totals for the session just done and how they
 * compare with the last one. Shared by the web and mobile clients (mobile
 * imports it through its Metro config). Pure JS only.
 *
 * Only working sets that were done count (warm-ups and skipped sets don't). A
 * unilateral set is one set; its amount is both sides added up.
 *
 * A set's "amount" is reps, seconds held (yielding isometric) or bursts
 * (overcoming isometric): see exerciseTypes.js. Total reps and volume only
 * come from dynamic exercises; isometric sets still count as sets.
 */
import { toKg, fromKg } from './weightUnits';
import { typeOf, amountKey, savedAmount, amountUnit } from './exerciseTypes';

// Log Workout's sets → performed sets, each a list of entries in kg ({ amount, kg, side }).
const entriesOf = (ex) => ex.sets
  .filter((s) => !s.warmup)
  .map((s) => (s.left ? [['left', s.left], ['right', s.right]] : [[null, s]])
    .map(([side, v]) => ({ amount: Number(v[amountKey(ex.exercise)]) || 0, kg: toKg(v.weight, ex.unit), side }))
    .filter((v) => v.amount > 0))
  .filter((sides) => sides.length);

// Saved sets (kg, one entry per side) → the same shape.
const loggedEntriesOf = (sets = [], exercise) => {
  const out = [];
  for (const s of sets) {
    const amount = savedAmount(exercise, s);
    if (s.warmup || !(amount > 0)) continue;
    const entry = { amount, kg: Number(s.weight) || 0, side: s.side || null };
    // A right entry belongs to the left one just before it.
    if (s.side === 'right' && out.length && out[out.length - 1].side === 'left') out[out.length - 1].push(entry);
    else out.push(Object.assign([entry], { side: s.side }));
  }
  return out;
};

// `amount` is the total reps / seconds / bursts; reps and volume count dynamic sets only.
const totalsOf = (setGroups, dynamic = true) => ({
  sets: setGroups.length,
  amount: setGroups.reduce((n, g) => n + g.reduce((m, v) => m + v.amount, 0), 0),
  reps: dynamic ? setGroups.reduce((n, g) => n + g.reduce((m, v) => m + v.amount, 0), 0) : 0,
  volume: dynamic ? setGroups.reduce((n, g) => n + g.reduce((m, v) => m + v.amount * v.kg, 0), 0) : 0,
  topKg: Math.max(0, ...setGroups.flat().map((v) => v.kg)),
});
const addUp = (list) => list.reduce((t, x) => ({ sets: t.sets + x.sets, reps: t.reps + x.reps, volume: t.volume + x.volume }), { sets: 0, reps: 0, volume: 0 });

/** Totals of a saved workout: { sets, reps, volume (kg), minutes }. */
export function loggedWorkoutTotals(workout) {
  const t = addUp((workout?.exercises || []).map((e) => totalsOf(loggedEntriesOf(e.sets, e.exercise), typeOf(e.exercise) === 'dynamic')));
  return { ...t, minutes: workout?.duration || 0 };
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
 * @returns {{ totals, change, exercises: [{ name, type, amountUnit, unit, sets, amount, topWeight, isFirst, setRows }] }}
 *   Volume is in kg; weights are in the exercise's unit. Each exercise's
 *   setRows compare set n with set n last time (side with side for unilateral
 *   exercises): [{ number, entries: [{ side, amount, weight, change: { amount, weight } | null }] }].
 *   amountUnit says what the amount is: 'reps', 's' (seconds held) or 'bursts'.
 *   A change is null when there's nothing to compare with.
 */
export function buildSessionReport({ exercises, seconds, previous, lastSets = {} }) {
  // An exercise split by "do it later" appears twice; report it once.
  const merged = [];
  for (const ex of exercises) {
    const id = String(ex.exercise._id);
    const same = merged.find((m) => m.id === id);
    if (same) same.groups.push(...entriesOf(ex));
    else merged.push({ id, exercise: ex.exercise, name: ex.exercise.name, unit: ex.unit || 'kg', groups: entriesOf(ex) });
  }
  const done = merged.filter((m) => m.groups.length);

  const all = addUp(done.map((m) => totalsOf(m.groups, typeOf(m.exercise) === 'dynamic')));
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
      const previousSets = loggedEntriesOf(lastSets[m.id] || [], m.exercise);
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
              amount: e.amount,
              weight: inUnit(e.kg),
              change: prev ? { amount: e.amount - prev.amount, weight: Math.round((inUnit(e.kg) - inUnit(prev.kg)) * 10) / 10 } : null,
            };
          }),
        };
      });
      return {
        name: m.name,
        type: typeOf(m.exercise),
        amountUnit: amountUnit(m.exercise),
        unit: m.unit,
        sets: now.sets,
        amount: now.amount,
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

/** One set in a report row: "185lb × 8", "20kg × 45s", "45s", "6 bursts". */
export const reportEntryText = (ex, en) => (ex.type === 'overcoming' ? `${en.amount} bursts`
  : ex.type === 'yielding' ? `${en.weight > 0 ? `${en.weight}${ex.unit} × ` : ''}${en.amount}s`
    : `${en.weight}${ex.unit} × ${en.amount}`);
/** The unit after an amount change: "+2 reps", "+5s", "+1 bursts". */
export const amountSuffix = (ex) => (ex.type === 'dynamic' ? ' reps' : ex.type === 'yielding' ? 's' : ' bursts');
/** Whether a report row shows a weight change (overcoming isometrics have no weight). */
export const showsWeight = (ex) => ex.type !== 'overcoming';
