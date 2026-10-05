/**
 * shared/formatters.js
 *
 * Pure display-formatting helpers with zero dependencies.
 * Safe to import in Node, React (web), and React Native (mobile).
 */

// ── Duration ─────────────────────────────────────────────────────────────────

/**
 * Format minutes into "Xh Ym" (e.g. 90 → "1h 30m", 45 → "45m").
 */
function formatDuration(totalMinutes) {
  if (!totalMinutes && totalMinutes !== 0) return '—';
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// ── Weight / measurements ─────────────────────────────────────────────────────

/**
 * Format a weight value with a unit label.
 * @param {number} value - The weight value
 * @param {'kg'|'lbs'} unit - Display unit
 */
function formatWeight(value, unit = 'kg') {
  if (value === null || value === undefined) return '—';
  const converted = unit === 'lbs' ? value * 2.20462 : value;
  return `${converted % 1 === 0 ? converted : converted.toFixed(1)} ${unit}`;
}

/**
 * Convert kg to lbs and round to 1 decimal place.
 */
function kgToLbs(kg) {
  return Math.round(kg * 22.0462) / 10;
}

/**
 * Convert lbs to kg and round to 1 decimal place.
 */
function lbsToKg(lbs) {
  return Math.round(lbs * 4.5359) / 10;
}

// ── Nutrition / macros ───────────────────────────────────────────────────────

/**
 * Sum a single macro across an array of meal objects.
 * @param {Array} meals
 * @param {'calories'|'protein'|'carbs'|'fat'} macro
 */
function sumMacro(meals, macro) {
  if (!Array.isArray(meals)) return 0;
  return meals.reduce((sum, m) => sum + (Number(m[macro]) || 0), 0);
}

/**
 * Calculate the percentage of a goal that has been reached.
 * Clamps to [0, 100].
 */
function macroProgress(current, goal) {
  if (!goal || goal <= 0) return 0;
  return Math.min(100, Math.round((current / goal) * 100));
}

// ── Dates ────────────────────────────────────────────────────────────────────

/**
 * Return a simple relative time string without any library dependency.
 * For longer intervals, falls back to the localised date string.
 */
function relativeTime(dateInput) {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const now  = Date.now();
  const diff = now - date.getTime(); // ms in the past

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours   = Math.floor(minutes / 60);
  const days    = Math.floor(hours   / 24);

  if (seconds < 5)  return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (minutes < 60) return `${minutes}m ago`;
  if (hours   < 24) return `${hours}h ago`;
  if (days    < 7)  return `${days}d ago`;

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Convert a Date (or ISO string) to 'YYYY-MM-DD' for API date params.
 */
function toDateParam(dateInput) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  return d.toISOString().slice(0, 10);
}

/**
 * Return a greeting based on the current hour.
 */
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}

// ── Estimated one-rep max (Epley formula) ────────────────────────────────────

/**
 * Estimate 1RM from a working set using the Epley formula.
 * @param {number} weight - Weight lifted
 * @param {number} reps   - Reps performed
 * @returns {number} Estimated 1RM (same unit as weight)
 */
function estimateOneRM(weight, reps) {
  if (!weight || !reps || reps <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30));
}

// ── Text helpers ─────────────────────────────────────────────────────────────

/**
 * Capitalise the first letter of a string and lower-case the rest.
 */
function capitalise(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Convert a snake_case or kebab-case string to Title Case.
 */
function toTitleCase(str) {
  if (!str) return '';
  return str
    .replace(/[_-]/g, ' ')
    .split(' ')
    .map(capitalise)
    .join(' ');
}

/**
 * Truncate a string to `maxLength` characters, appending '…' if cut.
 */
function truncate(str, maxLength = 80) {
  if (!str || str.length <= maxLength) return str ?? '';
  return str.slice(0, maxLength - 1) + '…';
}

/**
 * Get a user's initials (up to 2 characters) from their display name.
 */
function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

module.exports = {
  formatDuration,
  formatWeight,
  kgToLbs,
  lbsToKg,
  sumMacro,
  macroProgress,
  relativeTime,
  toDateParam,
  getGreeting,
  estimateOneRM,
  capitalise,
  toTitleCase,
  truncate,
  getInitials,
};