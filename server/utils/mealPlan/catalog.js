/**
 * What meal plans are made of: which foods can fill each part of a meal, which
 * diets rule which foods out, how a day is split into meals and what each meal
 * contains. Data only; the planner reads it.
 */

// One food a meal part can use. `name` must match a built-in food
// (seed/foods.data.js). min/max are sensible amounts in grams, rounded to `step`.
//   dietTags   what a diet can rule out ('meat', 'fish', 'dairy', 'egg')
//   plantOnly  a main protein offered only on vegetarian/vegan plans, unless nothing else is left
//   flavour    'sweet' or 'savory': snack sides are matched to the snack protein's flavour
const entry = (name, limits = {}) => ({ name, min: 0, max: 300, step: 5, dietTags: [], ...limits });
const MEAT = ['meat'];
const FISH = ['fish'];
const DAIRY = ['dairy'];
const EGG = ['egg'];

// Each meal part (role) and the foods it can use.
const ROLES = {
  breakfastProtein: [
    entry('Eggs, whole, large', { min: 100, max: 200, step: 50, dietTags: EGG }), // 2–4 eggs
    entry('Greek Yogurt, plain, 0% fat', { min: 100, max: 400, step: 25, dietTags: DAIRY }),
    entry('Greek Yogurt, plain, 2% fat', { min: 100, max: 400, step: 25, dietTags: DAIRY }),
    entry('Cottage Cheese, 1% fat', { min: 100, max: 350, step: 25, dietTags: DAIRY }),
    entry('Egg Whites', { min: 100, max: 300, step: 20, dietTags: EGG }),
    entry('Tofu, firm', { min: 100, max: 250, step: 25 }),
  ],
  breakfastCarb: [
    entry('Oats, dry', { min: 30, max: 150 }),
    entry('Bread, whole wheat', { min: 30, max: 160, step: 10 }),
    entry('Sourdough Bread', { min: 40, max: 160, step: 10 }),
    entry('English Muffin', { min: 55, max: 115, step: 5 }),
  ],
  fruit: [
    entry('Banana', { min: 80, max: 150 }),
    entry('Blueberries', { min: 75, max: 150 }),
    entry('Strawberries', { min: 100, max: 200 }),
    entry('Apple', { min: 100, max: 200 }),
    entry('Orange', { min: 100, max: 200 }),
  ],
  breakfastFat: [
    entry('Peanut Butter', { max: 32 }),
    entry('Almond Butter', { max: 32 }),
    entry('Almonds', { max: 35 }),
    entry('Chia Seeds', { max: 30 }),
  ],
  mainProtein: [
    // A real portion of meat or fish starts around 100 g.
    entry('Chicken Breast, cooked', { min: 100, max: 300, dietTags: MEAT }),
    entry('Turkey Breast, cooked', { min: 100, max: 300, dietTags: MEAT }),
    entry('Ground Beef, 90/10, cooked', { min: 100, max: 250, dietTags: MEAT }),
    entry('Sirloin Steak, cooked', { min: 100, max: 250, dietTags: MEAT }),
    entry('Pork Tenderloin, cooked', { min: 100, max: 250, dietTags: MEAT }),
    entry('Salmon, Atlantic, cooked', { min: 100, max: 250, dietTags: FISH }),
    entry('Tuna, canned in water', { min: 100, max: 250, dietTags: FISH }),
    entry('Cod, cooked', { min: 100, max: 300, dietTags: FISH }),
    entry('Shrimp, cooked', { min: 100, max: 300, dietTags: FISH }),
    entry('Tofu, firm', { min: 100, max: 350, step: 25, plantOnly: true }),
    entry('Tempeh', { min: 80, max: 250, plantOnly: true }),
    entry('Seitan', { min: 80, max: 200, plantOnly: true }),
    entry('Lentils, cooked', { min: 150, max: 350, plantOnly: true }),
  ],
  mainCarb: [
    entry('White Rice, cooked', { min: 80, max: 500 }),
    entry('Brown Rice, cooked', { min: 80, max: 500 }),
    entry('Pasta, cooked', { min: 80, max: 450 }),
    entry('Whole Wheat Pasta, cooked', { min: 80, max: 450 }),
    entry('Quinoa, cooked', { min: 80, max: 450 }),
    entry('Sweet Potato, cooked', { min: 100, max: 550 }),
    entry('White Potato, baked', { min: 100, max: 550 }),
    entry('Couscous, cooked', { min: 80, max: 450 }),
  ],
  vegetables: [
    entry('Broccoli, raw', { min: 100, max: 200, step: 25 }),
    entry('Green Beans, raw', { min: 100, max: 200, step: 25 }),
    entry('Spinach, raw', { min: 60, max: 150, step: 10 }),
    entry('Bell Pepper, red', { min: 100, max: 200, step: 25 }),
    entry('Zucchini, raw', { min: 100, max: 250, step: 25 }),
    entry('Asparagus, raw', { min: 100, max: 200, step: 25 }),
    entry('Cauliflower, raw', { min: 100, max: 250, step: 25 }),
  ],
  mainFat: [
    entry('Olive Oil', { max: 25 }),
    entry('Avocado', { max: 150, step: 10 }),
  ],
  snackProtein: [
    entry('Greek Yogurt, plain, 2% fat', { min: 150, max: 300, step: 25, dietTags: DAIRY, flavour: 'sweet' }),
    entry('Cottage Cheese, 1% fat', { min: 150, max: 300, step: 25, dietTags: DAIRY, flavour: 'sweet' }),
    entry('Whey Protein Powder', { min: 25, max: 50, step: 5, dietTags: DAIRY, flavour: 'sweet' }),
    entry('Edamame, shelled', { min: 100, max: 250, step: 25, flavour: 'savory' }),
    entry('Hummus', { min: 50, max: 150, step: 10, flavour: 'savory' }),
  ],
  snackCarb: [
    entry('Banana', { min: 80, max: 150, flavour: 'sweet' }),
    entry('Apple', { min: 100, max: 200, flavour: 'sweet' }),
    entry('Blueberries', { min: 75, max: 150, flavour: 'sweet' }),
    entry('Rice Cakes', { min: 10, max: 40, flavour: 'savory' }),
    entry('Carrots, raw', { min: 80, max: 200, step: 10, flavour: 'savory' }),
  ],
  snackFat: [
    entry('Almonds', { max: 30 }),
    entry('Walnuts', { max: 30 }),
    entry('Peanut Butter', { max: 32 }),
  ],
};

