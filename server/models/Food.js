const mongoose = require('mongoose');

// Micronutrient sub-schema — all per 100g, standard USDA units
const microsSchema = new mongoose.Schema({
  // Vitamins
  vitaminA:  { type: Number, default: 0 },   // mcg RAE
  vitaminC:  { type: Number, default: 0 },   // mg
  vitaminD:  { type: Number, default: 0 },   // mcg
  vitaminE:  { type: Number, default: 0 },   // mg
  vitaminK:  { type: Number, default: 0 },   // mcg
  vitaminB1: { type: Number, default: 0 },   // mg  (thiamine)
  vitaminB2: { type: Number, default: 0 },   // mg  (riboflavin)
  vitaminB3: { type: Number, default: 0 },   // mg  (niacin)
  vitaminB6: { type: Number, default: 0 },   // mg
  vitaminB12:{ type: Number, default: 0 },   // mcg
  folate:    { type: Number, default: 0 },   // mcg DFE
  // Minerals
  calcium:   { type: Number, default: 0 },   // mg
  iron:      { type: Number, default: 0 },   // mg
  magnesium: { type: Number, default: 0 },   // mg
  phosphorus:{ type: Number, default: 0 },   // mg
  potassium: { type: Number, default: 0 },   // mg
  sodium:    { type: Number, default: 0 },   // mg
  zinc:      { type: Number, default: 0 },   // mg
  selenium:  { type: Number, default: 0 },   // mcg
  // Other
  fiber:     { type: Number, default: 0 },   // g
  sugar:     { type: Number, default: 0 },   // g
  cholesterol:{ type: Number, default: 0 },  // mg
  omega3:    { type: Number, default: 0 },   // g
}, { _id: false });

// One line of a recipe: an existing Food used as an ingredient, at a given
// weight. `name` is a snapshot taken at save time so the recipe still reads
// correctly even if the referenced food is later renamed or removed.
const ingredientSchema = new mongoose.Schema({
  food:  { type: mongoose.Schema.Types.ObjectId, ref: 'Food' },
  name:  { type: String },
  grams: { type: Number, required: true },
  // 'uncooked' = grams were weighed raw/dry (only for foods with a cookedYield)
  state: { type: String, enum: ['cooked', 'uncooked', null], default: null }, // null = as the food is stored
}, { _id: false });

const foodSchema = new mongoose.Schema(
  {
    name:    { type: String, required: true, trim: true },
    brand:   { type: String, trim: true, default: '' },
    per100g: {
      calories:  { type: Number, default: 0 },
      protein:   { type: Number, default: 0 },
      carbs:     { type: Number, default: 0 },
      fat:       { type: Number, default: 0 },
      micros:    { type: microsSchema, default: () => ({}) },
    },
    servings: [{
      label: { type: String },
      grams: { type: Number },
    }],
    category: { type: String, default: 'general' },
    source:   { type: String, default: 'usda' },
    fdcId:    { type: String, default: '' },
    // Present only on user-built "recipe" foods — a custom food composed of
    // other foods already in the database. per100g/servings above are
    // pre-computed from these ingredients at creation time, so the rest of
    // the app (search, logging, scaling) treats a recipe exactly like any
    // other food and never needs to know about `ingredients`.
    ingredients: { type: [ingredientSchema], default: undefined },
    numServings: { type: Number, default: 1 },
    // Raw vs cooked. 1 g raw/dry makes `cookedYield` g cooked. `storedState` says
    // which state per100g describes. `uncookedPer100g` optionally overrides the
    // converted raw values (for fatty cuts that lose fat while cooking).
    cookedYield:     { type: Number, default: null },
    storedState:     { type: String, enum: ['cooked', 'uncooked'], default: 'cooked' },
    uncookedLabel:   { type: String, enum: ['raw', 'dry', null], default: null },
    uncookedPer100g: {
      type: { calories: Number, protein: Number, carbs: Number, fat: Number, _id: false },
      default: null,
    },
    // Recipe serving settings (all optional):
    totalWeight:  { type: Number, default: null }, // finished weight in g, if cooking changed it
    servingGrams: { type: Number, default: null }, // set when servings are defined by weight
    servingName:  { type: String, trim: true, maxlength: 30, default: '' }, // e.g. bowl, slice
  },
  { timestamps: true }
);

foodSchema.index({ name: 'text', brand: 'text' });
foodSchema.index({ name: 1 });

module.exports = mongoose.model('Food', foodSchema);
