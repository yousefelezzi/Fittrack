/**
 * Privacy rules, in one place so every endpoint applies them the same way.
 * Users are lean or full documents with followers/following/privacy loaded.
 */
const ids = (list) => (list || []).map((x) => String(x?._id ?? x));

/** Whether `viewerId` sees this user's posts, follower lists and stats. */
function canViewContent(user, viewerId) {
  if (!user) return false;
  if (String(user._id) === String(viewerId)) return true;
  if (!user.privacy?.privateAccount) return true;
  return ids(user.followers).includes(String(viewerId));
}

/**
 * Whether `viewerId` may message this user, by the user's setting:
 *   connections — either of you follows the other (the default)
 *   following   — only people this user follows
 *   nobody      — no one
 */
function canMessage(user, viewerId) {
  if (!user || String(user._id) === String(viewerId)) return false;
  const setting = user.privacy?.messages || 'connections';
  if (setting === 'nobody') return false;
  const theyFollowViewer = ids(user.following).includes(String(viewerId));
  if (setting === 'following') return theyFollowViewer;
  return theyFollowViewer || ids(user.followers).includes(String(viewerId));
}

/** Fields needed by the checks above. */
const PRIVACY_FIELDS = 'privacy followers following';

module.exports = { canViewContent, canMessage, PRIVACY_FIELDS };
