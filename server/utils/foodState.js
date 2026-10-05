/**
 * Raw vs cooked conversions for a food document.
 * state: 'cooked' | 'uncooked' (raw or dry). Missing/invalid = as stored.
 */
const round = (n) => Math.round((n || 0) * 100) / 100;

const canConvert = (food) => food?.cookedYield > 0;

function resolveState(food, state) {
  if (!canConvert(food) || (state !== 'cooked' && state !== 'uncooked')) return food?.storedState || 'cooked';
  return state;
}

/** per100g values for the food in the given state. */
function per100gFor(food, state) {
  const stored = food.storedState || 'cooked';
  const want = resolveState(food, state);
  if (want === stored) return food.per100g;

  // raw = cooked × yield; cooked = raw ÷ yield
  const k = want === 'uncooked' ? food.cookedYield : 1 / food.cookedYield;
  const conv = (v) => round((v || 0) * k);
  const p = food.per100g || {};
  const macros = want === 'uncooked' && food.uncookedPer100g?.calories != null
    ? food.uncookedPer100g
    : { calories: conv(p.calories), protein: conv(p.protein), carbs: conv(p.carbs), fat: conv(p.fat) };
  return {
    ...macros,
    micros: Object.fromEntries(Object.entries(p.micros || {}).map(([key, v]) => [key, conv(v)])),
  };
}

/** Calories, macros and micros in `grams` of the food in `state`, to 2 decimals. */
function portionNutrition(food, state, grams) {
  const p = per100gFor(food, state);
  const k = grams / 100;
  return {
    calories: round(p.calories * k),
    protein: round(p.protein * k),
    carbs: round(p.carbs * k),
    fat: round(p.fat * k),
    micros: Object.fromEntries(Object.entries(p.micros || {}).map(([key, v]) => [key, round(v * k)])),
  };
}

/** Roughly what `grams` of the food in `state` weighs once cooked. */
function cookedGramsFor(food, state, grams) {
  return resolveState(food, state) === 'uncooked' && canConvert(food) ? grams * food.cookedYield : grams;
}

/** "Chicken Breast, cooked" logged raw → "Chicken Breast (raw)". Same as the web client. */
function nameInState(food, state) {
  const want = resolveState(food, state);
  if (want === (food.storedState || 'cooked')) return food.name;
  const label = want === 'uncooked' ? food.uncookedLabel || 'raw' : 'cooked';
  return `${food.name.replace(/,\s*(cooked|raw|dry|baked)$/i, '')} (${label})`;
}

module.exports = { per100gFor, portionNutrition, cookedGramsFor, resolveState, nameInState };
