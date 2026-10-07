/**
 * Food and recipe maths for the nutrition log, shared by the web and mobile
 * clients (mobile imports this file through its Metro config): scaling per-100 g
 * values, raw vs cooked weights, recipe totals and serving sizes, and turning a
 * custom food's label values into what the API stores. No UI in here.
 */
import { useEffect, useState } from 'react';

export const MACRO_COLORS = { protein: '#0ea5e9', carbs: '#f59e0b', fat: '#ef4444' };

export const r = (n) => Math.round((n || 0) * 10) / 10;
export const r0 = (n) => Math.round(n || 0);

// "1 breast (174g)" or "100g" already state the weight — don't add "(174g)" again.
export const servingText = (label, grams) =>
  /\d\s*g\b|\bgrams?\b/i.test(label || '') ? label : `${label} (${Math.round(grams * 10) / 10}g)`;

// Scale per100g macros + micros by grams
export const scale = (food, grams) => {
  const f = grams / 100;
  const base = {
    calories: r(food.per100g.calories * f),
    protein:  r(food.per100g.protein  * f),
    carbs:    r(food.per100g.carbs    * f),
    fat:      r(food.per100g.fat      * f),
  };
  const m = food.per100g.micros || {};
  const micros = Object.fromEntries(
    Object.entries(m).map(([k, v]) => [k, r(v * f)])
  );
  return { ...base, micros };
};


// ── Micro config: display name, unit, daily reference value (RDA/AI) ─────────
export const MICRO_CONFIG = [
  // Vitamins
  { key: 'vitaminA',   label: 'Vitamin A',   unit: 'mcg', dv: 900 },
  { key: 'vitaminC',   label: 'Vitamin C',   unit: 'mg',  dv: 90  },
  { key: 'vitaminD',   label: 'Vitamin D',   unit: 'mcg', dv: 20  },
  { key: 'vitaminE',   label: 'Vitamin E',   unit: 'mg',  dv: 15  },
  { key: 'vitaminK',   label: 'Vitamin K',   unit: 'mcg', dv: 120 },
  { key: 'vitaminB1',  label: 'B1 (Thiamine)',  unit: 'mg', dv: 1.2 },
  { key: 'vitaminB2',  label: 'B2 (Riboflavin)',unit: 'mg', dv: 1.3 },
  { key: 'vitaminB3',  label: 'B3 (Niacin)',    unit: 'mg', dv: 16  },
  { key: 'vitaminB6',  label: 'B6',          unit: 'mg',  dv: 1.7 },
  { key: 'vitaminB12', label: 'B12',         unit: 'mcg', dv: 2.4 },
  { key: 'folate',     label: 'Folate',      unit: 'mcg', dv: 400 },
  // Minerals
  { key: 'calcium',    label: 'Calcium',     unit: 'mg',  dv: 1000 },
  { key: 'iron',       label: 'Iron',        unit: 'mg',  dv: 18   },
  { key: 'magnesium',  label: 'Magnesium',   unit: 'mg',  dv: 420  },
  { key: 'phosphorus', label: 'Phosphorus',  unit: 'mg',  dv: 700  },
  { key: 'potassium',  label: 'Potassium',   unit: 'mg',  dv: 4700 },
  { key: 'sodium',     label: 'Sodium',      unit: 'mg',  dv: 2300 },
  { key: 'zinc',       label: 'Zinc',        unit: 'mg',  dv: 11   },
  { key: 'selenium',   label: 'Selenium',    unit: 'mcg', dv: 55   },
  // Other
  { key: 'fiber',      label: 'Fiber',       unit: 'g',   dv: 28   },
  { key: 'sugar',      label: 'Sugar',       unit: 'g',   dv: null },
  { key: 'cholesterol',label: 'Cholesterol', unit: 'mg',  dv: 300  },
  { key: 'omega3',     label: 'Omega-3',     unit: 'g',   dv: 1.6  },
];

// Sum micros across all meals, plus `extra` (e.g. the day's supplements: the
// log's supplementMicros, from the supplements ticked off that day).
export const sumMicros = (meals, extra = {}) => {
  const totals = {};
  for (const cfg of MICRO_CONFIG) totals[cfg.key] = r(Number(extra?.[cfg.key]) || 0);
  for (const meal of (meals || [])) {
    for (const cfg of MICRO_CONFIG) {
      totals[cfg.key] = r((totals[cfg.key] || 0) + ((meal.micros || {})[cfg.key] || 0));
    }
  }
  return totals;
};

