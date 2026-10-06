/**
 * Training level from FFMI, and how much a secondary muscle counts at each level.
 *
 * A secondary muscle (the triceps on a bench press…) counts 0.5 − x of a set
 * toward its volume, where x grows with training level: trained lifters get
 * less growth from a muscle that's only helping. Recovery is not affected —
 * a helper muscle still has to recover from the work (see planGenerator).
 *
 *   beginner      x = 0     → 0.5
 *   intermediate  x = 0.25  → 0.25
 *   advanced      x = 0.5   → 0
 *
 * A user's own level comes from their normalized FFMI (needs height, weight and
 * body fat). Women's natural FFMI runs about 3 points lower, so their ranges are
 * shifted down; unknown sex uses the men's ranges. With no FFMI the user counts
 * as a beginner (0.5, as before).
 */
const { SECONDARY_WEIGHT } = require('./muscleGroups');

const DEDUCTION = { beginner: 0, intermediate: 0.25, advanced: 0.5 };
const LEVEL_RANGES = {
  male:   { intermediate: 20, advanced: 22 },
  female: { intermediate: 17, advanced: 19 },
};

/** FFMI and height-normalized FFMI for a user, or null if height, weight or body fat is missing. */
function ffmiOf(user) {
  if (!user?.height || !user?.weight || user?.bodyFat == null) return null;
  const heightM = user.height / 100;
  const value = (user.weight * (1 - user.bodyFat / 100)) / (heightM * heightM);
  return { ffmi: value, normalized: value + 6.1 * (1.8 - heightM) };
}

/** 'beginner' | 'intermediate' | 'advanced' from the user's FFMI, or null without one. */
function levelFromFfmi(user) {
  const f = ffmiOf(user);
  if (!f) return null;
  const r = LEVEL_RANGES[user.sex === 'female' ? 'female' : 'male'];
  return f.normalized >= r.advanced ? 'advanced' : f.normalized >= r.intermediate ? 'intermediate' : 'beginner';
}

/** How much one set counts for a secondary muscle at a level (0.5 − x). */
const secondaryWeightFor = (level) => SECONDARY_WEIGHT - (DEDUCTION[level] ?? 0);

/** The secondary-muscle weight for a user's own training (beginner without FFMI). */
const userSecondaryWeight = (user) => secondaryWeightFor(levelFromFfmi(user) || 'beginner');

/** User fields the functions above need. */
const LEVEL_FIELDS = 'height weight bodyFat sex';

module.exports = { ffmiOf, levelFromFfmi, secondaryWeightFor, userSecondaryWeight, LEVEL_FIELDS, DEDUCTION };
