/**
 * A logged workout turned into a plan day, for saving someone's shared workout
 * as a template. Per exercise (an exercise split by "do it later" is merged):
 *   targetSets   — working sets (warm-ups left out; a left + right pair is one set)
 *   targetReps   — the most common reps / seconds held / bursts across those sets
 *   targetWeight — the heaviest working set, in the unit it was logged in
 *   targetRir    — the RIR range used ("1–2"), if every set had one
 */
const KG_PER_LB = 0.45359237;

const amountOf = (type, s) => Number(type === 'yielding' ? s.duration : type === 'overcoming' ? s.bursts : s.reps) || 0;
const mostCommon = (values) => {
  const counts = new Map();
  values.forEach((v) => counts.set(v, (counts.get(v) || 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0];
};

/** @param workout populated workout ({ exercises: [{ exercise: { _id, type }, weightUnit, sets }] }) */
function planExercisesFromWorkout(workout) {
  const merged = [];
  for (const ex of workout.exercises || []) {
    if (!ex.exercise?._id) continue; // deleted exercise
    const id = String(ex.exercise._id);
    const working = (ex.sets || []).filter((s) => !s.warmup);
    const found = merged.find((m) => m.id === id);
    if (found) found.sets.push(...working);
    else merged.push({ id, exercise: ex.exercise, unit: ex.weightUnit === 'lb' ? 'lb' : 'kg', sets: working });
  }
  return merged
    .filter((m) => m.sets.length)
    .map((m, order) => {
      const type = m.exercise.type || 'dynamic';
      const amounts = m.sets.map((s) => amountOf(type, s)).filter((n) => n > 0);
      const topKg = Math.max(0, ...m.sets.map((s) => Number(s.weight) || 0));
      const inUnit = m.unit === 'lb' ? topKg / KG_PER_LB : topKg;
      const rirs = type === 'dynamic' ? m.sets.map((s) => s.rir) : [];
      const allRir = rirs.length > 0 && rirs.every((r) => r != null);
      const [lo, hi] = allRir ? [Math.min(...rirs), Math.max(...rirs)] : [];
      return {
        exercise: m.exercise._id,
        targetSets: m.sets.filter((s) => s.side !== 'right').length || 1,
        targetReps: mostCommon(amounts) || 10,
        targetWeight: Math.round(inUnit * 2) / 2,
        weightUnit: m.unit,
        targetRir: allRir ? (lo === hi ? String(lo) : `${lo}–${hi}`) : '',
        order,
      };
    });
}

module.exports = { planExercisesFromWorkout };
