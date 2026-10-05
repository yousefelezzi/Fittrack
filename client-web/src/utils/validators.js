/**
 * Re-exports every validator from shared/validators.js for web components.
 *
 * Usage: import { validateEmail, validatePassword } from '../utils/validators';
 */
export {
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
} from '../../../shared/validators';