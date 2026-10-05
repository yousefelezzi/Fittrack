/**
 * Nutrition values the web app shares across pages. The server's copy is
 * server/utils/nutritionConstants.js; keep MEAL_TYPES and DIETS in step with it.
 */

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];

export const DIETS = [
  { value: 'any', label: 'Anything' },
  { value: 'pescatarian', label: 'Pescatarian' },
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
];

/** Names for the profile fields nutrition targets need, as returned in `missing`. */
export const PROFILE_FIELD_NAMES = { weight: 'weight', height: 'height', dateOfBirth: 'date of birth', sex: 'sex' };
