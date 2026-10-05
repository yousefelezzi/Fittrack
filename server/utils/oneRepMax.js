/**
 * Estimated one-rep max, counting reps in reserve (RIR).
 *
 * A set taken short of failure could have gone further, so RIR is added to the
 * reps before estimating: 5 reps @ 1 RIR counts as a 6-rep max. Uses the Epley
 * formula; a true single (1 rep, 0 RIR) counts as-is.
 */
const MAX_EFFECTIVE_REPS = 12; // estimates get unreliable past this

const effectiveReps = (set) => (Number(set.reps) || 0) + (Number(set.rir) || 0);

function estimateOneRepMax(set) {
  const w = Number(set.weight) || 0;
  const reps = effectiveReps(set);
  if (!(w > 0) || !(Number(set.reps) > 0)) return 0;
  return reps === 1 ? w : w * (1 + reps / 30);
}

/** True when the set is usable for a 1RM estimate. */
const countsForOneRepMax = (set) =>
  Number(set.weight) > 0 && Number(set.reps) > 0 && effectiveReps(set) <= MAX_EFFECTIVE_REPS;

module.exports = { estimateOneRepMax, effectiveReps, countsForOneRepMax, MAX_EFFECTIVE_REPS };
