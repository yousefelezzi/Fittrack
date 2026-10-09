/**
 * One-off data migrations, run once each on server start.
 * Applied migrations are recorded in the `migrations` collection, so each one
 * runs exactly once per database even though the server restarts often.
 */
const mongoose = require('mongoose');
const splitUnilateralSets = require('../utils/splitUnilateralSets');
const { UNILATERAL_NAME_PATTERN } = require('../utils/laterality');
const { forearmsAreSecondary } = require('../utils/forearmRole');
const { needsSecondaryElbowFlexors, needsSecondaryRearDelts } = require('../utils/pullHelpers');
const { needsSecondaryGastroc } = require('../utils/legCurlHelpers');

const migrations = [
  {
    // RIR was added after these workouts were logged. Treat their sets as taken
    // to failure (0 RIR). Runs once, so blank RIR on later workouts stays blank.
    name: '2026-09-set-old-workouts-rir-0',
    async up(db) {
      const res = await db.collection('workoutsessions').updateMany(
        {},
        { $set: { 'exercises.$[].sets.$[s].rir': 0 } },
        { arrayFilters: [{ 's.rir': null }] } // matches missing or null
      );
      return `${res.modifiedCount} workout(s) updated`;
    },
  },
  {
    // Exercises that are now unilateral were logged before sides existed, as one
    // entry per set. Assume both sides did the same: each old set becomes a left
    // and a right entry with the same reps/weight/RIR, rest kept on the right.
    name: '2026-09-split-old-unilateral-sets',
    async up(db) {
      const ids = await db.collection('exercises')
        .find({ laterality: 'unilateral' }, { projection: { _id: 1 } }).map((e) => e._id).toArray();
      return `${await splitUnilateralSets(db, ids)} workout(s) updated`;
    },
  },
  {
    // Cable lateral raises, dumbbell preacher curls and anything single/one arm
    // or leg are done one side at a time — built-in or custom. Mark them
    // unilateral and split their old sets into left + right like above.
    name: '2026-09-more-unilateral-exercises',
    async up(db) {
      const exercises = db.collection('exercises');
      const filter = { laterality: { $ne: 'unilateral' }, name: { $regex: UNILATERAL_NAME_PATTERN.source, $options: 'i' } };
      const ids = await exercises.find(filter, { projection: { _id: 1 } }).map((e) => e._id).toArray();
      if (ids.length === 0) return 'no exercises matched';
      await exercises.updateMany({ _id: { $in: ids } }, { $set: { laterality: 'unilateral' } });
      return `${ids.length} exercise(s) marked unilateral, ${await splitUnilateralSets(db, ids)} workout(s) updated`;
    },
  },
  {
    // The "biceps" muscle is now "elbow flexors" (biceps, brachialis and
    // brachioradialis). The seed renames it on built-in exercises; this does
    // the same for custom exercises.
    name: '2026-09-biceps-to-elbow-flexors',
    async up(db) {
      const res = await db.collection('exercises').updateMany(
        { muscleGroups: 'biceps' },
        { $set: { 'muscleGroups.$[m]': 'elbow flexors' } },
        { arrayFilters: [{ m: 'biceps' }] }
      );
      return `${res.modifiedCount} exercise(s) updated`;
    },
  },
  {
    // Squat, leg press and lunge patterns mostly train the vasti, not the rectus
    // femoris, so they're tagged "vastus quads". The seed does this for built-in
    // exercises; this does it for custom ones with those names. Sissy squats and
    // leg extensions keep "quads" (both heads).
    name: '2026-09-squat-patterns-vastus-quads',
    async up(db) {
      const res = await db.collection('exercises').updateMany(
        {
          isCustom: true,
          muscleGroups: 'quads',
          $and: [
            { name: { $regex: 'squat|leg press|lunge|step[ -]?up', $options: 'i' } },
            { name: { $not: /sissy/i } },
          ],
        },
        { $set: { 'muscleGroups.$[m]': 'vastus quads' } },
        { arrayFilters: [{ m: 'quads' }] }
      );
      return `${res.modifiedCount} custom exercise(s) updated`;
    },
  },
  {
    // "Full body" is no longer a muscle group: exercises that had it are cardio
    // (their own section). Difficulty ratings are gone. The seed handles the
    // built-in library; this cleans up custom exercises and old fields.
    name: '2026-09-cardio-category-no-difficulty',
    async up(db) {
      const exercises = db.collection('exercises');
      const cardio = await exercises.updateMany(
        { muscleGroups: 'full_body' },
        { $set: { category: 'cardio' }, $pull: { muscleGroups: 'full_body' } }
      );
      await exercises.updateMany({ category: { $exists: false } }, { $set: { category: 'strength' } });
      const diff = await exercises.updateMany({ difficulty: { $exists: true } }, { $unset: { difficulty: '' } });
      return `${cardio.modifiedCount} moved to cardio, difficulty removed from ${diff.modifiedCount}`;
    },
  },
  {
    // Back exercises (first tag lats or trapezius) no longer count for the elbow
    // flexors, only forearms. The seed does the built-in ones; this does custom
    // back exercises the same way.
    name: '2026-09-back-exercises-no-elbow-flexors',
    async up(db) {
      const exercises = db.collection('exercises');
      const filter = { isCustom: true, muscleGroups: 'elbow flexors', 'muscleGroups.0': { $in: ['lats', 'trapezius'] } };
      const ids = await exercises.find(filter, { projection: { _id: 1 } }).map((e) => e._id).toArray();
      if (!ids.length) return 'no custom back exercises with elbow flexors';
      await exercises.updateMany({ _id: { $in: ids } }, { $pull: { muscleGroups: 'elbow flexors' } });
      await exercises.updateMany({ _id: { $in: ids } }, { $addToSet: { muscleGroups: 'forearms' } });
      return `${ids.length} custom exercise(s) updated`;
    },
  },
  {
    // Incline pressing and flyes train the clavicular and sternal pecs but not
    // the costal (lower) region. Replace a plain "pecs" tag on custom incline
    // exercises; the seed does the built-in ones.
    name: '2026-09-incline-no-costal-pecs',
    async up(db) {
      const exercises = db.collection('exercises');
      const ids = await exercises
        .find({ isCustom: true, muscleGroups: 'pecs', name: { $regex: 'incline', $options: 'i' } }, { projection: { _id: 1 } })
        .map((e) => e._id).toArray();
      if (!ids.length) return 'no custom incline exercises tagged pecs';
      for (const _id of ids) {
        const ex = await exercises.findOne({ _id });
        const tags = ex.muscleGroups.flatMap((m) => (m === 'pecs' ? ['clavicular pecs', 'sternal pecs'] : [m]));
        await exercises.updateOne({ _id }, { $set: { muscleGroups: [...new Set(tags)] } });
      }
      return `${ids.length} custom exercise(s) updated`;
    },
  },
  {
    // The short-lived "iliopsoas" tag is gone: it's "hip flexors" again (which no
    // longer counts for rectus femoris; use the "rectus femoris" tag for that).
    name: '2026-09-iliopsoas-to-hip-flexors',
    async up(db) {
      const exercises = db.collection('exercises');
      const res = await exercises.updateMany(
        { muscleGroups: 'iliopsoas' },
        { $set: { 'muscleGroups.$[m]': 'hip flexors' } },
        { arrayFilters: [{ m: 'iliopsoas' }] }
      );
      // An exercise could now list hip flexors twice; keep one.
      for await (const ex of exercises.find({ muscleGroups: 'hip flexors' })) {
        const unique = [...new Set(ex.muscleGroups)];
        if (unique.length !== ex.muscleGroups.length) await exercises.updateOne({ _id: ex._id }, { $set: { muscleGroups: unique } });
      }
      return `${res.modifiedCount} exercise(s) updated`;
    },
  },
  {
    // Hip hinges (RDL, stiff-leg deadlift, good morning) only train the two-joint
    // hamstrings (back extensions are the exception: the short head works
    // isometrically there, so they keep "hamstrings"); only knee flexion (leg curls) reaches the
    // short head. Custom hinge exercises tagged "hamstrings" become
    // "biarticular hamstrings"; the seed does the built-in ones.
    name: '2026-09-hinges-biarticular-hamstrings',
    async up(db) {
      const exercises = db.collection('exercises');
      const res = await exercises.updateMany(
        {
          isCustom: true,
          muscleGroups: 'hamstrings',
          name: { $regex: 'deadlift|\\brdl\\b|sldl|good ?morning|hip hinge|pull[- ]?through', $options: 'i' },
        },
        { $set: { 'muscleGroups.$[m]': 'biarticular hamstrings' } },
        { arrayFilters: [{ m: 'hamstrings' }] }
      );
      return `${res.modifiedCount} custom exercise(s) updated`;
    },
  },
  {
    // Back extensions also train the short head isometrically, so they count for
    // all hamstrings. Undo "biarticular hamstrings" on custom back extensions
    // (in case an earlier version of the hinge update got to them first).
    name: '2026-09-back-extension-all-hamstrings',
    async up(db) {
      const res = await db.collection('exercises').updateMany(
        { isCustom: true, muscleGroups: 'biarticular hamstrings', name: { $regex: 'back extension|hyperextension', $options: 'i' } },
        { $set: { 'muscleGroups.$[m]': 'hamstrings' } },
        { arrayFilters: [{ m: 'biarticular hamstrings' }] }
      );
      return `${res.modifiedCount} custom exercise(s) updated`;
    },
  },
  {
    // Chin-ups (supinated grip) do train the elbow flexors — the one back
    // exercise that keeps them — and dips train both triceps heads (the long
    // head too, from the shoulder extension). The seed does the built-in ones;
    // this does custom exercises with those names.
    name: '2026-09-chinups-elbow-flexors-dips-all-triceps',
    async up(db) {
      const exercises = db.collection('exercises');
      const chins = await exercises.updateMany(
        { isCustom: true, name: { $regex: 'chin[- ]?ups?', $options: 'i' }, muscleGroups: { $ne: 'elbow flexors' } },
        { $push: { muscleGroups: 'elbow flexors' } }
      );
      const dips = await exercises.updateMany(
        { isCustom: true, name: { $regex: '\\bdips?\\b', $options: 'i' }, muscleGroups: 'medial/lateral triceps' },
        { $set: { 'muscleGroups.$[m]': 'triceps' } },
        { arrayFilters: [{ m: 'medial/lateral triceps' }] }
      );
      return `${chins.modifiedCount} chin-up(s), ${dips.modifiedCount} dip(s) updated`;
    },
  },
  {
    // "anterior/middle/posterior deltoid" are now "… delt". Rename the tags on
    // every exercise, built-in or custom, in both primary and secondary muscles.
    name: '2026-10-deltoid-to-delt',
    async up(db) {
      const exercises = db.collection('exercises');
      let n = 0;
      for (const field of ['muscleGroups', 'secondaryMuscles']) {
        for (const head of ['anterior', 'middle', 'posterior']) {
          const res = await exercises.updateMany(
            { [field]: `${head} deltoid` },
            { $set: { [`${field}.$[m]`]: `${head} delt` } },
            { arrayFilters: [{ m: `${head} deltoid` }] }
          );
          n += res.modifiedCount;
        }
      }
      return `${n} tag update(s)`;
    },
  },
  {
    // Forearms are secondary everywhere (they just hold the grip) except on
    // wrist curls and reverse curls. The seed does the built-in exercises;
    // this updates every exercise already in the database, custom ones included.
    name: '2026-10-forearms-secondary-except-wrist-and-reverse-curls',
    async up(db) {
      const exercises = db.collection('exercises');
      let n = 0;
      for await (const ex of exercises.find({ muscleGroups: 'forearms' }, { projection: { name: 1, muscleGroups: 1, secondaryMuscles: 1 } })) {
        if (!forearmsAreSecondary(ex) || (ex.secondaryMuscles || []).includes('forearms')) continue;
        await exercises.updateOne({ _id: ex._id }, { $addToSet: { secondaryMuscles: 'forearms' } });
        n++;
      }
      return `${n} exercise(s) updated`;
    },
  },
  {
    // Pulling movements (rows, pulldowns, pull-ups…) count the elbow flexors as
    // a secondary muscle (half a set) where they aren't listed. The seed does the
    // built-in ones; this updates every exercise already in the database.
    name: '2026-10-pulls-secondary-elbow-flexors',
    async up(db) {
      const exercises = db.collection('exercises');
      let n = 0;
      for await (const ex of exercises.find({ 'muscleGroups.0': { $in: ['lats', 'trapezius', 'posterior delt'] } }, { projection: { name: 1, muscleGroups: 1 } })) {
        if (!needsSecondaryElbowFlexors(ex)) continue;
        await exercises.updateOne({ _id: ex._id }, { $push: { muscleGroups: 'elbow flexors' }, $addToSet: { secondaryMuscles: 'elbow flexors' } });
        n++;
      }
      return `${n} exercise(s) updated`;
    },
  },
  {
    // Wide-grip pulldowns count the rear delts as a secondary muscle (half a
    // set). The seed does the built-in ones; this updates every exercise
    // already in the database, custom ones included.
    name: '2026-10-wide-pulldowns-secondary-rear-delts',
    async up(db) {
      const exercises = db.collection('exercises');
      let n = 0;
      for await (const ex of exercises.find({ name: { $regex: 'pull[- ]?down', $options: 'i' } }, { projection: { name: 1, muscleGroups: 1 } })) {
        if (!needsSecondaryRearDelts(ex)) continue;
        await exercises.updateOne({ _id: ex._id }, { $push: { muscleGroups: 'posterior delt' }, $addToSet: { secondaryMuscles: 'posterior delt' } });
        n++;
      }
      return `${n} exercise(s) updated`;
    },
  },
  {
    // Overhead presses count a full set for the middle delts (they were
    // secondary), except Arnold presses. The seed does the built-in ones; this
    // updates custom overhead/shoulder/military/push presses (close-grip excluded).
    name: '2026-10-overhead-press-middle-delt-primary',
    async up(db) {
      const res = await db.collection('exercises').updateMany(
        {
          secondaryMuscles: 'middle delt',
          $and: [
            { name: { $regex: '(overhead|shoulder|military|push) press', $options: 'i' } },
            { name: { $not: /close[- ]?grip|arnold/i } },
          ],
        },
        { $pull: { secondaryMuscles: 'middle delt' } }
      );
      return `${res.modifiedCount} exercise(s) updated`;
    },
  },
  {
    // Chats used an emoji for a shared workout in the inbox preview.
    name: '2026-10-plain-shared-workout-preview',
    async up(db) {
      const res = await db.collection('conversations').updateMany(
        { 'lastMessage.text': '🏋️ Shared a workout' },
        { $set: { 'lastMessage.text': 'Shared a workout' } }
      );
      return `${res.modifiedCount} conversation(s) updated`;
    },
  },
  {
    // Exercises got a type (dynamic / yielding / overcoming isometric). Holds
    // like planks and wall sits are yielding isometrics, logged in seconds;
    // everything else stays dynamic. Built-in ones are also set by the seed.
    name: '2026-10-exercise-types',
    async up(db) {
      const ex = db.collection('exercises');
      const holds = await ex.updateMany(
        { type: { $exists: false }, name: { $regex: '\\b(plank|wall sit|dead hang|hollow (body )?hold|l-sit|isometric hold|static hold)\\b', $options: 'i' } },
        { $set: { type: 'yielding' } }
      );
      const rest = await ex.updateMany({ type: { $exists: false } }, { $set: { type: 'dynamic' } });
      return `${holds.modifiedCount} hold(s) set to yielding, ${rest.modifiedCount} set to dynamic`;
    },
  },
  {
    // Leg curls count the gastrocnemius as a secondary muscle (it helps bend
    // the knee). The seed does the built-in ones; this updates every exercise
    // already in the database, custom ones included.
    name: '2026-10-leg-curls-secondary-gastrocnemius',
    async up(db) {
      const exercises = db.collection('exercises');
      let n = 0;
      for await (const ex of exercises.find({ name: { $regex: 'curl|nordic', $options: 'i' } }, { projection: { name: 1, muscleGroups: 1 } })) {
        if (!needsSecondaryGastroc(ex)) continue;
        await exercises.updateOne({ _id: ex._id }, { $push: { muscleGroups: 'gastrocnemius' }, $addToSet: { secondaryMuscles: 'gastrocnemius' } });
        n++;
      }
      return `${n} exercise(s) updated`;
    },
  },
  {
    // Rear delts only help on dumbbell pullovers: secondary (0.5 − x per set)
    // instead of a full set. Built-in and custom ones that list them.
    name: '2026-10-dumbbell-pullover-secondary-rear-delts',
    async up(db) {
      const res = await db.collection('exercises').updateMany(
        { name: { $regex: 'dumbbell.*pull[- ]?over', $options: 'i' }, muscleGroups: 'posterior delt' },
        { $addToSet: { secondaryMuscles: 'posterior delt' } }
      );
      return `${res.modifiedCount} exercise(s) updated`;
    },
  },
  {
    // Rear delts only help on upright rows too: secondary instead of a full set.
    // Built-in and custom upright rows that list them.
    name: '2026-10-upright-row-secondary-rear-delts',
    async up(db) {
      const res = await db.collection('exercises').updateMany(
        { name: { $regex: 'upright[- ]?row', $options: 'i' }, muscleGroups: 'posterior delt' },
        { $addToSet: { secondaryMuscles: 'posterior delt' } }
      );
      return `${res.modifiedCount} exercise(s) updated`;
    },
  },
  {
    // Custom foods now remember who made them. Older ones didn't, so credit
    // each to whoever logged it first (it's then listed under "Your foods").
    name: '2026-10-custom-foods-created-by',
    async up(db) {
      const foods = await db.collection('foods').find({ source: 'custom', createdBy: { $in: [null, undefined] } }, { projection: { _id: 1 } }).toArray();
      let n = 0;
      for (const f of foods) {
        const log = await db.collection('nutritionlogs').find({ $or: [{ 'meals.food': f._id }, { 'meals.ingredients.food': f._id }] })
          .sort({ date: 1 }).limit(1).project({ user: 1 }).next();
        if (!log) continue;
        await db.collection('foods').updateOne({ _id: f._id }, { $set: { createdBy: log.user } });
        n++;
      }
      return `${n} of ${foods.length} custom food(s) credited`;
    },
  },
  {
    // Supplements now have a stack (loaded onto a day in one go) and each day
    // keeps its own list. Everything added before was the stack, and each day's
    // entries keep the servings they had, so editing a supplement later doesn't
    // change past days.
    name: '2026-10-supplement-stack',
    async up(db) {
      const stack = await db.collection('supplements').updateMany({ inStack: { $exists: false } }, { $set: { inStack: true } });
      const sups = await db.collection('supplements').find({}, { projection: { servings: 1 } }).toArray();
      const servings = new Map(sups.map((s) => [String(s._id), s.servings || 1]));
      const logs = await db.collection('nutritionlogs').find({ 'supplementsTaken.0': { $exists: true } }, { projection: { supplementsTaken: 1 } }).toArray();
      let entries = 0;
      for (const log of logs) {
        const updated = log.supplementsTaken.map((t) => (t.servings ? t : (entries++, { ...t, servings: servings.get(String(t.supplement)) || 1 })));
        await db.collection('nutritionlogs').updateOne({ _id: log._id }, { $set: { supplementsTaken: updated } });
      }
      return `${stack.modifiedCount} supplement(s) put in stacks, ${entries} day entr(ies) given their servings`;
    },
  },
  {
    // The stack is now put on each day automatically, to be ticked off. Days
    // before today that already have supplements logged keep exactly what they
    // had (all taken); other days, today included, get the stack (unticked)
    // the first time they're opened, next to anything already logged.
    name: '2026-10-supplement-stack-autoload',
    async up(db) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const res = await db.collection('nutritionlogs').updateMany(
        { 'supplementsTaken.0': { $exists: true }, supplementsStackLoaded: { $ne: true }, date: { $lt: today } },
        { $set: { supplementsStackLoaded: true } }
      );
      return `${res.modifiedCount} day(s) with supplements kept as logged`;
    },
  },
  {
    // Workout reminders now follow the active plan's days instead of days
    // picked in Settings.
    name: '2026-10-drop-workout-days',
    async up(db) {
      const res = await db.collection('users').updateMany({ workoutDays: { $exists: true } }, { $unset: { workoutDays: '' } });
      return `${res.modifiedCount} user(s) updated`;
    },
  },
  {
    // New users now start on a Get Started page; everyone who signed up before
    // counts as done.
    name: '2026-10-onboarded-existing-users',
    async up(db) {
      const users = await db.collection('users').find({ onboardedAt: { $in: [null, undefined] } }, { projection: { createdAt: 1 } }).toArray();
      for (const u of users) await db.collection('users').updateOne({ _id: u._id }, { $set: { onboardedAt: u.createdAt || new Date() } });
      return `${users.length} existing user(s) marked as started`;
    },
  },
  {
    // Everyone now has a unique username; accounts from before get one made
    // from their name (they can change it in their profile).
    name: '2026-10-usernames',
    async up(db) {
      const { makeUsername } = require('../utils/username');
      const users = await db.collection('users').find({ $or: [{ username: { $exists: false } }, { username: null }] }, { projection: { name: 1, email: 1 } }).toArray();
      for (const u of users) await db.collection('users').updateOne({ _id: u._id }, { $set: { username: await makeUsername(u.name, u.email) } });
      return `${users.length} username(s) created`;
    },
  },
  {
    // Saturated fat and creatine are now tracked. The built-in foods get them
    // from the seed (which runs before the server starts); here custom recipes
    // are recomputed from their ingredients, and logged meals that remember
    // their food and grams get them filled in.
    name: '2026-10-saturated-fat-creatine',
    async up(db) {
      const { per100gFor } = require('../utils/foodState');
      const KEYS = ['saturatedFat', 'creatine'];
      const foods = db.collection('foods');
      const round = (n) => Math.round(n * 1000) / 1000;
      const byId = new Map((await foods.find({}).toArray()).map((f) => [String(f._id), f]));
      // Sum of the new keys (and calories, to scale) over a list of { food, grams, state }.
      const sumOf = (items) => {
        const out = { calories: 0, saturatedFat: 0, creatine: 0 };
        for (const it of items || []) {
          const f = byId.get(String(it.food));
          if (!f || !(it.grams > 0)) continue;
          const p = per100gFor(f, it.state);
          out.calories += (p.calories || 0) * it.grams / 100;
          for (const k of KEYS) out[k] += (p.micros?.[k] || 0) * it.grams / 100;
        }
        return out;
      };

      // Recipes: per 100 g scales with the ingredients the same way calories do.
      let recipes = 0;
      for (const f of byId.values()) {
        if (!f.ingredients?.length) continue;
        const t = sumOf(f.ingredients);
        if (!(t.calories > 0) || !(f.per100g?.calories > 0)) continue;
        const scale = f.per100g.calories / t.calories;
        const set = Object.fromEntries(KEYS.map((k) => [`per100g.micros.${k}`, round(t[k] * scale)]));
        await foods.updateOne({ _id: f._id }, { $set: set });
        Object.assign(f.per100g.micros || (f.per100g.micros = {}), Object.fromEntries(KEYS.map((k) => [k, round(t[k] * scale)])));
        recipes++;
      }

      // Logged meals.
      let meals = 0;
      const logs = await db.collection('nutritionlogs').find({ 'meals.0': { $exists: true } }).toArray();
      for (const log of logs) {
        let changed = false;
        for (const m of log.meals) {
          let t = null;
          if (m.ingredients?.length) t = sumOf(m.ingredients);
          else if (m.food && m.grams > 0) t = sumOf([{ food: m.food, grams: m.grams, state: m.state }]);
          if (!t) continue;
          m.micros = { ...(m.micros || {}), saturatedFat: round(t.saturatedFat), creatine: round(t.creatine) };
          changed = true;
          meals++;
        }
        if (changed) await db.collection('nutritionlogs').updateOne({ _id: log._id }, { $set: { meals: log.meals } });
      }
      return `${recipes} recipe(s) and ${meals} logged meal(s) updated`;
    },
  },
];

async function runMigrations() {
  const db = mongoose.connection.db;
  const applied = db.collection('migrations');
  for (const m of migrations) {
    if (await applied.findOne({ name: m.name })) continue;
    try {
      const result = await m.up(db);
      await applied.insertOne({ name: m.name, appliedAt: new Date(), result });
      console.log(`✅ Migration ${m.name}: ${result}`);
    } catch (err) {
      // Don't take the server down; it'll be retried on the next start.
      console.error(`❌ Migration ${m.name} failed:`, err.message);
    }
  }
}

module.exports = runMigrations;