/** Micronutrient objects added up (e.g. the day's supplementMicros and waterMicros). */
export const addMicros = (...sources) => {
  const out = {};
  for (const src of sources) for (const [k, v] of Object.entries(src || {})) out[k] = (out[k] || 0) + (Number(v) || 0);
  return out;
};

/** Micronutrients you can enter for your own supplement (sugar and cholesterol left out). */
export const SUPPLEMENT_MICROS = MICRO_CONFIG.filter((c) => !['sugar', 'cholesterol'].includes(c.key));

/** "Vitamin D 25 mcg · Calcium 500 mg" for a supplement's micros per serving × servings. */
export const microsText = (micros = {}, servings = 1) => MICRO_CONFIG
  .filter((c) => Number(micros[c.key]) > 0)
  .map((c) => `${c.label} ${r(micros[c.key] * servings)} ${c.unit}`)
  .join(' · ');


// A food with a cookedYield can be logged raw/dry or cooked: 1 g raw makes
// `cookedYield` g cooked. `storedState` says which state its per100g describes.
export const canPickState = (food) => food?.cookedYield > 0;
export const storedStateOf = (food) => food?.storedState || 'cooked';
export const stateOf = (food, state) =>
  canPickState(food) && (state === 'cooked' || state === 'uncooked') ? state : storedStateOf(food);
export const stateLabel = (food, state) => (state === 'uncooked' ? food.uncookedLabel || 'raw' : 'cooked');

/** The food with per100g for the given state. Same as server/utils/foodState.js. */
export function foodInState(food, state) {
  const want = stateOf(food, state);
  if (want === storedStateOf(food)) return food;
  const k = want === 'uncooked' ? food.cookedYield : 1 / food.cookedYield;
  const conv = (v) => r((v || 0) * k);
  const p = food.per100g;
  const macros = want === 'uncooked' && food.uncookedPer100g?.calories != null
    ? food.uncookedPer100g // fatty cuts lose fat too, so they carry real raw values
    : { calories: conv(p.calories), protein: conv(p.protein), carbs: conv(p.carbs), fat: conv(p.fat) };
  return {
    ...food,
    per100g: { ...macros, micros: Object.fromEntries(Object.entries(p.micros || {}).map(([k2, v]) => [k2, conv(v)])) },
  };
}

// "Chicken Breast, cooked" → "Chicken Breast (raw)"; unchanged in its stored state.
export const nameInState = (food, state) => {
  const want = stateOf(food, state);
  if (want === storedStateOf(food)) return food.name;
  return `${food.name.replace(/,\s*(cooked|raw|dry|baked)$/i, '')} (${stateLabel(food, want)})`;
};

export const yieldHint = (food) => {
  const raw = food.uncookedLabel || 'raw';
  const cooked = Math.round(food.cookedYield * 100);
  return cooked === 100
    ? `Weighs about the same ${raw} and cooked`
    : `100 g ${raw} ≈ ${cooked} g cooked`;
};


// Each ingredient's grams in a portion of a recipe.
export function portionIngredients(recipe, portionGrams) {
  const whole = recipe.servings?.find((sv) => sv.label === 'Whole recipe')?.grams || 0;
  const share = whole > 0 ? portionGrams / whole : 1;
  return (recipe.ingredients || []).map((ing) => ({
    food: typeof ing.food === 'object' ? ing.food._id : ing.food,
    name: ing.name, grams: r((Number(ing.grams) || 0) * share), state: ing.state ?? null,
  }));
}

export const isEditableCustomFood = (food) =>
  food?.source === 'custom' && !food.isVirtual && !(food.ingredients?.length > 0);


export const LABEL_FIELDS = [
  { key: 'calories', label: 'Calories', unit: 'kcal', required: true },
  { key: 'protein',  label: 'Protein',  unit: 'g' },
  { key: 'carbs',    label: 'Carbs',    unit: 'g' },
  { key: 'fat',      label: 'Fat',      unit: 'g' },
];
export const EXTRA_FIELDS = [
  { key: 'fiber',  label: 'Fiber',  unit: 'g' },
  { key: 'sugar',  label: 'Sugar',  unit: 'g' },
  { key: 'sodium', label: 'Sodium', unit: 'mg' },
];

