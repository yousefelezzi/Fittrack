const { ROLES, DIET_EXCLUSIONS, PLANT_DIETS } = require('./catalog');

/**
 * Picks foods for meal parts: only foods the diet allows and the user hasn't
 * excluded, chosen at random but rotated so a food doesn't come back until the
 * others in its role have had a turn. The rotation carries across meals and days.
 *
 * Picked foods are the catalog entry plus `food`, the database document.
 */
function createFoodSelector({ foodsByName, diet, exclude = [], random }) {
  const excludedTags = new Set(DIET_EXCLUSIONS[diet]);
  const excludedNames = new Set(exclude);
  const isPlantDiet = PLANT_DIETS.has(diet);
  const recentlyUsed = new Map(); // role → food names, oldest first

  const isAvailable = (entry) => foodsByName.has(entry.name) && !excludedNames.has(entry.name);
  const suitsDiet = (entry) => !entry.dietTags.some((tag) => excludedTags.has(tag));
  const matchesFlavour = (entry, flavour) => !flavour || !entry.flavour || entry.flavour === flavour;

  /** The foods that can fill `role`, optionally only those of `flavour`. */
  function allowedFoods(role, flavour) {
    const allowed = ROLES[role].filter((entry) => isAvailable(entry) && suitsDiet(entry) && matchesFlavour(entry, flavour));
    const preferred = isPlantDiet ? allowed : allowed.filter((entry) => !entry.plantOnly);
    const choices = preferred.length ? preferred : allowed;
    return choices.map((entry) => ({ ...entry, food: foodsByName.get(entry.name) }));
  }

  /** One food for `role`, or null when nothing is allowed. */
  function pick(role, flavour) {
    const choices = allowedFoods(role, flavour);
    if (!choices.length) return null;

    const recent = recentlyUsed.get(role) || [];
    const unused = choices.filter((choice) => !recent.includes(choice.name));
    const pool = unused.length ? unused : choices;
    const choice = pool[Math.floor(random() * pool.length)];

    const historyLength = Math.max(1, choices.length - 1);
    recentlyUsed.set(role, [...recent, choice.name].slice(-historyLength));
    return choice;
  }

  return { allowedFoods, pick };
}

module.exports = { createFoodSelector };
