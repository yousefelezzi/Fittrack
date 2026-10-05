/**
 * Portion sizing for one meal.
 *
 * Fixed foods (vegetables, fruit) keep their amount. The other foods' amounts
 * are chosen so protein, carbs, fat and calories land as close as possible to
 * the meal's target: least squares, weighted so a gram of fat counts for more
 * than a gram of carbs, with every amount kept within its food's min and max.
 *
 * At the best answer each amount is at its min, at its max, or somewhere in
 * between ("free"). With at most 3 foods to size, every combination of those
 * is tried: free amounts are found by least squares, combinations that break a
 * limit are dropped, and the closest one wins. That makes the answer exact.
 */
const { solveLinearSystem } = require('./linearSystem');
const { nutrientsIn } = require('./nutrition');

// Calories too, since food labels don't add up exactly to 4/4/9 kcal per gram.
const FIT_KEYS = ['protein', 'carbs', 'fat', 'calories'];
// Roughly kcal per gram; protein a little higher as it's the number people most want to hit.
const FIT_WEIGHTS = { protein: 6, carbs: 4, fat: 9, calories: 0.5 };
// Least-squares amounts this close to a limit count as within it.
const LIMIT_TOLERANCE = 1e-6;
const BOUNDS = ['min', 'max', 'free'];

/**
 * @param items  [{ food, min, max, step, sizing: 'solve'|'fixed', grams }]
 * @param target { calories, protein, carbs, fat } for the meal
 * @returns the same items as new objects, each with `grams` set and rounded to its step
 */
function solvePortions(items, target) {
  const fixedItems = items.filter((item) => item.sizing === 'fixed');
  const solvedItems = items.filter((item) => item.sizing === 'solve');
  const amounts = bestAmounts(solvedItems, remainingAfter(fixedItems, target));

  return items.map((item) => {
    const index = solvedItems.indexOf(item);
    const grams = index >= 0 && amounts ? amounts[index] : item.grams;
    return { ...item, grams: roundToStep(grams, item) };
  });
}

// The target minus what the fixed foods already provide.
function remainingAfter(fixedItems, target) {
  const remaining = { ...target };
  for (const item of fixedItems) {
    const provided = nutrientsIn(item.food.per100g, item.grams, FIT_KEYS);
    for (const key of FIT_KEYS) remaining[key] -= provided[key];
  }
  return remaining;
}

// How much one gram of the item moves the weighted fit for `key`.
const weightedPerGram = (item, key) => (item.food.per100g[key] || 0) / 100 * FIT_WEIGHTS[key];

// The amounts (grams, in item order) with the smallest fit error, or null if none fit the limits.
function bestAmounts(items, remaining) {
  let best = null;
  for (const bounds of boundCombinations(items.length)) {
    const amounts = amountsFor(items, bounds, remaining);
    if (!amounts) continue;
    const error = fitError(items, amounts, remaining);
    if (!best || error < best.error) best = { error, amounts };
  }
  return best && best.amounts;
}

// Every way to give each of `count` items a bound, the first item changing fastest.
function* boundCombinations(count) {
  if (count === 0) {
    yield [];
    return;
  }
  for (const last of BOUNDS) {
    for (const rest of boundCombinations(count - 1)) yield [...rest, last];
  }
}

// Amounts for one combination of bounds, or null if the free amounts break a limit.
function amountsFor(items, bounds, remaining) {
  const amounts = items.map((item, i) => (bounds[i] === 'min' ? item.min : bounds[i] === 'max' ? item.max : 0));
  const free = bounds.flatMap((bound, i) => (bound === 'free' ? [i] : []));
  if (!free.length) return amounts;

  const { matrix, rhs } = normalEquations(items, amounts, free, remaining);
  const solution = solveLinearSystem(matrix, rhs);
  if (!solution) return null;

  for (const [f, i] of free.entries()) {
    const grams = solution[f];
    if (grams < items[i].min - LIMIT_TOLERANCE || grams > items[i].max + LIMIT_TOLERANCE) return null;
    amounts[i] = grams;
  }
  return amounts;
}

// Least-squares equations for the free amounts, with the other amounts held where they are.
function normalEquations(items, amounts, free, remaining) {
  const isFree = (i) => free.includes(i);
  const matrix = free.map((i) => free.map((j) => {
    let sum = 0;
    for (const key of FIT_KEYS) sum += weightedPerGram(items[i], key) * weightedPerGram(items[j], key);
    return sum;
  }));
  const rhs = free.map((i) => {
    let sum = 0;
    for (const key of FIT_KEYS) {
      let heldFixed = 0;
      items.forEach((item, j) => { if (!isFree(j)) heldFixed += weightedPerGram(item, key) * amounts[j]; });
      sum += weightedPerGram(items[i], key) * (remaining[key] * FIT_WEIGHTS[key] - heldFixed);
    }
    return sum;
  });
  return { matrix, rhs };
}

// Sum of squared, weighted misses across FIT_KEYS.
function fitError(items, amounts, remaining) {
  let error = 0;
  for (const key of FIT_KEYS) {
    let reached = 0;
    items.forEach((item, i) => { reached += weightedPerGram(item, key) * amounts[i]; });
    const miss = reached - remaining[key] * FIT_WEIGHTS[key];
    error += miss * miss;
  }
  return error;
}

// Practical amounts: whole eggs, 5 g steps, never outside the food's limits.
function roundToStep(grams, { min, max, step }) {
  const rounded = Math.round(grams / step) * step;
  return Math.min(max, Math.max(min, rounded));
}

module.exports = { solvePortions };
