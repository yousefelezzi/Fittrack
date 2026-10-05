/**
 * server/utils/asyncHandler.js
 *
 * Wraps an async Express route handler so you never forget `try/catch`.
 * Any thrown error is automatically forwarded to the next() error handler.
 *
 * Usage:
 *   const asyncHandler = require('../utils/asyncHandler');
 *
 *   router.get('/:id', protect, asyncHandler(async (req, res) => {
 *     const doc = await Model.findById(req.params.id);
 *     res.json(doc);
 *   }));
 *
 * Equivalent to wrapping in try/catch + next(err), without the boilerplate.
 */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;