require('dotenv').config({ path: '../../.env' });
const mongoose = require('mongoose');
const Exercise = require('../models/Exercise');
const connectDB = require('../config/db');
const { forearmsAreSecondary } = require('../utils/forearmRole');
const { needsSecondaryElbowFlexors, needsSecondaryRearDelts } = require('../utils/pullHelpers');
const { needsSecondaryGastroc } = require('../utils/legCurlHelpers');

const exercises = [
  // ── CHEST ──────────────────────────────────────────────────────────────────
  {
    name: 'Barbell Bench Press',
    muscleGroups: ['pecs', 'medial/lateral triceps', 'anterior delt'],
    equipment: 'barbell',
    instructions: [
      'Lie flat on a bench, grip the barbell slightly wider than shoulder-width.',
      'Unrack the bar and lower it to your mid-chest with control.',
      'Press the bar back up until your arms are fully extended.',
      'Keep your feet flat on the floor and back slightly arched.',
    ],
  },
  {
    name: 'Smith Machine Bench Press',
    muscleGroups: ['pecs', 'medial/lateral triceps', 'anterior delt'],
    equipment: 'machine',
    instructions: [
      'Lie on a flat bench under the Smith machine so the bar lines up with your mid-chest.',
      'Grip the bar slightly wider than shoulder-width, unhook it and lower it to your chest.',
      'Press back up to straight arms, then re-rack by twisting the bar onto the hooks.',
    ],
  },
  {
    name: 'Incline Barbell Bench Press',
    muscleGroups: ['clavicular pecs', 'sternal pecs', 'costal pecs', 'anterior delt', 'medial/lateral triceps'],
    equipment: 'barbell',
    instructions: [
      'Set the bench to a 30-45 degree incline.',
      'Grip the bar slightly wider than shoulder-width.',
      'Lower the bar to your upper chest, then press back up.',
    ],
  },
  {
    name: 'Dumbbell Bench Press',
    muscleGroups: ['pecs', 'medial/lateral triceps', 'anterior delt'],
    equipment: 'dumbbell',
    instructions: [
      'Lie flat on a bench holding a dumbbell in each hand at chest level.',
      'Press the dumbbells up until arms are extended, then lower with control.',
    ],
  },
  {
    name: 'Incline Dumbbell Press',
    muscleGroups: ['clavicular pecs', 'sternal pecs', 'costal pecs', 'anterior delt'],
    equipment: 'dumbbell',
    instructions: [
      'Set bench to 30-45 degree incline. Hold dumbbells at shoulder level.',
      'Press up and slightly inward, then lower with control.',
    ],
  },
  {
    name: 'Dumbbell Flyes',
    muscleGroups: ['pecs'],
    equipment: 'dumbbell',
    instructions: [
      'Lie flat on bench, dumbbells above chest with a slight elbow bend.',
      'Lower dumbbells in a wide arc until chest is stretched.',
      'Return along the same arc, squeezing the chest at the top.',
    ],
  },
  {
    name: 'Cable Pec Flyes',
    muscleGroups: ['pecs'],
    equipment: 'cable',
    instructions: [
      'Stand between two cable stations with pulleys set at shoulder height.',
      'With a slight forward lean, bring both handles together in front of your chest.',
    ],
  },
  {
    name: 'Push-Up',
    muscleGroups: ['pecs', 'medial/lateral triceps', 'anterior delt'],
    equipment: 'bodyweight',
    instructions: [
      'Place hands slightly wider than shoulder-width on the floor.',
      'Keep body straight from head to heels. Lower chest to the floor.',
      'Push back up to the start. Keep core braced throughout.',
    ],
  },
  {
    name: 'Decline Bench Press',
    muscleGroups: ['sternal pecs', 'costal pecs', 'clavicular pecs', 'medial/lateral triceps', 'anterior delt'],
    equipment: 'barbell',
    instructions: [
      'Set the bench to a 15-30 degree decline. Secure your legs.',
      'Grip the bar slightly wider than shoulder-width and lower to lower chest.',
      'Press back up to full extension.',
    ],
  },

  // ── BACK ───────────────────────────────────────────────────────────────────
  
  {
    name: 'Pull-Up',
    muscleGroups: ['lats', 'posterior delt', 'forearms'],
    equipment: 'bodyweight',
    instructions: [
      'Hang from a bar with an overhand grip, slightly wider than shoulder-width.',
      'Lifting straps are recommended.',
      'Pull yourself up until your chin clears the bar.',
      'Lower with control until arms are fully extended.',
    ],
  },
  {
    name: 'Chin-Up',
    muscleGroups: ['lats', 'costal pecs', 'elbow flexors', 'posterior delt', 'forearms'],
    equipment: 'bodyweight',
    instructions: [
      'Hang from a bar with an underhand grip at shoulder-width.',
      'Lifting straps are recommended.',
      'Pull yourself up until your chin clears the bar, keeping elbows close.',
      'Lower slowly to full arm extension.',
    ],
  },
  {
    name: 'Barbell Bent-Over Row',
    muscleGroups: ['lats', 'trapezius', 'posterior delt', 'erectors', 'forearms'],
    equipment: 'barbell',
    instructions: [
      'Hinge forward at the hips until your torso is nearly parallel to the floor.',
      'Grip the bar just outside your legs. Pull the bar to your lower chest.',
      'Squeeze shoulder blades at the top and lower with control.',
      'Lifting straps are recommended.',
    ],
  },
  {
    name: 'Seated Cable Row',
    muscleGroups: ['lats', 'trapezius', 'posterior delt', 'erectors', 'forearms'],
    equipment: 'cable',
    instructions: [
      'Sit at the cable row machine with feet on the platform, knees slightly bent.',
      'Lifting straps are recommended.',
      'Lifting straps are recommended.',
      'Pull the handle to your midsection, squeezing shoulder blades together.',
      'Slowly extend arms back to the start.',
    ],
  },
  {
    name: 'Lat Pulldown',
    muscleGroups: ['lats', 'forearms'],
    equipment: 'cable',
    instructions: [
      'Grip the bar wider than shoulder-width. Sit with thighs secured.',
      'Pull the bar down to your upper chest, leaning back slightly.',
      'Control the bar back up to full arm extension.',
    ],
  },
  {
    name: 'Close Grip Pulldown',
    muscleGroups: ['lats', 'costal pecs', 'forearms'],
    equipment: 'cable',
    instructions: [
      'Grip the bar closer than shoulder-width. Sit with thighs secured.',
      'Pull the bar down to your upper chest, leaning back slightly.',
      'Control the bar back up to full arm extension.',
    ],
  },
  {
    name: 'Single-Arm Dumbbell Row',
    muscleGroups: ['lats', 'trapezius', 'posterior delt', 'forearms'],
    equipment: 'dumbbell',
    instructions: [
      'Place one knee and hand on a bench for support.',
      'Hold a dumbbell in the other hand, arm extended.',
      'Row the dumbbell to your hip, keeping your elbow close to your body.',
    ],
  },
  {
    name: 'T-Bar Row',
    muscleGroups: ['trapezius', 'posterior delt', 'forearms'],
    equipment: 'machine',
    instructions: [
      'Lie face down on the chest pad of the T-bar row machine and grip the handles.',
      'Keeping your chest on the pad, pull the handles toward you, squeezing your shoulder blades together.',
      'Lower with control until your arms are straight.',
    ],
  },
  {
    name: 'Face Pull',
    muscleGroups: ['middle delt', 'posterior delt', 'trapezius'],
    equipment: 'cable',
    instructions: [
      'Set a cable pulley to head height with a rope attachment.',
      'Pull the rope toward your face, flaring elbows out to the sides.',
      'Pause and squeeze rear delts, then release with control.',
    ],
  },

  // ── DELTS ──────────────────────────────────────────────────────────────
  {
    name: 'Overhead Press (Barbell)',
    muscleGroups: ['anterior delt', 'middle delt', 'clavicular pecs', 'medial/lateral triceps'],
    equipment: 'barbell',
    instructions: [
      'Stand with feet shoulder-width apart, bar resting on upper chest.',
      'Press the bar straight up overhead until arms are locked out.',
      'Lower back to the upper chest with control.',
    ],
  },
  {
    name: 'Dumbbell Overhead Press',
    muscleGroups: ['anterior delt', 'middle delt', 'clavicular pecs', 'medial/lateral triceps'],
    equipment: 'dumbbell',
    instructions: [
      'Sit on a bench with back support. Hold dumbbells at shoulder height.',
      'Press both dumbbells overhead until arms are extended.',
      'Lower back to shoulder height.',
    ],
  },
  {
    name: 'Machine Overhead Press',
    muscleGroups: ['anterior delt', 'middle delt', 'clavicular pecs', 'medial/lateral triceps'],
    equipment: 'machine',
    instructions: [
      'Sit on the machine with your back supported.',
      'Grip the bar with a close grip, hands slightly narrower than shoulder-width.',
      'Press the bar overhead until arms are locked out.',
      'Lower back to the upper chest with control.',
    ],
  },
  {
    name: 'Lateral Raise',
    muscleGroups: ['middle delt', 'anterior delt'],
    equipment: 'dumbbell',
    instructions: [
      'Stand holding dumbbells at your sides.',
      'Raise both arms out to the sides to shoulder height.',
      'Lower slowly back to the starting position.',
    ],
  },
  {
    name: 'Front Raise',
    muscleGroups: ['clavicular pecs', 'anterior delt'],
    equipment: 'dumbbell',
    instructions: [
      'Stand holding dumbbells in front of your thighs.',
      'Raise one or both arms straight forward to shoulder height.',
      'Lower slowly.',
    ],
  },
  {
    name: 'Arnold Press',
    muscleGroups: ['anterior delt', 'middle delt', 'clavicular pecs', 'medial/lateral triceps'],
    equipment: 'dumbbell',
    instructions: [
      'Hold dumbbells in front of your face with palms facing you.',
      'As you press up, rotate palms to face outward.',
      'Reverse the motion on the way down.',
    ],
  },
  {
    name: 'Close Grip Overhead Press',
    muscleGroups: ['anterior delt', 'clavicular pecs', 'medial/lateral triceps'],
    equipment: 'machine',
    instructions: [
      'Hold dumbbells closer than shoulder width with a neutral grip.',
      'Press both dumbbells overhead until arms are extended.',
      'Lower back to upper chest height.',
    ],
  },
  {
    name: 'Upright Row',
    muscleGroups: ['middle delt', 'posterior delt', 'trapezius'],
    equipment: 'barbell',
    instructions: [
      'Grip the barbell with hands shoulder-width apart.',
      'Pull the bar straight up to chin height, leading with elbows.',
      'Lower with control.',
    ],
  },

  // ── BICEPS ─────────────────────────────────────────────────────────────────
  {
    name: 'Barbell Curl',
    muscleGroups: ['elbow flexors', 'forearms'],
    equipment: 'barbell',
    instructions: [
      'Stand with feet shoulder-width apart, grip the barbell underhand.',
      'Curl the bar to shoulder height, keeping elbows at your sides.',
      'Lower back down with control.',
    ],
  },
  {
    name: 'Dumbbell Curl',
    muscleGroups: ['elbow flexors', 'forearms'],
    equipment: 'dumbbell',
    instructions: [
      'Stand holding dumbbells at your sides, palms facing forward.',
      'Curl the dumbbells to shoulder height, one arm at a time or together.',
      'Lower slowly.',
    ],
  },
  {
    name: 'Hammer Curl',
    muscleGroups: ['elbow flexors', 'forearms'],
    equipment: 'dumbbell',
    instructions: [
      'Hold dumbbells with a neutral grip (palms facing each other).',
      'Curl up to shoulder height without rotating your wrists.',
      'Lower with control.',
    ],
  },
  {
    name: 'Preacher Curl',
    muscleGroups: ['elbow flexors', 'forearms'],
    equipment: 'barbell',
    instructions: [
      'Sit at a preacher bench, rest upper arms on the pad.',
      'Curl the weight up to full contraction, then lower slowly to full extension.',
    ],
  },
  {
    name: 'Incline Dumbbell Curl',
    muscleGroups: ['elbow flexors', 'forearms'],
    equipment: 'dumbbell',
    instructions: [
      'Sit on an incline bench, arms hanging straight down.',
      'Curl the dumbbells up without moving your upper arms.',
      'Lower fully to get a good stretch.',
    ],
  },
  {
    name: 'Cable Curl',
    muscleGroups: ['elbow flexors', 'forearms'],
    equipment: 'cable',
    instructions: [
      'Stand at a low cable pulley with a straight or EZ bar attachment.',
      'Curl the bar to shoulder height, keeping elbows fixed.',
      'Lower with control.',
    ],
  },
  {
    name: 'Reverse Curl',
    muscleGroups: ['brachialis/brachioradialis', 'biceps', 'forearms'],
    equipment: 'barbell',
    instructions: [
      'Hold a barbell or EZ bar with an overhand (palms-down) grip, hands shoulder-width apart.',
      'Keeping your elbows at your sides, curl the bar up to your shoulders.',
      'Lower slowly to full arm extension.',
    ],
  },

  // ── TRICEPS ────────────────────────────────────────────────────────────────
  {
    name: 'Tricep Pushdown',
    muscleGroups: ['triceps'],
    equipment: 'cable',
    instructions: [
      'Stand at a high cable pulley with a bar or rope attachment.',
      'Keeping upper arms fixed at your sides, push the handle down to full extension.',
      'Slowly return to starting position.',
    ],
  },
  {
    name: 'Skull Crusher',
    muscleGroups: ['triceps'],
    equipment: 'barbell',
    instructions: [
      'Lie on a bench, press the barbell up with arms extended.',
      'Lower the bar toward your forehead by bending only at the elbows.',
      'Extend back to the start.',
    ],
  },
  {
    name: 'Overhead Tricep Extension',
    muscleGroups: ['triceps'],
    equipment: 'dumbbell',
    instructions: [
      'Hold one dumbbell with both hands overhead.',
      'Lower the dumbbell behind your head by bending at the elbows.',
      'Extend back to the top.',
    ],
  },
  {
    name: 'Dumbbell Pullover',
    muscleGroups: ['triceps long head', 'costal pecs', 'posterior delt'],
    equipment: 'dumbbell',
    instructions: [
      'Lie on a bench with a dumbbell held above your chest.',
      'Lower the dumbbell behind your head and keep the elbows extended.',
      'Raise the dumbbell back to the top.',
    ],
  },

  {
    name: 'Dips (Tricep)',
    muscleGroups: ['triceps', 'sternal pecs', 'costal pecs', 'clavicular pecs', 'anterior delt'],
    equipment: 'bodyweight',
    instructions: [
      'Grip parallel bars, keep your torso upright to target triceps.',
      'Lower yourself until elbows reach 90 degrees.',
      'Push back up to full arm extension.',
    ],
  },
  {
    name: 'Close-Grip Bench Press',
    muscleGroups: ['medial/lateral triceps', 'clavicular pecs'],
    equipment: 'barbell',
    instructions: [
      'Lie on a bench and grip the bar with hands shoulder-width apart.',
      'Lower the bar to your chest, keeping elbows close to your body.',
      'Press back up.',
    ],
  },
  {
    name: 'Diamond Push-Up',
    muscleGroups: ['medial/lateral triceps', 'clavicular pecs'],
    equipment: 'bodyweight',
    instructions: [
      'Form a diamond shape with your index fingers and thumbs on the floor.',
      'Perform a push-up keeping elbows tracking backward.',
    ],
  },

  // ── CORE ───────────────────────────────────────────────────────────────────
  {
    name: 'Plank',
    muscleGroups: ['abs'],
    equipment: 'bodyweight',
    instructions: [
      'Place forearms on the floor, elbows under shoulders. Hold a straight body position.',
      'Keep hips level and core braced. Hold for time.',
    ],
  },
  {
    name: 'Crunch',
    muscleGroups: ['abs'],
    equipment: 'bodyweight',
    instructions: [
      'Lie on your back with knees bent, hands behind head.',
      'Lift your shoulder blades off the floor using your abs, then lower.',
    ],
  },
  {
    name: 'Hanging Leg Raise',
    muscleGroups: ['hip flexors', 'abs'],
    equipment: 'bodyweight',
    instructions: [
      'Hang from a pull-up bar with arms extended.',
      'Raise your legs until they are parallel to the floor (or higher).',
      'Lower slowly.',
    ],
  },
  {
    name: 'Russian Twist',
    muscleGroups: ['abs'],
    equipment: 'bodyweight',
    instructions: [
      'Sit on the floor with knees bent, lean back slightly, feet off the ground.',
      'Rotate your torso side to side, touching the floor beside you each time.',
    ],
  },
  {
    name: 'Ab Wheel Rollout',
    muscleGroups: ['abs'],
    equipment: 'other',
    instructions: [
      'Kneel on the floor holding an ab wheel.',
      'Roll forward as far as you can while keeping hips from sagging.',
      'Roll back using your core.',
    ],
  },
  {
    name: 'Cable Crunch',
    muscleGroups: ['abs'],
    equipment: 'cable',
    instructions: [
      'Kneel in front of a high cable pulley with a rope attachment.',
      'Hold the rope at your head and crunch downward, rounding your spine.',
      'Return to the start with control.',
    ],
  },
  {
    name: 'Side Plank',
    muscleGroups: ['abs'],
    equipment: 'bodyweight',
    instructions: [
      'Lie on your side with forearm on the floor, elbow under shoulder.',
      'Lift your hips so your body forms a straight line. Hold for time.',
    ],
  },
  {
    name: 'Bicycle Crunch',
    muscleGroups: ['abs'],
    equipment: 'bodyweight',
    instructions: [
      'Lie on your back with hands behind your head.',
      'Alternate bringing each elbow to the opposite knee while extending the other leg.',
    ],
  },

  // ── GLUTES ─────────────────────────────────────────────────────────────────
  {
    name: 'Barbell Deadlift',
    muscleGroups: ['erectors', 'adductors', 'glutes'],
    equipment: 'barbell',
    instructions: [
      'Stand with feet hip-width apart, bar over mid-foot.',
      'Lifting straps are recommended.',
      'Hinge at hips and bend knees to grip the bar just outside your legs.',
      'Keep chest up and back flat. Drive through your heels to stand up.',
      'Lower the bar with control by hinging at the hips first.',
    ],
  },
 
  {
    name: 'Barbell Hip Thrust',
    muscleGroups: ['glutes', 'adductors', 'vastus quads'],
    equipment: 'barbell',
    instructions: [
      'Sit on the floor with your upper back against a bench, barbell over hips.',
      'Drive through your heels to thrust your hips up until your torso is parallel to the floor.',
      'Squeeze glutes at the top, then lower.',
    ],
  },
  {
    name: 'Glute Kickback (Cable)',
    muscleGroups: ['glutes'],
    equipment: 'cable',
    instructions: [
      'Attach an ankle strap to a low cable pulley.',
      'Kick your leg straight back, squeezing the glute at the top.',
      'Return slowly.',
    ],
  },
  {
    name: 'Donkey Kick',
    muscleGroups: ['glutes'],
    equipment: 'bodyweight',
    instructions: [
      'Start on all fours. Keeping the knee bent, kick one leg up toward the ceiling.',
      'Squeeze the glute at the top, then lower.',
    ],
  },
  {
    name: 'Abduction',
    muscleGroups: ['glutes'],
    equipment: 'machine',
    instructions: [
      'Sit in the hip abduction machine with your back against the pad and the pads on the outside of your knees.',
      'Push your knees outward as far as you can, squeezing your glutes.',
      'Return slowly to the start.',
    ],
  },

  // ── QUADS ──────────────────────────────────────────────────────────────────
  {
    name: 'Barbell Back Squat',
    muscleGroups: ['vastus quads', 'glutes', 'adductors', 'soleus'],
    equipment: 'barbell',
    instructions: [
      'Place the bar on your upper traps. Stand with feet shoulder-width apart.',
      'Brace your core and descend until thighs are parallel to the floor.',
      'Drive through heels to return to standing.',
    ],
  },
  {
    name: 'Front Squat',
    muscleGroups: ['vastus quads', 'glutes', 'adductors', 'soleus'],
    equipment: 'barbell',
    instructions: [
      'Hold the bar in a front rack position, elbows high.',
      'Squat down keeping your torso upright, then drive back up.',
    ],
  },
  {
    name: 'Leg Press',
    muscleGroups: ['vastus quads', 'glutes', 'adductors', 'soleus'],
    equipment: 'machine',
    instructions: [
      'Sit in the leg press machine, feet shoulder-width on the platform.',
      'Lower the platform until knees reach 90 degrees.',
      'Press back up without locking knees.',
    ],
  },
  {
    name: 'Leg Extension',
    muscleGroups: ['quads'],
    equipment: 'machine',
    instructions: [
      'Sit in the leg extension machine, ankles behind the pad.',
      'Extend your legs to full lockout, squeeze quads at the top.',
      'Lower slowly.',
    ],
  },
  {
    name: 'Single Leg Extension',
    muscleGroups: ['quads'],
    equipment: 'machine',
    instructions: [
      'Sit in the leg extension machine with one ankle behind the pad.',
      'Extend that leg to full lockout, squeeze the quad at the top.',
      'Lower slowly, finish the set, then switch legs.',
    ],
  },
  {
    name: 'Bulgarian Split Squat',
    muscleGroups: ['vastus quads', 'glutes', 'adductors', 'soleus'],
    equipment: 'dumbbell',
    instructions: [
      'Stand in a lunge position with your rear foot elevated on a bench.',
      'Lower your rear knee toward the floor, keeping your front shin vertical.',
      'Drive through your front heel to return.',
    ],
  },
  {
    name: 'Hack Squat',
    muscleGroups: ['vastus quads', 'glutes', 'adductors', 'soleus'],
    equipment: 'machine',
    instructions: [
      'Position yourself in the hack squat machine, feet shoulder-width on the platform.',
      'Lower until thighs are parallel, then push back up.',
    ],
  },
  {
    name: 'Lunge',
    muscleGroups: ['vastus quads', 'glutes', 'adductors', 'soleus'],
    equipment: 'bodyweight',
    instructions: [
      'Stand tall and step one foot forward.',
      'Lower your rear knee toward the floor, then push back to start.',
      'Alternate legs.',
    ],
  },
  {
    name: 'Walking Lunge',
    muscleGroups: ['vastus quads', 'glutes', 'adductors'],
    equipment: 'dumbbell',
    instructions: [
      'Hold dumbbells at your sides. Step forward into a lunge.',
      'Drive up and step the rear foot forward into the next lunge.',
      'Continue for the desired distance.',
    ],
  },

  // ── HAMSTRINGS ─────────────────────────────────────────────────────────────
  {
    name: 'Romanian Deadlift',
    muscleGroups: ['glutes', 'biarticular hamstrings', 'adductors', 'erectors'],
    equipment: 'barbell',
    instructions: [
      'Stand holding the bar at hip level.',
      'Hinge at the hips, lowering the bar along your legs until you feel a hamstring stretch.',
      'Drive hips forward to return to standing.',
    ],
  },
  {
    name: 'Stiff Leg Deadlift',
    muscleGroups: ['biarticular hamstrings', 'glutes', 'adductors', 'erectors', 'forearms'],
    equipment: 'barbell',
    instructions: [
      'Stand holding the bar at hip level.',
      'Hinge at the hips, lowering the bar along your legs until you feel a hamstring stretch.',
      'Keep legs straight and minimize knee bend.',
      'Drive hips forward to return to standing.',
    ],
  },
  {
    name: 'Lying Leg Curl',
    muscleGroups: ['hamstrings'],
    equipment: 'machine',
    instructions: [
      'Lie face down on the leg curl machine, ankles behind the pad.',
      'Curl your legs up toward your glutes.',
      'Lower slowly.',
    ],
  },
  {
    name: 'Seated Leg Curl',
    muscleGroups: ['hamstrings'],
    equipment: 'machine',
    instructions: [
      'Sit in the seated leg curl machine, ankles on top of the pad.',
      'Pull the pad down and back, curling legs to full contraction.',
      'Release slowly.',
    ],
  },
  {
    name: 'Nordic Hamstring Curl',
    muscleGroups: ['hamstrings'],
    equipment: 'bodyweight',
    instructions: [
      'Kneel with ankles secured under a fixed object.',
      'Lower your torso toward the floor as slowly as possible.',
      'Use your hands to break the fall if needed, then push back up.',
    ],
  },
  {
    name: 'Good Morning',
    muscleGroups: ['biarticular hamstrings', 'erectors', 'adductors', 'glutes'],
    equipment: 'barbell',
    instructions: [
      'Place a barbell on your upper traps. Stand with feet shoulder-width apart.',
      'Hinge at the hips until your torso is nearly parallel to the floor.',
      'Drive hips forward to return.',
    ],
  },
  {
    name: '45 Degree Back Extension',
    muscleGroups: ['biarticular hamstrings', 'hamstrings short head', 'glutes', 'erectors', 'adductors'],
    equipment: 'machine',
    instructions: [
      'Set the back extension bench to a 45 degree angle and secure your feet.',
      'Hold a barbell or dumbbells if desired.',
      'Lifting straps are recommended.',
      'Lower your upper body until you feel a stretch in your hamstrings, then extend back up until your body is straight.',
      'Keep your core tight and avoid rounding your lower back.',
    ],
  },

  // ── CALVES ─────────────────────────────────────────────────────────────────
  {
    name: 'Standing Calf Raise',
    muscleGroups: ['calves'],
    equipment: 'machine',
    instructions: [
      'Stand on a calf raise machine or a step with heels hanging off.',
      'Rise up onto your toes as high as possible.',
      'Lower your heels below the step for a full stretch.',
    ],
  },
  {
    name: 'Seated Calf Raise',
    muscleGroups: ['soleus'],
    equipment: 'machine',
    instructions: [
      'Sit in the seated calf raise machine with pads on your thighs.',
      'Press up onto your toes, pause, then lower.',
    ],
  },
  {
    name: 'Donkey Calf Raise',
    muscleGroups: ['calves'],
    equipment: 'machine',
    instructions: [
      'Lean forward and place weight on your lower back.',
      'Perform calf raises with a full range of motion.',
    ],
  },

  // ── FOREARMS ───────────────────────────────────────────────────────────────
  {
    name: 'Barbell Wrist Curl',
    muscleGroups: ['forearms'],
    equipment: 'barbell',
    instructions: [
      'Sit on a bench with forearms resting on your thighs, palms up.',
      'Lower the barbell by extending your wrists, then curl back up.',
    ],
  },
  {
    name: 'Reverse Wrist Curl',
    muscleGroups: ['forearms'],
    equipment: 'barbell',
    instructions: [
      'Same position as wrist curl but with palms facing down.',
      'Extend and flex your wrists through the full range of motion.',
    ],
  },
];

