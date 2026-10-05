/**
 * server/hooks/useModelHooks.js
 *
 * Reusable Mongoose lifecycle hook helpers that can be attached to any schema.
 * Import and call inside a schema definition file before compiling the model.
 *
 * Example:
 *   const { attachTimestamps, attachSoftDelete } = require('../hooks/useModelHooks');
 *   attachSoftDelete(mySchema);
 */

const mongoose = require('mongoose');

/**
 * attachSoftDelete(schema)
 *
 * Adds `deletedAt` field and:
 *  - schema.methods.softDelete()  — marks the doc as deleted
 *  - schema.methods.restore()     — restores the doc
 *  - schema.statics.findActive()  — query helper that excludes soft-deleted docs
 *
 * Automatically filters out soft-deleted docs from find / findOne /
 * findOneAndUpdate / count queries unless { includeDeleted: true } is passed
 * in the query options.
 */
function attachSoftDelete(schema) {
  schema.add({ deletedAt: { type: Date, default: null } });

  // Instance helpers
  schema.methods.softDelete = async function () {
    this.deletedAt = new Date();
    return this.save();
  };

  schema.methods.restore = async function () {
    this.deletedAt = null;
    return this.save();
  };

  schema.methods.isDeleted = function () {
    return this.deletedAt !== null;
  };

  // Static helper
  schema.statics.findActive = function (filter = {}, projection, options) {
    return this.find({ ...filter, deletedAt: null }, projection, options);
  };

  // Auto-filter middleware
  const excludeDeleted = function () {
    if (this.getOptions().includeDeleted) return;
    if (!this.getFilter().deletedAt) {
      this.where({ deletedAt: null });
    }
  };

  schema.pre('find',              excludeDeleted);
  schema.pre('findOne',           excludeDeleted);
  schema.pre('findOneAndUpdate',  excludeDeleted);
  schema.pre('countDocuments',    excludeDeleted);
}

/**
 * attachSlug(schema, sourceField = 'name')
 *
 * Auto-generates a URL-safe `slug` from `sourceField` before save.
 * Collisions are handled by appending a short random suffix.
 */
function attachSlug(schema, sourceField = 'name') {
  schema.add({ slug: { type: String, unique: true, sparse: true } });

  schema.pre('save', async function () {
    if (!this.isModified(sourceField) && this.slug) return;

    const base = (this[sourceField] || '')
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/^-+|-+$/g, '');

    let candidate = base;
    let attempts  = 0;

    // Avoid infinite loop
    while (attempts < 10) {
      const existing = await this.constructor.findOne({ slug: candidate, _id: { $ne: this._id } });
      if (!existing) break;
      candidate = `${base}-${Math.random().toString(36).slice(2, 7)}`;
      attempts++;
    }

    this.slug = candidate;
  });
}

/**
 * attachAudit(schema)
 *
 * Tracks `createdBy` and `updatedBy` user references.
 * Requires the calling code to set `req.user` on the document
 * or call doc.setAuditUser(userId) before saving.
 *
 * Example:
 *   const workout = new WorkoutSession({ ...body });
 *   workout.setAuditUser(req.user.id);
 *   await workout.save();
 */
function attachAudit(schema) {
  schema.add({
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  });

  schema.methods.setAuditUser = function (userId) {
    if (!this.createdBy) this.createdBy = userId;
    this.updatedBy = userId;
  };
}

/**
 * attachVersionHistory(schema, maxVersions = 10)
 *
 * Keeps a capped array of previous JSON snapshots whenever the doc
 * is saved. Useful for undo / audit trails without a separate collection.
 */
function attachVersionHistory(schema, maxVersions = 10) {
  schema.add({
    _history: {
      type: [
        {
          savedAt:  { type: Date, default: Date.now },
          snapshot: { type: mongoose.Schema.Types.Mixed },
        },
      ],
      select: false,
      default: [],
    },
  });

  schema.pre('save', function () {
    if (this.isNew) return;

    const snap = this.toObject();
    delete snap._history;

    this._history.push({ savedAt: new Date(), snapshot: snap });

    if (this._history.length > maxVersions) {
      this._history = this._history.slice(-maxVersions);
    }
  });

  schema.methods.getHistory = function () {
    return this._history || [];
  };
}

module.exports = { attachSoftDelete, attachSlug, attachAudit, attachVersionHistory };