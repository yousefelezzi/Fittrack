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
