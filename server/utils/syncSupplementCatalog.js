const SupplementCatalog = require('../models/SupplementCatalog');
const { CATALOG } = require('./supplementCatalog');

/** Upsert the built-in supplement list (by name). Runs on server start. */
async function syncSupplementCatalog() {
  try {
    await SupplementCatalog.bulkWrite(CATALOG.map((item) => ({
      updateOne: { filter: { name: item.name }, update: { $set: item }, upsert: true },
    })));
  } catch (err) {
    console.error('Supplement catalog sync failed:', err.message);
  }
}

module.exports = syncSupplementCatalog;
