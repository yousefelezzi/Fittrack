const NutritionLog = require('../models/NutritionLog');
const User = require('../models/User');
const StepLog = require('../models/StepLog');
const { nutritionTargets } = require('../utils/nutritionTargets');
const { generateMealPlan, catalogFoodNames } = require('../utils/mealPlan');
const { MACRO_KEYS } = require('../utils/nutritionConstants');
const Food = require('../models/Food');
const Supplement = require('../models/Supplement');
const { waterGoal, waterMinerals, WATER_TYPES } = require('../utils/hydration');
const { per100gFor, portionNutrition, resolveState, nameInState } = require('../utils/foodState');

// Lazy require: food.controller is only needed for recipe meals.
const buildRecipeNutrition = (...args) => require('./food.controller').buildRecipeNutrition(...args);

const startOfDay = (date) => { const d = new Date(date); d.setHours(0,0,0,0); return d; };
const endOfDay   = (date) => { const d = new Date(date); d.setHours(23,59,59,999); return d; };
const sameDay    = (date) => ({ $gte: startOfDay(date), $lte: endOfDay(date) });

// The profile fields nutritionTargets() works from.
const TARGET_PROFILE_FIELDS = 'weight height dateOfBirth sex activityLevel fitnessGoal adaptiveCalories';

/**
 * The user's targets for a day: the profile formula, corrected by their real
 * weight trend over the last two weeks unless they've turned that off.
 */
async function targetsFor(user, steps) {
  const { adaptiveMaintenance } = require('../utils/adaptiveCalories');
  const adaptive = user && user.adaptiveCalories !== false ? await adaptiveMaintenance(user) : null;
  return nutritionTargets(user, { steps, adaptive });
}

/** The user's log for `date`, created (with `fields`) if there isn't one yet. */
async function findOrCreateLog(userId, date, fields = {}) {
  const log = await NutritionLog.findOne({ user: userId, date: sameDay(date) });
  return log || NutritionLog.create({ user: userId, date, ...fields });
}

/** Steps logged for `date`, or undefined. */
async function stepsOn(userId, date) {
  const entry = await StepLog.findOne({ user: userId, date: sameDay(date) }).select('steps').lean();
  return entry?.steps;
}

/**
 * Keep today's (and future) logs in line with the user's current profile-based
 * targets and that day's steps, so changing your goal or weight, or logging
 * steps, updates today's numbers straight away.
 * Past days are left alone — they keep the goals that applied at the time.
 */
async function syncGoals(log, userId) {
  if (!log || log.date < startOfDay(new Date())) return log;
  const [user, steps] = await Promise.all([
    User.findById(userId).select(TARGET_PROFILE_FIELDS).lean(),
    stepsOn(userId, log.date),
  ]);
  const { targets } = await targetsFor(user, steps);
  if (!targets) return log;
  const g = log.dailyGoals || {};
  if (MACRO_KEYS.every((k) => g[k] === targets[k])) return log;
  log.dailyGoals = targets;
  await log.save();
  return log;
}

/**
 * Meals logged before meals remembered their food only have a name and numbers,
 * so they couldn't be edited by portion. Match them back to their food by name
 * (e.g. "Chicken Breast (raw)" → "Chicken Breast, cooked" logged raw) and work out
 * the grams from the calories. A meal is only linked when its protein, carbs and
 * fat also match the food at those grams, so edited foods or quick-add entries
 * that happen to share a name are left alone.
 */
