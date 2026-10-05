/**
 * Helper muscles on pulling movements.
 *
 * Elbow flexors — pulling movements (rows, pulldowns, pull-ups, face pulls…) bend the elbow
 * against load, so the elbow flexors (biceps, brachialis, brachioradialis)
 * work as helpers: they count as a secondary muscle (0.5 per set) on any pull
 * that doesn't already list them. Straight-arm moves (pullovers, straight-arm
 * pulldowns), shrugs and deadlifts don't bend the elbow, so they're left out.
 *
 * Pulls are recognised by their main (first) muscle and their name.
 */
const PULL_FIRST_MUSCLES = ['lats', 'trapezius', 'posterior delt'];
const PULL_PATTERN = /\brows?\b|pull[- ]?ups?|pull[- ]?downs?|chin[- ]?ups?|face[- ]?pulls?|inverted/i;
const NO_ELBOW_PATTERN = /straight[- ]arm|pull[- ]?over|shrug|deadlift/i;
const ELBOW_FLEXOR_TAGS = ['elbow flexors', 'biceps', 'brachialis/brachioradialis'];

/** True when this exercise should get `elbow flexors` as a secondary muscle. */
function needsSecondaryElbowFlexors({ name = '', muscleGroups = [] }) {
  return PULL_FIRST_MUSCLES.includes(muscleGroups[0])
    && PULL_PATTERN.test(name)
    && !NO_ELBOW_PATTERN.test(name)
    && !muscleGroups.some((m) => ELBOW_FLEXOR_TAGS.includes(m));
}

/**
 * Rear delts — a wide-grip pulldown pulls the upper arm down and back out to
 * the side, so the rear delts help: they count as secondary (0.5 per set).
 * Wide grip means a pulldown named "wide", or the standard "Lat Pulldown";
 * close, narrow, neutral, underhand/reverse and straight-arm ones are left out.
 */
const PULLDOWN_PATTERN = /pull[- ]?downs?/i;
const NOT_WIDE_PATTERN = /close|narrow|neutral|v[- ]bar|underhand|reverse|supinated|straight[- ]arm|single[- ]arm|one[- ]arm/i;

/** True when this exercise should get `posterior delt` as a secondary muscle. */
function needsSecondaryRearDelts({ name = '', muscleGroups = [] }) {
  return PULLDOWN_PATTERN.test(name)
    && (/wide/i.test(name) || /^lat pull[- ]?down$/i.test(name.trim()))
    && !NOT_WIDE_PATTERN.test(name)
    && !muscleGroups.includes('posterior delt');
}

module.exports = { needsSecondaryElbowFlexors, needsSecondaryRearDelts };
