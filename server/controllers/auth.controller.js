const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { sendMail } = require('../utils/mailer');

const APP_URL = () => (process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/$/, '');
const HOUR = 3600000;
const RESEND_AFTER = 60000; // one email a minute
const newToken = () => crypto.randomBytes(32).toString('hex');
const hashToken = (token) => crypto.createHash('sha256').update(String(token || '')).digest('hex');
const tooSoon = (sentAt) => sentAt && Date.now() - sentAt.getTime() < RESEND_AFTER;

const signTokens = (userId) => {
  const accessToken = jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  });
  const refreshToken = jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  });
  return { accessToken, refreshToken };
};

// POST /api/auth/register
exports.register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ message: 'Email already in use' });

    const user = await User.create({ name, email, password });
    const { accessToken, refreshToken } = signTokens(user._id);

    res.status(201).json({ accessToken, refreshToken, user });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/login
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const { accessToken, refreshToken } = signTokens(user._id);
    user.password = undefined;

    res.json({ accessToken, refreshToken, user });
  } catch (err) {
    next(err);
  }
};

// ── Changing the password (by email link) ─────────────────────────────────────

// POST /api/auth/password/request  — emails a link to change the password
exports.requestPasswordChange = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('+passwordResetSentAt');
    if (tooSoon(user.passwordResetSentAt)) return res.status(429).json({ message: 'We just sent you a link. Wait a minute before asking for another.' });
    const token = newToken();
    user.passwordResetHash = hashToken(token);
    user.passwordResetExpires = new Date(Date.now() + HOUR);
    user.passwordResetSentAt = new Date();
    await user.save();
    await sendMail({
      to: user.email,
      subject: 'Change your FitTrack password',
      heading: 'Change your password',
      paragraphs: [`Hi ${user.name}, use the button below to choose a new password for your FitTrack account.`, 'The link works for 1 hour.'],
      button: { label: 'Change password', url: `${APP_URL()}/account/password?token=${token}` },
      footer: "If you didn't ask for this, you can ignore this email; your password stays the same.",
    });
    res.json({ message: `We sent a link to ${user.email}. Open it to choose your new password (it works for 1 hour).` });
  } catch (err) {
    next(err);
  }
};

const userForPasswordToken = (token) => User.findOne({ passwordResetHash: hashToken(token), passwordResetExpires: { $gt: new Date() } });

