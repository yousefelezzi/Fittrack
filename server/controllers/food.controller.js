const mongoose = require('mongoose');
const Food = require('../models/Food');
const { per100gFor, cookedGramsFor, resolveState } = require('../utils/foodState');

const round = (n) => Math.round((n || 0) * 100) / 100;

// All numeric micronutrient keys, kept in one place so summing/scaling a
// recipe's micros doesn't need to know the schema shape.
const MICRO_KEYS = [
  'vitaminA', 'vitaminC', 'vitaminD', 'vitaminE', 'vitaminK',
  'vitaminB1', 'vitaminB2', 'vitaminB3', 'vitaminB6', 'vitaminB12', 'folate',
  'calcium', 'iron', 'magnesium', 'phosphorus', 'potassium', 'sodium', 'zinc', 'selenium',
  'fiber', 'sugar', 'cholesterol', 'omega3',
];

// Given [{ foodId, grams }], look up each food already in the database and
// aggregate weighted totals, then re-express as per-100g so the resulting
// "recipe" food behaves like any other food everywhere else in the app.
async function buildRecipeNutrition(ingredients) {
  const ids = ingredients
    .map((i) => i.foodId)
    .filter((id) => mongoose.isValidObjectId(id)); // bad ids are skipped, not a server error

  const foods = await Food.find({ _id: { $in: ids } }).lean();
  const foodMap = new Map(foods.map((f) => [String(f._id), f]));

  let totalGrams = 0;
  const totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  const microTotals = {};
  const ingredientDocs = [];

  for (const ing of ingredients) {
    const f = foodMap.get(String(ing.foodId));
    const grams = Number(ing.grams);
    if (!f || !grams || grams <= 0) continue;

    // Raw vs cooked: use the values for the state the grams were weighed in, and
    // count the ingredient at its cooked weight for the finished-weight estimate.
    const state = resolveState(f, ing.state);
    const p = per100gFor(f, state);
    const cookedGrams = cookedGramsFor(f, state, grams);

    const factor = grams / 100;
    totals.calories += (p.calories || 0) * factor;
    totals.protein  += (p.protein  || 0) * factor;
    totals.carbs    += (p.carbs    || 0) * factor;
    totals.fat      += (p.fat      || 0) * factor;

    const m = p.micros || {};
    for (const key of MICRO_KEYS) {
      microTotals[key] = (microTotals[key] || 0) + (m[key] || 0) * factor;
    }

    // Default finished weight = what the ingredients weigh once cooked.
    totalGrams += cookedGrams;
    ingredientDocs.push({ food: f._id, name: f.name, grams, state });
  }

  if (totalGrams <= 0 || ingredientDocs.length === 0) {
    return null; // no valid ingredients — caller falls back to manual per100g
  }

  const scaleTo100 = 100 / totalGrams;
  const per100g = {
    calories: round(totals.calories * scaleTo100),
    protein:  round(totals.protein  * scaleTo100),
    carbs:    round(totals.carbs    * scaleTo100),
    fat:      round(totals.fat      * scaleTo100),
    micros: Object.fromEntries(
      MICRO_KEYS.map((key) => [key, round((microTotals[key] || 0) * scaleTo100)])
    ),
  };

  return {
    per100g, totalGrams, ingredientDocs,
    // Totals for the whole list of ingredients as given (used for logged recipe meals).
    totals: {
      calories: round(totals.calories), protein: round(totals.protein),
      carbs: round(totals.carbs), fat: round(totals.fat),
      micros: Object.fromEntries(MICRO_KEYS.map((key) => [key, round(microTotals[key] || 0)])),
    },
  };
}
exports.buildRecipeNutrition = buildRecipeNutrition;

/**
 * Works out a recipe's servings from the request body.
 *   totalWeight  - finished weight (g); defaults to the raw ingredients' total.
 *   servingGrams - weight of one serving; if set, the serving count follows from it.
 *   numServings  - otherwise, how many servings the recipe makes.
 *   servingName  - optional label, e.g. bowl -> "1 bowl".
 * Nutrients always come from the ingredients; a different finished weight only
 * changes how they're spread per 100 g.
 */