// Exercises done one arm or leg at a time — logged per side.
// Isometric holds: logged in seconds, not reps (see the Exercise model's `type`).
const YIELDING_ISOMETRIC = new Set(['Plank', 'Side Plank']);

const UNILATERAL = new Set([
  'Single-Arm Dumbbell Row', 'Bulgarian Split Squat', 'Lunge', 'Walking Lunge',
  'Glute Kickback (Cable)', 'Donkey Kick', 'Side Plank', 'Single Leg Extension',
]);

// Built-in exercises renamed after release: [old name, new name]. The existing
// document is renamed (keeping its _id, so logged workouts and plans follow it)
// before the upsert below, which then adds a fresh exercise under the old name
// if the list still has one.
const RENAMES = [
  ['Leg Extension', 'Single Leg Extension'],
];
const { UNILATERAL_NAME_PATTERN } = require('../utils/laterality');
for (const ex of exercises) {
  ex.laterality = UNILATERAL.has(ex.name) || UNILATERAL_NAME_PATTERN.test(ex.name) ? 'unilateral' : 'bilateral';
  ex.type = YIELDING_ISOMETRIC.has(ex.name) ? 'yielding' : 'dynamic';
}

// The library is strength work; cardio is logged on its own page (Log Cardio).
for (const ex of exercises) ex.category = 'strength';