async function linkLegacyMeals(log) {
  if (!log) return log;
  const unlinked = log.meals.filter((m) => !m.food && m.name);
  if (unlinked.length === 0) return log;

  const round = (n) => Math.round((n || 0) * 10) / 10;
  const close = (a, b) => Math.abs((a || 0) - (b || 0)) <= Math.max(1, 0.05 * Math.max(a || 0, b || 0));
  const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let changed = false;

  for (const meal of unlinked) {
    // "Name (raw|dry|cooked)" means it was logged in the other state.
    const m = meal.name.match(/^(.*) \((raw|dry|cooked)\)$/i);
    const base = m ? m[1].trim() : meal.name.trim();
    const wanted = m ? (m[2].toLowerCase() === 'cooked' ? 'cooked' : 'uncooked') : null;
    const candidates = await Food.find({
      name: { $regex: `^${esc(base)}(, (cooked|raw|dry|baked))?$`, $options: 'i' },
    }).lean();

    for (const food of candidates) {
      const state = wanted ? resolveState(food, wanted) : (food.storedState || 'cooked');
      if (wanted && state !== wanted) continue;              // can't be logged that way
      if (!wanted && food.name.toLowerCase() !== meal.name.toLowerCase()) continue;
      const p = per100gFor(food, state);
      if (!(p.calories > 0)) continue;
      const grams = (meal.calories / p.calories) * 100;
      if (!(grams > 0)) continue;
      const k = grams / 100;
      if (!close(meal.protein, p.protein * k) || !close(meal.carbs, p.carbs * k) || !close(meal.fat, p.fat * k)) continue;

      meal.food = food._id;
      meal.grams = round(grams);
      meal.state = state;
      changed = true;
      break;
    }
  }

  if (changed) await log.save();
  return log;
}

exports.syncGoals = syncGoals;

// GET /api/nutrition/targets?date=2024-01-15  — the user's personalized goals
// (with that day's steps, today by default) and how they were worked out
exports.getTargets = async (req, res, next) => {
  try {
    const [user, steps] = await Promise.all([
      User.findById(req.user.id).select(TARGET_PROFILE_FIELDS).lean(),
      stepsOn(req.user.id, req.query.date ? new Date(req.query.date) : new Date()),
    ]);
    res.json(await targetsFor(user, steps));
  } catch (err) {
    next(err);
  }
};

// GET /api/nutrition?date=2024-01-15
exports.getLogByDate = async (req, res, next) => {
  try {
    const date = req.query.date ? new Date(req.query.date) : new Date();
    const log = await NutritionLog.findOne({ user: req.user.id, date: sameDay(date) });
    await linkLegacyMeals(log);
    const synced = await syncGoals(log, req.user.id);
    if (!synced) return res.json(synced);
    // Micronutrients from the supplements ticked off that day, and the minerals in the water drunk.
    const user = await User.findById(req.user.id).select('waterType').lean();
    const ml = (synced.water || []).reduce((n, w) => n + w.amount, 0);
    res.json({
      ...(synced.toJSON ? synced.toJSON() : synced),
      supplementMicros: await supplementMicros(synced, req.user.id),
      waterMicros: ml ? waterMinerals(ml, user?.waterType) : {},
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/nutrition/range?from=2024-01-01&to=2024-01-31
exports.getLogRange = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ message: 'from and to dates are required' });

    const logs = await NutritionLog.find({
      user: req.user.id,
      date: { $gte: startOfDay(from), $lte: endOfDay(to) },
    }).sort({ date: 1 });

    res.json(logs);
  } catch (err) {
    next(err);
  }
};

