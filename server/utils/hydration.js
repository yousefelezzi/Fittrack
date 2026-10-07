/**
 * Daily water goal in ml: the user's own, or about 35 ml per kg of body weight
 * (rounded to 50 ml), or 2,500 ml when the weight isn't known.
 */
function waterGoal(user) {
  if (user?.waterGoal) return user.waterGoal;
  if (user?.weight) return Math.round((user.weight * 35) / 50) * 50;
  return 2500;
}

/**
 * Minerals in a litre of water (mg), by the kind people drink. Typical values:
 * tap water varies a lot by area (hard water has more calcium and magnesium),
 * mineral waters by brand — the label lists them.
 */
const WATER_TYPES = {
  tap:      { label: 'Tap water',      perLitre: { calcium: 30,  magnesium: 8,  sodium: 15, potassium: 2 } },
  mineral:  { label: 'Mineral water',  perLitre: { calcium: 100, magnesium: 25, sodium: 15, potassium: 2 } },
  filtered: { label: 'Filtered / RO',  perLitre: { calcium: 5,   magnesium: 1,  sodium: 2,  potassium: 0 } },
};

/** Minerals (mg) in `ml` of the user's kind of water. */
function waterMinerals(ml, type) {
  const perLitre = (WATER_TYPES[type] || WATER_TYPES.tap).perLitre;
  return Object.fromEntries(Object.entries(perLitre).map(([k, v]) => [k, Math.round((v * ml) / 1000 * 10) / 10]));
}

module.exports = { waterGoal, waterMinerals, WATER_TYPES };
