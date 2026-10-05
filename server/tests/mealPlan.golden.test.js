/**
 * Characterisation test: the meal planner must give exactly the same plans as
 * the recorded fixture. Run with UPDATE_GOLDEN=1 to re-record it after an
 * intended change to the planner's output.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { foods } = require('../seed/foods.data');
const { generateMealPlan } = require('../utils/mealPlan');

const FIXTURE = path.join(__dirname, 'fixtures', 'mealPlan.golden.json');

const TARGETS = [
  { calories: 1600, protein: 130, carbs: 150, fat: 50 },
  { calories: 2400, protein: 180, carbs: 260, fat: 70 },
  { calories: 3400, protein: 200, carbs: 420, fat: 100 },
];

function cases() {
  const list = [];
  for (const targets of TARGETS) {
    for (const mealsPerDay of [3, 4, 5]) {
      for (const diet of ['any', 'pescatarian', 'vegetarian', 'vegan']) {
        for (const seed of [1, 424242]) list.push({ targets, opts: { mealsPerDay, diet, days: 2, seed } });
      }
    }
  }
  list.push({ targets: TARGETS[1], opts: { days: 7, seed: 99 } });
  list.push({ targets: TARGETS[1], opts: {} });
  list.push({ targets: TARGETS[1], opts: { mealsPerDay: 5, seed: 7, exclude: ['Chicken Breast, cooked', 'Banana', 'Olive Oil'] } });
  return list;
}

// Every value the client sees, in a compact form so the fixture stays small.
function summarize(plan) {
  return {
    mealsPerDay: plan.mealsPerDay,
    diet: plan.diet,
    targets: plan.targets,
    days: plan.days.map((day) => ({
      day: day.day,
      totals: day.totals,
      meals: day.meals.map((meal) => ({
        mealType: meal.mealType,
        totals: meal.totals,
        foods: meal.foods.map((f) => [f.food.name, f.food.servings.length, f.grams, f.calories, f.protein, f.carbs, f.fat]),
      })),
    })),
  };
}

function run() {
  const foodsByName = new Map(foods.map((f) => [f.name, f]));
  return cases().map(({ targets, opts }) => ({ opts, plan: summarize(generateMealPlan(foodsByName, targets, opts)) }));
}

test('meal plans match the recorded fixture', () => {
  const actual = run();
  if (process.env.UPDATE_GOLDEN) {
    fs.writeFileSync(FIXTURE, JSON.stringify(actual));
    return;
  }
  const expected = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
  assert.strictEqual(actual.length, expected.length);
  actual.forEach((got, i) => assert.deepStrictEqual(got, expected[i], `case ${i}: ${JSON.stringify(got.opts)}`));
});
