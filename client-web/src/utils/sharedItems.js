/**
 * Text for custom exercises and foods shared in posts and messages. Shared by
 * the web and mobile clients (mobile imports it through its Metro config).
 */
import { TYPE_LABEL, typeOf } from './exerciseTypes';

/** "Pecs, triceps · cable · Unilateral" */
export function exerciseSummary(ex) {
  const parts = [(ex.muscleGroups || []).join(', '), ex.equipment?.replace('_', ' ')];
  if (ex.laterality === 'unilateral') parts.push('one side at a time');
  if (typeOf(ex) !== 'dynamic') parts.push(TYPE_LABEL[typeOf(ex)].toLowerCase());
  return parts.filter(Boolean).join(' · ');
}

/** A food's nutrition for its first serving (or per 100 g): { label, kcal, p, c, f }. */
export function foodServing(food) {
  const sv = (food.servings || [])[0];
  const grams = sv?.grams || 100;
  const k = grams / 100;
  const n = food.per100g || {};
  return {
    label: sv ? `${sv.label} (${Math.round(grams)} g)` : 'per 100 g',
    kcal: Math.round((n.calories || 0) * k),
    p: Math.round((n.protein || 0) * k),
    c: Math.round((n.carbs || 0) * k),
    f: Math.round((n.fat || 0) * k),
  };
}

export const isRecipe = (food) => (food?.ingredients || []).length > 0;

/**
 * The chat attach panel's list for one type: [{ id, name, detail, body }],
 * `body` being what to send. `lists` = { workouts, plans, exercises, foods }.
 */
export function attachList(lists, type) {
  if (type === 'workout') {
    return lists.workouts.map((w) => ({
      id: w._id, name: w.name, body: { workoutSession: w._id },
      detail: new Date(w.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    }));
  }
  if (type === 'plan') {
    return lists.plans.map((p) => ({
      id: p._id, name: p.name, body: { workoutPlan: p._id },
      detail: `${p.days.length} workout${p.days.length !== 1 ? 's' : ''}`,
    }));
  }
  if (type === 'exercise') return lists.exercises.map((e) => ({ id: e._id, name: e.name, detail: '', body: { exercise: e._id } }));
  return lists.foods.map((f) => ({ id: f._id, name: f.name, detail: isRecipe(f) ? 'recipe' : 'food', body: { food: f._id } }));
}

/** What the attach panel says when there's nothing of that type. */
export const ATTACH_EMPTY = {
  workout: 'No workouts logged yet.',
  plan: 'No workout plans yet.',
  exercise: 'You haven\'t made any custom exercises yet.',
  food: 'You haven\'t made any custom foods or recipes yet.',
};