function recipeServings(recipe, body, fallback = {}) {
  const pick = (key) => (body[key] !== undefined ? body[key] : fallback[key]);

  const totalWeight = Number(pick('totalWeight')) > 0 ? Number(pick('totalWeight')) : null;
  const effTotal = totalWeight || recipe.totalGrams;

  const servingGrams = Number(pick('servingGrams')) > 0 ? Number(pick('servingGrams')) : null;
  const count = servingGrams
    ? effTotal / servingGrams
    : (Number(pick('numServings')) > 0 ? Number(pick('numServings')) : 1);
  const gramsPerServing = servingGrams || effTotal / count;

  const servingName = String(pick('servingName') || '').trim().slice(0, 30);
  const countText = Number.isInteger(count) ? String(count) : `~${Math.round(count * 10) / 10}`;
  const label = servingName ? `1 ${servingName}` : `1 serving (of ${countText})`;

  // Spread the ingredients' nutrients over the finished weight.
  const factor = recipe.totalGrams / effTotal;
  const per100g = factor === 1 ? recipe.per100g : {
    calories: round(recipe.per100g.calories * factor),
    protein:  round(recipe.per100g.protein  * factor),
    carbs:    round(recipe.per100g.carbs    * factor),
    fat:      round(recipe.per100g.fat      * factor),
    micros: Object.fromEntries(Object.entries(recipe.per100g.micros).map(([k, v]) => [k, round(v * factor)])),
  };

  return {
    per100g,
    servings: [
      { label, grams: round(gramsPerServing) },
      { label: 'Whole recipe', grams: round(effTotal) },
    ],
    fields: { numServings: round(count), totalWeight, servingGrams, servingName },
  };
}

/**
 * Optional raw/cooked info for a single custom food:
 *   storedState   'cooked' | 'uncooked' — which state the entered values describe
 *   uncookedLabel 'raw' | 'dry'
 *   cookedYield   grams cooked per gram raw/dry (e.g. 0.75 for chicken, 2.8 for rice)
 */
function cookingFields(body) {
  const y = Number(body.cookedYield);
  if (!(y >= 0.1 && y <= 10)) return {};
  return {
    cookedYield: round(y),
    storedState: body.storedState === 'uncooked' ? 'uncooked' : 'cooked',
    uncookedLabel: body.uncookedLabel === 'dry' ? 'dry' : 'raw',
  };
}

// GET /api/foods/search?q=chicken&limit=15
exports.search = async (req, res, next) => {
  try {
    const q     = (req.query.q || '').trim();
    const limit = Math.min(parseInt(req.query.limit) || 15, 30);

    if (!q) return res.json([]);

    // Try full-text index first (fast, ranked by relevance)
    let foods = await Food.find(
      { $text: { $search: q } },
      { score: { $meta: 'textScore' } }
    )
      .sort({ score: { $meta: 'textScore' } })
      .limit(limit)
      .lean();

    // Fall back to regex if text index returns nothing (e.g. partial words)
    if (foods.length === 0) {
      foods = await Food.find({
        name: { $regex: q, $options: 'i' },
      })
        .limit(limit)
        .lean();
    }

    res.json(foods);
  } catch (err) {
    next(err);
  }
};

// GET /api/foods/:id
// Populates ingredient references with their name + per100g so the client
// can recompute nutrition live while editing a recipe's ingredients.
exports.getById = async (req, res, next) => {
  try {
    const food = await Food.findById(req.params.id)
      .populate('ingredients.food', 'name per100g cookedYield uncookedLabel storedState uncookedPer100g')
      .lean();
    if (!food) return res.status(404).json({ message: 'Food not found' });
    res.json(food);
  } catch (err) {
    next(err);
  }
};

// POST /api/foods  (custom food created by a user)
//
// Two ways to create a custom food:
//   1. Manual: pass per100g directly (as before).
//   2. Recipe: pass `ingredients: [{ foodId, grams }]` — each foodId must be
//      an existing Food in the database. The server looks each one up,
//      combines their nutrition by weight, and stores the result as this
//      food's per100g, plus a snapshot of the ingredients used. Optionally
//      pass `numServings` (default 1) to also generate a "1 serving" entry
//      alongside the full-recipe weight.
exports.create = async (req, res, next) => {
  try {
    const { name, brand, per100g, servings, category, ingredients } = req.body;
    if (!name) return res.status(400).json({ message: 'Name is required' });

    let finalPer100g  = per100g  || {};
    // Keep only well-formed servings, e.g. { label: '1 bar', grams: 60 }.
    let finalServings = (Array.isArray(servings) ? servings : [])
      .filter((sv) => sv && String(sv.label || '').trim() && Number(sv.grams) > 0)
      .map((sv) => ({ label: String(sv.label).trim().slice(0, 40), grams: round(Number(sv.grams)) }));

    const isRecipe = Array.isArray(ingredients) && ingredients.length > 0;
    if (!isRecipe) {
      const macros = ['calories', 'protein', 'carbs', 'fat'].map((k) => finalPer100g[k] ?? 0);
      if (macros.some((v) => !Number.isFinite(Number(v)) || Number(v) < 0)) {
        return res.status(400).json({ message: 'Nutrition values must be 0 or more' });
      }
    }
    let ingredientDocs;
    let recipeFields;
    let finalCategory = category || 'custom';

    if (isRecipe) {
      const recipe = await buildRecipeNutrition(ingredients);
      if (!recipe) {
        return res.status(400).json({ message: 'No valid ingredients found for this recipe' });
      }

      const sv = recipeServings(recipe, req.body);
      finalPer100g = sv.per100g;
      ingredientDocs = recipe.ingredientDocs;
      finalCategory = category || 'recipe';
      finalServings = [...sv.servings, ...finalServings];
      recipeFields = sv.fields;
    }

    const food = await Food.create({
      name:     String(name).trim(),
      brand:    String(brand || '').trim(),
      per100g:  finalPer100g,
      servings: finalServings,
      category: finalCategory,
      source:   'custom',
      ...(ingredientDocs && { ingredients: ingredientDocs, ...recipeFields }),
      ...(!isRecipe && cookingFields(req.body)),
    });

    res.status(201).json(food);
  } catch (err) {
    next(err);
  }
};

