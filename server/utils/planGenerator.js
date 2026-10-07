/**
 * Low-volume, high-frequency plan generator.
 *
 * 1. Split and schedule by days per week: 2–3 full body; 4 upper/lower or
 *    2× full body + upper + lower; 5 upper/lower + push/pull/legs; 6 upper/lower
 *    ×3 or push/pull/legs ×2 — on days spaced so each muscle gets ~48–72 h.
 * 2. Exercise choice (per session): a greedy weighted set cover over the muscle
 *    units that session is responsible for (sub-regions like "triceps › Long
 *    head" included). Exercises are scored by how many still-uncovered units
 *    they hit per unit of time, so compound lifts that overlap several muscles
 *    win — e.g. an incline press plus a dumbbell pullover covers chest, front
 *    delts and both triceps heads instead of an exercise per region. A session
 *    type that repeats gets A/B variants; B prefers exercises A didn't use.
 *    Your custom exercises are used too, and preferred by default.
 * 4. Recovery: the recovery demand (same model as the WNS calculator) of every
 *    muscle the plan is built around is kept at medium or below — high is
 *    allowed for priority muscles only. Exercises and sets that would go over are
 *    never added, and anything over after exercise choice is trimmed. Secondary
 *    muscles that are only worked along the way (forearms, erectors, adductors,
 *    hip flexors) are reported but not limited, since every row or hinge counts
 *    fully for them. Sets are programmed at 1–2 reps in reserve (0–2 for a
 *    priority muscle whose recovery demand stays low).
 * 3. Sets: every exercise starts at one set. Then sets are added one at a time
 *    wherever they raise the Weekly Net Stimulus (WNS) the most per minute,
 *    until the session time is used up. Muscles below their target count fully;
 *    past the target a muscle's extra WNS is worth less, so time goes to lagging
 *    and priority muscles first. Overlap counts here too: one set of rows helps
 *    lats, traps, rear delts and elbow flexors at once. Caps (4 sets per
 *    exercise, 6 sets per muscle per session) keep it low volume per session.
 */
const { unitsForTags, unitWeights, volumeWeights } = require('./muscleGroups');
const { secondaryWeightFor } = require('./trainingLevel');
const { weeklyNet, recoveryDemand, effectiveSets, rirValue } = require('./wns');

// Units every plan should train. Others (forearms, erectors, adductors, hip
// flexors) are counted when they happen to be hit but aren't chased.
const REQUIRED_UNITS = [
  'pecs › Clavicular', 'pecs › Sternal', 'pecs › Costal',
  'anterior delt', 'middle delt', 'posterior delt',
  'lats', 'trapezius',
  'elbow flexors › Biceps', 'elbow flexors › Brachialis/brachioradialis', 'triceps › Medial/lateral head', 'triceps › Long head',
  'quads › Vasti', 'quads › Rectus femoris', 'hamstrings › Biarticular', 'hamstrings › Short head', 'glutes',
  'calves › Gastrocnemius', 'calves › Soleus',
  'abs',
];

const PECS = ['pecs › Clavicular', 'pecs › Sternal', 'pecs › Costal'];
const TRICEPS = ['triceps › Medial/lateral head', 'triceps › Long head'];
const LEGS = ['quads › Vasti', 'quads › Rectus femoris', 'hamstrings › Biarticular', 'hamstrings › Short head', 'glutes', 'calves › Gastrocnemius', 'calves › Soleus', 'abs'];

// What each kind of session is responsible for covering.
const SESSION_TYPES = {
  full:  { label: 'Full Body', scope: REQUIRED_UNITS },
  upper: { label: 'Upper', scope: [...PECS, 'anterior delt', 'middle delt', 'posterior delt', 'lats', 'trapezius', 'elbow flexors › Biceps', 'elbow flexors › Brachialis/brachioradialis', ...TRICEPS] },
  lower: { label: 'Lower', scope: LEGS },
  push:  { label: 'Push',  scope: [...PECS, 'anterior delt', 'middle delt', ...TRICEPS] },
  pull:  { label: 'Pull',  scope: ['lats', 'trapezius', 'posterior delt', 'elbow flexors › Biceps', 'elbow flexors › Brachialis/brachioradialis'] },
  legs:  { label: 'Legs',  scope: LEGS },
};

// Splits by days per week, with days (0 = Sunday) spaced so each muscle gets
// roughly 48–72 h between sessions that train it.
const SPLITS = {
  2: { fb: { name: 'Full Body', days: [[1, 'full'], [4, 'full']] } },
  3: { fb: { name: 'Full Body', days: [[1, 'full'], [3, 'full'], [5, 'full']] } },
  4: {
    ul:    { name: 'Upper/Lower', days: [[1, 'upper'], [2, 'lower'], [4, 'upper'], [5, 'lower']] },
    fb_ul: { name: 'Full Body + Upper/Lower', days: [[1, 'full'], [3, 'upper'], [4, 'lower'], [6, 'full']] },
  },
  5: { ul_ppl: { name: 'Upper/Lower + Push/Pull/Legs', days: [[1, 'upper'], [2, 'lower'], [4, 'push'], [5, 'pull'], [6, 'legs']] } },
  6: {
    ul:  { name: 'Upper/Lower ×3', days: [[1, 'upper'], [2, 'lower'], [3, 'upper'], [4, 'lower'], [5, 'upper'], [6, 'lower']] },
    ppl: { name: 'Push/Pull/Legs ×2', days: [[1, 'push'], [2, 'pull'], [3, 'legs'], [4, 'push'], [5, 'pull'], [6, 'legs']] },
  },
};
const DEFAULT_SPLIT = { 2: 'fb', 3: 'fb', 4: 'ul', 5: 'ul_ppl', 6: 'ul' };
// Full body every other day (3.5×/week), not tied to weekdays.
const EOD_SPLIT = { name: 'Full Body every other day', everyDays: 2, days: [[0, 'full']] };

// Recovery demand ceilings: low/medium for normal muscles, up to high for priorities.
const RECOVERY_LIMIT = 0.75;
const PRIORITY_RECOVERY_LIMIT = 1.0;

// Session time: each exercise gets 1.5 min of warm-up sets, then ~2.5 min per
// working set (~1 min work + ~1.5 min rest).
const MINUTES_PER_SET = 2.5;
const WARMUP_PER_EXERCISE = 1.5;
// All generated work is in the 5–8 rep range (heavy enough that low volume is
// still effective, as sets go close to failure).
const REP_RANGE = [5, 8];
// Stimulus per working set: only the last 5 reps before failure count (see
// effectiveSets), so 5+ reps at the standard 1–2 RIR is worth 0.7 of a set.
// Recovery still counts every set: a set short of failure still tires you.
const PLANNED_EFFECTIVE = effectiveSets(REP_RANGE[0], rirValue('1–2'));
const MAX_UNIT_SETS_PER_SESSION = 6; // more than this in one session adds very little
const PRIORITY_UNIT_SETS_PER_SESSION = 8; // priorities get a slightly higher ceiling
// For recovery, a set counts half for a muscle that's only a helper in the lift
// (bench → triceps and front delts; pullover → rear delts). Counting helpers
// fully made every overlapping pair of lifts look unrecoverable — e.g. one
// pullover set on push day left no room for rows on the next day's pull day,
// and a beginner's squat + overhead press couldn't get past 1 set each.
// Stimulus (WNS) still counts every set fully.
const SECONDARY_RECOVERY = 0.5;

