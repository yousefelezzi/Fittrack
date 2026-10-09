const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const protect = require('../middleware/auth');
const {
  register,
  login,
  refreshToken,
  logout,
  getMe,
  requestPasswordChange,
  checkPasswordToken,
  resetPassword,
  requestEmailChange,
  cancelEmailChange,
  confirmEmailChange,
  verifyLogin,
  usernameAvailable,
  resendLoginCode,
  requestTwoFactor,
  confirmTwoFactor,
  disableTwoFactor,
} = require('../controllers/auth.controller');

router.post(
  '/register',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('username').isString().trim().notEmpty().withMessage('Pick a username'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&#]+$/)
      .withMessage('Password must include uppercase, lowercase, number, and special character'),
  ],
  validate,
  register
);

router.post(
  '/login',
  [
    body('email').isString().trim().notEmpty().withMessage('Enter your email or username'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validate,
  login
);

// Two-step sign-in: the emailed code, sent back with the challenge from /login.
const codeRule = body('code').matches(/^\s*\d{6}\s*$/).withMessage('Enter the 6-digit code');
router.post('/login/verify', [body('challenge').isString().notEmpty().withMessage('Sign in again'), codeRule], validate, verifyLogin);
router.post('/login/resend', [body('challenge').isString().notEmpty().withMessage('Sign in again')], validate, resendLoginCode);
router.post('/2fa/enable/request', protect, [body('password').notEmpty().withMessage('Enter your password')], validate, requestTwoFactor);
router.post('/2fa/enable/confirm', protect, [codeRule], validate, confirmTwoFactor);
router.post('/2fa/disable', protect, [body('password').notEmpty().withMessage('Enter your password')], validate, disableTwoFactor);

router.get('/username-available', usernameAvailable);
router.post('/refresh', refreshToken);
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);
// Changing the password: a link is emailed, the new password is set on the page it opens.
router.post('/password/request', protect, requestPasswordChange);
router.get('/password/check', checkPasswordToken);
router.post(
  '/password/reset',
  [
    body('token').isString().notEmpty().withMessage('The link is missing its code'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&#]+$/)
      .withMessage('New password must include uppercase, lowercase, number, and special character'),
  ],
  validate,
  resetPassword
);

// Changing the email: password, then confirmed from a link sent to the new address.
router.post(
  '/email/request',
  protect,
  [
    body('newEmail').isEmail().withMessage('Enter a valid email'),
    body('password').notEmpty().withMessage('Enter your password'),
  ],
  validate,
  requestEmailChange
);
router.delete('/email/request', protect, cancelEmailChange);
router.post('/email/confirm', [body('token').isString().notEmpty().withMessage('The link is missing its code')], validate, confirmEmailChange);

module.exports = router;