// Start/end position photos for each built-in exercise, served by the web app
// from client-web/public/exercise-images. Source: Free Exercise DB
// (github.com/yuhonas/free-exercise-db), public domain (Unlicense).
const IMAGES = {
  "Barbell Bench Press": ["/exercise-images/barbell-bench-press-0.jpg", "/exercise-images/barbell-bench-press-1.jpg"],
  "Smith Machine Bench Press": ["/exercise-images/smith-machine-bench-press-0.jpg", "/exercise-images/smith-machine-bench-press-1.jpg"],
  "Incline Barbell Bench Press": ["/exercise-images/incline-barbell-bench-press-0.jpg", "/exercise-images/incline-barbell-bench-press-1.jpg"],
  "Dumbbell Bench Press": ["/exercise-images/dumbbell-bench-press-0.jpg", "/exercise-images/dumbbell-bench-press-1.jpg"],
  "Incline Dumbbell Press": ["/exercise-images/incline-dumbbell-press-0.jpg", "/exercise-images/incline-dumbbell-press-1.jpg"],
  "Dumbbell Flyes": ["/exercise-images/dumbbell-flyes-0.jpg", "/exercise-images/dumbbell-flyes-1.jpg"],
  "Cable Pec Flyes": ["/exercise-images/cable-pec-flyes-0.jpg", "/exercise-images/cable-pec-flyes-1.jpg"],
  "Push-Up": ["/exercise-images/push-up-0.jpg", "/exercise-images/push-up-1.jpg"],
  "Decline Bench Press": ["/exercise-images/decline-bench-press-0.jpg", "/exercise-images/decline-bench-press-1.jpg"],
  "Pull-Up": ["/exercise-images/pull-up-0.jpg", "/exercise-images/pull-up-1.jpg"],
  "Chin-Up": ["/exercise-images/chin-up-0.jpg", "/exercise-images/chin-up-1.jpg"],
  "Barbell Bent-Over Row": ["/exercise-images/barbell-bent-over-row-0.jpg", "/exercise-images/barbell-bent-over-row-1.jpg"],
  "Seated Cable Row": ["/exercise-images/seated-cable-row-0.jpg", "/exercise-images/seated-cable-row-1.jpg"],
  "Lat Pulldown": ["/exercise-images/lat-pulldown-0.jpg", "/exercise-images/lat-pulldown-1.jpg"],
  "Close Grip Pulldown": ["/exercise-images/close-grip-pulldown-0.jpg", "/exercise-images/close-grip-pulldown-1.jpg"],
  "Single-Arm Dumbbell Row": ["/exercise-images/single-arm-dumbbell-row-0.jpg", "/exercise-images/single-arm-dumbbell-row-1.jpg"],
  "T-Bar Row": ["/exercise-images/t-bar-row-0.jpg", "/exercise-images/t-bar-row-1.jpg"],
  "Face Pull": ["/exercise-images/face-pull-0.jpg", "/exercise-images/face-pull-1.jpg"],
  "Overhead Press (Barbell)": ["/exercise-images/overhead-press-barbell-0.jpg", "/exercise-images/overhead-press-barbell-1.jpg"],
  "Dumbbell Overhead Press": ["/exercise-images/dumbbell-overhead-press-0.jpg", "/exercise-images/dumbbell-overhead-press-1.jpg"],
  "Machine Overhead Press": ["/exercise-images/machine-overhead-press-0.jpg", "/exercise-images/machine-overhead-press-1.jpg"],
  "Lateral Raise": ["/exercise-images/lateral-raise-0.jpg", "/exercise-images/lateral-raise-1.jpg"],
  "Front Raise": ["/exercise-images/front-raise-0.jpg", "/exercise-images/front-raise-1.jpg"],
  "Arnold Press": ["/exercise-images/arnold-press-0.jpg", "/exercise-images/arnold-press-1.jpg"],
  "Close Grip Overhead Press": ["/exercise-images/close-grip-overhead-press-0.jpg", "/exercise-images/close-grip-overhead-press-1.jpg"],
  "Upright Row": ["/exercise-images/upright-row-0.jpg", "/exercise-images/upright-row-1.jpg"],
  "Barbell Curl": ["/exercise-images/barbell-curl-0.jpg", "/exercise-images/barbell-curl-1.jpg"],
  "Dumbbell Curl": ["/exercise-images/dumbbell-curl-0.jpg", "/exercise-images/dumbbell-curl-1.jpg"],
  "Hammer Curl": ["/exercise-images/hammer-curl-0.jpg", "/exercise-images/hammer-curl-1.jpg"],
  "Preacher Curl": ["/exercise-images/preacher-curl-0.jpg", "/exercise-images/preacher-curl-1.jpg"],
  "Incline Dumbbell Curl": ["/exercise-images/incline-dumbbell-curl-0.jpg", "/exercise-images/incline-dumbbell-curl-1.jpg"],
  "Cable Curl": ["/exercise-images/cable-curl-0.jpg", "/exercise-images/cable-curl-1.jpg"],
  "Reverse Curl": ["/exercise-images/reverse-curl-0.jpg", "/exercise-images/reverse-curl-1.jpg"],
  "Tricep Pushdown": ["/exercise-images/tricep-pushdown-0.jpg", "/exercise-images/tricep-pushdown-1.jpg"],
  "Skull Crusher": ["/exercise-images/skull-crusher-0.jpg", "/exercise-images/skull-crusher-1.jpg"],
  "Overhead Tricep Extension": ["/exercise-images/overhead-tricep-extension-0.jpg", "/exercise-images/overhead-tricep-extension-1.jpg"],
  "Dumbbell Pullover": ["/exercise-images/dumbbell-pullover-0.jpg", "/exercise-images/dumbbell-pullover-1.jpg"],
  "Dips (Tricep)": ["/exercise-images/dips-tricep-0.jpg", "/exercise-images/dips-tricep-1.jpg"],
  "Close-Grip Bench Press": ["/exercise-images/close-grip-bench-press-0.jpg", "/exercise-images/close-grip-bench-press-1.jpg"],
  "Diamond Push-Up": ["/exercise-images/diamond-push-up-0.jpg", "/exercise-images/diamond-push-up-1.jpg"],
  "Plank": ["/exercise-images/plank-0.jpg", "/exercise-images/plank-1.jpg"],
  "Crunch": ["/exercise-images/crunch-0.jpg", "/exercise-images/crunch-1.jpg"],
  "Hanging Leg Raise": ["/exercise-images/hanging-leg-raise-0.jpg", "/exercise-images/hanging-leg-raise-1.jpg"],
  "Russian Twist": ["/exercise-images/russian-twist-0.jpg", "/exercise-images/russian-twist-1.jpg"],
  "Ab Wheel Rollout": ["/exercise-images/ab-wheel-rollout-0.jpg", "/exercise-images/ab-wheel-rollout-1.jpg"],
  "Cable Crunch": ["/exercise-images/cable-crunch-0.jpg", "/exercise-images/cable-crunch-1.jpg"],
  "Side Plank": ["/exercise-images/side-plank-0.jpg", "/exercise-images/side-plank-1.jpg"],
  "Bicycle Crunch": ["/exercise-images/bicycle-crunch-0.jpg", "/exercise-images/bicycle-crunch-1.jpg"],
  "Barbell Deadlift": ["/exercise-images/barbell-deadlift-0.jpg", "/exercise-images/barbell-deadlift-1.jpg"],
  "Barbell Hip Thrust": ["/exercise-images/barbell-hip-thrust-0.jpg", "/exercise-images/barbell-hip-thrust-1.jpg"],
  "Glute Kickback (Cable)": ["/exercise-images/glute-kickback-cable-0.jpg", "/exercise-images/glute-kickback-cable-1.jpg"],
  "Donkey Kick": ["/exercise-images/donkey-kick-0.jpg", "/exercise-images/donkey-kick-1.jpg"],
  "Abduction": ["/exercise-images/abduction-0.jpg", "/exercise-images/abduction-1.jpg"],
  "Barbell Back Squat": ["/exercise-images/barbell-back-squat-0.jpg", "/exercise-images/barbell-back-squat-1.jpg"],
  "Front Squat": ["/exercise-images/front-squat-0.jpg", "/exercise-images/front-squat-1.jpg"],
  "Leg Press": ["/exercise-images/leg-press-0.jpg", "/exercise-images/leg-press-1.jpg"],
  "Leg Extension": ["/exercise-images/leg-extension-0.jpg", "/exercise-images/leg-extension-1.jpg"],
  "Single Leg Extension": ["/exercise-images/single-leg-extension-0.jpg", "/exercise-images/single-leg-extension-1.jpg"],
  "Bulgarian Split Squat": ["/exercise-images/bulgarian-split-squat-0.jpg", "/exercise-images/bulgarian-split-squat-1.jpg"],
  "Hack Squat": ["/exercise-images/hack-squat-0.jpg", "/exercise-images/hack-squat-1.jpg"],
  "Lunge": ["/exercise-images/lunge-0.jpg", "/exercise-images/lunge-1.jpg"],
  "Walking Lunge": ["/exercise-images/walking-lunge-0.jpg", "/exercise-images/walking-lunge-1.jpg"],
  "Romanian Deadlift": ["/exercise-images/romanian-deadlift-0.jpg", "/exercise-images/romanian-deadlift-1.jpg"],
  "Stiff Leg Deadlift": ["/exercise-images/stiff-leg-deadlift-0.jpg", "/exercise-images/stiff-leg-deadlift-1.jpg"],
  "Lying Leg Curl": ["/exercise-images/lying-leg-curl-0.jpg", "/exercise-images/lying-leg-curl-1.jpg"],
  "Seated Leg Curl": ["/exercise-images/seated-leg-curl-0.jpg", "/exercise-images/seated-leg-curl-1.jpg"],
  "Nordic Hamstring Curl": ["/exercise-images/nordic-hamstring-curl-0.jpg", "/exercise-images/nordic-hamstring-curl-1.jpg"],
  "Good Morning": ["/exercise-images/good-morning-0.jpg", "/exercise-images/good-morning-1.jpg"],
  "45 Degree Back Extension": ["/exercise-images/45-degree-back-extension-0.jpg", "/exercise-images/45-degree-back-extension-1.jpg"],
  "Standing Calf Raise": ["/exercise-images/standing-calf-raise-0.jpg", "/exercise-images/standing-calf-raise-1.jpg"],
  "Seated Calf Raise": ["/exercise-images/seated-calf-raise-0.jpg", "/exercise-images/seated-calf-raise-1.jpg"],
  "Donkey Calf Raise": ["/exercise-images/donkey-calf-raise-0.jpg", "/exercise-images/donkey-calf-raise-1.jpg"],
  "Barbell Wrist Curl": ["/exercise-images/barbell-wrist-curl-0.jpg", "/exercise-images/barbell-wrist-curl-1.jpg"],
  "Reverse Wrist Curl": ["/exercise-images/reverse-wrist-curl-0.jpg", "/exercise-images/reverse-wrist-curl-1.jpg"],
};
for (const ex of exercises) ex.images = IMAGES[ex.name] || [];

