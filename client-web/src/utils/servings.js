/**
 * A weight in the food's own units where one fits exactly:
 * 150 g of eggs → "3 eggs (150 g)", otherwise "150 g".
 */
export function formatServing(food, grams) {
  const unit = (food.servings || []).find((s) => /^1 /.test(s.label) && s.grams > 0 && Math.abs(grams / s.grams - Math.round(grams / s.grams)) < 0.01);
  if (!unit) return `${grams} g`;
  const count = Math.round(grams / unit.grams);
  const name = unit.label.replace(/^1 /, '').replace(/\s*\(.*\)$/, '');
  return `${count} ${count === 1 ? name : `${name}s`} (${grams} g)`;
}