// Form values for an existing custom food (label values shown per serving).
export function customFoodInitial(food) {
  if (!food) return null;
  const sv = food.servings?.[0];
  const k = sv?.grams ? sv.grams / 100 : 1;
  const p = food.per100g || {};
  const m = p.micros || {};
  const cookMode = !food.cookedYield ? 'none'
    : food.storedState === 'uncooked' ? (food.uncookedLabel || 'raw') : 'cooked';
  return {
    name: food.name, brand: food.brand || '',
    servingLabel: sv?.label || '', servingGrams: sv?.grams ?? '',
    basis: sv ? 'serving' : '100g',
    values: Object.fromEntries([
      ...['calories', 'protein', 'carbs', 'fat'].map((key) => [key, r((p[key] || 0) * (sv ? k : 1))]),
      ...['fiber', 'sugar', 'sodium'].map((key) => [key, r((m[key] || 0) * (sv ? k : 1))]),
    ]),
    showExtras: ['fiber', 'sugar', 'sodium'].some((key) => m[key] > 0),
    cookMode, cookedFrom: food.uncookedLabel || 'raw',
    cookedPer100: food.cookedYield ? Math.round(food.cookedYield * 100) : '',
  };
}


// An ingredient's state defaults to how its food is stored (raw broccoli, cooked rice).
export const ingState = (ing) => stateOf(ing.food, ing.state);
// The ingredient as it was weighed (raw/dry or cooked values).
export const ingredientFood = (ing) => foodInState(ing.food, ing.state);
// Roughly what the ingredient weighs once cooked (raw chicken shrinks, dry rice swells).
export const cookedGramsOf = (ing) =>
  (Number(ing.grams) || 0) * (ingState(ing) === 'uncooked' && canPickState(ing.food) ? ing.food.cookedYield : 1);

export function sumIngredients(ingredients) {
  return ingredients.reduce(
    (acc, ing) => {
      const s = scale(ingredientFood(ing), Number(ing.grams) || 0);
      return {
        calories: acc.calories + s.calories,
        protein:  acc.protein  + s.protein,
        carbs:    acc.carbs    + s.carbs,
        fat:      acc.fat      + s.fat,
        grams:    acc.grams    + cookedGramsOf(ing),
      };
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0, grams: 0 }
  );
}

export const ingredientPayload = (ing) => ({ foodId: ing.food._id, grams: Number(ing.grams) || 0, state: ingState(ing) });


export const fmtCount = (n) => (Number.isInteger(n) ? String(n) : `~${Math.round(n * 10) / 10}`);

/**
 * Serving settings for a recipe. The finished weight defaults to the sum of the
 * raw ingredients, but can be overridden (cooking usually changes it). A serving
 * is defined either by count ("makes 4") or by weight ("250 g each").
 */
export function useRecipeServing(rawGrams, initial) {
  const [totalWeight, setTotalWeight]   = useState('');
  const [mode, setMode]                 = useState('count');
  const [numServings, setNumServings]   = useState(1);
  const [servingGrams, setServingGrams] = useState('');
  const [servingName, setServingName]   = useState('');

  // Load saved settings once they arrive (the recipe editor fetches them async).
  useEffect(() => {
    if (!initial) return;
    setTotalWeight(initial.totalWeight ?? '');
    setMode(initial.servingGrams ? 'weight' : 'count');
    setNumServings(initial.numServings ?? 1);
    setServingGrams(initial.servingGrams ?? '');
    setServingName(initial.servingName ?? '');
  }, [initial]);

  const effTotal = Number(totalWeight) > 0 ? Number(totalWeight) : rawGrams;
  let gramsPerServing, count;
  if (mode === 'weight' && Number(servingGrams) > 0) {
    gramsPerServing = Number(servingGrams);
    count = effTotal > 0 ? effTotal / gramsPerServing : 1;
  } else {
    count = Number(numServings) > 0 ? Number(numServings) : 1;
    gramsPerServing = effTotal / count;
  }
  const valid = effTotal > 0 && gramsPerServing > 0;
  const label = servingName.trim() ? `1 ${servingName.trim()}` : `1 serving (of ${fmtCount(count)})`;

  return {
    totalWeight, setTotalWeight, mode, setMode, numServings, setNumServings,
    servingGrams, setServingGrams, servingName, setServingName,
    rawGrams, effTotal, gramsPerServing, count, valid, label,
    // What the API expects
    payload: {
      numServings: mode === 'count' ? (Number(numServings) > 0 ? Number(numServings) : 1) : undefined,
      servingGrams: mode === 'weight' && Number(servingGrams) > 0 ? Number(servingGrams) : null,
      totalWeight: Number(totalWeight) > 0 ? Number(totalWeight) : null,
      servingName: servingName.trim(),
    },
  };
}