// Secondary muscles (count 0.5 per set instead of 1).
const SECONDARY = {
  "Barbell Bench Press": ["medial/lateral triceps"],
  "Smith Machine Bench Press": ["medial/lateral triceps"],
  "Incline Barbell Bench Press": ["costal pecs", "medial/lateral triceps"],
  "Incline Dumbbell Press": ["costal pecs"],
  "Dumbbell Bench Press": ["medial/lateral triceps"],
  "Push-Up": ["medial/lateral triceps"],
  "Decline Bench Press": ["clavicular pecs", "medial/lateral triceps"],
  "Dips (Tricep)": ["clavicular pecs"],
  // Overhead presses count a full set for the middle delts (except the Arnold
  // press: the rotation makes it mostly a front-delt press).
  "Overhead Press (Barbell)": ["clavicular pecs", "medial/lateral triceps"],
  "Dumbbell Overhead Press": ["clavicular pecs", "medial/lateral triceps"],
  "Machine Overhead Press": ["clavicular pecs", "medial/lateral triceps"],
  "Arnold Press": ["middle delt", "clavicular pecs", "medial/lateral triceps"],
  "Close Grip Overhead Press": ["clavicular pecs","medial/lateral triceps"],
  "Barbell Back Squat": ["soleus"],
  "Front Squat": ["soleus"],
  "Leg Press": ["soleus"],
  "Bulgarian Split Squat": ["soleus"],
  "Hack Squat": ["soleus"],
  "Lunge": ["soleus"],
  "45 Degree Back Extension": ["hamstrings short head"],
  "Romanian Deadlift": ["biarticular hamstrings"],
  "Lateral Raise": ["anterior delt"],
  "Close Grip Pulldown": ["costal pecs"],
  "Reverse Curl": ["biceps"],
  "Dumbbell Pullover": ["posterior delt"],
  "Upright Row": ["posterior delt"],
  "Pull-Up": ["posterior delt"],
};
for (const ex of exercises) ex.secondaryMuscles = SECONDARY[ex.name] || [];
// Forearms only hold the grip, except on wrist curls and reverse curls.
for (const ex of exercises) if (forearmsAreSecondary(ex)) ex.secondaryMuscles.push('forearms');
// Pulls bend the elbow, so the elbow flexors help (half a set) where they aren't listed.
for (const ex of exercises) {
  if (needsSecondaryElbowFlexors(ex)) { ex.muscleGroups.push('elbow flexors'); ex.secondaryMuscles.push('elbow flexors'); }
  // Wide-grip pulldowns also bring in the rear delts (half a set).
  if (needsSecondaryRearDelts(ex)) { ex.muscleGroups.push('posterior delt'); ex.secondaryMuscles.push('posterior delt'); }
  // Leg curls bend the knee, which the gastrocnemius helps with.
  if (needsSecondaryGastroc(ex)) { ex.muscleGroups.push('gastrocnemius'); ex.secondaryMuscles.push('gastrocnemius'); }
}

