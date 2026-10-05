const { MACRO_KEYS } = require('../nutritionConstants');

/** Nutrients in `grams` of a food, from its per-100 g values. */
function nutrientsIn(per100g = {}, grams, keys = MACRO_KEYS) {
  return Object.fromEntries(keys.map((key) => [key, (per100g[key] || 0) * (grams / 100)]));
}

/** Add up a list of nutrient objects. */
function sumNutrients(list, keys = MACRO_KEYS) {
  return Object.fromEntries(keys.map((key) => [key, list.reduce((total, n) => total + n[key], 0)]));
}

/** Whole calories, macros to 0.1 g: how plans show nutrition. */
function roundForDisplay({ calories, protein, carbs, fat }) {
  const tenth = (n) => Math.round(n * 10) / 10;
  return { calories: Math.round(calories), protein: tenth(protein), carbs: tenth(carbs), fat: tenth(fat) };
}

module.exports = { nutrientsIn, sumNutrients, roundForDisplay };
