/**
 * Muscle filters for exercise search, shared by the web and mobile clients
 * (mobile imports this file through its Metro config). Each filter covers a
 * muscle and its regions, e.g. "Chest" is pecs and its three regions.
 */
export const MUSCLE_FILTERS = [
  ['chest', 'Chest', ['pecs', 'clavicular pecs', 'sternal pecs', 'costal pecs']],
  ['front-delts', 'Front delts', ['anterior delt']],
  ['side-delts', 'Side delts', ['middle delt']],
  ['rear-delts', 'Rear delts', ['posterior delt']],
  ['lats', 'Lats', ['lats']],
  ['traps', 'Traps', ['trapezius']],
  ['biceps', 'Biceps', ['elbow flexors', 'biceps', 'brachialis/brachioradialis']],
  ['triceps', 'Triceps', ['triceps', 'medial/lateral triceps', 'triceps long head']],
  ['forearms', 'Forearms', ['forearms']],
  ['abs', 'Abs', ['abs']],
  ['lower-back', 'Lower back', ['erectors']],
  ['glutes', 'Glutes', ['glutes']],
  ['quads', 'Quads', ['quads', 'vastus quads', 'rectus femoris']],
  ['hamstrings', 'Hamstrings', ['hamstrings', 'biarticular hamstrings', 'hamstrings short head']],
  ['calves', 'Calves', ['calves', 'soleus']],
  ['adductors', 'Adductors', ['adductors']],
  ['hip-flexors', 'Hip flexors', ['hip flexors']],
];

/**
 * Exercises that train the muscle as a main (not secondary) muscle — filtering
 * for triceps finds pushdowns and dips, not every bench press. '' = all.
 */
export function filterByMuscle(exercises, key) {
  const filter = MUSCLE_FILTERS.find(([k]) => k === key);
  if (!filter) return exercises;
  const tags = new Set(filter[2]);
  return exercises.filter((ex) => {
    const secondary = new Set(ex.secondaryMuscles || []);
    return (ex.muscleGroups || []).some((m) => tags.has(m) && !secondary.has(m));
  });
}