const seed = async () => {
  await connectDB();
  try {
    // Upsert by name instead of delete+insert, so existing exercise _ids
    // stay stable across reseeds. WorkoutPlan/WorkoutSession documents
    // reference exercises by _id directly — recreating them with new ids
    // would orphan anything that already used the old ones.
    for (const [from, to] of RENAMES) {
      const alreadyRenamed = await Exercise.exists({ name: to, isCustom: false });
      if (alreadyRenamed) continue; // done on an earlier run
      const res = await Exercise.updateOne({ name: from, isCustom: false }, { $set: { name: to } });
      if (res.modifiedCount) console.log(`↪️  Renamed exercise "${from}" → "${to}"`);
    }

    const ops = exercises.map((ex) => ({
      updateOne: {
        filter: { name: ex.name, isCustom: false },
        update: { $set: { ...ex, isCustom: false } },
        upsert: true,
      },
    }));

    const result = await Exercise.bulkWrite(ops);
    console.log(
      `✅  Exercises synced (matched: ${result.matchedCount}, updated: ${result.modifiedCount}, inserted: ${result.upsertedCount})`
    );

    // Print breakdown by muscle group
    const groups = exercises.reduce((acc, ex) => {
      ex.muscleGroups.forEach((g) => { acc[g] = (acc[g] || 0) + 1; });
      return acc;
    }, {});
    console.table(groups);
  } catch (err) {
    console.error('❌ Seed error:', err);
  } finally {
    mongoose.connection.close();
  }
};

seed();