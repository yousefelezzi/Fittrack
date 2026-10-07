/**
 * How exercise muscle tags turn into muscle volume.
 *
 * Some muscles have sub-regions. The Progress pie shows the whole muscle and its
 * tooltip shows each sub-region. An exercise tagged with the general muscle
 * works every sub-region; one tagged with a sub-region only works that one:
 *   pecs → clavicular + sternal + costal     clavicular / sternal / costal pecs → that region
 *   calves → gastrocnemius + soleus          soleus → soleus
 *   triceps → medial/lateral + long head     medial/lateral triceps / triceps long head → that head
 *   quads → vasti + rectus femoris           vastus quads → vasti (squats, presses, lunges)
 *                                            rectus femoris → rectus femoris only
 *   hamstrings → biarticular + short head    biarticular hamstrings → the two-joint ones
 *     (leg curls, and back extensions where    (hinges: RDL, SLDL, good morning)
 *      the short head works isometrically)
 *                                            hamstrings short head → short head of biceps femoris only
 *   elbow flexors → biceps + brachialis/brachioradialis   biceps / brachialis/brachioradialis → that one
 * Any other tag is its own muscle with no sub-regions.
 *
 * Secondary muscles: an exercise can list some of its tags as secondary
 * (exercise.secondaryMuscles). Those count 0.5 per set instead of 1 — e.g. the
 * triceps on a bench press, the soleus on a squat. Everything below uses these
 * weights, so volume, the volume check and the plan generator all agree.
 * For volume, a secondary muscle counts less as the lifter gets more trained
 * (0.5 − x: see utils/trainingLevel.js); that's applied with volumeWeights.
 */
const SECONDARY_WEIGHT = 0.5;
const round1 = (n) => Math.round(n * 10) / 10;
const TARGETS = {
  pecs:                     [{ group: 'pecs',    subs: ['Clavicular', 'Sternal', 'Costal'] }],
  'clavicular pecs':        [{ group: 'pecs',    subs: ['Clavicular'] }],
  'sternal pecs':           [{ group: 'pecs',    subs: ['Sternal'] }],
  'costal pecs':            [{ group: 'pecs',    subs: ['Costal'] }],
  calves:                   [{ group: 'calves',  subs: ['Gastrocnemius', 'Soleus'] }],
  gastrocnemius:            [{ group: 'calves',  subs: ['Gastrocnemius'] }],
  soleus:                   [{ group: 'calves',  subs: ['Soleus'] }],
  triceps:                  [{ group: 'triceps', subs: ['Medial/lateral head', 'Long head'] }],
  'medial/lateral triceps': [{ group: 'triceps', subs: ['Medial/lateral head'] }],
  'triceps long head':      [{ group: 'triceps', subs: ['Long head'] }],
  quads:                    [{ group: 'quads',   subs: ['Vasti', 'Rectus femoris'] }],
  'vastus quads':           [{ group: 'quads',   subs: ['Vasti'] }],
  'rectus femoris':         [{ group: 'quads',   subs: ['Rectus femoris'] }],
  hamstrings:               [{ group: 'hamstrings', subs: ['Biarticular', 'Short head'] }],
  'elbow flexors':          [{ group: 'elbow flexors', subs: ['Biceps', 'Brachialis/brachioradialis'] }],
  biceps:                   [{ group: 'elbow flexors', subs: ['Biceps'] }],
  'brachialis/brachioradialis': [{ group: 'elbow flexors', subs: ['Brachialis/brachioradialis'] }],
  'biarticular hamstrings': [{ group: 'hamstrings', subs: ['Biarticular'] }],
  'hamstrings short head':  [{ group: 'hamstrings', subs: ['Short head'] }],
};
// Sub-region order in the tooltip.
const SUB_ORDER = {
  pecs: ['Clavicular', 'Sternal', 'Costal'],
  calves: ['Gastrocnemius', 'Soleus'],
  triceps: ['Medial/lateral head', 'Long head'],
  quads: ['Vasti', 'Rectus femoris'],
  hamstrings: ['Biarticular', 'Short head'],
  'elbow flexors': ['Biceps', 'Brachialis/brachioradialis'],
};

/**
 * How much one set counts for each unit an exercise trains: 1, or 0.5 for a
 * secondary muscle. A unit reached by several tags takes the larger weight.
 * @returns Map<unit, weight>
 */
function unitWeights(tags = [], secondary = []) {
  const sec = new Set(secondary || []);
  const out = new Map();
  for (const tag of tags) {
    const w = sec.has(tag) ? SECONDARY_WEIGHT : 1;
    for (const { group, subs = [] } of TARGETS[tag] || [{ group: tag }]) {
      const units = subs.length ? subs.map((sub) => `${group} › ${sub}`) : [group];
      for (const u of units) out.set(u, Math.max(out.get(u) || 0, w));
    }
  }
  return out;
}

