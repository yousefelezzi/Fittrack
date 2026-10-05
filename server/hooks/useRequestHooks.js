/**
 * server/hooks/useRequestHooks.js
 *
 * Composable Express middleware factories that can be attached to any route.
 * All exports are functions that return standard (req, res, next) middleware.
 *
 * Usage:
 *   const { rateLimit, requireOwnership, parseSort } = require('../hooks/useRequestHooks');
 *
 *   router.delete('/:id', protect, requireOwnership(WorkoutSession), deleteWorkout);
 *   router.get('/',       protect, parseSort(['date', 'name']), getWorkouts);
 */

const mongoose = require('mongoose');

/**
 * requireOwnership(Model, userField = 'user')
 *
 * Fetches the document by req.params.id and confirms req.user.id matches
 * the `userField`. Calls next() on success; returns 403/404 otherwise.
 * Attaches the found document as req.doc for downstream handlers.
 */
function requireOwnership(Model, userField = 'user') {
  return async (req, res, next) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ message: 'Invalid ID' });
      }

      const doc = await Model.findById(req.params.id);
      if (!doc) return res.status(404).json({ message: 'Not found' });

      const ownerId = doc[userField]?.toString?.() ?? doc[userField];
      if (ownerId !== req.user.id.toString()) {
        return res.status(403).json({ message: 'Forbidden — you do not own this resource' });
      }

      req.doc = doc;
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * parseSort(allowedFields = [])
 *
 * Reads `?sort=field&order=asc|desc` from the query string, validates the
 * field against the allowedFields whitelist, and attaches a Mongoose-ready
 * sort object as req.sortQuery.
 *
 * Falls back to { createdAt: -1 } when the sort field is absent or invalid.
 */
function parseSort(allowedFields = []) {
  return (req, _res, next) => {
    const { sort, order } = req.query;
    const dir = order === 'asc' ? 1 : -1;

    req.sortQuery =
      sort && allowedFields.includes(sort)
        ? { [sort]: dir }
        : { createdAt: -1 };

    next();
  };
}

/**
 * parseDateRange()
 *
 * Reads `?from=YYYY-MM-DD&to=YYYY-MM-DD` and attaches a Mongoose date
 * filter as req.dateFilter. Skips silently when neither param is present.
 */
function parseDateRange() {
  return (req, _res, next) => {
    const { from, to } = req.query;
    req.dateFilter = {};
    if (from) req.dateFilter.$gte = new Date(from);
    if (to)   req.dateFilter.$lte = new Date(to);
    next();
  };
}

/**
 * simplePaginate(defaultLimit = 10, maxLimit = 100)
 *
 * Reads `?page=N&limit=N` from the query string.
 * Attaches req.skip and req.limit for use with .skip().limit() chains.
 * Also sets res.locals.pagination so controllers can embed it in responses.
 */
function simplePaginate(defaultLimit = 10, maxLimit = 100) {
  return (req, res, next) => {
    const page  = Math.max(1, parseInt(req.query.page,  10) || 1);
    const limit = Math.min(maxLimit, parseInt(req.query.limit, 10) || defaultLimit);

    req.skip  = (page - 1) * limit;
    req.limit = limit;
    res.locals.pagination = { page, limit };

    next();
  };
}

/**
 * validateObjectId(paramName = 'id')
 *
 * Short-circuits with 400 if the named route param is not a valid ObjectId.
 * Saves every controller from repeating mongoose.Types.ObjectId.isValid().
 */
function validateObjectId(paramName = 'id') {
  return (req, res, next) => {
    if (!mongoose.Types.ObjectId.isValid(req.params[paramName])) {
      return res.status(400).json({ message: `Invalid ${paramName}` });
    }
    next();
  };
}

/**
 * setTimestampFilter(fieldName = 'date')
 *
 * After parseDateRange(), wires req.dateFilter into a ready-made Mongoose
 * filter fragment: { [fieldName]: req.dateFilter } — only when the filter
 * has at least one bound.  Attaches as req.timestampFilter.
 */
function setTimestampFilter(fieldName = 'date') {
  return (req, _res, next) => {
    req.timestampFilter =
      Object.keys(req.dateFilter || {}).length > 0
        ? { [fieldName]: req.dateFilter }
        : {};
    next();
  };
}

module.exports = {
  requireOwnership,
  parseSort,
  parseDateRange,
  simplePaginate,
  validateObjectId,
  setTimestampFilter,
};