/**
 * Forearms only work hard on wrist curls and reverse curls. Everywhere else
 * (rows, pulldowns, curls, stiff-leg deadlifts, farmers walks…) they just hold
 * the grip, so they count as secondary there (0.5 per set instead of 1).
 */
// Wrist curls (incl. reverse wrist curls) and reverse curls keep forearms primary.
const FOREARM_PRIMARY_PATTERN = /wrist curl|reverse curl/i;

/** True when `forearms` on this exercise should be secondary. */
function forearmsAreSecondary({ name = '', muscleGroups = [] }) {
  return muscleGroups.includes('forearms') && !FOREARM_PRIMARY_PATTERN.test(name);
}

module.exports = { forearmsAreSecondary, FOREARM_PRIMARY_PATTERN };
