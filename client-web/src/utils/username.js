/**
 * Usernames (rules on the server: utils/username.js). Shared by the web and
 * mobile clients; mobile imports it through its Metro config.
 */
import { useEffect, useState } from 'react';

export const USERNAME_HINT = '3–20 letters, numbers, periods or underscores.';

/** What's typed, cleaned up as you go: lowercase, no @, only allowed characters. */
export const cleanUsername = (v) => String(v || '').replace(/^@/, '').toLowerCase().replace(/[^a-z0-9._]/g, '').slice(0, 20);

/** "@name" for a user, or ''. */
export const atName = (u) => (u?.username ? `@${u.username}` : '');

/**
 * Checks a username as it's typed (after a short pause): { status: 'idle' |
 * 'checking' | 'ok' | 'bad', message }. `current` (your own) counts as fine.
 * `check(username)` calls GET /auth/username-available.
 */
export function useUsernameCheck(value, check, current = '') {
  const [result, setResult] = useState({ status: 'idle', message: '' });
  useEffect(() => {
    const u = cleanUsername(value);
    if (!u || u === current) { setResult({ status: 'idle', message: '' }); return undefined; }
    setResult({ status: 'checking', message: 'Checking…' });
    let cancelled = false;
    const id = setTimeout(() => {
      check(u)
        .then(({ data }) => { if (!cancelled) setResult({ status: data.available ? 'ok' : 'bad', message: data.message }); })
        .catch(() => { if (!cancelled) setResult({ status: 'idle', message: '' }); });
    }, 350);
    return () => { cancelled = true; clearTimeout(id); };
  }, [value, current, check]);
  return result;
}
