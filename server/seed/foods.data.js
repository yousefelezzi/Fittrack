/**
 * Built-in food list: nutrition per 100 g, cooking yields and serving sizes.
 * Plain data with no dependencies, so the seed script and the tests can both
 * load it. Foods.seed.js writes it to the database.
 */

// All values per 100g. Micros: vitamins in mcg/mg as noted, minerals in mg, fiber/sugar/omega3 in g, cholesterol in mg.
const foods = [
  // ── PROTEINS ───────────────────────────────────────────────────────────────
  { name: 'Chicken Breast, cooked', category: 'protein',
    per100g: { calories: 165, protein: 31, carbs: 0, fat: 3.6,
      micros: { vitaminA: 9, vitaminC: 0, vitaminD: 0.1, vitaminB3: 13.7, vitaminB6: 1.0, vitaminB12: 0.3, phosphorus: 245, potassium: 358, sodium: 74, zinc: 1.0, selenium: 27, cholesterol: 85 } },
    servings: [{ label: '1 breast (174g)', grams: 174 }, { label: '100g', grams: 100 }] },

  { name: 'Chicken Thigh, cooked', category: 'protein',
    per100g: { calories: 209, protein: 26, carbs: 0, fat: 11,
      micros: { vitaminA: 15, vitaminB3: 6.5, vitaminB6: 0.5, vitaminB12: 0.3, phosphorus: 195, potassium: 247, sodium: 93, zinc: 2.4, selenium: 22, cholesterol: 93 } },
    servings: [{ label: '1 thigh (109g)', grams: 109 }, { label: '100g', grams: 100 }] },

  { name: 'Salmon, Atlantic, cooked', category: 'protein',
    per100g: { calories: 206, protein: 20, carbs: 0, fat: 13,
      micros: { vitaminA: 58, vitaminC: 0, vitaminD: 11.1, vitaminE: 1.1, vitaminB1: 0.2, vitaminB2: 0.2, vitaminB3: 8.9, vitaminB6: 0.6, vitaminB12: 3.2, calcium: 15, iron: 0.4, magnesium: 30, phosphorus: 280, potassium: 490, sodium: 59, zinc: 0.6, selenium: 36, omega3: 2.3, cholesterol: 71 } },
    servings: [{ label: '1 fillet (154g)', grams: 154 }, { label: '100g', grams: 100 }] },

  { name: 'Tuna, canned in water', category: 'protein',
    per100g: { calories: 109, protein: 25, carbs: 0, fat: 0.5,
      micros: { vitaminD: 1.7, vitaminB3: 14, vitaminB6: 0.4, vitaminB12: 2.5, phosphorus: 237, potassium: 237, sodium: 320, zinc: 0.7, selenium: 80, cholesterol: 30, omega3: 0.2 } },
    servings: [{ label: '1 can (142g)', grams: 142 }, { label: '100g', grams: 100 }] },

  { name: 'Tuna, canned in oil', category: 'protein',
    per100g: { calories: 198, protein: 29, carbs: 0, fat: 9,
      micros: { vitaminD: 2.5, vitaminB3: 16, vitaminB12: 3.0, phosphorus: 270, potassium: 210, sodium: 400, selenium: 90, cholesterol: 31, omega3: 0.3 } },
    servings: [{ label: '1 can (142g)', grams: 142 }, { label: '100g', grams: 100 }] },

  { name: 'Ground Beef, 80/20, cooked', category: 'protein',
    per100g: { calories: 254, protein: 26, carbs: 0, fat: 17,
      micros: { vitaminB2: 0.2, vitaminB3: 5.6, vitaminB6: 0.4, vitaminB12: 2.4, iron: 2.5, zinc: 6.3, selenium: 18, phosphorus: 195, potassium: 318, sodium: 80, cholesterol: 87 } },
    servings: [{ label: '100g', grams: 100 }, { label: '150g', grams: 150 }] },

  { name: 'Ground Beef, 90/10, cooked', category: 'protein',
    per100g: { calories: 196, protein: 28, carbs: 0, fat: 9,
      micros: { vitaminB2: 0.2, vitaminB3: 6.2, vitaminB6: 0.5, vitaminB12: 2.6, iron: 2.7, zinc: 6.9, selenium: 20, phosphorus: 210, potassium: 340, sodium: 72, cholesterol: 80 } },
    servings: [{ label: '100g', grams: 100 }, { label: '150g', grams: 150 }] },

  { name: 'Sirloin Steak, cooked', category: 'protein',
    per100g: { calories: 207, protein: 30, carbs: 0, fat: 9,
      micros: { vitaminB2: 0.2, vitaminB3: 7.5, vitaminB6: 0.6, vitaminB12: 1.6, iron: 2.1, zinc: 5.3, selenium: 33, phosphorus: 230, potassium: 370, sodium: 65, cholesterol: 89 } },
    servings: [{ label: '1 steak (221g)', grams: 221 }, { label: '100g', grams: 100 }] },

  { name: 'Tilapia, cooked', category: 'protein',
    per100g: { calories: 128, protein: 26, carbs: 0, fat: 2.7,
      micros: { vitaminD: 1.0, vitaminB3: 6.3, vitaminB6: 0.2, vitaminB12: 1.6, phosphorus: 205, potassium: 302, sodium: 52, selenium: 50, cholesterol: 57 } },
    servings: [{ label: '1 fillet (116g)', grams: 116 }, { label: '100g', grams: 100 }] },

  { name: 'Shrimp, cooked', category: 'protein',
    per100g: { calories: 99, protein: 24, carbs: 0, fat: 0.3,
      micros: { vitaminB12: 1.3, calcium: 70, iron: 0.5, phosphorus: 205, potassium: 185, sodium: 224, zinc: 1.3, selenium: 38, cholesterol: 189 } },
    servings: [{ label: '6 large (84g)', grams: 84 }, { label: '100g', grams: 100 }] },

  { name: 'Turkey Breast, cooked', category: 'protein',
    per100g: { calories: 189, protein: 29, carbs: 0, fat: 7.4,
      micros: { vitaminB3: 8.0, vitaminB6: 0.7, vitaminB12: 0.4, phosphorus: 215, potassium: 305, sodium: 70, zinc: 2.5, selenium: 30, cholesterol: 95 } },
    servings: [{ label: '3 slices (85g)', grams: 85 }, { label: '100g', grams: 100 }] },

  { name: 'Pork Tenderloin, cooked', category: 'protein',
    per100g: { calories: 166, protein: 29, carbs: 0, fat: 4.5,
      micros: { vitaminB1: 0.9, vitaminB2: 0.3, vitaminB3: 6.0, vitaminB6: 0.6, vitaminB12: 0.7, phosphorus: 280, potassium: 490, sodium: 62, zinc: 2.5, selenium: 42, cholesterol: 79 } },
    servings: [{ label: '100g', grams: 100 }, { label: '150g', grams: 150 }] },

  { name: 'Cod, cooked', category: 'protein',
    per100g: { calories: 105, protein: 23, carbs: 0, fat: 0.9,
      micros: { vitaminD: 1.0, vitaminB3: 3.6, vitaminB6: 0.3, vitaminB12: 1.0, calcium: 18, phosphorus: 230, potassium: 520, sodium: 78, selenium: 39, cholesterol: 55 } },
    servings: [{ label: '1 fillet (116g)', grams: 116 }, { label: '100g', grams: 100 }] },

  { name: 'Eggs, whole, large', category: 'protein',
    per100g: { calories: 155, protein: 13, carbs: 1.1, fat: 11,
      micros: { vitaminA: 160, vitaminD: 2.0, vitaminE: 1.1, vitaminK: 0.3, vitaminB2: 0.5, vitaminB3: 0.1, vitaminB6: 0.2, vitaminB12: 1.1, folate: 47, calcium: 56, iron: 1.8, phosphorus: 198, potassium: 138, sodium: 142, zinc: 1.3, selenium: 31, cholesterol: 373 } },
    servings: [{ label: '1 egg (50g)', grams: 50 }, { label: '2 eggs (100g)', grams: 100 }] },

  { name: 'Egg Whites', category: 'protein',
    per100g: { calories: 52, protein: 11, carbs: 0.7, fat: 0.2,
      micros: { vitaminB2: 0.4, vitaminB3: 0.1, vitaminB6: 0.0, folate: 4, calcium: 7, phosphorus: 15, potassium: 163, sodium: 166, selenium: 20 } },
    servings: [{ label: '1 white (33g)', grams: 33 }, { label: '100g', grams: 100 }] },

  // ── DAIRY ──────────────────────────────────────────────────────────────────
  { name: 'Greek Yogurt, plain, 0% fat', category: 'dairy',
    per100g: { calories: 59, protein: 10, carbs: 3.6, fat: 0.4,
      micros: { vitaminB2: 0.3, vitaminB12: 0.7, calcium: 110, phosphorus: 135, potassium: 141, sodium: 36, zinc: 0.5, selenium: 9 } },
    servings: [{ label: '1 cup (245g)', grams: 245 }, { label: '100g', grams: 100 }] },

  { name: 'Greek Yogurt, plain, 2% fat', category: 'dairy',
    per100g: { calories: 73, protein: 9.9, carbs: 3.8, fat: 1.9,
      micros: { vitaminA: 27, vitaminB2: 0.3, vitaminB12: 0.6, calcium: 100, phosphorus: 125, potassium: 130, sodium: 35, zinc: 0.6, cholesterol: 8 } },
    servings: [{ label: '1 cup (245g)', grams: 245 }, { label: '100g', grams: 100 }] },

  { name: 'Cottage Cheese, 1% fat', category: 'dairy',
    per100g: { calories: 72, protein: 12, carbs: 2.7, fat: 1,
      micros: { vitaminA: 37, vitaminB2: 0.2, vitaminB12: 0.4, calcium: 61, phosphorus: 134, potassium: 84, sodium: 406, zinc: 0.4, selenium: 11, cholesterol: 4 } },
    servings: [{ label: '1 cup (226g)', grams: 226 }, { label: '100g', grams: 100 }] },

  { name: 'Cottage Cheese, 4% fat', category: 'dairy',
    per100g: { calories: 98, protein: 11, carbs: 3.4, fat: 4.3,
      micros: { vitaminA: 52, vitaminB2: 0.2, vitaminB12: 0.4, calcium: 83, phosphorus: 159, potassium: 104, sodium: 364, zinc: 0.4, selenium: 13, cholesterol: 17 } },
    servings: [{ label: '1 cup (226g)', grams: 226 }, { label: '100g', grams: 100 }] },

  { name: 'Milk, whole', category: 'dairy',
    per100g: { calories: 61, protein: 3.2, carbs: 4.8, fat: 3.3,
      micros: { vitaminA: 46, vitaminD: 1.0, vitaminB2: 0.2, vitaminB12: 0.4, calcium: 113, phosphorus: 87, potassium: 150, sodium: 43, zinc: 0.4, selenium: 4, sugar: 5.1, cholesterol: 10 } },
    servings: [{ label: '1 cup (244g)', grams: 244 }, { label: '100g', grams: 100 }] },

  { name: 'Milk, 2% fat', category: 'dairy',
    per100g: { calories: 50, protein: 3.4, carbs: 4.9, fat: 2,
      micros: { vitaminA: 46, vitaminD: 1.0, vitaminB2: 0.2, vitaminB12: 0.5, calcium: 117, phosphorus: 94, potassium: 156, sodium: 47, zinc: 0.4, selenium: 4, sugar: 5.1, cholesterol: 8 } },
    servings: [{ label: '1 cup (244g)', grams: 244 }, { label: '100g', grams: 100 }] },

  { name: 'Milk, skimmed', category: 'dairy',
    per100g: { calories: 34, protein: 3.4, carbs: 5, fat: 0.1,
      micros: { vitaminA: 46, vitaminD: 1.0, vitaminB2: 0.2, vitaminB12: 0.5, calcium: 122, phosphorus: 101, potassium: 166, sodium: 52, zinc: 0.4, selenium: 5, sugar: 5.0 } },
    servings: [{ label: '1 cup (244g)', grams: 244 }, { label: '100g', grams: 100 }] },

  { name: 'Cheddar Cheese', category: 'dairy',
    per100g: { calories: 403, protein: 25, carbs: 1.3, fat: 33,
      micros: { vitaminA: 265, vitaminD: 0.6, vitaminE: 0.7, vitaminK: 2.8, vitaminB2: 0.4, vitaminB12: 0.8, calcium: 710, phosphorus: 455, potassium: 98, sodium: 620, zinc: 3.1, selenium: 14, cholesterol: 99 } },
    servings: [{ label: '1 slice (28g)', grams: 28 }, { label: '100g', grams: 100 }] },

  { name: 'Mozzarella, part-skim', category: 'dairy',
    per100g: { calories: 254, protein: 24, carbs: 2.8, fat: 16,
      micros: { vitaminA: 166, vitaminB2: 0.3, vitaminB12: 0.7, calcium: 505, phosphorus: 354, potassium: 76, sodium: 466, zinc: 2.9, selenium: 17, cholesterol: 54 } },
    servings: [{ label: '1 slice (28g)', grams: 28 }, { label: '100g', grams: 100 }] },

  { name: 'Whey Protein Powder', category: 'dairy',
    per100g: { calories: 375, protein: 75, carbs: 8.3, fat: 4.2,
      micros: { vitaminD: 2.5, calcium: 600, sodium: 200, potassium: 400, phosphorus: 500, zinc: 3.0, selenium: 25 } },
    servings: [{ label: '1 scoop (30g)', grams: 30 }, { label: '100g', grams: 100 }] },

  // ── GRAINS ─────────────────────────────────────────────────────────────────
  { name: 'White Rice, cooked', category: 'grains',
    per100g: { calories: 130, protein: 2.7, carbs: 28, fat: 0.3,
      micros: { vitaminB1: 0.2, vitaminB3: 1.5, folate: 58, iron: 0.2, magnesium: 12, phosphorus: 43, potassium: 35, sodium: 1, selenium: 7, fiber: 0.4, sugar: 0.1 } },
    servings: [{ label: '1 cup (186g)', grams: 186 }, { label: '100g', grams: 100 }] },

  { name: 'Brown Rice, cooked', category: 'grains',
    per100g: { calories: 112, protein: 2.6, carbs: 24, fat: 0.9,
      micros: { vitaminB1: 0.1, vitaminB3: 1.5, vitaminB6: 0.1, magnesium: 43, phosphorus: 83, potassium: 79, sodium: 4, selenium: 8, fiber: 1.8, sugar: 0.4 } },
    servings: [{ label: '1 cup (195g)', grams: 195 }, { label: '100g', grams: 100 }] },

  { name: 'Oats, dry', category: 'grains',
    per100g: { calories: 389, protein: 17, carbs: 66, fat: 7,
      micros: { vitaminB1: 0.8, vitaminB2: 0.1, vitaminB3: 1.0, vitaminB6: 0.1, folate: 56, iron: 4.7, magnesium: 177, phosphorus: 523, potassium: 429, sodium: 2, zinc: 4.0, selenium: 34, fiber: 10.6, sugar: 0 } },
    servings: [{ label: '½ cup (40g)', grams: 40 }, { label: '1 cup (80g)', grams: 80 }] },

  { name: 'Oatmeal, cooked', category: 'grains',
    per100g: { calories: 71, protein: 2.5, carbs: 12, fat: 1.5,
      micros: { vitaminB1: 0.2, iron: 0.7, magnesium: 26, phosphorus: 77, potassium: 61, sodium: 49, zinc: 0.6, fiber: 1.7 } },
    servings: [{ label: '1 cup (234g)', grams: 234 }, { label: '100g', grams: 100 }] },

  { name: 'Pasta, cooked', category: 'grains',
    per100g: { calories: 158, protein: 5.8, carbs: 31, fat: 0.9,
      micros: { vitaminB1: 0.1, folate: 7, iron: 0.5, magnesium: 18, phosphorus: 58, potassium: 44, sodium: 1, selenium: 26, fiber: 1.8 } },
    servings: [{ label: '1 cup (140g)', grams: 140 }, { label: '100g', grams: 100 }] },

  { name: 'Whole Wheat Pasta, cooked', category: 'grains',
    per100g: { calories: 124, protein: 5.3, carbs: 26, fat: 0.5,
      micros: { vitaminB1: 0.1, vitaminB3: 1.0, folate: 9, iron: 1.1, magnesium: 28, phosphorus: 89, potassium: 90, sodium: 3, fiber: 3.9 } },
    servings: [{ label: '1 cup (140g)', grams: 140 }, { label: '100g', grams: 100 }] },

  { name: 'Bread, white', category: 'grains',
    per100g: { calories: 265, protein: 9, carbs: 51, fat: 3.2,
      micros: { vitaminB1: 0.5, vitaminB2: 0.3, vitaminB3: 4.5, folate: 100, calcium: 182, iron: 2.7, potassium: 115, sodium: 490, fiber: 2.7, sugar: 5 } },
    servings: [{ label: '1 slice (30g)', grams: 30 }, { label: '2 slices (60g)', grams: 60 }] },

  { name: 'Bread, whole wheat', category: 'grains',
    per100g: { calories: 247, protein: 13, carbs: 41, fat: 4.2,
      micros: { vitaminB1: 0.4, vitaminB3: 4.0, vitaminE: 0.4, folate: 40, calcium: 107, iron: 3.0, magnesium: 76, phosphorus: 212, potassium: 248, sodium: 400, zinc: 1.8, fiber: 6.8, sugar: 4.0 } },
    servings: [{ label: '1 slice (30g)', grams: 30 }, { label: '2 slices (60g)', grams: 60 }] },

  { name: 'Quinoa, cooked', category: 'grains',
    per100g: { calories: 120, protein: 4.4, carbs: 22, fat: 1.9,
      micros: { vitaminB1: 0.1, vitaminB2: 0.1, vitaminB3: 0.4, vitaminB6: 0.1, folate: 42, iron: 1.5, magnesium: 64, phosphorus: 152, potassium: 172, sodium: 7, zinc: 1.1, fiber: 2.8 } },
    servings: [{ label: '1 cup (185g)', grams: 185 }, { label: '100g', grams: 100 }] },

  { name: 'Tortilla, flour (20cm)', category: 'grains',
    per100g: { calories: 306, protein: 8.1, carbs: 53, fat: 7.3,
      micros: { vitaminB1: 0.4, folate: 100, calcium: 120, iron: 3.5, sodium: 559, fiber: 3.1, sugar: 3 } },
    servings: [{ label: '1 tortilla (45g)', grams: 45 }, { label: '100g', grams: 100 }] },

  { name: 'Bagel, plain', category: 'grains',
    per100g: { calories: 272, protein: 10, carbs: 53, fat: 1.7,
      micros: { vitaminB1: 0.5, folate: 120, calcium: 51, iron: 3.2, sodium: 470, fiber: 2.3 } },
    servings: [{ label: '1 bagel (98g)', grams: 98 }, { label: '100g', grams: 100 }] },

  { name: 'Crackers, whole wheat', category: 'grains',
    per100g: { calories: 432, protein: 10, carbs: 66, fat: 14,
      micros: { vitaminB1: 0.4, iron: 2.5, sodium: 670, fiber: 6.5 } },
    servings: [{ label: '5 crackers (16g)', grams: 16 }, { label: '100g', grams: 100 }] },

  // ── LEGUMES ────────────────────────────────────────────────────────────────
  { name: 'Black Beans, cooked', category: 'legumes',
    per100g: { calories: 132, protein: 8.9, carbs: 24, fat: 0.5,
      micros: { vitaminB1: 0.2, folate: 149, iron: 2.1, magnesium: 70, phosphorus: 140, potassium: 355, sodium: 1, zinc: 1.0, fiber: 8.7, sugar: 0.3 } },
    servings: [{ label: '1 cup (172g)', grams: 172 }, { label: '100g', grams: 100 }] },

  { name: 'Chickpeas, cooked', category: 'legumes',
    per100g: { calories: 164, protein: 8.9, carbs: 27, fat: 2.6,
      micros: { vitaminB1: 0.1, vitaminB6: 0.1, folate: 172, iron: 2.9, magnesium: 48, phosphorus: 168, potassium: 291, sodium: 7, zinc: 1.5, fiber: 7.6, sugar: 4.8 } },
    servings: [{ label: '1 cup (164g)', grams: 164 }, { label: '100g', grams: 100 }] },

  { name: 'Lentils, cooked', category: 'legumes',
    per100g: { calories: 116, protein: 9, carbs: 20, fat: 0.4,
      micros: { vitaminB1: 0.2, vitaminB3: 1.1, vitaminB6: 0.2, folate: 181, iron: 3.3, magnesium: 36, phosphorus: 180, potassium: 369, sodium: 2, zinc: 1.3, selenium: 2.8, fiber: 7.9 } },
    servings: [{ label: '1 cup (198g)', grams: 198 }, { label: '100g', grams: 100 }] },

  { name: 'Kidney Beans, cooked', category: 'legumes',
    per100g: { calories: 127, protein: 8.7, carbs: 23, fat: 0.5,
      micros: { vitaminB1: 0.2, folate: 130, iron: 2.2, magnesium: 45, phosphorus: 142, potassium: 405, sodium: 2, zinc: 1.1, fiber: 6.4 } },
    servings: [{ label: '1 cup (177g)', grams: 177 }, { label: '100g', grams: 100 }] },

  { name: 'Edamame, shelled', category: 'legumes',
    per100g: { calories: 121, protein: 11, carbs: 8.9, fat: 5.2,
      micros: { vitaminC: 6.1, vitaminK: 26, folate: 303, iron: 2.3, magnesium: 64, phosphorus: 169, potassium: 436, sodium: 6, zinc: 1.4, fiber: 5.2 } },
    servings: [{ label: '1 cup (155g)', grams: 155 }, { label: '100g', grams: 100 }] },

  { name: 'Peanut Butter', category: 'legumes',
    per100g: { calories: 588, protein: 25, carbs: 20, fat: 50,
      micros: { vitaminE: 9.1, vitaminB3: 13.1, vitaminB6: 0.4, folate: 87, magnesium: 168, phosphorus: 358, potassium: 649, sodium: 428, zinc: 2.9, fiber: 6.0, sugar: 9.2, cholesterol: 0 } },
    servings: [{ label: '2 tbsp (32g)', grams: 32 }, { label: '100g', grams: 100 }] },

  // ── VEGETABLES ─────────────────────────────────────────────────────────────
  { name: 'Broccoli, raw', category: 'vegetables',
    per100g: { calories: 34, protein: 2.8, carbs: 7, fat: 0.4,
      micros: { vitaminA: 31, vitaminC: 89.2, vitaminE: 0.8, vitaminK: 102, vitaminB1: 0.1, vitaminB2: 0.1, vitaminB3: 0.6, vitaminB6: 0.2, folate: 63, calcium: 47, iron: 0.7, magnesium: 21, phosphorus: 66, potassium: 316, sodium: 33, zinc: 0.4, fiber: 2.6, sugar: 1.7 } },
    servings: [{ label: '1 cup chopped (91g)', grams: 91 }, { label: '100g', grams: 100 }] },

  { name: 'Spinach, raw', category: 'vegetables',
    per100g: { calories: 23, protein: 2.9, carbs: 3.6, fat: 0.4,
      micros: { vitaminA: 469, vitaminC: 28.1, vitaminE: 2.0, vitaminK: 483, vitaminB2: 0.2, vitaminB6: 0.2, folate: 194, calcium: 99, iron: 2.7, magnesium: 79, phosphorus: 49, potassium: 558, sodium: 79, zinc: 0.5, fiber: 2.2 } },
    servings: [{ label: '1 cup (30g)', grams: 30 }, { label: '100g', grams: 100 }] },

  { name: 'Sweet Potato, cooked', category: 'vegetables',
    per100g: { calories: 90, protein: 2, carbs: 21, fat: 0.1,
      micros: { vitaminA: 961, vitaminC: 19.6, vitaminB1: 0.1, vitaminB2: 0.1, vitaminB6: 0.3, folate: 6, calcium: 38, iron: 0.7, magnesium: 27, phosphorus: 54, potassium: 475, sodium: 36, fiber: 3.3, sugar: 4.2 } },
    servings: [{ label: '1 medium (130g)', grams: 130 }, { label: '100g', grams: 100 }] },

  { name: 'White Potato, baked', category: 'vegetables',
    per100g: { calories: 93, protein: 2.5, carbs: 21, fat: 0.1,
      micros: { vitaminC: 12.6, vitaminB1: 0.1, vitaminB3: 1.7, vitaminB6: 0.3, folate: 16, iron: 1.1, magnesium: 28, phosphorus: 70, potassium: 544, sodium: 10, fiber: 2.2, sugar: 1.0 } },
    servings: [{ label: '1 medium (173g)', grams: 173 }, { label: '100g', grams: 100 }] },

  { name: 'Carrots, raw', category: 'vegetables',
    per100g: { calories: 41, protein: 0.9, carbs: 10, fat: 0.2,
      micros: { vitaminA: 835, vitaminC: 5.9, vitaminK: 13.2, vitaminB1: 0.1, vitaminB6: 0.1, folate: 19, calcium: 33, iron: 0.3, magnesium: 12, phosphorus: 35, potassium: 320, sodium: 69, fiber: 2.8, sugar: 4.7 } },
    servings: [{ label: '1 medium (61g)', grams: 61 }, { label: '100g', grams: 100 }] },

  { name: 'Cucumber, raw', category: 'vegetables',
    per100g: { calories: 15, protein: 0.7, carbs: 3.6, fat: 0.1,
      micros: { vitaminC: 2.8, vitaminK: 16.4, potassium: 147, sodium: 2, fiber: 0.5, sugar: 1.7 } },
    servings: [{ label: '1 cup sliced (119g)', grams: 119 }, { label: '100g', grams: 100 }] },

  { name: 'Tomato, raw', category: 'vegetables',
    per100g: { calories: 18, protein: 0.9, carbs: 3.9, fat: 0.2,
      micros: { vitaminA: 42, vitaminC: 13.7, vitaminE: 0.5, vitaminK: 7.9, vitaminB6: 0.1, folate: 15, calcium: 10, iron: 0.3, magnesium: 11, phosphorus: 24, potassium: 237, sodium: 5, fiber: 1.2, sugar: 2.6 } },
    servings: [{ label: '1 medium (123g)', grams: 123 }, { label: '100g', grams: 100 }] },

  { name: 'Bell Pepper, red', category: 'vegetables',
    per100g: { calories: 31, protein: 1, carbs: 6, fat: 0.3,
      micros: { vitaminA: 157, vitaminC: 127.7, vitaminE: 1.6, vitaminK: 4.9, vitaminB6: 0.3, folate: 46, calcium: 7, iron: 0.4, magnesium: 12, phosphorus: 26, potassium: 211, sodium: 4, fiber: 2.1, sugar: 4.2 } },
    servings: [{ label: '1 medium (119g)', grams: 119 }, { label: '100g', grams: 100 }] },

  { name: 'Kale, raw', category: 'vegetables',
    per100g: { calories: 35, protein: 2.9, carbs: 4.4, fat: 1.5,
      micros: { vitaminA: 500, vitaminC: 93.4, vitaminE: 1.5, vitaminK: 817, vitaminB1: 0.1, vitaminB6: 0.3, folate: 141, calcium: 150, iron: 1.5, magnesium: 47, phosphorus: 92, potassium: 491, sodium: 53, fiber: 3.6 } },
    servings: [{ label: '1 cup chopped (67g)', grams: 67 }, { label: '100g', grams: 100 }] },

  { name: 'Corn, cooked', category: 'vegetables',
    per100g: { calories: 86, protein: 3.3, carbs: 19, fat: 1.4,
      micros: { vitaminC: 6.8, vitaminB1: 0.2, vitaminB3: 1.7, vitaminB6: 0.1, folate: 46, magnesium: 26, phosphorus: 89, potassium: 270, sodium: 15, zinc: 0.5, fiber: 2.4, sugar: 3.2 } },
    servings: [{ label: '1 ear (90g)', grams: 90 }, { label: '100g', grams: 100 }] },

  { name: 'Peas, cooked', category: 'vegetables',
    per100g: { calories: 84, protein: 5.4, carbs: 15, fat: 0.4,
      micros: { vitaminA: 38, vitaminC: 14.2, vitaminK: 24.8, vitaminB1: 0.3, vitaminB3: 1.8, vitaminB6: 0.2, folate: 65, iron: 1.5, magnesium: 39, phosphorus: 117, potassium: 271, sodium: 5, zinc: 1.2, fiber: 5.7, sugar: 5.7 } },
    servings: [{ label: '1 cup (160g)', grams: 160 }, { label: '100g', grams: 100 }] },

  { name: 'Avocado', category: 'vegetables',
    per100g: { calories: 160, protein: 2, carbs: 9, fat: 15,
      micros: { vitaminC: 10, vitaminE: 2.1, vitaminK: 21, vitaminB1: 0.1, vitaminB2: 0.1, vitaminB3: 1.7, vitaminB6: 0.3, folate: 81, calcium: 12, iron: 0.6, magnesium: 29, phosphorus: 52, potassium: 485, sodium: 7, zinc: 0.6, fiber: 6.7, omega3: 0.1 } },
    servings: [{ label: '½ avocado (68g)', grams: 68 }, { label: '1 avocado (136g)', grams: 136 }] },

  { name: 'Mushrooms, raw', category: 'vegetables',
    per100g: { calories: 22, protein: 3.1, carbs: 3.3, fat: 0.3,
      micros: { vitaminD: 0.2, vitaminB2: 0.4, vitaminB3: 3.6, vitaminB6: 0.1, folate: 17, iron: 0.5, phosphorus: 86, potassium: 318, sodium: 5, selenium: 9.3, fiber: 1.0 } },
    servings: [{ label: '1 cup (70g)', grams: 70 }, { label: '100g', grams: 100 }] },

  // ── FRUITS ─────────────────────────────────────────────────────────────────
  { name: 'Banana', category: 'fruits',
    per100g: { calories: 89, protein: 1.1, carbs: 23, fat: 0.3,
      micros: { vitaminC: 8.7, vitaminB1: 0.0, vitaminB2: 0.1, vitaminB3: 0.7, vitaminB6: 0.4, folate: 20, calcium: 5, iron: 0.3, magnesium: 27, phosphorus: 22, potassium: 358, sodium: 1, fiber: 2.6, sugar: 12.2 } },
    servings: [{ label: '1 medium (118g)', grams: 118 }, { label: '100g', grams: 100 }] },

  { name: 'Apple', category: 'fruits',
    per100g: { calories: 52, protein: 0.3, carbs: 14, fat: 0.2,
      micros: { vitaminC: 4.6, vitaminK: 2.2, potassium: 107, sodium: 1, fiber: 2.4, sugar: 10.4 } },
    servings: [{ label: '1 medium (182g)', grams: 182 }, { label: '100g', grams: 100 }] },

  { name: 'Blueberries', category: 'fruits',
    per100g: { calories: 57, protein: 0.7, carbs: 14, fat: 0.3,
      micros: { vitaminC: 9.7, vitaminE: 0.6, vitaminK: 19.3, calcium: 6, iron: 0.3, magnesium: 6, phosphorus: 12, potassium: 77, sodium: 1, fiber: 2.4, sugar: 10 } },
    servings: [{ label: '1 cup (148g)', grams: 148 }, { label: '100g', grams: 100 }] },

  { name: 'Strawberries', category: 'fruits',
    per100g: { calories: 32, protein: 0.7, carbs: 7.7, fat: 0.3,
      micros: { vitaminC: 58.8, vitaminB6: 0.1, folate: 24, calcium: 16, iron: 0.4, magnesium: 13, phosphorus: 24, potassium: 153, sodium: 1, fiber: 2.0, sugar: 4.9 } },
    servings: [{ label: '1 cup (152g)', grams: 152 }, { label: '100g', grams: 100 }] },

  { name: 'Orange', category: 'fruits',
    per100g: { calories: 47, protein: 0.9, carbs: 12, fat: 0.1,
      micros: { vitaminC: 53.2, vitaminB1: 0.1, vitaminB6: 0.1, folate: 30, calcium: 40, iron: 0.1, magnesium: 10, phosphorus: 14, potassium: 181, sodium: 0, fiber: 2.4, sugar: 9.4 } },
    servings: [{ label: '1 medium (131g)', grams: 131 }, { label: '100g', grams: 100 }] },

  { name: 'Grapes', category: 'fruits',
    per100g: { calories: 69, protein: 0.7, carbs: 18, fat: 0.2,
      micros: { vitaminC: 3.2, vitaminK: 14.6, potassium: 191, sodium: 2, fiber: 0.9, sugar: 15.5 } },
    servings: [{ label: '1 cup (92g)', grams: 92 }, { label: '100g', grams: 100 }] },

  { name: 'Watermelon', category: 'fruits',
    per100g: { calories: 30, protein: 0.6, carbs: 7.6, fat: 0.2,
      micros: { vitaminA: 28, vitaminC: 8.1, vitaminB1: 0.0, vitaminB6: 0.0, potassium: 112, sodium: 1, fiber: 0.4, sugar: 6.2 } },
    servings: [{ label: '1 cup diced (152g)', grams: 152 }, { label: '100g', grams: 100 }] },

  { name: 'Mango', category: 'fruits',
    per100g: { calories: 60, protein: 0.8, carbs: 15, fat: 0.4,
      micros: { vitaminA: 54, vitaminC: 36.4, vitaminE: 0.9, vitaminK: 4.2, vitaminB1: 0.1, vitaminB6: 0.1, folate: 43, calcium: 11, iron: 0.2, magnesium: 10, potassium: 168, sodium: 1, fiber: 1.6, sugar: 13.7 } },
    servings: [{ label: '1 cup (165g)', grams: 165 }, { label: '100g', grams: 100 }] },

  { name: 'Pineapple', category: 'fruits',
    per100g: { calories: 50, protein: 0.5, carbs: 13, fat: 0.1,
      micros: { vitaminC: 47.8, vitaminB1: 0.1, vitaminB6: 0.1, folate: 18, calcium: 13, iron: 0.3, magnesium: 12, phosphorus: 8, potassium: 109, sodium: 1, fiber: 1.4, sugar: 9.9 } },
    servings: [{ label: '1 cup chunks (165g)', grams: 165 }, { label: '100g', grams: 100 }] },

  // ── FATS & OILS ────────────────────────────────────────────────────────────
  { name: 'Olive Oil', category: 'fats',
    per100g: { calories: 884, protein: 0, carbs: 0, fat: 100,
      micros: { vitaminE: 14.4, vitaminK: 60.2, omega3: 0.8 } },
    servings: [{ label: '1 tbsp (14g)', grams: 14 }, { label: '100g', grams: 100 }] },

  { name: 'Butter', category: 'fats',
    per100g: { calories: 717, protein: 0.9, carbs: 0.1, fat: 81,
      micros: { vitaminA: 684, vitaminD: 1.5, vitaminE: 2.3, vitaminK: 7.0, calcium: 24, sodium: 643, cholesterol: 215 } },
    servings: [{ label: '1 tbsp (14g)', grams: 14 }, { label: '100g', grams: 100 }] },

  { name: 'Almonds', category: 'nuts',
    per100g: { calories: 579, protein: 21, carbs: 22, fat: 50,
      micros: { vitaminE: 25.6, vitaminB2: 1.1, vitaminB3: 3.6, folate: 44, calcium: 264, iron: 3.7, magnesium: 270, phosphorus: 481, potassium: 733, sodium: 1, zinc: 3.1, selenium: 4, fiber: 12.5 } },
    servings: [{ label: '¼ cup (28g)', grams: 28 }, { label: '100g', grams: 100 }] },

  { name: 'Walnuts', category: 'nuts',
    per100g: { calories: 654, protein: 15, carbs: 14, fat: 65,
      micros: { vitaminE: 0.7, vitaminB1: 0.3, vitaminB6: 0.5, folate: 98, calcium: 98, iron: 2.9, magnesium: 158, phosphorus: 346, potassium: 441, sodium: 2, zinc: 3.1, fiber: 6.7, omega3: 9.1 } },
    servings: [{ label: '¼ cup (29g)', grams: 29 }, { label: '100g', grams: 100 }] },

  { name: 'Cashews', category: 'nuts',
    per100g: { calories: 553, protein: 18, carbs: 30, fat: 44,
      micros: { vitaminE: 0.9, vitaminB1: 0.4, vitaminB6: 0.4, folate: 25, iron: 6.7, magnesium: 292, phosphorus: 593, potassium: 660, sodium: 12, zinc: 5.8, selenium: 11, fiber: 3.3 } },
    servings: [{ label: '¼ cup (28g)', grams: 28 }, { label: '100g', grams: 100 }] },

  // ── FAST FOOD ──────────────────────────────────────────────────────────────
  { name: 'Pizza, cheese, 1 slice', category: 'fast food',
    per100g: { calories: 266, protein: 11, carbs: 33, fat: 10,
      micros: { vitaminA: 100, vitaminB2: 0.2, calcium: 200, iron: 1.5, sodium: 550, fiber: 1.5, cholesterol: 20 } },
    servings: [{ label: '1 slice (107g)', grams: 107 }, { label: '100g', grams: 100 }] },

  { name: 'Burger, beef patty + bun', category: 'fast food',
    per100g: { calories: 249, protein: 13, carbs: 23, fat: 11,
      micros: { vitaminB12: 1.0, iron: 2.0, sodium: 480, zinc: 3.0, cholesterol: 45, fiber: 0.8 } },
    servings: [{ label: '1 burger (215g)', grams: 215 }, { label: '100g', grams: 100 }] },

  { name: 'French Fries', category: 'fast food',
    per100g: { calories: 312, protein: 3.4, carbs: 41, fat: 15,
      micros: { vitaminC: 6.0, vitaminB6: 0.3, potassium: 579, sodium: 210, fiber: 3.8 } },
    servings: [{ label: 'Small (71g)', grams: 71 }, { label: 'Medium (117g)', grams: 117 }, { label: 'Large (154g)', grams: 154 }] },

  { name: 'Hot Dog, in bun', category: 'fast food',
    per100g: { calories: 260, protein: 10, carbs: 23, fat: 14,
      micros: { vitaminB12: 0.5, iron: 1.2, sodium: 670, zinc: 1.5, cholesterol: 40 } },
    servings: [{ label: '1 hot dog (98g)', grams: 98 }, { label: '100g', grams: 100 }] },

  // ── SNACKS ─────────────────────────────────────────────────────────────────
  { name: 'Dark Chocolate (70-85%)', category: 'snacks',
    per100g: { calories: 598, protein: 7.8, carbs: 46, fat: 43,
      micros: { vitaminE: 0.6, iron: 11.9, magnesium: 228, phosphorus: 308, potassium: 715, sodium: 20, zinc: 3.3, selenium: 6.8, fiber: 10.9, sugar: 24, cholesterol: 3 } },
    servings: [{ label: '1 square (10g)', grams: 10 }, { label: '100g', grams: 100 }] },

  { name: 'Milk Chocolate', category: 'snacks',
    per100g: { calories: 535, protein: 7.6, carbs: 60, fat: 30,
      micros: { vitaminA: 30, vitaminB2: 0.3, vitaminB12: 0.5, calcium: 190, iron: 2.4, sodium: 79, sugar: 52, cholesterol: 23 } },
    servings: [{ label: '1 bar (45g)', grams: 45 }, { label: '100g', grams: 100 }] },

  { name: 'Granola Bar', category: 'snacks',
    per100g: { calories: 471, protein: 8, carbs: 64, fat: 20,
      micros: { vitaminE: 1.5, iron: 3.5, sodium: 310, fiber: 4.0, sugar: 28 } },
    servings: [{ label: '1 bar (47g)', grams: 47 }, { label: '100g', grams: 100 }] },

  { name: 'Potato Chips', category: 'snacks',
    per100g: { calories: 536, protein: 7, carbs: 53, fat: 35,
      micros: { vitaminC: 9.7, vitaminB3: 3.8, vitaminB6: 0.3, potassium: 1642, sodium: 525, fiber: 4.8 } },
    servings: [{ label: 'Small bag (28g)', grams: 28 }, { label: '100g', grams: 100 }] },

  { name: 'Rice Cakes', category: 'snacks',
    per100g: { calories: 387, protein: 8.2, carbs: 81, fat: 3,
      micros: { vitaminB1: 0.1, iron: 0.7, sodium: 30, fiber: 1.9 } },
    servings: [{ label: '1 cake (9g)', grams: 9 }, { label: '100g', grams: 100 }] },

  { name: 'Hummus', category: 'snacks',
    per100g: { calories: 166, protein: 7.9, carbs: 14, fat: 9.6,
      micros: { vitaminC: 3.0, vitaminB1: 0.1, vitaminB6: 0.2, folate: 83, iron: 2.4, magnesium: 38, phosphorus: 154, potassium: 228, sodium: 298, zinc: 1.3, fiber: 6.0 } },
    servings: [{ label: '2 tbsp (30g)', grams: 30 }, { label: '100g', grams: 100 }] },

  { name: 'Protein Bar (generic)', category: 'snacks',
    per100g: { calories: 380, protein: 30, carbs: 40, fat: 10,
      micros: { vitaminD: 2.5, calcium: 350, iron: 5.4, sodium: 280, zinc: 3.8, selenium: 20, fiber: 5.0, sugar: 20, cholesterol: 10 } },
    servings: [{ label: '1 bar (60g)', grams: 60 }, { label: '100g', grams: 100 }] },

  // ── BEVERAGES ──────────────────────────────────────────────────────────────
  { name: 'Orange Juice', category: 'beverages',
    per100g: { calories: 45, protein: 0.7, carbs: 10, fat: 0.2,
      micros: { vitaminC: 50, folate: 30, calcium: 11, potassium: 200, sodium: 1, sugar: 8.4 } },
    servings: [{ label: '1 cup (248g)', grams: 248 }, { label: '100g', grams: 100 }] },

  { name: 'Almond Milk, unsweetened', category: 'beverages',
    per100g: { calories: 15, protein: 0.6, carbs: 0.6, fat: 1.3,
      micros: { vitaminD: 1.0, vitaminE: 4.0, calcium: 190, potassium: 77, sodium: 140 } },
    servings: [{ label: '1 cup (240g)', grams: 240 }, { label: '100g', grams: 100 }] },

  { name: 'Coconut Water', category: 'beverages',
    per100g: { calories: 19, protein: 0.7, carbs: 3.7, fat: 0.2,
      micros: { vitaminC: 2.4, calcium: 24, magnesium: 25, potassium: 250, sodium: 105, sugar: 2.6 } },
    servings: [{ label: '1 cup (240g)', grams: 240 }, { label: '100g', grams: 100 }] },

  { name: 'Protein Shake (with water)', category: 'beverages',
    per100g: { calories: 67, protein: 13, carbs: 2.5, fat: 0.8,
      micros: { vitaminD: 1.5, calcium: 200, sodium: 80, potassium: 150, phosphorus: 180, zinc: 1.5, selenium: 10 } },
    servings: [{ label: '1 serving (300ml)', grams: 300 }, { label: '100g', grams: 100 }] },

  { name: 'Coffee, black', category: 'beverages',
    per100g: { calories: 2, protein: 0.3, carbs: 0, fat: 0, micros: { potassium: 49 } },
    servings: [{ label: '1 cup (240g)', grams: 240 }, { label: '100g', grams: 100 }] },

  { name: 'Tea, black, brewed', category: 'beverages',
    per100g: { calories: 1, protein: 0, carbs: 0.3, fat: 0, micros: { potassium: 20 } },
    servings: [{ label: '1 cup (240g)', grams: 240 }, { label: '100g', grams: 100 }] },

  { name: 'Soda, Cola', category: 'beverages',
    per100g: { calories: 41, protein: 0, carbs: 10.6, fat: 0, micros: { sodium: 4, sugar: 10.6 } },
    servings: [{ label: '1 can (355g)', grams: 355 }, { label: '100g', grams: 100 }] },

  { name: 'Diet Soda', category: 'beverages',
    per100g: { calories: 0, protein: 0, carbs: 0, fat: 0, micros: { sodium: 14 } },
    servings: [{ label: '1 can (355g)', grams: 355 }, { label: '100g', grams: 100 }] },

  { name: 'Beer, regular', category: 'beverages',
    per100g: { calories: 43, protein: 0.5, carbs: 3.6, fat: 0, micros: { potassium: 27, sodium: 4 } },
    servings: [{ label: '1 can (355g)', grams: 355 }, { label: '100g', grams: 100 }] },

  { name: 'Wine, red', category: 'beverages',
    per100g: { calories: 85, protein: 0.1, carbs: 2.6, fat: 0, micros: { potassium: 127, iron: 0.5 } },
    servings: [{ label: '1 glass (147g)', grams: 147 }, { label: '100g', grams: 100 }] },

  { name: 'Sports Drink (Gatorade-style)', category: 'beverages',
    per100g: { calories: 24, protein: 0, carbs: 6, fat: 0, micros: { sodium: 41, potassium: 12, sugar: 6 } },
    servings: [{ label: '1 bottle (591g)', grams: 591 }, { label: '100g', grams: 100 }] },

  { name: 'Energy Drink', category: 'beverages',
    per100g: { calories: 45, protein: 0.5, carbs: 11, fat: 0, micros: { sodium: 20, sugar: 11 } },
    servings: [{ label: '1 can (250g)', grams: 250 }, { label: '100g', grams: 100 }] },

  { name: 'Apple Juice', category: 'beverages',
    per100g: { calories: 46, protein: 0.1, carbs: 11.3, fat: 0.1, micros: { vitaminC: 0.9, potassium: 101, sugar: 9.6 } },
    servings: [{ label: '1 cup (248g)', grams: 248 }, { label: '100g', grams: 100 }] },

  { name: 'Cranberry Juice', category: 'beverages',
    per100g: { calories: 46, protein: 0, carbs: 12, fat: 0.1, micros: { vitaminC: 9, sugar: 12 } },
    servings: [{ label: '1 cup (253g)', grams: 253 }, { label: '100g', grams: 100 }] },

  { name: 'Oat Milk, unsweetened', category: 'beverages',
    per100g: { calories: 46, protein: 1, carbs: 7.7, fat: 1.5, micros: { calcium: 120, vitaminD: 1, potassium: 150 } },
    servings: [{ label: '1 cup (240g)', grams: 240 }, { label: '100g', grams: 100 }] },

  { name: 'Soy Milk, unsweetened', category: 'beverages',
    per100g: { calories: 33, protein: 3.3, carbs: 1.8, fat: 1.8, micros: { calcium: 120, vitaminD: 1, potassium: 140 } },
    servings: [{ label: '1 cup (240g)', grams: 240 }, { label: '100g', grams: 100 }] },

  // ── SWEETENERS ─────────────────────────────────────────────────────────────
  { name: 'Honey', category: 'sweeteners',
    per100g: { calories: 304, protein: 0.3, carbs: 82, fat: 0,
      micros: { vitaminC: 0.5, calcium: 6, iron: 0.4, magnesium: 2, potassium: 52, sodium: 4, zinc: 0.2, sugar: 82 } },
    servings: [{ label: '1 tbsp (21g)', grams: 21 }, { label: '1 tsp (7g)', grams: 7 }, { label: '100g', grams: 100 }] },

  { name: 'Maple Syrup', category: 'sweeteners',
    per100g: { calories: 260, protein: 0, carbs: 67, fat: 0.2,
      micros: { calcium: 102, iron: 0.1, magnesium: 21, potassium: 212, sodium: 12, zinc: 1.5, sugar: 60 } },
    servings: [{ label: '1 tbsp (20g)', grams: 20 }, { label: '100g', grams: 100 }] },

  { name: 'White Sugar', category: 'sweeteners',
    per100g: { calories: 387, protein: 0, carbs: 100, fat: 0, micros: { sugar: 100 } },
    servings: [{ label: '1 tsp (4g)', grams: 4 }, { label: '1 tbsp (12g)', grams: 12 }, { label: '100g', grams: 100 }] },

  { name: 'Brown Sugar', category: 'sweeteners',
    per100g: { calories: 380, protein: 0, carbs: 98, fat: 0,
      micros: { calcium: 83, iron: 1.9, potassium: 133, sodium: 28, sugar: 97 } },
    servings: [{ label: '1 tbsp (14g)', grams: 14 }, { label: '100g', grams: 100 }] },

  { name: 'Stevia (powder/packet)', category: 'sweeteners',
    per100g: { calories: 0, protein: 0, carbs: 0, fat: 0, micros: {} },
    servings: [{ label: '1 packet (1g)', grams: 1 }, { label: '1 tsp (4g)', grams: 4 }] },

  { name: 'Agave Nectar', category: 'sweeteners',
    per100g: { calories: 310, protein: 0, carbs: 76, fat: 0,
      micros: { calcium: 1, potassium: 1, sugar: 68 } },
    servings: [{ label: '1 tbsp (21g)', grams: 21 }, { label: '100g', grams: 100 }] },

  // ── DRIED FRUITS ───────────────────────────────────────────────────────────
  { name: 'Dates, Medjool', category: 'fruits',
    per100g: { calories: 277, protein: 1.8, carbs: 75, fat: 0.2,
      micros: { vitaminB6: 0.2, vitaminK: 2.7, calcium: 64, iron: 0.9, magnesium: 54, phosphorus: 62, potassium: 696, sodium: 1, zinc: 0.4, fiber: 6.7, sugar: 66 } },
    servings: [{ label: '1 date (24g)', grams: 24 }, { label: '100g', grams: 100 }] },

  { name: 'Raisins', category: 'fruits',
    per100g: { calories: 299, protein: 3.1, carbs: 79, fat: 0.5,
      micros: { vitaminB6: 0.2, vitaminK: 3.5, calcium: 50, iron: 1.9, magnesium: 32, potassium: 749, sodium: 11, fiber: 3.7, sugar: 59 } },
    servings: [{ label: '¼ cup (36g)', grams: 36 }, { label: '100g', grams: 100 }] },

  { name: 'Dried Apricots', category: 'fruits',
    per100g: { calories: 241, protein: 3.4, carbs: 63, fat: 0.5,
      micros: { vitaminA: 180, vitaminE: 4.3, vitaminK: 3.1, calcium: 55, iron: 2.7, magnesium: 32, potassium: 1162, sodium: 10, zinc: 0.4, fiber: 7.3, sugar: 53 } },
    servings: [{ label: '¼ cup (33g)', grams: 33 }, { label: '100g', grams: 100 }] },

  { name: 'Prunes (dried plums)', category: 'fruits',
    per100g: { calories: 240, protein: 2.2, carbs: 64, fat: 0.4,
      micros: { vitaminA: 39, vitaminK: 59.5, calcium: 43, iron: 0.9, magnesium: 41, potassium: 732, sodium: 2, fiber: 7.1, sugar: 38 } },
    servings: [{ label: '4 prunes (34g)', grams: 34 }, { label: '100g', grams: 100 }] },

  { name: 'Dried Cranberries', category: 'fruits',
    per100g: { calories: 308, protein: 0.1, carbs: 82, fat: 1.1,
      micros: { vitaminC: 0.6, vitaminE: 1.1, vitaminK: 2.6, fiber: 5.7, sugar: 65 } },
    servings: [{ label: '¼ cup (40g)', grams: 40 }, { label: '100g', grams: 100 }] },

  { name: 'Dried Figs', category: 'fruits',
    per100g: { calories: 249, protein: 3.3, carbs: 64, fat: 0.9,
      micros: { vitaminK: 15.6, calcium: 162, iron: 2.0, magnesium: 68, phosphorus: 67, potassium: 680, sodium: 10, zinc: 0.6, fiber: 9.8, sugar: 48 } },
    servings: [{ label: '2 figs (38g)', grams: 38 }, { label: '100g', grams: 100 }] },

  // ── FRUITS (more fresh) ────────────────────────────────────────────────────
  { name: 'Lemon', category: 'fruits',
    per100g: { calories: 29, protein: 1.1, carbs: 9.3, fat: 0.3, micros: { vitaminC: 53, potassium: 138, sodium: 2, fiber: 2.8, sugar: 2.5 } },
    servings: [{ label: '1 lemon (58g)', grams: 58 }, { label: '100g', grams: 100 }] },

  { name: 'Lime', category: 'fruits',
    per100g: { calories: 30, protein: 0.7, carbs: 11, fat: 0.2, micros: { vitaminC: 29.1, potassium: 102, sodium: 2, fiber: 2.8, sugar: 1.7 } },
    servings: [{ label: '1 lime (67g)', grams: 67 }, { label: '100g', grams: 100 }] },

  { name: 'Pear', category: 'fruits',
    per100g: { calories: 57, protein: 0.4, carbs: 15, fat: 0.1, micros: { vitaminC: 4.3, vitaminK: 4.4, potassium: 116, sodium: 1, fiber: 3.1, sugar: 9.8 } },
    servings: [{ label: '1 medium (178g)', grams: 178 }, { label: '100g', grams: 100 }] },

  { name: 'Peach', category: 'fruits',
    per100g: { calories: 39, protein: 0.9, carbs: 9.5, fat: 0.3, micros: { vitaminA: 16, vitaminC: 6.6, potassium: 190, sodium: 0, fiber: 1.5, sugar: 8.4 } },
    servings: [{ label: '1 medium (150g)', grams: 150 }, { label: '100g', grams: 100 }] },

  { name: 'Plum', category: 'fruits',
    per100g: { calories: 46, protein: 0.7, carbs: 11, fat: 0.3, micros: { vitaminA: 17, vitaminC: 9.5, vitaminK: 6.4, potassium: 157, sodium: 0, fiber: 1.4, sugar: 9.9 } },
    servings: [{ label: '1 medium (66g)', grams: 66 }, { label: '100g', grams: 100 }] },

  { name: 'Cherries', category: 'fruits',
    per100g: { calories: 63, protein: 1.1, carbs: 16, fat: 0.2, micros: { vitaminA: 3, vitaminC: 7, potassium: 222, sodium: 0, fiber: 2.1, sugar: 12.8 } },
    servings: [{ label: '1 cup (154g)', grams: 154 }, { label: '100g', grams: 100 }] },

  { name: 'Kiwi', category: 'fruits',
    per100g: { calories: 61, protein: 1.1, carbs: 15, fat: 0.5, micros: { vitaminC: 92.7, vitaminK: 40.3, vitaminE: 1.5, potassium: 312, sodium: 3, fiber: 3, sugar: 9 } },
    servings: [{ label: '1 medium (76g)', grams: 76 }, { label: '100g', grams: 100 }] },

  { name: 'Grapefruit', category: 'fruits',
    per100g: { calories: 42, protein: 0.8, carbs: 11, fat: 0.1, micros: { vitaminA: 107, vitaminC: 31.2, potassium: 135, sodium: 0, fiber: 1.6, sugar: 7 } },
    servings: [{ label: '½ fruit (123g)', grams: 123 }, { label: '100g', grams: 100 }] },

  { name: 'Pomegranate Seeds', category: 'fruits',
    per100g: { calories: 83, protein: 1.7, carbs: 19, fat: 1.2, micros: { vitaminC: 10.2, vitaminK: 16.4, folate: 38, potassium: 236, sodium: 3, fiber: 4, sugar: 14 } },
    servings: [{ label: '½ cup (87g)', grams: 87 }, { label: '100g', grams: 100 }] },

  { name: 'Coconut, shredded, unsweetened', category: 'fruits',
    per100g: { calories: 660, protein: 6.9, carbs: 24, fat: 65, micros: { iron: 3.3, magnesium: 90, phosphorus: 206, potassium: 543, sodium: 37, zinc: 1.6, fiber: 16 } },
    servings: [{ label: '¼ cup (20g)', grams: 20 }, { label: '100g', grams: 100 }] },

  { name: 'Coconut Milk, canned', category: 'fruits',
    per100g: { calories: 230, protein: 2.3, carbs: 5.5, fat: 24, micros: { iron: 1.6, magnesium: 37, potassium: 263, sodium: 15 } },
    servings: [{ label: '½ cup (120g)', grams: 120 }, { label: '100g', grams: 100 }] },

  // ── NUTS & SEEDS ───────────────────────────────────────────────────────────
  { name: 'Peanuts, roasted, unsalted', category: 'nuts',
    per100g: { calories: 585, protein: 24, carbs: 21, fat: 50,
      micros: { vitaminE: 6.9, vitaminB3: 13.5, folate: 145, magnesium: 176, phosphorus: 363, potassium: 634, sodium: 5, zinc: 2.8, fiber: 8.5, sugar: 4.2 } },
    servings: [{ label: '¼ cup (37g)', grams: 37 }, { label: '100g', grams: 100 }] },

  { name: 'Pistachios', category: 'nuts',
    per100g: { calories: 562, protein: 20, carbs: 28, fat: 45,
      micros: { vitaminB6: 1.3, folate: 51, calcium: 105, iron: 3.9, magnesium: 121, phosphorus: 490, potassium: 1025, sodium: 1, zinc: 2.2, fiber: 10.6, sugar: 7.7 } },
    servings: [{ label: '¼ cup (31g)', grams: 31 }, { label: '100g', grams: 100 }] },

  { name: 'Pecans', category: 'nuts',
    per100g: { calories: 691, protein: 9.2, carbs: 14, fat: 72,
      micros: { vitaminE: 1.4, vitaminB1: 0.7, folate: 22, calcium: 70, iron: 2.5, magnesium: 121, phosphorus: 277, potassium: 410, sodium: 0, zinc: 4.5, fiber: 9.6 } },
    servings: [{ label: '¼ cup (27g)', grams: 27 }, { label: '100g', grams: 100 }] },

  { name: 'Hazelnuts', category: 'nuts',
    per100g: { calories: 628, protein: 15, carbs: 17, fat: 61,
      micros: { vitaminE: 15.0, vitaminB1: 0.6, vitaminB6: 0.6, folate: 113, calcium: 114, iron: 4.7, magnesium: 163, phosphorus: 290, potassium: 680, sodium: 0, zinc: 2.5, fiber: 9.7 } },
    servings: [{ label: '¼ cup (34g)', grams: 34 }, { label: '100g', grams: 100 }] },

  { name: 'Brazil Nuts', category: 'nuts',
    per100g: { calories: 659, protein: 14, carbs: 12, fat: 67,
      micros: { vitaminE: 5.7, magnesium: 376, phosphorus: 725, potassium: 659, selenium: 1917, zinc: 4.1, fiber: 7.5 } },
    servings: [{ label: '6 nuts (28g)', grams: 28 }, { label: '100g', grams: 100 }] },

  { name: 'Chia Seeds', category: 'nuts',
    per100g: { calories: 486, protein: 17, carbs: 42, fat: 31,
      micros: { calcium: 631, iron: 7.7, magnesium: 335, phosphorus: 860, potassium: 407, zinc: 4.6, fiber: 34, omega3: 17.8 } },
    servings: [{ label: '1 tbsp (12g)', grams: 12 }, { label: '100g', grams: 100 }] },

  { name: 'Flax Seeds, ground', category: 'nuts',
    per100g: { calories: 534, protein: 18, carbs: 29, fat: 42,
      micros: { vitaminB1: 1.6, folate: 87, calcium: 255, iron: 5.7, magnesium: 392, phosphorus: 642, potassium: 813, zinc: 4.3, fiber: 27, omega3: 22.8 } },
    servings: [{ label: '1 tbsp (7g)', grams: 7 }, { label: '100g', grams: 100 }] },

  { name: 'Sesame Seeds', category: 'nuts',
    per100g: { calories: 573, protein: 18, carbs: 23, fat: 50,
      micros: { vitaminB1: 0.8, calcium: 975, iron: 14.6, magnesium: 351, phosphorus: 629, potassium: 468, zinc: 7.8, fiber: 11.8 } },
    servings: [{ label: '1 tbsp (9g)', grams: 9 }, { label: '100g', grams: 100 }] },

  { name: 'Sunflower Seeds', category: 'nuts',
    per100g: { calories: 584, protein: 21, carbs: 20, fat: 51,
      micros: { vitaminE: 35.2, vitaminB1: 1.5, vitaminB6: 1.3, folate: 227, magnesium: 325, phosphorus: 660, potassium: 645, zinc: 5.0, fiber: 8.6 } },
    servings: [{ label: '¼ cup (35g)', grams: 35 }, { label: '100g', grams: 100 }] },

  { name: 'Pumpkin Seeds', category: 'nuts',
    per100g: { calories: 559, protein: 30, carbs: 11, fat: 49,
      micros: { vitaminE: 0.6, vitaminK: 7.3, magnesium: 592, phosphorus: 1233, potassium: 809, zinc: 7.8, iron: 8.8, fiber: 6.0 } },
    servings: [{ label: '¼ cup (32g)', grams: 32 }, { label: '100g', grams: 100 }] },

  { name: 'Tahini', category: 'nuts',
    per100g: { calories: 595, protein: 17, carbs: 21, fat: 54,
      micros: { calcium: 426, iron: 9, magnesium: 110, phosphorus: 732, potassium: 414, zinc: 4.6, fiber: 9.3 } },
    servings: [{ label: '1 tbsp (15g)', grams: 15 }, { label: '100g', grams: 100 }] },

  { name: 'Almond Butter', category: 'nuts',
    per100g: { calories: 614, protein: 21, carbs: 19, fat: 56,
      micros: { vitaminE: 24, calcium: 347, iron: 3.5, magnesium: 279, phosphorus: 484, potassium: 748, zinc: 3.1, fiber: 10 } },
    servings: [{ label: '2 tbsp (32g)', grams: 32 }, { label: '100g', grams: 100 }] },

  // ── VEGETABLES (more) ──────────────────────────────────────────────────────
  { name: 'Garlic, raw', category: 'vegetables',
    per100g: { calories: 149, protein: 6.4, carbs: 33, fat: 0.5,
      micros: { vitaminC: 31.2, vitaminB6: 1.2, calcium: 181, iron: 1.7, magnesium: 25, phosphorus: 153, potassium: 401, sodium: 17, zinc: 1.2, fiber: 2.1, sugar: 1 } },
    servings: [{ label: '1 clove (3g)', grams: 3 }, { label: '100g', grams: 100 }] },

  { name: 'Onion, raw', category: 'vegetables',
    per100g: { calories: 40, protein: 1.1, carbs: 9.3, fat: 0.1,
      micros: { vitaminC: 7.4, vitaminB6: 0.1, folate: 19, calcium: 23, potassium: 146, sodium: 4, fiber: 1.7, sugar: 4.2 } },
    servings: [{ label: '1 medium (110g)', grams: 110 }, { label: '100g', grams: 100 }] },

  { name: 'Ginger, raw', category: 'vegetables',
    per100g: { calories: 80, protein: 1.8, carbs: 18, fat: 0.8,
      micros: { vitaminC: 5, vitaminB6: 0.2, magnesium: 43, potassium: 415, sodium: 13, fiber: 2, sugar: 1.7 } },
    servings: [{ label: '1 tbsp (6g)', grams: 6 }, { label: '100g', grams: 100 }] },

  { name: 'Zucchini, raw', category: 'vegetables',
    per100g: { calories: 17, protein: 1.2, carbs: 3.1, fat: 0.3,
      micros: { vitaminC: 17.9, vitaminB6: 0.2, folate: 24, potassium: 261, sodium: 8, fiber: 1, sugar: 2.5 } },
    servings: [{ label: '1 medium (196g)', grams: 196 }, { label: '100g', grams: 100 }] },

  { name: 'Cauliflower, raw', category: 'vegetables',
    per100g: { calories: 25, protein: 1.9, carbs: 5, fat: 0.3,
      micros: { vitaminC: 48.2, vitaminK: 15.5, folate: 57, potassium: 299, sodium: 30, fiber: 2, sugar: 1.9 } },
    servings: [{ label: '1 cup (107g)', grams: 107 }, { label: '100g', grams: 100 }] },

  { name: 'Green Beans, raw', category: 'vegetables',
    per100g: { calories: 31, protein: 1.8, carbs: 7, fat: 0.2,
      micros: { vitaminA: 35, vitaminC: 12.2, vitaminK: 43, folate: 33, calcium: 37, iron: 1, potassium: 211, sodium: 6, fiber: 3.4, sugar: 3.3 } },
    servings: [{ label: '1 cup (100g)', grams: 100 }, { label: '100g', grams: 100 }] },

  { name: 'Asparagus, raw', category: 'vegetables',
    per100g: { calories: 20, protein: 2.2, carbs: 3.9, fat: 0.1,
      micros: { vitaminA: 38, vitaminC: 5.6, vitaminK: 41.6, folate: 52, iron: 2.1, potassium: 202, sodium: 2, fiber: 2.1, sugar: 1.9 } },
    servings: [{ label: '6 spears (108g)', grams: 108 }, { label: '100g', grams: 100 }] },

  { name: 'Brussels Sprouts, raw', category: 'vegetables',
    per100g: { calories: 43, protein: 3.4, carbs: 9, fat: 0.3,
      micros: { vitaminA: 38, vitaminC: 85, vitaminK: 177, folate: 61, potassium: 389, sodium: 25, fiber: 3.8, sugar: 2.2 } },
    servings: [{ label: '1 cup (88g)', grams: 88 }, { label: '100g', grams: 100 }] },

  { name: 'Cabbage, raw', category: 'vegetables',
    per100g: { calories: 25, protein: 1.3, carbs: 5.8, fat: 0.1,
      micros: { vitaminC: 36.6, vitaminK: 76, folate: 43, calcium: 40, potassium: 170, sodium: 18, fiber: 2.5, sugar: 3.2 } },
    servings: [{ label: '1 cup (89g)', grams: 89 }, { label: '100g', grams: 100 }] },

  { name: 'Lettuce, romaine', category: 'vegetables',
    per100g: { calories: 17, protein: 1.2, carbs: 3.3, fat: 0.3,
      micros: { vitaminA: 436, vitaminC: 4, vitaminK: 103, folate: 136, potassium: 247, sodium: 8, fiber: 2.1, sugar: 1.2 } },
    servings: [{ label: '1 cup shredded (47g)', grams: 47 }, { label: '100g', grams: 100 }] },

  { name: 'Beets, raw', category: 'vegetables',
    per100g: { calories: 43, protein: 1.6, carbs: 10, fat: 0.2,
      micros: { vitaminC: 4.9, folate: 109, magnesium: 23, potassium: 325, sodium: 78, fiber: 2.8, sugar: 6.8 } },
    servings: [{ label: '1 medium (82g)', grams: 82 }, { label: '100g', grams: 100 }] },

  { name: 'Celery, raw', category: 'vegetables',
    per100g: { calories: 16, protein: 0.7, carbs: 3, fat: 0.2,
      micros: { vitaminA: 22, vitaminC: 3.1, vitaminK: 29.3, folate: 36, potassium: 260, sodium: 80, fiber: 1.6, sugar: 1.3 } },
    servings: [{ label: '1 stalk (40g)', grams: 40 }, { label: '100g', grams: 100 }] },

  { name: 'Butternut Squash, cooked', category: 'vegetables',
    per100g: { calories: 40, protein: 0.9, carbs: 10, fat: 0.1,
      micros: { vitaminA: 558, vitaminC: 15.5, vitaminE: 1.3, potassium: 352, sodium: 4, fiber: 1.4, sugar: 2.5 } },
    servings: [{ label: '1 cup (205g)', grams: 205 }, { label: '100g', grams: 100 }] },

  { name: 'Pumpkin, canned', category: 'vegetables',
    per100g: { calories: 34, protein: 1.1, carbs: 8.1, fat: 0.1,
      micros: { vitaminA: 1091, vitaminC: 4.7, potassium: 230, sodium: 4, fiber: 2.9, sugar: 3.4 } },
    servings: [{ label: '1 cup (245g)', grams: 245 }, { label: '100g', grams: 100 }] },

  { name: 'Radish, raw', category: 'vegetables',
    per100g: { calories: 16, protein: 0.7, carbs: 3.4, fat: 0.1,
      micros: { vitaminC: 14.8, folate: 25, potassium: 233, sodium: 39, fiber: 1.6, sugar: 1.9 } },
    servings: [{ label: '1 cup sliced (116g)', grams: 116 }, { label: '100g', grams: 100 }] },

  // ── PROTEINS (plant-based, deli & more) ──────────────────────────────────
  { name: 'Tofu, firm', category: 'protein',
    per100g: { calories: 144, protein: 15, carbs: 2.8, fat: 9,
      micros: { calcium: 350, iron: 2.7, magnesium: 30, phosphorus: 190, potassium: 150, zinc: 1 } },
    servings: [{ label: '½ cup (126g)', grams: 126 }, { label: '100g', grams: 100 }] },

  { name: 'Tempeh', category: 'protein',
    per100g: { calories: 192, protein: 20, carbs: 9.4, fat: 11,
      micros: { calcium: 111, iron: 2.7, magnesium: 81, phosphorus: 266, potassium: 412, zinc: 1.1, fiber: 9 } },
    servings: [{ label: '½ cup (83g)', grams: 83 }, { label: '100g', grams: 100 }] },

  { name: 'Seitan', category: 'protein',
    per100g: { calories: 370, protein: 75, carbs: 14, fat: 1.9, micros: { iron: 5, sodium: 29 } },
    servings: [{ label: '100g', grams: 100 }] },

  { name: 'Bacon, cooked', category: 'protein',
    per100g: { calories: 541, protein: 37, carbs: 1.4, fat: 42,
      micros: { vitaminB3: 8, vitaminB12: 1, sodium: 1717, zinc: 2.8, cholesterol: 110 } },
    servings: [{ label: '2 slices (16g)', grams: 16 }, { label: '100g', grams: 100 }] },

  { name: 'Ham, sliced', category: 'protein',
    per100g: { calories: 145, protein: 21, carbs: 1.5, fat: 5.5,
      micros: { vitaminB1: 0.7, sodium: 1203, zinc: 2.1, cholesterol: 53 } },
    servings: [{ label: '2 slices (56g)', grams: 56 }, { label: '100g', grams: 100 }] },

  { name: 'Sausage, pork', category: 'protein',
    per100g: { calories: 301, protein: 12, carbs: 2, fat: 27, micros: { sodium: 820, cholesterol: 65 } },
    servings: [{ label: '1 link (68g)', grams: 68 }, { label: '100g', grams: 100 }] },

  { name: 'Deli Turkey, sliced', category: 'protein',
    per100g: { calories: 104, protein: 17, carbs: 2.5, fat: 2.7, micros: { sodium: 1080, cholesterol: 39 } },
    servings: [{ label: '2 slices (56g)', grams: 56 }, { label: '100g', grams: 100 }] },

  { name: 'Salami', category: 'protein',
    per100g: { calories: 336, protein: 22, carbs: 1.6, fat: 27, micros: { sodium: 1890, cholesterol: 79 } },
    servings: [{ label: '2 slices (20g)', grams: 20 }, { label: '100g', grams: 100 }] },

  { name: 'Duck Breast, cooked', category: 'protein',
    per100g: { calories: 201, protein: 23, carbs: 0, fat: 11, micros: { iron: 2.7, zinc: 1.7, cholesterol: 84 } },
    servings: [{ label: '100g', grams: 100 }] },

  { name: 'Lamb, cooked', category: 'protein',
    per100g: { calories: 258, protein: 25, carbs: 0, fat: 17, micros: { iron: 1.9, zinc: 4.5, vitaminB12: 2.6, cholesterol: 97 } },
    servings: [{ label: '100g', grams: 100 }] },

  { name: 'Bison, cooked', category: 'protein',
    per100g: { calories: 146, protein: 28, carbs: 0, fat: 2.4, micros: { iron: 3.4, zinc: 5.6, vitaminB12: 2.9, cholesterol: 70 } },
    servings: [{ label: '100g', grams: 100 }] },

  { name: 'Halibut, cooked', category: 'protein',
    per100g: { calories: 140, protein: 27, carbs: 0, fat: 2.9,
      micros: { vitaminD: 1, vitaminB12: 1.2, phosphorus: 242, potassium: 490, selenium: 47 } },
    servings: [{ label: '1 fillet (159g)', grams: 159 }, { label: '100g', grams: 100 }] },

  { name: 'Sardines, canned in oil', category: 'protein',
    per100g: { calories: 208, protein: 25, carbs: 0, fat: 11,
      micros: { vitaminD: 4.8, vitaminB12: 8.9, calcium: 382, phosphorus: 490, selenium: 53, omega3: 1.5, cholesterol: 142 } },
    servings: [{ label: '1 can (92g)', grams: 92 }, { label: '100g', grams: 100 }] },

  { name: 'Mackerel, cooked', category: 'protein',
    per100g: { calories: 262, protein: 24, carbs: 0, fat: 18,
      micros: { vitaminD: 16.1, vitaminB12: 19, selenium: 44, omega3: 2.6, cholesterol: 75 } },
    servings: [{ label: '1 fillet (88g)', grams: 88 }, { label: '100g', grams: 100 }] },

  { name: 'Crab, cooked', category: 'protein',
    per100g: { calories: 97, protein: 19, carbs: 0, fat: 1.5,
      micros: { vitaminB12: 10, zinc: 4.5, selenium: 40, sodium: 395, cholesterol: 78 } },
    servings: [{ label: '100g', grams: 100 }] },

  { name: 'Scallops, cooked', category: 'protein',
    per100g: { calories: 111, protein: 20.5, carbs: 5.4, fat: 0.8,
      micros: { vitaminB12: 1.4, phosphorus: 359, potassium: 314, sodium: 667, cholesterol: 41 } },
    servings: [{ label: '100g', grams: 100 }] },

  { name: 'Mussels, cooked', category: 'protein',
    per100g: { calories: 172, protein: 24, carbs: 7.4, fat: 4.5,
      micros: { iron: 6.7, vitaminB12: 20, selenium: 89, sodium: 369, cholesterol: 56 } },
    servings: [{ label: '100g', grams: 100 }] },

  { name: 'Clams, cooked', category: 'protein',
    per100g: { calories: 148, protein: 25.5, carbs: 5.1, fat: 1.9,
      micros: { iron: 28, vitaminB12: 98.9, sodium: 112, cholesterol: 67 } },
    servings: [{ label: '100g', grams: 100 }] },

  // ── DAIRY (more) ───────────────────────────────────────────────────────────
  { name: 'Sour Cream', category: 'dairy',
    per100g: { calories: 198, protein: 2.4, carbs: 4.6, fat: 19, micros: { calcium: 98, vitaminA: 163, sodium: 33, cholesterol: 59 } },
    servings: [{ label: '2 tbsp (30g)', grams: 30 }, { label: '100g', grams: 100 }] },

  { name: 'Cream Cheese', category: 'dairy',
    per100g: { calories: 342, protein: 6, carbs: 4, fat: 34, micros: { calcium: 98, vitaminA: 308, sodium: 314, cholesterol: 110 } },
    servings: [{ label: '2 tbsp (30g)', grams: 30 }, { label: '100g', grams: 100 }] },

  { name: 'Heavy Cream', category: 'dairy',
    per100g: { calories: 340, protein: 2.1, carbs: 2.8, fat: 36, micros: { calcium: 65, vitaminA: 353, cholesterol: 137 } },
    servings: [{ label: '1 tbsp (15g)', grams: 15 }, { label: '100g', grams: 100 }] },

  { name: 'Half and Half', category: 'dairy',
    per100g: { calories: 130, protein: 3, carbs: 4.3, fat: 11.5, micros: { calcium: 105, cholesterol: 38 } },
    servings: [{ label: '1 tbsp (15g)', grams: 15 }, { label: '100g', grams: 100 }] },

  { name: 'Parmesan Cheese', category: 'dairy',
    per100g: { calories: 392, protein: 35, carbs: 3.2, fat: 26,
      micros: { calcium: 1184, phosphorus: 694, sodium: 1529, zinc: 2.9, cholesterol: 88 } },
    servings: [{ label: '2 tbsp grated (10g)', grams: 10 }, { label: '100g', grams: 100 }] },

  { name: 'Feta Cheese', category: 'dairy',
    per100g: { calories: 264, protein: 14, carbs: 4, fat: 21, micros: { calcium: 493, sodium: 917, cholesterol: 89 } },
    servings: [{ label: '¼ cup crumbled (38g)', grams: 38 }, { label: '100g', grams: 100 }] },

  { name: 'Swiss Cheese', category: 'dairy',
    per100g: { calories: 380, protein: 27, carbs: 5.4, fat: 28, micros: { calcium: 791, sodium: 192, cholesterol: 92 } },
    servings: [{ label: '1 slice (28g)', grams: 28 }, { label: '100g', grams: 100 }] },

  { name: 'Ricotta Cheese, part-skim', category: 'dairy',
    per100g: { calories: 138, protein: 11, carbs: 5.1, fat: 7.9, micros: { calcium: 272, sodium: 125, cholesterol: 31 } },
    servings: [{ label: '½ cup (124g)', grams: 124 }, { label: '100g', grams: 100 }] },

  { name: 'Buttermilk', category: 'dairy',
    per100g: { calories: 40, protein: 3.3, carbs: 4.8, fat: 1, micros: { calcium: 116, sodium: 105, cholesterol: 4 } },
    servings: [{ label: '1 cup (245g)', grams: 245 }, { label: '100g', grams: 100 }] },

  { name: 'Yogurt, plain, whole milk', category: 'dairy',
    per100g: { calories: 61, protein: 3.5, carbs: 4.7, fat: 3.3, micros: { calcium: 121, sodium: 46, cholesterol: 13 } },
    servings: [{ label: '1 cup (245g)', grams: 245 }, { label: '100g', grams: 100 }] },

  { name: 'Ice Cream, vanilla', category: 'dairy',
    per100g: { calories: 207, protein: 3.5, carbs: 24, fat: 11, micros: { calcium: 128, sodium: 80, sugar: 21, cholesterol: 44 } },
    servings: [{ label: '½ cup (66g)', grams: 66 }, { label: '100g', grams: 100 }] },

  // ── GRAINS & BREADS (more) ─────────────────────────────────────────────────
  { name: 'Couscous, cooked', category: 'grains',
    per100g: { calories: 112, protein: 3.8, carbs: 23, fat: 0.2, micros: { folate: 23, potassium: 58, sodium: 5, fiber: 1.4 } },
    servings: [{ label: '1 cup (157g)', grams: 157 }, { label: '100g', grams: 100 }] },

  { name: 'Barley, cooked', category: 'grains',
    per100g: { calories: 123, protein: 2.3, carbs: 28, fat: 0.4, micros: { folate: 16, iron: 1.3, magnesium: 22, potassium: 93, sodium: 3, fiber: 3.8 } },
    servings: [{ label: '1 cup (157g)', grams: 157 }, { label: '100g', grams: 100 }] },

  { name: 'Buckwheat, cooked', category: 'grains',
    per100g: { calories: 92, protein: 3.4, carbs: 20, fat: 0.6, micros: { magnesium: 51, phosphorus: 59, potassium: 88, sodium: 1, fiber: 2.7 } },
    servings: [{ label: '1 cup (168g)', grams: 168 }, { label: '100g', grams: 100 }] },

  { name: 'Sourdough Bread', category: 'grains',
    per100g: { calories: 289, protein: 11.4, carbs: 56, fat: 1.4, micros: { iron: 3.5, sodium: 585, fiber: 2.4 } },
    servings: [{ label: '1 slice (55g)', grams: 55 }, { label: '100g', grams: 100 }] },

  { name: 'Rye Bread', category: 'grains',
    per100g: { calories: 259, protein: 8.5, carbs: 48, fat: 3.3, micros: { iron: 2.8, sodium: 603, fiber: 5.8 } },
    servings: [{ label: '1 slice (32g)', grams: 32 }, { label: '100g', grams: 100 }] },

  { name: 'English Muffin', category: 'grains',
    per100g: { calories: 235, protein: 9, carbs: 46, fat: 1.8, micros: { sodium: 414, fiber: 2.6 } },
    servings: [{ label: '1 muffin (57g)', grams: 57 }, { label: '100g', grams: 100 }] },

  { name: 'Pita Bread', category: 'grains',
    per100g: { calories: 275, protein: 9.1, carbs: 56, fat: 1.2, micros: { sodium: 536, fiber: 2.2 } },
    servings: [{ label: '1 pita (60g)', grams: 60 }, { label: '100g', grams: 100 }] },

  { name: 'Naan', category: 'grains',
    per100g: { calories: 310, protein: 9.5, carbs: 50, fat: 9, micros: { sodium: 500, fiber: 2 } },
    servings: [{ label: '1 piece (90g)', grams: 90 }, { label: '100g', grams: 100 }] },

  { name: 'All-Purpose Flour', category: 'grains',
    per100g: { calories: 364, protein: 10, carbs: 76, fat: 1, micros: { iron: 4.6, folate: 183, sodium: 2, fiber: 2.7 } },
    servings: [{ label: '1 cup (125g)', grams: 125 }, { label: '100g', grams: 100 }] },

  { name: 'Whole Wheat Flour', category: 'grains',
    per100g: { calories: 340, protein: 13.7, carbs: 72, fat: 2.5, micros: { iron: 3.9, magnesium: 138, fiber: 10.7 } },
    servings: [{ label: '1 cup (120g)', grams: 120 }, { label: '100g', grams: 100 }] },

  { name: 'Cornstarch', category: 'grains',
    per100g: { calories: 381, protein: 0.3, carbs: 91, fat: 0.1, micros: { sodium: 9 } },
    servings: [{ label: '1 tbsp (8g)', grams: 8 }, { label: '100g', grams: 100 }] },

  { name: 'Popcorn, air-popped', category: 'grains',
    per100g: { calories: 387, protein: 13, carbs: 78, fat: 4.5, micros: { iron: 3.2, magnesium: 144, fiber: 15 } },
    servings: [{ label: '3 cups (24g)', grams: 24 }, { label: '100g', grams: 100 }] },

  // ── CONDIMENTS & SAUCES ────────────────────────────────────────────────────
  { name: 'Ketchup', category: 'condiments',
    per100g: { calories: 101, protein: 1.2, carbs: 27, fat: 0.2, micros: { sodium: 1100, sugar: 22 } },
    servings: [{ label: '1 tbsp (17g)', grams: 17 }, { label: '100g', grams: 100 }] },

  { name: 'Mustard, yellow', category: 'condiments',
    per100g: { calories: 66, protein: 4.4, carbs: 5.3, fat: 3.3, micros: { sodium: 1120 } },
    servings: [{ label: '1 tbsp (16g)', grams: 16 }, { label: '100g', grams: 100 }] },

  { name: 'Mayonnaise', category: 'condiments',
    per100g: { calories: 680, protein: 1, carbs: 0.6, fat: 75, micros: { sodium: 635, cholesterol: 42 } },
    servings: [{ label: '1 tbsp (14g)', grams: 14 }, { label: '100g', grams: 100 }] },

  { name: 'BBQ Sauce', category: 'condiments',
    per100g: { calories: 172, protein: 0.5, carbs: 40, fat: 0.6, micros: { sodium: 820, sugar: 32 } },
    servings: [{ label: '2 tbsp (35g)', grams: 35 }, { label: '100g', grams: 100 }] },

  { name: 'Soy Sauce', category: 'condiments',
    per100g: { calories: 53, protein: 8.1, carbs: 4.9, fat: 0.6, micros: { sodium: 5493 } },
    servings: [{ label: '1 tbsp (18g)', grams: 18 }, { label: '100g', grams: 100 }] },

  { name: 'Salsa', category: 'condiments',
    per100g: { calories: 36, protein: 1.6, carbs: 7, fat: 0.2, micros: { vitaminC: 8, sodium: 600, sugar: 4 } },
    servings: [{ label: '2 tbsp (30g)', grams: 30 }, { label: '100g', grams: 100 }] },

  { name: 'Ranch Dressing', category: 'condiments',
    per100g: { calories: 430, protein: 1, carbs: 6, fat: 45, micros: { sodium: 730, cholesterol: 20 } },
    servings: [{ label: '2 tbsp (30g)', grams: 30 }, { label: '100g', grams: 100 }] },

  { name: 'Balsamic Vinegar', category: 'condiments',
    per100g: { calories: 88, protein: 0.5, carbs: 17, fat: 0, micros: { sodium: 23, sugar: 15 } },
    servings: [{ label: '1 tbsp (16g)', grams: 16 }, { label: '100g', grams: 100 }] },

  { name: 'Hot Sauce', category: 'condiments',
    per100g: { calories: 12, protein: 0.5, carbs: 2, fat: 0.4, micros: { sodium: 1360 } },
    servings: [{ label: '1 tsp (5g)', grams: 5 }, { label: '100g', grams: 100 }] },

  { name: 'Guacamole', category: 'condiments',
    per100g: { calories: 150, protein: 2, carbs: 8, fat: 13, micros: { vitaminC: 8, potassium: 400, sodium: 280, fiber: 6 } },
    servings: [{ label: '2 tbsp (30g)', grams: 30 }, { label: '100g', grams: 100 }] },

  // ── HERBS, SPICES & BAKING ─────────────────────────────────────────────────
  { name: 'Cinnamon, ground', category: 'spices',
    per100g: { calories: 247, protein: 4, carbs: 81, fat: 1.2, micros: { calcium: 1002, iron: 8.3, fiber: 53 } },
    servings: [{ label: '1 tsp (2.6g)', grams: 2.6 }, { label: '100g', grams: 100 }] },

  { name: 'Black Pepper, ground', category: 'spices',
    per100g: { calories: 251, protein: 10, carbs: 64, fat: 3.3, micros: { iron: 9.7, potassium: 1329, fiber: 25 } },
    servings: [{ label: '1 tsp (2.3g)', grams: 2.3 }, { label: '100g', grams: 100 }] },

  { name: 'Salt', category: 'spices',
    per100g: { calories: 0, protein: 0, carbs: 0, fat: 0, micros: { sodium: 38758 } },
    servings: [{ label: '1 tsp (6g)', grams: 6 }, { label: '100g', grams: 100 }] },

  { name: 'Vanilla Extract', category: 'spices',
    per100g: { calories: 288, protein: 0.1, carbs: 13, fat: 0.1, micros: { sugar: 13 } },
    servings: [{ label: '1 tsp (4g)', grams: 4 }, { label: '100g', grams: 100 }] },

  { name: 'Cocoa Powder, unsweetened', category: 'spices',
    per100g: { calories: 228, protein: 20, carbs: 58, fat: 14, micros: { iron: 13.9, magnesium: 499, potassium: 1524, zinc: 6.8, fiber: 37 } },
    servings: [{ label: '1 tbsp (5g)', grams: 5 }, { label: '100g', grams: 100 }] },

  { name: 'Baking Powder', category: 'spices',
    per100g: { calories: 53, protein: 0, carbs: 28, fat: 0, micros: { sodium: 10600, calcium: 5876 } },
    servings: [{ label: '1 tsp (4g)', grams: 4 }, { label: '100g', grams: 100 }] },

  { name: 'Baking Soda', category: 'spices',
    per100g: { calories: 0, protein: 0, carbs: 0, fat: 0, micros: { sodium: 27360 } },
    servings: [{ label: '1 tsp (5g)', grams: 5 }, { label: '100g', grams: 100 }] },

  // ── FATS & OILS (more) ─────────────────────────────────────────────────────
  { name: 'Coconut Oil', category: 'fats',
    per100g: { calories: 862, protein: 0, carbs: 0, fat: 100, micros: {} },
    servings: [{ label: '1 tbsp (14g)', grams: 14 }, { label: '100g', grams: 100 }] },

  { name: 'Canola Oil', category: 'fats',
    per100g: { calories: 884, protein: 0, carbs: 0, fat: 100, micros: { vitaminE: 17.5, vitaminK: 71 } },
    servings: [{ label: '1 tbsp (14g)', grams: 14 }, { label: '100g', grams: 100 }] },

  { name: 'Vegetable Oil', category: 'fats',
    per100g: { calories: 884, protein: 0, carbs: 0, fat: 100, micros: { vitaminE: 16 } },
    servings: [{ label: '1 tbsp (14g)', grams: 14 }, { label: '100g', grams: 100 }] },

  { name: 'Sesame Oil', category: 'fats',
    per100g: { calories: 884, protein: 0, carbs: 0, fat: 100, micros: { vitaminE: 1.4, vitaminK: 13 } },
    servings: [{ label: '1 tbsp (14g)', grams: 14 }, { label: '100g', grams: 100 }] },

  { name: 'Ghee', category: 'fats',
    per100g: { calories: 900, protein: 0, carbs: 0, fat: 100, micros: { vitaminA: 869, cholesterol: 256 } },
    servings: [{ label: '1 tbsp (13g)', grams: 13 }, { label: '100g', grams: 100 }] },

  { name: 'Margarine', category: 'fats',
    per100g: { calories: 717, protein: 0.2, carbs: 0.9, fat: 80, micros: { vitaminA: 900, vitaminE: 20, sodium: 800 } },
    servings: [{ label: '1 tbsp (14g)', grams: 14 }, { label: '100g', grams: 100 }] },

  // ── SNACKS (more) ──────────────────────────────────────────────────────────
  { name: 'Pretzels', category: 'snacks',
    per100g: { calories: 381, protein: 10, carbs: 79, fat: 2.6, micros: { sodium: 1240, fiber: 2.6 } },
    servings: [{ label: '1 oz (28g)', grams: 28 }, { label: '100g', grams: 100 }] },

  { name: 'Tortilla Chips', category: 'snacks',
    per100g: { calories: 489, protein: 7, carbs: 62, fat: 24, micros: { sodium: 340, fiber: 5 } },
    servings: [{ label: '1 oz (28g)', grams: 28 }, { label: '100g', grams: 100 }] },

  { name: 'Trail Mix', category: 'snacks',
    per100g: { calories: 462, protein: 14, carbs: 45, fat: 29, micros: { iron: 2.6, magnesium: 150, potassium: 600, fiber: 6, sugar: 26 } },
    servings: [{ label: '¼ cup (38g)', grams: 38 }, { label: '100g', grams: 100 }] },

  { name: 'Beef Jerky', category: 'snacks',
    per100g: { calories: 410, protein: 33, carbs: 11, fat: 26, micros: { sodium: 1785, iron: 3.6 } },
    servings: [{ label: '1 oz (28g)', grams: 28 }, { label: '100g', grams: 100 }] },
];

