/**
 * Options and helpers for the plan generator, shared by the web and mobile
 * clients (mobile imports this file through its Metro config). Pure JS only.
 */

// Split for each number of days (first one is the default).
export const SPLIT_OPTIONS = {
  2: [['fb', 'Full body']],
  3: [['fb', 'Full body'], ['eod', 'Full body every other day (3.5×)']],
  4: [['ul', 'Upper / Lower'], ['fb_ul', '2× Full body + Upper + Lower']],
  5: [['ul_ppl', 'Upper / Lower + Push / Pull / Legs']],
  6: [['ul', 'Upper / Lower ×3'], ['ppl', 'Push / Pull / Legs ×2']],
};
export const EQUIPMENT_OPTIONS = [
  ['barbell', 'Barbell'], ['dumbbell', 'Dumbbells'], ['machine', 'Machines'], ['cable', 'Cables'],
  ['bodyweight', 'Bodyweight'], ['kettlebell', 'Kettlebell'], ['resistance_band', 'Bands'], ['other', 'Other'],
];
// Muscles you can prioritise (sub-regions count via their muscle).
export const PRIORITY_OPTIONS = [
  'pecs', 'anterior delt', 'middle delt', 'posterior delt', 'lats', 'trapezius',
  'elbow flexors', 'triceps', 'quads', 'hamstrings', 'glutes', 'calves', 'abs',
];

// Recovery demand levels, lowest first, with how they're shown.
export const RECOVERY_LABELS = {
  veryLow: 'very low', low: 'low', medium: 'medium', high: 'high', extreme: 'very high', unrecoverable: 'too high',
};
const RECOVERY_ORDER = Object.keys(RECOVERY_LABELS);

// "triceps › Long head" → "Triceps · long head"
export const unitLabel = (key) => {
  const [m, sub] = key.split(' › ');
  const muscle = m.charAt(0).toUpperCase() + m.slice(1);
  return sub ? `${muscle} · ${sub.charAt(0).toLowerCase()}${sub.slice(1)}` : muscle;
};

// Muscle group a unit belongs to: "triceps › Long head" → triceps, "anterior delt" → delts.
const DELT = / delt$/;
export const groupOf = (unit) => (DELT.test(unit) ? 'delts' : unit.split(' › ')[0]);
// Region name inside its group: "triceps › Long head" → "Long head", "anterior delt" → "Anterior".
export const regionLabel = (unit) => {
  const r = DELT.test(unit) ? unit.replace(DELT, '') : unit.split(' › ')[1];
  return r.charAt(0).toUpperCase() + r.slice(1);
};

/** 'losing' (negative WNS), 'low' (under target) or 'ok'. */
export const wnsStatus = (wns, target) => (wns < 0 ? 'losing' : wns < target ? 'low' : 'ok');

/**
 * Units rolled up per muscle group. WNS and target are the regions' average;
 * sets and sessions the most any region gets (one set usually hits several);
 * recovery the highest. `status` comes from the worst region, so a group with
 * one lagging region shows as low even if its average is on target.
 */
export function groupUnits(units) {
  const byGroup = new Map();
  for (const u of units) {
    const g = groupOf(u.unit);
    if (!byGroup.has(g)) byGroup.set(g, []);
    byGroup.get(g).push(u);
  }
  return [...byGroup.entries()].map(([group, regions]) => {
    const avg = (f) => regions.reduce((s, r) => s + f(r), 0) / regions.length;
    const worst = regions.find((r) => r.wns < 0) || regions.find((r) => r.wns < r.target) || regions[0];
    const recovery = regions.reduce((a, r) => (RECOVERY_ORDER.indexOf(r.recovery?.level) > RECOVERY_ORDER.indexOf(a?.level) ? r.recovery : a), regions[0].recovery);
    const prio = regions.filter((r) => r.priority && r.recommendedRir);
    return {
      group,
      regions: regions.length > 1 || regions[0].unit !== group ? regions : [],
      wns: avg((r) => r.wns),
      target: avg((r) => r.target),
      status: wnsStatus(worst.wns, worst.target),
      setsPerWeek: Math.max(...regions.map((r) => r.setsPerWeek)),
      sessionsPerWeek: Math.max(...regions.map((r) => r.sessionsPerWeek)),
      recovery,
      priority: regions.some((r) => r.priority),
      recommendedRir: prio.length ? (prio.some((r) => r.recommendedRir === '1–2') ? '1–2' : prio[0].recommendedRir) : null,
    };
  }).sort((x, y) => x.wns - y.wns);
}

// ── Manual plan builder ──────────────────────────────────────────────────────
// Same structure as the generator: days per week + split + A/B give a
// skeleton (POST /plans/skeleton) with sessions ("Upper A", "Lower A", …) and
// the days they run on; the user fills each session with exercises.
// Session exercises: { exercise (full doc), sets, reps, repsMax, rir }.

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const MANUAL_DEFAULTS = { sets: 3, reps: 8, repsMax: 12, rir: 1, maxSets: 16, maxExercises: 6 };

