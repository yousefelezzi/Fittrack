const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 50 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 8, select: false },
    avatar: { type: String, default: '' },
    bio: { type: String, maxlength: 200, default: '' },
    height: { type: Number, default: null }, // cm
    weight: { type: Number, default: null }, // kg
    dateOfBirth: { type: Date, default: null },
    bodyFat: { type: Number, min: 3, max: 70, default: null }, // %, used for FFMI — never shown to others
    // Used for the personalized calorie goal (BMR/TDEE) — never shown to others.
    sex: { type: String, enum: ['male', 'female', null], default: null },
    activityLevel: { type: Number, enum: [1.2, 1.375, 1.55, 1.725, 1.9, null], default: null },
    stepGoal: { type: Number, min: 1000, max: 50000, default: 10000 }, // daily steps
    waterGoal: { type: Number, min: 500, max: 8000, default: null }, // ml a day; null = worked out from weight
    waterType: { type: String, enum: ['tap', 'mineral', 'filtered'], default: 'tap' }, // for the minerals in water
    weightUnit: { type: String, enum: ['kg', 'lb'], default: 'kg' }, // default unit when logging lifts
    // Which profile stats other users can see. Everything is private by default.
    statsVisibility: {
      avgCalories: { type: Boolean, default: false },
      ffmi:        { type: Boolean, default: false },
      split:       { type: Boolean, default: false },
      oneRepMaxes: { type: Boolean, default: false },
      avgSteps:    { type: Boolean, default: false },
    },
    fitnessGoal: {
      type: String,
      enum: ['lose_weight', 'build_muscle', 'improve_endurance', 'stay_active', 'other'],
      default: 'stay_active',
    },
    // Privacy settings (Settings page). Defaults keep accounts open, as before.
    privacy: {
      // Followers must be approved; only they see posts, follower lists and stats.
      privateAccount: { type: Boolean, default: false },
      // Who can start or continue a chat: anyone connected to you (either of you
      // follows the other), only people you follow, or nobody.
      messages: { type: String, enum: ['connections', 'following', 'nobody'], default: 'connections' },
      // Whether you show up in people search and suggestions.
      discoverable: { type: Boolean, default: true },
    },
    // People waiting for approval to follow this (private) account.
    followRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

// Hash password before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Hide sensitive fields in JSON output
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);