// ── Raw vs cooked ────────────────────────────────────────────────────────────
// Foods can be logged by cooked or by raw/dry weight. `cookedYield` is how many
// grams of cooked food 1 g of raw/dry food makes. `stored` says which state the
// per100g values above describe (most are cooked; vegetables and oats are raw/dry).
// Converting: raw per-100g = cooked per-100g × cookedYield (nutrients are kept,
// only the water changes).
//
// Yields are USDA uncooked kcal ÷ cooked kcal where both are known, otherwise
// typical USDA cooking yields for meat & fish. Very fatty cuts lose fat as well
// as water, so they get explicit raw values (`uncooked`) instead of a conversion.
const U = 'uncooked';
const COOKING = {
  // meat & fish (stored cooked)
  'Chicken Breast, cooked': { y: 0.75 }, 'Chicken Thigh, cooked': { y: 0.70 }, 'Turkey Breast, cooked': { y: 0.75 },
  'Ground Beef, 90/10, cooked': { y: 0.75 }, 'Sirloin Steak, cooked': { y: 0.75 }, 'Pork Tenderloin, cooked': { y: 0.75 },
  'Bison, cooked': { y: 0.75 }, 'Duck Breast, cooked': { y: 0.65 },
  'Salmon, Atlantic, cooked': { y: 0.80 }, 'Tilapia, cooked': { y: 0.80 }, 'Cod, cooked': { y: 0.80 },
  'Halibut, cooked': { y: 0.80 }, 'Mackerel, cooked': { y: 0.80 }, 'Shrimp, cooked': { y: 0.80 },
  'Scallops, cooked': { y: 0.80 }, 'Crab, cooked': { y: 0.90 }, 'Mussels, cooked': { y: 0.50 }, 'Clams, cooked': { y: 0.58 },
  'Eggs, whole, large': { y: 0.92 },
  // fatty cuts: explicit USDA raw values (macros per 100 g raw)
  'Ground Beef, 80/20, cooked': { y: 0.70, uncooked: { calories: 254, protein: 17.2, carbs: 0,   fat: 20 } },
  'Bacon, cooked':              { y: 0.33, uncooked: { calories: 417, protein: 13,   carbs: 0.7, fat: 40 } },
  'Lamb, cooked':               { y: 0.70, uncooked: { calories: 209, protein: 18,   carbs: 0,   fat: 15 } },
  // grains & legumes (stored cooked, uncooked = dry)
  'White Rice, cooked': { y: 2.8 }, 'Brown Rice, cooked': { y: 3.3 }, 'Pasta, cooked': { y: 2.35 },
  'Whole Wheat Pasta, cooked': { y: 2.8 }, 'Quinoa, cooked': { y: 3.05 }, 'Couscous, cooked': { y: 3.35 },
  'Barley, cooked': { y: 2.85 }, 'Buckwheat, cooked': { y: 3.75 }, 'Oatmeal, cooked': { y: 5.5 },
  'Black Beans, cooked': { y: 2.6 }, 'Chickpeas, cooked': { y: 2.3 }, 'Lentils, cooked': { y: 3.05 },
  'Kidney Beans, cooked': { y: 2.65 },
  'Oats, dry': { y: 5.5, stored: U },
  // starchy vegetables (stored cooked)
  'Sweet Potato, cooked': { y: 0.96 }, 'White Potato, baked': { y: 0.83 }, 'Butternut Squash, cooked': { y: 1.12 },
  'Corn, cooked': { y: 0.9 }, 'Peas, cooked': { y: 0.96 },
  'Peanuts, roasted, unsalted': { y: 0.97 },
  // vegetables usually eaten either way (stored raw)
  'Broccoli, raw': { y: 0.97, stored: U }, 'Spinach, raw': { y: 1.0, stored: U }, 'Carrots, raw': { y: 1.17, stored: U },
  'Kale, raw': { y: 1.0, stored: U }, 'Mushrooms, raw': { y: 0.79, stored: U }, 'Onion, raw': { y: 0.91, stored: U },
  'Zucchini, raw': { y: 1.13, stored: U }, 'Cauliflower, raw': { y: 1.09, stored: U }, 'Green Beans, raw': { y: 0.89, stored: U },
  'Asparagus, raw': { y: 0.91, stored: U }, 'Brussels Sprouts, raw': { y: 1.19, stored: U }, 'Cabbage, raw': { y: 1.09, stored: U },
  'Beets, raw': { y: 0.98, stored: U }, 'Bell Pepper, red': { y: 1.1, stored: U }, 'Tomato, raw': { y: 1.0, stored: U },
};
const DRY_CATEGORIES = new Set(['grains', 'legumes']);

