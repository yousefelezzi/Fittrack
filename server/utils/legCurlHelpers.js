/**
 * Gastrocnemius on leg curls.
 *
 * The gastrocnemius crosses the knee as well as the ankle, so it helps bend the
 * knee: on leg curl variations (lying, seated, standing, single-leg, Nordic…)
 * it counts as a secondary muscle (0.5 − x per set) where it isn't listed.
 * Exercises that already list the whole calves are left alone (that includes it).
 */
const LEG_CURL_PATTERN = /\bleg[- ]?curls?\b|\bhamstring[- ]?curls?\b|\bnordic\b/i;

/** True when this exercise should get `gastrocnemius` as a secondary muscle. */
function needsSecondaryGastroc({ name = '', muscleGroups = [] }) {
  return LEG_CURL_PATTERN.test(name)
    && !muscleGroups.includes('gastrocnemius')
    && !muscleGroups.includes('calves');
}

module.exports = { needsSecondaryGastroc, LEG_CURL_PATTERN };
