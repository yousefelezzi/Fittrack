/**
 * Usernames: unique, case-insensitive (stored lowercase), 3–20 letters,
 * numbers, periods and underscores; no period at the start or end or two in a row.
 */
const User = require('../models/User');

const RULE = /^(?!\.)(?!.*\.\.)(?!.*\.$)[a-z0-9._]{3,20}$/;
const RESERVED = new Set(['admin', 'administrator', 'fittrack', 'support', 'help', 'settings', 'login', 'register', 'signup', 'api', 'me', 'root', 'system', 'moderator', 'staff', 'official']);

const normalize = (u) => String(u || '').trim().replace(/^@/, '').toLowerCase();

/** What's wrong with a username's format, or ''. */
function usernameProblem(username) {
  const u = normalize(username);
  if (u.length < 3 || u.length > 20) return 'Usernames are 3 to 20 characters';
  if (!RULE.test(u)) return 'Use letters, numbers, periods and underscores (no period at the start or end, or two in a row)';
  if (RESERVED.has(u)) return "That username isn't available";
  return '';
}

/** Whether someone other than `exceptId` has it. */
const usernameTaken = async (username, exceptId = null) => Boolean(await User.exists({ username: normalize(username), ...(exceptId && { _id: { $ne: exceptId } }) }));

/** A free username based on a name or email (for accounts made before usernames). */
async function makeUsername(name, email) {
  let base = normalize(name).normalize('NFKD').replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '').replace(/\.{2,}/g, '.').slice(0, 16);
  if (base.length < 3) base = normalize(String(email).split('@')[0]).replace(/[^a-z0-9._]/g, '').replace(/^\.+|\.+$/g, '').replace(/\.{2,}/g, '.').slice(0, 16);
  if (base.length < 3) base = 'user';
  if (RESERVED.has(base)) base = `${base}.fit`;
  for (let n = 0; n < 1000; n++) {
    const candidate = n === 0 ? base : `${base}${n}`.slice(0, 20);
    if (!(await usernameTaken(candidate))) return candidate;
  }
  return `user${Date.now().toString(36)}`;
}

module.exports = { normalize, usernameProblem, usernameTaken, makeUsername };