// ── Size-based servings ──────────────────────────────────────────────────────
// USDA household weights (edible part). Medium is picked by default in the app.
const SIZE_SERVINGS = {
  Banana:     [['1 small', 101], ['1 medium', 118], ['1 large', 136], ['1 extra large', 152]],
  Apple:      [['1 small', 149], ['1 medium', 182], ['1 large', 223]],
  Orange:     [['1 small', 96],  ['1 medium', 131], ['1 large', 184]],
  Pear:       [['1 small', 148], ['1 medium', 178], ['1 large', 230]],
  Peach:      [['1 small', 130], ['1 medium', 150], ['1 large', 175]],
  Plum:       [['1 small', 50],  ['1 medium', 66],  ['1 large', 85]],
  Kiwi:       [['1 small', 69],  ['1 medium', 76],  ['1 large', 91]],
  Mango:      [['1 small', 150], ['1 medium', 207], ['1 large', 280], ['1 cup sliced', 165]],
  Grapefruit: [['½ medium', 123], ['1 medium', 246], ['1 large', 332]],
  Lemon:      [['1 small', 48],  ['1 medium', 58],  ['1 large', 84]],
  Lime:       [['1 small', 50],  ['1 medium', 67],  ['1 large', 84]],
  Avocado:    [['½ medium', 68], ['1 small', 100],  ['1 medium', 136], ['1 large', 200]],
  Strawberries: [['1 small berry', 7], ['1 medium berry', 12], ['1 large berry', 18], ['1 cup', 152]],
  Blueberries:  [['½ cup', 74], ['1 cup', 148]],
  Grapes:       [['10 grapes', 49], ['1 cup', 92]],
  Cherries:     [['10 cherries', 68], ['1 cup', 154]],
  Watermelon:   [['1 cup diced', 152], ['1 wedge', 286]],
  Pineapple:    [['1 slice', 84], ['1 cup chunks', 165]],
  'Tomato, raw': [['1 cherry tomato', 17], ['1 small', 91], ['1 medium', 123], ['1 large', 182]],
  'Onion, raw':  [['1 small', 70], ['1 medium', 110], ['1 large', 150]],
  'White Potato, baked': [['1 small', 138], ['1 medium', 173], ['1 large', 299]],
  'Sweet Potato, cooked': [['1 small', 60], ['1 medium', 130], ['1 large', 180]],
};

