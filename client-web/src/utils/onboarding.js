/**
 * The Get Started page for new users (web and mobile; mobile imports it
 * through its Metro config). Pure JS only.
 */

/** [value, label, hint]: same values as the profile's fitness goal. */
export const GOALS = [
  ['lose_weight', 'Lose fat', 'Eat in a deficit while keeping your muscle'],
  ['build_muscle', 'Build muscle', 'Eat in a small surplus and train to grow'],
  ['improve_endurance', 'Improve endurance', 'Fuel for longer, harder sessions'],
  ['stay_active', 'Stay active and healthy', 'Hold your weight and keep moving'],
  ['other', 'Something else', ''],
];

/** Rough body-fat levels to pick from, by sex: [percent, label, what it looks like]. */
export function bodyFatOptions(sex) {
  return sex === 'female'
    ? [
      [17, '~17%', 'Very lean, visible ab outline'],
      [22, '~22%', 'Lean and toned'],
      [27, '~27%', 'Fit, some softness'],
      [32, '~32%', 'Some fat on hips and belly'],
      [38, '~38%+', 'Carrying extra fat'],
    ]
    : [
      [10, '~10%', 'Very lean, clear abs'],
      [15, '~15%', 'Lean, ab outline'],
      [20, '~20%', 'Fit, soft midsection'],
      [25, '~25%', 'Some fat around the waist'],
      [32, '~30%+', 'Carrying extra fat'],
    ];
}

export const STEPS = ['About you', 'Body fat', 'Activity', 'Goal'];

const yearsSince = (date, now = new Date()) => {
  const d = new Date(date);
  let age = now.getFullYear() - d.getFullYear();
  if (now < new Date(now.getFullYear(), d.getMonth(), d.getDate())) age--;
  return age;
};

/**
 * Checks the first step: { sex, dateOfBirth (YYYY-MM-DD), heightCm, weightKg }.
 * Returns what's wrong, or '' when it's fine.
 */
export function checkBasics({ sex, dateOfBirth, heightCm, weightKg }) {
  if (!sex) return 'Pick your sex (it changes your calorie and body-fat numbers).';
  if (!dateOfBirth || Number.isNaN(Date.parse(dateOfBirth))) return 'Enter your date of birth.';
  const age = yearsSince(dateOfBirth);
  if (age < 13 || age > 100) return 'Check your date of birth (you need to be at least 13).';
  if (!(heightCm >= 100 && heightCm <= 250)) return 'Enter your height (between 100 and 250 cm, or 3\'4" and 8\'2").';
  if (!(weightKg >= 30 && weightKg <= 300)) return 'Enter your weight (between 30 and 300 kg, or 66 and 660 lb).';
  return '';
}
