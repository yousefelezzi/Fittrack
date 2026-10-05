const test = require('node:test');
const assert = require('node:assert');
const { foods } = require('../seed/foods.data');
const { MEAL_TYPES, DIETS } = require('../utils/nutritionConstants');
const { ROLES, DIET_EXCLUSIONS, MEAL_LAYOUTS, MEAL_TEMPLATES, catalogFoodNames } = require('../utils/mealPlan/catalog');
const { solveLinearSystem } = require('../utils/mealPlan/linearSystem');
const { nutrientsIn, sumNutrients } = require('../utils/mealPlan/nutrition');
const { solvePortions } = require('../utils/mealPlan/portionSolver');
const { createFoodSelector } = require('../utils/mealPlan/foodSelector');
const { createRandom } = require('../utils/mealPlan/random');
const { generateMealPlan } = require('../utils/mealPlan');

const foodsByName = new Map(foods.map((f) => [f.name, f]));
const selectorFor = (diet, exclude) => createFoodSelector({ foodsByName, diet, exclude, random: createRandom(1) });

test('catalog: every food exists in the food data', () => {
  const missing = catalogFoodNames().filter((name) => !foodsByName.has(name));
  assert.deepStrictEqual(missing, []);
});

test('catalog: templates, layouts and diets agree with each other and the constants', () => {
  for (const template of Object.values(MEAL_TEMPLATES)) {
    for (const slot of template) {
      assert.ok(ROLES[slot.role], `unknown role ${slot.role}`);
      assert.ok(['solve', 'fixed'].includes(slot.sizing), `bad sizing ${slot.sizing}`);
      if (slot.matchFlavourOf) assert.ok(template.some((s) => s.role === slot.matchFlavourOf));
    }
  }
  for (const layout of Object.values(MEAL_LAYOUTS)) {
    for (const { mealType } of layout) {
      assert.ok(MEAL_TYPES.includes(mealType));
      assert.ok(MEAL_TEMPLATES[mealType]);
    }
    const shares = layout.reduce((total, meal) => total + meal.share, 0);
    assert.ok(Math.abs(shares - 1) < 1e-9, 'meal shares add up to the whole day');
  }
  assert.deepStrictEqual(Object.keys(DIET_EXCLUSIONS), DIETS);
});

test('solveLinearSystem solves a system and rejects a singular one', () => {
  assert.deepStrictEqual(solveLinearSystem([[2, 1], [1, 3]], [5, 10]), [1, 3]);
  assert.strictEqual(solveLinearSystem([[1, 2], [2, 4]], [3, 6]), null);
});

test('nutrientsIn scales per-100 g values and sumNutrients adds them up', () => {
  const half = nutrientsIn({ calories: 200, protein: 10, carbs: 30 }, 50);
  assert.deepStrictEqual(half, { calories: 100, protein: 5, carbs: 15, fat: 0 });
  assert.deepStrictEqual(sumNutrients([half, half]), { calories: 200, protein: 10, carbs: 30, fat: 0 });
});

test('solvePortions keeps fixed amounts, respects limits and leaves its input alone', () => {
  const item = (name, sizing, limits) => ({ name, food: foodsByName.get(name), sizing, grams: 0, step: 5, ...limits });
  const items = [
    item('Chicken Breast, cooked', 'solve', { min: 60, max: 300 }),
    item('White Rice, cooked', 'solve', { min: 80, max: 500 }),
    { ...item('Broccoli, raw', 'fixed', { min: 100, max: 200, step: 25 }), grams: 150 },
    item('Olive Oil', 'solve', { min: 0, max: 25 }),
  ];
  const before = JSON.stringify(items);
  const sized = solvePortions(items, { calories: 700, protein: 55, carbs: 75, fat: 20 });

  assert.strictEqual(JSON.stringify(items), before);
  assert.strictEqual(sized[2].grams, 150);
  for (const s of sized) {
    assert.ok(s.grams >= s.min && s.grams <= s.max, `${s.name} within limits`);
    assert.strictEqual(s.grams % s.step, 0, `${s.name} on its step`);
  }
  // Each macro within 10% of the target.
  const totals = sumNutrients(sized.map((s) => nutrientsIn(s.food.per100g, s.grams)));
  assert.ok(Math.abs(totals.protein - 55) / 55 < 0.1, `protein ${totals.protein}`);
  assert.ok(Math.abs(totals.calories - 700) / 700 < 0.1, `calories ${totals.calories}`);
});