for (const f of foods) {
  const c = COOKING[f.name];
  f.cookedYield   = c ? c.y : null;
  f.storedState   = c?.stored || 'cooked';
  f.uncookedLabel = c ? (DRY_CATEGORIES.has(f.category) ? 'dry' : 'raw') : null;
  f.uncookedPer100g = c?.uncooked || null;

  const sizes = SIZE_SERVINGS[f.name];
  if (sizes) f.servings = [...sizes.map(([label, grams]) => ({ label: `${label} (${grams}g)`, grams })), { label: '100g', grams: 100 }];
}

// Saturated fat (g) and creatine (g) per 100 g, as the foods are listed above.
// Saturated fat: USDA FoodData Central reference values (rounded). Creatine
// occurs naturally only in meat and fish (roughly 0.3–0.5 g per 100 g, a bit
// less once cooked); shellfish, dairy, eggs and plants have next to none.
// [saturatedFat, creatine]
const FATS_AND_CREATINE = {
  'Chicken Breast, cooked': [1.0, 0.4], 'Chicken Thigh, cooked': [3.0, 0.3], 'Salmon, Atlantic, cooked': [3.1, 0.45],
  'Tuna, canned in water': [0.2, 0.3], 'Tuna, canned in oil': [1.5, 0.3], 'Ground Beef, 80/20, cooked': [6.6, 0.35],
  'Ground Beef, 90/10, cooked': [3.9, 0.4], 'Sirloin Steak, cooked': [3.5, 0.4], 'Tilapia, cooked': [0.9, 0.3],
  'Shrimp, cooked': [0.1, 0], 'Turkey Breast, cooked': [2.1, 0.4], 'Pork Tenderloin, cooked': [1.5, 0.4], 'Cod, cooked': [0.2, 0.3],
  'Eggs, whole, large': [3.3, 0], 'Egg Whites': [0, 0],
  'Greek Yogurt, plain, 0% fat': [0.1, 0], 'Greek Yogurt, plain, 2% fat': [1.2, 0], 'Cottage Cheese, 1% fat': [0.6, 0],
  'Cottage Cheese, 4% fat': [1.7, 0], 'Milk, whole': [1.9, 0], 'Milk, 2% fat': [1.3, 0], 'Milk, skimmed': [0.1, 0],
  'Cheddar Cheese': [19, 0], 'Mozzarella, part-skim': [10, 0], 'Whey Protein Powder': [2.0, 0],
  'White Rice, cooked': [0.1, 0], 'Brown Rice, cooked': [0.2, 0], 'Oats, dry': [1.2, 0], 'Oatmeal, cooked': [0.3, 0],
  'Pasta, cooked': [0.2, 0], 'Whole Wheat Pasta, cooked': [0.1, 0], 'Bread, white': [0.7, 0], 'Bread, whole wheat': [0.7, 0],
  'Quinoa, cooked': [0.2, 0], 'Tortilla, flour (20cm)': [2.0, 0], 'Bagel, plain': [0.2, 0], 'Crackers, whole wheat': [2.8, 0],
  'Black Beans, cooked': [0.1, 0], 'Chickpeas, cooked': [0.3, 0], 'Lentils, cooked': [0.1, 0], 'Kidney Beans, cooked': [0.1, 0],
  'Edamame, shelled': [0.6, 0], 'Peanut Butter': [10, 0],
  'Broccoli, raw': [0, 0], 'Spinach, raw': [0.1, 0], 'Sweet Potato, cooked': [0, 0], 'White Potato, baked': [0, 0],
  'Carrots, raw': [0, 0], 'Cucumber, raw': [0, 0], 'Tomato, raw': [0, 0], 'Bell Pepper, red': [0.1, 0], 'Kale, raw': [0.1, 0],
  'Corn, cooked': [0.2, 0], 'Peas, cooked': [0.1, 0], 'Avocado': [2.1, 0], 'Mushrooms, raw': [0, 0],
  'Banana': [0.1, 0], 'Apple': [0, 0], 'Blueberries': [0, 0], 'Strawberries': [0, 0], 'Orange': [0, 0], 'Grapes': [0.1, 0],
  'Watermelon': [0, 0], 'Mango': [0.1, 0], 'Pineapple': [0, 0],
  'Olive Oil': [14, 0], 'Butter': [51, 0], 'Almonds': [3.8, 0], 'Walnuts': [6.1, 0], 'Cashews': [7.8, 0],
  'Pizza, cheese, 1 slice': [4.8, 0], 'Burger, beef patty + bun': [4.0, 0.2], 'French Fries': [2.3, 0], 'Hot Dog, in bun': [5.0, 0.1],
  'Dark Chocolate (70-85%)': [24, 0], 'Milk Chocolate': [18, 0], 'Granola Bar': [6, 0], 'Potato Chips': [3.5, 0], 'Rice Cakes': [0.6, 0],
  'Hummus': [1.4, 0], 'Protein Bar (generic)': [4.0, 0],
  'Orange Juice': [0, 0], 'Almond Milk, unsweetened': [0.1, 0], 'Coconut Water': [0.2, 0], 'Protein Shake (with water)': [0.4, 0],
  'Coffee, black': [0, 0], 'Tea, black, brewed': [0, 0], 'Soda, Cola': [0, 0], 'Diet Soda': [0, 0], 'Beer, regular': [0, 0],
  'Wine, red': [0, 0], 'Sports Drink (Gatorade-style)': [0, 0], 'Energy Drink': [0, 0], 'Apple Juice': [0, 0], 'Cranberry Juice': [0, 0],
  'Oat Milk, unsweetened': [0.2, 0], 'Soy Milk, unsweetened': [0.2, 0],
  'Honey': [0, 0], 'Maple Syrup': [0, 0], 'White Sugar': [0, 0], 'Brown Sugar': [0, 0], 'Stevia (powder/packet)': [0, 0], 'Agave Nectar': [0, 0],
  'Dates, Medjool': [0, 0], 'Raisins': [0.1, 0], 'Dried Apricots': [0, 0], 'Prunes (dried plums)': [0.1, 0], 'Dried Cranberries': [0.1, 0],
  'Dried Figs': [0.1, 0], 'Lemon': [0, 0], 'Lime': [0, 0], 'Pear': [0, 0], 'Peach': [0, 0], 'Plum': [0, 0], 'Cherries': [0, 0],
  'Kiwi': [0, 0], 'Grapefruit': [0, 0], 'Pomegranate Seeds': [0.1, 0],
  'Coconut, shredded, unsweetened': [57, 0], 'Coconut Milk, canned': [21, 0],
  'Peanuts, roasted, unsalted': [7.0, 0], 'Pistachios': [5.9, 0], 'Pecans': [6.2, 0], 'Hazelnuts': [4.5, 0], 'Brazil Nuts': [15, 0],
  'Chia Seeds': [3.3, 0], 'Flax Seeds, ground': [3.7, 0], 'Sesame Seeds': [7.0, 0], 'Sunflower Seeds': [4.5, 0], 'Pumpkin Seeds': [8.7, 0],
  'Tahini': [7.5, 0], 'Almond Butter': [4.2, 0],
  'Garlic, raw': [0.1, 0], 'Onion, raw': [0, 0], 'Ginger, raw': [0.2, 0], 'Zucchini, raw': [0.1, 0], 'Cauliflower, raw': [0.1, 0],
  'Green Beans, raw': [0, 0], 'Asparagus, raw': [0, 0], 'Brussels Sprouts, raw': [0.1, 0], 'Cabbage, raw': [0, 0], 'Lettuce, romaine': [0, 0],
  'Beets, raw': [0, 0], 'Celery, raw': [0, 0], 'Butternut Squash, cooked': [0, 0], 'Pumpkin, canned': [0, 0], 'Radish, raw': [0, 0],
  'Tofu, firm': [1.3, 0], 'Tempeh': [2.5, 0], 'Seitan': [0.3, 0],
  'Bacon, cooked': [14, 0.2], 'Ham, sliced': [1.8, 0.3], 'Sausage, pork': [9.0, 0.2], 'Deli Turkey, sliced': [0.8, 0.3], 'Salami': [10, 0.2],
  'Duck Breast, cooked': [3.7, 0.3], 'Lamb, cooked': [7.3, 0.4], 'Bison, cooked': [0.9, 0.4], 'Halibut, cooked': [0.4, 0.3],
  'Sardines, canned in oil': [1.5, 0.5], 'Mackerel, cooked': [4.2, 0.5], 'Crab, cooked': [0.2, 0], 'Scallops, cooked': [0.1, 0],
  'Mussels, cooked': [0.9, 0], 'Clams, cooked': [0.2, 0],
  'Sour Cream': [11, 0], 'Cream Cheese': [20, 0], 'Heavy Cream': [23, 0], 'Half and Half': [7.0, 0], 'Parmesan Cheese': [16, 0],
  'Feta Cheese': [15, 0], 'Swiss Cheese': [18, 0], 'Ricotta Cheese, part-skim': [4.9, 0], 'Buttermilk': [0.5, 0],
  'Yogurt, plain, whole milk': [2.1, 0], 'Ice Cream, vanilla': [6.8, 0],
  'Couscous, cooked': [0, 0], 'Barley, cooked': [0.1, 0], 'Buckwheat, cooked': [0.1, 0], 'Sourdough Bread': [0.3, 0], 'Rye Bread': [0.6, 0],
  'English Muffin': [0.3, 0], 'Pita Bread': [0.2, 0], 'Naan': [2.9, 0], 'All-Purpose Flour': [0.2, 0], 'Whole Wheat Flour': [0.4, 0],
  'Cornstarch': [0, 0], 'Popcorn, air-popped': [0.6, 0],
  'Ketchup': [0, 0], 'Mustard, yellow': [0.2, 0], 'Mayonnaise': [11.7, 0], 'BBQ Sauce': [0.1, 0], 'Soy Sauce': [0.1, 0], 'Salsa': [0, 0],
  'Ranch Dressing': [7.0, 0], 'Balsamic Vinegar': [0, 0], 'Hot Sauce': [0.1, 0], 'Guacamole': [1.9, 0],
  'Cinnamon, ground': [0.3, 0], 'Black Pepper, ground': [1.4, 0], 'Salt': [0, 0], 'Vanilla Extract': [0, 0], 'Cocoa Powder, unsweetened': [8.1, 0],
  'Baking Powder': [0, 0], 'Baking Soda': [0, 0],
  'Coconut Oil': [82, 0], 'Canola Oil': [7.4, 0], 'Vegetable Oil': [15.6, 0], 'Sesame Oil': [14, 0], 'Ghee': [62, 0], 'Margarine': [16, 0],
  'Pretzels': [0.4, 0], 'Tortilla Chips': [3.5, 0], 'Trail Mix': [5.5, 0], 'Beef Jerky': [11, 0.4],
};
for (const f of foods) {
  const extra = FATS_AND_CREATINE[f.name];
  if (!extra) continue;
  const [saturatedFat, creatine] = extra;
  f.per100g.micros = { ...(f.per100g.micros || {}), saturatedFat, ...(creatine ? { creatine } : {}) };
}

module.exports = { foods, FATS_AND_CREATINE };
