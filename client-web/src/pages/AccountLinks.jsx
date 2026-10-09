/**
 * The pages the account emails link to: choosing a new password
 * (/account/password?token=…) and confirming a new email (/account/email?token=…).
 * They work signed in or out.
 */
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Dumbbell, CheckCircle2 } from 'lucide-react';
import { authAPI } from '../api';
import { useAuth } from '../context/AuthContext';

// Same rule as sign-up (server/routes/auth.routes.js).
const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&#]+$/;
const errorText = (err, fallback) => err.response?.data?.errors?.[0]?.message || err.response?.data?.message || fallback;

function Shell({ title, subtitle, children }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-brand-600 text-white flex items-center justify-center"><Dumbbell size={28} /></div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{title}</h1>
          {subtitle && <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{subtitle}</p>}
        </div>
        <div className="card">{children}</div>
      </div>
    </div>
  );
}

function Done({ text, to, action }) {
  return (
    <div className="text-center space-y-4 py-2">
      <CheckCircle2 size={36} className="mx-auto text-emerald-500" />
      <p className="text-sm text-gray-700 dark:text-gray-300">{text}</p>
      <Link to={to} className="btn-primary w-full justify-center">{action}</Link>
    </div>
  );
}

const Problem = ({ text }) => (
  <div className="space-y-4">
    <div className="p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-sm rounded-lg">{text}</div>
    <Link to="/settings" className="btn-secondary w-full justify-center">Go to Settings</Link>
  </div>
);

/** /account/password?token=… — choose the new password. */
export function AccountPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const { user, logout } = useAuth();
  const [state, setState] = useState({ status: 'checking' }); // checking | ready | invalid | done
  const [form, setForm] = useState({ next: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    authAPI.checkPasswordToken(token)
      .then(({ data }) => setState({ status: 'ready', email: data.email }))
      .catch((err) => setState({ status: 'invalid', message: errorText(err, 'This link has expired or was already used.') }));
  }, [token]);

  const submit = async (e) => {
    e.preventDefault();
    if (form.next.length < 8 || !PASSWORD_RULE.test(form.next)) {
      setError('Use at least 8 characters with an uppercase letter, a lowercase letter, a number and a symbol (@$!%*?&).');
      return;
    }
    if (form.next !== form.confirm) { setError("The passwords don't match."); return; }
    setBusy(true);
    setError('');
    try {
      const { data } = await authAPI.resetPassword(token, form.next);
      if (user) await logout(); // every session ended with the change
      setState({ status: 'done', message: data.message });
    } catch (err) {
      setError(errorText(err, 'Could not change your password'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell title="Choose a new password" subtitle={state.email}>
      {state.status === 'checking' && <p className="text-sm text-gray-400 text-center py-4">Checking the link…</p>}
      {state.status === 'invalid' && <Problem text={state.message} />}
      {state.status === 'done' && <Done text={state.message} to="/login" action="Sign in" />}
      {state.status === 'ready' && (
        <form onSubmit={submit} className="space-y-4">
          {error && <div className="p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-sm rounded-lg">{error}</div>}
          {[['next', 'New password'], ['confirm', 'Confirm new password']].map(([k, label]) => (
            <div key={k}>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
              <input type="password" className="input" autoComplete="new-password" value={form[k]} autoFocus={k === 'next'}
                onChange={(e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setError(''); }} />
            </div>
          ))}
          <p className="text-xs text-gray-400 dark:text-gray-500">You'll be signed out on all your devices and can sign in again with the new password.</p>
          <button type="submit" disabled={busy || !form.next || !form.confirm} className="btn-primary w-full justify-center">
            {busy ? 'Changing…' : 'Change password'}
          </button>
        </form>
      )}
    </Shell>
  );
}

/** /account/email?token=… — confirm the new email (a button, so link scanners can't confirm it). */
export function AccountEmail() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const { user, updateUser } = useAuth();
  const [state, setState] = useState({ status: 'ready' }); // ready | invalid | done
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    try {
      const { data } = await authAPI.confirmEmailChange(token);
      if (user) updateUser({ ...user, email: data.email, pendingEmail: null });
      setState({ status: 'done', message: data.message });
    } catch (err) {
      setState({ status: 'invalid', message: errorText(err, 'This link has expired or was already used.') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell title="Confirm your new email">
      {state.status === 'invalid' && <Problem text={state.message} />}
      {state.status === 'done' && <Done text={`${state.message} Sign in with it from now on.`} to={user ? '/settings' : '/login'} action={user ? 'Back to Settings' : 'Sign in'} />}
      {state.status === 'ready' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">Confirm to start signing in to FitTrack with this email address.</p>
          <button onClick={confirm} disabled={busy || !token} className="btn-primary w-full justify-center">{busy ? 'Confirming…' : 'Confirm email'}</button>
        </div>
      )}
    </Shell>
  );
}