// GET /api/nutrition/history?page=1&limit=10  — days that have at least one meal, newest first
exports.getHistory = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
    const filter = { user: req.user.id, 'meals.0': { $exists: true } };

    const [logs, total] = await Promise.all([
      NutritionLog.find(filter)
        .select('-meals.micros') // not shown in history; keeps the payload small
        .sort({ date: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      NutritionLog.countDocuments(filter),
    ]);

    res.json({ logs, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/nutrition  — wipes the current user's entire nutrition history
exports.deleteAllLogs = async (req, res, next) => {
  try {
    const { deletedCount } = await NutritionLog.deleteMany({ user: req.user.id });
    res.json({ message: 'Nutrition history cleared', deletedCount });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/nutrition/:id  — deletes one day's log and all its meals
exports.deleteLog = async (req, res, next) => {
  try {
    const log = await NutritionLog.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!log) return res.status(404).json({ message: 'Log not found' });
    res.json({ message: 'Day deleted' });
  } catch (err) {
    next(err);
  }
};

// POST /api/nutrition  — create or return existing log for a date
exports.upsertLog = async (req, res, next) => {
  try {
    const log = await findOrCreateLog(req.user.id, new Date(req.body.date), {
      dailyGoals: req.body.dailyGoals,
      notes: req.body.notes,
    });
    await syncGoals(log, req.user.id);

    res.status(201).json(log);
  } catch (err) {
    next(err);
  }
};

// POST /api/nutrition/meal-plan  { mealsPerDay, diet, days, seed }
// A plan built to the user's calorie and macro targets (BMR × activity, adjusted
// for their fitness goal — see utils/nutritionTargets.js). Nothing is saved.
exports.createMealPlan = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select(TARGET_PROFILE_FIELDS).lean();
    const { targets, missing, basis } = await targetsFor(user);
    if (!targets) return res.status(400).json({ message: 'Complete your profile to get calorie targets first', missing });

    const foods = await Food.find({ name: { $in: catalogFoodNames() }, source: { $ne: 'custom' } })
      .select('name per100g servings').lean();
    const foodsByName = new Map(foods.map((f) => [f.name, f]));
    const { mealsPerDay, diet, days, seed } = req.body;
    const plan = generateMealPlan(foodsByName, targets, { mealsPerDay, diet, days, seed });
    res.json({ ...plan, basis });
  } catch (err) {
    next(err);
  }
};

// POST /api/nutrition/meal-plan/apply  { date, meals: [{ mealType, foods: [{ foodId, grams }] }] }
// Adds a planned day to the log (the route has validated the request). Each food
// becomes a meal entry linked to its food and grams, so it can be edited like
// anything else you log; the nutrition is worked out here from the food, not
// taken from the request.
exports.applyMealPlan = async (req, res, next) => {
  try {
    const items = req.body.meals.flatMap((meal) => meal.foods.map((f) => ({ mealType: meal.mealType, foodId: f.foodId, grams: Number(f.grams) })));
    const foods = await Food.find({ _id: { $in: [...new Set(items.map((it) => it.foodId))] } }).lean();
    const foodsById = new Map(foods.map((f) => [String(f._id), f]));
    if (items.some((it) => !foodsById.has(it.foodId))) return res.status(400).json({ message: 'Some foods no longer exist' });

    const log = await findOrCreateLog(req.user.id, new Date(req.body.date || Date.now()));
    for (const { mealType, foodId, grams } of items) {
      const food = foodsById.get(foodId);
      const state = food.storedState || 'cooked';
      log.meals.push({ name: food.name, mealType, food: food._id, grams, state, ...portionNutrition(food, state, grams) });
    }
    await log.save();
    await syncGoals(log, req.user.id);
    res.status(201).json(log);
  } catch (err) {
    next(err);
  }
};

// POST /api/nutrition/copy  { fromDate, toDate, mealTypes? }
// Adds meals from another day (e.g. yesterday's breakfast) to a day. Copies keep
// their food, portion and raw/cooked, so they can be edited like any other meal.
exports.copyMeals = async (req, res, next) => {
  try {
    const { fromDate, toDate, mealTypes } = req.body;
    const source = await NutritionLog.findOne({ user: req.user.id, date: sameDay(new Date(fromDate)) }).lean();

    const wanted = Array.isArray(mealTypes) && mealTypes.length ? new Set(mealTypes) : null;
    const meals = (source?.meals || []).filter((m) => !wanted || wanted.has(m.mealType));
    if (meals.length === 0) return res.status(404).json({ message: 'No meals to copy from that day' });

    const log = await findOrCreateLog(req.user.id, new Date(toDate));

    // New meals, not references to the old ones.
    for (const { _id, ...meal } of meals) log.meals.push(meal);
    await log.save();
    await syncGoals(log, req.user.id);
    res.status(201).json(log);
  } catch (err) {
    next(err);
  }
};

// POST /api/nutrition/:id/meals
exports.addMeal = async (req, res, next) => {
  try {
    const log = await NutritionLog.findOne({ _id: req.params.id, user: req.user.id });
    if (!log) return res.status(404).json({ message: 'Log not found' });

    log.meals.push(req.body);
    await log.save();
    res.status(201).json(log);
  } catch (err) {
    next(err);
  }
};

// PUT /api/nutrition/:id/meals/:mealId
exports.updateMeal = async (req, res, next) => {
  try {
    const log = await NutritionLog.findOne({ _id: req.params.id, user: req.user.id });
    if (!log) return res.status(404).json({ message: 'Log not found' });

    await linkLegacyMeals(log);
    const meal = log.meals.id(req.params.mealId);
    if (!meal) return res.status(404).json({ message: 'Meal not found' });

    // What can change depends on where the meal came from:
    //   Recipe            { ingredients: [{ foodId, grams }] } — amounts of each ingredient
    //   Food (database or custom)  { grams, state? }         — portion and raw/cooked;
    //                     nutrition is recalculated from the food. (A custom food's
    //                     macros are edited on the food itself, then re-applied here.)
    //   Quick add / older meals with no food  { name?, calories?, protein?, carbs?, fat? }
    const { grams, state, mealType, ingredients } = req.body;
    const round = (n) => Math.round((n || 0) * 100) / 100;
    const food = meal.food ? await Food.findById(meal.food).lean() : null;
    const isRecipe = food?.ingredients?.length > 0;

    if (isRecipe && ingredients !== undefined) {
      if (!Array.isArray(ingredients)) return res.status(400).json({ message: 'Invalid ingredients' });
      // This meal's own ingredient list: amounts can change and ingredients can be
      // added or removed. The saved recipe itself isn't touched.
      const list = [];
      for (const ing of ingredients) {
        const g = Number(ing.grams);
        if (!ing?.foodId) return res.status(400).json({ message: 'Invalid ingredient' });
        if (!(g >= 0)) return res.status(400).json({ message: 'Ingredient amounts must be 0 or more' });
        list.push({ foodId: ing.foodId, grams: g, state: ing.state });
      }
      const withAmounts = list.filter((ing) => ing.grams > 0);
      if (withAmounts.length === 0) return res.status(400).json({ message: 'Add an amount for at least one ingredient' });

      const built = await buildRecipeNutrition(withAmounts);
      if (!built) return res.status(400).json({ message: 'No valid ingredients found' });
      meal.calories = built.totals.calories;
      meal.protein  = built.totals.protein;
      meal.carbs    = built.totals.carbs;
      meal.fat      = built.totals.fat;
      meal.micros   = built.totals.micros;
      meal.ingredients = built.ingredientDocs;
      // Portion weight: the ingredients' cooked weight, adjusted if the recipe has
      // a measured finished weight.
      let ratio = 1;
      if (food.totalWeight) {
        const full = await buildRecipeNutrition(food.ingredients.map((ing) => ({ foodId: ing.food, grams: ing.grams, state: ing.state })));
        if (full?.totalGrams) ratio = food.totalWeight / full.totalGrams;
      }
      meal.grams = round(built.totalGrams * ratio);
    } else if (food && !isRecipe && grams !== undefined) {
      const g = Number(grams);
      if (!(g > 0)) return res.status(400).json({ message: 'Portion must be more than 0 g' });
      const st = resolveState(food, state ?? meal.state);
      meal.set({ name: nameInState(food, st), grams: round(g), state: st, ...portionNutrition(food, st, g) });
    } else if (!meal.food) {
      for (const key of MACRO_KEYS) {
        if (req.body[key] === undefined) continue;
        const v = Number(req.body[key]);
        if (!Number.isFinite(v) || v < 0) return res.status(400).json({ message: `${key} must be 0 or more` });
        meal[key] = round(v);
      }
      if (req.body.name !== undefined) {
        const name = String(req.body.name).trim();
        if (!name) return res.status(400).json({ message: 'Name is required' });
        meal.name = name;
      }
    } else if (meal.food && !food) {
      return res.status(404).json({ message: 'The food for this meal no longer exists' });
    }

    if (mealType !== undefined) meal.mealType = mealType;

    await log.save();
    res.json(log);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/nutrition/:id/meals/:mealId
exports.deleteMeal = async (req, res, next) => {
  try {
    const log = await NutritionLog.findOne({ _id: req.params.id, user: req.user.id });
    if (!log) return res.status(404).json({ message: 'Log not found' });

    log.meals.pull({ _id: req.params.mealId });
    await log.save();
    res.json(log);
  } catch (err) {
    next(err);
  }
};

// PUT /api/nutrition/:id/goals
exports.updateGoals = async (req, res, next) => {
  try {
    const log = await NutritionLog.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { dailyGoals: req.body },
      { new: true }
    );
    if (!log) return res.status(404).json({ message: 'Log not found' });
    res.json(log);
  } catch (err) {
    next(err);
  }
};

// ── Hydration & supplements ─────────────────────────────────────────────────

/**
 * Micronutrients from a log's supplements, times the servings taken that day
 * (older entries without them use the supplement's): the built-in list's
 * amounts, or your own supplement's.
 */
async function supplementMicros(log, userId) {
  const entries = (log.supplementsTaken || []).filter((t) => t.taken !== false);
  if (!entries.length) return {};
  const found = await Supplement.find({ _id: { $in: entries.map((t) => t.supplement) }, user: userId }).populate('catalog', 'micros').lean();
  const byId = new Map(found.map((s) => [String(s._id), s]));
  const totals = {};
  for (const t of entries) {
    if (t.taken === false) continue;
    const s = byId.get(String(t.supplement));
    if (!s) continue;
    const servings = t.servings || s.servings || 1;
    for (const [key, amount] of Object.entries((s.catalog ? s.catalog.micros : s.micros) || {})) {
      totals[key] = Math.round(((totals[key] || 0) + amount * servings) * 100) / 100;
    }
  }
  return totals;
}

// The log for a day, created if there isn't one yet.
const logForDay = (userId, date, update) => NutritionLog.findOneAndUpdate(
  { user: userId, date: sameDay(date) },
  { ...update, $setOnInsert: { user: userId, date: startOfDay(date) } },
  { upsert: true, new: true }
);

// POST /api/nutrition/water { date, amount }  — log a drink (ml)
exports.addWater = async (req, res, next) => {
  try {
    const log = await logForDay(req.user.id, req.body.date, { $push: { water: { amount: Math.round(Number(req.body.amount)), at: new Date() } } });
    res.status(201).json(log);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/nutrition/water/:entryId  — remove a drink
exports.deleteWater = async (req, res, next) => {
  try {
    const log = await NutritionLog.findOneAndUpdate(
      { user: req.user.id, 'water._id': req.params.entryId },
      { $pull: { water: { _id: req.params.entryId } } },
      { new: true }
    );
    if (!log) return res.status(404).json({ message: 'Entry not found' });
    res.json(log);
  } catch (err) {
    next(err);
  }
};

const dayEntries = (log) => log?.supplementsTaken || [];

/**
 * Put the user's stack on a day, unticked, the first time the day is opened
 * (once only: later changes to the stack don't change the day). Days logged
 * before this existed are marked as loaded. Returns the day's log, or null when
 * there's no log and no stack.
 */
async function ensureStack(userId, date) {
  const log = await NutritionLog.findOne({ user: userId, date: sameDay(date) });
  if (log?.supplementsStackLoaded) return log;
  const stack = await Supplement.find({ user: userId, inStack: true }).sort({ order: 1, createdAt: 1 }).select('_id servings').lean();
  if (!stack.length) return log;
  const already = new Set(dayEntries(log).map((t) => String(t.supplement)));
  const add = stack.filter((s) => !already.has(String(s._id))).map((s) => ({ supplement: s._id, servings: s.servings || 1, taken: false, at: new Date() }));
  try {
    // Only if it hasn't been loaded meanwhile (e.g. two screens opening the day at once).
    return await NutritionLog.findOneAndUpdate(
      { user: userId, date: sameDay(date), supplementsStackLoaded: { $ne: true } },
      { $push: { supplementsTaken: { $each: add } }, $set: { supplementsStackLoaded: true }, $setOnInsert: { user: userId, date: startOfDay(date) } },
      { upsert: true, new: true }
    );
  } catch (err) {
    if (err.code !== 11000) throw err;
    return NutritionLog.findOne({ user: userId, date: sameDay(date) });
  }
}

// POST /api/nutrition/supplements/day { date }  — that day's supplements (the stack is put on it the first time)
exports.supplementDay = async (req, res, next) => {
  try {
    const log = await ensureStack(req.user.id, req.body.date);
    res.json({ date: req.body.date, supplementsTaken: dayEntries(log) });
  } catch (err) {
    next(err);
  }
};

// POST /api/nutrition/supplements/toggle { date, supplementId, taken? }  — put a supplement on that day
// (unticked unless taken: true), or take it off the day. Only that day changes.
exports.toggleSupplement = async (req, res, next) => {
  try {
    const { date, supplementId } = req.body;
    const supplement = await Supplement.findOne({ _id: supplementId, user: req.user.id }).select('_id servings').lean();
    if (!supplement) return res.status(404).json({ message: 'Supplement not found' });
    await ensureStack(req.user.id, date);
    const existing = await NutritionLog.findOne({ user: req.user.id, date: sameDay(date), 'supplementsTaken.supplement': supplementId }).select('_id').lean();
    const log = existing
      ? await NutritionLog.findByIdAndUpdate(existing._id, { $pull: { supplementsTaken: { supplement: supplementId } } }, { new: true })
      : await logForDay(req.user.id, date, { $push: { supplementsTaken: { supplement: supplementId, servings: supplement.servings || 1, taken: req.body.taken === true, at: new Date() } } });
    res.json(log);
  } catch (err) {
    next(err);
  }
};

// POST /api/nutrition/supplements/tick { date, supplementId }  — tick a supplement on that day off (or untick it)
exports.tickSupplement = async (req, res, next) => {
  try {
    const { date, supplementId } = req.body;
    const log = await NutritionLog.findOne({ user: req.user.id, date: sameDay(date), 'supplementsTaken.supplement': supplementId });
    if (!log) return res.status(404).json({ message: 'That supplement isn\'t on this day' });
    const entry = log.supplementsTaken.find((t) => String(t.supplement) === String(supplementId));
    entry.taken = entry.taken === false;
    entry.at = new Date();
    await log.save();
    res.json(log);
  } catch (err) {
    next(err);
  }
};

// PUT /api/nutrition/supplements/servings { date, supplementId, servings }  — servings taken that day only
exports.setSupplementServings = async (req, res, next) => {
  try {
    const { date, supplementId, servings } = req.body;
    const log = await NutritionLog.findOneAndUpdate(
      { user: req.user.id, date: sameDay(date), 'supplementsTaken.supplement': supplementId },
      { $set: { 'supplementsTaken.$.servings': Number(servings) } },
      { new: true, runValidators: true }
    );
    if (!log) return res.status(404).json({ message: 'That supplement isn\'t on this day' });
    res.json(log);
  } catch (err) {
    next(err);
  }
};

// POST /api/nutrition/supplements/take { date, supplementIds? | copyFrom? }
// Tick several off at once: the ones listed (e.g. all of the day's), or the
// ones taken on another day (copyFrom: YYYY-MM-DD, with that day's servings),
// adding any that aren't on the day yet.
exports.takeSupplements = async (req, res, next) => {
  try {
    const { date, copyFrom } = req.body;
    let ids = Array.isArray(req.body.supplementIds) ? req.body.supplementIds.map(String) : [];
    let servingsFrom = new Map();
    if (copyFrom) {
      const from = await NutritionLog.findOne({ user: req.user.id, date: sameDay(copyFrom) }).select('supplementsTaken').lean();
      const taken = dayEntries(from).filter((t) => t.taken !== false);
      ids = taken.map((t) => String(t.supplement));
      servingsFrom = new Map(taken.filter((t) => t.servings).map((t) => [String(t.supplement), t.servings]));
      if (!ids.length) return res.status(400).json({ message: 'No supplements were taken that day' });
    }
    // Only your own, still-existing supplements.
    const mine = await Supplement.find({ _id: { $in: ids }, user: req.user.id }).select('_id servings').lean();
    if (!mine.length) return res.status(400).json({ message: 'No supplements to tick off' });
    const log = (await ensureStack(req.user.id, date)) || await logForDay(req.user.id, date, {});
    for (const s of mine) {
      const id = String(s._id);
      const entry = log.supplementsTaken.find((t) => String(t.supplement) === id);
      if (entry) {
        if (entry.taken === false) { entry.taken = true; entry.at = new Date(); }
        if (servingsFrom.has(id)) entry.servings = servingsFrom.get(id);
      } else {
        log.supplementsTaken.push({ supplement: s._id, servings: servingsFrom.get(id) || s.servings || 1, taken: true, at: new Date() });
      }
    }
    await log.save();
    res.json(log);
  } catch (err) {
    next(err);
  }
};

// GET /api/nutrition/summary?from=2026-09-01&to=2026-10-01
// Per-day totals for the Progress charts (days with nothing logged are left
// out) plus the daily water goal: { days: [{ date, calories, protein, carbs,
// fat, fiber, water, supplements, goals }], waterGoal, waterType, waterTypes }.
exports.getSummary = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ message: 'from and to dates are required' });
    const [logs, user, stepLogs] = await Promise.all([
      NutritionLog.find({ user: req.user.id, date: { $gte: startOfDay(from), $lte: endOfDay(to) } })
        .select('date meals.calories meals.protein meals.carbs meals.fat meals.micros.fiber meals.micros.saturatedFat water supplementsTaken dailyGoals')
        .sort({ date: 1 })
        .lean(),
      User.findById(req.user.id).select(`${TARGET_PROFILE_FIELDS} waterGoal waterType`).lean(),
      StepLog.find({ user: req.user.id, date: { $gte: startOfDay(from), $lte: endOfDay(to) } }).select('date steps').lean(),
    ]);
    // A day's goals are only synced to the user's targets when it's viewed as
    // "today"; days logged other ways (meal plans, copying, water…) still hold the
    // defaults. For those, work out the target from the profile and that day's steps.
    const DEFAULT_GOALS = Object.fromEntries(MACRO_KEYS.map((k) => [k, NutritionLog.schema.path(`dailyGoals.${k}`).defaultValue]));
    const stepsByDay = new Map(stepLogs.map((s) => [s.date.toISOString().slice(0, 10), s.steps]));
    const goalsFor = (l) => {
      const g = l.dailyGoals;
      const untouched = !g || MACRO_KEYS.every((k) => g[k] === DEFAULT_GOALS[k]);
      if (!untouched) return g;
      const { targets } = nutritionTargets(user, { steps: stepsByDay.get(l.date.toISOString().slice(0, 10)) });
      return targets || g || null;
    };
    const sum = (list, f) => Math.round(list.reduce((n, x) => n + (Number(f(x)) || 0), 0));
    const days = logs
      .map((l) => ({
        date: l.date.toISOString().slice(0, 10),
        calories: sum(l.meals, (m) => m.calories),
        protein: sum(l.meals, (m) => m.protein),
        carbs: sum(l.meals, (m) => m.carbs),
        fat: sum(l.meals, (m) => m.fat),
        fiber: sum(l.meals, (m) => m.micros?.fiber),
        saturatedFat: sum(l.meals, (m) => m.micros?.saturatedFat),
        water: sum(l.water || [], (w) => w.amount),
        supplements: (l.supplementsTaken || []).filter((t) => t.taken !== false).length,
        goals: goalsFor(l),
      }))
      .filter((d) => d.calories || d.water || d.supplements);
    // waterTypes: the minerals per litre of each kind of water, for the Hydration page.
    res.json({ days, waterGoal: waterGoal(user), waterType: user?.waterType || 'tap', waterTypes: WATER_TYPES });
  } catch (err) {
    next(err);
  }
};
