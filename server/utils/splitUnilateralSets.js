/**
 * Sets logged for an exercise before it was unilateral have no side. Assume both
 * sides did the same: each such set becomes a left and a right entry with the
 * same reps/weight/RIR, with the rest kept on the right (it comes after both).
 * Exercise entries that already have per-side sets are left alone.
 *
 * Works on the raw collection so it can run from migrations and controllers.
 * @param db           native MongoDB Db (mongoose.connection.db)
 * @param exerciseIds  exercise _ids (ObjectId or string) that are now unilateral
 * @returns number of workouts updated
 */
const { Types: { ObjectId } } = require('mongoose');

async function splitUnilateralSets(db, exerciseIds) {
  const ids = exerciseIds.map((id) => new ObjectId(String(id)));
  if (ids.length === 0) return 0;
  const uni = new Set(ids.map(String));

  const workouts = db.collection('workoutsessions');
  let updated = 0;
  for await (const w of workouts.find({ 'exercises.exercise': { $in: ids } })) {
    let changed = false;
    const exercises = w.exercises.map((ex) => {
      if (!uni.has(String(ex.exercise))) return ex;
      if ((ex.sets || []).some((st) => st.side)) return ex; // already per side
      changed = true;
      return {
        ...ex,
        sets: ex.sets.flatMap((st) => [
          { ...st, _id: new ObjectId(), side: 'left', restTime: null },
          { ...st, _id: new ObjectId(), side: 'right' },
        ]),
      };
    });
    if (changed) {
      await workouts.updateOne({ _id: w._id }, { $set: { exercises } });
      updated++;
    }
  }
  return updated;
}

module.exports = splitUnilateralSets;
