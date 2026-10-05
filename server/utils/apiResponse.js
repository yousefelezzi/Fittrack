/**
 * server/utils/apiResponse.js
 *
 * Thin helpers that controllers can use instead of writing
 * `res.status(200).json(...)` by hand every time.
 *
 * Usage:
 *   const { ok, created, notFound, forbidden, conflict } = require('../utils/apiResponse');
 *
 *   exports.getById = async (req, res, next) => {
 *     try {
 *       const doc = await Model.findById(req.params.id);
 *       if (!doc) return notFound(res, 'Workout not found');
 *       ok(res, doc);
 *     } catch (err) { next(err); }
 *   };
 */

/** 200 OK */
const ok = (res, data = {}) => res.status(200).json(data);

/** 201 Created */
const created = (res, data = {}) => res.status(201).json(data);

/** 204 No Content */
const noContent = (res) => res.status(204).send();

/** 400 Bad Request */
const badRequest = (res, message = 'Bad request', errors = []) =>
  res.status(400).json({ message, ...(errors.length && { errors }) });

/** 401 Unauthorized */
const unauthorized = (res, message = 'Not authenticated') =>
  res.status(401).json({ message });

/** 403 Forbidden */
const forbidden = (res, message = 'Forbidden') =>
  res.status(403).json({ message });

/** 404 Not Found */
const notFound = (res, message = 'Not found') =>
  res.status(404).json({ message });

/** 409 Conflict */
const conflict = (res, message = 'Conflict') =>
  res.status(409).json({ message });

/** 422 Unprocessable Entity */
const unprocessable = (res, message = 'Validation failed', errors = []) =>
  res.status(422).json({ message, ...(errors.length && { errors }) });

/** 500 Internal Server Error (for manual use — most errors go through errorHandler) */
const serverError = (res, message = 'Internal server error') =>
  res.status(500).json({ message });

/**
 * Paginated list helper.
 * Wraps an array result with standard pagination metadata.
 *
 * @param {Response} res
 * @param {Array}    items
 * @param {number}   total    — total matching documents in DB
 * @param {number}   page     — current page (1-indexed)
 * @param {number}   limit    — items per page
 */
const paginated = (res, items, total, page, limit) =>
  res.status(200).json({
    data:  items,
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  });

module.exports = {
  ok,
  created,
  noContent,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  unprocessable,
  serverError,
  paginated,
};