const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { sendMail } = require('../utils/mailer');
const { normalize: normalizeUsername, usernameProblem, usernameTaken } = require('../utils/username');

const APP_URL = () => (process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/$/, '');
const HOUR = 3600000;
const RESEND_AFTER = 60000; // one email a minute
const newToken = () => crypto.randomBytes(32).toString('hex');
const hashToken = (token) => crypto.createHash('sha256').update(String(token || '')).digest('hex');
const tooSoon = (sentAt) => sentAt && Date.now() - sentAt.getTime() < RESEND_AFTER;

// ── Emailed codes (two-step sign-in) ─────────────────────────────────────────
const CODE_TTL = 10 * 60000;
const CODE_TRIES = 5;
const CODE_FIELDS = '+emailCodeHash +emailCodePurpose +emailCodeExpires +emailCodeAttempts +emailCodeSentAt +loginChallengeHash';
const codeHash = (user, code) => hashToken(`${user._id}:${String(code).replace(/\D/g, '')}`);
const maskEmail = (email) => email.replace(/^(.)(.*)(.@)/, (_, a, mid, b) => `${a}${'•'.repeat(Math.min(mid.length, 6))}${b}`);

/** Puts a fresh 6-digit code on the user (save it afterwards) and returns it. */
function issueCode(user, purpose) {
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  user.emailCodeHash = codeHash(user, code);
  user.emailCodePurpose = purpose;
  user.emailCodeExpires = new Date(Date.now() + CODE_TTL);
  user.emailCodeAttempts = 0;
  user.emailCodeSentAt = new Date();
  return code;
}

/** 'ok' | 'expired' | 'locked' | 'wrong' for a typed code (counts the try). */
function checkCode(user, purpose, code) {
  if (user.emailCodePurpose !== purpose || !user.emailCodeHash || !user.emailCodeExpires || user.emailCodeExpires < new Date()) return 'expired';
  if (user.emailCodeAttempts >= CODE_TRIES) return 'locked';
  const a = Buffer.from(codeHash(user, code));
  const b = Buffer.from(user.emailCodeHash);
  if (a.length === b.length && crypto.timingSafeEqual(a, b)) return 'ok';
  user.emailCodeAttempts += 1;
  return user.emailCodeAttempts >= CODE_TRIES ? 'locked' : 'wrong';
}

const clearCode = (user) => {
  user.emailCodeHash = null;
  user.emailCodePurpose = null;
  user.emailCodeExpires = null;
  user.emailCodeAttempts = 0;
  user.loginChallengeHash = null;
};

const codeProblem = (result, user) => ({
  expired: [400, 'This code has expired. Ask for a new one.'],
  locked: [429, 'Too many wrong codes. Ask for a new one.'],
  wrong: [400, `That code isn't right. ${CODE_TRIES - user.emailCodeAttempts} ${CODE_TRIES - user.emailCodeAttempts === 1 ? 'try' : 'tries'} left.`],
}[result]);

const sendCode = (user, code, purpose) => sendMail({
  to: user.email,
  subject: purpose === 'login' ? `${code} is your FitTrack sign-in code` : `${code} is your FitTrack code`,
  heading: purpose === 'login' ? 'Your sign-in code' : 'Turn on two-step sign-in',
  paragraphs: [
    purpose === 'login' ? `Hi ${user.name}, enter this code to finish signing in to FitTrack:` : `Hi ${user.name}, enter this code in FitTrack to turn on two-step sign-in:`,
    code,
    'It works for 10 minutes.',
  ],
  footer: purpose === 'login'
    ? "If you didn't just try to sign in, someone may know your password. Change it in Settings."
    : "If you didn't ask for this, you can ignore this email.",
});

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
    const username = normalizeUsername(req.body.username);
    const problem = usernameProblem(username);
    if (problem) return res.status(422).json({ message: problem, errors: [{ field: 'username', message: problem }] });

    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ message: 'Email already in use' });
    if (await usernameTaken(username)) return res.status(409).json({ message: 'That username is taken' });

    const user = await User.create({ name, email, username, password });
    const { accessToken, refreshToken } = signTokens(user._id);

    res.status(201).json({ accessToken, refreshToken, user });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: err.keyPattern?.username ? 'That username is taken' : 'Email already in use' });
    next(err);
  }
};