// Experience level shapes how the time is spent:
//   beginner     — few exercises, more sets each, compound lifts only (isolation
//                  only if a muscle can't be reached otherwise)
//   intermediate — balanced
//   advanced     — more exercises with fewer sets each, isolation work favoured
const LEVELS = {
  // target: the WNS each muscle should reach (+1 for priorities), counted in
  // effective sets (a set at 1–2 RIR is 0.7). Beginners grow from less stimulus,
  // so their target is lower. These are the old full-set targets (1.5 / 2)
  // re-scaled: the same sets at 2×/week now give 1.1 / 1.6. (Advanced lifters
  // don't get a higher one: with recovery kept at medium, ~1.85 is the ceiling at 2×/week.)
  // maxExercises / minExercises: per session type. Beginner full-body days stay
  // at 5–6 exercises with more sets each. Leg days: 4–5 for beginners, 5–6
  // intermediate, 6–7 advanced. Upper, push and pull days have no minimum: a few
  // compound lifts can cover them fully, and more would only repeat them.
  // abSplitCap: with A/B workouts, how many exercises A may use to cover
  // muscles before the rest is left to B — muscles trained only in A or only in
  // B still get ~1.5 sessions a week. newExercise: how much adding another
  // exercise is worth compared with adding a set to one already there.
  beginner:     { maxSetsPerExercise: 5, isolation: 0,   compoundBonus: 1.3, target: 1.1, maxExercises: { full: 6, upper: 5, lower: 5, legs: 5, push: 4, pull: 4 },
                  minExercises: { full: 5, lower: 4, legs: 4 },
                  abSplitCap: 4, newExercise: 0.4, newExerciseMustAddMuscle: true, maxIsolationSets: 3 },
  intermediate: { maxSetsPerExercise: 4, isolation: 1,   compoundBonus: 1,   target: 1.6,
                  maxExercises: { upper: 6, lower: 6, legs: 6, push: 5, pull: 5 },
                  minExercises: { lower: 5, legs: 5 } },
  advanced:     { maxSetsPerExercise: 3, isolation: 1.4, compoundBonus: 1,   target: 1.6,
                  maxExercises: { upper: 7, lower: 7, legs: 7, push: 6, pull: 6 },
                  minExercises: { lower: 6, legs: 6 } },
};

// Broad muscles for telling compound from isolation work: an exercise that
// trains two or more of these is compound (bench: pecs + delts + triceps;
// squat: quads + glutes + calves), one is isolation (lateral raise: delts;
// leg extension: quads). Forearms, erectors, adductors and hip flexors don't count.
const BROAD = {
  'pecs › Clavicular': 'pecs', 'pecs › Sternal': 'pecs', 'pecs › Costal': 'pecs',
  'anterior delt': 'delts', 'middle delt': 'delts', 'posterior delt': 'delts',
  lats: 'lats', trapezius: 'traps',
  'elbow flexors › Biceps': 'elbow flexors', 'elbow flexors › Brachialis/brachioradialis': 'elbow flexors',
  'triceps › Medial/lateral head': 'triceps', 'triceps › Long head': 'triceps',
  'quads › Vasti': 'quads', 'quads › Rectus femoris': 'quads',
  'hamstrings › Biarticular': 'hamstrings', 'hamstrings › Short head': 'hamstrings', glutes: 'glutes',
  'calves › Gastrocnemius': 'calves', 'calves › Soleus': 'calves', abs: 'abs',
};
const isCompound = (ex) => new Set([...ex.units].map((u) => BROAD[u]).filter(Boolean)).size >= 2;
// A unilateral set is both sides, so it takes longer (less rest is needed between sides).
const setCost = (ex) => (ex.laterality === 'unilateral' ? 1.6 : 1);

/**
 * The structure of a plan before any exercises: which sessions it has (with
 * A/B variants when a session type comes round more than once), the days they
 * run on, and whether it's a weekly plan or a rotation. Used by the generator
 * and by the manual plan builder (POST /plans/skeleton), so both lay out
 * sessions the same way.
 *
 * A session type that comes round more than once gets A/B variants that
 * alternate continuously. When that doesn't fit a week evenly (3 full-body
 * days: A B A, then B A B the next week) the plan is a rotation over a longer
 * cycle, so a muscle trained only in A really gets 1.5×/week, not 2× or 1×.
 *
 * @param opts { daysPerWeek, split, variation: 'ab' | 'repeat' }
 * @returns {{ daysPerWeek, splitKey, split, variation, timeline, templates: [{ type, variant, label }],
 *             cycleDays, schedule: 'weekly' | 'rotation', rotation, slots: [{ dayOfWeek, template }] }}
 *   slots: a weekly plan's workouts by weekday (Monday first), or a rotation's
 *   workouts in order (dayOfWeek = position).
 */
function planSkeleton(opts = {}) {
  const daysPerWeek = Math.min(6, Math.max(2, Number(opts.daysPerWeek) || 4));
  const splitKey = opts.split === 'eod' ? 'eod' : SPLITS[daysPerWeek][opts.split] ? opts.split : DEFAULT_SPLIT[daysPerWeek];
  const split = splitKey === 'eod' ? EOD_SPLIT : SPLITS[daysPerWeek][splitKey];
  const variation = opts.variation === 'repeat' ? 'repeat' : 'ab';

  const baseDays = split.everyDays ? split.everyDays * split.days.length : 7;
  const perBase = {};
  split.days.forEach(([, type]) => { perBase[type] = (perBase[type] || 0) + 1; });
  const alternates = variation === 'ab' && Object.values(perBase).some((n) => n > 1 || split.everyDays);
  const repeatsOddly = alternates && Object.values(perBase).some((n) => n % 2 === 1 && (n > 1 || split.everyDays));
  const cycles = repeatsOddly ? 2 : 1;
  const cycleDays = baseDays * cycles;

  const seen = {};
  const timeline = []; // { day (offset in the cycle), weekday, type, variant, template }
  for (let c = 0; c < cycles; c++) {
    split.days.forEach(([dayOfWeek, type], i) => {
      const n = (seen[type] = (seen[type] || 0) + 1);
      const variant = alternates && (perBase[type] > 1 || split.everyDays) ? (n - 1) % 2 : 0;
      const day = split.everyDays ? (c * split.days.length + i) * split.everyDays : c * 7 + dayOfWeek;
      timeline.push({ day, weekday: split.everyDays ? null : dayOfWeek, type, variant });
    });
  }
  const variantsOf = (type) => new Set(timeline.filter((s) => s.type === type).map((s) => s.variant)).size;
  const templates = []; // { type, variant, label }
  const templateIndex = (type, variant) => templates.findIndex((t) => t.type === type && t.variant === variant);
  for (const s of timeline) {
    if (templateIndex(s.type, s.variant) === -1) {
      const letter = variantsOf(s.type) > 1 ? ` ${'AB'[s.variant]}` : '';
      templates.push({ type: s.type, variant: s.variant, label: `${SESSION_TYPES[s.type].label}${letter}` });
    }
    s.template = templateIndex(s.type, s.variant);
  }

  // A weekly plan has one workout per weekday. A rotation plan is a sequence
  // of workouts done in order on the training days (or every other day).
  const isRotation = !!split.everyDays || cycles > 1;
  let slots;
  let rotation = null;
  if (!isRotation) {
    slots = timeline
      .slice()
      .sort((a, b) => ((a.weekday + 6) % 7) - ((b.weekday + 6) % 7)) // Monday first
      .map((s) => ({ dayOfWeek: s.weekday, template: s.template }));
  } else {
    // Shortest repeating order of workouts, e.g. [A, B] or [Upper A, Lower A, Upper B, Lower B].
    const order = timeline.map((s) => s.template);
    let len = order.length;
    for (let k = 1; k <= order.length; k++) {
      if (order.length % k === 0 && order.every((t, i) => t === order[i % k])) { len = k; break; }
    }
    slots = order.slice(0, len).map((t, i) => ({ dayOfWeek: i, template: t }));
    rotation = split.everyDays
      ? { everyDays: split.everyDays }
      : { weekdays: split.days.map(([d]) => d).sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)) };
  }

  return {
    daysPerWeek, splitKey, split, variation, timeline, templates, cycleDays,
    schedule: isRotation ? 'rotation' : 'weekly', rotation, slots,
  };
}

