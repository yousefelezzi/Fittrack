/**
 * Nutrition values the routes, controllers, models and meal planner must agree
 * on. The web client keeps its own copy in client-web/src/constants/nutrition.js
 * (the Docker builds can't reach the repo-level shared/ folder).
 */

const MACRO_KEYS = ['calories', 'protein', 'carbs', 'fat'];

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];

const DIETS = ['any', 'pescatarian', 'vegetarian', 'vegan'];

module.exports = { MACRO_KEYS, MEAL_TYPES, DIETS };
