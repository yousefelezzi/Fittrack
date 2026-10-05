/**
 * Small seeded random generator (xorshift), so "regenerate" gives a new plan
 * but the same seed always gives the same one. Returns numbers in [0, 1).
 */
function createRandom(seed) {
  let state = (Number(seed) || 1) >>> 0 || 1;
  return function next() {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 100000) / 100000;
  };
}

module.exports = { createRandom };
