/**
 * Meal plan generator.
 *
 * For each day: choose foods for every meal from its template, size the
 * portions so the day hits its calorie and macro targets, then total it up.
 * Daily targets come from nutritionTargets() (utils/nutritionTargets.js).
 */
const { MEAL_LAYOUTS, MEAL_TEMPLATES, DIET_EXCLUSIONS } = require('./catalog');
const { createFoodSelector } = require('./foodSelector');
const { createRandom } = require('./random');
const { solvePortions } = require('./portionSolver');
const { nutrientsIn, sumNutrients, roundForDisplay } = require('./nutrition');
const { MACRO_KEYS } = require('../nutritionConstants');

const DEFAULT_MEALS_PER_DAY = 4;
const DEFAULT_DIET = 'any';
const MAX_DAYS = 7;
// Sizing passes per day. Each pass after the first spreads what the day
// missed (a snack that can't reach its protein, say) over all the meals.
const BALANCING_PASSES = 2;
// The meal's protein food (meat, fish, eggs, yogurt, tofu…) supplies at least
// this share of the meal's protein. Without it the sizing could hit protein
// with a huge grain portion and a token bit of meat, since grains have protein too.
const PROTEIN_ROLES = new Set(['breakfastProtein', 'mainProtein', 'snackProtein']);
const PROTEIN_FOOD_SHARE = 0.6;
// Small-portion foods (oils, nuts: max ≤ 40 g) are left out under 10 g.
const SMALL_PORTION_MAX = 40;
const SMALL_PORTION_LEAST = 10;

/**
 * @param foodsByName Map name → food document (built-in foods)
 * @param targets     { calories, protein, carbs, fat } per day
 * @param options     { mealsPerDay: 3|4|5, diet, days: 1–7, seed, exclude: [food names] }
 * @returns { days: [{ day, meals: [{ mealType, foods, totals }], totals }], targets, mealsPerDay, diet }
 */
function generateMealPlan(foodsByName, targets, options = {}) {
  const { mealsPerDay, diet, days, seed, exclude } = normalizeOptions(options);
  const selector = createFoodSelector({ foodsByName, diet, exclude, random: createRandom(seed) });

  const plannedDays = [];
  for (let day = 1; day <= days; day++) {
    const meals = chooseDayFoods(MEAL_LAYOUTS[mealsPerDay], selector);
    plannedDays.push({ day, ...summarizeDay(sizeDay(meals, targets)) });
  }
  return { days: plannedDays, targets, mealsPerDay, diet };
}

// Missing or unknown options fall back to defaults.
function normalizeOptions({ mealsPerDay, diet, days, seed, exclude }) {
  return {
    mealsPerDay: Object.hasOwn(MEAL_LAYOUTS, mealsPerDay) ? Number(mealsPerDay) : DEFAULT_MEALS_PER_DAY,
    diet: Object.hasOwn(DIET_EXCLUSIONS, diet) ? diet : DEFAULT_DIET,
    days: Math.min(MAX_DAYS, Math.max(1, Math.round(Number(days) || 1))),
    seed,
    exclude: exclude || [],
  };
}

// ── Choosing foods ───────────────────────────────────────────────────────────

// [{ mealType, share, items }] with fixed foods at their typical amount and the rest at 0 g.
function chooseDayFoods(layout, selector) {
  return layout.map(({ mealType, share }) => ({ mealType, share, items: chooseMealFoods(MEAL_TEMPLATES[mealType], selector) }));
}

function chooseMealFoods(template, selector) {
  const chosenByRole = {};
  const items = [];
  for (const { role, sizing, matchFlavourOf } of template) {
    const flavour = matchFlavourOf ? chosenByRole[matchFlavourOf]?.flavour : undefined;
    const choice = selector.pick(role, flavour);
    if (!choice) continue; // nothing allowed for this part: the meal goes without it
    const item = { ...choice, role, sizing, grams: sizing === 'fixed' ? typicalAmount(choice) : 0 };
    chosenByRole[role] = item;
    items.push(item);
  }
  return items;
}

// Halfway between the food's limits, on its step.
function typicalAmount({ min, max, step }) {
  const middle = Math.round((min + max) / 2 / step) * step;
  return Math.min(max, Math.max(min, middle));
}

// ── Sizing portions ──────────────────────────────────────────────────────────

// [{ mealType, items }] with every item's grams set.
function sizeDay(meals, dailyTargets) {
  let shortfall = zeroNutrients();
  let sized;
  for (let pass = 0; pass < BALANCING_PASSES; pass++) {
    sized = meals.map((meal) => ({
      mealType: meal.mealType,
      items: sizeMeal(meal.items, mealTarget(dailyTargets, shortfall, meal.share), dailyTargets.protein * meal.share),
    }));
    const reached = sumNutrients(sized.map((meal) => sumNutrients(meal.items.map(itemNutrients))));
    shortfall = Object.fromEntries(MACRO_KEYS.map((key) => [key, shortfall[key] + (dailyTargets[key] - reached[key])]));
  }
  return sized;
}

// The meal's share of the day's targets plus its share of what the day is still short.
function mealTarget(dailyTargets, shortfall, share) {
  return Object.fromEntries(MACRO_KEYS.map((key) => [key, Math.max(0, dailyTargets[key] * share + shortfall[key] * share)]));
}

// `mealProtein` is the meal's share of the day's protein goal. It sizes the
// protein food and stays the same across balancing passes, which only adjust
// the sides (so an over-target day trims grains, not the meat).
function sizeMeal(items, target, mealProtein) {
  return solvePortions(anchorProtein(items, mealProtein), target).filter(isWorthListing);
}

// Raise the protein food's minimum so it covers PROTEIN_FOOD_SHARE of the
// meal's protein (never past its own maximum).
function anchorProtein(items, mealProtein) {
  return items.map((item) => {
    const per100 = item.food.per100g.protein || 0;
    if (!PROTEIN_ROLES.has(item.role) || item.sizing !== 'solve' || per100 <= 0) return item;
    const needed = Math.ceil((PROTEIN_FOOD_SHARE * mealProtein * 100) / per100 / item.step) * item.step;
    return { ...item, min: Math.min(item.max, Math.max(item.min, needed)) };
  });
}

// A sprinkle of nuts or a teaspoon of oil isn't worth listing.
function isWorthListing({ grams, min, max }) {
  const least = max <= SMALL_PORTION_MAX ? SMALL_PORTION_LEAST : 1;
  return grams >= Math.max(min, least);
}

const itemNutrients = (item) => nutrientsIn(item.food.per100g, item.grams);
const zeroNutrients = () => Object.fromEntries(MACRO_KEYS.map((key) => [key, 0]));

// ── Output ───────────────────────────────────────────────────────────────────

function summarizeDay(sizedMeals) {
  const meals = sizedMeals.map(({ mealType, items }) => {
    const foods = items.map(toPlannedFood);
    return { mealType, foods, totals: sumNutrients(foods) };
  });
  return { meals, totals: roundForDisplay(sumNutrients(meals.map((meal) => meal.totals))) };
}

// What the client gets for each food: enough to show it and to add it to the log.
function toPlannedFood({ food, grams }) {
  return {
    food: { _id: food._id, name: food.name, servings: food.servings || [] },
    grams,
    ...roundForDisplay(nutrientsIn(food.per100g, grams)),
  };
}

module.exports = { generateMealPlan };
