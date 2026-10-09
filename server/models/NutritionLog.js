const mongoose = require('mongoose');
const { MEAL_TYPES } = require('../utils/nutritionConstants');

const mealMicrosSchema = new mongoose.Schema({
  vitaminA:   { type: Number, default: 0 },
  vitaminC:   { type: Number, default: 0 },
  vitaminD:   { type: Number, default: 0 },
  vitaminE:   { type: Number, default: 0 },
  vitaminK:   { type: Number, default: 0 },
  vitaminB1:  { type: Number, default: 0 },
  vitaminB2:  { type: Number, default: 0 },
  vitaminB3:  { type: Number, default: 0 },
  vitaminB6:  { type: Number, default: 0 },
  vitaminB12: { type: Number, default: 0 },
  folate:     { type: Number, default: 0 },
  calcium:    { type: Number, default: 0 },
  iron:       { type: Number, default: 0 },
  magnesium:  { type: Number, default: 0 },
  phosphorus: { type: Number, default: 0 },
  potassium:  { type: Number, default: 0 },
  sodium:     { type: Number, default: 0 },
  zinc:       { type: Number, default: 0 },
  selenium:   { type: Number, default: 0 },
  fiber:      { type: Number, default: 0 },
  sugar:      { type: Number, default: 0 },
  cholesterol:{ type: Number, default: 0 },
  omega3:     { type: Number, default: 0 },
  saturatedFat: { type: Number, default: 0 },
  creatine:   { type: Number, default: 0 },
}, { _id: false });

const mealSchema = new mongoose.Schema(
  {
    name:      { type: String, required: true, trim: true },
    calories:  { type: Number, default: 0 },
    protein:   { type: Number, default: 0 },
    carbs:     { type: Number, default: 0 },
    fat:       { type: Number, default: 0 },
    mealType:  { type: String, enum: MEAL_TYPES, default: 'snack' },
    micros:    { type: mealMicrosSchema, default: () => ({}) },
    // How it was logged, so the portion can be edited later. Empty for quick-add
    // entries and meals logged before this was stored.
    food:      { type: mongoose.Schema.Types.ObjectId, ref: 'Food', default: null },
    grams:     { type: Number, min: 0, default: null },
    state:     { type: String, enum: ['cooked', 'uncooked', null], default: null },
    // Recipe meals whose ingredient amounts were adjusted for this meal only.
    ingredients: {
      type: [{
        food:  { type: mongoose.Schema.Types.ObjectId, ref: 'Food' },
        name:  String,
        grams: Number,
        state: { type: String, enum: ['cooked', 'uncooked', null], default: null },
        _id: false,
      }],
      default: undefined,
    },
  },
  { _id: true }
);

const nutritionLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, required: true },
    meals: [mealSchema],
    dailyGoals: {
      calories:  { type: Number, default: 2000 },
      protein:   { type: Number, default: 150 },
      carbs:     { type: Number, default: 200 },
      fat:       { type: Number, default: 65 },
    },
    notes: { type: String, default: '' },
    // Water drunk that day, one entry per drink (ml).
    water: [{
      amount: { type: Number, min: 1, max: 5000, required: true },
      at: { type: Date, default: Date.now },
    }],
    // That day's supplements: the user's stack (loaded the first time the day
    // is opened) plus anything added that day. Ticked off when taken; only
    // taken ones count. Servings are that day's own, so editing the
    // supplement later doesn't change past days.
    supplementsTaken: [{
      supplement: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplement', required: true },
      servings: { type: Number, min: 0.25, max: 20 },
      taken: { type: Boolean, default: true },
      at: { type: Date, default: Date.now },
      _id: false,
    }],
    // The stack has been put on this day (it's done once, so later changes to
    // the stack don't change the day).
    supplementsStackLoaded: { type: Boolean, default: false },
  },
  { timestamps: true }
);

nutritionLogSchema.index({ user: 1, date: 1 }, { unique: true });

nutritionLogSchema.virtual('totals').get(function () {
  return this.meals.reduce(
    (acc, meal) => ({
      calories:  acc.calories  + meal.calories,
      protein:   acc.protein   + meal.protein,
      carbs:     acc.carbs     + meal.carbs,
      fat:       acc.fat       + meal.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
});

nutritionLogSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('NutritionLog', nutritionLogSchema);
