/**
 * Exercise names that mean one arm or leg at a time. Used to mark existing
 * exercises and to suggest "unilateral" when someone names a custom exercise.
 * The web client has the same pattern (client-web/src/pages/Exercises.jsx).
 */
const UNILATERAL_NAME_PATTERN =
  /\b(single|one)[\s-]*(arm|leg|hand)\b|\bunilateral\b|\bcable lateral raise\b|\bdumbbell preacher curl\b/i;

module.exports = { UNILATERAL_NAME_PATTERN };
