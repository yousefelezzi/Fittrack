/**
 * Ranks exercises by how well they could replace a given one, from the muscle
 * units they train (sub-regions included, e.g. "triceps › Long head").
 *
 *   score = overlap of all units (Jaccard, 0–1)
 *         + 0.5 if they share their main muscle (first tag)
 *         + 0.1 same equipment, + 0.05 same laterality (small tie-breakers)
 *
 * Only exercises that share the main muscle or at least a third of their units
 * are suggested, and strength/cardio never mix.
 */
const { unitsForTags } = require('./muscleGroups');

function similarExercises(target, candidates, { limit = 8, equipment } = {}) {
  const units = unitsForTags(target.muscleGroups);
  const primary = unitsForTags((target.muscleGroups || []).slice(0, 1));
  const allowed = equipment?.length ? new Set(equipment) : null;

  // Nothing to compare on (e.g. cardio with no muscles): same category, same equipment first.
  if (units.size === 0) {
    return candidates
      .filter((ex) => String(ex._id) !== String(target._id) && (ex.category || 'strength') === (target.category || 'strength'))
      .filter((ex) => !allowed || allowed.has(ex.equipment))
      .sort((a, b) => Number(b.equipment === target.equipment) - Number(a.equipment === target.equipment) || a.name.localeCompare(b.name))
      .slice(0, limit)
      .map((ex) => ({ _id: ex._id, name: ex.name, muscleGroups: ex.muscleGroups, equipment: ex.equipment,
        laterality: ex.laterality, category: ex.category, isCustom: !!ex.isCustom, images: ex.images || [], match: null, shared: [] }));
  }

  return candidates
    .filter((ex) => String(ex._id) !== String(target._id))
    .filter((ex) => (ex.category || 'strength') === (target.category || 'strength'))
    .filter((ex) => !allowed || allowed.has(ex.equipment))
    .map((ex) => {
      const u = unitsForTags(ex.muscleGroups);
      const shared = [...u].filter((x) => units.has(x));
      const union = new Set([...u, ...units]).size || 1;
      const jaccard = shared.length / union;
      const samePrimary = [...unitsForTags((ex.muscleGroups || []).slice(0, 1))].some((x) => primary.has(x));
      const score = jaccard + (samePrimary ? 0.5 : 0)
        + (ex.equipment === target.equipment ? 0.1 : 0)
        + ((ex.laterality || 'bilateral') === (target.laterality || 'bilateral') ? 0.05 : 0);
      return { ex, score, jaccard, samePrimary, shared };
    })
    .filter((r) => r.samePrimary || r.jaccard >= 1 / 3)
    .sort((a, b) => b.score - a.score || a.ex.name.localeCompare(b.ex.name))
    .slice(0, limit)
    .map(({ ex, score, shared }) => ({
      _id: ex._id, name: ex.name, muscleGroups: ex.muscleGroups, equipment: ex.equipment,
      laterality: ex.laterality, category: ex.category, isCustom: !!ex.isCustom, images: ex.images || [],
      match: Math.round(Math.min(1, score / 1.65) * 100), // % of a perfect match
      shared,
    }));
}

module.exports = { similarExercises };