// GET /api/auth/password/check?token=  — whether a change-password link still works
exports.checkPasswordToken = async (req, res, next) => {
  try {
    const user = await userForPasswordToken(req.query.token);
    if (!user) return res.status(400).json({ message: 'This link has expired or was already used. Ask for a new one in Settings.' });
    res.json({ email: user.email });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/password/reset { token, newPassword }  — sets the new password; every device is signed out
exports.resetPassword = async (req, res, next) => {
  try {
    const user = await User.findOne({ passwordResetHash: hashToken(req.body.token), passwordResetExpires: { $gt: new Date() } }).select('+password');
    if (!user) return res.status(400).json({ message: 'This link has expired or was already used. Ask for a new one in Settings.' });
    if (await user.comparePassword(req.body.newPassword)) {
      return res.status(400).json({ message: 'The new password is the same as the current one' });
    }
    user.password = req.body.newPassword; // hashed on save
    user.passwordChangedAt = new Date();
    user.passwordResetHash = null;
    user.passwordResetExpires = null;
    await user.save();
    sendMail({
      to: user.email,
      subject: 'Your FitTrack password was changed',
      heading: 'Your password was changed',
      paragraphs: [`Hi ${user.name}, the password for your FitTrack account was just changed, and you've been signed out on your devices.`],
      footer: "If this wasn't you, contact us right away.",
    }).catch((err) => console.error('Password-changed email failed:', err.message));
    res.json({ message: 'Password changed. Sign in with your new password.' });
  } catch (err) {
    next(err);
  }
};

// ── Changing the email (confirmed from the new address) ──────────────────────

// POST /api/auth/email/request { newEmail, password }  — sends a confirmation link to the new address
exports.requestEmailChange = async (req, res, next) => {
  try {
    const newEmail = String(req.body.newEmail).trim().toLowerCase();
    const user = await User.findById(req.user.id).select('+password +emailChangeSentAt');
    if (!(await user.comparePassword(req.body.password))) return res.status(400).json({ message: 'Your password is wrong' });
    if (newEmail === user.email) return res.status(400).json({ message: "That's already your email" });
    if (await User.exists({ email: newEmail })) return res.status(409).json({ message: 'That email is already used by another account' });
    if (tooSoon(user.emailChangeSentAt)) return res.status(429).json({ message: 'We just sent a link. Wait a minute before asking for another.' });
    const token = newToken();
    user.pendingEmail = newEmail;
    user.emailChangeHash = hashToken(token);
    user.emailChangeExpires = new Date(Date.now() + 24 * HOUR);
    user.emailChangeSentAt = new Date();
    await user.save();
    await sendMail({
      to: newEmail,
      subject: 'Confirm your new FitTrack email',
      heading: 'Confirm your new email',
      paragraphs: [`Hi ${user.name}, confirm that you want to use ${newEmail} for your FitTrack account. Until then you keep signing in with ${user.email}.`, 'The link works for 24 hours.'],
      button: { label: 'Confirm email', url: `${APP_URL()}/account/email?token=${token}` },
      footer: "If you didn't ask for this, you can ignore this email.",
    });
    res.json({ message: `We sent a link to ${newEmail}. Open it to confirm the change.`, pendingEmail: newEmail });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/auth/email/request  — cancels a pending email change
exports.cancelEmailChange = async (req, res, next) => {
  try {
    await User.updateOne({ _id: req.user.id }, { pendingEmail: null, emailChangeHash: null, emailChangeExpires: null });
    res.json({ message: 'Email change cancelled' });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/email/confirm { token }  — switches to the new email; the old address is told
exports.confirmEmailChange = async (req, res, next) => {
  try {
    const user = await User.findOne({ emailChangeHash: hashToken(req.body.token), emailChangeExpires: { $gt: new Date() } });
    if (!user || !user.pendingEmail) return res.status(400).json({ message: 'This link has expired or was already used. Ask for a new one in Settings.' });
    if (await User.exists({ email: user.pendingEmail, _id: { $ne: user._id } })) {
      return res.status(409).json({ message: 'That email is now used by another account' });
    }
    const oldEmail = user.email;
    user.email = user.pendingEmail;
    user.pendingEmail = null;
    user.emailChangeHash = null;
    user.emailChangeExpires = null;
    await user.save();
    sendMail({
      to: oldEmail,
      subject: 'Your FitTrack email was changed',
      heading: 'Your email was changed',
      paragraphs: [`Hi ${user.name}, your FitTrack account now uses ${user.email}. Sign in with that address from now on.`],
      footer: "If this wasn't you, contact us right away.",
    }).catch((err) => console.error('Email-changed notice failed:', err.message));
    res.json({ message: `Your email is now ${user.email}.`, email: user.email });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'That email is now used by another account' });
    next(err);
  }
};

// POST /api/auth/refresh
exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(401).json({ message: 'Refresh token required' });

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id).select('+passwordChangedAt');
    if (!user) return res.status(401).json({ message: 'User not found' });
    // Signed in before the password was changed: sign in again.
    if (user.passwordChangedAt && decoded.iat * 1000 < user.passwordChangedAt.getTime() - 1000) {
      return res.status(401).json({ message: 'Your password was changed. Sign in again.', code: 'SESSION_ENDED' });
    }

    const tokens = signTokens(user._id);
    res.json(tokens);
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Invalid or expired refresh token' });
    }
    next(err);
  }
};

// POST /api/auth/logout
exports.logout = async (req, res) => {
  // With stateless JWT, logout is handled client-side by deleting tokens.
  // If you add a token blacklist (Redis), invalidate here.
  res.json({ message: 'Logged out successfully' });
};

// GET /api/auth/me
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id)
      .populate('followers', 'name avatar')
      .populate('following', 'name avatar');
    res.json(user);
  } catch (err) {
    next(err);
  }
};