export const GOAL_NAMES = {
  lose_weight: 'Lose Weight', build_muscle: 'Build Muscle', improve_endurance: 'Improve Endurance',
  stay_active: 'Stay Active', other: 'Other',
};


/**
 * A food-shaped object from a recipe's (possibly edited) ingredients, so the
 * normal portion picker can log it without saving the recipe. Nutrients come
 * from the ingredients; per-100 g is spread over the finished weight.
 */
export function buildVirtualRecipe({ foodId, foodName, ingredients, sv }) {
  const totals = sumIngredients(ingredients);
  const scaleTo100 = sv.effTotal > 0 ? 100 / sv.effTotal : 0;
  const microTotals = {};
  for (const ing of ingredients) {
    const factor = (Number(ing.grams) || 0) / 100;
    const m = ingredientFood(ing).per100g?.micros || {};
    for (const [k, v] of Object.entries(m)) microTotals[k] = (microTotals[k] || 0) + (v || 0) * factor;
  }
  return {
    _id: foodId,
    isVirtual: true, // edited but not saved — logged meals can't link back to it
    name: foodName,
    per100g: {
      calories: r(totals.calories * scaleTo100),
      protein:  r(totals.protein  * scaleTo100),
      carbs:    r(totals.carbs    * scaleTo100),
      fat:      r(totals.fat      * scaleTo100),
      micros: Object.fromEntries(Object.entries(microTotals).map(([k, v]) => [k, r(v * scaleTo100)])),
    },
    servings: [
      { label: sv.label, grams: r(sv.gramsPerServing) },
      { label: 'Whole recipe', grams: r(sv.effTotal) },
    ],
    ingredients: ingredients.map((ing) => ({ food: ing.food._id, name: ing.food.name, grams: ing.grams, state: ing.state })),
    numServings: sv.count,
  };
}

/**
 * A custom food form's values → whether it's complete, the label shown for its
 * serving, conversions between per-serving and per-100 g, and the API body.
 * `editing` is the food being edited (to turn its cooking yield off), if any.
 */
export function customFoodDraft({ name, brand, servingLabel, servingGrams, basis, values, cookMode, cookedFrom, cookedPer100, editing }) {
  const grams = Number(servingGrams);
  const num = (k) => Number(values[k]) || 0;
  // Everything is stored per 100 g, like the rest of the food database.
  const toPer100 = basis === 'serving' ? (grams > 0 ? 100 / grams : 0) : 1;
  const toServing = basis === 'serving' ? 1 : grams / 100;
  // "bar" → "1 bar"; "2 slices" stays as typed.
  const label = /^\s*[\d½¼¾]/.test(servingLabel) ? servingLabel.trim() : `1 ${servingLabel.trim()}`;
  const cookingValid = cookMode === 'none' || (Number(cookedPer100) >= 10 && Number(cookedPer100) <= 1000);
  const hasCalories = values.calories !== undefined && values.calories !== '';
  const valid = !!(name.trim() && servingLabel.trim() && grams > 0 && hasCalories
    && [...LABEL_FIELDS, ...EXTRA_FIELDS].every((f) => num(f.key) >= 0) && cookingValid);
  const rawWord = cookMode === 'cooked' ? cookedFrom : cookMode === 'dry' ? 'dry' : 'raw';
  const per = (k) => r(num(k) * toPer100);
  const body = {
    name: name.trim(),
    brand: brand.trim(),
    per100g: {
      calories: per('calories'), protein: per('protein'), carbs: per('carbs'), fat: per('fat'),
      micros: { fiber: per('fiber'), sugar: per('sugar'), sodium: per('sodium') },
    },
    servings: [{ label, grams }],
    ...(cookMode !== 'none'
      ? { storedState: cookMode === 'cooked' ? 'cooked' : 'uncooked', uncookedLabel: rawWord, cookedYield: Number(cookedPer100) / 100 }
      : editing?.cookedYield ? { cookedYield: null } : {}), // turned off
  };
  return { grams, num, toPer100, toServing, label, valid, hasCalories, rawWord, body };
}