/**
 * Sessions for a new skeleton, keeping what the user already added: a session
 * with the same name keeps its exercises; otherwise one of the same kind does
 * (switching "Upper" ↔ "Upper A" keeps the upper-body exercises).
 */
export function sessionsForSkeleton(skeleton, previous = []) {
  return skeleton.templates.map((t) => {
    const same = previous.find((p) => p.label === t.label) || previous.find((p) => p.type === t.type);
    return { label: t.label, type: t.type, exercises: same ? same.exercises.map((e) => ({ ...e })) : [] };
  });
}

/** Working sets and exercise count in one session. */
export const sessionTotals = (session) => ({
  sets: session.exercises.reduce((n, e) => n + (Number(e.sets) || 0), 0),
  exercises: session.exercises.length,
});

/** How often each session comes round, e.g. "Mon, Thu" or "every other workout". */
export function sessionDays(skeleton, index) {
  const slots = skeleton.slots.filter((sl) => sl.template === index);
  if (skeleton.schedule === 'weekly') return slots.map((sl) => DAY_NAMES[sl.dayOfWeek]).join(', ');
  return slots.length === skeleton.slots.length ? 'every workout' : `workout ${slots.map((sl) => sl.dayOfWeek + 1).join(' & ')} of ${skeleton.slots.length}`;
}

/** The schedule in a sentence, e.g. "Rotation: Full Body A → Full Body B on Mon, Wed, Fri". */
export function describeSchedule(skeleton) {
  const labels = skeleton.slots.map((sl) => skeleton.templates[sl.template].label);
  if (skeleton.schedule === 'weekly') return skeleton.slots.map((sl, i) => `${DAY_NAMES[sl.dayOfWeek]} ${labels[i]}`).join(' · ');
  const when = skeleton.rotation?.everyDays
    ? (skeleton.rotation.everyDays === 2 ? 'one workout every other day' : `one workout every ${skeleton.rotation.everyDays} days`)
    : `on ${skeleton.rotation.weekdays.map((d) => DAY_NAMES[d]).join(', ')}`;
  return `Rotation: ${labels.join(' → ')}, then repeat — ${when}.`;
}

/** Plan days to save: one per slot, each with its session's exercises. */
export function manualPlanDays(skeleton, sessions) {
  return skeleton.slots.map((sl) => ({
    dayOfWeek: sl.dayOfWeek,
    label: sessions[sl.template].label,
    exercises: sessions[sl.template].exercises.map((e) => ({
      exercise: e.exercise._id,
      targetSets: Number(e.sets) || 1,
      targetReps: Number(e.reps) || 1,
      ...(Number(e.repsMax) > Number(e.reps) ? { targetRepsMax: Number(e.repsMax) } : {}),
      ...(e.rir !== '' && e.rir != null ? { targetRir: String(e.rir) } : {}),
      targetWeight: 0,
    })),
  }));
}

/** Body for POST /plans/analyze (weekly net stimulus and recovery per muscle). */
export const analysisRequest = (skeleton, sessions, { level, priorities }) => ({
  days: manualPlanDays(skeleton, sessions).map((d) => ({
    dayOfWeek: d.dayOfWeek,
    // Reps and RIR decide how much each set counts for stimulus (effective sets).
    exercises: d.exercises.map((e) => ({ exercise: e.exercise, targetSets: e.targetSets, targetReps: e.targetReps, targetRir: e.targetRir })),
  })),
  schedule: skeleton.schedule,
  ...(skeleton.rotation && { rotation: skeleton.rotation }),
  level,
  priorities,
});

/** What's missing before a manual plan can be saved, or '' if it's ready. */
export function manualPlanProblem(name, sessions, { maxSets, maxExercises }) {
  if (!name.trim()) return 'Give the plan a name.';
  const empty = sessions.find((s) => s.exercises.length === 0);
  if (empty) return `Add an exercise to ${empty.label}.`;
  const over = sessions.find((s) => { const t = sessionTotals(s); return t.sets > maxSets || t.exercises > maxExercises; });
  if (over) return `${over.label} is over the per-session limit.`;
  return '';
}

// ── Plan weights ─────────────────────────────────────────────────────────────
// Each plan exercise has its own unit (weightUnit 'kg' | 'lb'); targetWeight is
// in that unit. Workouts are logged in kg.
export const KG_PER_LB = 0.45359237;

/** A plan exercise's target weight in kg, rounded to 0.5 kg. */
export const targetWeightKg = (e) => (e?.weightUnit === 'lb'
  ? Math.round((Number(e.targetWeight) || 0) * KG_PER_LB * 2) / 2
  : Number(e?.targetWeight) || 0);

/** "60kg" / "135lb" for showing a plan exercise's weight. */
export const formatPlanWeight = (e) => `${Number(e?.targetWeight) || 0}${e?.weightUnit === 'lb' ? 'lb' : 'kg'}`;