test('food selector: diets and exclusions rule foods out', () => {
  const vegan = selectorFor('vegan');
  for (const role of Object.keys(ROLES)) {
    for (const choice of vegan.allowedFoods(role)) {
      assert.deepStrictEqual(choice.dietTags.filter((t) => DIET_EXCLUSIONS.vegan.includes(t)), []);
    }
  }
  const noChicken = selectorFor('any', ['Chicken Breast, cooked']);
  assert.ok(!noChicken.allowedFoods('mainProtein').some((c) => c.name === 'Chicken Breast, cooked'));
});

test('food selector: plant proteins are for plant diets unless nothing else is left', () => {
  assert.ok(!selectorFor('any').allowedFoods('mainProtein').some((c) => c.plantOnly));
  assert.ok(selectorFor('vegetarian').allowedFoods('mainProtein').some((c) => c.plantOnly));
  const noMeatOrFish = ROLES.mainProtein.filter((e) => !e.plantOnly).map((e) => e.name);
  assert.ok(selectorFor('pescatarian', noMeatOrFish).allowedFoods('mainProtein').every((c) => c.plantOnly));
});

test('food selector: a food does not come back until the others have had a turn', () => {
  const selector = selectorFor('any');
  const count = selector.allowedFoods('mainCarb').length;
  const names = Array.from({ length: count }, () => selector.pick('mainCarb').name);
  assert.strictEqual(new Set(names).size, count);
});

test('generateMealPlan: snack sides match the snack protein and the seed is repeatable', () => {
  const targets = { calories: 2400, protein: 180, carbs: 260, fat: 70 };
  const plan = generateMealPlan(foodsByName, targets, { mealsPerDay: 5, days: 7, seed: 3 });
  const flavourOf = (role, name) => ROLES[role].find((e) => e.name === name)?.flavour;
  for (const day of plan.days) {
    for (const meal of day.meals.filter((m) => m.mealType === 'snack')) {
      const [protein, side] = meal.foods.map((f) => f.food.name);
      const sideFlavour = flavourOf('snackCarb', side);
      if (sideFlavour) assert.strictEqual(sideFlavour, flavourOf('snackProtein', protein), `${protein} with ${side}`);
    }
  }
  assert.deepStrictEqual(generateMealPlan(foodsByName, targets, { mealsPerDay: 5, days: 7, seed: 3 }), plan);
});

test('generateMealPlan: the protein food carries the meal, not a big side of grains', () => {
  // Regression: a meal could reach its protein with ~450 g of quinoa and 60 g of pork.
  const proteinRoles = ['breakfastProtein', 'mainProtein', 'snackProtein'];
  const entries = new Map(proteinRoles.flatMap((role) => ROLES[role].map((e) => [e.name, e])));
  const MEAT_OR_FISH = /Chicken|Turkey|Beef|Steak|Pork|Salmon|Tuna|Cod|Shrimp/;
  for (const targets of [{ calories: 2000, protein: 160, carbs: 200, fat: 60 }, { calories: 3030, protein: 144, carbs: 425, fat: 84 }]) {
    for (const diet of ['any', 'pescatarian']) {
      for (const mealsPerDay of [3, 4, 5]) {
        const plan = generateMealPlan(foodsByName, targets, { mealsPerDay, diet, days: 2, seed: 5 });
        for (const day of plan.days) {
          const layout = MEAL_LAYOUTS[mealsPerDay];
          day.meals.forEach((meal, i) => {
            const protein = meal.foods.find((f) => entries.has(f.food.name));
            if (!protein) return;
            const entry = entries.get(protein.food.name);
            if (MEAT_OR_FISH.test(protein.food.name)) assert.ok(protein.grams >= 100, `${protein.grams} g ${protein.food.name}`);
            if (/Eggs, whole/.test(protein.food.name)) assert.ok(protein.grams >= 100, 'at least 2 eggs');
            // At least 60% of the meal's share of the day's protein (rounding can land just under),
            // unless the food is already at its maximum.
            const share = protein.protein / (targets.protein * layout[i].share);
            assert.ok(share >= 0.58 || protein.grams >= entry.max, `${meal.mealType}: ${protein.food.name} gives ${(share * 100).toFixed(0)}%`);
          });
        }
      }
    }
  }
});