/**
 * unitWeights for counting volume at a training level: a secondary muscle
 * counts `secondaryWeight` (0.5 − x) instead of 0.5; one that counts 0 is left out.
 */
function volumeWeights(weights, secondaryWeight = SECONDARY_WEIGHT) {
  const out = new Map();
  for (const [unit, w] of weights) {
    const v = w >= 1 ? w : secondaryWeight;
    if (v > 0) out.set(unit, v);
  }
  return out;
}

/** Working sets (warm-ups don't count), with a unilateral left + right pair counted once. */
const setCount = (ex) => (ex.sets || []).filter((st) => st.side !== 'right' && !st.warmup).length;

/**
 * Sets per muscle and per sub-region in one workout. Each exercise adds its
 * sets once to every muscle/sub-region it hits, even if two of its tags point
 * at the same one (e.g. "pecs" and "clavicular pecs"). Secondary muscles count
 * `secondaryWeight` per set (the lifter's 0.5 − x).
 * @returns {{ groups: Map<string, number>, subs: Map<string, Map<string, number>> }}
 */
function sessionMuscleSets(session, secondaryWeight = SECONDARY_WEIGHT) {
  const groups = new Map();
  const subs = new Map();
  for (const ex of session.exercises || []) {
    const tags = ex.exercise?.muscleGroups || [];
    const sets = setCount(ex);
    if (!tags.length || !sets) continue;

    // Each unit once per exercise, at its weight; a muscle with regions counts
    // at its most-trained region's weight (bench: pecs 1, triceps 0.5).
    const weights = volumeWeights(unitWeights(tags, ex.exercise?.secondaryMuscles), secondaryWeight);
    const groupWeight = new Map();
    for (const [unit, w] of weights) {
      const [group, sub] = unit.split(' › ');
      groupWeight.set(group, Math.max(groupWeight.get(group) || 0, w));
      if (sub) {
        if (!subs.has(group)) subs.set(group, new Map());
        subs.get(group).set(sub, (subs.get(group).get(sub) || 0) + sets * w);
      }
    }
    for (const [group, w] of groupWeight) groups.set(group, (groups.get(group) || 0) + sets * w);
  }
  return { groups, subs };
}

/**
 * Totals across workouts, for the pie.
 * @returns [{ _id: muscle, count: sets, subregions?: [{ name, count }] }] biggest first
 */
function muscleBreakdown(sessions, secondaryWeight = SECONDARY_WEIGHT) {
  const groups = new Map();
  const subs = new Map();
  for (const session of sessions) {
    const one = sessionMuscleSets(session, secondaryWeight);
    for (const [g, n] of one.groups) groups.set(g, (groups.get(g) || 0) + n);
    for (const [g, m] of one.subs) {
      if (!subs.has(g)) subs.set(g, new Map());
      for (const [sub, n] of m) subs.get(g).set(sub, (subs.get(g).get(sub) || 0) + n);
    }
  }
  return [...groups.entries()]
    .map(([muscle, count]) => ({
      _id: muscle,
      count: round1(count),
      ...(SUB_ORDER[muscle] && {
        subregions: SUB_ORDER[muscle].map((name) => ({ name, count: round1(subs.get(muscle)?.get(name) || 0) })),
      }),
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Per-workout sets for each muscle and sub-region, for the volume check.
 * Sub-regions are keyed "muscle › sub-region", e.g. "triceps › Long head".
 * @returns [{ date, sets: { [muscle]: n } }]
 */
function muscleSessions(sessions, secondaryWeight = SECONDARY_WEIGHT) {
  return sessions.map((session) => {
    const { groups, subs } = sessionMuscleSets(session, secondaryWeight);
    const sets = Object.fromEntries(groups);
    for (const [g, m] of subs) for (const [sub, n] of m) sets[`${g} › ${sub}`] = n;
    return { date: session.date, sets };
  });
}

/**
 * The smallest trainable units an exercise hits: sub-regions where a muscle has
 * them ("triceps › Long head"), otherwise the muscle itself ("lats").
 */
function unitsForTags(tags = []) {
  const units = new Set();
  for (const tag of tags) {
    for (const { group, subs = [] } of TARGETS[tag] || [{ group: tag }]) {
      if (subs.length) subs.forEach((sub) => units.add(`${group} › ${sub}`));
      else units.add(group);
    }
  }
  return units;
}

module.exports = { muscleBreakdown, muscleSessions, sessionMuscleSets, unitsForTags, unitWeights, volumeWeights, SUB_ORDER, SECONDARY_WEIGHT };