// PUT /api/foods/:id  (edit an existing custom recipe's ingredients)
//
// Only foods with source: 'custom' can be edited — USDA-seeded foods are
// left alone. Re-runs the same ingredient aggregation as create(), so
// editing a recipe's ingredients keeps its per100g/servings consistent.
exports.update = async (req, res, next) => {
  try {
    const existing = await Food.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Food not found' });
    if (existing.source !== 'custom') {
      return res.status(403).json({ message: 'Only custom foods can be edited' });
    }

    const { name, ingredients } = req.body;
    const isRecipe = existing.ingredients?.length > 0;

    // Recipes are edited through their ingredients; single custom foods through
    // their label values. Neither can be edited the other way.
    if (isRecipe && req.body.per100g !== undefined) {
      return res.status(400).json({ message: 'Edit a recipe through its ingredients' });
    }
    if (!isRecipe && Array.isArray(ingredients) && ingredients.length > 0) {
      return res.status(400).json({ message: 'This food has no ingredients to edit' });
    }

    if (!isRecipe) {
      if (req.body.per100g !== undefined) {
        const p = req.body.per100g || {};
        const macros = ['calories', 'protein', 'carbs', 'fat'];
        if (macros.some((k) => !Number.isFinite(Number(p[k] ?? 0)) || Number(p[k] ?? 0) < 0)) {
          return res.status(400).json({ message: 'Nutrition values must be 0 or more' });
        }
        existing.per100g = {
          ...Object.fromEntries(macros.map((k) => [k, round(Number(p[k]) || 0)])),
          micros: { ...(existing.per100g?.micros?.toObject?.() ?? existing.per100g?.micros ?? {}), ...(p.micros || {}) },
        };
      }
      if (Array.isArray(req.body.servings)) {
        const servings = req.body.servings
          .filter((sv) => sv && String(sv.label || '').trim() && Number(sv.grams) > 0)
          .map((sv) => ({ label: String(sv.label).trim().slice(0, 40), grams: round(Number(sv.grams)) }));
        if (servings.length === 0) return res.status(400).json({ message: 'A serving size and weight are required' });
        existing.servings = servings;
      }
      if (req.body.brand !== undefined) existing.brand = String(req.body.brand || '').trim();
      // Raw/cooked: send cookedYield: null to turn it off.
      if (req.body.cookedYield === null) {
        existing.cookedYield = null; existing.storedState = 'cooked'; existing.uncookedLabel = null;
      } else if (req.body.cookedYield !== undefined) {
        Object.assign(existing, cookingFields(req.body));
      }
    }

    if (isRecipe && Array.isArray(ingredients) && ingredients.length > 0) {
      const recipe = await buildRecipeNutrition(ingredients);
      if (!recipe) {
        return res.status(400).json({ message: 'No valid ingredients found for this recipe' });
      }

      // Settings not sent in this request keep their saved values.
      const sv = recipeServings(recipe, req.body, {
        numServings: existing.numServings,
        totalWeight: existing.totalWeight,
        servingGrams: existing.servingGrams,
        servingName: existing.servingName,
      });
      existing.per100g     = sv.per100g;
      existing.ingredients = recipe.ingredientDocs;
      existing.servings    = sv.servings;
      Object.assign(existing, sv.fields);
    }

    if (name && String(name).trim()) existing.name = String(name).trim();

    await existing.save();
    res.json(existing);
  } catch (err) {
    next(err);
  }
};