/**
 * @param exercises  strength exercises available to the user (lean docs)
 * @param opts       { daysPerWeek, split, variation, level, maxSets, maxExercises, equipment[], priorities[], exclude[], preferCustom, dataset, maintenance, stimHours }
 *                   level: 'beginner' | 'intermediate' (default) | 'advanced'
 *                   exclude: muscles not to train on purpose, e.g. ['abs'] (their sub-regions too)
 *                   variation: 'ab' (default) alternates two versions of a repeated session;
 *                   'repeat' does the same workout every time that session comes round.
 */
function generatePlan(exercises, opts = {}) {
  // Sessions and the days they run on (shared with the manual plan builder).
  const skeleton = planSkeleton(opts);
  const { daysPerWeek, splitKey, split } = skeleton;
  // Per-session limits chosen by the user: working sets, and exercises.
  const maxSets = Math.min(40, Math.max(4, Math.round(Number(opts.maxSets) || 20)));
  const maxExercises = Math.min(12, Math.max(2, Math.round(Number(opts.maxExercises) || 8)));
  const equipment = new Set(opts.equipment?.length ? opts.equipment : ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'kettlebell', 'resistance_band', 'other']);
  const priorities = new Set(opts.priorities || []); // muscles or units, e.g. "triceps" or "triceps › Long head"
  const preferCustom = opts.preferCustom !== false;
  const levelKey = LEVELS[opts.level] ? opts.level : 'intermediate';
  const level = LEVELS[levelKey];
  const excluded = new Set(opts.exclude || []);
  const isExcluded = (unit) => excluded.has(unit) || excluded.has(unit.split(' › ')[0]);
  const model = { dataset: opts.dataset || 'S', maintenance: Number(opts.maintenance) || 3, stimHours: Number(opts.stimHours) || 48 };

  const isPriority = (unit) => !isExcluded(unit) && (priorities.has(unit) || priorities.has(unit.split(' › ')[0]));
  const unitSetCap = (unit) => (isPriority(unit) ? PRIORITY_UNIT_SETS_PER_SESSION : MAX_UNIT_SETS_PER_SESSION);
  const weight = (unit) => (isPriority(unit) ? 2 : 1);
  // WNS each unit should reach: comfortably positive, more for priorities.
  const targetFor = (unit) => level.target + (isPriority(unit) ? 1 : 0);
  // How much a secondary muscle counts toward volume at this level (0.5 − x).
  // The plan may be for someone else, so it follows the level picked here.
  const secondaryWeight = opts.secondaryWeight ?? secondaryWeightFor(levelKey);

  const pool = exercises
    // Plans are built from dynamic exercises (reps × weight); isometrics are added by hand.
    .filter((ex) => (ex.category || 'strength') === 'strength' && (ex.type || 'dynamic') === 'dynamic' && equipment.has(ex.equipment))
    .map((ex) => ({
      ...ex,
      units: unitsForTags(ex.muscleGroups),
      // 1 per set, or 0.5 for a secondary muscle (triceps on a bench press…):
      // used for recovery and for comparing exercises.
      weights: unitWeights(ex.muscleGroups, ex.secondaryMuscles),
      // The same with secondary muscles at this level's 0.5 − x: used for volume and stimulus.
      vol: volumeWeights(unitWeights(ex.muscleGroups, ex.secondaryMuscles), secondaryWeight),
      // What the exercise is mainly for: its first tag (e.g. a pullover is a triceps exercise).
      primary: unitsForTags((ex.muscleGroups || []).slice(0, 1)),
    }))
    .filter((ex) => ex.units.size > 0)
    // Exercises that are mainly for an excluded muscle aren't used (a squat still
    // works abs a bit, but no crunches when abs are excluded).
    .filter((ex) => ![...ex.primary].every(isExcluded))
    .map((ex) => ({ ...ex, compound: isCompound(ex) }));

  // Priority muscles with regions (pecs, triceps, quads, calves) get variety
  // across regions: each region needs an exercise that targets it rather than
  // one general exercise covering them all — e.g. prioritised pecs get an
  // incline press (clavicular) and a pullover or chin-up (costal), not just a
  // flat bench. A region only needs this if such an exercise exists.
  // Only regions trained fully count: an incline press targets the clavicular
  // head even though it works the costal head as a secondary.
  const SUBS = { pecs: 3, triceps: 2, quads: 2, calves: 2, hamstrings: 2, 'elbow flexors': 2 };
  const targets = (ex, unit) => {
    const group = unit.split(' › ')[0];
    if (!SUBS[group] || (ex.weights.get(unit) || 0) < 1) return false;
    const regionsHit = [...ex.units].filter((u) => u.startsWith(`${group} › `) && ex.weights.get(u) >= 1).length;
    return regionsHit < SUBS[group];
  };
  const needsTargeted = new Set(
    REQUIRED_UNITS.filter((u) => isPriority(u) && u.includes(' › ') && pool.some((ex) => targets(ex, u)))
  );

  const reachable = REQUIRED_UNITS.filter((u) => !isExcluded(u) && pool.some((ex) => ex.units.has(u)));
  const unreachable = REQUIRED_UNITS.filter((u) => !isExcluded(u) && !reachable.includes(u));
  // Beginners build on compound lifts, so regions only isolation work can reach
  // (e.g. elbow flexors, gastrocnemius, rectus femoris, abs) aren't chased —
  // unless they're a priority. That keeps sessions to a few big lifts.
  // Every level chases every muscle (beginners too): with the set and exercise
  // limits the user picks, the plan decides how to fit them in.
  const skippedForLevel = [];
  const required = reachable.filter((u) => !skippedForLevel.includes(u));
  // How the level weighs an exercise (beginners: compounds only unless nothing else works).
  const styleFactor = (ex) => (ex.compound ? level.compoundBonus : level.isolation);
  // The user's exercise limit always applies; the level's range sits inside it.
  const exerciseCap = (tpl) => Math.min(maxExercises, level.maxExercises?.[tpl.type] ?? Infinity);
  const exerciseMin = (tpl) => Math.min(exerciseCap(tpl), level.minExercises?.[tpl.type] ?? 0);
  // Minutes: an exercise costs its warm-up plus its working sets.
  const setMinutes = (ex) => setCost(ex) * MINUTES_PER_SET;
  const exerciseMinutes = (ex, sets = 1) => WARMUP_PER_EXERCISE + sets * setMinutes(ex);

  // ── 1. Sessions ─────────────────────────────────────────────────────────
  // See planSkeleton: A/B variants, and a rotation when they don't fit a week.
  const { timeline, cycleDays } = skeleton;
  const templates = skeleton.templates.map((t) => ({ ...t, exercises: [], sets: [] }));
  const schedule = timeline; // kept for the rest of the code
  const perWeek = 7 / cycleDays;
  model.cycleDays = cycleDays;

  // Sets a muscle gets in one session, and its weekly WNS / recovery demand.
  const unitSetsIn = (t, unit) =>
    templates[t].exercises.reduce((sum, ex, i) => sum + templates[t].sets[i] * (ex.vol.get(unit) || 0), 0);
  // Stimulus uses effective sets. While choosing exercises every set is planned
  // at 1–2 RIR; once each exercise's RIR is decided (priorities can go to 0–2),
  // the final numbers use that (see `effOf` before the results).
  let effOf = () => PLANNED_EFFECTIVE;
  const stimSetsIn = (t, unit) =>
    templates[t].exercises.reduce((sum, ex, i) => sum + templates[t].sets[i] * (ex.vol.get(unit) || 0) * effOf(ex), 0);
  const wnsOf = (unit) =>
    weeklyNet(schedule.map((s) => ({ day: s.day, sets: stimSetsIn(s.template, unit) })), model);
  // For recovery, a muscle that's only a helper in an exercise can count for less (beginners).
  const secondaryFactor = SECONDARY_RECOVERY;
  const recoverySetsIn = (t, unit) =>
    templates[t].exercises.reduce((sum, ex, i) => {
      const w = ex.weights.get(unit) || 0;
      if (!w) return sum;
      // A helper muscle counts half for recovery; a secondary one already is.
      return sum + templates[t].sets[i] * Math.min(w, ex.primary.has(unit) ? 1 : secondaryFactor);
    }, 0);
  const recoveryOf = (unit) =>
    recoveryDemand(schedule.map((s) => ({ day: s.day, sets: recoverySetsIn(s.template, unit) })), model);
  const limitFor = (unit) => (isPriority(unit) ? PRIORITY_RECOVERY_LIMIT : RECOVERY_LIMIT);
  // Only the muscles the plan is built around are limited (see note 4 above).
  const overLimit = (units) => [...units].filter((u) => required.includes(u) && recoveryOf(u).value > limitFor(u) + 1e-9);

  // ── 2. Exercise choice: greedy weighted set cover per session ──────────────
  // `t` is the template being built, so recovery can be checked against the
  // sessions chosen so far (set by the caller before calling cover).
  let recoveryCheck = () => true;
  const cover = (candidates, mustCover, avoid, budget, startWith = [], cap = Infinity) => {
    const chosen = [...startWith];
    const hits = new Set();     // units trained by a chosen exercise
    const targeted = new Set(); // priority regions trained by an exercise aimed at them
    const addHits = (e) => e.units.forEach((u) => { hits.add(u); if (targets(e, u)) targeted.add(u); });
    chosen.forEach(addHits);
    const covered = { has: (u) => (needsTargeted.has(u) ? targeted.has(u) : hits.has(u)) };
    let used = chosen.length; // each chosen exercise starts with one set
    for (;;) {
      if (chosen.length >= cap) break; // e.g. beginner full body: 7 exercises
      let best = null;
      for (const ex of candidates) {
        if (chosen.includes(ex)) continue;
        const cost = exerciseMinutes(ex); // time-weighted cost, to prefer fewer, bigger lifts
        if (used + 1 > budget) continue;
        if (!recoveryCheck(chosen, ex)) continue;
        let gain = 0;
        for (const u of ex.units) {
          if (!mustCover.includes(u) || covered.has(u)) continue;
          // A general exercise doesn't count for a priority region still waiting for a targeted one.
          if (needsTargeted.has(u) && !targets(ex, u) && hits.has(u)) continue;
          gain += weight(u);
        }
        if (gain === 0) continue;
        // Overlap with already-covered units is a small bonus (extra volume for free).
        let extra = 0;
        for (const u of ex.units) if (covered.has(u)) extra += 0.25;
        // Beginners only fall back to isolation when no compound can cover what's left.
        const style = styleFactor(ex) || 0.01;
        let score = ((gain + extra) / cost) * style;
        if (avoid.has(String(ex._id))) score *= 0.6;          // variety between A and B
        if (preferCustom && ex.isCustom) score *= 1.5;         // your own exercises first
        if (!best || score > best.score + 1e-9
          || (Math.abs(score - best.score) < 1e-9 && (ex.units.size > best.ex.units.size
            || (ex.units.size === best.ex.units.size && ex.name < best.ex.name)))) {
          best = { ex, score };
        }
      }
      if (!best) break; // everything covered, out of time, or nothing left helps
      chosen.push(best.ex);
      used += 1;
      addHits(best.ex);
    }
    return { chosen, covered: new Set([...hits].filter((u) => covered.has(u))) };
  };

  // Big lifts first: cover what compound exercises can, then use isolation work
  // only for what's left (rectus femoris, gastrocnemius, abs…). Otherwise a leg
  // extension can beat a squat just because it also reaches the rectus femoris.
  const coverCompoundsFirst = (candidates, mustCover, avoid, budget, startWith, cap) => {
    const big = cover(candidates.filter((ex) => ex.compound), mustCover, avoid, budget, startWith, cap).chosen;
    return cover(candidates, mustCover, avoid, budget, big, cap);
  };

  for (const t of templates) {
    recoveryCheck = (chosen, ex) => {
      const saved = [t.exercises, t.sets];
      t.exercises = [...chosen, ex];
      t.sets = t.exercises.map(() => 1);
      const ok = overLimit(ex.units).length === 0;
      [t.exercises, t.sets] = saved;
      return ok;
    };
    const scope = SESSION_TYPES[t.type].scope.filter((u) => required.includes(u));
    // Only exercises that are mainly for this session's muscles (no squats on
    // upper day): at least half of what they train must belong here. That keeps
    // face pulls and upright rows (rear delts, traps) on pull day rather than push
    // day, where they'd hit the pull muscles again the day before or after.
    const fullScope = SESSION_TYPES[t.type].scope;
    const candidates = pool.filter((ex) => {
      const trains = [...ex.units].filter((u) => reachable.includes(u));
      if (!trains.length) return [...ex.primary].some((u) => fullScope.includes(u));
      const here = trains.filter((u) => fullScope.includes(u)).length;
      return here > 0 && here * 2 >= trains.length;
    });
    t.candidates = candidates;
    const sibling = templates.find((o) => o.type === t.type && o.variant !== t.variant && o.exercises.length);
    let chosen;
    const hasSibling = templates.some((o) => o !== t && o.type === t.type);
    if (!sibling) {
      // With an A/B pair, A doesn't have to reach everything (B covers the rest).
      // (Full-body days only: split days already divide the body.)
      const cap = hasSibling && level.abSplitCap && t.type === 'full' ? Math.min(level.abSplitCap, exerciseCap(t)) : exerciseCap(t);
      chosen = coverCompoundsFirst(candidates, scope, new Set(), maxSets, [], cap).chosen;
    } else {
      // Variant B: first whatever A had no time for, then the rest, preferring new exercises.
      const avoid = new Set(sibling.exercises.map((e) => String(e._id)));
      const siblingCovered = new Set(sibling.exercises.flatMap((e) => [...e.units]));
      const missed = scope.filter((u) => !siblingCovered.has(u));
      // Full body B only has to cover what A didn't: a muscle trained only in A
      // still gets ~1.5 sessions a week as A and B alternate, which is enough to
      // grow. Filling (below) adds more to B wherever the WNS gain is worth it.
      // Split days (upper, push…) already cover few muscles, so their B covers
      // all of them again (with different exercises where possible).
      const first = coverCompoundsFirst(candidates, missed, avoid, maxSets, [], exerciseCap(t)).chosen;
      chosen = t.type === 'full' ? first : coverCompoundsFirst(candidates, scope, avoid, maxSets, first, exerciseCap(t)).chosen;
    }
    t.exercises = chosen;
    t.sets = chosen.map(() => 1);
  }

  // ── 3. Sets: fill by WNS gain per minute ───────────────────────────────────
  // Full value up to the target, 30% after it (diminishing returns).
  // Negative WNS (a muscle losing ground) costs 5× as much as extra stimulus is
  // worth, so every muscle is brought to at least maintenance before others get more.
  const NEGATIVE_PENALTY = 5;
  const NEGATIVE_STEP = 10;
  const value = () => required.reduce((sum, u) => {
    const x = wnsOf(u);
    const target = targetFor(u);
    // Plus a flat penalty for being below zero at all, so even a slightly
    // negative muscle is worth fixing at the cost of extra volume elsewhere.
    const losing = x < 0 ? NEGATIVE_PENALTY * x - NEGATIVE_STEP : 0;
    return sum + weight(u) * (Math.min(x, target) + 0.3 * Math.max(0, x - target) + losing);
  }, 0);
  const setsUsed = (t) => templates[t].sets.reduce((a, b) => a + b, 0);
  const minutesUsed = (t) => templates[t].exercises.reduce((sum, ex, i) => sum + exerciseMinutes(ex, templates[t].sets[i]), 0);


  // An exercise is redundant in a workout if another exercise there has the
  // same main muscle and already trains everything it would — dumbbell flyes
  // next to a bench press, pushdowns next to dips, pull-ups next to chin-ups.
  // Then it's more sets of the first one, or nothing. Exercises for a different
  // main muscle aren't redundant even if covered (curls next to chin-ups: the
  // chin-up is a back exercise). Also kept: an exercise aimed at a priority
  // region that still needs one (incline next to flat bench for prioritised pecs).
  const canTakeSets = (t, o, n) => {
    const tpl = templates[t];
    const k = tpl.exercises.indexOf(o);
    if (k === -1 || tpl.sets[k] + n > level.maxSetsPerExercise) return false;
    tpl.sets[k] += n;
    const ok = !overLimit(o.units).length;
    tpl.sets[k] -= n;
    return ok;
  };
  // Judged on every muscle the plan could train (for beginners that includes the
  // regions they don't chase, so a leg extension still counts for rectus femoris).
  const coveringIn = (t, ex) => {
    const mine = [...ex.units].filter((u) => reachable.includes(u));
    // "Covers" means at least as much per set: a back extension (short head 0.5)
    // doesn't cover a leg curl (short head 1).
    return templates[t].exercises.filter((o) => o !== ex
      && mine.every((u) => (o.weights.get(u) || 0) >= (ex.weights.get(u) || 0))
      && [...ex.primary].some((u) => o.primary.has(u)));
  };
  // An exercise is also redundant when everything it trains is already trained
  // by the other exercises in the workout — glute kickbacks or a hip thrust next
  // to a squat and a back extension, lateral raises next to an overhead press —
  // unless it's isolation for a priority muscle (then extra, targeted volume is the point).
  // A compound only counts as covered by other compounds (a squat isn't made
  // redundant by a leg extension + calf raise); isolation work by anything.
  const coveredByOthers = (t, ex, mine) =>
    mine.every((u) => templates[t].exercises.some((o) => o !== ex && (o.weights.get(u) || 0) >= (ex.weights.get(u) || 0)
      && (!ex.compound || o.compound)));
  const redundantIn = (t, ex) => {
    const mine = [...ex.units].filter((u) => reachable.includes(u));
    if (mine.some((u) => needsTargeted.has(u) && targets(ex, u)
      && !templates[t].exercises.some((o) => o !== ex && targets(o, u)))) return false;
    // For a priority muscle, extra isolation volume is fine once the lifts that
    // cover it can't take more sets (e.g. flyes when more bench would overload
    // the triceps) — that's how a priority gets its higher volume. A second
    // compound for the same thing (a second incline press) still isn't.
    // Two exercises that train exactly the same muscles (cable and dumbbell
    // flyes) are always one too many.
    const same = (o) => {
      const theirs = [...o.units].filter((u) => reachable.includes(u));
      return theirs.length === mine.length && theirs.every((u) => mine.includes(u));
    };
    if (coveringIn(t, ex).some(same)) return true;
    if (mine.some(isPriority) && !ex.compound) return coveringIn(t, ex).some((o) => canTakeSets(t, o, 1));
    if (coveringIn(t, ex).length > 0) return true;
    // Anything — compound or isolation — whose muscles are all already trained
    // in this workout adds nothing new: a hip thrust after squats and back
    // extensions (glutes and quads already there). More sets of those instead.
    return mine.length > 0 && coveredByOthers(t, ex, mine);
  };

  // Merge redundant exercises into the one that covers them: the sets move over
  // (as many as the bigger exercise and recovery allow). Exercise choice can
  // create these — e.g. an incline press picked first, then dips, which also
  // hit everything the incline did.
  const prune = () => {
    templates.forEach((tpl, t) => {
      for (let guard = 0; guard < 20; guard++) {
        const i = tpl.exercises.findIndex((ex) => redundantIn(t, ex));
        if (i === -1) break;
        const ex = tpl.exercises[i];
        const moved = tpl.sets[i];
        const into = coveringIn(t, ex).sort((a, b) => b.units.size - a.units.size)[0];
        tpl.exercises.splice(i, 1);
        tpl.sets.splice(i, 1);
        // Its sets move over as far as the other exercise's set limit and recovery allow.
        for (let n = 0; n < moved && canTakeSets(t, into, 1); n++) tpl.sets[tpl.exercises.indexOf(into)]++;
      }
    });
  };
  prune();

  // Exercise choice starts every exercise at 1 set, which can already be too much
  // for a muscle hit by several exercises in one session. Trim until every
  // muscle is within its limit: drop an extra set first, otherwise an exercise
  // whose required muscles are all still covered by the rest of that session.
  for (let guard = 0; guard < 200; guard++) {
    const allUnits = new Set(templates.flatMap((t) => t.exercises.flatMap((ex) => [...ex.units])));
    const bad = overLimit(allUnits);
    if (!bad.length) break;
    const u = bad[0];
    // The session with the most sets for this muscle.
    const t = templates.map((_, i) => i).sort((x, y) => unitSetsIn(y, u) - unitSetsIn(x, u))[0];
    const tpl = templates[t];
    const hitting = tpl.exercises.map((ex, i) => ({ ex, i })).filter(({ ex }) => ex.units.has(u));
    const extra = hitting.filter(({ i }) => tpl.sets[i] > 1).sort((x, y) => tpl.sets[y.i] - tpl.sets[x.i])[0];
    if (extra) { tpl.sets[extra.i]--; continue; }
    const removable = hitting.find(({ ex, i }) => [...ex.units].every((unit) => !required.includes(unit)
      || tpl.exercises.some((other, j) => j !== i && other.units.has(unit))));
    if (!removable) break; // can't trim without losing a muscle; reported below
    tpl.exercises.splice(removable.i, 1);
    tpl.sets.splice(removable.i, 1);
  }

  // Each step either adds a set to an exercise already in a session, or adds a
  // new exercise (1 set) when that helps more per minute — e.g. a pull day
  // that's only rows gains a pulldown or curls instead of stopping at the row's
  // set cap. A new exercise also costs its warm-up, so extra sets on exercises
  // already there usually win.
  // One more set within the session's set limit (a new exercise starts with one).
  const fits = (t, ex) => setsUsed(t) + 1 <= maxSets
    && ![...ex.units].some((u) => required.includes(u) && unitSetsIn(t, u) >= unitSetCap(u));
  // Applied tentatively by the caller: does the change keep this exercise's muscles recoverable?
  const recoverable = (ex) => overLimit(ex.units).length === 0;

  const fill = () => { for (let guard = 0; guard < 1000; guard++) {
    const base = value();
    let best = null;
    templates.forEach((tpl, t) => {
      tpl.exercises.forEach((ex, i) => {
        if (tpl.sets[i] >= level.maxSetsPerExercise || !fits(t, ex)) return;
        if (!ex.compound && level.maxIsolationSets && tpl.sets[i] >= level.maxIsolationSets) return;
        tpl.sets[i]++;
        const ok = recoverable(ex);
        // The level's style applies to sets too: beginners' sets go to the big lifts first.
        const gain = ok ? ((value() - base) / setMinutes(ex)) * (styleFactor(ex) || 0.5) : 0;
        if (gain > 1e-6 && (!best || gain > best.gain)) best = { t, i, gain };
        // Beginners: if the big lift is blocked only by an isolation exercise
        // using up the same muscle (squat vs leg extension on the quads), move a
        // set from the isolation exercise to the lift.
        if (!ok && ex.compound && level.compoundBonus > 1) {
          // One or two isolation exercises can each give a set (a squat shares
          // the quads with leg extensions and the calves with calf raises).
          const isos = tpl.exercises.map((iso, j) => j)
            .filter((j) => j !== i && !tpl.exercises[j].compound && tpl.sets[j] >= 2
              && [...tpl.exercises[j].units].some((u) => ex.units.has(u)));
          const combos = [...isos.map((j) => [j]), ...isos.flatMap((a, x) => isos.slice(x + 1).map((b) => [a, b]))];
          for (const from of combos) {
            from.forEach((j) => { tpl.sets[j]--; });
            // Worth a small loss on paper (the leg extension's rectus femoris
            // work, say): for a beginner the main lift is the better use of the set.
            const dv = value() - base;
            if (recoverable(ex) && dv > -0.5) {
              const g = dv > 0 ? (dv / setMinutes(ex)) * level.compoundBonus : 1e-5;
              if (!best || g > best.gain) best = { t, i, gain: g, from };
            }
            from.forEach((j) => { tpl.sets[j]++; });
          }
        }
        tpl.sets[i]--;
      });
      for (const ex of tpl.candidates) {
        if (tpl.exercises.includes(ex) || !fits(t, ex)) continue;
        if (tpl.exercises.length >= exerciseCap(tpl)) continue;
        if (redundantIn(t, ex)) continue;
        // Beginners: another exercise only if it brings a muscle this workout
        // doesn't train yet (no second row next to the first) — otherwise more sets.
        if (level.newExerciseMustAddMuscle && ![...ex.units].some((u) => required.includes(u) && unitSetsIn(t, u) === 0)) continue;
        if (!styleFactor(ex) && tpl.exercises.length >= exerciseMin(tpl)) continue; // beginners: isolation only to reach the minimum
        tpl.exercises.push(ex);
        tpl.sets.push(1);
        const ok = recoverable(ex);
        // "Prefer sets over new exercises" only once the workout has its minimum
        // number of exercises; below that, a new exercise competes normally
        // (otherwise one workout soaks up all the sets and its pair stays bare).
        const newFactor = tpl.exercises.length < exerciseMin(tpl) ? 1 : level.newExercise ?? 1;
        let gain = ok ? ((value() - base) / exerciseMinutes(ex)) * (styleFactor(ex) || 0.5) * newFactor : 0;
        // Keep A and B different: an exercise the other variant already has counts for less.
        if (templates.some((o) => o !== tpl && o.type === tpl.type && o.exercises.includes(ex))) gain *= 0.6;
        if (preferCustom && ex.isCustom) gain *= 1.5;
        tpl.exercises.pop();
        tpl.sets.pop();
        if (gain > 1e-6 && (!best || gain > best.gain)) best = { t, add: ex, gain };
      }
    });
    if (!best) break; // no time left, or nothing adds anything
    if (best.add) { templates[best.t].exercises.push(best.add); templates[best.t].sets.push(1); }
    else {
      templates[best.t].sets[best.i]++;
      if (best.from) best.from.forEach((j) => { templates[best.t].sets[j]--; });
    }
  } };

  // ── Repair: no muscle left with negative WNS ──────────────────────────────
  // Filling can get stuck: e.g. every exercise that would train the side delts
  // also hits front delts that two presses already took to their recovery
  // limit, or there's no time left. Here a set (or a 1-set exercise) can be
  // taken away to make room for what the losing muscle needs — the trade is
  // made only if the plan as a whole comes out better, which the negative
  // penalty makes true whenever a muscle goes from losing to maintaining.
  // mode 'negative': fix muscles losing ground, bending the level's style if
  //   needed (e.g. an isolation exercise for a beginner).
  // mode 'target': afterwards, trade toward muscles still under their target,
  //   keeping to the level's style (for beginners: compounds, and a new exercise
  //   only if it brings a muscle the workout doesn't train yet).
  const repair = (mode = 'negative') => {
    const strict = mode === 'target';
    for (let guard = 0; guard < (strict ? 30 : 60); guard++) {
      const losing = required.filter((u) => (strict ? wnsOf(u) < targetFor(u) - 1e-9 : wnsOf(u) < 0));
      if (!losing.length) return;
      const base = value();
      let best = null;
      const consider = (apply, undo) => {
        apply();
        const v = value();
        undo();
        if (v > base + 1e-6 && (!best || v > best.v)) best = { v, apply };
      };
      // Anything in any session can be taken away to make room — in the same
      // session for time, or elsewhere for recovery (e.g. a push-day exercise
      // that also hits the rear delts the pull day needs).
      // Up to two things can be taken away at once (e.g. a set of squats for
      // recovery room and a 1-set exercise to stay within a beginner's 7).
      // Each removal is one set, or the whole exercise.
      const singles = [];
      templates.forEach((tpl, t) => tpl.exercises.forEach((_, i) => {
        singles.push({ t, i, whole: false });
        if (tpl.sets[i] > 1) singles.push({ t, i, whole: true });
      }));
      const oneOrNone = [[], ...singles.map((a) => [a])];
      const pairs = [];
      singles.forEach((a, x) => {
        for (let y = x + 1; y < singles.length; y++) {
          const b = singles[y];
          if (!(a.t === b.t && a.i === b.i)) pairs.push([a, b]);
        }
      });
      const snapshotAll = () => templates.map((tp) => [[...tp.exercises], [...tp.sets]]);
      const restoreAll = (snap) => templates.forEach((tp, k) => { tp.exercises = [...snap[k][0]]; tp.sets = [...snap[k][1]]; });

      const search = (removals) => {
      templates.forEach((tpl, t) => {
          for (const u of losing) {
            const options = [
              ...tpl.exercises.filter((ex) => ex.units.has(u)),
              // Isolation is fine here even for beginners when a muscle is losing ground.
              ...tpl.candidates.filter((ex) => ex.units.has(u) && !tpl.exercises.includes(ex)
                && (!strict || (styleFactor(ex) && !redundantIn(t, ex) && (!level.newExerciseMustAddMuscle || unitSetsIn(t, u) === 0)))),
            ];
            for (const ex of options) {
              for (const combo of removals) {
                // Topping up toward targets only trims sets — it never drops a
                // whole exercise (a beginner's squat shouldn't be traded away).
                if (strict && combo.some((r) => r.whole || templates[r.t].sets[r.i] < 2)) continue;
                if (combo.some((r) => r.t === t && tpl.exercises[r.i] === ex)) continue;
                const snap = snapshotAll();
                const removed = combo.map((r) => ({ t: r.t, ex: templates[r.t].exercises[r.i], whole: r.whole }));
                const apply = () => {
                  for (const r of removed) {
                    const rt = templates[r.t];
                    const ri = rt.exercises.indexOf(r.ex);
                    if (ri < 0) continue;
                    if (r.whole || rt.sets[ri] === 1) { rt.exercises.splice(ri, 1); rt.sets.splice(ri, 1); } else rt.sets[ri]--;
                  }
                  const idx = tpl.exercises.indexOf(ex);
                  if (idx >= 0) tpl.sets[idx]++; else { tpl.exercises.push(ex); tpl.sets.push(1); }
                };
                const undo = () => restoreAll(snap);
                apply();
                const idx = tpl.exercises.indexOf(ex);
                const ok = tpl.sets[idx] <= Math.max(level.maxSetsPerExercise, 1)
                && (ex.compound || !level.maxIsolationSets || tpl.sets[idx] <= level.maxIsolationSets)
                  && tpl.exercises.length <= exerciseCap(tpl)
                  && setsUsed(t) <= maxSets && tpl.exercises.length <= exerciseCap(tpl) && recoverable(ex)
                  && ![...ex.units].some((x) => required.includes(x) && unitSetsIn(t, x) > unitSetCap(x));
                undo();
                if (!ok) continue;
                consider(apply, undo);
              }
            }
          }
        });
      };
      search(oneOrNone);
      if (!best && !strict) search(pairs); // only if taking one thing away isn't enough
      if (!best) return; // nothing helps; reported as below 0 in the preview
      best.apply();
    }
  };

  fill();
  repair('negative');
  repair('target');
  fill(); // use any time the repairs freed up
  prune(); // anything the repairs made redundant
  fill();

  // Minimum exercises per session (leg days). If the WNS maths alone stopped
  // short, add the most useful exercises: not redundant, recoverable, within the
  // time — isolation work allowed even for beginners here. When recovery or time
  // is already used up, a set comes off an exercise that has 2 or more to make
  // room (spreading the same work over more exercises).
  const minFill = () => templates.forEach((tpl, t) => {
    while (tpl.exercises.length < exerciseMin(tpl)) {
      const base = value();
      let best = null;
      // Up to two exercises can each give a set (a squat needs room on both the
      // quads and the calves side, for example).
      const idx = tpl.exercises.map((_, i) => i);
      const donors = [[], ...idx.map((i) => [i]), ...idx.flatMap((i) => idx.filter((j) => j > i).map((j) => [i, j]))];
      for (const ex of tpl.candidates) {
        if (tpl.exercises.includes(ex) || redundantIn(t, ex)) continue;
        for (const d of donors) {
          if (d.some((i) => tpl.sets[i] < 2)) continue;
          d.forEach((i) => { tpl.sets[i]--; });
          const fitsNow = setsUsed(t) + 1 <= maxSets;
          tpl.exercises.push(ex);
          tpl.sets.push(1);
          const ok = fitsNow && recoverable(ex) && !redundantIn(t, ex);
          // Prefer an exercise that brings a muscle this workout doesn't train yet
          // (a leg extension for the rectus femoris after squats), even one a
          // beginner plan doesn't chase, over more of what's already covered.
          const newMuscles = [...ex.units].filter((u) => reachable.includes(u)
            && !tpl.exercises.some((o) => o !== ex && o.units.has(u))).length;
          const gain = (value() - base) / exerciseMinutes(ex) + newMuscles;
          tpl.exercises.pop();
          tpl.sets.pop();
          d.forEach((i) => { tpl.sets[i]++; });
          if (ok && (!best || gain > best.gain)) best = { ex, d, gain };
        }
      }
      if (!best) break; // nothing else fits (e.g. a very short session)
      best.d.forEach((i) => { tpl.sets[i]--; });
      tpl.exercises.push(best.ex);
      tpl.sets.push(1);
    }
  });
  // An added exercise can make an earlier one redundant (a hip thrust after a
  // kickback): merge those, then top up again, until nothing changes.
  for (let round = 0; round < 4; round++) {
    const before = JSON.stringify(templates.map((tp) => [tp.exercises.map((e) => String(e._id)), tp.sets]));
    minFill();
    prune();
    if (JSON.stringify(templates.map((tp) => [tp.exercises.map((e) => String(e._id)), tp.sets])) === before) break;
  }
  fill(); // give the new exercises sets if there's time

  // ── Use the room that's left ─────────────────────────────────────────────
  // If a workout is still under its set and exercise limits, use them: first
  // give direct work to muscles that only get trained as a helper in that
  // workout (biceps when only chin-ups hit them, calves when only squats do),
  // then extra sets wherever they add stimulus. Exercises for a muscle that
  // already has its own exercise there stay out (no kickbacks next to a hip thrust).
  const primaryIn = (t, u) => templates[t].exercises.some((o) => o.primary.has(u));
  const spareFill = (directOnly = false) => {
    for (let guard = 0; guard < 200; guard++) {
      const base = value();
      let best = null;
      templates.forEach((tpl, t) => {
        if (setsUsed(t) >= maxSets && !directOnly) return;
        // A new exercise for a muscle with no exercise of its own here. When
        // the sets are used up, one can come off an exercise that has 3+.
        const donor = setsUsed(t) >= maxSets
          ? tpl.sets.map((n, i) => ({ n, i })).filter((d) => d.n >= 3).sort((a, b) => b.n - a.n)[0]
          : null;
        if (tpl.exercises.length < exerciseCap(tpl) && (setsUsed(t) < maxSets || donor)) {
          for (const ex of tpl.candidates) {
            if (tpl.exercises.includes(ex)) continue;
            const direct = [...ex.primary].filter((u) => reachable.includes(u) && !primaryIn(t, u));
            // How far those muscles are below target: direct work goes where it's needed.
            const deficit = direct.reduce((sum, u) => sum + (required.includes(u) ? Math.max(0, targetFor(u) - wnsOf(u)) : 0), 0);
            if (directOnly && deficit <= 1e-6) continue;
            if (!direct.length || coveringIn(t, ex).some((o) => o.primary.size && [...ex.primary].every((u) => o.primary.has(u)))) continue;
            if (donor) tpl.sets[donor.i]--;
            tpl.exercises.push(ex); tpl.sets.push(1);
            const ok = recoverable(ex);
            const dv = value() - base;
            tpl.exercises.pop(); tpl.sets.pop();
            if (donor) tpl.sets[donor.i]++;
            // Direct work for a muscle is worth a small loss on paper elsewhere
            // (one set fewer of a big lift that already has plenty).
            if (!ok || dv < (donor ? -0.5 : -1e-6)) continue;
            const score = 1000 + deficit * 100 + dv; // direct work for the neediest muscle first
            if (!best || score > best.score) best = { t, add: ex, score, donor: donor?.i };
          }
        }
        // Or one more set where it still adds something.
        if (directOnly) return;
        tpl.exercises.forEach((ex, i) => {
          if (tpl.sets[i] >= level.maxSetsPerExercise) return;
          if (!ex.compound && level.maxIsolationSets && tpl.sets[i] >= level.maxIsolationSets) return;
          if ([...ex.units].some((u) => required.includes(u) && unitSetsIn(t, u) >= unitSetCap(u))) return;
          tpl.sets[i]++;
          const ok = recoverable(ex);
          const dv = value() - base;
          tpl.sets[i]--;
          if (ok && dv > 1e-6 && (!best || dv > best.score)) best = { t, i, score: dv };
        });
      });
      if (!best) return;
      if (best.add) {
        if (best.donor !== undefined) templates[best.t].sets[best.donor]--;
        templates[best.t].exercises.push(best.add);
        templates[best.t].sets.push(1);
      } else templates[best.t].sets[best.i]++;
    }
  };
  spareFill(true); // direct work for helper-only muscles, even if a set has to move
  spareFill();     // then any room that's left

  repair('negative'); // a last check: nothing above may leave a muscle losing ground

  // ── Reps in reserve ────────────────────────────────────────────────────────
  // Sets go close to failure, leaving 1–2 reps in reserve. Priority muscles get
  // more volume, so they stay at 1–2 too, unless their recovery demand is low.
  // Mostly 1–2 RIR. Only a priority muscle with low recovery demand can go closer to failure (0–2).
  const rirForLevel = (level) => (level === 'veryLow' || level === 'low' ? '0–2' : '1–2');
  const rirFor = (ex) => {
    const pri = [...ex.primary].filter(isPriority);
    if (!pri.length) return '1–2';
    const order = ['none', 'veryLow', 'low', 'medium', 'high', 'extreme', 'unrecoverable'];
    const worst = pri.map((u) => recoveryOf(u).level).sort((a, b) => order.indexOf(b) - order.indexOf(a))[0];
    return rirForLevel(worst);
  };

  // ── Output ────────────────────────────────────────────────────────────────
  // Compounds (several units) first with a heavier rep range; isolation after.
  const exercisesOf = (tpl) => tpl.exercises
    .map((ex, i) => ({ ex, sets: tpl.sets[i] }))
    .sort((x, y) => y.ex.units.size - x.ex.units.size || x.ex.name.localeCompare(y.ex.name))
    .map(({ ex, sets: n }, order) => ({
      exercise: { _id: ex._id, name: ex.name, muscleGroups: ex.muscleGroups, secondaryMuscles: ex.secondaryMuscles || [], equipment: ex.equipment, laterality: ex.laterality, isCustom: !!ex.isCustom, images: ex.images || [] },
      targetSets: n,
      targetReps: REP_RANGE[0],
      targetRepsMax: REP_RANGE[1],
      targetWeight: 0,
      targetRir: rirFor(ex),
      order,
    }));

  const isRotation = skeleton.schedule === 'rotation';
  const { rotation } = skeleton;
  const days = skeleton.slots.map((sl) => ({ dayOfWeek: sl.dayOfWeek, label: templates[sl.template].label, exercises: exercisesOf(templates[sl.template]) }));

  // Final stimulus with each exercise's own RIR.
  effOf = (ex) => effectiveSets(REP_RANGE[0], rirValue(rirFor(ex)));
  const trackedUnits = [...new Set([...required, ...templates.flatMap((t) => t.exercises.flatMap((ex) => [...ex.units]))])];
  const units = trackedUnits
    .map((u) => ({
      unit: u,
      required: required.includes(u),
      priority: isPriority(u),
      wns: +wnsOf(u).toFixed(2),
      target: required.includes(u) ? targetFor(u) : null,
      setsPerWeek: +(schedule.reduce((sum, s) => sum + unitSetsIn(s.template, u), 0) * perWeek).toFixed(1),
      sessionsPerWeek: +(schedule.filter((s) => unitSetsIn(s.template, u) > 0).length * perWeek).toFixed(1),
      recovery: (({ value: v, level }) => ({ value: +v.toFixed(2), level }))(recoveryOf(u)),
      recommendedRir: isPriority(u) ? rirForLevel(recoveryOf(u).level) : null,
    }))
    .sort((x, y) => Number(y.required) - Number(x.required) || x.wns - y.wns);

  const minutesByLabel = Object.fromEntries(templates.map((t, i) => [t.label, Math.round(minutesUsed(i))]));
  const longest = Math.max(...Object.values(minutesByLabel));

  return {
    plan: {
      name: split.everyDays ? `${split.name} (${maxSets} sets)` : `${split.name} ${daysPerWeek}×/week (${maxSets} sets)`,
      description: `Generated low-volume, high-frequency plan: ${split.name}, `
        + (split.everyDays ? 'a session every other day (3.5 a week)' : `${daysPerWeek} sessions a week`)
        + (isRotation ? `, workouts rotating ${days.map((d) => d.label).join(' → ')}` : '')
        + `, up to ${maxSets} working sets and ${maxExercises} exercises each (about ${longest} min with warm-ups). `
        + `Sets of ${REP_RANGE[0]}–${REP_RANGE[1]} reps. `
        + 'Take sets close to failure, leaving 1–2 reps in reserve'
        + (priorities.size ? '; for priority muscles follow each exercise\'s RIR target to manage their higher recovery demand.' : '.'),
      days,
      schedule: isRotation ? 'rotation' : 'weekly',
      ...(rotation && { rotation }),
    },
    analysis: { limits: { maxSets, maxExercises }, setsByLabel: Object.fromEntries(templates.map((t, i) => [t.label, setsUsed(i)])), split: splitKey, level: levelKey, excluded: [...excluded], units, minutesByLabel, unreachable, skippedForLevel, model },
  };
}