// GET /api/auth/username-available?username=…  — for sign-up and changing it (signed-in users keep their own)
exports.usernameAvailable = async (req, res, next) => {
  try {
    const username = normalizeUsername(req.query.username);
    const problem = usernameProblem(username);
    if (problem) return res.json({ username, available: false, message: problem });
    let me = null;
    const auth = req.headers.authorization;
    if (auth?.startsWith('Bearer ')) {
      try { me = jwt.verify(auth.slice(7), process.env.JWT_SECRET).id; } catch { /* not signed in */ }
    }
    const taken = await usernameTaken(username, me);
    res.json({ username, available: !taken, message: taken ? 'That username is taken' : 'Available' });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/login
exports.login = async (req, res, next) => {
  try {
    const { password } = req.body;
    // Email or username.
    const login = String(req.body.email || req.body.login || '').trim().toLowerCase();
    // An email has an @ in the middle; "@name" or "name" is a username.
    const query = login.indexOf('@') > 0 ? { email: login } : { username: normalizeUsername(login) };

    const user = login ? await User.findOne(query).select('+password') : null;
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Wrong email/username or password' });
    }

    // Two-step sign-in: email a code; the app sends it back with the challenge.
    if (user.twoFactorEnabled) {
      const challenge = newToken();
      const code = issueCode(user, 'login');
      user.loginChallengeHash = hashToken(challenge);
      await user.save();
      try {
        await sendCode(user, code, 'login');
      } catch (err) {
        console.error('Sign-in code email failed:', err.message);
        return res.status(503).json({ message: "We couldn't email your sign-in code. Try again in a moment." });
      }
      return res.json({ twoFactorRequired: true, challenge, email: maskEmail(user.email) });
    }

    const { accessToken, refreshToken } = signTokens(user._id);
    user.password = undefined;

    res.json({ accessToken, refreshToken, user });
  } catch (err) {
    next(err);
  }
};

// ── Two-step sign-in ─────────────────────────────────────────────────────────

const userForChallenge = (challenge) => User.findOne({ loginChallengeHash: hashToken(challenge) }).select(CODE_FIELDS);

// POST /api/auth/login/verify { challenge, code }  — finishes a two-step sign-in
exports.verifyLogin = async (req, res, next) => {
  try {
    const user = await userForChallenge(req.body.challenge);
    if (!user) return res.status(400).json({ message: 'This sign-in has expired. Sign in again.' });
    const result = checkCode(user, 'login', req.body.code);
    if (result !== 'ok') {
      await user.save();
      const [status, message] = codeProblem(result, user);
      return res.status(status).json({ message });
    }
    clearCode(user);
    await user.save();
    const { accessToken, refreshToken } = signTokens(user._id);
    const fresh = await User.findById(user._id);
    res.json({ accessToken, refreshToken, user: fresh });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/login/resend { challenge }  — a new sign-in code
exports.resendLoginCode = async (req, res, next) => {
  try {
    const user = await userForChallenge(req.body.challenge);
    if (!user || user.emailCodePurpose !== 'login') return res.status(400).json({ message: 'This sign-in has expired. Sign in again.' });
    if (tooSoon(user.emailCodeSentAt)) return res.status(429).json({ message: 'We just sent a code. Wait a minute before asking for another.' });
    const code = issueCode(user, 'login');
    await user.save();
    await sendCode(user, code, 'login');
    res.json({ message: `We sent a new code to ${maskEmail(user.email)}.` });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/2fa/enable/request { password }  — emails a code to turn two-step sign-in on
exports.requestTwoFactor = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select(`+password ${CODE_FIELDS}`);
    if (!(await user.comparePassword(req.body.password))) return res.status(400).json({ message: 'Your password is wrong' });
    if (user.twoFactorEnabled) return res.status(400).json({ message: 'Two-step sign-in is already on' });
    if (user.emailCodePurpose === 'enable2fa' && tooSoon(user.emailCodeSentAt)) {
      return res.status(429).json({ message: 'We just sent a code. Wait a minute before asking for another.' });
    }
    const code = issueCode(user, 'enable2fa');
    await user.save();
    await sendCode(user, code, 'enable2fa');
    res.json({ message: `We sent a code to ${user.email}. Enter it to turn two-step sign-in on.` });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/2fa/enable/confirm { code }  — turns two-step sign-in on (the code proves emails arrive)
exports.confirmTwoFactor = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select(CODE_FIELDS);
    const result = checkCode(user, 'enable2fa', req.body.code);
    if (result !== 'ok') {
      await user.save();
      const [status, message] = codeProblem(result, user);
      return res.status(status).json({ message });
    }
    clearCode(user);
    user.twoFactorEnabled = true;
    await user.save();
    res.json({ message: "Two-step sign-in is on. Next time you sign in, we'll email you a code.", twoFactorEnabled: true });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/2fa/disable { password }  — turns two-step sign-in off
exports.disableTwoFactor = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select(`+password ${CODE_FIELDS}`);
    if (!(await user.comparePassword(req.body.password))) return res.status(400).json({ message: 'Your password is wrong' });
    user.twoFactorEnabled = false;
    clearCode(user);
    await user.save();
    sendMail({
      to: user.email,
      subject: 'Two-step sign-in was turned off',
      heading: 'Two-step sign-in is off',
      paragraphs: [`Hi ${user.name}, two-step sign-in was just turned off for your FitTrack account. Signing in now only needs your password.`],
      footer: "If this wasn't you, change your password in Settings right away.",
    }).catch((err) => console.error('2FA-off email failed:', err.message));
    res.json({ message: 'Two-step sign-in is off.', twoFactorEnabled: false });
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
      .populate('followers', 'name username avatar')
      .populate('following', 'name username avatar');
    res.json(user);
  } catch (err) {
    next(err);
  }
};