// The dietTags each diet rules out. Keys match DIETS in utils/nutritionConstants.js.
const DIET_EXCLUSIONS = {
  any: [],
  pescatarian: ['meat'],
  vegetarian: ['meat', 'fish'],
  vegan: ['meat', 'fish', 'dairy', 'egg'],
};

// Diets where plant proteins are normal main-protein choices.
const PLANT_DIETS = new Set(['vegetarian', 'vegan']);

// How a day is split, by meals per day. `share` is the meal's part of the day's targets.
const MEAL_LAYOUTS = {
  3: [
    { mealType: 'breakfast', share: 0.3 },
    { mealType: 'lunch', share: 0.35 },
    { mealType: 'dinner', share: 0.35 },
  ],
  4: [
    { mealType: 'breakfast', share: 0.25 },
    { mealType: 'lunch', share: 0.3 },
    { mealType: 'snack', share: 0.15 },
    { mealType: 'dinner', share: 0.3 },
  ],
  5: [
    { mealType: 'breakfast', share: 0.22 },
    { mealType: 'snack', share: 0.12 },
    { mealType: 'lunch', share: 0.27 },
    { mealType: 'snack', share: 0.12 },
    { mealType: 'dinner', share: 0.27 },
  ],
};

// The parts of each meal, in the order they're chosen.
//   sizing 'solve'   the amount is worked out to hit the meal's macros
//   sizing 'fixed'   a set, typical amount (vegetables, fruit)
//   matchFlavourOf   only use foods with the same flavour as this earlier part
const MAIN_MEAL = [
  { role: 'mainProtein', sizing: 'solve' },
  { role: 'mainCarb', sizing: 'solve' },
  { role: 'vegetables', sizing: 'fixed' },
  { role: 'mainFat', sizing: 'solve' },
];
const MEAL_TEMPLATES = {
  breakfast: [
    { role: 'breakfastProtein', sizing: 'solve' },
    { role: 'breakfastCarb', sizing: 'solve' },
    { role: 'fruit', sizing: 'fixed' },
    { role: 'breakfastFat', sizing: 'solve' },
  ],
  lunch: MAIN_MEAL,
  dinner: MAIN_MEAL,
  snack: [
    { role: 'snackProtein', sizing: 'solve' },
    { role: 'snackCarb', sizing: 'solve', matchFlavourOf: 'snackProtein' },
    { role: 'snackFat', sizing: 'solve' },
  ],
};

/** Every food name the catalog uses, once each: what to load from the database. */
function catalogFoodNames() {
  const names = Object.values(ROLES).flat().map((food) => food.name);
  return [...new Set(names)];
}

module.exports = { ROLES, DIET_EXCLUSIONS, PLANT_DIETS, MEAL_LAYOUTS, MEAL_TEMPLATES, catalogFoodNames };
