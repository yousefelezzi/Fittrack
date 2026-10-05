require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Food = require('../models/Food');
const connectDB = require('../config/db');
const { foods } = require('./foods.data');

const seed = async () => {
  await connectDB();
  try {
    // Upsert by name instead of delete+insert, so existing food _ids
    // stay stable across reseeds (NutritionLog entries reference foods
    // by _id, so recreating them would orphan logged entries).
    const ops = foods.map((f) => ({
      updateOne: {
        filter: { name: f.name },
        update: { $set: f },
        upsert: true,
      },
    }));

    const result = await Food.bulkWrite(ops);
    console.log(
      `✅ Foods synced (matched: ${result.matchedCount}, updated: ${result.modifiedCount}, inserted: ${result.upsertedCount})`
    );
    process.exit(0);
  } catch (err) {
    console.error('❌ Food seed error:', err.message);
    process.exit(1);
  }
};

seed();
