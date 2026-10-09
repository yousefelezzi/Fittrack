const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 50 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 8, select: false },
    // Sessions (tokens) from before this are signed out.
    passwordChangedAt: { type: Date, default: null, select: false },
    // Changing the password: a link is emailed; the new password is set on the page it opens.
    passwordResetHash: { type: String, default: null, select: false },
    passwordResetExpires: { type: Date, default: null, select: false },
    passwordResetSentAt: { type: Date, default: null, select: false },
    // When the new user finished (or skipped) the Get Started page; until then
    // the apps send them there.
    onboardedAt: { type: Date, default: null },
    // Two-step sign-in: after the password, a code emailed to the user.
    twoFactorEnabled: { type: Boolean, default: false },
    // The latest emailed code (signing in, or turning two-step on): hashed,
    // short-lived, a few tries. A sign-in also has a challenge the app sends back.
    emailCodeHash: { type: String, default: null, select: false },
    emailCodePurpose: { type: String, enum: ['login', 'enable2fa', null], default: null, select: false },
    emailCodeExpires: { type: Date, default: null, select: false },
    emailCodeAttempts: { type: Number, default: 0, select: false },
    emailCodeSentAt: { type: Date, default: null, select: false },
    loginChallengeHash: { type: String, default: null, select: false },
    // Changing the email: confirmed from a link sent to the new address.
    pendingEmail: { type: String, lowercase: true, trim: true, default: null },
    emailChangeHash: { type: String, default: null, select: false },
    emailChangeExpires: { type: Date, default: null, select: false },
    emailChangeSentAt: { type: Date, default: null, select: false },
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
    // How body weight and height are shown and typed (stored in kg and cm).
    bodyWeightUnit: { type: String, enum: ['kg', 'lb'], default: 'kg' },
    heightUnit: { type: String, enum: ['cm', 'ft'], default: 'cm' }, // ft = feet and inches
    // Correct the calorie goal from the last two weeks' weight trend and intake (utils/adaptiveCalories.js).
    adaptiveCalories: { type: Boolean, default: true },
    // Reminders (phone notifications, and cards on the web dashboard) at a
    // time of day ('HH:mm', the user's local time). Off until turned on. The
    // workout reminder follows the active plan's days (turned on when a plan
    // is set active); the supplement one is set on the Supplements page.
    reminders: {
      workout:     { enabled: { type: Boolean, default: false }, time: { type: String, default: '08:00' } },
      supplements: { enabled: { type: Boolean, default: false }, time: { type: String, default: '20:00' } },
    },
    // Custom foods and recipes saved from posts and messages (shown with your own in food search).
    savedFoods: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Food' }],
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