/**
 * WNS and recovery for any plan (e.g. a generated one after swapping an
 * exercise), using the same rules as the generator.
 * @param days [{ dayOfWeek, exercises: [{ exercise: { muscleGroups }, targetSets, targetReps?, targetRir? }] }]
 *   Reps and RIR set how much each set counts for stimulus (see effectiveSets);
 *   without them a set counts in full.
 * @param opts { priorities[], dataset, maintenance, stimHours }
 */
function analyzePlan(days, opts = {}) {
  const priorities = new Set(opts.priorities || []);
  const model = { dataset: opts.dataset || 'S', maintenance: Number(opts.maintenance) || 3, stimHours: Number(opts.stimHours) || 48 };
  const isPriority = (unit) => priorities.has(unit) || priorities.has(unit.split(' › ')[0]);
  const baseTarget = (LEVELS[opts.level] || LEVELS.intermediate).target;
  // Secondary muscles count 0.5 − x toward volume: the caller's weight (the
  // user's own, from FFMI) or the picked level's.
  const secondaryWeight = opts.secondaryWeight ?? secondaryWeightFor(LEVELS[opts.level] ? opts.level : 'intermediate');
  const targetFor = (unit) => baseTarget + (isPriority(unit) ? 1 : 0);

  // Build the timeline the same way as the generator: weekly = one workout per
  // weekday; rotation = the workouts in order on the training days or every N days.
  const workouts = (days || []).map((d) => ({
    weekday: Number(d.dayOfWeek) || 0,
    items: (d.exercises || []).map((e) => ({
      units: unitsForTags(e.exercise?.muscleGroups),
      weights: unitWeights(e.exercise?.muscleGroups, e.exercise?.secondaryMuscles),
      vol: volumeWeights(unitWeights(e.exercise?.muscleGroups, e.exercise?.secondaryMuscles), secondaryWeight),
      primary: unitsForTags((e.exercise?.muscleGroups || []).slice(0, 1)),
      sets: Number(e.targetSets) || 0,
      eff: effectiveSets(e.targetReps, rirValue(e.targetRir)),
    })),
  }));
  let sessions;
  let cycleDays = 7;
  const rot = opts.schedule === 'rotation' ? opts.rotation || {} : null;
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  if (rot && rot.everyDays && workouts.length) {
    cycleDays = rot.everyDays * workouts.length;
    sessions = workouts.map((w, i) => ({ day: i * rot.everyDays, items: w.items }));
  } else if (rot && rot.weekdays?.length && workouts.length) {
    const W = rot.weekdays;
    const weeks = workouts.length / gcd(workouts.length, W.length);
    cycleDays = 7 * weeks;
    sessions = Array.from({ length: weeks * W.length }, (_, k) => ({
      day: Math.floor(k / W.length) * 7 + W[k % W.length],
      items: workouts[k % workouts.length].items,
    }));
  } else {
    sessions = workouts.map((w) => ({ day: w.weekday, items: w.items }));
  }
  model.cycleDays = cycleDays;
  const perWeek = 7 / cycleDays;
  const secondaryFactor = SECONDARY_RECOVERY;
  const recoveryPerDay = (unit) => sessions.map((s) => ({
    day: s.day,
    sets: s.items.reduce((sum, it) => sum + it.sets * Math.min(it.weights.get(unit) || 0, it.primary.has(unit) ? 1 : secondaryFactor), 0),
  }));
  const setsIn = (s, unit) => s.items.reduce((sum, it) => sum + it.sets * (it.vol.get(unit) || 0), 0);
  const perDay = (unit) => sessions.map((s) => ({ day: s.day, sets: setsIn(s, unit) }));
  // Stimulus counts effective sets; sets/week and recovery count every set.
  const stimIn = (s, unit) => s.items.reduce((sum, it) => sum + it.sets * it.eff * (it.vol.get(unit) || 0), 0);
  const stimPerDay = (unit) => sessions.map((s) => ({ day: s.day, sets: stimIn(s, unit) }));

  const hit = new Set(sessions.flatMap((s) => s.items.flatMap((it) => [...it.units])));
  const all = [...new Set([...REQUIRED_UNITS, ...hit])];
  const rir = (level) => (level === 'veryLow' || level === 'low' ? '0–2' : '1–2');

  return {
    units: all.map((u) => {
      const required = REQUIRED_UNITS.includes(u);
      const rec = recoveryDemand(recoveryPerDay(u), model);
      const days7 = perDay(u);
      return {
        unit: u,
        required,
        priority: isPriority(u),
        wns: +weeklyNet(stimPerDay(u), model).toFixed(2),
        target: required ? targetFor(u) : null,
        setsPerWeek: +(days7.reduce((sum, d) => sum + d.sets, 0) * perWeek).toFixed(1),
        sessionsPerWeek: +(days7.filter((d) => d.sets > 0).length * perWeek).toFixed(1),
        recovery: { value: +rec.value.toFixed(2), level: rec.level },
        recommendedRir: isPriority(u) ? rir(rec.level) : null,
      };
    }).sort((x, y) => Number(y.required) - Number(x.required) || x.wns - y.wns),
  };
}

module.exports = { generatePlan, analyzePlan, planSkeleton, REQUIRED_UNITS, SPLITS };
