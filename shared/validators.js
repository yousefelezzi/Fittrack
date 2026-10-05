/**
 * shared/validators.js
 *
 * Pure validation functions that can run in Node, the browser, and React Native
 * without any external dependencies.
 *
 * Every function returns { valid: boolean, message?: string }.
 */

const { PASSWORD_RULES, MACRO_KEYS } = require('./constants');

// ── Auth ─────────────────────────────────────────────────────────────────────

/**
 * Validate an email address (basic RFC 5322 surface check).
 */
function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return { valid: false, message: 'Email is required' };
  }
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!re.test(email.trim())) {
    return { valid: false, message: 'Please enter a valid email address' };
  }
  return { valid: true };
}

/**
 * Validate a password against the shared password rules.
 */
function validatePassword(password) {
  if (!password) return { valid: false, message: 'Password is required' };
  if (password.length < PASSWORD_RULES.minLength) {
    return { valid: false, message: `Password must be at least ${PASSWORD_RULES.minLength} characters` };
  }
  if (!PASSWORD_RULES.regex.test(password)) {
    return { valid: false, message: PASSWORD_RULES.hint };
  }
  return { valid: true };
}

/**
 * Validate that two password fields match.
 */
function validatePasswordConfirm(password, confirm) {
  if (!confirm) return { valid: false, message: 'Please confirm your password' };
  if (password !== confirm) return { valid: false, message: 'Passwords do not match' };
  return { valid: true };
}

/**
 * Validate a display name.
 */
function validateName(name) {
  if (!name || !name.trim()) return { valid: false, message: 'Name is required' };
  if (name.trim().length > 50) return { valid: false, message: 'Name must be 50 characters or fewer' };
  return { valid: true };
}

// ── Profile ──────────────────────────────────────────────────────────────────

/**
 * Validate a height value (centimetres, 50–300).
 */
function validateHeight(value) {
  if (value === '' || value === null || value === undefined) return { valid: true }; // optional
  const n = Number(value);
  if (isNaN(n) || n < 50 || n > 300) {
    return { valid: false, message: 'Height must be between 50 and 300 cm' };
  }
  return { valid: true };
}

/**
 * Validate a weight value (kilograms, 20–500).
 */
function validateWeight(value) {
  if (value === '' || value === null || value === undefined) return { valid: true }; // optional
  const n = Number(value);
  if (isNaN(n) || n < 20 || n > 500) {
    return { valid: false, message: 'Weight must be between 20 and 500 kg' };
  }
  return { valid: true };
}

// ── Workout / Exercise ───────────────────────────────────────────────────────

/**
 * Validate a workout name.
 */
function validateWorkoutName(name) {
  if (!name || !name.trim()) return { valid: false, message: 'Workout name is required' };
  if (name.trim().length > 100) return { valid: false, message: 'Name must be 100 characters or fewer' };
  return { valid: true };
}

/**
 * Validate a single set (reps + optional weight).
 */
function validateSet(set) {
  if (!set) return { valid: false, message: 'Set data is required' };
  const reps = Number(set.reps);
  if (!Number.isInteger(reps) || reps < 1) {
    return { valid: false, message: 'Reps must be a positive whole number' };
  }
  if (set.weight !== undefined && set.weight !== null && set.weight !== '') {
    const w = Number(set.weight);
    if (isNaN(w) || w < 0) return { valid: false, message: 'Weight must be a non-negative number' };
  }
  return { valid: true };
}

/**
 * Validate an array of exercises before logging a workout.
 * Returns the first error found, or { valid: true }.
 */
function validateExerciseList(exercises) {
  if (!Array.isArray(exercises) || exercises.length === 0) {
    return { valid: false, message: 'Add at least one exercise' };
  }
  for (let i = 0; i < exercises.length; i++) {
    const ex = exercises[i];
    if (!ex.exercise) return { valid: false, message: `Exercise ${i + 1} is missing` };
    if (!Array.isArray(ex.sets) || ex.sets.length === 0) {
      return { valid: false, message: `Exercise ${i + 1} needs at least one set` };
    }
    for (let j = 0; j < ex.sets.length; j++) {
      const result = validateSet(ex.sets[j]);
      if (!result.valid) return { valid: false, message: `Exercise ${i + 1}, set ${j + 1}: ${result.message}` };
    }
  }
  return { valid: true };
}

// ── Nutrition ────────────────────────────────────────────────────────────────

/**
 * Validate a single meal entry.
 * All macro fields are optional but must be non-negative numbers when present.
 */
function validateMeal(meal) {
  if (!meal?.name?.trim()) return { valid: false, message: 'Meal name is required' };
  for (const key of MACRO_KEYS) {
    const v = meal[key];
    if (v !== undefined && v !== null && v !== '') {
      const n = Number(v);
      if (isNaN(n) || n < 0) return { valid: false, message: `${key} must be a non-negative number` };
    }
  }
  return { valid: true };
}

/**
 * Validate daily macro goals object.
 */
function validateDailyGoals(goals) {
  for (const key of MACRO_KEYS) {
    const v = goals?.[key];
    if (v === undefined || v === null || v === '') continue; // skip unset
    const n = Number(v);
    if (isNaN(n) || n < 0) return { valid: false, message: `Daily ${key} goal must be a non-negative number` };
  }
  return { valid: true };
}

// ── Post / Social ────────────────────────────────────────────────────────────

/**
 * Validate a feed post before submission.
 * Must have either text or an image.
 */
function validatePost({ text, image, workoutSession } = {}) {
  const hasContent = (text && text.trim().length > 0) || image;
  if (!hasContent) return { valid: false, message: 'Post must include text or an image' };
  if (text && text.trim().length > 2000) return { valid: false, message: 'Post text must be 2000 characters or fewer' };
  return { valid: true };
}

/**
 * Validate a comment body.
 */
function validateComment(text) {
  if (!text || !text.trim()) return { valid: false, message: 'Comment cannot be empty' };
  if (text.trim().length > 500) return { valid: false, message: 'Comment must be 500 characters or fewer' };
  return { valid: true };
}

module.exports = {
  validateEmail,
  validatePassword,
  validatePasswordConfirm,
  validateName,
  validateHeight,
  validateWeight,
  validateWorkoutName,
  validateSet,
  validateExerciseList,
  validateMeal,
  validateDailyGoals,
  validatePost,
  validateComment,
};