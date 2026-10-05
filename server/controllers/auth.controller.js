const jwt = require('jsonwebtoken');
const User = require('../models/User');

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

// PUT /api/auth/password  { currentPassword, newPassword }
exports.changePassword = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('+password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!(await user.comparePassword(req.body.currentPassword))) {
      return res.status(400).json({ message: 'Your current password is wrong' });
    }
    if (await user.comparePassword(req.body.newPassword)) {
      return res.status(400).json({ message: 'The new password is the same as the current one' });
    }
    user.password = req.body.newPassword; // hashed on save
    await user.save();
    res.json({ message: 'Password changed' });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/refresh
exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(401).json({ message: 'Refresh token required' });

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ message: 'User not found' });

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
