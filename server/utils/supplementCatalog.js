/**
 * Common supplements, with the micronutrients in one serving at a typical
 * label dose (amounts use the same keys and units as food micros: see
 * MICRO_CONFIG in client-web/src/utils/foodLogic.js — vitamins A, D, K, B12,
 * folate and selenium in mcg; fiber and omega-3 in g; the rest in mg).
 * Products vary, so the app tells people to check their own label.
 *
 * Synced into the SupplementCatalog collection on server start (by name), so
 * editing this list updates the database.
 */
const CATALOG = [
  // ── Vitamins ──────────────────────────────────────────────────────────────
  { name: 'Multivitamin', serving: '1 tablet', category: 'vitamins', micros: {
    vitaminA: 900, vitaminC: 90, vitaminD: 25, vitaminE: 15, vitaminK: 120, vitaminB1: 1.2, vitaminB2: 1.3, vitaminB3: 16,
    vitaminB6: 1.7, vitaminB12: 2.4, folate: 400, calcium: 200, iron: 8, magnesium: 50, zinc: 11, selenium: 55 } },
  { name: 'Vitamin D3', serving: '1 softgel (1,000 IU)', category: 'vitamins', micros: { vitaminD: 25 } },
  { name: 'Vitamin D3 + K2', serving: '1 softgel (2,000 IU + 100 mcg)', category: 'vitamins', micros: { vitaminD: 50, vitaminK: 100 } },
  { name: 'Vitamin K2 (MK-7)', serving: '1 capsule (100 mcg)', category: 'vitamins', micros: { vitaminK: 100 } },
  { name: 'Vitamin C', serving: '1 tablet (500 mg)', category: 'vitamins', micros: { vitaminC: 500 } },
  { name: 'Vitamin A', serving: '1 softgel (1,500 mcg)', category: 'vitamins', micros: { vitaminA: 1500 } },
  { name: 'Vitamin E', serving: '1 softgel (400 IU, 268 mg)', category: 'vitamins', micros: { vitaminE: 268 } },
  { name: 'Vitamin B12', serving: '1 tablet (1,000 mcg)', category: 'vitamins', micros: { vitaminB12: 1000 } },
  { name: 'B-complex', serving: '1 capsule (B-50)', category: 'vitamins', micros: {
    vitaminB1: 50, vitaminB2: 50, vitaminB3: 50, vitaminB6: 50, vitaminB12: 50, folate: 400 } },
  { name: 'Folic acid', serving: '1 tablet (400 mcg)', category: 'vitamins', micros: { folate: 400 } },
  { name: 'Niacin (B3)', serving: '1 tablet (500 mg)', category: 'vitamins', micros: { vitaminB3: 500 } },
  { name: 'Vitamin B6', serving: '1 tablet (50 mg)', category: 'vitamins', micros: { vitaminB6: 50 } },
  { name: 'Prenatal vitamin', serving: '1 tablet', category: 'vitamins', micros: {
    vitaminA: 770, vitaminC: 85, vitaminD: 15, vitaminE: 15, vitaminB6: 1.9, vitaminB12: 2.6, folate: 600, calcium: 200, iron: 27, zinc: 11 } },

  // ── Minerals ──────────────────────────────────────────────────────────────
  { name: 'Calcium (carbonate)', serving: '1 tablet (500 mg)', category: 'minerals', micros: { calcium: 500 } },
  { name: 'Calcium + vitamin D', serving: '1 tablet (600 mg + 10 mcg)', category: 'minerals', micros: { calcium: 600, vitaminD: 10 } },
  { name: 'Magnesium (glycinate)', serving: '2 capsules (200 mg)', category: 'minerals', micros: { magnesium: 200 } },
  { name: 'Magnesium (citrate)', serving: '1 tablet (150 mg)', category: 'minerals', micros: { magnesium: 150 } },
  { name: 'ZMA', serving: '3 capsules', category: 'minerals', micros: { zinc: 30, magnesium: 450, vitaminB6: 10.5 } },
  { name: 'Zinc', serving: '1 tablet (15 mg)', category: 'minerals', micros: { zinc: 15 } },
  { name: 'Iron', serving: '1 tablet (18 mg)', category: 'minerals', micros: { iron: 18 } },
  { name: 'Potassium', serving: '1 tablet (99 mg)', category: 'minerals', micros: { potassium: 99 } },
  { name: 'Selenium', serving: '1 capsule (200 mcg)', category: 'minerals', micros: { selenium: 200 } },
  { name: 'Electrolytes', serving: '1 stick / tablet', category: 'minerals', micros: { sodium: 1000, potassium: 200, magnesium: 60 } },
  { name: 'Salt tablet', serving: '1 tablet', category: 'minerals', micros: { sodium: 180, potassium: 15 } },

  // ── Fats & fiber ──────────────────────────────────────────────────────────
  { name: 'Fish oil', serving: '1 softgel (1 g)', category: 'fats & fiber', micros: { omega3: 0.3 } },
  { name: 'Fish oil (high EPA/DHA)', serving: '1 softgel', category: 'fats & fiber', micros: { omega3: 0.6 } },
  { name: 'Cod liver oil', serving: '1 tsp (5 ml)', category: 'fats & fiber', micros: { omega3: 0.9, vitaminA: 1350, vitaminD: 11 } },
  { name: 'Algae omega-3', serving: '1 softgel', category: 'fats & fiber', micros: { omega3: 0.25 } },
  { name: 'Krill oil', serving: '2 softgels', category: 'fats & fiber', micros: { omega3: 0.25 } },
  { name: 'Psyllium husk', serving: '1 tbsp (about 5 g)', category: 'fats & fiber', micros: { fiber: 4 } },

  // ── Performance ──────────────────────────────────────────────────────────
  { name: 'Creatine monohydrate', serving: '5 g', category: 'performance', micros: { creatine: 5 } },
  { name: 'Caffeine', serving: '1 tablet (200 mg)', category: 'performance', micros: {} },
  { name: 'Pre-workout', serving: '1 scoop', category: 'performance', micros: {} },
  { name: 'Beta-alanine', serving: '3.2 g', category: 'performance', micros: {} },
  { name: 'L-citrulline', serving: '6 g', category: 'performance', micros: {} },
  { name: 'EAAs / BCAAs', serving: '1 scoop', category: 'performance', micros: {} },
  { name: 'HMB', serving: '3 g', category: 'performance', micros: {} },
  { name: 'Sodium bicarbonate', serving: '0.3 g per kg', category: 'performance', micros: {} },

  // ── Health & sleep ───────────────────────────────────────────────────────
  { name: 'Melatonin', serving: '1 tablet (1 mg)', category: 'health & sleep', micros: {} },
  { name: 'Ashwagandha', serving: '1 capsule (600 mg)', category: 'health & sleep', micros: {} },
  { name: 'Collagen peptides', serving: '1 scoop (10 g)', category: 'health & sleep', micros: {} },
  { name: 'Glucosamine', serving: '1 tablet (1,500 mg)', category: 'health & sleep', micros: {} },
  { name: 'Probiotic', serving: '1 capsule', category: 'health & sleep', micros: {} },
  { name: 'Turmeric / curcumin', serving: '1 capsule (500 mg)', category: 'health & sleep', micros: {} },
  { name: 'Iodine (kelp)', serving: '1 tablet (150 mcg)', category: 'health & sleep', micros: {} },

  // ── Sun ───────────────────────────────────────────────────────────────────
  // Skin makes vitamin D in midday sun. Roughly 1,000 IU from 15 minutes with
  // arms and legs bare in summer, for lighter skin; much less in winter, early or
  // late in the day, with darker skin or sunscreen, or far from the equator.
  { name: 'Sun exposure', serving: '15 min of midday sun, arms & legs bare', category: 'sun', micros: { vitaminD: 25 } },
];

module.exports = { CATALOG };
